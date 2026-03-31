package main

import (
	"time"
)

// User represents a system user
type User struct {
	ID           int       `json:"id"`
	Login        string    `json:"login"`
	PasswordHash string    `json:"-"`
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// Course represents a learning course
type Course struct {
	ID          int       `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// CourseResult represents a user's result for a course
// CompletedAt can be NULL in the database while the course is still in
// progress, so we keep a pointer here. JSON omits the field when it is nil.
type CourseResult struct {
	ID          int        `json:"id"`
	UserID      int        `json:"user_id"`
	CourseID    int        `json:"course_id"`
	Score       *float64   `json:"score,omitempty"` // nil when not scored (theory-only course)
	Status      string     `json:"status"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	CourseTitle string     `json:"course_title,omitempty"` // For joined queries
}

// CourseTheory represents theory content for a course
type CourseTheory struct {
	ID        int       `json:"id"`
	CourseID  int       `json:"course_id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Lesson represents a lesson within a course
type Lesson struct {
	ID          int        `json:"id"`
	CourseID    int        `json:"course_id"`
	Title       string     `json:"title"`
	Content     string     `json:"content"`
	LessonOrder int        `json:"lesson_order"`
	Questions   []Question `json:"questions,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// QuestionOption represents an answer option for a question
type QuestionOption struct {
	ID          int       `json:"id"`
	QuestionID  int       `json:"question_id"`
	OptionText  string    `json:"option_text"`
	IsCorrect   bool      `json:"is_correct"`
	OptionOrder int       `json:"option_order"`
	CreatedAt   time.Time `json:"created_at"`
}

// Question represents a single question within a lesson
type Question struct {
	ID            int              `json:"id"`
	LessonID      int              `json:"lesson_id"`
	CourseID      int              `json:"course_id"`
	QuestionText  string           `json:"question_text"`
	Explanation   string           `json:"explanation"`
	QuestionOrder int              `json:"question_order"`
	Options       []QuestionOption `json:"options"`
	CreatedAt     time.Time        `json:"created_at"`
	UpdatedAt     time.Time        `json:"updated_at"`
}

// Task represents a programming assignment/task for auto-grading
// language_id corresponds to Judge0 language identifiers
// tasks are now associated with a course via CourseID.
type Task struct {
	ID          int    `json:"id"`
	CourseID    int    `json:"course_id"`
	CourseTitle string `json:"course_title,omitempty"`
	Title       string `json:"title"`
	Description string `json:"description"`
	LanguageID  int    `json:"language_id"`
}

// TestCase holds input and expected output or test code for a task
// This struct is mainly used internally on the backend; test cases are not
// exposed to clients to prevent cheating.
type TestCase struct {
	ID             int    `json:"id"`
	TaskID         int    `json:"task_id"`
	Input          string `json:"input"`
	ExpectedOutput string `json:"expected_output"`
	TestCode       string `json:"test_code"`
	CheckType      string `json:"check_type"` // output or code_test
}

// Submission represents one attempt by a user to solve a task
// verdict values: Accepted, Wrong Answer, Runtime Error, Time Limit Exceeded, etc.
type Submission struct {
	ID        int       `json:"id"`
	UserID    int       `json:"user_id"`
	TaskID    int       `json:"task_id"`
	Code      string    `json:"code"`
	Verdict   string    `json:"verdict"`
	CreatedAt time.Time `json:"created_at"`
}

// LoginRequest represents login request payload
type LoginRequest struct {
	Login    string `json:"login"`
	Password string `json:"password"`
}

// RegisterRequest represents registration request payload
type RegisterRequest struct {
	Login       string `json:"login"`
	Password    string `json:"password"`
	FullName    string `json:"fullname"`
	FullNameAlt string `json:"fullName,omitempty"`
	Email       string `json:"email"`
}

// JWTResponse represents JWT token response
type JWTResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

// AnalyticsData represents analytics data for admin dashboard
type AnalyticsData struct {
	TotalUsers    int     `json:"total_users"`
	TotalCourses  int     `json:"total_courses"`
	TotalResults  int     `json:"total_results"`
	PassedCourses int     `json:"passed_courses"`
	FailedCourses int     `json:"failed_courses"`
	AverageScore  float64 `json:"average_score"`
}
