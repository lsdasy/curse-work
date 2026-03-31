package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	_ "github.com/go-sql-driver/mysql"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

// Global database connection
var db *sql.DB

func main() {
	// Load environment variables
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found, using default values")
	}

	// Initialize database connection
	db, err = initDB()
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	// Test database connection
	err = db.Ping()
	if err != nil {
		log.Fatal("Failed to ping database:", err)
	}
	fmt.Println("Connected to MySQL database")

	// ensure auxiliary tables exist
	err = ensureTables()
	if err != nil {
		log.Fatal("Failed to ensure tables:", err)
	}

	// Clean up undefined/null values from database on startup
	cleanupUndefinedData()

	// Initialize routes
	router := setupRoutes()

	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Server starting on port %s...\n", port)
	log.Fatal(http.ListenAndServe(":"+port, router))
}

// initDB initializes the database connection
func initDB() (*sql.DB, error) {
	dbHost := getEnv("DB_HOST", "localhost")
	dbPort := getEnv("DB_PORT", "3306")
	dbUser := getEnv("DB_USER", "root")
	dbPass := getEnv("DB_PASSWORD", "")
	dbName := getEnv("DB_NAME", "lms")

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		dbUser, dbPass, dbHost, dbPort, dbName)

	return sql.Open("mysql", dsn)
}

// setupRoutes configures all application routes
func setupRoutes() *mux.Router {
	router := mux.NewRouter()

	// Public routes (no JWT middleware)
	router.HandleFunc("/api/login", loginHandler).Methods("POST")
	router.HandleFunc("/api/register", registerHandler).Methods("POST")
	router.HandleFunc("/api/courses", getCoursesHandler).Methods("GET")
	router.HandleFunc("/api/compile", compileCodeHandler).Methods("POST") // public compile for easy testing
	router.HandleFunc("/api/courses/{id}/lessons", getCourseLessonsHandler).Methods("GET")

	// Protected routes group (with JWT middleware)
	protected := router.PathPrefix("/api").Subrouter()
	protected.Use(jwtMiddleware)

	// Protected routes - Employee
	protected.HandleFunc("/profile", profileHandler).Methods("GET")
	protected.HandleFunc("/course-results", getCourseResultsHandler).Methods("GET")
	protected.HandleFunc("/course-results", submitCourseResultHandler).Methods("POST")

	// task endpoints for coding exercises
	protected.HandleFunc("/tasks", getTasksHandler).Methods("GET")                          // list tasks
	protected.HandleFunc("/tasks/{id}", getTaskHandler).Methods("GET")                      // get single task (optional)
	protected.HandleFunc("/submit", submitSolutionHandler).Methods("POST")                  // submit code for evaluation
	protected.HandleFunc("/submission-result", saveSubmissionResultHandler).Methods("POST") // save accepted result to DB
	// question answer endpoints (store/retrieve quiz responses)
	protected.HandleFunc("/question-answers", saveQuestionAnswerHandler).Methods("POST")
	protected.HandleFunc("/question-answers", getQuestionAnswersHandler).Methods("GET")

	// Protected routes - Admin only
	protected.HandleFunc("/admin/courses", adminGetCoursesHandler).Methods("GET")
	protected.HandleFunc("/admin/courses", adminCreateCourseHandler).Methods("POST")
	protected.HandleFunc("/admin/courses/{id}", adminUpdateCourseHandler).Methods("PUT")
	protected.HandleFunc("/admin/courses/{id}", adminDeleteCourseHandler).Methods("DELETE")
	protected.HandleFunc("/admin/users", adminGetUsersHandler).Methods("GET")
	protected.HandleFunc("/admin/analytics", adminAnalyticsHandler).Methods("GET")
	protected.HandleFunc("/admin/tasks", adminGetTasksHandler).Methods("GET")
	// Admin content routes
	protected.HandleFunc("/admin/courses/{id}", getCourseDetailsHandler).Methods("GET")
	protected.HandleFunc("/admin/courses/{id}/theory", updateCourseTheoryHandler).Methods("POST", "PUT")
	protected.HandleFunc("/admin/courses/{id}/questions", createQuestionHandler).Methods("POST")
	protected.HandleFunc("/admin/courses/{id}/questions/{qid}", updateQuestionHandler).Methods("PUT")
	protected.HandleFunc("/admin/courses/{id}/questions/{qid}", deleteQuestionHandler).Methods("DELETE")
	// Lesson management
	protected.HandleFunc("/admin/courses/{id}/lessons", createLessonHandler).Methods("POST")
	// allow admins to fetch lessons using same endpoint as employees
	protected.HandleFunc("/admin/courses/{id}/lessons", getCourseLessonsHandler).Methods("GET")
	// allow both direct and nested lesson update/delete paths
	protected.HandleFunc("/admin/lessons/{lesson_id}", updateLessonHandler).Methods("PUT")
	protected.HandleFunc("/admin/courses/{course_id}/lessons/{lesson_id}", updateLessonHandler).Methods("PUT")
	protected.HandleFunc("/admin/lessons/{lesson_id}", deleteLessonHandler).Methods("DELETE")
	protected.HandleFunc("/admin/courses/{course_id}/lessons/{lesson_id}", deleteLessonHandler).Methods("DELETE")
	// Admin task management
	protected.HandleFunc("/admin/tasks", adminCreateTaskHandler).Methods("POST")
	protected.HandleFunc("/admin/tasks/{id}", adminGetTaskHandler).Methods("GET")
	protected.HandleFunc("/admin/tasks/{id}", adminUpdateTaskHandler).Methods("PUT")
	protected.HandleFunc("/admin/tasks/{id}", adminDeleteTaskHandler).Methods("DELETE")
	protected.HandleFunc("/admin/tasks/{id}/test-cases", adminCreateTestCaseHandler).Methods("POST")

	// Serve static files last (no JWT middleware)
	router.PathPrefix("/").Handler(http.FileServer(http.Dir("./static/"))).Methods("GET")

	return router
}

// getEnv gets environment variable with fallback default
func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

// ensureTables creates new schema tables if they are missing.
// Note: These are auxiliary tables; the main schema should be initialized with schema.sql
func ensureTables() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS lessons (
		    id INT AUTO_INCREMENT PRIMARY KEY,
		    course_id INT NOT NULL,
		    title VARCHAR(255) NOT NULL,
		    content LONGTEXT NOT NULL,
		    lesson_order INT NOT NULL,
		    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
		    INDEX idx_course (course_id)
		) ENGINE=InnoDB;`,
		`CREATE TABLE IF NOT EXISTS questions (
		    id INT AUTO_INCREMENT PRIMARY KEY,
		    lesson_id INT NOT NULL,
		    question_text TEXT NOT NULL,
		    explanation TEXT,
		    question_order INT NOT NULL,
		    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
		    INDEX idx_lesson (lesson_id)
		) ENGINE=InnoDB;`,
		`CREATE TABLE IF NOT EXISTS question_options (
		    id INT AUTO_INCREMENT PRIMARY KEY,
		    question_id INT NOT NULL,
		    option_text TEXT NOT NULL,
		    is_correct BOOLEAN DEFAULT FALSE,
		    option_order INT NOT NULL,
		    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
		    INDEX idx_question (question_id)
		) ENGINE=InnoDB;`,
		`CREATE TABLE IF NOT EXISTS tasks (
		    id INT AUTO_INCREMENT PRIMARY KEY,
		    course_id INT NOT NULL,
		    title VARCHAR(255) NOT NULL,
		    description LONGTEXT,
		    language_id INT NOT NULL,
		    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
		    INDEX idx_language (language_id),
		    INDEX idx_course (course_id)
		) ENGINE=InnoDB;`,
		`CREATE TABLE IF NOT EXISTS test_cases (
		    id INT AUTO_INCREMENT PRIMARY KEY,
		    task_id INT NOT NULL,
		    input LONGTEXT,
		    expected_output LONGTEXT,
		    test_code LONGTEXT,
		    check_type ENUM('output', 'code_test') NOT NULL DEFAULT 'output',
		    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
		    INDEX idx_task (task_id)
		) ENGINE=InnoDB;`,
		`CREATE TABLE IF NOT EXISTS submissions (
		    id INT AUTO_INCREMENT PRIMARY KEY,
		    user_id INT NOT NULL,
		    task_id INT NOT NULL,
		    code LONGTEXT NOT NULL,
		    language_id INT NOT NULL,
		    status VARCHAR(50) DEFAULT 'pending',
		    verdict VARCHAR(100),
		    output LONGTEXT,
		    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
		    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
		    INDEX idx_user (user_id),
		    INDEX idx_task (task_id)
		) ENGINE=InnoDB;`,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return err
		}
	}

	// migrate existing test_cases from old schema if needed
	if _, err := db.Exec(`ALTER TABLE test_cases ADD COLUMN test_code LONGTEXT`); err != nil {
		if !strings.Contains(err.Error(), "Duplicate column name") && !strings.Contains(err.Error(), "Unknown table") {
			return err
		}
	}
	if _, err := db.Exec(`ALTER TABLE test_cases ADD COLUMN check_type ENUM('output','code_test') NOT NULL DEFAULT 'output'`); err != nil {
		if !strings.Contains(err.Error(), "Duplicate column name") && !strings.Contains(err.Error(), "Unknown table") {
			return err
		}
	}

	// ensure course_results enum includes 'studied' (old databases may lack it)
	if _, err := db.Exec(`ALTER TABLE course_results MODIFY COLUMN status ENUM('in_progress','passed','failed','studied') NOT NULL DEFAULT 'in_progress'`); err != nil {
		// ignore error if table doesn't exist
		if !strings.Contains(err.Error(), "Unknown table") {
			return err
		}
	}

	return nil
}

// cleanupUndefinedData removes "undefined" and "null" string values from lessons and other content fields
func cleanupUndefinedData() {
	if db == nil {
		return
	}

	// Clean up lessons table
	_, err := db.Exec(`UPDATE lessons SET title = '' WHERE title IN ('undefined', 'null') OR title = ''`)
	if err != nil {
		fmt.Printf("Warning: failed to clean lesson titles: %v\n", err)
	}

	_, err = db.Exec(`UPDATE lessons SET content = '' WHERE content IN ('undefined', 'null')`)
	if err != nil {
		fmt.Printf("Warning: failed to clean lesson content: %v\n", err)
	}

	fmt.Println("Database cleanup completed (undefined/null values removed)")
}
