// Authentication check
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || !user || user.role !== 'admin') {
    window.location.href = '/';
}

// API base URL
const API_BASE = '/api/admin';

// Chart instances
let completionChart = null;
let performanceChart = null;

// Fetch with authentication
async function apiCall(url, options = {}) {
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };
    
    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };

    const response = await fetch(url, mergedOptions);
    if (!response.ok) {
        let txt;
        try {
            txt = await response.text();
        } catch (_) {
            txt = response.statusText;
        }
        throw new Error(txt || `HTTP ${response.status}`);
    }
    return response;
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

// Load admin analytics
async function loadAnalytics() {
    try {
        const response = await apiCall(`${API_BASE}/analytics`);
        const data = await response.json();
        
        document.getElementById('stats-container').innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${data.total_users}</div>
                <div class="stat-label">Всего Пользователей</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${data.total_courses}</div>
                <div class="stat-label">Всего Курсов</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${data.total_results}</div>
                <div class="stat-label">Пройденных Курсов</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${Math.round(data.average_score)}%</div>
                <div class="stat-label">Средний Балл</div>
            </div>
        `;

        createCompletionChart(data.passed_courses, data.failed_courses);
        createPerformanceChart(data);
    } catch (error) {
        console.error('Ошибка загрузки аналитики:', error);
    }
}

// Create completion chart
function createCompletionChart(passed, failed) {
    const ctx = document.getElementById('completionChart').getContext('2d');
    
    if (completionChart) {
        completionChart.destroy();
    }

    completionChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Сдано', 'Не сдано'],
            datasets: [{
                data: [passed, failed],
                backgroundColor: ['#2ed573', '#ff4757'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#f0f0f0'
                    }
                }
            }
        }
    });
}

// Create performance chart
function createPerformanceChart(data) {
    const ctx = document.getElementById('performanceChart').getContext('2d');
    
    if (performanceChart) {
        performanceChart.destroy();
    }

    performanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Пользователи', 'Курсы', 'Пройденные'],
            datasets: [{
                label: 'Метрики Системы',
                data: [data.total_users, data.total_courses, data.total_results],
                backgroundColor: ['#ff6b6b', '#2ed573', '#ffa502'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                    labels: {
                        color: '#f0f0f0'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#f0f0f0'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: '#f0f0f0'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
}

// Load courses
async function loadCourses() {
    try {
        const response = await apiCall('/api/admin/courses');
        const courses = await response.json();
        
        const listEl = document.getElementById('courses-list');
        
        if (courses.length === 0) {
            listEl.innerHTML = '<div class="empty-state">Нет доступных курсов</div>';
            return;
        }

        listEl.innerHTML = courses.map(course => `
            <div class="list-item">
                <div class="item-header">
                    <div class="item-title">${course.title}</div>
                    <div class="item-actions">
                        <button class="btn manage-content" data-course-id="${course.id}">Управлять содержимым</button>
                        <button class="btn btn-danger" onclick="deleteCourse(${course.id})">Удалить</button>
                    </div>
                </div>
                <p style="color: #b0b0b0; margin: 0.5rem 0;">${course.description || 'Описание отсутствует'}</p>
                <div style="color: #b0b0b0; font-size: 0.9rem; margin-top: 0.5rem;">
                    Создан: ${new Date(course.created_at).toLocaleDateString('ru-RU')}
                </div>
            </div>
        `).join('');

        // Добавить обработчики для кнопок редактирования и управления содержимым
        document.querySelectorAll('.manage-content').forEach(btn => {
            btn.addEventListener('click', () => {
                const courseId = btn.dataset.courseId;
                window.location.href = `course-editor.html?id=${courseId}`;
            });
        });


    } catch (error) {
        console.error('Ошибка загрузки курсов:', error);
        document.getElementById('courses-list').innerHTML = '<div class="empty-state">Ошибка загрузки курсов</div>';
    }
}

// Load users
async function loadUsers() {
    try {
        const response = await apiCall('/api/admin/users');
        const users = await response.json();
        
        const listEl = document.getElementById('users-list');
        
        if (users.length === 0) {
            listEl.innerHTML = '<div class="empty-state">Пользователи не найдены</div>';
            return;
        }

        listEl.innerHTML = users.map(user => `
            <div class="list-item">
                <div class="item-header">
                    <div class="item-title">${user.login}</div>
                    <div>
                        <span style="background: ${user.role === 'admin' ? 'linear-gradient(45deg, #ff6b6b, #ee5a52)' : 'linear-gradient(45deg, #2ed573, #1dd1a1)'}; 
                              color: white; padding: 0.4rem 0.8rem; border-radius: 20px; font-size: 0.8rem; font-weight: 500;">
                            ${user.role === 'admin' ? 'АДМИН' : 'СОТРУДНИК'}
                        </span>
                    </div>
                </div>
                <div style="color: #b0b0b0; font-size: 0.9rem; margin-top: 0.5rem;">
                    Участник с: ${new Date(user.created_at).toLocaleDateString('ru-RU')}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        document.getElementById('users-list').innerHTML = '<div class="empty-state">Ошибка загрузки пользователей</div>';
    }
}

// Open course modal
function openCourseModal(course = null) {
    const modal = document.getElementById('course-modal');
    const title = document.getElementById('modal-title');
    const form = document.getElementById('course-form');
    
    if (course) {
        title.textContent = 'Редактировать Курс';
        document.getElementById('course-id').value = course.id;
        document.getElementById('course-title').value = course.title;
        document.getElementById('course-description').value = course.description || '';
    } else {
        title.textContent = 'Добавить Новый Курс';
        form.reset();
        document.getElementById('course-id').value = '';
    }
    
    modal.style.display = 'block';
}

// Close course modal
function closeCourseModal() {
    document.getElementById('course-modal').style.display = 'none';
}

// Edit course - редирект на редактор вместо модального окна
async function editCourse(courseId) {
    window.location.href = `course-editor.html?id=${courseId}`;
}

// Delete course
async function deleteCourse(courseId) {
    if (!confirm('Вы уверены, что хотите удалить этот курс?')) {
        return;
    }

    try {
        const response = await apiCall(`/api/admin/courses/${courseId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('Курс удален успешно');
            loadCourses();
            loadAnalytics();
        }
    } catch (error) {
        console.error('Ошибка удаления курса:', error);
        alert('Ошибка удаления курса');
    }
}

// Content modal functions
function openContentModal(courseId) {
    const courseIdInput = document.getElementById('content-course-id');
    if (courseIdInput) courseIdInput.value = courseId;
    const modal = document.getElementById('content-modal');
    if (modal) modal.style.display = 'flex';
    const questionFormBlock = document.getElementById('question-form-block');
    if (questionFormBlock) questionFormBlock.style.display = 'none';
    loadCourseContent(courseId);
}

function closeContentModal() {
    const modal = document.getElementById('content-modal');
    if (modal) modal.style.display = 'none';
    const courseIdInput = document.getElementById('content-course-id');
    if (courseIdInput) courseIdInput.value = '';
    const theoryContent = document.getElementById('theory-content');
    if (theoryContent) theoryContent.value = '';
    const questionsContainer = document.getElementById('questions-container');
    if (questionsContainer) questionsContainer.innerHTML = '<div class="loading">Загрузка вопросов...</div>';
    const questionFormBlock = document.getElementById('question-form-block');
    if (questionFormBlock) questionFormBlock.style.display = 'none';
    const qsave = document.getElementById('q-save-btn');
    if (qsave) { qsave.dataset.action = ''; qsave.dataset.qid = ''; }
}


let currentLessonIndex = 0;
let cachedLessons = [];

async function loadCourseContent(courseId, lessonIndex = 0) {
    try {
        document.getElementById('content-course-id').value = courseId;
        document.getElementById('lesson-title').value = '';
        document.getElementById('theory-content').value = '';

        const response = await apiCall(`/api/admin/courses/${courseId}`);
        if (!response.ok) return;
        const data = await response.json();
        const lessons = data.lessons || [];
        cachedLessons = lessons;
        if (lessons.length === 0) {
            document.getElementById('lesson-title').value = '';
            document.getElementById('theory-content').value = '';
            const container = document.getElementById('questions-container');
            if (container) container.innerHTML = '<div class="empty-state">Нет уроков и вопросов</div>';
            currentLessonIndex = 0;
            return;
        }
        // Ограничить индекс
        if (lessonIndex < 0) lessonIndex = 0;
        if (lessonIndex >= lessons.length) lessonIndex = lessons.length - 1;
        currentLessonIndex = lessonIndex;
        const lesson = lessons[lessonIndex];
        document.getElementById('lesson-title').value = lesson.title;
        document.getElementById('theory-content').value = lesson.content;
        const container = document.getElementById('questions-container');
        if (container) {
            if (lesson.questions && lesson.questions.length > 0) {
                container.innerHTML = lesson.questions.map(q => `
                    <div class="question-card">
                        <p><strong>${q.question_text}</strong></p>
                        <p>Варианты: ${q.options.map(o => o.option_text).join(', ')}</p>
                        <div style="margin-top:0.5rem;">
                            <button class="btn btn-sm" onclick="editQuestion(${q.id}, ${courseId})">Редактировать</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteQuestion(${q.id})">Удалить</button>
                        </div>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<div class="empty-state">Нет вопросов для этого урока</div>';
            }
        }
        // Обновить видимость кнопки "следующий урок"
        const nextBtn = document.getElementById('next-lesson-btn');
        if (nextBtn) {
            nextBtn.style.display = (lessonIndex < lessons.length - 1) ? 'inline-block' : 'none';
        }
    } catch (error) {
        console.error('Ошибка загрузки содержимого курса:', error);
    }
}

function nextLesson() {
    const courseId = document.getElementById('content-course-id').value;
    if (!cachedLessons || cachedLessons.length === 0) return;
    if (currentLessonIndex < cachedLessons.length - 1) {
        loadCourseContent(courseId, currentLessonIndex + 1);
    }
}

async function saveTheory() {
    const courseId = document.getElementById('content-course-id').value;
    const lessonTitle = document.getElementById('lesson-title').value.trim();
    const content = document.getElementById('theory-content').value.trim();
    
    // Validation
    if (!lessonTitle) {
        alert('Пожалуйста, введите название урока');
        return;
    }
    
    if (!content) {
        alert('Пожалуйста, введите содержимое урока');
        return;
    }
    
    try {
        // Get next lesson order
        const getResponse = await apiCall(`/api/admin/courses/${courseId}`);
        const data = await getResponse.json();
        const lessons = data.lessons || [];
        const nextOrder = lessons.length + 1;
        
        // Create new lesson
        const response = await apiCall(`/api/admin/courses/${courseId}/lessons`, {
            method: 'POST',
            body: JSON.stringify({ 
                course_id: parseInt(courseId),
                title: lessonTitle,
                content: content,
                lesson_order: nextOrder
            })
        });
        
        if (response.ok) {
            alert('Урок создан успешно');
            document.getElementById('lesson-title').value = '';
            document.getElementById('theory-content').value = '';
        } else {
            alert('Ошибка создания урока');
        }
    } catch (error) {
        console.error('Ошибка создания урока:', error);
        alert('Ошибка: ' + error.message);
    }
}

function renderQuestions(questions) {
    // Removed question rendering logic
}

async function openNewQuestionForm() {
    // Removed new question form logic
}

function closeQuestionForm() {
    document.getElementById('question-form-block').style.display = 'none';
}

async function saveQuestion() {
    console.log('=== saveQuestion() вызвана ===');
    
    const action = document.getElementById('q-save-btn').dataset.action;
    const qid = document.getElementById('q-save-btn').dataset.qid;
    const courseId = document.getElementById('content-course-id').value;
    const qtext = document.getElementById('q-text').value;
    const explanation = document.getElementById('q-explanation').value;
    const optionsRaw = document.getElementById('q-options').value;
    const optionTexts = optionsRaw.split(',').map(s => s.trim()).filter(s => s.length);
    const correctIndex = parseInt(document.getElementById('q-correct').value) || 0;

    console.log('Полученные значения:', {
        action, qid, courseId, qtext, explanation, 
        optionsRaw, optionTexts, correctIndex
    });
    // lessonId больше не используется

    if (!qtext) {
        alert('Введите текст вопроса');
        console.error('Ошибка валидации: qtext пустой');
        return;
    }

    if (optionTexts.length === 0) {
        alert('Добавьте хотя бы один вариант');
        console.error('Ошибка валидации: нет опций');
        return;
    }

    const options = optionTexts.map((text, idx) => ({
        option_text: text,
        is_correct: idx === correctIndex,
        option_order: idx + 1
    }));

    console.log('Построенные опции:', options);

    try {
        if (action === 'create') {
            const payload = {
                question_text: qtext,
                explanation: explanation,
                question_order: 99,
                options: options
            };
            console.log('Отправляю payload (CREATE):', JSON.stringify(payload, null, 2));
            
            const resp = await apiCall(`/api/admin/courses/${courseId}/questions`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            
            if (resp.ok) {
                console.log('SUCCESS! Вопрос создан');
                closeQuestionForm();
                loadCourseContent(courseId);
            } else {
                const error = await resp.text();
                console.error('Ошибка от сервера:', error);
                alert('Ошибка: ' + error);
            }
        } else if (action === 'edit') {
            const payload = {
                question_text: qtext,
                explanation: explanation,
                question_order: 99,
                options: options
            };
            
            const resp = await apiCall(`/api/admin/courses/${courseId}/questions/${qid}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            
            if (resp.ok) {
                console.log('SUCCESS! Вопрос обновлён');
                closeQuestionForm();
                loadCourseContent(courseId);
            } else {
                const error = await resp.text();
                console.error('Ошибка от сервера:', error);
                alert('Ошибка: ' + error);
            }
        }
    } catch (error) {
        console.error('КРИТИЧЕСКАЯ ОШИБКА в saveQuestion():', error);
        alert('Критическая ошибка: ' + error.message);
    }
}

async function editQuestion(qid, courseId) {
    try {
        const resp = await apiCall(`/api/admin/courses/${courseId}`);
        if (!resp.ok) return;
        const data = await resp.json();
        const q = (data.questions || []).find(x => x.id === qid);
        if (!q) return;
        
        document.getElementById('question-form-title').textContent = 'Редактировать вопрос';
        document.getElementById('q-text').value = q.question_text;
        document.getElementById('q-explanation').value = q.explanation || '';
        document.getElementById('q-options').value = q.options.map(o => typeof o === 'string' ? o : o.text).join(', ');
        document.getElementById('q-correct').value = q.correct_index || 0;
        document.getElementById('q-save-btn').dataset.action = 'edit';
        document.getElementById('q-save-btn').dataset.qid = q.id;
        
        const lessonsResp = await apiCall(`/api/courses/${courseId}/lessons`);
        if (lessonsResp.ok) {
            const lessonsData = await lessonsResp.json();
            const lessonSelect = document.getElementById('q-lesson');
            lessonSelect.innerHTML = '<option value="">-- Выберите урок --</option>';
            if (lessonsData.lessons && lessonsData.lessons.length > 0) {
                lessonsData.lessons.forEach(lesson => {
                    const option = document.createElement('option');
                    option.value = lesson.id;
                    option.textContent = lesson.title;
                    lessonSelect.appendChild(option);
                });
            }
            if (q.lesson_id) {
                lessonSelect.value = q.lesson_id;
            }
        }
        
        document.getElementById('question-form-block').style.display = 'block';
    } catch (error) {
        console.error('Ошибка редактирования вопроса:', error);
    }
}

async function deleteQuestion(qid) {
    // Removed question deletion logic
}

// Task management
async function loadTasks() {
    try {
        const response = await apiCall('/api/admin/tasks');
        const tasks = await response.json();
        const container = document.getElementById('tasks-list');
        
        if (!tasks || tasks.length === 0) {
            container.innerHTML = '<div class="empty-state">Задачи отсутствуют</div>';
            return;
        }
        
        const languageNames = {
            54: 'C++',
            62: 'Java',
            71: 'Python',
            93: 'JavaScript',
            95: 'Go'
        };
        
        container.innerHTML = tasks.map(t => `
            <div class="list-item" id="task-${t.id}">
                <div class="item-header">
                    <div>
                        <div class="item-title">${t.title}</div>
                        <div style="color:#b0bec0; font-size:0.9rem; margin-top:0.3rem;">
                            Курс: <strong>${t.course_title || 'ID ' + t.course_id}</strong>
                        </div>
                        <div style="color:#b0bec0; font-size:0.9rem; margin-top:0.3rem;">
                            Язык: <strong>${languageNames[t.language_id] || 'Unknown'}</strong>
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="btn btn-sm" onclick="openTestModal(${t.id})">🧪 Тесты</button>
                        <button class="btn btn-edit" onclick="editTask(${t.id})">Редактировать</button>
                        <button class="btn btn-danger" onclick="deleteTask(${t.id})">Удалить</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Ошибка загрузки задач:', error);
        document.getElementById('tasks-list').innerHTML = '<div class="empty-state">Ошибка загрузки задач</div>';
    }
}

function openTaskModal(task = null) {
    const modal = document.getElementById('task-modal');
    if (!modal) {
        console.error('task-modal не найден');
        return;
    }
    modal.style.display = 'flex';
    
    // populate course dropdown
    const courseSelect = document.getElementById('task-course');
    courseSelect.innerHTML = '<option value="">-- Выберите курс --</option>';
    try {
        apiCall('/api/admin/courses').then(r => r.json()).then(courses => {
            courses.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.title;
                courseSelect.appendChild(opt);
            });
            if (task && task.course_id) {
                courseSelect.value = task.course_id;
            }
        });
    } catch (e) {
        console.error('Ошибка загрузки курсов для задачи:', e);
    }

    if (task) {
        document.getElementById('task-title').value = task.title || '';
        document.getElementById('task-description').value = task.description || '';
        document.getElementById('task-language').value = task.language_id || '';
        document.getElementById('task-modal-title').textContent = 'Редактировать Задачу';
        document.getElementById('task-id').value = task.id || '';
    } else {
        document.getElementById('task-form').reset();
        document.getElementById('task-modal-title').textContent = 'Добавить Новую Задачу';
        document.getElementById('task-id').value = '';
    }
}

function closeTaskModal() {
    const modal = document.getElementById('task-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function onTestCheckTypeChange(value) {
    const outputBlock = document.getElementById('test-output-block');
    const codeBlock = document.getElementById('test-code-block');
    if (value === 'code_test') {
        outputBlock.style.display = 'none';
        codeBlock.style.display = 'block';
    } else {
        outputBlock.style.display = 'block';
        codeBlock.style.display = 'none';
    }
}

function openTestModal(taskId) {
    const modal = document.getElementById('test-modal');
    if (!modal) return;
    document.getElementById('test-task-id').value = taskId;
    document.getElementById('test-input').value = '';
    document.getElementById('test-output').value = '';
    document.getElementById('test-code').value = '';
    document.querySelector('input[name="test-check-type"][value="output"]').checked = true;
    onTestCheckTypeChange('output');
    modal.style.display = 'flex';
}

function closeTestModal() {
    const modal = document.getElementById('test-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function saveTestCase() {
    const taskId = parseInt(document.getElementById('test-task-id').value);
    if (!taskId || taskId <= 0) {
        alert('Неверный task_id для теста');
        return;
    }

    const input = document.getElementById('test-input').value;
    const expectedOutput = document.getElementById('test-output').value;
    const testCode = document.getElementById('test-code').value;
    const checkType = document.querySelector('input[name="test-check-type"]:checked').value;

    if (checkType === 'output' && !expectedOutput.trim()) {
        alert('Для проверки по выводу укажите ожидаемый вывод.');
        return;
    }
    if (checkType === 'code_test' && !testCode.trim()) {
        alert('Для проверки по коду укажите test_code.');
        return;
    }

    try {
        const response = await apiCall(`/api/admin/tasks/${taskId}/test-cases`, {
            method: 'POST',
            body: JSON.stringify({
                task_id: taskId,
                input: input || '',
                expected_output: expectedOutput || '',
                test_code: testCode || '',
                check_type: checkType
            })
        });

        if (response.ok) {
            alert('Тест сохранен');
            closeTestModal();
        } else {
            const err = await response.text();
            alert('Ошибка сохранения теста: ' + err);
        }
    } catch (error) {
        console.error('Ошибка при сохранении теста:', error);
        alert('Ошибка сети: ' + error.message);
    }
}

async function saveTask() {
    const taskId = document.getElementById('task-id').value;
    const courseId = parseInt(document.getElementById('task-course').value);
    const title = document.getElementById('task-title').value;
    const description = document.getElementById('task-description').value;
    const languageId = parseInt(document.getElementById('task-language').value);
    
    if (!courseId || courseId <= 0) {
        alert('Выберите курс');
        return;
    }
    if (!title) {
        alert('Введите название задачи');
        return;
    }
    
    if (!languageId || languageId <= 0) {
        alert('Выберите язык программирования');
        return;
    }
    
    try {
        const payload = { course_id: courseId, title, description, language_id: languageId };
        let url = '/api/admin/tasks';
        let method = 'POST';
        if (taskId) {
            url = `/api/admin/tasks/${taskId}`;
            method = 'PUT';
        }
        const resp = await apiCall(url, {
            method: method,
            body: JSON.stringify(payload)
        });
        
        if (resp.ok) {
            closeTaskModal();
            loadTasks();
            alert('Задача сохранена');
        } else {
            const error = await resp.text();
            alert('Ошибка: ' + error);
        }
    } catch (error) {
        console.error('Ошибка при сохранении задачи:', error);
        alert('Ошибка сети: ' + error.message);
    }
}

async function editTask(taskId) {
    try {
        const resp = await apiCall(`/api/admin/tasks/${taskId}`);
        if (resp.ok) {
            const task = await resp.json();
            openTaskModal(task);
        }
    } catch (error) {
        console.error('Ошибка загрузки задачи:', error);
    }
}

async function deleteTask(taskId) {
    if (!confirm('Вы уверены, что хотите удалить эту задачу?')) {
        return;
    }
    
    try {
        const resp = await apiCall(`/api/admin/tasks/${taskId}`, {
            method: 'DELETE'
        });
        
        if (resp.ok) {
            loadTasks();
            alert('Задача удалена');
        } else {
            alert('Ошибка удаления задачи');
        }
    } catch (error) {
        console.error('Ошибка удаления задачи:', error);
        alert('Ошибка сети');
    }
}

// Event listeners
document.getElementById('course-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const courseId = document.getElementById('course-id').value;
    const title = document.getElementById('course-title').value;
    const description = document.getElementById('course-description').value;
    
    const url = courseId ? `/api/admin/courses/${courseId}` : '/api/admin/courses';
    const method = courseId ? 'PUT' : 'POST';
    
    try {
        const response = await apiCall(url, {
            method: method,
            body: JSON.stringify({ title, description })
        });

        if (response.ok) {
            const data = await response.json();
            const newCourseId = courseId || data.id || data.course_id;
            alert(courseId ? 'Курс обновлен успешно' : 'Курс создан успешно');
            closeCourseModal();
            // Перенаправить на редактор курса
            window.location.href = `course-editor.html?id=${newCourseId}`;
        }
    } catch (error) {
        console.error('Ошибка сохранения курса:', error);
        alert('Ошибка сохранения курса');
    }
});

document.getElementById('task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    saveTask();
});

window.onclick = function(event) {
    const courseModal = document.getElementById('course-modal');
    if (event.target === courseModal) {
        closeCourseModal();
    }
    const taskModal = document.getElementById('task-modal');
    if (event.target === taskModal) {
        closeTaskModal();
    }
}

document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    const contentModal = document.getElementById('content-modal');
    if (contentModal && contentModal.style.display !== 'none') {
        closeContentModal();
    }
    const taskModal = document.getElementById('task-modal');
    if (taskModal && taskModal.style.display !== 'none') {
        closeTaskModal();
    }
});



// ===== TAB SWITCHING =====
function switchTab(tabName) {
    // Hide all tabs
    document.getElementById('courses-tab').style.display = 'none';
    document.getElementById('tasks-tab').style.display = 'none';
    
    // Remove active class from all buttons
    document.getElementById('tab-courses').style.color = '#aaa';
    document.getElementById('tab-courses').style.borderBottom = '3px solid transparent';
    document.getElementById('tab-tasks').style.color = '#aaa';
    document.getElementById('tab-tasks').style.borderBottom = '3px solid transparent';
    
    // Show selected tab
    document.getElementById(tabName + '-tab').style.display = 'block';
    
    // Highlight active tab button
    document.getElementById('tab-' + tabName).style.color = '#fff';
    document.getElementById('tab-' + tabName).style.borderBottom = '3px solid #00d4ff';
}

// Initialize
loadAnalytics();
loadCourses();
loadUsers();
loadTasks();
