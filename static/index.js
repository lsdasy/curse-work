// DOM Elements
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');
const courseList = document.getElementById('course-list');

async function parseAPIResponse(response) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch {
        return { message: text || 'Ошибка сервера' };
    }
}

// Tab switching logic
function switchToTab(tab) {
    if (tab === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
    }
}

tabLogin.addEventListener('click', () => switchToTab('login'));
tabRegister.addEventListener('click', () => switchToTab('register'));

document.addEventListener('click', (event) => {
    if (event.target.id === 'switch-to-login') {
        switchToTab('login');
    }
});

// initialize default view
switchToTab('login');

// Hide messages
function hideMessages() {
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
}

// Show error message
function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.style.display = 'block';
    successMessage.style.display = 'none';
}

// Show success message
function showSuccess(msg) {
    successMessage.textContent = msg;
    successMessage.style.display = 'block';
    errorMessage.style.display = 'none';
}

// Load courses
async function loadCourses() {
    try {
        // Use public API endpoint without authentication
        const response = await fetch('/api/courses');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const courses = await response.json();

        if (courses.length === 0) {
            courseList.innerHTML = '<div class="empty-state">Нет доступных курсов</div>';
            return;
        }

        courseList.innerHTML = courses.slice(0, 5).map(course => `
            <div class="course-item">
                <div class="course-title">${course.title}</div>
                <div class="course-description">${course.description || 'Нет описания'}</div>
                <div class="course-meta">
                    <span class="course-lang">${getLanguageTag(course.title)}</span>
                    <span class="course-lessons-count">📖 Уроки</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Ошибка загрузки курсов:', error);
        courseList.innerHTML = '<div class="empty-state">Ошибка загрузки курсов</div>';
    }
}

// Get language tag from course title
function getLanguageTag(title) {
    if (title.toLowerCase().includes('python')) {
        return '🐍 Python';
    } else if (title.toLowerCase().includes('go')) {
        return '🐹 Go';
    } else if (title.toLowerCase().includes('javascript') || title.toLowerCase().includes('react') || title.toLowerCase().includes('js')) {
        return '⚛️ JavaScript';
    } else if (title.toLowerCase().includes('c++') || title.toLowerCase().includes('cpp')) {
        return 'CppObject C++';
    }
    return '💻 Программирование';
}

// Login form submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();

    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ login, password })
        });

        const data = await parseAPIResponse(response);

        if (response.ok) {
            // Store token and user info in localStorage
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            // Redirect based on role
            if (data.user.role === 'admin') {
                window.location.href = '/admin.html';
            } else {
                window.location.href = '/profile.html';
            }
        } else {
            showError(data.message || 'Ошибка входа');
        }
    } catch (error) {
        showError('Ошибка сети. Попробуйте снова.');
    }
});

// Registration form submission
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();

    const fullnameInput = document.getElementById('reg-fullname');
    const emailInput = document.getElementById('reg-email');
    const loginInput = document.getElementById('reg-login');
    const passwordInput = document.getElementById('reg-password');
    const passwordConfirmInput = document.getElementById('reg-password-confirm');

    const fullname = fullnameInput ? fullnameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const login = loginInput ? loginInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';
    const passwordConfirm = passwordConfirmInput ? passwordConfirmInput.value : '';

    console.log('DOM fields', {
        fullname: fullnameInput ? fullnameInput.value : null,
        email: emailInput ? emailInput.value : null,
        login: loginInput ? loginInput.value : null,
        password: passwordInput ? passwordInput.value : null,
        passwordConfirm: passwordConfirmInput ? passwordConfirmInput.value : null,
    });

    if (password !== passwordConfirm) {
        showError('Пароли не совпадают.');
        return;
    }

    if (password.length < 6) {
        showError('Пароль должен быть не менее 6 символов.');
        return;
    }

    console.log('Registration payload', { fullname, email, login, passwordLength: password.length });

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ login, password, fullname, fullName: fullname, email })
        });

        const data = await parseAPIResponse(response);

        if (response.ok) {
            showSuccess('✅ Регистрация успешна! Выполняется вход...');
            // Automatically redirect after successful registration
            setTimeout(() => {
                // After registration, try to log in automatically
                loginForm.querySelector('#login').value = login;
                loginForm.querySelector('#password').value = password;
                loginForm.dispatchEvent(new Event('submit'));
            }, 1500);
        } else {
            showError(data.message || 'Ошибка регистрации');
        }
    } catch (error) {
        showError('Ошибка сети. Попробуйте снова.');
    }
});

// Load courses on page load
loadCourses();