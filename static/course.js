// Course Viewing Logic
let currentCourseId = null;
let currentCourse = null;
let currentLessonIndex = 0;
let courseProgress = {};
let answeredQuestions = {};
let courseTasksData = [];
let selectedCourseTask = null;
let codeEditor = null;

// Initialize Ace Editor
function initializeCodeEditor() {
    codeEditor = ace.edit("code-editor");

    // Configure editor
    codeEditor.setTheme("ace/theme/vs_code_dark");
    codeEditor.session.setMode("ace/mode/javascript");
    codeEditor.setOptions({
        enableBasicAutocompletion: true,
        enableSnippets: true,
        enableLiveAutocompletion: true,
        fontSize: "14px",
        fontFamily: "'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace",
        showPrintMargin: false,
        showGutter: true,
        highlightActiveLine: true,
        wrap: true,
        tabSize: 2,
        useSoftTabs: true,
        showInvisibles: false,
        displayIndentGuides: true,
        scrollPastEnd: 0.5
    });

    // Set initial content
    codeEditor.setValue("// Добро пожаловать в интерактивный редактор кода!\n// Выберите задачу слева и начните программировать.\n\nconsole.log('Hello, World!');\n", -1);

    // Language selector event
    document.getElementById('language-selector').addEventListener('change', function(e) {
        const language = e.target.value;
        let mode = 'javascript';

        switch(language) {
            case 'python':
                mode = 'python';
                break;
            case 'java':
                mode = 'java';
                break;
            case 'cpp':
                mode = 'c_cpp';
                break;
            case 'go':
                mode = 'golang';
                break;
            default:
                mode = 'javascript';
        }

        codeEditor.session.setMode(`ace/mode/${mode}`);

        // Update tab title
        const tabTitle = document.querySelector('.tab-title');
        const extensions = {
            javascript: 'js',
            python: 'py',
            java: 'java',
            cpp: 'cpp',
            go: 'go'
        };
        tabTitle.textContent = `solution.${extensions[language] || 'js'}`;
    });

    // Tab close functionality
    document.querySelector('.tab-close').addEventListener('click', function() {
        if (confirm('Закрыть файл? Все несохраненные изменения будут потеряны.')) {
            codeEditor.setValue("// Файл закрыт\n", -1);
        }
    });
}


// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    // Initialize Ace Editor
    initializeCodeEditor();

    // Get course ID from URL
    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('id');

    if (!courseId) {
        showEmptyState();
        return;
    }

    currentCourseId = parseInt(courseId);

    // Load progress from localStorage
    loadProgress();

    // Load course content
    await loadCourseContent();
});

async function loadCourseContent() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/courses/${currentCourseId}/lessons`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load course');
        }

        const data = await response.json();
        
        currentCourse = {
            id: data.courseId,
            title: data.courseTitle || data.title || `Курс ${data.courseId}`,
            description: data.courseDescription || '',
            lessons: data.lessons || [],
            courseQuestions: data.courseQuestions || []
        };

    // Set sidebar title with fallback
    document.getElementById('course-title-sidebar').textContent = currentCourse.title || `Курс ${currentCourseId}`;

        // Render lessons list
        renderLessonsList();

        // Load first lesson
        if (currentCourse.lessons.length > 0) {
            loadLesson(0);
        } else {
            showEmptyState();
        }

        // Load programming tasks related to this course
        await loadCourseTasks();
    } catch (error) {
        console.error('Error loading course:', error);
        showEmptyState();
        alert('Ошибка загрузки курса: ' + error.message);
    }
}

function normalizeText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    if (typeof value !== 'string') return String(value);

    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === 'undefined' || trimmed.toLowerCase() === 'null') {
        return fallback;
    }

    return trimmed;
}

function renderLessonsList() {
    const lessonsList = document.querySelector('.lessons-list');
    
    if (!currentCourse.lessons || currentCourse.lessons.length === 0) {
        lessonsList.innerHTML = '<div class="loading">Нет уроков</div>';
        return;
    }

    let html = '';
    currentCourse.lessons.forEach((lesson, index) => {
        const isCompleted = courseProgress[lesson.id]?.completed || false;
        const isActive = index === currentLessonIndex;
        const activeClass = isActive ? 'active' : '';
        const completedClass = isCompleted ? 'completed' : '';
        const displayTitle = normalizeText(lesson?.title, `Урок ${index + 1}`);

        html += `
            <div class="lesson-item ${activeClass} ${completedClass}" onclick="loadLesson(${index})">
                <span class="lesson-item-number">${index + 1}.</span>
                <span class="lesson-item-text">${escapeHtml(displayTitle)}</span>
            </div>
        `;
    });

    lessonsList.innerHTML = html;
    updateProgressBar();
}

async function loadCourseTasks() {
    const token = localStorage.getItem('token');
    const endpoints = ['/api/tasks', '/api/admin/tasks'];

    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 404) {
                continue;
            }

            if (!response.ok) {
                throw new Error(`Ошибка загрузки задач (status ${response.status})`);
            }

            const allTasks = await response.json();
                    courseTasksData = allTasks.filter(task => task.course_id === currentCourseId);
            renderCourseTasks(courseTasksData, allTasks.length);
            return;
        } catch (err) {
            console.warn(`Не удалось загрузить задачи с ${endpoint}:`, err);
            // try next endpoint
        }
    }

    console.error('Error loading course tasks: все endpoint-ы недоступны или не найдены');
    renderCourseTasks([]);
}

function renderCourseTasks(tasks, totalTasksCount = 0) {
    const container = document.getElementById('course-tasks');
    if (!container) return;

    if (!tasks || tasks.length === 0) {
        if (totalTasksCount > 0) {
            container.innerHTML = '<div class="empty-state">Нет задач, привязанных к этому курсу. Всего задач в системе: ' + totalTasksCount + '</div>';
        } else {
            container.innerHTML = '<div class="empty-state">Нет программных задач для этого курса</div>';
        }
        return;
    }

    container.innerHTML = tasks.map(task => `
        <div class="task-item">
            <strong>${escapeHtml(task.title)}</strong><br>
            <span>${escapeHtml(task.description || 'Описание отсутствует')}</span>
            <div class="task-actions" style="margin-top:0.5rem; display:flex; gap:0.4rem; flex-wrap:wrap;">
                <button class="btn" onclick="openTaskInCourse(${task.id})">Открыть задачу</button>
                <a class="btn" href="profile.html?task_id=${task.id}">На страницу задачи</a>
            </div>
        </div>
    `).join('');
}

function openTaskInCourse(taskId) {
    const task = courseTasksData.find(t => t.id === taskId);
    if (!task) {
        alert('Задача не найдена');
        return;
    }

    selectedCourseTask = task;
    const taskRunner = document.getElementById('task-runner');
    taskRunner.style.display = 'block';
    document.getElementById('task-runner-title').textContent = task.title;
    document.getElementById('task-runner-desc').textContent = task.description || 'Описание отсутствует';

    // Set code in Ace editor
    const templateCode = task.template_code || getDefaultCodeForLanguage(task.language_id);
    codeEditor.setValue(templateCode, -1);

    // Set language selector
    const languageSelector = document.getElementById('language-selector');
    const languageMap = {
        54: 'cpp',       // C++
        62: 'java',      // Java
        71: 'python',    // Python
        93: 'javascript', // JavaScript
        95: 'go'         // Go
    };
    const language = languageMap[task.language_id] || 'javascript';
    languageSelector.value = language;

    // Trigger language change to update editor mode
    languageSelector.dispatchEvent(new Event('change'));

    // Clear previous states
    const statusEl = document.getElementById('task-compile-status');
    const outputEl = document.getElementById('task-output');
    const compileBtn = document.querySelector('.btn-compile');

    statusEl.className = 'compile-status';
    statusEl.textContent = '';
    outputEl.className = 'output-panel empty';
    outputEl.textContent = 'Результат выполнения появится здесь...';
    compileBtn.classList.remove('loading');
}

function getDefaultCodeForLanguage(languageId) {
    const defaults = {
        54: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    return 0;
}`,
        62: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`,
        71: `print("Hello, World!")`,
        93: `console.log("Hello, World!");`,
        95: `package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}`
    };
    return defaults[languageId] || `console.log("Hello, World!");`;
}

async function compileCourseTask() {
    if (!selectedCourseTask) {
        alert('Выберите задачу для компиляции');
        return;
    }

    const code = codeEditor.getValue();
    const languageId = selectedCourseTask.language_id || 63;
    const statusEl = document.getElementById('task-compile-status');
    const outputEl = document.getElementById('task-output');
    const compileBtn = document.querySelector('.btn-compile');

    // Clear previous states
    statusEl.className = 'compile-status';
    outputEl.className = 'output-panel';
    compileBtn.classList.add('loading');

    statusEl.textContent = 'Отправка кода на сервер...';
    outputEl.textContent = '';
    outputEl.classList.remove('empty');

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/compile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ code, language_id: languageId })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || data.message || 'Ошибка выполнения компиляции');
        }

        if (data.success) {
            statusEl.textContent = '✓ Компиляция прошла успешно';
            statusEl.classList.add('success');
            outputEl.classList.add('success');
        } else {
            statusEl.textContent = '✗ Ошибка компиляции';
            statusEl.classList.add('error');
            outputEl.classList.add('error');
        }

        outputEl.textContent = data.output || 'Нет вывода.';
    } catch (err) {
        statusEl.textContent = '✗ Ошибка выполнения';
        statusEl.classList.add('error');
        outputEl.classList.add('error');
        outputEl.textContent = err.message;
    } finally {
        compileBtn.classList.remove('loading');
    }
}

function loadLesson(index) {
    if (!currentCourse.lessons || index < 0 || index >= currentCourse.lessons.length) {
        return;
    }

    currentLessonIndex = index;
    const lesson = currentCourse.lessons[index];

    // Update sidebar to show active lesson
    document.querySelectorAll('.lesson-item').forEach((item, i) => {
        if (i === index) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update main content
    document.getElementById('lesson-title').textContent = normalizeText(lesson?.title, `Урок ${index + 1}`);
    document.getElementById('lesson-number').textContent = `Урок ${index + 1} из ${currentCourse.lessons.length}`;

    // Check if completed
    const isCompleted = courseProgress[lesson.id]?.completed || false;
    const statusEl = document.getElementById('lesson-status');
    if (isCompleted) {
        statusEl.textContent = '✓ Завершено';
        statusEl.classList.add('completed');
    } else {
        statusEl.textContent = '⏳ В процессе';
        statusEl.classList.remove('completed');
    }

    // Load lesson content (sanitized HTML) with safe fallback
    const contentEl = document.getElementById('lesson-content');
    const rawContent = normalizeText(lesson?.content, '');
    if (rawContent) {
        contentEl.innerHTML = sanitizeHTML(rawContent);
    } else {
        contentEl.innerHTML = '<div class="placeholder">Содержимое урока отсутствует</div>';
    }

    // Hide empty state
    document.getElementById('empty-state').style.display = 'none';
    document.querySelector('.lesson-view').style.display = 'flex';

    // Load questions if present
    if (lesson.questions && lesson.questions.length > 0) {
        loadQuestionsForLesson(lesson);
    } else {
        document.getElementById('questions-section').style.display = 'none';
    }

    // Update navigation buttons
    updateNavigationButtons();

    // Mark as viewed (not necessarily completed yet)
    if (!courseProgress[lesson.id]) {
        courseProgress[lesson.id] = { completed: false, answered: false };
    }
    saveProgress();
}

function loadQuestionsForLesson(lesson) {
    const questionsSection = document.getElementById('questions-section');
    const questionsContainer = document.getElementById('questions-container');

    if (!lesson) {
        questionsSection.style.display = 'none';
        questionsContainer.innerHTML = '';
        return;
    }

    questionsSection.style.display = 'block';
    questionsContainer.innerHTML = '';

    if (!lesson.questions || lesson.questions.length === 0) {
        questionsSection.style.display = 'none';
        return;
    }

    let html = '';
    lesson.questions.forEach((question, qIndex) => {
        const questionId = question.id;
        const userAnswer = answeredQuestions[questionId];
        const isAnswered = userAnswer !== undefined;

        let optionsHTML = '';
        if (question.options && question.options.length > 0) {
            optionsHTML = question.options.map((option) => {
                const isCorrect = option.is_correct;
                const isSelected = userAnswer === option.id;
                let optionClass = '';
                let checkedAttr = '';

                if (isAnswered) {
                    if (isSelected) {
                        optionClass = isCorrect ? 'correct' : 'incorrect';
                    } else if (isCorrect && isAnswered) {
                        optionClass = 'correct';
                    }
                }

                if (isSelected) {
                    checkedAttr = 'checked';
                }

                return `
                    <div class="option-item ${optionClass} ${isAnswered ? 'disabled' : ''}" onclick="selectAnswer(${questionId}, ${option.id}, this)">
                        <input type="radio" name="question_${questionId}" value="${option.id}" ${checkedAttr} ${isAnswered ? 'disabled' : ''}>
                        <label>${escapeHtml(option.option_text)}</label>
                    </div>
                `;
            }).join('');
        }

        const explanationDisplay = isAnswered ? 'show' : '';
        const explanationClass = userAnswer !== undefined && lesson.questions[qIndex].options.find(o => o.id === userAnswer)?.is_correct ? 'correct' : 'incorrect';

        html += `
            <div class="question-item">
                <div class="question-text">${escapeHtml(question.question_text)}</div>
                <div class="options-list">
                    ${optionsHTML}
                </div>
                ${question.explanation ? `
                    <div class="question-explanation ${explanationDisplay} ${explanationClass}">
                        ${escapeHtml(question.explanation)}
                    </div>
                ` : ''}
            </div>
        `;
    });

    questionsContainer.innerHTML = html;
}

function selectAnswer(questionId, optionId, optionElement) {
    if (answeredQuestions[questionId] !== undefined) {
        return; // Already answered
    }

    const question = findQuestion(questionId);
    if (!question) return;

    const option = question.options.find(o => o.id === optionId);
    if (!option) return;

    // Save answer
    answeredQuestions[questionId] = optionId;

    // Find the lesson
    const lesson = currentCourse.lessons[currentLessonIndex];
    if (lesson) {
        if (!courseProgress[lesson.id]) {
            courseProgress[lesson.id] = { completed: false, answered: false };
        }
        courseProgress[lesson.id].answered = true;
    }

    // Reload questions to show feedback
    loadQuestionsForLesson(lesson);

    // Send answer to server
    sendAnswerToServer(questionId, optionId, option.is_correct);

    // Mark lesson as completed if all questions answered correctly
    checkLessonCompletion();
}

async function sendAnswerToServer(questionId, optionId, isCorrect) {
    try {
        const token = localStorage.getItem('token');
        await fetch('/api/question-answers', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question_id: questionId,
                selected_option_id: optionId,
                is_correct: isCorrect
            })
        });
    } catch (error) {
        console.error('Error sending answer:', error);
    }
}

function checkLessonCompletion() {
    const lesson = currentCourse.lessons[currentLessonIndex];
    if (!lesson || !lesson.questions) return;

    // Check if all questions answered correctly
    let allCorrect = true;
    lesson.questions.forEach(question => {
        const userAnswer = answeredQuestions[question.id];
        if (userAnswer === undefined) {
            allCorrect = false;
            return;
        }
        const option = question.options.find(o => o.id === userAnswer);
        if (!option || !option.is_correct) {
            allCorrect = false;
        }
    });

    if (allCorrect && lesson.questions.length > 0) {
        courseProgress[lesson.id].completed = true;
        saveProgress();
        renderLessonsList();
        updateProgressBar();
    }
}

function findQuestion(questionId) {
    for (let lesson of currentCourse.lessons) {
        if (lesson.questions) {
            const question = lesson.questions.find(q => q.id === questionId);
            if (question) return question;
        }
    }
    return null;
}

function loadPreviousLesson() {
    if (currentLessonIndex > 0) {
        loadLesson(currentLessonIndex - 1);
        document.querySelector('.lesson-view').scrollTop = 0;
    }
}

function loadNextLesson() {
    if (currentLessonIndex < currentCourse.lessons.length - 1) {
        loadLesson(currentLessonIndex + 1);
        document.querySelector('.lesson-view').scrollTop = 0;
    }
}

function updateNavigationButtons() {
    const prevBtn = document.getElementById('prev-lesson-btn');
    const nextBtn = document.getElementById('next-lesson-btn');

    prevBtn.disabled = currentLessonIndex === 0;
    nextBtn.disabled = currentLessonIndex === currentCourse.lessons.length - 1;
}

function updateProgressBar() {
    let completedCount = 0;
    currentCourse.lessons.forEach(lesson => {
        if (courseProgress[lesson.id]?.completed) {
            completedCount++;
        }
    });

    const total = currentCourse.lessons.length;
    const percentage = (completedCount / total) * 100;

    document.getElementById('progress-fill').style.width = percentage + '%';
    document.getElementById('progress-text').textContent = `${completedCount}/${total} уроков`;

    // Enable complete button if all lessons completed
    const completeBtn = document.getElementById('complete-btn');
    completeBtn.disabled = completedCount < total;
}

async function completeCourse() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/course-results', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                course_id: currentCourseId
            })
        });

        if (response.ok) {
            alert('✓ Курс успешно завершен!');
            goBackToDashboard();
        } else {
            alert('Ошибка при завершении курса');
        }
    } catch (error) {
        console.error('Error completing course:', error);
        alert('Ошибка при завершении курса: ' + error.message);
    }
}

function goBackToDashboard() {
    window.location.href = '/profile.html';
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

function showEmptyState() {
    document.getElementById('empty-state').style.display = 'flex';
    document.querySelector('.lesson-view').style.display = 'none';
}

// Progress tracking
function saveProgress() {
    const key = `lms_progress_${currentCourseId}`;
    localStorage.setItem(key, JSON.stringify(courseProgress));
}

function loadProgress() {
    const key = `lms_progress_${currentCourseId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
        courseProgress = JSON.parse(saved);
    } else {
        courseProgress = {};
    }
}

// Utility functions
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function sanitizeHTML(html) {
    if (!html) return '';
    
    // Create a temporary container
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Remove all script and style tags
    const scripts = temp.querySelectorAll('script, style, iframe, object, embed, link, meta');
    scripts.forEach(script => script.remove());
    
    // Remove dangerous event handlers from all elements
    const allElements = temp.querySelectorAll('*');
    allElements.forEach(el => {
        // Remove onclick, onerror, onload, etc.
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.toLowerCase().startsWith('on')) {
                el.removeAttribute(attr.name);
            }
        });
        // Remove onclick attribute if exists
        if (el.onclick) {
            el.onclick = null;
        }
    });
    
    return temp.innerHTML;
}
