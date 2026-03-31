package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// JWT secret key (should be moved to environment variables in production)
var jwtSecret = []byte("your-secret-key-change-this-in-production")

func writeJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"message": message})
}

// loginHandler handles user authentication
func loginHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Printf("Login request received from %s\n", r.RemoteAddr)

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fmt.Printf("Invalid request body: %v\n", err)
		writeJSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate input
	if req.Login == "" || req.Password == "" {
		writeJSONError(w, http.StatusBadRequest, "Login and password are required")
		return
	}

	// Find user in database
	fmt.Printf("Looking for user: %s\n", req.Login)
	var user User
	err := db.QueryRow("SELECT id, login, password_hash, role FROM users WHERE login = ?", req.Login).Scan(
		&user.ID, &user.Login, &user.PasswordHash, &user.Role)
	if err != nil {
		fmt.Printf("User not found or database error: %v\n", err)
		writeJSONError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}
	fmt.Printf("User found: ID=%d, Login=%s, Role=%s\n", user.ID, user.Login, user.Role)

	// Compare password hash
	fmt.Printf("Comparing password for user %s\n", req.Login)
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		fmt.Printf("Password comparison failed: %v\n", err)
		writeJSONError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}
	fmt.Printf("Password verified successfully\n")

	// Log user info for debugging
	fmt.Printf("User login: %s, Role: %s, ID: %d\n", user.Login, user.Role, user.ID)

	// Generate JWT token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID,
		"role":    user.Role,
		"exp":     time.Now().Add(time.Hour * 24).Unix(),
	})

	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		http.Error(w, "Error generating token", http.StatusInternalServerError)
		return
	}

	// Return token and user info
	response := JWTResponse{
		Token: tokenString,
		User:  user,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// registerHandler handles new user registration
func registerHandler(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	fmt.Printf("Register raw body: %s\n", string(body))

	if err = json.Unmarshal(body, &req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	fmt.Printf("Register request payload: login=%q fullname=%q fullnameAlt=%q email=%q password_len=%d\n", req.Login, req.FullName, req.FullNameAlt, req.Email, len(req.Password))

	if req.FullName == "" {
		req.FullName = req.FullNameAlt
		if req.FullName != "" {
			fmt.Printf("Register handler: using fullName fallback=%q\n", req.FullName)
		}
	}

	if req.FullName == "" {
		// Fallback: if fullname is not provided, use login as user-visible name.
		req.FullName = req.Login
	}

	// Validate input
	if req.Login == "" || req.Password == "" || req.Email == "" {
		writeJSONError(w, http.StatusBadRequest, "Login, password и email обязательны")
		return
	}

	// Check if user already exists (by login)
	var existingID int
	err = db.QueryRow("SELECT id FROM users WHERE login = ?", req.Login).Scan(&existingID)
	if err == nil {
		writeJSONError(w, http.StatusConflict, "User already exists")
		return
	}

	// Check email uniqueness
	err = db.QueryRow("SELECT id FROM users WHERE email = ?", req.Email).Scan(&existingID)
	if err == nil {
		writeJSONError(w, http.StatusConflict, "Email уже зарегистрирован")
		return
	}
	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "Error hashing password")
		return
	}

	// Create user
	result, err := db.Exec("INSERT INTO users (login, password_hash, role, full_name, email) VALUES (?, ?, ?, ?, ?)",
		req.Login, string(hashedPassword), "employee", req.FullName, req.Email)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "Error creating user")
		return
	}

	userID, _ := result.LastInsertId()

	// Return success response
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "User created successfully",
		"user_id": userID,
	})
}
