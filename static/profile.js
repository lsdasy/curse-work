// Authentication check
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || !user) {
    window.location.href = '/';
}

document.getElementById('user-role').textContent = user.role === 'admin' ? 'Администратор' : 'Сотрудник';

// API base URL
const API_BASE = '/api';

// Chart instance
let progressChart = null;

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

// Load profile data and create progress chart
async function loadProfileData() {
    try {
        // Получить все доступные курсы
        const coursesResponse = await apiCall(`${API_BASE}/courses`);
        const allCourses = await coursesResponse.json();

        // Получить пройденные курсы
        const response = await apiCall(`${API_BASE}/course-results`);
        const completedCourses = await response.json();

        const totalCourses = allCourses.length || 1; // Избегаем деления на 0
        const completedCount = completedCourses.length;

        // Create progress chart
        const ctx = document.getElementById('progressChart');
        if (ctx && !progressChart) {
            progressChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Пройдено', 'Осталось'],
                    datasets: [{
                        data: [
                            completedCount,
                            Math.max(0, totalCourses - completedCount)
                        ],
                        backgroundColor: ['#7c3aed', '#e5e7eb'],
                        borderColor: ['#7c3aed', '#e5e7eb']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }

        // Update performance summary
        const summaryEl = document.getElementById('performance-summary');
        const completionRate = completedCount > 0 ? 
            Math.round((completedCount / totalCourses) * 100) : 0;

        summaryEl.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div style="background: rgba(124, 58, 237, 0.1); padding: 15px; border-radius: 8px; border-left: 4px solid #7c3aed;">
                    <div style="font-size: 12px; color: #8b5cf6; font-weight: 600; text-transform: uppercase;">Курсов завершено</div>
                    <div style="font-size: 24px; font-weight: bold; color: #7c3aed; margin-top: 5px;">${completedCount} / ${totalCourses}</div>
                </div>
                <div style="background: rgba(20, 184, 166, 0.1); padding: 15px; border-radius: 8px; border-left: 4px solid #14b8a6;">
                    <div style="font-size: 12px; color: #0d9488; font-weight: 600; text-transform: uppercase;">Прогресс</div>
                    <div style="font-size: 24px; font-weight: bold; color: #14b8a6; margin-top: 5px;">${completionRate}%</div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        document.getElementById('performance-summary').innerHTML = 
            '<div style="color: #ef4444;">Ошибка загрузки данных</div>';
    }
}

// Load available courses
async function loadCourses() {
    try {
        // Получить все доступные курсы
        const coursesResponse = await apiCall(`${API_BASE}/courses`);
        const allCourses = await coursesResponse.json();

        // Получить пройденные курсы
        const resultsResponse = await apiCall(`${API_BASE}/course-results`);
        const results = await resultsResponse.json();
        
        // Создать список ID пройденных курсов
        const completedCourseIds = new Set(results.map(r => r.course_id));

        // Отфильтровать только доступные (не пройденные) курсы
        const availableCourses = allCourses.filter(course => !completedCourseIds.has(course.id));

        const listEl = document.getElementById('courses-list');

        if (availableCourses.length === 0) {
            listEl.innerHTML = '<div class="empty-state">Вы прошли все доступные курсы!</div>';
            return;
        }

        listEl.innerHTML = availableCourses.map(course => `
            <div class="course-item available">
                <div>
                    <div class="course-title">${escapeHTML(course.title)}</div>
                    <p style="color: var(--text-subtle); margin: 0.5rem 0; font-size: 0.95rem; line-height: 1.5;">
                        ${escapeHTML((course.description || 'Описание отсутствует').substring(0, 150))}
                    </p>
                </div>
                <button class="course-btn" onclick="openCourse(${course.id})" style="width: 100%; padding: 0.8rem; background: linear-gradient(135deg, #22c55e 0%, #10b981 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">
                    Начать обучение →
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Ошибка загрузки курсов:', error);
        document.getElementById('courses-list').innerHTML = 
            '<div class="empty-state">Ошибка загрузки курсов</div>';
    }
}

// Navigation to course viewing page
function openCourse(courseId) {
    window.location.href = `/course.html?id=${courseId}`;
}

// Load questions for students
async function loadQuestionsForStudent() {
    try {
        const response = await apiCall(`${API_BASE}/questions`);
        const questions = await response.json();
        const listEl = document.getElementById('questions-list');

        if (!questions || questions.length === 0) {
            listEl.innerHTML = '<div class="empty-state">Нет доступных вопросов</div>';
            return;
        }

        listEl.innerHTML = questions.slice(0, 5).map((q, idx) => `
            <div class="course-item">
                <div class="course-title">Вопрос ${idx + 1}</div>
                <p style="color: #b0bec5; margin: 0.5rem 0; font-size: 14px;">
                    ${escapeHTML(q.question_text || q.text || '')}
                </p>
                <div style="margin-top: 1rem;">
                    <button class="course-btn" onclick="openQuestion(${q.id})">
                        Ответить
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Ошибка загрузки вопросов:', error);
        document.getElementById('questions-list').innerHTML = 
            '<div class="empty-state">Нет вопросов</div>';
    }
}

// Load user's results
async function loadResults() {
    try {
        const response = await apiCall(`${API_BASE}/course-results`);
        const results = await response.json();
        const listEl = document.getElementById('results-list');

        if (!results || results.length === 0) {
            listEl.innerHTML = '<div class="empty-state">Результатов нет</div>';
            return;
        }

        listEl.innerHTML = results.map((r, idx) => `
            <div class="course-item completed">
                <div>
                    <div class="course-title">
                        ${escapeHTML(r.course_title || 'Курс ' + r.course_id)}
                    </div>
                    <div style="color: var(--text-subtle); font-size: 0.9rem; margin-top: 0.5rem;">
                        Завершено: ${new Date(r.completed_at || r.created_at).toLocaleDateString('ru-RU')}
                    </div>
                </div>
                <div>
                    <span style="background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%); color: white; padding: 0.6rem 1rem; border-radius: 8px; font-size: 0.85rem; font-weight: 600; display: inline-block;">
                        ✓ Завершено
                    </span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Ошибка загрузки результатов:', error);
        document.getElementById('results-list').innerHTML = 
            '<div class="empty-state">Ошибка загрузки результатов</div>';
    }
}

// Utility function to escape HTML
function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Placeholder functions for questions
function openQuestion(questionId) {
    alert(`Открыть вопрос ${questionId}`);
}

// Close modal when clicking outside
window.onclick = function(event) {
    // Modal functionality removed - course viewing now uses course.html
};

// Initialize page
loadProfileData();
loadCourses();
loadResults();
