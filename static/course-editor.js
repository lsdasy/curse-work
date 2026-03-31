// Переменные состояния редактора
let currentCourseId = null;
let currentCourse = null;
let currentLesson = null;
let currentLessonIndex = null;
let currentTask = null;
let currentTaskId = null;
let tasksData = [];
let currentTestCases = [];

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    // Получить id курса из URL
    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('id');

    if (courseId === 'new') {
        // Новый курс
        showEmptyState();
    } else if (courseId) {
        // Загрузить существующий курс
        currentCourseId = parseInt(courseId);
        await loadCourse();
    } else {
        // Ошибка: нет id
        showToast('Ошибка: не указан ID курса', 'error');
        setTimeout(() => goBackToAdmin(), 2000);
    }
});

// Загрузить данные курса с сервера
async function loadCourse() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/courses/${currentCourseId}/lessons`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка загрузки курса');
        }

        const data = await response.json();
        currentCourse = {
            id: currentCourseId,
            title: data.courseTitle || '',
            description: '',
            lessons: data.lessons || []
        };

        // Заполнить поля формы курса
        document.getElementById('course-title').value = currentCourse.title;
        document.getElementById('course-description').value = currentCourse.description;

        // Загрузить уроки и отрендерить список
        loadLessons();
        
        // Загрузить задачи курса
        await loadTasks();
    } catch (error) {
        console.error('Ошибка загрузки курса:', error);
        showToast('Ошибка загрузки курса: ' + error.message, 'error');
    }
}

// Загрузить задачи курса
async function loadTasks() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/tasks`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка загрузки задач');
        }

        const allTasks = await response.json();
        tasksData = allTasks.filter(t => t.course_id === currentCourseId) || [];
        renderTasksList();
    } catch (error) {
        console.error('Ошибка загрузки задач:', error);
    }
}

// Отрендерить список задач
function renderTasksList() {
    const tasksList = document.getElementById('tasks-list');

    if (!tasksData || tasksData.length === 0) {
        tasksList.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Задач нет</div>';
        return;
    }

    const languageNames = {
        54: 'C++',
        71: 'Python',
        63: 'JavaScript',
        60: 'Go'
    };

    const html = tasksData.map(task => `
        <div class="lesson-item ${currentTaskId === task.id ? 'active' : ''}" onclick="selectTask(event, ${task.id})">
            <strong>${languageNames[task.language_id] || 'Lang'}</strong> - ${escapeHTML(task.title)}
        </div>
    `).join('');

    tasksList.innerHTML = html;
}

// Загрузить и отрендерить список уроков
function loadLessons() {
    const lessonsList = document.getElementById('lessons-list');

    if (!currentCourse || !currentCourse.lessons || currentCourse.lessons.length === 0) {
        lessonsList.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Уроков нет</div>';
        return;
    }

    const html = currentCourse.lessons.map((lesson, index) => {
        const lessonTitle = lesson && lesson.title ? lesson.title : `Урок ${index + 1}`;
        return `
            <div class="lesson-item ${currentLessonIndex === index ? 'active' : ''}" onclick="selectLesson(${index})">
                <strong>${index + 1}.</strong> ${escapeHTML(lessonTitle)}
            </div>
        `;
    }).join('');

    lessonsList.innerHTML = html;
}

// Выбрать урок для редактирования
function selectLesson(index) {
    if (!currentCourse || !currentCourse.lessons[index]) {
        return;
    }

    currentLessonIndex = index;
    currentLesson = currentCourse.lessons[index];

    // Обновить активный класс в списке
    document.querySelectorAll('.lesson-item').forEach((item, i) => {
        if (i === index) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Скрыть пустое состояние и показать редактор
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('lesson-editor').style.display = 'block';

    // Заполнить поля редактора
    document.getElementById('lesson-title').value = currentLesson.title || '';
    document.getElementById('lesson-content').value = currentLesson.content || '';

    // Загрузить и отрендерить вопросы
    renderQuestions();

    // Закрыть форму добавления вопроса если она открыта
    document.getElementById('question-form').style.display = 'none';
}

// Отрендерить список вопросов
function renderQuestions() {
    const questionsList = document.getElementById('questions-list');

    if (!currentLesson || !currentLesson.questions || currentLesson.questions.length === 0) {
        questionsList.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Вопросов нет</div>';
        return;
    }

    const html = currentLesson.questions.map((question, qIndex) => {
        const correctOption = question.options ? question.options.find(o => o.is_correct) : null;
        
        return `
            <div class="question-item">
                <div class="question-item-text">
                    Q${qIndex + 1}: ${escapeHTML(question.question_text || 'Без вопроса')}
                </div>
                <div class="question-item-options">
                    ${(question.options || []).map((opt, oIdx) => `
                        <div class="question-item-option ${opt.is_correct ? 'correct' : ''}">
                            ${String.fromCharCode(65 + oIdx)}. ${escapeHTML(opt.option_text)}
                            ${opt.is_correct ? ' ✓' : ''}
                        </div>
                    `).join('')}
                </div>
                ${question.explanation ? `
                    <div style="margin-top: 0.5rem; padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 4px; font-size: 12px; color: var(--text-muted);">
                        <strong>Объяснение:</strong> ${escapeHTML(question.explanation)}
                    </div>
                ` : ''}
                <div class="question-item-footer">
                    <button class="question-item-btn" onclick="deleteQuestion(${qIndex})">
                        🗑️ Удалить
                    </button>
                </div>
            </div>
        `;
    }).join('');

    questionsList.innerHTML = html;
}

// Показать/скрыть форму добавления вопроса
function toggleQuestionForm() {
    const form = document.getElementById('question-form');
    if (form.style.display === 'none') {
        form.style.display = 'block';
        // Очистить поля
        document.getElementById('question-text').value = '';
        document.getElementById('option-a').value = '';
        document.getElementById('option-b').value = '';
        document.getElementById('option-c').value = '';
        document.getElementById('option-d').value = '';
        document.querySelector('input[name="correct-option"]').checked = false;
        document.getElementById('question-explanation').value = '';
    } else {
        form.style.display = 'none';
    }
}

// Сохранить курс
async function saveCourse() {
    if (!currentCourseId) {
        // Это новый курс
        await createNewCourse();
    } else {
        // Это обновление существующего курса
        await updateCourse();
    }
}

// Создать новый курс
async function createNewCourse() {
    const title = document.getElementById('course-title').value.trim();
    const description = document.getElementById('course-description').value.trim();

    if (!title) {
        showToast('Введите название курса', 'error');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/courses', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title,
                description: description
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Ошибка при создании курса');
        }

        const data = await response.json();
        currentCourseId = data.id || data.course_id;
        currentCourse = {
            id: currentCourseId,
            title: title,
            description: description,
            lessons: []
        };

        showToast('Курс успешно создан', 'success');

        // Обновить URL без перезагрузки
        window.history.replaceState({}, '', `course-editor.html?id=${currentCourseId}`);

        // Обновить список уроков
        loadLessons();
    } catch (error) {
        console.error('Ошибка создания курса:', error);
        showToast('Ошибка: ' + error.message, 'error');
    }
}

// Обновить курс
async function updateCourse() {
    const title = document.getElementById('course-title').value.trim();
    const description = document.getElementById('course-description').value.trim();

    if (!title) {
        showToast('Введите название курса', 'error');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/courses/${currentCourseId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title,
                description: description
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Ошибка при обновлении курса');
        }

        currentCourse.title = title;
        currentCourse.description = description;

        showToast('Курс успешно сохранен', 'success');
    } catch (error) {
        console.error('Ошибка обновления курса:', error);
        showToast('Ошибка: ' + error.message, 'error');
    }
}

// Добавить новый урок
function addNewLesson() {
    if (!currentCourseId) {
        showToast('Сначала сохраните курс', 'error');
        return;
    }

    // Создать объект нового урока
    const newLesson = {
        title: '',
        content: '',
        lesson_order: (currentCourse.lessons ? currentCourse.lessons.length + 1 : 1),
        questions: []
    };

    currentCourse.lessons.push(newLesson);
    currentLessonIndex = currentCourse.lessons.length - 1;
    currentLesson = newLesson;

    // Обновить список уроков
    loadLessons();

    // Показать новый урок в редакторе
    selectLesson(currentLessonIndex);

    // Автофокус на название урока
    document.getElementById('lesson-title').focus();
    showToast('Новый урок создан. Заполните данные и сохраните.', 'info');
}

// Сохранить урок
async function saveLesson() {
    if (!currentLesson) {
        showToast('Выберите урок', 'error');
        return;
    }

    const title = document.getElementById('lesson-title').value.trim();
    const content = document.getElementById('lesson-content').value.trim();

    if (!title) {
        showToast('Введите название урока', 'error');
        return;
    }

    try {
        const token = localStorage.getItem('token');

        // Если у урока есть id, это обновление, иначе создание
        if (currentLesson.id) {
            // Обновить существующий урок
            const updateData = {
                title: title,
                content: content,
                lesson_order: currentLesson.lesson_order || (currentLessonIndex + 1)
            };
            console.log('Обновление урока:', updateData);
            
            const response = await fetch(`/api/admin/courses/${currentCourseId}/lessons/${currentLesson.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Ошибка при сохранении урока: ${response.status}`);
            }
        } else {
            // Создать новый урок
            if (!currentCourseId) {
                showToast('Сначала сохраните курс', 'error');
                return;
            }

            const createData = {
                course_id: currentCourseId,
                title: title,
                content: content,
                lesson_order: currentLesson.lesson_order || (currentLessonIndex + 1)
            };
            console.log('Создание урока для курса', currentCourseId, ':', createData);
            
            const response = await fetch(`/api/admin/courses/${currentCourseId}/lessons`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(createData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Ошибка ответа:', errorText);
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Ошибка при создании урока: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            currentLesson.id = data.id || data.lesson_id;
            console.log('Урок создан с ID:', currentLesson.id);
        }

        // Обновить текущий урок
        currentLesson.title = title;
        currentLesson.content = content;

        // Обновить список уроков в левой панели
        loadLessons();

        showToast('Урок успешно сохранен', 'success');
    } catch (error) {
        console.error('Ошибка сохранения урока:', error);
        showToast('Ошибка: ' + error.message, 'error');
    }
}

// Сохранить новый вопрос
async function saveNewQuestion() {
    if (!currentLesson) {
        showToast('Выберите урок', 'error');
        return;
    }

    if (!currentLesson.id) {
        showToast('Сначала сохраните урок', 'error');
        return;
    }

    const questionText = document.getElementById('question-text').value.trim();
    const correctOption = document.querySelector('input[name="correct-option"]:checked')?.value;
    const explanation = document.getElementById('question-explanation').value.trim();

    if (!questionText) {
        showToast('Введите текст вопроса', 'error');
        return;
    }

    if (!correctOption) {
        showToast('Выберите правильный вариант ответа', 'error');
        return;
    }

    // Собрать варианты ответов
    const optionA = document.getElementById('option-a').value.trim();
    const optionB = document.getElementById('option-b').value.trim();
    const optionC = document.getElementById('option-c').value.trim();
    const optionD = document.getElementById('option-d').value.trim();

    if (!optionA || !optionB || !optionC || !optionD) {
        showToast('Заполните все варианты ответа', 'error');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const correctNum = parseInt(correctOption);

        // Создать объект вопроса с опциями
        const questionData = {
            course_id: currentCourseId,
            question_text: questionText,
            explanation: explanation || '',
            question_order: (currentLesson.questions ? currentLesson.questions.length + 1 : 1),
            options: [
                { option_text: optionA, is_correct: correctNum === 1, option_order: 1 },
                { option_text: optionB, is_correct: correctNum === 2, option_order: 2 },
                { option_text: optionC, is_correct: correctNum === 3, option_order: 3 },
                { option_text: optionD, is_correct: correctNum === 4, option_order: 4 }
            ]
        };

        const response = await fetch(`/api/admin/courses/${currentCourseId}/questions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(questionData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Ошибка создания вопроса:', errorText);
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Ошибка при создании вопроса: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        // Добавить вопрос в текущий урок
        if (!currentLesson.questions) {
            currentLesson.questions = [];
        }
        currentLesson.questions.push(questionData);

        // Очистить форму и скрыть её
        toggleQuestionForm();

        // Обновить список вопросов
        renderQuestions();

        showToast('Вопрос успешно добавлен', 'success');
    } catch (error) {
        console.error('Ошибка создания вопроса:', error);
        showToast('Ошибка: ' + error.message, 'error');
    }
}

// Удалить вопрос
async function deleteQuestion(index) {
    if (!currentLesson || !currentLesson.questions || !currentLesson.questions[index]) {
        showToast('Ошибка: вопрос не найден', 'error');
        return;
    }

    const question = currentLesson.questions[index];

    // Если вопрос уже сохранен на сервер и имеет id, удалить через API
    if (question.id) {
        if (!confirm('Вы уверены, что хотите удалить этот вопрос?')) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/admin/courses/${currentCourseId}/questions/${question.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Ошибка при удалении вопроса');
            }
        } catch (error) {
            console.error('Ошибка удаления вопроса:', error);
            showToast('Ошибка: ' + error.message, 'error');
            return;
        }
    }

    // Удалить из локального массива
    currentLesson.questions.splice(index, 1);

    // Обновить отображение
    renderQuestions();

    showToast('Вопрос удален', 'success');
}

// Показать пустое состояние
function showEmptyState() {
    document.getElementById('empty-state').style.display = 'flex';
    document.getElementById('lesson-editor').style.display = 'none';
    document.querySelectorAll('.lesson-item').forEach(item => item.classList.remove('active'));
}

// Показать уведомление (Toast)
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Перейти обратно в админ-панель
function goBackToAdmin() {
    window.location.href = 'admin.html';
}

// Экранировать HTML символы
function escapeHTML(str) {
    if (!str) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return str.replace(/[&<>"']/g, m => map[m]);
}
