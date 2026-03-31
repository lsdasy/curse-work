package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
)

// profileHandler returns user profile information
func profileHandler(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)

	var user User
	err := db.QueryRow("SELECT id, login, role, created_at, updated_at FROM users WHERE id = ?", userID).Scan(
		&user.ID, &user.Login, &user.Role, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

// getCoursesHandler returns all available courses
func getCoursesHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id, title, description, created_at, updated_at FROM courses ORDER BY created_at DESC")
	if err != nil {
		http.Error(w, "Error fetching courses", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var courses []Course
	for rows.Next() {
		var course Course
		err := rows.Scan(&course.ID, &course.Title, &course.Description, &course.CreatedAt, &course.UpdatedAt)
		if err != nil {
			http.Error(w, "Error scanning course", http.StatusInternalServerError)
			return
		}
		courses = append(courses, course)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(courses)
}

// getCourseResultsHandler returns user's course results
func getCourseResultsHandler(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)

	rows, err := db.Query(`
		   SELECT cr.id, cr.user_id, cr.course_id, cr.score, cr.status, cr.completed_at, c.title
		   FROM course_results cr
		   JOIN courses c ON cr.course_id = c.id
		   WHERE cr.user_id = ?
		   ORDER BY cr.completed_at DESC`, userID)
	if err != nil {
		log.Printf("Error fetching course results: %v", err)
		http.Error(w, "Error fetching course results", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var results []CourseResult
	for rows.Next() {
		var result CourseResult
		// Score is now a *float64, allow NULL scores for theory-only courses
		err := rows.Scan(&result.ID, &result.UserID, &result.CourseID, &result.Score,
			&result.Status, &result.CompletedAt, &result.CourseTitle)
		if err != nil {
			log.Printf("course-results scan warning: %v", err)
			continue
		}
		results = append(results, result)
	}

	if results == nil {
		results = []CourseResult{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// submitCourseResultHandler marks a course as studied/completed by the user.
// The frontend no longer supplies a score; courses are theory‑only and simply
// appear in the "results" tab when finished.
func submitCourseResultHandler(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)
	var err error

	var payload struct {
		CourseID int `json:"course_id"`
	}
	if err = json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if payload.CourseID <= 0 {
		http.Error(w, "Invalid course ID", http.StatusBadRequest)
		return
	}

	// verify course exists (better error feedback)
	var existsInt int
	err = db.QueryRow("SELECT EXISTS(SELECT 1 FROM courses WHERE id = ?)", payload.CourseID).Scan(&existsInt)
	if err != nil {
		fmt.Printf("submitCourseResultHandler: lookup error: %v payload=%+v user=%d\n", err, payload, userID)
		http.Error(w, fmt.Sprintf("Error submitting course result: %v", err), http.StatusInternalServerError)
		return
	}
	if existsInt == 0 {
		http.Error(w, "Course not found", http.StatusBadRequest)
		return
	}

	// Insert or update course result with status 'studied'
	_, err = db.Exec(`
        INSERT INTO course_results (user_id, course_id, score, status) 
        VALUES (?, ?, NULL, 'studied')
        ON DUPLICATE KEY UPDATE 
        score = NULL,
        status = 'studied',
        completed_at = CURRENT_TIMESTAMP`,
		userID, payload.CourseID)

	if err != nil {
		fmt.Printf("submitCourseResultHandler: db error: %v payload=%+v user=%d\n", err, payload, userID)
		http.Error(w, fmt.Sprintf("Error submitting course result: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Course marked as studied"})
}

// saveQuestionAnswerHandler persists a student's response to a quiz question.
func saveQuestionAnswerHandler(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)
	var payload struct {
		QuestionID       int  `json:"question_id"`
		SelectedOptionID int  `json:"selected_option_id"`
		IsCorrect        bool `json:"is_correct"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if payload.QuestionID <= 0 || payload.SelectedOptionID <= 0 {
		http.Error(w, "Invalid question or option ID", http.StatusBadRequest)
		return
	}

	_, err := db.Exec(`
        INSERT INTO question_answers (user_id, question_id, selected_option_id, is_correct)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            selected_option_id = VALUES(selected_option_id),
            is_correct = VALUES(is_correct),
            created_at = CURRENT_TIMESTAMP
    `, userID, payload.QuestionID, payload.SelectedOptionID, payload.IsCorrect)
	if err != nil {
		log.Printf("saveQuestionAnswerHandler: %v", err)
		http.Error(w, "Error saving answer", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Answer saved"})
}

// getQuestionAnswersHandler returns all answers the user has submitted.
// Each record includes question text, course/lesson context and selected option text.
func getQuestionAnswersHandler(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)
	rows, err := db.Query(`
        SELECT qa.id, qa.question_id, qa.selected_option_id, qa.is_correct,
               q.question_text,
               COALESCE(c.title, '') AS course_title,
               COALESCE(l.title, '') AS lesson_title,
               qo.option_text
        FROM question_answers qa
        JOIN questions q ON qa.question_id = q.id
        LEFT JOIN question_options qo ON qa.selected_option_id = qo.id
        LEFT JOIN lessons l ON q.lesson_id = l.id
        LEFT JOIN courses c ON COALESCE(q.course_id, l.course_id) = c.id
        WHERE qa.user_id = ?
        ORDER BY qa.created_at DESC
    `, userID)
	if err != nil {
		log.Printf("getQuestionAnswersHandler: %v", err)
		http.Error(w, "Error fetching answers", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Answer struct {
		ID                 int    `json:"id"`
		QuestionID         int    `json:"question_id"`
		SelectedOptionID   int    `json:"selected_option_id"`
		IsCorrect          bool   `json:"is_correct"`
		QuestionText       string `json:"question_text"`
		CourseTitle        string `json:"course_title"`
		LessonTitle        string `json:"lesson_title"`
		SelectedOptionText string `json:"selected_option_text"`
	}

	var answers []Answer
	for rows.Next() {
		var a Answer
		var selText sql.NullString
		if err := rows.Scan(&a.ID, &a.QuestionID, &a.SelectedOptionID, &a.IsCorrect,
			&a.QuestionText, &a.CourseTitle, &a.LessonTitle, &selText); err != nil {
			log.Printf("getQuestionAnswersHandler scan warning: %v", err)
			continue
		}
		a.SelectedOptionText = selText.String
		answers = append(answers, a)
	}

	if answers == nil {
		answers = []Answer{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(answers)
}

//------------------ task and judge0 integration ------------------

// SubmitRequest represents payload from frontend when a solution is submitted
// code: source code string
// language_id: Judge0 language ID
// task_id: ID of the corresponding task in our database
// The frontend is responsible for setting the correct language_id/task_id
// based on the selected problem.
type SubmitRequest struct {
	Code       string `json:"code"`
	LanguageID int    `json:"language_id"`
	TaskID     int    `json:"task_id"`
}

// CompileRequest is used by the new compile endpoint; it omits test/task fields.
type CompileRequest struct {
	Code       string `json:"code"`
	LanguageID int    `json:"language_id"`
}

// CompileResponse is returned after attempting a local compilation.
type CompileResponse struct {
	Success bool   `json:"success"`
	Output  string `json:"output"`
}

// getTasksHandler returns all available programming tasks
func getTasksHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT t.id, t.course_id, t.title, t.description, t.language_id, c.title FROM tasks t JOIN courses c ON t.course_id=c.id ORDER BY t.id DESC")
	if err != nil {
		http.Error(w, "Error fetching tasks", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var tasks []Task
	for rows.Next() {
		var t Task
		if err := rows.Scan(&t.ID, &t.CourseID, &t.Title, &t.Description, &t.LanguageID, &t.CourseTitle); err != nil {
			http.Error(w, "Error scanning task", http.StatusInternalServerError)
			return
		}
		tasks = append(tasks, t)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tasks)
}

// getTaskHandler returns a single task (without revealing test cases)
func getTaskHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	tid, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid task ID", http.StatusBadRequest)
		return
	}

	var t Task
	err = db.QueryRow("SELECT t.id, t.course_id, t.title, t.description, t.language_id, c.title FROM tasks t JOIN courses c ON t.course_id=c.id WHERE t.id = ?", tid).
		Scan(&t.ID, &t.CourseID, &t.Title, &t.Description, &t.LanguageID, &t.CourseTitle)
	if err != nil {
		http.Error(w, "Task not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(t)
}
func sendJSONError(w http.ResponseWriter, status int, message string) {
	log.Printf("sendJSONError: status=%d msg=%s", status, message)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

// isJudge0Available checks if Judge0 is available on localhost:2358.
func isJudge0Available() bool {
	client := &http.Client{Timeout: 500 * time.Millisecond}
	req, err := http.NewRequest(http.MethodHead, "http://localhost:2358", nil)
	if err != nil {
		return false
	}
	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode >= 200 && resp.StatusCode < 500
}

// injectGoTestCode inserts test code inside Go main function before the last closing brace.
func injectGoTestCode(userCode, testCode string) string {
	if strings.TrimSpace(testCode) == "" {
		return userCode
	}

	idx := strings.LastIndex(userCode, "}")
	if idx == -1 {
		return userCode + "\n" + testCode
	}

	// insert before final brace
	return userCode[:idx] + "\n" + testCode + "\n" + userCode[idx:]
}

// submitSolutionHandler handles code submissions, calls Judge0, compares outputs,
// records results and returns verdict/output to client.
func submitSolutionHandler(w http.ResponseWriter, r *http.Request) {
	// recover from panics to prevent server crash
	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("panic in submitSolutionHandler: %v", rec)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		}
	}()

	userID := getUserIDFromContext(r)
	var req SubmitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("submitSolutionHandler: decode error: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	log.Printf("submitSolution: user=%d task=%d lang=%d", userID, req.TaskID, req.LanguageID)
	if req.Code == "" || req.LanguageID <= 0 || req.TaskID <= 0 {
		log.Printf("submitSolution: missing fields (code empty?%v lang:%d task:%d)", req.Code == "", req.LanguageID, req.TaskID)
		sendJSONError(w, http.StatusBadRequest, "code, language_id and task_id are required")
		return
	}

	// fetch test cases for task including new fields
	testRows, err := db.Query("SELECT id, input, expected_output, test_code, check_type FROM test_cases WHERE task_id = ?", req.TaskID)
	if err != nil {
		log.Printf("submitSolution: test cases query error: %v", err)
		sendJSONError(w, http.StatusInternalServerError, "Error fetching test cases")
		return
	}
	defer testRows.Close()

	type tc struct {
		ID             int
		Input          string
		ExpectedOutput string
		TestCode       string
		CheckType      string
	}
	var tests []tc
	for testRows.Next() {
		var t tc
		if err := testRows.Scan(&t.ID, &t.Input, &t.ExpectedOutput, &t.TestCode, &t.CheckType); err != nil {
			log.Printf("submitSolution: scan test case error: %v", err)
			sendJSONError(w, http.StatusInternalServerError, "Error scanning test case")
			return
		}
		if t.CheckType == "" {
			t.CheckType = "output"
		}
		tests = append(tests, t)
	}
	if len(tests) == 0 {
		log.Printf("submitSolution: task %d has no test cases", req.TaskID)
		sendJSONError(w, http.StatusBadRequest, "В задаче нет тестов")
		return
	}

	// judge0 response structure (partial)
	type judgeStatus struct {
		ID          int    `json:"id"`
		Description string `json:"description"`
	}
	type judgeResp struct {
		Stdout string      `json:"stdout"`
		Stderr string      `json:"stderr"`
		Status judgeStatus `json:"status"`
	}

	mapJudgeLang := func(lang int) int {
		switch lang {
		case 95:
			return 60
		case 93:
			return 63
		default:
			return lang
		}
	}

	runViaJudge0 := func(source string, languageID int, stdin string) (string, string, int, string, error) {
		payload := map[string]interface{}{
			"source_code":    source,
			"language_id":    mapJudgeLang(languageID),
			"stdin":          stdin,
			"base64_encoded": false,
			"wait":           true,
		}
		bodyBytes, _ := json.Marshal(payload)
		resp, err := http.Post("http://localhost:2358/submissions?base64_encoded=false&wait=true", "application/json", bytes.NewReader(bodyBytes))
		if err != nil {
			return "", "", 0, "", err
		}
		defer resp.Body.Close()
		var jr judgeResp
		if err := json.NewDecoder(resp.Body).Decode(&jr); err != nil {
			return "", "", 0, "", err
		}
		return jr.Stdout, jr.Stderr, jr.Status.ID, jr.Status.Description, nil
	}

	runLocally := func(source string, languageID int, stdin string) (string, string, int, string, error) {
		tmpDir, err := os.MkdirTemp("", "local-run")
		if err != nil {
			return "", "", 0, "", err
		}
		defer os.RemoveAll(tmpDir)

		var resp CompileResponse
		switch mapJudgeLang(languageID) {
		case 50:
			resp = compileCCode(source, tmpDir)
		case 54:
			resp = compileCppCode(source, tmpDir)
		case 71:
			resp = runPythonCode(source, tmpDir)
		case 60:
			resp = compileGoCode(source, tmpDir)
		case 63:
			resp = runJsCode(source, tmpDir)
		default:
			return "", "", 0, "Unsupported language", fmt.Errorf("unsupported language_id %d", languageID)
		}
		if !resp.Success {
			// try determine compilation vs runtime
			body := strings.ToLower(resp.Output)
			if strings.Contains(body, "compile") || strings.Contains(body, "syntax") || strings.Contains(body, "error") {
				return resp.Output, "", 4, "Compilation Error", nil
			}
			return resp.Output, "", 5, "Runtime Error", nil
		}
		return resp.Output, "", 3, "Accepted", nil
	}

	verdict := "Accepted"
	var lastOutput string

	judgeAvailable := isJudge0Available()

	for _, t := range tests {
		checkType := t.CheckType
		if checkType != "code_test" {
			checkType = "output"
		}

		sourceCode := req.Code
		if checkType == "code_test" {
			if strings.TrimSpace(t.TestCode) != "" {
				if mapJudgeLang(req.LanguageID) == 60 {
					sourceCode = injectGoTestCode(req.Code, t.TestCode)
				} else {
					sourceCode = strings.TrimSpace(req.Code) + "\n" + strings.TrimSpace(t.TestCode)
				}
			}
		}

		var stdout, stderr string
		var statusID int
		var errExec error

		if judgeAvailable {
			stdout, stderr, statusID, _, errExec = runViaJudge0(sourceCode, req.LanguageID, t.Input)
		} else {
			stdout, stderr, statusID, _, errExec = runLocally(sourceCode, req.LanguageID, t.Input)
		}

		if errExec != nil {
			verdict = "Runtime Error"
			lastOutput = errExec.Error()
			break
		}

		if checkType == "output" {
			if statusID != 3 {
				switch statusID {
				case 6:
					verdict = "Time Limit Exceeded"
				case 5:
					verdict = "Runtime Error"
				case 4:
					verdict = "Compilation Error"
				default:
					verdict = "Wrong Answer"
				}
				if lastOutput == "" {
					lastOutput = strings.TrimSpace(stdout + "\n" + stderr)
				}
				break
			}

			actualOutput := strings.TrimSpace(stdout)
			expectedOutput := strings.TrimSpace(t.ExpectedOutput)
			if actualOutput != expectedOutput {
				verdict = "Wrong Answer"
				lastOutput = fmt.Sprintf("Expected:\n%s\n\nActual:\n%s", expectedOutput, actualOutput)
				break
			}
			lastOutput = actualOutput
		} else {
			concatOut := strings.TrimSpace(stdout + "\n" + stderr)
			if statusID != 3 {
				switch statusID {
				case 6:
					verdict = "Time Limit Exceeded"
				case 5:
					verdict = "Runtime Error"
				case 4:
					verdict = "Compilation Error"
				default:
					verdict = "Wrong Answer"
				}
				lastOutput = concatOut
				break
			}
			if strings.Contains(concatOut, "AssertionError") || strings.Contains(concatOut, "assert") {
				verdict = "Wrong Answer"
				lastOutput = concatOut
				break
			}
			if strings.Contains(concatOut, "OK") {
				verdict = "Accepted"
				lastOutput = "OK"
				continue
			}
			verdict = "Wrong Answer"
			lastOutput = fmt.Sprintf("Expected OK, got: %s", concatOut)
			break
		}
	}

	_, err = db.Exec("INSERT INTO submissions (user_id, task_id, code, verdict, language_id, output) VALUES (?, ?, ?, ?, ?, ?)", userID, req.TaskID, req.Code, verdict, req.LanguageID, lastOutput)
	if err != nil {
		fmt.Printf("failed to save submission: %v\n", err)
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]string{
		"verdict": verdict,
		"output":  lastOutput,
	}); err != nil {
		log.Printf("submitSolution: failed to encode response: %v", err)
	}
}

// compileCodeHandler compiles simple C/C++ programs locally and returns compiler output.
// this is a lightweight alternative to Judge0 when only compilation is needed.
func compileCodeHandler(w http.ResponseWriter, r *http.Request) {
	var req CompileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendJSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	log.Printf("compileCodeHandler: code_len=%d language_id=%d", len(req.Code), req.LanguageID)
	if req.Code == "" || req.LanguageID <= 0 {
		sendJSONError(w, http.StatusBadRequest, "code and language_id are required")
		return
	}

	resp := CompileResponse{Success: false, Output: ""}

	tmpDir, err := os.MkdirTemp("", "compile")
	if err != nil {
		sendJSONError(w, http.StatusInternalServerError, "Server error")
		return
	}
	defer os.RemoveAll(tmpDir)

	switch req.LanguageID {
	case 50: // C (gcc)
		resp = compileCCode(req.Code, tmpDir)
	case 54: // C++ (g++)
		resp = compileCppCode(req.Code, tmpDir)
	case 71: // Python 3
		resp = runPythonCode(req.Code, tmpDir)
	case 60: // Go
		resp = compileGoCode(req.Code, tmpDir)
	case 63: // JavaScript (node)
		resp = runJsCode(req.Code, tmpDir)
	case 62: // Java
		resp = compileJavaCode(req.Code, tmpDir)
	default:
		sendJSONError(w, http.StatusBadRequest, "Unsupported language_id. Supported: 50 (C), 54 (C++), 62 (Java), 71 (Python), 60 (Go), 63 (JavaScript)")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// compileCCode compiles and executes C code
func compileCCode(code string, tmpDir string) CompileResponse {
	ext := ".c"
	srcPath := filepath.Join(tmpDir, "code"+ext)
	if err := os.WriteFile(srcPath, []byte(code), 0644); err != nil {
		return CompileResponse{Success: false, Output: "Unable to write source file"}
	}

	outPath := filepath.Join(tmpDir, "a.out")
	if runtime.GOOS == "windows" {
		outPath += ".exe"
	}
	cmd := exec.Command("gcc", "-Wall", "-o", outPath, srcPath)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	err := cmd.Run()

	if err != nil {
		return CompileResponse{Success: false, Output: strings.TrimSpace(stderr.String())}
	}

	// Compilation succeeded, run the binary
	runCmd := exec.Command(outPath)
	var runStdout, runStderr bytes.Buffer
	runCmd.Stdout = &runStdout
	runCmd.Stderr = &runStderr
	err = runCmd.Run()
	if err != nil {
		output := fmt.Sprintf("Compiled OK\nRuntime error: %v", err)
		if runStderr.Len() > 0 {
			output += "\n" + runStderr.String()
		}
		return CompileResponse{Success: false, Output: output}
	}

	out := runStdout.String()
	if runStderr.Len() > 0 {
		out += "\nstderr:\n" + runStderr.String()
	}
	return CompileResponse{Success: true, Output: strings.TrimSpace(out)}
}

// compileCppCode compiles and executes C++ code
func compileCppCode(code string, tmpDir string) CompileResponse {
	ext := ".cpp"
	srcPath := filepath.Join(tmpDir, "code"+ext)
	if err := os.WriteFile(srcPath, []byte(code), 0644); err != nil {
		return CompileResponse{Success: false, Output: "Unable to write source file"}
	}

	outPath := filepath.Join(tmpDir, "a.out")
	if runtime.GOOS == "windows" {
		outPath += ".exe"
	}
	cmd := exec.Command("g++", "-Wall", "-o", outPath, srcPath)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	err := cmd.Run()

	if err != nil {
		return CompileResponse{Success: false, Output: strings.TrimSpace(stderr.String())}
	}

	runCmd := exec.Command(outPath)
	var runStdout, runStderr bytes.Buffer
	runCmd.Stdout = &runStdout
	runCmd.Stderr = &runStderr
	err = runCmd.Run()
	if err != nil {
		output := fmt.Sprintf("Compiled OK\nRuntime error: %v", err)
		if runStderr.Len() > 0 {
			output += "\n" + runStderr.String()
		}
		return CompileResponse{Success: false, Output: output}
	}

	out := runStdout.String()
	if runStderr.Len() > 0 {
		out += "\nstderr:\n" + runStderr.String()
	}
	return CompileResponse{Success: true, Output: strings.TrimSpace(out)}
}

// runPythonCode executes Python code (no compilation)
func runPythonCode(code string, tmpDir string) CompileResponse {
	srcPath := filepath.Join(tmpDir, "code.py")
	if err := os.WriteFile(srcPath, []byte(code), 0644); err != nil {
		return CompileResponse{Success: false, Output: "Unable to write source file"}
	}

	// Use 'python' on Windows, 'python3' on Linux/Mac (try both)
	cmd := exec.Command("python", srcPath)
	// ensure Python prints UTF-8 (Windows default may be cp1251/866)
	cmd.Env = append(os.Environ(), "PYTHONIOENCODING=utf-8")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()

	if err != nil {
		output := stderr.String()
		if output == "" {
			output = fmt.Sprintf("Error: %v", err)
		}
		return CompileResponse{Success: false, Output: strings.TrimSpace(output)}
	}

	out := stdout.String()
	if stderr.Len() > 0 {
		out += "\nstderr:\n" + stderr.String()
	}
	return CompileResponse{Success: true, Output: strings.TrimSpace(out)}
}

// runJsCode executes JavaScript using node
func runJsCode(code string, tmpDir string) CompileResponse {
	srcPath := filepath.Join(tmpDir, "script.js")
	if err := os.WriteFile(srcPath, []byte(code), 0644); err != nil {
		return CompileResponse{Success: false, Output: "Unable to write source file"}
	}

	cmd := exec.Command("node", srcPath)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	if err != nil {
		output := stderr.String()
		if output == "" {
			output = fmt.Sprintf("Error: %v", err)
		}
		return CompileResponse{Success: false, Output: strings.TrimSpace(output)}
	}

	out := stdout.String()
	if stderr.Len() > 0 {
		out += "\nstderr:\n" + stderr.String()
	}
	return CompileResponse{Success: true, Output: strings.TrimSpace(out)}
}

// compileGoCode compiles and executes Go code
func compileGoCode(code string, tmpDir string) CompileResponse {
	srcPath := filepath.Join(tmpDir, "main.go")
	if err := os.WriteFile(srcPath, []byte(code), 0644); err != nil {
		return CompileResponse{Success: false, Output: "Unable to write source file"}
	}

	outPath := filepath.Join(tmpDir, "program")
	if runtime.GOOS == "windows" {
		outPath += ".exe"
	}
	cmd := exec.Command("go", "build", "-o", outPath, srcPath)
	cmd.Dir = tmpDir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	err := cmd.Run()

	if err != nil {
		return CompileResponse{Success: false, Output: strings.TrimSpace(stderr.String())}
	}

	runCmd := exec.Command(outPath)
	var stdout, runStderr bytes.Buffer
	runCmd.Stdout = &stdout
	runCmd.Stderr = &runStderr
	err = runCmd.Run()
	if err != nil {
		output := fmt.Sprintf("Compiled OK\nRuntime error: %v", err)
		if runStderr.Len() > 0 {
			output += "\n" + runStderr.String()
		}
		return CompileResponse{Success: false, Output: output}
	}

	out := stdout.String()
	if runStderr.Len() > 0 {
		out += "\nstderr:\n" + runStderr.String()
	}
	return CompileResponse{Success: true, Output: strings.TrimSpace(out)}
}

func compileJavaCode(code string, tmpDir string) CompileResponse {
	srcPath := filepath.Join(tmpDir, "Main.java")
	if err := os.WriteFile(srcPath, []byte(code), 0644); err != nil {
		return CompileResponse{Success: false, Output: "Unable to write source file"}
	}

	javacCmd := exec.Command("javac", srcPath)
	javacCmd.Dir = tmpDir
	var compileStderr bytes.Buffer
	javacCmd.Stderr = &compileStderr
	if err := javacCmd.Run(); err != nil {
		return CompileResponse{Success: false, Output: strings.TrimSpace(compileStderr.String())}
	}

	runCmd := exec.Command("java", "-cp", tmpDir, "Main")
	var stdout, runStderr bytes.Buffer
	runCmd.Stdout = &stdout
	runCmd.Stderr = &runStderr
	if err := runCmd.Run(); err != nil {
		output := fmt.Sprintf("Compiled OK\nRuntime error: %v", err)
		if runStderr.Len() > 0 {
			output += "\n" + runStderr.String()
		}
		return CompileResponse{Success: false, Output: output}
	}

	out := stdout.String()
	if runStderr.Len() > 0 {
		out += "\nstderr:\n" + runStderr.String()
	}
	return CompileResponse{Success: true, Output: strings.TrimSpace(out)}
}

// saveSubmissionResultHandler сохраняет результат выполнения задачи в БД
func saveSubmissionResultHandler(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)
	log.Printf("saveSubmissionResultHandler: user_id=%d", userID)

	var req struct {
		TaskID  int    `json:"task_id"`
		Code    string `json:"code"`
		Verdict string `json:"verdict"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	log.Printf("Saving submission: user_id=%d, task_id=%d, verdict=%s", userID, req.TaskID, req.Verdict)

	// Insert into submissions table
	_, err := db.Exec("INSERT INTO submissions (user_id, task_id, code, verdict, created_at) VALUES (?, ?, ?, ?, NOW())",
		userID, req.TaskID, req.Code, req.Verdict)
	if err != nil {
		log.Printf("Error saving submission: %v", err)
		http.Error(w, fmt.Sprintf("Error saving result: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Result saved successfully"})
}

// getCourseLessonsHandler returns all lessons for a course with their questions and options
func getCourseLessonsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	courseIDStr := vars["id"]
	courseID, err := strconv.Atoi(courseIDStr)
	if err != nil {
		http.Error(w, "Invalid course ID", http.StatusBadRequest)
		return
	}

	// Fetch all lessons for this course
	lessonRows, err := db.Query(`
		SELECT id, title, content, lesson_order
		FROM lessons 
		WHERE course_id = ? 
		ORDER BY lesson_order ASC
	`, courseID)
	if err != nil {
		http.Error(w, "Error fetching lessons", http.StatusInternalServerError)
		return
	}
	defer lessonRows.Close()

	var lessons []Lesson

	for lessonRows.Next() {
		var lesson Lesson
		err := lessonRows.Scan(&lesson.ID, &lesson.Title,
			&lesson.Content, &lesson.LessonOrder)
		if err != nil {
			http.Error(w, "Error scanning lesson", http.StatusInternalServerError)
			return
		}

		lesson.CourseID = courseID

		// Normalize title and content - remove "undefined", "null" strings
		if lesson.Title == "undefined" || lesson.Title == "null" || lesson.Title == "" {
			lesson.Title = ""
		}
		if lesson.Content == "undefined" || lesson.Content == "null" {
			lesson.Content = ""
		}

		// Fetch questions for this lesson
		questionRows, err := db.Query(`
			SELECT id, lesson_id, question_text, explanation, question_order
			FROM questions
			WHERE lesson_id = ?
			ORDER BY question_order ASC
		`, lesson.ID)
		if err != nil {
			http.Error(w, "Error fetching questions", http.StatusInternalServerError)
			return
		}
		defer questionRows.Close()

		var questions []Question
		for questionRows.Next() {
			var question Question
			err := questionRows.Scan(&question.ID, &question.LessonID, &question.QuestionText,
				&question.Explanation, &question.QuestionOrder)
			if err != nil {
				http.Error(w, "Error scanning question", http.StatusInternalServerError)
				return
			}

			// Fetch options for this question
			optionRows, err := db.Query(`
				SELECT id, question_id, option_text, is_correct, option_order
				FROM question_options
				WHERE question_id = ?
				ORDER BY option_order ASC
			`, question.ID)
			if err != nil {
				http.Error(w, "Error fetching question options", http.StatusInternalServerError)
				return
			}
			defer optionRows.Close()

			var options []QuestionOption
			for optionRows.Next() {
				var option QuestionOption
				err := optionRows.Scan(&option.ID, &option.QuestionID, &option.OptionText,
					&option.IsCorrect, &option.OptionOrder)
				if err != nil {
					http.Error(w, "Error scanning option", http.StatusInternalServerError)
					return
				}
				options = append(options, option)
			}
			question.Options = options
			questions = append(questions, question)
		}

		lesson.Questions = questions
		lessons = append(lessons, lesson)
	}

	// Получаем информацию о курсе (название/описание) для отображения
	var courseTitle, courseDescription string
	if err := db.QueryRow("SELECT title, description FROM courses WHERE id = ?", courseID).Scan(&courseTitle, &courseDescription); err != nil {
		// если курса нет, только вернем ID
		courseTitle = ""
		courseDescription = ""
	}

	// Получаем вопросы без урока (course-level questions)
	courseQuestionsRows, err := db.Query(`
		SELECT id, lesson_id, course_id, question_text, explanation, question_order
		FROM questions
		WHERE course_id = ? AND lesson_id IS NULL
		ORDER BY question_order ASC
	`, courseID)
	if err != nil {
		http.Error(w, "Error fetching course-level questions", http.StatusInternalServerError)
		return
	}
	defer courseQuestionsRows.Close()

	var courseQuestions []Question
	for courseQuestionsRows.Next() {
		var question Question
		err := courseQuestionsRows.Scan(&question.ID, &question.LessonID, &question.CourseID, &question.QuestionText,
			&question.Explanation, &question.QuestionOrder)
		if err != nil {
			http.Error(w, "Error scanning course-level question", http.StatusInternalServerError)
			return
		}
		// Fetch options for this question
		optionRows, err := db.Query(`
			SELECT id, question_id, option_text, is_correct, option_order
			FROM question_options
			WHERE question_id = ?
			ORDER BY option_order ASC
		`, question.ID)
		if err != nil {
			http.Error(w, "Error fetching question options", http.StatusInternalServerError)
			return
		}
		defer optionRows.Close()
		var options []QuestionOption
		for optionRows.Next() {
			var option QuestionOption
			err := optionRows.Scan(&option.ID, &option.QuestionID, &option.OptionText,
				&option.IsCorrect, &option.OptionOrder)
			if err != nil {
				http.Error(w, "Error scanning option", http.StatusInternalServerError)
				return
			}
			options = append(options, option)
		}
		question.Options = options
		courseQuestions = append(courseQuestions, question)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"courseId":          courseID,
		"courseTitle":       courseTitle,
		"courseDescription": courseDescription,
		"lessons":           lessons,
		"courseQuestions":   courseQuestions,
	})
}
