-- UNIFIED Learning Management System Database Schema
-- Clean architecture: courses → lessons (with theory) → questions → options
-- ONE schema file - everything needed for the system


CREATE DATABASE lms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lms;

-- ===== TABLES =====

-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    login VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role ENUM('employee', 'admin') DEFAULT 'employee',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Courses table (main topics)
CREATE TABLE courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_title (title)
);

-- Lessons table (subtopics with theory content)
CREATE TABLE lessons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content LONGTEXT NOT NULL,
    lesson_order INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    INDEX idx_course (course_id)
);

-- Questions table (quiz questions per lesson)
CREATE TABLE questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lesson_id INT NULL,
    course_id INT NULL,
    question_text TEXT NOT NULL,
    explanation TEXT,
    question_order INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    INDEX idx_lesson (lesson_id),
    INDEX idx_course (course_id)
);

-- Question options table (answer choices)
CREATE TABLE question_options (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE,
    option_order INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    INDEX idx_question (question_id)
);

-- Course results table
CREATE TABLE course_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    score DECIMAL(5,2),
    status ENUM('in_progress', 'passed', 'failed', 'studied'),
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_course (user_id, course_id),
    INDEX idx_user (user_id)
);

-- Question answers table (user progress)
CREATE TABLE question_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    question_id INT NOT NULL,
    selected_option_id INT,
    is_correct BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (selected_option_id) REFERENCES question_options(id) ON DELETE SET NULL,
    UNIQUE KEY unique_user_question (user_id, question_id),
    INDEX idx_user (user_id)
);

CREATE TABLE IF NOT EXISTS tasks (
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
) ENGINE=InnoDB;
-- ===== SEED DATA =====

-- Insert users (passwords: admin=test123, employee=test123, adminuser=password123)  
INSERT IGNORE INTO users (id, login, password_hash, role) VALUES 
(1, 'admin', '$2a$10$MD/dsWu1dwBT9kOpjGwjIekRNqH8vZjoNpZd3suOB0/i/DShmmd4a', 'admin'),
(2, 'employee', '$2a$10$MD/dsWu1dwBT9kOpjGwjIekRNqH8vZjoNpZd3suOB0/i/DShmmd4a', 'employee'),
(3, 'adminuser', '$2a$10$/tvYUTeARQ4WtK.gXmGrqO8zqLMYrFefeiRY4eCv63N6or7Ss7x6u', 'admin');

-- Insert courses
INSERT IGNORE INTO courses (id, title, description) VALUES 
(56, 'Python Basics', 'Learn Python programming fundamentals'),
(57, 'JavaScript Essentials', 'Master JavaScript for web development'),
(58, 'Go Programming', 'Concurrency patterns in Go');

-- ===== COURSE 58: GO PROGRAMMING =====

-- Lessons for Go
INSERT IGNORE INTO lessons (id, course_id, title, content, lesson_order) VALUES 
(1, 58, 'Переменные и типы данных', '<h2>Переменные в Go</h2><p>Go - строго типизированный язык. Переменные объявляются с помощью var или :=</p><p><strong>Основные типы:</strong> int, float64, string, bool, byte, rune</p><p>Пример: <code>var x int = 10</code> или <code>y := 20</code></p>', 1),
(2, 58, 'Функции', '<h2>Функции в Go</h2><p>Синтаксис: func name(param type) returnType { }</p><p>Go поддерживает множественные возвращаемые значения:</p><p><code>func divide(a, b int) (int, error) { }</code></p>', 2),
(3, 58, 'Горутины и конкурентность', '<h2>Goroutines</h2><p>Легковесные потоки управляемые рантайм Go. Синтаксис: <code>go functionName()</code></p><p>Для синхронизации используются каналы: <code>ch := make(chan int)</code></p>', 3);

-- Questions for Lesson 1 (Go - Variables)
INSERT IGNORE INTO questions (id, lesson_id, question_text, explanation, question_order) VALUES 
(1, 1, 'Какой оператор используется для объявления переменной в Go?', 'В Go используются var или :=. Оператор := работает только внутри функций и автоматически определяет тип.', 1),
(2, 1, 'Что будет выведено: var x int; fmt.Println(x)?', 'При объявлении переменной целого типа без инициализации она получает нулевое значение, которое для int это 0.', 2),
(3, 1, 'Какова разница между int и uint в Go?', 'int - целое число со знаком (может быть отрицательным), uint - целое число без знака (только положительные).', 3);

-- Options for Question 1
INSERT IGNORE INTO question_options (question_id, option_text, is_correct, option_order) VALUES 
(1, 'var', 1, 1),
(1, ':=', 1, 2),
(1, 'def', 0, 3),
(1, 'let', 0, 4);

-- Options for Question 2
INSERT IGNORE INTO question_options (question_id, option_text, is_correct, option_order) VALUES 
(2, '0', 1, 1),
(2, 'null', 0, 2),
(2, 'undefined', 0, 3),
(2, 'Ошибка компиляции', 0, 4);

-- Options for Question 3
INSERT IGNORE INTO question_options (question_id, option_text, is_correct, option_order) VALUES 
(3, 'int - со знаком, uint - без знака', 1, 1),
(3, 'int - целые, uint - дробные', 0, 2),
(3, 'Нет никакой разницы', 0, 3),
(3, 'int - для строк, uint - для чисел', 0, 4);

-- Questions for Lesson 2 (Go - Functions)
INSERT IGNORE INTO questions (id, lesson_id, question_text, explanation, question_order) VALUES 
(4, 2, 'Сколько значений может возвращать функция в Go?', 'Go позволяет функциям возвращать несколько значений одновременно. Это удобно для возврата результата и ошибки одновременно.', 1),
(5, 2, 'Как объявить функцию, которая не возвращает значения?', 'Если функция ничего не возвращает, просто не указывается тип после скобок параметров: func foo() { }', 2);

-- Options for Question 4
INSERT IGNORE INTO question_options (question_id, option_text, is_correct, option_order) VALUES 
(4, 'Только 1', 0, 1),
(4, 'Несколько (2 и более)', 1, 2),
(4, '3 максимум', 0, 3),
(4, 'Функции вообще не могут возвращать', 0, 4);

-- Options for Question 5
INSERT IGNORE INTO question_options (question_id, option_text, is_correct, option_order) VALUES 
(5, 'func foo() {}', 1, 1),
(5, 'func foo() void {}', 0, 2),
(5, 'function foo() {}', 0, 3),
(5, 'func foo() null {}', 0, 4);

-- Questions for Lesson 3 (Go - Goroutines)
INSERT IGNORE INTO questions (id, lesson_id, question_text, explanation, question_order) VALUES 
(6, 3, 'Сколько системных потоков использует одна горутина?', 'Горутина - это абстракция управляемая рантайм Go. Одна горутина не соответствует одному системному потоку. Множество горутин могут работать на одном потоке.', 1),
(7, 3, 'Как стартовать горутину?', 'Используется ключевое слово go перед вызовом функции: go someFunctionName()', 2);

-- Options for Question 6
INSERT IGNORE INTO question_options (question_id, option_text, is_correct, option_order) VALUES 
(6, 'Всегда 1', 0, 1),
(6, 'Много горутин могут работать на одном потоке', 1, 2),
(6, 'Это зависит от ОС', 0, 3),
(6, 'Всегда несколько потоков', 0, 4);

-- Options for Question 7
INSERT IGNORE INTO question_options (question_id, option_text, is_correct, option_order) VALUES 
(7, 'goroutine someFunctionName()', 0, 1),
(7, 'go someFunctionName()', 1, 2),
(7, 'spawn someFunctionName()', 0, 3),
(7, 'async someFunctionName()', 0, 4);

-- ===== COURSE 57: JAVASCRIPT =====

INSERT IGNORE INTO lessons (id, course_id, title, content, lesson_order) VALUES 
(4, 57, 'Основы JavaScript', '<h2>JavaScript</h2><p>Язык программирования для браузеров и Node.js.</p><p>Переменные: var (функциональная область видимости), let (блочная область), const (неизменяемая)</p><p><code>var x = 5; let y = 10; const z = 15;</code></p>', 1);

INSERT IGNORE INTO questions (id, lesson_id, question_text, explanation, question_order) VALUES 
(8, 4, 'Какая разница между var и let?', 'var имеет функциональную область видимости, let имеет блочную область видимости (ES6). let предпочтительнее в современном JavaScript.', 1);

INSERT IGNORE INTO question_options (question_id, option_text, is_correct, option_order) VALUES 
(8, 'var - функциональная область, let - блочная', 1, 1),
(8, 'Нет никакой разницы', 0, 2),
(8, 'var - более быстрый', 0, 3),
(8, 'let работает только в браузере', 0, 4);

-- ===== COURSE 56: PYTHON =====

INSERT IGNORE INTO lessons (id, course_id, title, content, lesson_order) VALUES 
(5, 56, 'Синтаксис Python', '<h2>Python</h2><p>Интерпретируемый язык с простым синтаксисом.</p><p>Python использует отступы (indentation) для определения блоков кода вместо фигурных скобок:</p><p><code>if x > 5:<br/>    print("больше")</code></p>', 1);

INSERT IGNORE INTO questions (id, lesson_id, question_text, explanation, question_order) VALUES 
(9, 5, 'Что используется Python для определения блоков кода?', 'Python использует отступы (indentation) вместо фигурных скобок для определения блоков кода. Это уникальная особенность Python.', 1);

INSERT IGNORE INTO question_options (question_id, option_text, is_correct, option_order) VALUES 
(9, 'Отступы', 1, 1),
(9, 'Фигурные скобки {}', 0, 2),
(9, 'Круглые скобки ()', 0, 3),
(9, 'Точки с запятыми ;', 0, 4);

-- Insert course progress
INSERT IGNORE INTO course_results (user_id, course_id, status) VALUES 
(2, 58, 'in_progress');

-- ===== VERIFY =====
SELECT 'Database setup complete!' as status;
SELECT COUNT(*) as total_users FROM users;
SELECT COUNT(*) as total_courses FROM courses;
SELECT COUNT(*) as total_lessons FROM lessons;
SELECT COUNT(*) as total_questions FROM questions;
SELECT COUNT(*) as total_options FROM question_options;

-- Пример: добавить вопрос к курсу (без урока)
-- Замените 123 на нужный course_id
INSERT INTO questions (lesson_id, course_id, question_text, explanation, question_order)
VALUES (NULL, 123, 'Пример вопроса к курсу?', 'Пояснение (опционально)', 1);
