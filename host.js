// Enhanced Host Management JavaScript - COMPLETE FIXED VERSION
let hostCurrentQuiz = null;
let hostGameInstance = null;
let hostPlayers = {};
let currentQuestionIndex = 0;
let questionTimer = null;
let gamePin = null;
let isGameActive = false;
let currentGameState = 'waiting';

// Initialize host page
function initializeHost() {
    console.log('🎯 HOST: Starting initialization...');
    
    // Wait for Firebase to be ready
    if (typeof auth === 'undefined' || typeof database === 'undefined') {
        console.log('⏳ HOST: Waiting for Firebase...');
        setTimeout(initializeHost, 100);
        return;
    }
    
    console.log('✅ HOST: Firebase ready, checking authentication...');
    
    // Check authentication
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log('✅ HOST: User authenticated:', user.email);
            showUserHeader(user);
            loadAvailableQuizzes();
        } else {
            console.log('❌ HOST: User not authenticated, redirecting...');
            setTimeout(() => {
                window.location.href = 'auth.html';
            }, 2000);
        }
    });
    
    console.log('🎯 HOST: Initialization complete');
}

function showUserHeader(user) {
    // Remove existing header
    const existingHeader = document.querySelector('.user-header');
    if (existingHeader) {
        existingHeader.remove();
    }
    
    const userHeaderHTML = `
        <div class="user-header" style="position: fixed; top: 15px; right: 15px; display: flex; align-items: center; gap: 10px; background: linear-gradient(135deg, #ff6900 0%, #ffb800 100%); backdrop-filter: blur(15px); padding: 12px 20px; border-radius: 30px; border: 3px solid rgba(255, 255, 255, 0.3); z-index: 1000; box-shadow: 0 8px 32px rgba(255, 105, 0, 0.3);">
            <div class="user-info" style="color: white; font-size: 14px; text-align: right; font-weight: 600;">
                <div class="user-name" style="font-weight: 800; margin-bottom: 2px; color: #ffffff;">${user.displayName || user.email.split('@')[0]}</div>
                <div class="user-email" style="opacity: 0.9; font-size: 11px; color: #ffe6d1;">${user.email}</div>
            </div>
            <button onclick="signOut()" style="background: linear-gradient(135deg, #46178f 0%, #7b2cbf 100%); border: none; color: white; padding: 8px 15px; border-radius: 20px; cursor: pointer; font-size: 12px; font-weight: 700; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(70, 23, 143, 0.3);">Sign Out</button>
        </div>
    `;
    
    document.body.insertAdjacentHTML('afterbegin', userHeaderHTML);
}

// Load and display available quizzes with enhanced validation
async function loadAvailableQuizzes() {
    console.log('📚 HOST: Loading available quizzes...');
    const quizList = document.getElementById('quiz-list');
    
    if (!quizList) {
        console.error('❌ HOST: Quiz list element not found');
        return;
    }
    
    quizList.innerHTML = '<div style="text-align: center; padding: 20px;">Loading quizzes...</div>';
    
    try {
        // Load user's quizzes
        console.log('🔍 HOST: Loading user quizzes...');
        const savedQuizzes = await loadUserQuizzes();
        console.log('📝 HOST: Found saved quizzes:', savedQuizzes.length);
        
        quizList.innerHTML = ''; // Clear loading message
        
        let hasValidQuizzes = false;
        
        // Add saved quizzes with enhanced validation
        if (savedQuizzes && savedQuizzes.length > 0) {
            for (const quiz of savedQuizzes) {
                // Enhanced validation and repair
                const validatedQuiz = await validateAndRepairQuiz(quiz);
                
                if (validatedQuiz && validatedQuiz.questions && validatedQuiz.questions.length > 0) {
                    addQuizToList(validatedQuiz, quizList, 'saved');
                    hasValidQuizzes = true;
                } else {
                    console.warn('⚠️ HOST: Skipping invalid quiz:', quiz?.title || 'Unknown');
                }
            }
        }
        
        // Add sample quizzes
        if (typeof sampleQuizzes !== 'undefined' && sampleQuizzes && sampleQuizzes.length > 0) {
            console.log('📚 HOST: Adding sample quizzes:', sampleQuizzes.length);
            
            for (const quiz of sampleQuizzes) {
                const validatedQuiz = await validateAndRepairQuiz(quiz);
                
                if (validatedQuiz && validatedQuiz.questions && validatedQuiz.questions.length > 0) {
                    addQuizToList(validatedQuiz, quizList, 'sample');
                    hasValidQuizzes = true;
                }
            }
        }
        
        // Show empty state if no valid quizzes
        if (!hasValidQuizzes) {
            quizList.innerHTML = `
                <div class="menu-card">
                    <div style="text-align: center; color: #666;">
                        <h3>No Valid Quizzes Available</h3>
                        <p>Create your first quiz to get started!</p>
                        <button onclick="createCustomQuiz()" class="btn btn-tertiary">Create New Quiz</button>
                    </div>
                </div>
            `;
        }
        
        console.log('✅ HOST: Quiz loading complete');
        
    } catch (error) {
        console.error('💥 HOST: Error loading quizzes:', error);
        quizList.innerHTML = `
            <div class="menu-card">
                <div style="text-align: center; color: #f44336;">
                    <h3>Error Loading Quizzes</h3>
                    <p>Please try refreshing the page</p>
                    <button onclick="loadAvailableQuizzes()" class="btn btn-primary">Retry</button>
                </div>
            </div>
        `;
    }
}

// Enhanced quiz validation and repair function
async function validateAndRepairQuiz(quiz) {
    console.log('🔧 HOST: Validating quiz:', quiz?.title || 'Unknown');
    
    if (!quiz || typeof quiz !== 'object') {
        console.warn('❌ HOST: Invalid quiz object');
        return null;
    }
    
    // Ensure basic properties
    const repairedQuiz = {
        id: quiz.id || 'quiz_' + Date.now(),
        title: quiz.title || 'Untitled Quiz',
        questions: [],
        createdAt: quiz.createdAt || Date.now(),
        updatedAt: quiz.updatedAt || Date.now()
    };
    
    // Validate and repair questions
    if (!quiz.questions || !Array.isArray(quiz.questions)) {
        console.warn('❌ HOST: No valid questions array in quiz:', repairedQuiz.title);
        return null; // Don't add quizzes without questions
    }
    
    // Validate each question
    for (let i = 0; i < quiz.questions.length; i++) {
        const question = quiz.questions[i];
        const repairedQuestion = validateAndRepairQuestion(question, i + 1);
        
        if (repairedQuestion) {
            repairedQuiz.questions.push(repairedQuestion);
        }
    }
    
    if (repairedQuiz.questions.length === 0) {
        console.warn('❌ HOST: No valid questions found in quiz:', repairedQuiz.title);
        return null;
    }
    
    console.log('✅ HOST: Quiz validated:', repairedQuiz.title, 'with', repairedQuiz.questions.length, 'questions');
    return repairedQuiz;
}

function validateAndRepairQuestion(question, questionNumber) {
    if (!question || typeof question !== 'object') {
        console.warn(`❌ HOST: Invalid question ${questionNumber}`);
        return null;
    }
    
    // Check required properties
    if (!question.question || typeof question.question !== 'string' || question.question.trim() === '') {
        console.warn(`❌ HOST: Question ${questionNumber} has no valid question text`);
        return null;
    }
    
    if (!question.answers || !Array.isArray(question.answers) || question.answers.length < 2) {
        console.warn(`❌ HOST: Question ${questionNumber} has invalid answers array`);
        return null;
    }
    
    // Validate answers
    const validAnswers = question.answers.filter(answer => 
        answer && typeof answer === 'string' && answer.trim() !== ''
    );
    
    if (validAnswers.length < 2) {
        console.warn(`❌ HOST: Question ${questionNumber} has less than 2 valid answers`);
        return null;
    }
    
    // Validate correct answer index
    const correctIndex = typeof question.correct === 'number' ? question.correct : 0;
    if (correctIndex < 0 || correctIndex >= validAnswers.length) {
        console.warn(`❌ HOST: Question ${questionNumber} has invalid correct answer index`);
        return null;
    }
    
    // Return repaired question
    return {
        question: question.question.trim(),
        answers: validAnswers,
        correct: correctIndex,
        timeLimit: typeof question.timeLimit === 'number' && question.timeLimit > 0 ? question.timeLimit : 20,
        source: question.source || 'manual'
    };
}

function addQuizToList(quiz, container, type) {
    const quizCard = document.createElement('div');
    quizCard.className = 'menu-card';
    
    const typeLabel = type === 'sample' ? '📚 Sample Quiz' : '💾 Your Quiz';
    const questionsCount = quiz.questions.length;
    
    quizCard.innerHTML = `
        <div style="text-align: left;">
            <h3>${quiz.title}</h3>
            <p>${questionsCount} question${questionsCount !== 1 ? 's' : ''}</p>
            <p><small><strong>${typeLabel}</strong></small></p>
            ${quiz.createdAt ? `<p><small>Created: ${new Date(quiz.createdAt).toLocaleDateString()}</small></p>` : ''}
        </div>
        <button onclick="selectQuiz('${quiz.id}', '${type}')" class="btn btn-primary">Select Quiz</button>
    `;
    
    container.appendChild(quizCard);
}

// Load user quizzes with better error handling
async function loadUserQuizzes() {
    try {
        console.log('📚 HOST: Loading user quizzes from system...');
        
        if (typeof loadAllQuizzes === 'function') {
            const quizzes = await loadAllQuizzes();
            console.log('📝 HOST: Loaded', quizzes.length, 'quizzes from system');
            return quizzes;
        } else {
            console.warn('⚠️ HOST: loadAllQuizzes function not available');
            return [];
        }
    } catch (error) {
        console.error('💥 HOST: Error loading user quizzes:', error);
        return [];
    }
}

// Select quiz function
async function selectQuiz(quizId, type) {
    console.log('🎯 HOST: Selecting quiz:', quizId, 'type:', type);
    showStatus('Loading quiz...', 'info');
    
    try {
        let selectedQuiz = null;
        
        if (type === 'sample') {
            selectedQuiz = sampleQuizzes.find(q => q.id === quizId);
        } else {
            const allQuizzes = await loadUserQuizzes();
            selectedQuiz = allQuizzes.find(q => q.id === quizId);
        }
        
        if (!selectedQuiz) {
            throw new Error('Quiz not found');
        }
        
        // Validate quiz before proceeding
        const validatedQuiz = await validateAndRepairQuiz(selectedQuiz);
        
        if (!validatedQuiz) {
            throw new Error('Quiz validation failed');
        }
        
        console.log('✅ HOST: Quiz selected and validated:', validatedQuiz.title);
        hostCurrentQuiz = validatedQuiz;
        createGameSession();
        
    } catch (error) {
        console.error('💥 HOST: Error selecting quiz:', error);
        showStatus('Error loading quiz: ' + error.message, 'error');
    }
}

// Create game session
async function createGameSession() {
    console.log('🎮 HOST: Creating game session...');
    showStatus('Creating game session...', 'info');
    
    try {
        // Generate game PIN
        gamePin = generateGamePin();
        console.log('🎯 HOST: Generated game PIN:', gamePin);
        
        // Create game instance
        hostGameInstance = new QuizGame(gamePin, true);
        
        // Create game in Firebase
        const gameCreated = await hostGameInstance.createGame(hostCurrentQuiz);
        
        if (!gameCreated) {
            throw new Error('Failed to create game in database');
        }
        
        console.log('✅ HOST: Game session created successfully');
        
        // Set up listeners
        hostGameInstance.listenToPlayers(onPlayersUpdate);
        hostGameInstance.listenToGameState(onGameStateUpdate);
        
        // Show lobby
        showGameLobby();
        showStatus('Game created! Share PIN: ' + gamePin, 'success');
        
    } catch (error) {
        console.error('💥 HOST: Error creating game session:', error);
        showStatus('Failed to create game: ' + error.message, 'error');
    }
}

function showGameLobby() {
    console.log('🏠 HOST: Showing game lobby');
    
    // Update UI
    document.getElementById('game-pin').textContent = gamePin;
    
    // Hide quiz selection, show lobby
    hideElement('quiz-selection');
    showElement('game-lobby');
    
    // Reset players display
    updatePlayersDisplay({});
    
    currentGameState = 'waiting';
    isGameActive = false;
}

function onPlayersUpdate(players) {
    console.log('👥 HOST: Players updated:', Object.keys(players).length);
    hostPlayers = players;
    updatePlayersDisplay(players);
}

function updatePlayersDisplay(players) {
    const playerCount = Object.keys(players).length;
    const countEl = document.getElementById('player-count');
    const containerEl = document.getElementById('players-container');
    const startBtn = document.getElementById('start-btn');
    
    // Update count
    if (countEl) countEl.textContent = playerCount;
    
    // Update players list
    if (containerEl) {
        if (playerCount === 0) {
            containerEl.innerHTML = `
                <div class="no-players-message">
                    <div style="font-size: 2rem; margin-bottom: 10px;">👥</div>
                    <div>No players yet</div>
                    <div style="font-size: 0.9rem; margin-top: 8px; opacity: 0.7;">
                        Share the game PIN to get started!
                    </div>
                </div>
            `;
        } else {
            containerEl.innerHTML = '';
            Object.values(players).forEach(player => {
                const playerDiv = document.createElement('div');
                playerDiv.className = 'player-item-lobby';
                playerDiv.textContent = player.name;
                containerEl.appendChild(playerDiv);
            });
        }
    }
    
    // Update start button
    if (startBtn) {
        if (playerCount > 0) {
            startBtn.disabled = false;
            startBtn.textContent = `Start Game (${playerCount} player${playerCount !== 1 ? 's' : ''})`;
        } else {
            startBtn.disabled = true;
            startBtn.textContent = 'Waiting for players...';
        }
    }
}

function onGameStateUpdate(gameState) {
    console.log('🎮 HOST: Game state updated:', gameState?.status);
    
    if (!gameState) return;
    
    currentGameState = gameState.status;
    
    switch (gameState.status) {
        case 'playing':
            if (gameState.currentQuestion !== undefined) {
                currentQuestionIndex = gameState.currentQuestion;
                showActiveGame();
            }
            break;
        case 'finished':
            showResults();
            break;
    }
}

// Start quiz
async function startQuiz() {
    console.log('🚀 HOST: Starting quiz...');
    
    if (Object.keys(hostPlayers).length === 0) {
        showStatus('No players have joined yet!', 'error');
        return;
    }
    
    if (!hostGameInstance) {
        showStatus('Game session not ready', 'error');
        return;
    }
    
    showStatus('Starting game...', 'info');
    
    try {
        const started = await hostGameInstance.startGame();
        
        if (started) {
            console.log('✅ HOST: Game started successfully');
            currentQuestionIndex = 0;
            isGameActive = true;
            showActiveGame();
            showStatus('Game started!', 'success');
        } else {
            throw new Error('Failed to start game');
        }
    } catch (error) {
        console.error('💥 HOST: Error starting game:', error);
        showStatus('Failed to start game: ' + error.message, 'error');
    }
}

function showActiveGame() {
    console.log('🎯 HOST: Showing active game for question', currentQuestionIndex + 1);
    
    hideElement('game-lobby');
    showElement('active-game');
    
    displayCurrentQuestion();
    updateResponsesDisplay();
}

function displayCurrentQuestion() {
    if (!hostCurrentQuiz || !hostCurrentQuiz.questions || currentQuestionIndex >= hostCurrentQuiz.questions.length) {
        console.error('❌ HOST: Invalid question index or quiz data');
        return;
    }
    
    const question = hostCurrentQuiz.questions[currentQuestionIndex];
    const totalQuestions = hostCurrentQuiz.questions.length;
    
    console.log('📝 HOST: Displaying question:', currentQuestionIndex + 1, 'of', totalQuestions);
    
    // Update question info
    document.getElementById('current-q-num').textContent = currentQuestionIndex + 1;
    document.getElementById('total-questions').textContent = totalQuestions;
    document.getElementById('host-question').textContent = question.question;
    
    // Update answers
    const answersContainer = document.getElementById('host-answers');
    answersContainer.innerHTML = '';
    
    question.answers.forEach((answer, index) => {
        const answerDiv = document.createElement('div');
        answerDiv.className = `answer-option ${index === question.correct ? 'correct' : ''}`;
        answerDiv.innerHTML = `
            <span class="answer-letter">${String.fromCharCode(65 + index)}</span>
            <span class="answer-text">${answer}</span>
            ${index === question.correct ? '<span class="correct-indicator">✓</span>' : ''}
        `;
        answersContainer.appendChild(answerDiv);
    });
    
    // Start timer
    startQuestionTimer(question.timeLimit || 20);
    
    // Hide/show appropriate buttons
    hideElement('next-btn');
    hideElement('results-btn');
}

function startQuestionTimer(duration) {
    console.log('⏰ HOST: Starting timer for', duration, 'seconds');
    
    const timerEl = document.getElementById('host-timer');
    let timeLeft = duration;
    
    const updateTimer = () => {
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(questionTimer);
            onQuestionTimeUp();
        } else {
            timeLeft--;
        }
    };
    
    updateTimer();
    questionTimer = setInterval(updateTimer, 1000);
}

function onQuestionTimeUp() {
    console.log('⏰ HOST: Question time is up');
    showElement('next-btn');
    
    if (currentQuestionIndex >= hostCurrentQuiz.questions.length - 1) {
        showElement('results-btn');
    }
    
    showStatus('Time\'s up! Review responses and continue.', 'info');
}

function updateResponsesDisplay() {
    const responsesContainer = document.getElementById('responses-container');
    if (!responsesContainer) return;
    
    responsesContainer.innerHTML = '';
    
    Object.values(hostPlayers).forEach(player => {
        const responseDiv = document.createElement('div');
        responseDiv.className = 'player-response';
        
        let statusText = 'Not answered';
        let statusClass = 'waiting';
        
        if (player.status === 'answered') {
            statusText = `Answered in ${(player.responseTime || 0).toFixed(1)}s`;
            statusClass = 'answered';
        }
        
        responseDiv.innerHTML = `
            <span class="player-name">${player.name}</span>
            <span class="response-status ${statusClass}">${statusText}</span>
        `;
        
        responsesContainer.appendChild(responseDiv);
    });
}

// Next question
async function nextQuestion() {
    console.log('➡️ HOST: Moving to next question');
    
    if (questionTimer) {
        clearInterval(questionTimer);
    }
    
    if (currentQuestionIndex >= hostCurrentQuiz.questions.length - 1) {
        // No more questions, end game
        endQuiz();
        return;
    }
    
    try {
        currentQuestionIndex++;
        const success = await hostGameInstance.nextQuestion();
        
        if (success) {
            console.log('✅ HOST: Moved to question', currentQuestionIndex + 1);
            displayCurrentQuestion();
            updateResponsesDisplay();
        } else {
            throw new Error('Failed to move to next question');
        }
    } catch (error) {
        console.error('💥 HOST: Error moving to next question:', error);
        showStatus('Error moving to next question', 'error');
    }
}

// Show results
function showResults() {
    console.log('🏆 HOST: Showing final results');
    
    if (questionTimer) {
        clearInterval(questionTimer);
    }
    
    hideElement('active-game');
    showElement('results-screen');
    
    displayFinalLeaderboard();
}

function displayFinalLeaderboard() {
    const leaderboard = document.getElementById('final-leaderboard');
    if (!leaderboard) return;
    
    // Sort players by score
    const sortedPlayers = Object.values(hostPlayers).sort((a, b) => (b.score || 0) - (a.score || 0));
    
    leaderboard.innerHTML = '<h3>🏆 Final Results</h3>';
    
    sortedPlayers.forEach((player, index) => {
        const div = document.createElement('div');
        div.className = `player-score rank-${index + 1 <= 3 ? index + 1 : ''}`;
        
        div.innerHTML = `
            <span>#${index + 1} ${player.name}</span>
            <span>${player.score || 0} points</span>
        `;
        
        leaderboard.appendChild(div);
    });
}

// End quiz
async function endQuiz() {
    console.log('🏁 HOST: Ending quiz');
    
    if (questionTimer) {
        clearInterval(questionTimer);
    }
    
    try {
        if (hostGameInstance) {
            await hostGameInstance.endGame();
        }
        
        showResults();
        showStatus('Quiz ended!', 'success');
    } catch (error) {
        console.error('💥 HOST: Error ending quiz:', error);
        showStatus('Error ending quiz', 'error');
    }
}

// Reset game
function resetGame() {
    console.log('🔄 HOST: Resetting game');
    
    // Cleanup
    if (questionTimer) {
        clearInterval(questionTimer);
        questionTimer = null;
    }
    
    if (hostGameInstance) {
        hostGameInstance.cleanup();
        hostGameInstance = null;
    }
    
    // Reset variables
    hostCurrentQuiz = null;
    hostPlayers = {};
    currentQuestionIndex = 0;
    gamePin = null;
    isGameActive = false;
    currentGameState = 'waiting';
    
    // Reset UI
    hideElement('game-lobby');
    hideElement('active-game');
    hideElement('results-screen');
    showElement('quiz-selection');
    
    showStatus('Ready to host a new game!', 'success');
    
    // Reload quizzes
    loadAvailableQuizzes();
}

// Create custom quiz
function createCustomQuiz() {
    console.log('📝 HOST: Redirecting to quiz creation');
    window.location.href = 'manage.html';
}

// Utility functions
function hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'none';
}

function showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'block';
}

function showStatus(message, type) {
    console.log(`📢 HOST (${type}):`, message);
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

function generateGamePin() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    console.log('🧹 HOST: Page unloading - cleanup');
    if (questionTimer) clearInterval(questionTimer);
    if (hostGameInstance) hostGameInstance.cleanup();
});

// Global function exposure
window.initializeHost = initializeHost;
window.selectQuiz = selectQuiz;
window.startQuiz = startQuiz;
window.nextQuestion = nextQuestion;
window.showResults = showResults;
window.endQuiz = endQuiz;
window.resetGame = resetGame;
window.createCustomQuiz = createCustomQuiz;

console.log('🎯 HOST: host.js loaded successfully');

// Auto-initialize if DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeHost);
} else {
    initializeHost();
}