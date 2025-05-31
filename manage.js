// Enhanced Quiz Management JavaScript with Session Management
let currentEditingQuiz = null;
let currentQuestions = [];

function initializeManage() {
    console.log('Initializing manage page...');
    
    // Wait for Firebase to be ready
    if (typeof auth === 'undefined') {
        console.log('Waiting for Firebase auth to load...');
        setTimeout(initializeManage, 100);
        return;
    }
    
    // Check authentication and load quizzes
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log('User authenticated:', user.email);
            showUserStatus(user);
            loadSavedQuizzes();
        } else {
            console.log('User not authenticated');
            showGuestStatus();
            // Still load quizzes from session for guests
            loadSavedQuizzes();
        }
    });

    // Listen for user data updates (after login/migration)
    window.addEventListener('userDataUpdated', (event) => {
        console.log('User data updated, refreshing quiz list');
        loadSavedQuizzes();
    });
}

function showUserStatus(user) {
    // Add user header if not exists
    if (!document.querySelector('.user-header')) {
        const userHeaderHTML = `
            <div class="user-header" style="position: absolute; top: 20px; right: 20px; display: flex; align-items: center; gap: 15px; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); padding: 10px 20px; border-radius: 25px; border: 1px solid rgba(255, 255, 255, 0.2);">
                <div class="user-info" style="color: white; font-size: 14px;">
                    <div class="user-name" style="font-weight: bold; margin-bottom: 2px;">${user.displayName || user.email.split('@')[0]}</div>
                    <div class="user-email" style="opacity: 0.8; font-size: 12px;">${user.email}</div>
                </div>
                <button onclick="signOut()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 12px; border-radius: 15px; cursor: pointer; font-size: 12px;">Sign Out</button>
            </div>
        `;
        document.body.insertAdjacentHTML('afterbegin', userHeaderHTML);
    }
}

function showGuestStatus() {
    // Add guest header if not exists
    if (!document.querySelector('.guest-header')) {
        const guestHeaderHTML = `
            <div class="guest-header" style="position: absolute; top: 20px; right: 20px; display: flex; align-items: center; gap: 15px; background: rgba(255, 165, 0, 0.1); backdrop-filter: blur(10px); padding: 10px 20px; border-radius: 25px; border: 1px solid rgba(255, 165, 0, 0.3);">
                <div class="guest-info" style="color: white; font-size: 14px;">
                    <div style="font-weight: bold; margin-bottom: 2px;">Guest Mode</div>
                    <div style="opacity: 0.8; font-size: 12px;">Login to save to cloud</div>
                </div>
                <button onclick="location.href='auth.html'" style="background: rgba(255,165,0,0.3); border: none; color: white; padding: 8px 12px; border-radius: 15px; cursor: pointer; font-size: 12px;">Login</button>
            </div>
        `;
        document.body.insertAdjacentHTML('afterbegin', guestHeaderHTML);
    }
}

async function loadSavedQuizzes() {
    console.log('Loading saved quizzes...');
    const quizzesList = document.getElementById('saved-quizzes-list');
    
    quizzesList.innerHTML = '<div style="text-align: center; padding: 20px;">Loading your quizzes...</div>';
    
    try {
        // Load quizzes using the enhanced system
        const allQuizzes = await loadAllQuizzes();
        
        console.log('Found', allQuizzes.length, 'total quizzes');
        
        if (allQuizzes.length === 0) {
            quizzesList.innerHTML = `
                <div class="empty-state">
                    <p>No quizzes created yet.</p>
                    <p>Click "Create New Quiz" to get started!</p>
                </div>
            `;
            return;
        }
        
        quizzesList.innerHTML = '';
        
        // Sort quizzes by creation date (newest first)
        allQuizzes.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
        
        allQuizzes.forEach(quiz => {
            const quizCard = document.createElement('div');
            quizCard.className = 'menu-card';
            
            // Determine source information
            let sourceInfo = '';
            if (quiz.migratedFromSession) {
                sourceInfo = '🔄 Migrated • ';
            } else if (currentUser) {
                sourceInfo = '☁️ Cloud • ';
            } else {
                sourceInfo = '💾 Local • ';
            }
            
            quizCard.innerHTML = `
                <div style="text-align: left;">
                    <h3>${quiz.title}</h3>
                    <p>${quiz.questions.length} questions</p>
                    <p><small>${sourceInfo}Created: ${new Date(quiz.createdAt).toLocaleDateString()}</small></p>
                    ${quiz.updatedAt && quiz.updatedAt !== quiz.createdAt ? 
                        `<p><small>Updated: ${new Date(quiz.updatedAt).toLocaleDateString()}</small></p>` : ''}
                </div>
                <div class="quiz-actions">
                    <button onclick="editQuizById('${quiz.id}')" class="btn btn-secondary">Edit</button>
                    <button onclick="duplicateQuiz('${quiz.id}')" class="btn btn-tertiary">Duplicate</button>
                    <button onclick="deleteQuiz('${quiz.id}')" class="btn" style="background: #f44336;">Delete</button>
                </div>
            `;
            quizzesList.appendChild(quizCard);
        });
        
    } catch (error) {
        console.error('Error loading quizzes:', error);
        quizzesList.innerHTML = `
            <div class="empty-state">
                <p style="color: #f44336;">Error loading quizzes. Please try again.</p>
                <button onclick="loadSavedQuizzes()" class="btn btn-primary">Retry</button>
            </div>
        `;
    }
}

function showCreateQuiz() {
    console.log('Creating new quiz...');
    
    currentEditingQuiz = null;
    currentQuestions = [];
    
    document.getElementById('editor-title').textContent = 'Create New Quiz';
    document.getElementById('quiz-title').value = '';
    document.getElementById('questions-container').innerHTML = '';
    
    hideElement('quiz-list-view');
    showElement('quiz-editor');
    
    addQuestion();
}

async function editQuizById(quizId) {
    console.log('Editing quiz:', quizId);
    
    try {
        // Load all quizzes and find the one to edit
        const allQuizzes = await loadAllQuizzes();
        const quiz = allQuizzes.find(q => q.id === quizId);
        
        if (quiz) {
            console.log('Found quiz to edit:', quiz.title);
            currentEditingQuiz = quiz;
            currentQuestions = [...quiz.questions];
            
            document.getElementById('editor-title').textContent = 'Edit Quiz';
            document.getElementById('quiz-title').value = quiz.title;
            
            hideElement('quiz-list-view');
            showElement('quiz-editor');
            
            loadQuestionsIntoEditor();
        } else {
            console.error('Quiz not found:', quizId);
            showStatus('Quiz not found', 'error');
        }
    } catch (error) {
        console.error('Error loading quiz for edit:', error);
        showStatus('Error loading quiz', 'error');
    }
}

function loadQuestionsIntoEditor() {
    console.log('Loading questions into editor:', currentQuestions.length);
    const container = document.getElementById('questions-container');
    container.innerHTML = '';
    
    currentQuestions.forEach((question, index) => {
        addQuestionToEditor(question, index);
    });
}

function addQuestion(questionData = null) {
    const questionIndex = currentQuestions.length;
    
    const defaultQuestion = questionData || {
        question: '',
        answers: ['', '', '', ''],
        correct: 0,
        timeLimit: 20
    };
    
    if (!questionData) {
        currentQuestions.push(defaultQuestion);
    }
    
    addQuestionToEditor(defaultQuestion, questionIndex);
    
    // Scroll to the newly added question for better UX
    setTimeout(() => {
        const newQuestionElement = document.querySelector(`.question-editor[data-index="${questionIndex}"]`);
        if (newQuestionElement) {
            newQuestionElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
            
            // Focus on the question input field
            const questionInput = newQuestionElement.querySelector('.question-input');
            if (questionInput) {
                questionInput.focus();
            }
        }
    }, 100);
}

function addQuestionToEditor(questionData, index) {
    console.log('Adding question to editor:', index, questionData.question);
    const container = document.getElementById('questions-container');
    
    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-editor';
    questionDiv.setAttribute('data-index', index);
    
    // Force visible styles with inline CSS
    questionDiv.style.cssText = `
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        background: #f9f9f9 !important;
        border: 2px solid #ddd !important;
        border-radius: 10px !important;
        padding: 20px !important;
        margin: 15px 0 !important;
        min-height: 200px !important;
        width: 100% !important;
        box-sizing: border-box !important;
    `;
    
    questionDiv.innerHTML = `
        <div class="question-header" style="display: flex !important; justify-content: space-between !important; align-items: center !important; margin-bottom: 15px !important; padding-bottom: 10px !important; border-bottom: 2px solid #eee !important;">
            <h4 style="color: #333 !important; margin: 0 !important;">Question ${index + 1}</h4>
            <div style="display: flex !important; gap: 10px !important;">
                <button onclick="addQuestionAfter(${index})" style="background: #4caf50 !important; color: white !important; padding: 5px 10px !important; border: none !important; border-radius: 5px !important; cursor: pointer !important; font-size: 12px !important;">+ Add Below</button>
                <button onclick="removeQuestion(${index})" style="background: #f44336 !important; color: white !important; padding: 5px 10px !important; border: none !important; border-radius: 5px !important; cursor: pointer !important;">Remove</button>
            </div>
        </div>
        
        <div class="input-group" style="margin-bottom: 15px !important;">
            <label style="display: block !important; font-weight: bold !important; margin-bottom: 5px !important; color: #333 !important;">Question:</label>
            <input type="text" class="question-input" value="${(questionData.question || '').replace(/"/g, '&quot;')}" placeholder="Enter your question" maxlength="200" style="width: 100% !important; padding: 10px !important; border: 1px solid #ddd !important; border-radius: 5px !important; font-size: 14px !important; background: white !important; color: #333 !important; box-sizing: border-box !important;">
        </div>
        
        <div class="answers-editor" style="margin: 15px 0 !important;">
            <label style="display: block !important; font-weight: bold !important; margin-bottom: 5px !important; color: #333 !important;">Answer Options:</label>
            <div class="answers-grid">
                ${questionData.answers.map((answer, answerIndex) => `
                    <div class="answer-input-group ${questionData.correct === answerIndex ? 'correct-answer' : ''}" style="display: flex !important; align-items: center !important; margin: 8px 0 !important; gap: 10px !important; padding: 8px !important; border-radius: 5px !important; border: 2px solid ${questionData.correct === answerIndex ? '#4caf50' : 'transparent'} !important; background: ${questionData.correct === answerIndex ? '#e8f5e8' : '#f8f8f8'} !important; transition: all 0.3s ease !important;">
                        <input type="radio" name="correct-${index}" value="${answerIndex}" ${questionData.correct === answerIndex ? 'checked' : ''} onchange="updateCorrectAnswer(${index}, ${answerIndex})" style="margin: 0 !important; width: 18px !important; height: 18px !important; cursor: pointer !important;">
                        <input type="text" class="answer-input" value="${(answer || '').replace(/"/g, '&quot;')}" placeholder="Answer ${answerIndex + 1}" maxlength="100" style="flex: 1 !important; padding: 8px !important; border: 1px solid #ddd !important; border-radius: 3px !important; font-size: 14px !important; background: white !important; color: #333 !important;">
                        <span class="correct-indicator" style="display: ${questionData.correct === answerIndex ? 'inline-block' : 'none'} !important; background: #4caf50 !important; color: white !important; padding: 2px 8px !important; border-radius: 12px !important; font-size: 12px !important; font-weight: bold !important;">✓ CORRECT</span>
                    </div>
                `).join('')}
            </div>
            <small style="color: #666 !important;">Select the radio button next to the correct answer (highlighted in green)</small>
        </div>
        
        <div class="input-group" style="margin-bottom: 15px !important;">
            <label style="display: block !important; font-weight: bold !important; margin-bottom: 5px !important; color: #333 !important;">Time Limit (seconds):</label>
            <input type="number" class="time-input" value="${questionData.timeLimit || 20}" min="5" max="120" style="width: 100px !important; padding: 8px !important; border: 1px solid #ddd !important; border-radius: 5px !important; font-size: 14px !important; background: white !important; color: #333 !important;">
        </div>
    `;
    
    container.appendChild(questionDiv);
    console.log('Question added to container, total children:', container.children.length);
}

function addQuestionAfter(afterIndex) {
    console.log('Adding question after index:', afterIndex);
    
    const newQuestion = {
        question: '',
        answers: ['', '', '', ''],
        correct: 0,
        timeLimit: 20
    };
    
    // Insert the new question after the specified index
    currentQuestions.splice(afterIndex + 1, 0, newQuestion);
    
    // Rebuild the entire editor to maintain proper indexing
    loadQuestionsIntoEditor();
    
    // Scroll to the newly added question
    setTimeout(() => {
        const newQuestionElement = document.querySelector(`.question-editor[data-index="${afterIndex + 1}"]`);
        if (newQuestionElement) {
            newQuestionElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
            
            // Focus on the question input field
            const questionInput = newQuestionElement.querySelector('.question-input');
            if (questionInput) {
                questionInput.focus();
            }
            
            // Add a subtle highlight animation
            newQuestionElement.style.border = '3px solid #4caf50';
            setTimeout(() => {
                newQuestionElement.style.border = '2px solid #ddd';
            }, 2000);
        }
    }, 100);
}

function removeQuestion(index) {
    console.log('Removing question:', index);
    
    if (currentQuestions.length <= 1) {
        showStatus('A quiz must have at least one question', 'error');
        return;
    }
    
    if (confirm('Are you sure you want to remove this question?')) {
        currentQuestions.splice(index, 1);
        loadQuestionsIntoEditor();
    }
}

function collectQuizData() {
    console.log('Collecting quiz data...');
    const title = document.getElementById('quiz-title').value.trim();
    
    if (!title) {
        showStatus('Please enter a quiz title', 'error');
        return null;
    }
    
    const questionElements = document.querySelectorAll('.question-editor');
    const questions = [];
    
    for (let i = 0; i < questionElements.length; i++) {
        const questionEl = questionElements[i];
        const questionText = questionEl.querySelector('.question-input').value.trim();
        
        if (!questionText) {
            showStatus(`Please enter text for question ${i + 1}`, 'error');
            return null;
        }
        
        const answerInputs = questionEl.querySelectorAll('.answer-input');
        const answers = [];
        let hasEmptyAnswer = false;
        
        answerInputs.forEach(input => {
            const answer = input.value.trim();
            if (!answer) {
                hasEmptyAnswer = true;
            }
            answers.push(answer);
        });
        
        if (hasEmptyAnswer) {
            showStatus(`Please fill all answer options for question ${i + 1}`, 'error');
            return null;
        }
        
        const correctRadio = questionEl.querySelector(`input[name="correct-${i}"]:checked`);
        if (!correctRadio) {
            showStatus(`Please select the correct answer for question ${i + 1}`, 'error');
            return null;
        }
        
        const timeLimit = parseInt(questionEl.querySelector('.time-input').value);
        if (timeLimit < 5 || timeLimit > 120) {
            showStatus(`Time limit for question ${i + 1} must be between 5 and 120 seconds`, 'error');
            return null;
        }
        
        questions.push({
            question: questionText,
            answers: answers,
            correct: parseInt(correctRadio.value),
            timeLimit: timeLimit
        });
    }
    
    console.log('Quiz data collected:', { title, questionCount: questions.length });
    return {
        title: title,
        questions: questions
    };
}

async function saveQuiz() {
    console.log('Saving quiz...');
    
    const quizData = collectQuizData();
    if (!quizData) {
        console.log('Quiz data validation failed');
        return;
    }
    
    showStatus('Saving quiz...', 'info');
    
    try {
        let savedQuiz;
        
        if (currentEditingQuiz) {
            // Update existing quiz
            console.log('Updating existing quiz:', currentEditingQuiz.id);
            savedQuiz = {
                ...currentEditingQuiz,
                title: quizData.title,
                questions: quizData.questions,
                updatedAt: Date.now()
            };
        } else {
            // Create new quiz
            savedQuiz = {
                id: 'quiz_' + Date.now(),
                title: quizData.title,
                questions: quizData.questions,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
        }
        
        // Save using the enhanced system
        const saveResult = await saveQuizToSystem(savedQuiz);
        
        if (saveResult.success) {
            let message;
            if (saveResult.location === 'firebase') {
                message = currentEditingQuiz ? 'Quiz updated and saved to cloud!' : 'Quiz created and saved to cloud!';
            } else if (saveResult.location === 'local') {
                message = currentEditingQuiz ? 'Quiz updated locally (cloud sync failed)' : 'Quiz created locally (cloud sync failed)';
            } else {
                message = currentEditingQuiz ? 'Quiz updated in session!' : 'Quiz created in session! Login to save to cloud.';
            }
            
            showStatus(message, 'success');
            console.log('Quiz saved successfully');
            
            // Return to list view
            setTimeout(() => {
                cancelEdit();
                loadSavedQuizzes();
            }, 1500);
        } else {
            throw new Error(saveResult.error || 'Failed to save quiz');
        }
        
    } catch (error) {
        console.error('Error saving quiz:', error);
        showStatus('Failed to save quiz: ' + error.message, 'error');
    }
}

function previewQuiz() {
    const quizData = collectQuizData();
    if (!quizData) return;
    
    document.getElementById('preview-title').textContent = quizData.title;
    document.getElementById('preview-question-count').textContent = quizData.questions.length;
    
    const previewContainer = document.getElementById('preview-questions');
    previewContainer.innerHTML = '';
    
    quizData.questions.forEach((question, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'preview-question';
        questionDiv.innerHTML = `
            <div class="question-preview">
                <h4>Question ${index + 1}</h4>
                <p class="question-text">${question.question}</p>
                <div class="answers-preview">
                    ${question.answers.map((answer, answerIndex) => `
                        <div class="answer-preview ${answerIndex === question.correct ? 'correct-answer' : ''}">
                            ${answerIndex === question.correct ? '✓ ' : ''}${answer}
                        </div>
                    `).join('')}
                </div>
                <p><small>Time limit: ${question.timeLimit} seconds</small></p>
            </div>
        `;
        previewContainer.appendChild(questionDiv);
    });
    
    hideElement('quiz-editor');
    showElement('quiz-preview');
}

function editQuiz() {
    hideElement('quiz-preview');
    showElement('quiz-editor');
}

function closePreview() {
    hideElement('quiz-preview');
    showElement('quiz-editor');
}

// Function to completely reset the interface to the main view
function resetToMainView() {
    console.log('Resetting interface to main view');
    
    // Hide all editor and preview screens
    hideElement('quiz-editor');
    hideElement('quiz-preview');
    
    // Show the main quiz list
    showElement('quiz-list-view');
    
    // Clear all editing state
    currentEditingQuiz = null;
    currentQuestions = [];
    
    // Clear all form fields
    const titleInput = document.getElementById('quiz-title');
    const questionsContainer = document.getElementById('questions-container');
    const editorTitle = document.getElementById('editor-title');
    
    if (titleInput) titleInput.value = '';
    if (questionsContainer) questionsContainer.innerHTML = '';
    if (editorTitle) editorTitle.textContent = 'Create New Quiz';
    
    // Clear any status messages
    const statusEl = document.getElementById('status-message');
    if (statusEl) {
        statusEl.textContent = '';
        statusEl.className = 'status-message';
    }
    
    console.log('Interface reset completed');
}

function cancelEdit() {
    console.log('Canceling edit mode');
    resetToMainView();
}

async function duplicateQuiz(quizId) {
    console.log('Duplicating quiz:', quizId);
    
    try {
        // Load all quizzes and find the one to duplicate
        const allQuizzes = await loadAllQuizzes();
        const originalQuiz = allQuizzes.find(q => q.id === quizId);
        
        if (originalQuiz) {
            const duplicatedQuiz = {
                ...originalQuiz,
                id: 'quiz_' + Date.now(),
                title: originalQuiz.title + ' (Copy)',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            
            // Save using the enhanced system
            const saveResult = await saveQuizToSystem(duplicatedQuiz);
            
            if (saveResult.success) {
                let message;
                if (saveResult.location === 'firebase') {
                    message = 'Quiz duplicated and saved to cloud!';
                } else if (saveResult.location === 'local') {
                    message = 'Quiz duplicated locally (cloud sync failed)';
                } else {
                    message = 'Quiz duplicated in session! Login to save to cloud.';
                }
                
                showStatus(message, 'success');
                loadSavedQuizzes();
            } else {
                throw new Error(saveResult.error || 'Failed to duplicate quiz');
            }
        } else {
            showStatus('Original quiz not found', 'error');
        }
    } catch (error) {
        console.error('Error duplicating quiz:', error);
        showStatus('Failed to duplicate quiz', 'error');
    }
}

async function deleteQuiz(quizId) {
    console.log('Deleting quiz:', quizId);
    
    if (confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) {
        try {
            const success = await deleteQuizFromSystem(quizId);
            
            if (success) {
                showStatus('Quiz deleted successfully!', 'success');
                
                // Check if we're currently editing the quiz that was deleted
                if (currentEditingQuiz && currentEditingQuiz.id === quizId) {
                    console.log('Currently editing quiz was deleted, resetting interface');
                    // Reset the entire interface to main view
                    resetToMainView();
                }
                
                // Reload the quiz list to refresh the interface
                loadSavedQuizzes();
            } else {
                throw new Error('Failed to delete quiz');
            }
        } catch (error) {
            console.error('Error deleting quiz:', error);
            showStatus('Failed to delete quiz', 'error');
        }
    }
}

// Function to update correct answer highlighting
function updateCorrectAnswer(questionIndex, answerIndex) {
    console.log('Updating correct answer for question', questionIndex, 'to answer', answerIndex);
    
    // Find the question container
    const questionDiv = document.querySelector(`.question-editor[data-index="${questionIndex}"]`);
    if (!questionDiv) return;
    
    // Remove correct highlighting from all answer groups in this question
    const answerGroups = questionDiv.querySelectorAll('.answer-input-group');
    answerGroups.forEach((group, index) => {
        const indicator = group.querySelector('.correct-indicator');
        if (index === answerIndex) {
            // Mark as correct
            group.classList.add('correct-answer');
            group.style.background = '#e8f5e8';
            group.style.borderColor = '#4caf50';
            if (indicator) {
                indicator.style.display = 'inline-block';
            }
        } else {
            // Mark as incorrect
            group.classList.remove('correct-answer');
            group.style.background = '#f8f8f8';
            group.style.borderColor = 'transparent';
            if (indicator) {
                indicator.style.display = 'none';
            }
        }
    });
    
    // Update the current questions array if editing
    if (currentQuestions[questionIndex]) {
        currentQuestions[questionIndex].correct = answerIndex;
    }
}

function hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'none';
}

function showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'block';
}

function showStatus(message, type) {
    const statusEl = document.getElementById('status-message');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`;
        setTimeout(() => {
            statusEl.textContent = '';
            statusEl.className = 'status-message';
        }, 3000);
    }
}

// Make functions globally accessible
window.showCreateQuiz = showCreateQuiz;
window.editQuizById = editQuizById;
window.duplicateQuiz = duplicateQuiz;
window.deleteQuiz = deleteQuiz;
window.addQuestion = addQuestion;
window.addQuestionAfter = addQuestionAfter;
window.removeQuestion = removeQuestion;
window.saveQuiz = saveQuiz;
window.previewQuiz = previewQuiz;
window.editQuiz = editQuiz;
window.closePreview = closePreview;
window.cancelEdit = cancelEdit;
window.updateCorrectAnswer = updateCorrectAnswer;

// Auto-initialize when page loads
document.addEventListener('DOMContentLoaded', initializeManage);