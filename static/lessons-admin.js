// ===== LESSON MANAGEMENT FUNCTIONS =====

let currentCourseId = null;

// Open course details and show lessons
async function viewCourseDetails(courseId) {
    currentCourseId = courseId;
    const courseTitle = document.querySelector(`[data-course-id="${courseId}"]`)?.innerText || 'Курс';
    document.getElementById('selected-course-title').innerText = `${courseTitle} - Уроки`;
    document.getElementById('courses-list').parentElement.style.display = 'none';
    document.getElementById('course-details').style.display = 'block';
    await loadLessons(courseId);
}

// Back to courses list
function backToCoursesList() {
    currentCourseId = null;
    document.getElementById('courses-list').parentElement.style.display = 'block';
    document.getElementById('course-details').style.display = 'none';
}

// Load lessons for a course
async function loadLessons(courseId) {
    try {
        const response = await apiCall(`/api/courses/${courseId}/lessons`);
        const lessons = await response.json();
        
        if (!lessons || lessons.length === 0) {
            document.getElementById('lessons-list').innerHTML = '<div class="empty-state">Нет уроков. Добавьте первый урок!</div>';
            return;
        }
        
        document.getElementById('lessons-list').innerHTML = lessons.map(lesson => `
            <div class="course-item" style="cursor: default;">
                <div class="course-title">${lesson.title}</div>
                <div class="course-description" style="font-size: 0.9rem; color: #999; margin: 0.5rem 0;">Урок ${lesson.lesson_order}</div>
                <div class="course-meta">
                    <span class="course-lessons-count">📝 Содержание доступно</span>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" onclick="editLesson(${lesson.id}, ${courseId})">✏️ Редактировать</button>
                        <button class="btn" style="padding: 0.4rem 0.8rem; font-size: 0.85rem; background: #d32f2f;" onclick="deleteLesson(${lesson.id}, ${courseId})">🗑️ Удалить</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Ошибка загрузки уроков:', error);
        document.getElementById('lessons-list').innerHTML = '<div class="empty-state">Ошибка загрузки уроков</div>';
    }
}

// Open lesson modal for creating new lesson
function openLessonModal() {
    if (!currentCourseId) {
        alert('Сначала выберите курс');
        return;
    }
    document.getElementById('lesson-id').value = '';
    document.getElementById('lesson-title-input').value = '';
    document.getElementById('lesson-content-input').value = '';
    document.getElementById('lesson-order-input').value = '';
    document.getElementById('lesson-modal-title').innerText = 'Добавить Урок';
    document.getElementById('lesson-modal').style.display = 'block';
}

// Close lesson modal
function closeLessonModal() {
    document.getElementById('lesson-modal').style.display = 'none';
}

// Edit lesson
async function editLesson(lessonId, courseId) {
    try {
        const response = await apiCall(`/api/courses/${courseId}/lessons`);
        const lessons = await response.json();
        const lesson = lessons.find(l => l.id === lessonId);
        
        if (!lesson) {
            alert('Урок не найден');
            return;
        }
        
        document.getElementById('lesson-id').value = lesson.id;
        document.getElementById('lesson-title-input').value = lesson.title;
        document.getElementById('lesson-content-input').value = lesson.content;
        document.getElementById('lesson-order-input').value = lesson.lesson_order;
        document.getElementById('lesson-modal-title').innerText = 'Редактировать Урок';
        document.getElementById('lesson-modal').style.display = 'block';
    } catch (error) {
        alert('Ошибка загрузки урока: ' + error.message);
    }
}

// Save lesson (create or update)
async function saveLesson() {
    const lessonId = document.getElementById('lesson-id').value;
    const title = document.getElementById('lesson-title-input').value.trim();
    const content = document.getElementById('lesson-content-input').value.trim();
    const order = parseInt(document.getElementById('lesson-order-input').value);
    
    if (!title || !content || !order) {
        alert('Заполните все обязательные поля');
        return;
    }
    
    if (!currentCourseId) {
        alert('Ошибка: курс не выбран');
        return;
    }
    
    try {
        const payload = {
            title,
            content,
            lesson_order: order
        };
        
        if (lessonId) {
            // Update lesson
            const response = await apiCall(`/api/admin/courses/${currentCourseId}/lessons/${lessonId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            await response.json();
            alert('Урок обновлен');
        } else {
            // Create lesson
            const response = await apiCall(`/api/admin/courses/${currentCourseId}/lessons`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            await response.json();
            alert('Урок создан');
        }
        
        closeLessonModal();
        await loadLessons(currentCourseId);
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

// Delete lesson
async function deleteLesson(lessonId, courseId) {
    if (!confirm('Удалить урок? Это действие нельзя отменить.')) {
        return;
    }
    
    try {
        const response = await apiCall(`/api/admin/courses/${courseId}/lessons/${lessonId}`, {
            method: 'DELETE'
        });
        await response.json();
        alert('Урок удален');
        await loadLessons(courseId);
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

// Update course management to show lesson button
function loadCourses() {
    try {
        const coursesContainer = document.getElementById('courses-list');
        if (!coursesContainer) return;
        
        // This function is expected to be called from main admin.js
        // We just add click handlers to course items after they're loaded
        setTimeout(() => {
            const courseItems = document.querySelectorAll('[data-course-id]');
            courseItems.forEach(item => {
                item.addEventListener('click', function(e) {
                    if (e.target.tagName === 'BUTTON') return; // Don't interfere with buttons
                    const courseId = parseInt(this.getAttribute('data-course-id'));
                    viewCourseDetails(courseId);
                });
                // Add pointer cursor
                item.style.cursor = 'pointer';
            });
        }, 100);
    } catch (error) {
        console.error('Error in loadCourses:', error);
    }
}

// Close modals when clicking outside
document.addEventListener('click', function(event) {
    const lessonModal = document.getElementById('lesson-modal');
    if (event.target === lessonModal) {
        closeLessonModal();
    }
});
