package main

import (
	"context"
	"log"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

// Claims represents JWT claims
type Claims struct {
	UserID int    `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// jwtMiddleware validates JWT tokens and adds user info to context
func jwtMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("jwtMiddleware: %s %s", r.Method, r.URL.Path)
		// Skip middleware for public routes
		if r.URL.Path == "/api/login" || r.URL.Path == "/api/register" || r.URL.Path == "/api/compile" ||
			r.URL.Path == "/api/courses" || strings.HasPrefix(r.URL.Path, "/api/courses/") {
			next.ServeHTTP(w, r)
			return
		}

		// Extract token from Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Authorization header required", http.StatusUnauthorized)
			return
		}

		// Parse bearer token
		tokenString := ""
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = authHeader[7:]
		} else {
			http.Error(w, "Invalid authorization header format", http.StatusUnauthorized)
			return
		}

		// Parse and validate token
		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		// Add user info to request context
		ctx := context.WithValue(r.Context(), "user_id", claims.UserID)
		ctx = context.WithValue(ctx, "role", claims.Role)
		newReq := r.WithContext(ctx)

		// Continue with next handler
		next.ServeHTTP(w, newReq)
	})
}

// getUserIDFromContext extracts user ID from request context
func getUserIDFromContext(r *http.Request) int {
	if userID, ok := r.Context().Value("user_id").(int); ok {
		return userID
	}
	return 0
}

// getUserRoleFromContext extracts user role from request context
func getUserRoleFromContext(r *http.Request) string {
	if role, ok := r.Context().Value("role").(string); ok {
		return role
	}
	return ""
}

// requireAdmin checks if user has admin role
func requireAdmin(w http.ResponseWriter, r *http.Request) bool {
	role := getUserRoleFromContext(r)
	if role != "admin" {
		http.Error(w, "Admin access required", http.StatusForbidden)
		return false
	}
	return true
}
