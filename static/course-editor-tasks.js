// Функции управления программными задачами в курсе

// Добавить новую задачу
function addNewTask() {
    if (!currentCourseId) {
        showToast('Сначала сохраните курс', 'error');
        return;
    }

    // Скрыть пустое состояние и показать редактор задач
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('task-editor').style.display = 'block';

    // Очистить поля
    currentTask = null;
    currentTaskId = null;
    currentTestCases = [];

    document.getElementById('task-title').value = '';
    document.getElementById('task-description').value = '';
    document.getElementById('task-language').value = '';

    // Отрендерить пустой список тест-кейсов
    renderTestCasesList();

    // Обновить список задач
    renderTasksList();

    showToast('Создание новой задачи', 'info');
}

// Выбрать задачу для редактирования
function selectTask(event, taskId) {
    const task = tasksData.find(t => t.id === taskId);
    if (!task) return;

    currentTaskId = taskId;
    currentTask = task;

    // Обновить активный класс в списке задач
    document.querySelectorAll('#tasks-list .lesson-item').forEach(item => {
        item.classList.remove('active');
    });
    if (event && event.target) {
        const parent = event.target.closest('.lesson-item');
        if (parent) parent.classList.add('active');
    }

    // Скрыть пустое состояние и показать редактор задач
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('task-editor').style.display = 'block';

    // Заполнить поля редактора
    document.getElementById('task-title').value = task.title || '';
    document.getElementById('task-description').value = task.description || '';
    document.getElementById('task-language').value = task.language_id || '';

    // Загрузить тест-кейсы для этой задачи
    loadTestCases(taskId);

    // Закрыть форму добавления тест-кейса если она открыта
    document.getElementById('testcase-form').style.display = 'none';
}

// Сохранить задачу
async function saveTask() {
    if (!currentCourseId) {
        showToast('Ошибка: нет ID курса', 'error');
        return;
    }

    const title = document.getElementById('task-title').value.trim();
    const description = document.getElementById('task-description').value.trim();
    const languageId = parseInt(document.getElementById('task-language').value);

    if (!title) {
        showToast('Введите название задачи', 'error');
        return;
    }

    if (!languageId) {
        showToast('Выберите язык программирования', 'error');
        return;
    }

    try {
        const token = localStorage.getItem('token');

        if (currentTaskId) {
            // Обновить существующую задачу
            const response = await fetch(`/api/admin/tasks/${currentTaskId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    course_id: currentCourseId,
                    title: title,
                    description: description,
                    language_id: languageId
                })
            });

            if (!response.ok) {
                throw new Error('Ошибка при обновлении задачи');
            }

            currentTask.title = title;
            currentTask.description = description;
            currentTask.language_id = languageId;
        } else {
            // Создать новую задачу
            const response = await fetch(`/api/admin/tasks`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    course_id: currentCourseId,
                    title: title,
                    description: description,
                    language_id: languageId
                })
            });

            if (!response.ok) {
                throw new Error('Ошибка при создании задачи');
            }

            const data = await response.json();
            currentTaskId = data.id;
            currentTask = {
                id: currentTaskId,
                course_id: currentCourseId,
                title: title,
                description: description,
                language_id: languageId,
                course_title: document.getElementById('course-title').value
            };
            tasksData.push(currentTask);
        }

        await loadTasks();
        showToast('Задача успешно сохранена', 'success');
    } catch (error) {
        console.error('Ошибка сохранения задачи:', error);
        showToast('Ошибка: ' + error.message, 'error');
    }
}

// Загрузить тест-кейсы для задачи
async function loadTestCases(taskId) {
    try {
        const token = localStorage.getItem('token');
        // Тест-кейсы хранятся в базе но нет отдельного endpoint для их чтения
        // Поэтому сбросим масив при загрузке
        currentTestCases = [];
        renderTestCasesList();
    } catch (error) {
        console.error('Ошибка загрузки тест-кейсов:', error);
    }
}

// Отрендерить список тест-кейсов
function renderTestCasesList() {
    const testcasesList = document.getElementById('testcases-list');

    if (!currentTestCases || currentTestCases.length === 0) {
        testcasesList.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Тест-кейсов нет</div>';
        return;
    }

    const html = currentTestCases.map((testcase, index) => {
        const checkTypeLabel = testcase.check_type === 'code_test' ? '🔍 Код' : '📤 Вывод';
        return `
            <div class="question-item">
                <div class="question-item-text">
                    TC${index + 1}: ${checkTypeLabel}
                </div>
                ${testcase.input ? `
                    <div class="question-item-options">
                        <strong>Ввод:</strong> ${escapeHTML(testcase.input.substring(0, 100))}${testcase.input.length > 100 ? '...' : ''}
                    </div>
                ` : ''}
                ${testcase.check_type === 'output' && testcase.expected_output ? `
                    <div class="question-item-options">
                        <strong>Вывод:</strong> ${escapeHTML(testcase.expected_output.substring(0, 100))}${testcase.expected_output.length > 100 ? '...' : ''}
                    </div>
                ` : ''}
                ${testcase.check_type === 'code_test' && testcase.test_code ? `
                    <div class="question-item-options">
                        <strong>Код:</strong> ${escapeHTML(testcase.test_code.substring(0, 100))}${testcase.test_code.length > 100 ? '...' : ''}
                    </div>
                ` : ''}
                <div class="question-item-footer">
                    <button class="question-item-btn" onclick="deleteTestCase(${index})">
                        🗑️ Удалить
                    </button>
                </div>
            </div>
        `;
    }).join('');

    testcasesList.innerHTML = html;
}

// Показать/скрыть форму добавления тест-кейса
function toggleTestCaseForm() {
    const form = document.getElementById('testcase-form');
    if (form.style.display === 'none') {
        form.style.display = 'block';
        // Очистить поля
        document.getElementById('testcase-input').value = '';
        document.getElementById('testcase-output').value = '';
        document.getElementById('testcase-code').value = '';
        document.querySelector('input[name="test-check-type"][value="output"]').checked = true;
        onTestCheckTypeChange('output');
    } else {
        form.style.display = 'none';
    }
}

// Переключить видимость полей при изменении типа проверки
function onTestCheckTypeChange(value) {
    const outputBlock = document.getElementById('testcase-output-block');
    const codeBlock = document.getElementById('testcase-code-block');
    if (value === 'code_test') {
        outputBlock.style.display = 'none';
        codeBlock.style.display = 'block';
    } else {
        outputBlock.style.display = 'block';
        codeBlock.style.display = 'none';
    }
}

// Сохранить новый тест-кейс
async function saveNewTestCase() {
    if (!currentTaskId) {
        showToast('Сначала сохраните задачу', 'error');
        return;
    }

    const input = document.getElementById('testcase-input').value;
    const expectedOutput = document.getElementById('testcase-output').value;
    const testCode = document.getElementById('testcase-code').value;
    const checkType = document.querySelector('input[name="test-check-type"]:checked').value;

    if (checkType === 'output' && !expectedOutput.trim()) {
        showToast('Для проверки по выводу укажите ожидаемый вывод', 'error');
        return;
    }

    if (checkType === 'code_test' && !testCode.trim()) {
        showToast('Для проверки по коду укажите test_code', 'error');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/tasks/${currentTaskId}/test-cases`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                task_id: currentTaskId,
                input: input || '',
                expected_output: expectedOutput || '',
                test_code: testCode || '',
                check_type: checkType
            })
        });

        if (!response.ok) {
            throw new Error('Ошибка при сохранении тест-кейса');
        }

        // Добавить локально
        currentTestCases.push({
            input: input,
            expected_output: expectedOutput,
            test_code: testCode,
            check_type: checkType
        });

        // Очистить форму и обновить список
        toggleTestCaseForm();
        renderTestCasesList();

        showToast('Тест-кейс успешно добавлен', 'success');
    } catch (error) {
        console.error('Ошибка сохранения тест-кейса:', error);
        showToast('Ошибка: ' + error.message, 'error');
    }
}

// Удалить тест-кейс
function deleteTestCase(index) {
    if (!confirm('Вы уверены, что хотите удалить этот тест-кейс?')) {
        return;
    }

    currentTestCases.splice(index, 1);
    renderTestCasesList();
    showToast('Тест-кейс удален (локально)', 'info');
}

// Удалить задачу
async function deleteTask(taskId) {
    if (!confirm('Вы уверены, что хотите удалить эту задачу?')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/tasks/${taskId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка при удалении задачи');
        }

        tasksData = tasksData.filter(t => t.id !== taskId);
        currentTaskId = null;
        currentTask = null;
        currentTestCases = [];

        renderTasksList();
        document.getElementById('empty-state').style.display = 'block';
        document.getElementById('task-editor').style.display = 'none';

        showToast('Задача успешно удалена', 'success');
    } catch (error) {
        console.error('Ошибка удаления задачи:', error);
        showToast('Ошибка: ' + error.message, 'error');
    }
}

// ===== КОМПИЛЯЦИЯ И ТЕСТИРОВАНИЕ КОДА =====

// Запустить код в компиляторе
async function runCompilerCode() {
    if (!currentTask) {
        showToast('Сначала выберите задачу', 'error');
        return;
    }

    const code = document.getElementById('compiler-code').value.trim();
    if (!code) {
        showToast('Напишите код для тестирования', 'error');
        return;
    }

    const languageId = currentTask.language_id;
    if (!languageId) {
        showToast('Язык задачи не установлен', 'error');
        return;
    }

    // Показать окно вывода
    const outputDiv = document.getElementById('compiler-output');
    const statusDiv = document.getElementById('compiler-status');
    const outputText = document.getElementById('compiler-output-text');

    outputDiv.style.display = 'block';
    statusDiv.textContent = '⏳ Компилирование и запуск...';
    statusDiv.className = 'status';
    outputText.textContent = '';

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/compile', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: code,
                language_id: languageId
            })
        });

        const result = await response.json();

        // Обновить статус и вывод
        if (result.success) {
            statusDiv.textContent = '✅ Успешно';
            statusDiv.className = 'status success';
            outputText.textContent = result.output || '(нет вывода)';
        } else {
            statusDiv.textContent = '❌ Ошибка';
            statusDiv.className = 'status error';
            outputText.textContent = result.output || 'Unknown error';
        }
    } catch (error) {
        console.error('Ошибка компиляции:', error);
        statusDiv.textContent = '❌ Ошибка выполнения';
        statusDiv.className = 'status error';
        outputText.textContent = error.message;
    }
}

// Очистить поле кода и результаты
function clearCompilerCode() {
    document.getElementById('compiler-code').value = '';
    document.getElementById('compiler-output').style.display = 'none';
    document.getElementById('compiler-output-text').textContent = '';
}
