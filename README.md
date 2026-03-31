# Corporate Learning Management System (LMS)

A complete web application for corporate employee training and knowledge management with role-based access control.

## Features

### Employee Features
- User registration and authentication
- View available courses
- Track course completion progress
- View personal results and scores
- Visualize progress with interactive charts

### Admin Features
- Manage courses (create, edit, delete)
- View all users
- Monitor system analytics
- Track course completion statistics
- Performance dashboards

## Technology Stack

- **Backend**: Go (net/http) with Gorilla Mux router
- **Database**: MySQL
- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Authentication**: JWT tokens with bcrypt password hashing
- **Charts**: Chart.js for data visualization

## Prerequisites

- Go 1.21+
- MySQL 8.0+
- Git
- **Docker (for Judge0 service)** – the code executor runs in a container listening on port 2358

## Setup Instructions

### 1. Database Setup

1. Create a MySQL database:
```sql
CREATE DATABASE lms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. Execute the schema file (it now includes tables for programming tasks, test cases and submissions):
```bash
mysql -u username -p lms < schema.sql
```

3. (Optional) seed the database with example tasks and tests. You can either run the snippet below manually or use the provided `seeds.sql` script:
```bash
mysql -u username -p lms < seeds.sql
```

Example SQL if you prefer to insert by hand (note `course_id` is now required):
```sql
INSERT INTO tasks (course_id, title, description, language_id) VALUES
(1, 'Hello World Python', 'Print Hello', 71);

INSERT INTO test_cases (task_id, input, expected_output) VALUES
(1, '', 'Hello');
```
### 2. Environment Configuration

Create a `.env` file in the project root:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=lms
PORT=8080
JWT_SECRET=your-secret-key-change-this-in-production
```

### 3. Install Dependencies

```bash
go mod tidy
```

### 4. Run the Application

```bash
go run .
```

The server will start on `http://localhost:8080`

## Default Accounts

### Admin Account
- **Login**: admin
- **Password**: admin123

Employees can register themselves through the registration form.

## API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/register` - User registration

### Employee Routes
- `GET /api/profile` - Get user profile
- `GET /api/courses` - Get all courses
- `GET /api/course-results` - Get user's course results
- `POST /api/course-results` - Submit course result
### Task/Auto‑grading Routes
- `GET /api/tasks` - List programming tasks (any authenticated user). Each task now includes `course_id` and `course_title` so the frontend can show which course it belongs to.
- `GET /api/tasks/{id}` - Retrieve single task details (title, description, language_id, course_id, course_title)
- `POST /submit` - Submit source code for evaluation (protected route)
    * **Request body**: `{ "code": "...", "language_id": 71, "task_id": 3 }` (or use `language_id` 63 for JavaScript)
    * Response contains `verdict` and `output` returned from Judge0
- `POST /api/compile` - Compile and execute code locally (public route, no JWT required)
    * **Request body**: `{ "code": "...", "language_id": <id> }` (use 63 for JS)
    * Supported languages:
      - **50** (C) — compiles with gcc, executes binary ✅ working
      - **54** (C++) — compiles with g++, executes binary ✅ working
      - **71** (Python 3) — executes directly with python ✅ working
      - **60** (Go) — compiles with go build (binary execution has platform issues on Windows)
    * Returns JSON with `success` (bool) and `output` (string with program output or error messages)

#### Admin-only task management
- `POST /api/admin/tasks` - Create a new task (requires admin JWT)
- `PUT /api/admin/tasks/{id}` - Update an existing task (course, title, description, language)
- `POST /api/admin/tasks/{id}/test-cases` - Add a test case to an existing task

(The `/submit` endpoint fetches corresponding test cases from the database, invokes a local Judge0 service, computes a verdict, saves a submission record, and returns the result.)
### Admin Routes
- `GET /api/admin/courses` - Get all courses
- `POST /api/admin/courses` - Create new course
- `PUT /api/admin/courses/{id}` - Update course
- `DELETE /api/admin/courses/{id}` - Delete course
- `GET /api/admin/users` - Get all users
- `GET /api/admin/analytics` - Get system analytics

## Project Structure

```
.
├── main.go              # Application entry point
├── models.go            # Data structures
├── auth_handlers.go     # Authentication endpoints
├── middleware.go        # JWT middleware
├── employee_handlers.go # Employee endpoints
├── admin_handlers.go    # Admin endpoints
├── schema.sql          # Database schema
├── .env               # Environment configuration
├── go.mod             # Go modules
└── static/            # Frontend files
    ├── index.html     # Login page
    ├── profile.html   # Employee dashboard
    └── admin.html     # Admin panel
```

## Security Features

- Passwords hashed with bcrypt
- JWT token authentication
- Role-based access control
- Prepared SQL statements to prevent injection
- Authorization headers for API protection
- Code submitted by users is **never executed in the browser**; all evaluation is done server‑side via Judge0

## Demo Functionality

The employee dashboard includes a "Complete Course" button that simulates course completion with random scores for demonstration purposes.

## Customization

- Modify the passing score threshold in `employee_handlers.go`
- Adjust JWT expiration time in `auth_handlers.go`
- Customize UI themes in the HTML/CSS files
- Extend analytics in `admin_handlers.go`

## Troubleshooting

### Ручная очистка вопросов
Если курсы содержат вопросы, добавленные вне админки, вы можете:

1. Открыть курс в админ‑панели и вручную удалить ненужные или дублирующиеся вопросы.
2. Или выполнить SQL-запросы напрямую в базе:
```sql
-- удалить вопросы без валидного course_id
DELETE q FROM questions q
LEFT JOIN courses c ON q.course_id = c.id
WHERE c.id IS NULL;

-- удалить явные дубликаты по тексту (оставится запись с наименьшим id)
DELETE q1 FROM questions q1
JOIN questions q2 ON q1.question_text = q2.question_text AND q1.id > q2.id;
```

3. При необходимости привязать существующие вопросы к курсу вручную:
```sql
UPDATE questions
SET course_id = 3  -- желаемый ID курса
WHERE id = 42;
```

После этих действий «Управление содержимым» будет показывать актуальный список вопросов.

## Troubleshooting

1. **Database Connection Issues**: Verify MySQL is running and credentials are correct
2. **Port Conflicts**: Change PORT in .env file
3. **Missing Dependencies**: Run `go mod tidy` to install required packages
4. **Permission Errors**: Ensure MySQL user has proper privileges

## License

This is an educational project for learning purposes.