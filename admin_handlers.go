package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

// adminGetCoursesHandler returns all courses for admin panel
func adminGetCoursesHandler(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	rows, err := db.Query("SELECT id, title, description, created_at, updated_at FROM courses ORDER BY created_at DESC")
	if err != nil {
		fmt.Printf("adminGetCoursesHandler: query error: %v\n", err)
		http.Error(w, "Error fetching courses", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var courses []Course
	for rows.Next() {
		var course Course
		err := rows.Scan(&course.ID, &course.Title, &course.Description, &course.CreatedAt, &course.UpdatedAt)
		if err != nil {
			fmt.Printf("adminGetCoursesHandler: scan error: %v\n", err)
			http.Error(w, "Error scanning course", http.StatusInternalServerError)
			return
		}
		courses = append(courses, course)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(courses)
}

// adminCreateCourseHandler creates a new course
func adminCreateCourseHandler(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	var course Course
	if err := json.NewDecoder(r.Body).Decode(&course); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate input
	if course.Title == "" {
		http.Error(w, "Course title is required", http.StatusBadRequest)
		return
	}

	// Insert new course
	result, err := db.Exec("INSERT INTO courses (title, description) VALUES (?, ?)",
		course.Title, course.Description)
	if err != nil {
		http.Error(w, "Error creating course", http.StatusInternalServerError)
		return
	}

	courseID, _ := result.LastInsertId()
	course.ID = int(courseID)

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(course)
}

// adminUpdateCourseHandler updates an existing course
func adminUpdateCourseHandler(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	vars := mux.Vars(r)
	courseID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid course ID", http.StatusBadRequest)
		return
	}

	var course Course
	if err := json.NewDecoder(r.Body).Decode(&course); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate input
	if course.Title == "" {
		http.Error(w, "Course title is required", http.StatusBadRequest)
		return
	}

	// Update course
	result, err := db.Exec("UPDATE courses SET title = ?, description = ? WHERE id = ?",
		course.Title, course.Description, courseID)
	if err != nil {
		http.Error(w, "Error updating course", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Course not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Course updated successfully"})
}

// adminDeleteCourseHandler deletes a course
func adminDeleteCourseHandler(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	vars := mux.Vars(r)
	courseID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid course ID", http.StatusBadRequest)
		return
	}

	// Delete course (will cascade delete course results)
	result, err := db.Exec("DELETE FROM courses WHERE id = ?", courseID)
	if err != nil {
		http.Error(w, "Error deleting course", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Course not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Course deleted successfully"})
}

// adminGetTasksHandler returns all programming tasks for admin
func adminGetTasksHandler(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	rows, err := db.Query("SELECT t.id, t.course_id, t.title, t.description, t.language_id, c.title FROM tasks t JOIN courses c ON t.course_id=c.id ORDER BY t.id DESC")
	if err != nil {
		fmt.Printf("adminGetTasksHandler: query error: %v\n", err)
		http.Error(w, "Error fetching tasks", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var tasks []Task
	for rows.Next() {
		var task Task
		err := rows.Scan(&task.ID, &task.CourseID, &task.Title, &task.Description, &task.LanguageID, &task.CourseTitle)
		if err != nil {
			fmt.Printf("adminGetTasksHandler: scan error: %v\n", err)
			http.Error(w, "Error scanning task", http.StatusInternalServerError)
			return
		}
		tasks = append(tasks, task)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tasks)
}

// adminCreateTaskHandler allows admin to create a new programming task
func adminCreateTaskHandler(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	var t Task
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if t.CourseID <= 0 || t.Title == "" || t.LanguageID <= 0 {
		http.Error(w, "course_id, title and language_id are required", http.StatusBadRequest)
		return
	}
	res, err := db.Exec("INSERT INTO tasks (course_id, title, description, language_id) VALUES (?, ?, ?, ?)", t.CourseID, t.Title, t.Description, t.LanguageID)
	if err != nil {
		http.Error(w, "Error creating task", http.StatusInternalServerError)
		return
	}
	id, _ := res.LastInsertId()
	t.ID = int(id)
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(t)
}

// adminUpdateTaskHandler updates an existing task
func adminUpdateTaskHandler(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	vars := mux.Vars(r)
	taskID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid task ID", http.StatusBadRequest)
		return
	}

	var t Task
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if t.CourseID <= 0 || t.Title == "" || t.LanguageID <= 0 {
		http.Error(w, "course_id, title and language_id are required", http.StatusBadRequest)
		return
	}

	result, err := db.Exec("UPDATE tasks SET course_id = ?, title = ?, description = ?, language_id = ? WHERE id = ?", t.CourseID, t.Title, t.Description, t.LanguageID, taskID)
	if err != nil {
		http.Error(w, "Error updating task", http.StatusInternalServerError)
		return
	}
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Task not found", http.StatusNotFound)
		return
	}

	// return updated task
	t.ID = taskID
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(t)
}

// adminGetTaskHandler returns a specific task
func adminGetTaskHandler(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	vars := mux.Vars(r)
	taskID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid task ID", http.StatusBadRequest)
		return
	}

	var task Task
	err = db.QueryRow("SELECT t.id, t.course_id, t.title, t.description, t.language_id, c.title FROM tasks t JOIN courses c ON t.course_id=c.id WHERE t.id = ?", taskID).
		Scan(&task.ID, &task.CourseID, &task.Title, &task.Description, &task.LanguageID, &task.CourseTitle)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Task not found", http.StatusNotFound)
		} else {
			fmt.Printf("adminGetTaskHandler: scan error: %v\n", err)
			http.Error(w, "Error fetching task", http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(task)
}

// adminDeleteTaskHandler deletes a task entry
func adminDeleteTaskHandler(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	vars := mux.Vars(r)
	taskID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid task ID", http.StatusBadRequest)
		return
	}

	result, err := db.Exec("DELETE FROM tasks WHERE id = ?", taskID)
	if err != nil {
		fmt.Printf("adminDeleteTaskHandler: delete error: %v\n", err)
		http.Error(w, "Error deleting task", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Task not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Task deleted successfully"})
}

// adminCreateTestCaseHandler allows admin to add a test case to a task
func adminCreateTestCaseHandler(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	var tc TestCase
	if err := json.NewDecoder(r.Body).Decode(&tc); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if tc.TaskID <= 0 {
		http.Error(w, "task_id is required", http.StatusBadRequest)
		return
	}
	if tc.CheckType != "output" && tc.CheckType != "code_test" {
		tc.CheckType = "output"
	}

	_, err := db.Exec("INSERT INTO test_cases (task_id, input, expected_output, test_code, check_type) VALUES (?, ?, ?, ?, ?)",
		tc.TaskID, tc.Input, tc.ExpectedOutput, tc.TestCode, tc.CheckType)
	if err != nil {
		http.Error(w, "Error creating test case", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Test case added"})
}

// adminGetUsersHandler returns all users for admin panel
func adminGetUsersHandler(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	rows, err := db.Query("SELECT id, login, role, created_at, updated_at FROM users ORDER BY created_at DESC")
	if err != nil {
		http.Error(w, "Error fetching users", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		err := rows.Scan(&user.ID, &user.Login, &user.Role, &user.CreatedAt, &user.UpdatedAt)
		if err != nil {
			http.Error(w, "Error scanning user", http.StatusInternalServerError)
			return
		}
		users = append(users, user)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

// adminAnalyticsHandler returns analytics data
func adminAnalyticsHandler(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	var analytics AnalyticsData

	// Get total users
	err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&analytics.TotalUsers)
	if err != nil {
		fmt.Printf("adminAnalyticsHandler: user count error: %v\n", err)
		http.Error(w, "Error fetching user count", http.StatusInternalServerError)
		return
	}

	// Get total courses
	err = db.QueryRow("SELECT COUNT(*) FROM courses").Scan(&analytics.TotalCourses)
	if err != nil {
		fmt.Printf("adminAnalyticsHandler: course count error: %v\n", err)
		http.Error(w, "Error fetching course count", http.StatusInternalServerError)
		return
	}

	// Get total results and statistics (use COALESCE on AVG to avoid NULL when no rows exist)
	err = db.QueryRow(`
		SELECT 
			COUNT(*) as total_results,
			SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed_courses,
			SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_courses,
			COALESCE(AVG(score), 0) as average_score
		FROM course_results`).Scan(
		&analytics.TotalResults,
		&analytics.PassedCourses,
		&analytics.FailedCourses,
		&analytics.AverageScore)

	if err != nil {
		fmt.Printf("adminAnalyticsHandler: analytics query error: %v\n", err)
		http.Error(w, "Error fetching analytics", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(analytics)
}

// getCourseDetailsHandler returns course with all its lessons and questions for admin editing
func getCourseDetailsHandler(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	vars := mux.Vars(r)
	courseIDStr := vars["id"]
	courseID, err := strconv.Atoi(courseIDStr)
	if err != nil {
		http.Error(w, "Invalid course ID", http.StatusBadRequest)
		return
	}

	var course Course
	err = db.QueryRow("SELECT id, title, description, created_at, updated_at FROM courses WHERE id = ?", courseID).
		Scan(&course.ID, &course.Title, &course.Description, &course.CreatedAt, &course.UpdatedAt)
	if err != nil {
		fmt.Printf("getCourseDetails: course query error: %v\n", err)
		http.Error(w, "Course not found", http.StatusNotFound)
		return
	}

	// Get all lessons for this course
	lessonRows, err := db.Query(`
		SELECT id, title, content, lesson_order
		FROM lessons 
		WHERE course_id = ? 
		ORDER BY lesson_order ASC
	`, courseID)
	if err != nil {
		fmt.Printf("getCourseDetails: lessons query error: %v\n", err)
		http.Error(w, "Error fetching lessons", http.StatusInternalServerError)
		return
	}
	defer lessonRows.Close()

	var lessons []map[string]interface{}

	for lessonRows.Next() {
		var lesson Lesson
		err := lessonRows.Scan(&lesson.ID, &lesson.Title,
			&lesson.Content, &lesson.LessonOrder)
		if err != nil {
			fmt.Printf("getCourseDetails: scan lesson error: %v\n", err)
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

		// Get questions for this lesson
		questionRows, err := db.Query(`
			SELECT id, lesson_id, question_text, explanation, question_order
			FROM questions
			WHERE lesson_id = ?
			ORDER BY question_order ASC
		`, lesson.ID)
		if err != nil {
			fmt.Printf("getCourseDetails: questions query error: %v\n", err)
			http.Error(w, "Error fetching questions", http.StatusInternalServerError)
			return
		}
		defer questionRows.Close()

		var questions []map[string]interface{}
		for questionRows.Next() {
			var question Question
			err := questionRows.Scan(&question.ID, &question.LessonID, &question.QuestionText,
				&question.Explanation, &question.QuestionOrder)
			if err != nil {
				fmt.Printf("getCourseDetails: scan question error: %v\n", err)
				http.Error(w, "Error scanning question", http.StatusInternalServerError)
				return
			}

			// Get options for this question
			optionRows, err := db.Query(`
				SELECT id, question_id, option_text, is_correct, option_order
				FROM question_options
				WHERE question_id = ?
				ORDER BY option_order ASC
			`, question.ID)
			if err != nil {
				fmt.Printf("getCourseDetails: options query error: %v\n", err)
				http.Error(w, "Error fetching options", http.StatusInternalServerError)
				return
			}
			defer optionRows.Close()

			var options []map[string]interface{}
			for optionRows.Next() {
				var option QuestionOption
				err := optionRows.Scan(&option.ID, &option.QuestionID, &option.OptionText,
					&option.IsCorrect, &option.OptionOrder)
				if err != nil {
					fmt.Printf("getCourseDetails: scan option error: %v\n", err)
					http.Error(w, "Error scanning option", http.StatusInternalServerError)
					return
				}
				options = append(options, map[string]interface{}{
					"id":           option.ID,
					"option_text":  option.OptionText,
					"is_correct":   option.IsCorrect,
					"option_order": option.OptionOrder,
				})
			}

			questions = append(questions, map[string]interface{}{
				"id":             question.ID,
				"question_text":  question.QuestionText,
				"explanation":    question.Explanation,
				"question_order": question.QuestionOrder,
				"options":        options,
			})
		}

		lessons = append(lessons, map[string]interface{}{
			"id":           lesson.ID,
			"title":        lesson.Title,
			"content":      lesson.Content,
			"lesson_order": lesson.LessonOrder,
			"questions":    questions,
		})
	}

	resp := map[string]interface{}{
		"course":  course,
		"lessons": lessons,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// updateCourseTheoryHandler creates or updates theory content for a lesson (removed - use lesson content endpoint)
// Keeping as deprecated stub for backward compatibility
func updateCourseTheoryHandler(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	vars := mux.Vars(r)
	courseIDStr := vars["id"]
	_, err := strconv.Atoi(courseIDStr)
	if err != nil {
		http.Error(w, "Invalid course ID", http.StatusBadRequest)
		return
	}

	// This endpoint is deprecated - use lesson management instead
	// For now, redirect to a more meaningful response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotFound)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "This endpoint is deprecated. Use lesson management endpoints instead.",
	})
}

// ...removed question creation handler...
// ...existing code...

// createQuestionHandler creates a new question under the first lesson of the given course.
// The frontend currently only provides course_id, so we look up the earliest lesson
// for that course and attach the question there.  The question order is computed
// as the next index.
func createQuestionHandler(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	var payload struct {
		CourseID     int    `json:"course_id"`
		QuestionText string `json:"question_text"`
		Explanation  string `json:"explanation"`
		Options      []struct {
			OptionText  string `json:"option_text"`
			IsCorrect   bool   `json:"is_correct"`
			OptionOrder int    `json:"option_order"`
		} `json:"options"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// basic validation
	if payload.CourseID <= 0 || payload.QuestionText == "" || len(payload.Options) < 2 {
		http.Error(w, "course_id, question_text and at least two options are required", http.StatusBadRequest)
		return
	}

	// ensure course exists
	var courseExists int
	err := db.QueryRow("SELECT id FROM courses WHERE id = ?", payload.CourseID).Scan(&courseExists)
	if err != nil {
		http.Error(w, "Course not found", http.StatusNotFound)
		return
	}

	// find the first lesson of the course (ordered by lesson_order)
	var lessonID int
	err = db.QueryRow(
		"SELECT id FROM lessons WHERE course_id = ? ORDER BY lesson_order ASC LIMIT 1",
		payload.CourseID).Scan(&lessonID)
	var res sql.Result
	var qid int64
	var nextOrder int
	if err == sql.ErrNoRows {
		// Нет уроков — добавляем вопрос только к курсу
		err = db.QueryRow("SELECT COALESCE(MAX(question_order),0)+1 FROM questions WHERE course_id = ? AND lesson_id IS NULL", payload.CourseID).Scan(&nextOrder)
		if err != nil {
			nextOrder = 1
		}
		res, err = db.Exec(
			"INSERT INTO questions (lesson_id, course_id, question_text, explanation, question_order) VALUES (NULL, ?, ?, ?, ?)",
			payload.CourseID, payload.QuestionText, payload.Explanation, nextOrder)
		if err != nil {
			http.Error(w, "Error creating course-level question", http.StatusInternalServerError)
			return
		}
		qid, err = res.LastInsertId()
		if err != nil {
			http.Error(w, "Error getting question ID", http.StatusInternalServerError)
			return
		}
	} else if err == nil {
		// Есть урок — добавляем как раньше
		err = db.QueryRow("SELECT COALESCE(MAX(question_order),0)+1 FROM questions WHERE lesson_id = ?", lessonID).Scan(&nextOrder)
		if err != nil {
			nextOrder = 1
		}
		res, err = db.Exec(
			"INSERT INTO questions (lesson_id, course_id, question_text, explanation, question_order) VALUES (?, ?, ?, ?, ?)",
			lessonID, payload.CourseID, payload.QuestionText, payload.Explanation, nextOrder)
		if err != nil {
			http.Error(w, "Error creating question", http.StatusInternalServerError)
			return
		}
		qid, err = res.LastInsertId()
		if err != nil {
			http.Error(w, "Error getting question ID", http.StatusInternalServerError)
			return
		}
	} else {
		http.Error(w, "Error finding lessons", http.StatusInternalServerError)
		return
	}

	// insert options
	for _, opt := range payload.Options {
		_, err := db.Exec(
			"INSERT INTO question_options (question_id, option_text, is_correct, option_order) VALUES (?, ?, ?, ?)",
			qid, opt.OptionText, opt.IsCorrect, opt.OptionOrder)
		if err != nil {
			http.Error(w, "Error creating question option", http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":      qid,
		"message": "Question created successfully",
	})
}

// updateQuestionHandler updates an existing question and its options
func updateQuestionHandler(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	vars := mux.Vars(r)
	qidStr := vars["qid"]
	questionID, err := strconv.Atoi(qidStr)
	if err != nil {
		http.Error(w, "Invalid question ID", http.StatusBadRequest)
		return
	}

	var payload struct {
		QuestionText  string `json:"question_text"`
		Explanation   string `json:"explanation"`
		QuestionOrder int    `json:"question_order"`
		Options       []struct {
			OptionText  string `json:"option_text"`
			IsCorrect   bool   `json:"is_correct"`
			OptionOrder int    `json:"option_order"`
		} `json:"options"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Update question
	result, err := db.Exec(`
		UPDATE questions 
		SET question_text = ?, explanation = ?, question_order = ?
		WHERE id = ?
	`, payload.QuestionText, payload.Explanation, payload.QuestionOrder, questionID)
	if err != nil {
		http.Error(w, "Error updating question", http.StatusInternalServerError)
		return
	}

	if rows, _ := result.RowsAffected(); rows == 0 {
		http.Error(w, "Question not found", http.StatusNotFound)
		return
	}

	// Delete existing options
	_, err = db.Exec("DELETE FROM question_options WHERE question_id = ?", questionID)
	if err != nil {
		http.Error(w, "Error updating question options", http.StatusInternalServerError)
		return
	}

	// Insert new options
	for _, opt := range payload.Options {
		_, err := db.Exec(`
			INSERT INTO question_options (question_id, option_text, is_correct, option_order)
			VALUES (?, ?, ?, ?)
		`, questionID, opt.OptionText, opt.IsCorrect, opt.OptionOrder)
		if err != nil {
			http.Error(w, "Error creating question option", http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Question updated successfully"})
}

// deleteQuestionHandler deletes a question
func deleteQuestionHandler(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	vars := mux.Vars(r)
	qidStr := vars["qid"]
	qid, err := strconv.Atoi(qidStr)
	if err != nil {
		http.Error(w, "Invalid question ID", http.StatusBadRequest)
		return
	}

	_, err = db.Exec("DELETE FROM questions WHERE id = ?", qid)
	if err != nil {
		http.Error(w, "Error deleting question", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Question deleted"})
}

// createLessonHandler creates a new lesson for a course
func createLessonHandler(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	var payload struct {
		CourseID    int    `json:"course_id"`
		Title       string `json:"title"`
		Content     string `json:"content"`
		LessonOrder int    `json:"lesson_order"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if payload.CourseID <= 0 || payload.Title == "" {
		http.Error(w, "course_id and title are required", http.StatusBadRequest)
		return
	}

	// Check that course exists
	var courseExists int
	err := db.QueryRow("SELECT id FROM courses WHERE id = ?", payload.CourseID).Scan(&courseExists)
	if err != nil {
		http.Error(w, "Course not found", http.StatusNotFound)
		return
	}

	// Insert lesson
	result, err := db.Exec(`
		INSERT INTO lessons (course_id, title, content, lesson_order)
		VALUES (?, ?, ?, ?)
	`, payload.CourseID, payload.Title, payload.Content, payload.LessonOrder)
	if err != nil {
		http.Error(w, "Error creating lesson", http.StatusInternalServerError)
		return
	}

	lessonID, err := result.LastInsertId()
	if err != nil {
		http.Error(w, "Error getting lesson ID", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":           lessonID,
		"course_id":    payload.CourseID,
		"title":        payload.Title,
		"content":      payload.Content,
		"lesson_order": payload.LessonOrder,
		"message":      "Lesson created successfully",
	})
}

// updateLessonHandler updates an existing lesson
func updateLessonHandler(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	vars := mux.Vars(r)
	lessonIDStr := vars["lesson_id"]
	lessonID, err := strconv.Atoi(lessonIDStr)
	if err != nil {
		http.Error(w, "Invalid lesson ID", http.StatusBadRequest)
		return
	}

	var payload struct {
		Title       string `json:"title"`
		Content     string `json:"content"`
		LessonOrder int    `json:"lesson_order"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if payload.Title == "" {
		http.Error(w, "title is required", http.StatusBadRequest)
		return
	}

	// Update lesson
	result, err := db.Exec(`
		UPDATE lessons
		SET title = ?, content = ?, lesson_order = ?
		WHERE id = ?
	`, payload.Title, payload.Content, payload.LessonOrder, lessonID)
	if err != nil {
		http.Error(w, "Error updating lesson", http.StatusInternalServerError)
		return
	}

	if rows, _ := result.RowsAffected(); rows == 0 {
		http.Error(w, "Lesson not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Lesson updated successfully"})
}

// deleteLessonHandler deletes a lesson and all its questions
func deleteLessonHandler(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	vars := mux.Vars(r)
	lessonIDStr := vars["lesson_id"]
	lessonID, err := strconv.Atoi(lessonIDStr)
	if err != nil {
		http.Error(w, "Invalid lesson ID", http.StatusBadRequest)
		return
	}

	// Delete lesson (cascade delete will remove questions and options)
	result, err := db.Exec("DELETE FROM lessons WHERE id = ?", lessonID)
	if err != nil {
		http.Error(w, "Error deleting lesson", http.StatusInternalServerError)
		return
	}

	if rows, _ := result.RowsAffected(); rows == 0 {
		http.Error(w, "Lesson not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Lesson deleted successfully"})
}
