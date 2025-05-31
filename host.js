// Complete Host Page JavaScript - Enhanced Version with State Recovery
let hostCurrentQuiz = null;
let hostGameInstance = null;
let hostCurrentQuizData = null;
let hostQuestionTimer = null;
let hostCurrentPlayers = {};
let hostQuestionIndex = 0;
let questionStartTime = null;
let scoringSystem = null;
let isRecoveringState = false;

// State persistence keys
const STATE_KEYS = {
    GAME_PIN: 'host_game_pin',
    CURRENT_QUIZ: 'host_current_quiz',
    QUESTION_INDEX: 'host_question_index',
    GAME_STATE: 'host_game_state',
    IS_HOST_ACTIVE: 'host_is_active'
};

function initializeHost() {
    console.log('🎯 HOST: Initializing host page...');
    
    // Initialize scoring system
    if (typeof ScoringSystem !== 'undefined') {
        scoringSystem = new ScoringSystem();
    }
    
    // Wait for Firebase to be ready
    if (typeof auth === 'undefined') {
        console.log('⏳ HOST: Waiting for Firebase auth...');
        setTimeout(initializeHost, 100);
        return;
    }
    
    // Check authentication and load quizzes
    auth.onAuthStateChanged((user) => {
        try {
            if (user) {
                console.log('✅ HOST: User authenticated:', user.email);
                showUserStatus(user);
                
                // Check if we need to recover from a refresh
                checkAndRecoverState().then(() => {
                    if (!isRecoveringState) {
                        loadAvailableQuizzes();
                    }
                });
            } else {
                console.log('❌ HOST: User not authenticated, redirecting...');
                clearHostState(); // Clear any stale state
                showStatus('Login required to host quizzes', 'error');
                setTimeout(() => {
                    window.location.href = 'auth.html';
                }, 2000);
            }
        } catch (error) {
            console.error('💥 HOST: Error in auth state change:', error);
        }
    });

    // Listen for user data updates
    window.addEventListener('userDataUpdated', (event) => {
        console.log('🔄 HOST: User data updated, refreshing quiz list');
        if (!isRecoveringState) {
            loadAvailableQuizzes();
        }
    });
    
    console.log('✅ HOST: Initialization complete');
}

// State Recovery Functions
async function checkAndRecoverState() {
    console.log('🔄 HOST: Checking for state recovery...');
    
    const isHostActive = localStorage.getItem(STATE_KEYS.IS_HOST_ACTIVE);
    const savedGamePin = localStorage.getItem(STATE_KEYS.GAME_PIN);
    const savedQuiz = localStorage.getItem(STATE_KEYS.CURRENT_QUIZ);
    const savedGameState = localStorage.getItem(STATE_KEYS.GAME_STATE);
    const savedQuestionIndex = localStorage.getItem(STATE_KEYS.QUESTION_INDEX);
    
    if (!isHostActive || !savedGamePin) {
        console.log('✅ HOST: No active state to recover');
        return;
    }
    
    console.log('🔍 HOST: Found active state to recover:', {
        gamePin: savedGamePin,
        hasQuiz: !!savedQuiz,
        gameState: savedGameState,
        questionIndex: savedQuestionIndex
    });
    
    try {
        // Check if the game still exists in Firebase
        const gameExists = await checkGameExists(savedGamePin);
        if (!gameExists) {
            console.log('❌ HOST: Game no longer exists, clearing state');
            clearHostState();
            return;
        }
        
        isRecoveringState = true;
        
        // Restore the quiz data
        if (savedQuiz) {
            hostCurrentQuiz = JSON.parse(savedQuiz);
            hostCurrentQuizData = hostCurrentQuiz;
        }
        
        // Restore question index
        if (savedQuestionIndex) {
            hostQuestionIndex = parseInt(savedQuestionIndex);
        }
        
        // Recreate game instance
        hostGameInstance = new QuizGame(savedGamePin, true);
        
        // Determine which screen to show based on saved state
        const gameState = savedGameState || 'lobby';
        
        switch (gameState) {
            case 'lobby':
                await recoverLobbyState(savedGamePin);
                break;
            case 'playing':
                await recoverPlayingState(savedGamePin);
                break;
            case 'results':
                await recoverResultsState(savedGamePin);
                break;
            default:
                console.log('❓ HOST: Unknown game state, defaulting to lobby');
                await recoverLobbyState(savedGamePin);
        }
        
        showStatus('Game state recovered after refresh!', 'success');
        console.log('✅ HOST: State recovery complete');
        
    } catch (error) {
        console.error('💥 HOST: Error during state recovery:', error);
        clearHostState();
        showStatus('Failed to recover game state', 'error');
        loadAvailableQuizzes();
    } finally {
        isRecoveringState = false;
    }
}

async function checkGameExists(gamePin) {
    try {
        const gameRef = database.ref(`games/${gamePin}`);
        const snapshot = await gameRef.once('value');
        const gameData = snapshot.val();
        return !!gameData;
    } catch (error) {
        console.error('Error checking game existence:', error);
        return false;
    }
}

async function recoverLobbyState(gamePin) {
    console.log('🏠 HOST: Recovering lobby state');
    
    document.getElementById('game-pin').textContent = gamePin;
    hideElement('quiz-selection');
    showElement('game-lobby');
    
    // Set up listeners
    hostGameInstance.listenToPlayers(updatePlayersList);
    
    // Get current players
    const playersRef = database.ref(`games/${gamePin}/players`);
    const snapshot = await playersRef.once('value');
    const players = snapshot.val() || {};
    updatePlayersList(players);
}

async function recoverPlayingState(gamePin) {
    console.log('🎮 HOST: Recovering playing state');
    
    hideElement('quiz-selection');
    hideElement('game-lobby');
    showElement('active-game');
    
    document.getElementById('total-questions').textContent = hostCurrentQuiz.questions.length;
    
    // Get current game state from Firebase
    const gameStateRef = database.ref(`games/${gamePin}/gameState`);
    const gameStateSnapshot = await gameStateRef.once('value');
    const gameState = gameStateSnapshot.val();
    
    if (gameState) {
        hostQuestionIndex = gameState.currentQuestion || 0;
        questionStartTime = gameState.questionStartTime;
    }
    
    // Display current question
    await displayQuestion(hostQuestionIndex);
    
    // Set up listeners
    hostGameInstance.listenToPlayers(updatePlayerResponses);
    
    // Get current players
    const playersRef = database.ref(`games/${gamePin}/players`);
    const playersSnapshot = await playersRef.once('value');
    const players = playersSnapshot.val() || {};
    updatePlayerResponses(players);
    
    saveHostState('playing');
}

async function recoverResultsState(gamePin) {
    console.log('🏆 HOST: Recovering results state');
    
    // Get final results
    const playersRef = database.ref(`games/${gamePin}/players`);
    const snapshot = await playersRef.once('value');
    const players = snapshot.val() || {};
    
    hostCurrentPlayers = players;
    showResults();
}

// State Persistence Functions
function saveHostState(gameState = 'lobby') {
    try {
        localStorage.setItem(STATE_KEYS.IS_HOST_ACTIVE, 'true');
        
        if (hostGameInstance && hostGameInstance.gamePin) {
            localStorage.setItem(STATE_KEYS.GAME_PIN, hostGameInstance.gamePin);
        }
        
        if (hostCurrentQuiz) {
            localStorage.setItem(STATE_KEYS.CURRENT_QUIZ, JSON.stringify(hostCurrentQuiz));
        }
        
        localStorage.setItem(STATE_KEYS.GAME_STATE, gameState);
        localStorage.setItem(STATE_KEYS.QUESTION_INDEX, hostQuestionIndex.toString());
        
        console.log('💾 HOST: State saved:', {
            gameState,
            questionIndex: hostQuestionIndex,
            hasQuiz: !!hostCurrentQuiz
        });
    } catch (error) {
        console.error('Error saving host state:', error);
    }
}

function clearHostState() {
    console.log('🧹 HOST: Clearing saved state');
    Object.values(STATE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });
}

function showUserStatus(user) {
    console.log('👤 HOST: Showing user status for:', user.email);
    
    // Remove existing user header if present
    const existingHeader = document.querySelector('.user-header');
    if (existingHeader) {
        existingHeader.remove();
    }
    
    const userHeaderHTML = `
        <div class="user-header" style="position: absolute; top: 20px; right: 20px; display: flex; align-items: center; gap: 15px; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); padding: 10px 20px; border-radius: 25px; border: 1px solid rgba(255, 255, 255, 0.2); z-index: 1000;">
            <div class="user-info" style="color: white; font-size: 14px;">
                <div class="user-name" style="font-weight: bold; margin-bottom: 2px;">${user.displayName || user.email.split('@')[0]}</div>
                <div class="user-email" style="opacity: 0.8; font-size: 12px;">${user.email}</div>
            </div>
            <button onclick="signOut()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 12px; border-radius: 15px; cursor: pointer; font-size: 12px;">Sign Out</button>
        </div>
    `;
    document.body.insertAdjacentHTML('afterbegin', userHeaderHTML);
}

async function loadAvailableQuizzes() {
    console.log('📚 HOST: Loading available quizzes...');
    const quizList = document.getElementById('quiz-list');
    
    if (!quizList) {
        console.error('❌ HOST: Quiz list element not found');
        return;
    }
    
    quizList.innerHTML = '<div style="text-align: center; padding: 20px;">Loading quizzes...</div>';
    
    let hasQuizzes = false;
    let loadedQuizIds = new Set();
    
    try {
        // Load user's saved quizzes first
        console.log('🔍 HOST: Loading user quizzes...');
        const savedQuizzes = await loadUserQuizzes();
        console.log('📝 HOST: Found saved quizzes:', savedQuizzes.length);
        
        quizList.innerHTML = ''; // Clear loading message
        
        // Add saved quizzes
        if (savedQuizzes && savedQuizzes.length > 0) {
            savedQuizzes.forEach(quiz => {
                if (!loadedQuizIds.has(quiz.id)) {
                    const quizCard = document.createElement('div');
                    quizCard.className = 'menu-card';
                    quizCard.innerHTML = `
                        <div style="text-align: left;">
                            <h3>${quiz.title}</h3>
                            <p>${quiz.questions.length} questions</p>
                            <p><small>💾 Created: ${new Date(quiz.createdAt).toLocaleDateString()}</small></p>
                            ${quiz.updatedAt && quiz.updatedAt !== quiz.createdAt ? 
                                `<p><small>Updated: ${new Date(quiz.updatedAt).toLocaleDateString()}</small></p>` : ''}
                        </div>
                        <button onclick="selectQuiz('${quiz.id}', 'saved')" class="btn btn-primary">Select Quiz</button>
                    `;
                    quizList.appendChild(quizCard);
                    loadedQuizIds.add(quiz.id);
                    hasQuizzes = true;
                }
            });
        }
        
        // Add sample quizzes
        if (typeof sampleQuizzes !== 'undefined' && sampleQuizzes && sampleQuizzes.length > 0) {
            console.log('📚 HOST: Adding sample quizzes:', sampleQuizzes.length);
            
            sampleQuizzes.forEach(quiz => {
                if (!loadedQuizIds.has(quiz.id)) {
                    const quizCard = document.createElement('div');
                    quizCard.className = 'menu-card';
                    quizCard.innerHTML = `
                        <div style="text-align: left;">
                            <h3>${quiz.title}</h3>
                            <p>${quiz.questions.length} questions</p>
                            <p><small><strong>📚 Sample Quiz</strong></small></p>
                        </div>
                        <button onclick="selectQuiz('${quiz.id}', 'sample')" class="btn btn-primary">Select Quiz</button>
                    `;
                    quizList.appendChild(quizCard);
                    loadedQuizIds.add(quiz.id);
                    hasQuizzes = true;
                }
            });
        }
        
        if (!hasQuizzes) {
            quizList.innerHTML = `
                <div class="menu-card">
                    <div style="text-align: center; color: #666;">
                        <h3>No Quizzes Available</h3>
                        <p>Create your first quiz to get started!</p>
                        <button onclick="createCustomQuiz()" class="btn btn-tertiary">Create New Quiz</button>
                    </div>
                </div>
            `;
        }
        
        console.log('✅ HOST: Quiz loading complete. Total quizzes:', loadedQuizIds.size);
        
    } catch (error) {
        console.error('💥 HOST: Error loading quizzes:', error);
        quizList.innerHTML = `
            <div class="menu-card">
                <div style="text-align: center; color: #666;">
                    <h3>Error Loading Quizzes</h3>
                    <p>Please try refreshing the page</p>
                    <button onclick="loadAvailableQuizzes()" class="btn btn-primary">Retry</button>
                </div>
            </div>
        `;
    }
}

async function loadUserQuizzes() {
    try {
        console.log('📊 HOST: Loading user quizzes...');
        
        // Use the enhanced loading system from config.js
        if (typeof loadAllQuizzes === 'function') {
            const quizzes = await loadAllQuizzes();
            console.log('✅ HOST: Loaded via loadAllQuizzes:', quizzes.length);
            return quizzes;
        } 
        
        // Fallback to session manager
        if (typeof sessionManager !== 'undefined' && sessionManager) {
            const quizzes = sessionManager.getSessionQuizzes();
            console.log('✅ HOST: Loaded via sessionManager:', quizzes.length);
            return quizzes;
        }
        
        // Final fallback to localStorage
        const savedQuizzes = localStorage.getItem('savedQuizzes');
        const quizzes = savedQuizzes ? JSON.parse(savedQuizzes) : [];
        console.log('✅ HOST: Loaded via localStorage:', quizzes.length);
        return quizzes;
        
    } catch (error) {
        console.error('💥 HOST: Error in loadUserQuizzes:', error);
        return [];
    }
}

function selectQuiz(quizId, source = 'sample') {
    console.log('🎯 HOST: Selecting quiz:', quizId, 'from source:', source);
    
    let selectedQuiz = null;
    
    if (source === 'sample') {
        selectedQuiz = sampleQuizzes.find(q => q.id === quizId);
    } else if (source === 'saved') {
        loadUserQuizzes().then(quizzes => {
            selectedQuiz = quizzes.find(q => q.id === quizId);
            if (selectedQuiz) {
                proceedWithQuizSelection(selectedQuiz);
            } else {
                console.error('❌ HOST: Quiz not found:', quizId);
                showStatus('Quiz not found or invalid quiz format', 'error');
            }
        });
        return;
    }
    
    if (selectedQuiz) {
        proceedWithQuizSelection(selectedQuiz);
    } else {
        console.error('❌ HOST: Quiz not found:', quizId);
        showStatus('Quiz not found or invalid quiz format', 'error');
    }
}

function proceedWithQuizSelection(selectedQuiz) {
    if (selectedQuiz && selectedQuiz.questions && selectedQuiz.questions.length > 0) {
        console.log('✅ HOST: Quiz selected successfully:', selectedQuiz.title);
        hostCurrentQuiz = selectedQuiz;
        createGameSession();
    } else {
        console.error('❌ HOST: Invalid quiz format or no questions');
        showStatus('Invalid quiz format or no questions found', 'error');
    }
}

async function createGameSession() {
    console.log('🎮 HOST: Creating game session with quiz:', hostCurrentQuiz.title);
    
    const gamePin = generateGamePin();
    hostGameInstance = new QuizGame(gamePin, true);
    hostQuestionIndex = 0;
    
    try {
        const success = await hostGameInstance.createGame(hostCurrentQuiz);
        if (success) {
            console.log('✅ HOST: Game created successfully with PIN:', gamePin);
            document.getElementById('game-pin').textContent = gamePin;
            hideElement('quiz-selection');
            showElement('game-lobby');
            
            hostGameInstance.listenToPlayers(updatePlayersList);
            showStatus('Game created! Share PIN: ' + gamePin, 'success');
            
            // Save state for recovery
            saveHostState('lobby');
        } else {
            throw new Error('Failed to create game in database');
        }
    } catch (error) {
        console.error('💥 HOST: Game creation error:', error);
        showStatus('Failed to create game: ' + error.message, 'error');
    }
}

function updatePlayersList(players) {
    hostCurrentPlayers = players;
    const playerCount = Object.keys(players).length;
    const playersContainer = document.getElementById('players-container');
    const playerCountEl = document.getElementById('player-count');
    
    playerCountEl.textContent = playerCount;
    playersContainer.innerHTML = '';
    
    Object.values(players).forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        playerItem.innerHTML = `
            <span class="player-name">${player.name}</span>
            <span class="player-status status-${player.status}">${player.status}</span>
        `;
        playersContainer.appendChild(playerItem);
    });
    
    const startBtn = document.getElementById('start-btn');
    if (playerCount > 0) {
        startBtn.disabled = false;
        startBtn.textContent = `Start Quiz (${playerCount} players)`;
    } else {
        startBtn.disabled = true;
        startBtn.textContent = 'Waiting for players...';
    }
}

async function startQuiz() {
    if (!hostGameInstance || !hostCurrentQuiz) return;
    
    const success = await hostGameInstance.startGame();
    if (success) {
        hideElement('game-lobby');
        showElement('active-game');
        
        hostCurrentQuizData = hostCurrentQuiz;
        hostQuestionIndex = 0;
        hostGameInstance.currentQuestion = 0;
        
        document.getElementById('total-questions').textContent = hostCurrentQuiz.questions.length;
        
        displayQuestion(0);
        hostGameInstance.listenToPlayers(updatePlayerResponses);
        
        showStatus('Quiz started!', 'success');
        
        // Save state for recovery
        saveHostState('playing');
    } else {
        showStatus('Failed to start quiz', 'error');
    }
}

async function displayQuestion(questionIndex) {
    if (!hostCurrentQuizData || questionIndex >= hostCurrentQuizData.questions.length) {
        showResults();
        return;
    }
    
    hostQuestionIndex = questionIndex;
    const question = hostCurrentQuizData.questions[questionIndex];
    
    // Set question start time
    questionStartTime = Date.now();
    
    document.getElementById('current-q-num').textContent = questionIndex + 1;
    document.getElementById('host-question').textContent = question.question;
    
    const answersContainer = document.getElementById('host-answers');
    answersContainer.innerHTML = '';
    
    question.answers.forEach((answer, index) => {
        const answerDiv = document.createElement('div');
        answerDiv.className = 'answer-btn';
        answerDiv.textContent = answer;
        answersContainer.appendChild(answerDiv);
    });
    
    // Start question timer and update Firebase with start time
    await updateQuestionStartTime(questionIndex, question.timeLimit || 20);
    startQuestionTimer(question.timeLimit || 20);
    
    // Reset player answer states
    Object.keys(hostCurrentPlayers).forEach(playerId => {
        const playerRef = database.ref(`games/${hostGameInstance.gamePin}/players/${playerId}`);
        playerRef.update({
            status: 'waiting',
            currentAnswer: null,
            responseTime: null,
            questionScore: null,
            isCorrect: null
        });
    });
    
    hideElement('next-btn');
    hideElement('results-btn');
    
    // Update saved state
    saveHostState('playing');
}

async function updateQuestionStartTime(questionIndex, timeLimit) {
    try {
        const gameStateRef = database.ref(`games/${hostGameInstance.gamePin}/gameState`);
        await gameStateRef.update({
            currentQuestion: questionIndex,
            questionStartTime: questionStartTime,
            timeLimit: timeLimit,
            status: 'playing'
        });
    } catch (error) {
        console.error('Error updating question start time:', error);
    }
}

function startQuestionTimer(duration) {
    if (hostQuestionTimer) {
        clearInterval(hostQuestionTimer);
    }
    
    const timerDisplay = document.getElementById('host-timer');
    let timeLeft = duration;
    
    const updateTimer = () => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(hostQuestionTimer);
            hostQuestionTimer = null;
            onQuestionTimeUp();
        } else {
            timeLeft--;
        }
    };
    
    updateTimer();
    hostQuestionTimer = setInterval(updateTimer, 1000);
}

function onQuestionTimeUp() {
    const question = hostCurrentQuizData.questions[hostQuestionIndex];
    const answersContainer = document.getElementById('host-answers');
    const answerElements = answersContainer.children;
    
    // Highlight correct answer
    for (let i = 0; i < answerElements.length; i++) {
        if (i === question.correct) {
            answerElements[i].style.background = '#4caf50';
        } else {
            answerElements[i].style.background = '#f44336';
        }
    }
    
    // Calculate and update scores for all players
    calculateAndUpdateAllPlayerScores();
    
    if (hostQuestionIndex < hostCurrentQuizData.questions.length - 1) {
        showElement('next-btn');
    } else {
        showElement('results-btn');
    }
}

async function calculateAndUpdateAllPlayerScores() {
    const question = hostCurrentQuizData.questions[hostQuestionIndex];
    const questionTimeLimit = question.timeLimit || 20;
    
    const playerUpdates = {};
    
    Object.entries(hostCurrentPlayers).forEach(([playerId, player]) => {
        let score = 0;
        let scoreBreakdown = null;
        
        if (player.currentAnswer !== null && player.currentAnswer !== undefined) {
            const isCorrect = player.currentAnswer === question.correct;
            const responseTime = player.responseTime || questionTimeLimit;
            
            if (scoringSystem) {
                score = scoringSystem.calculateScore(isCorrect, responseTime, questionTimeLimit);
                scoreBreakdown = scoringSystem.getScoreBreakdown(isCorrect, responseTime, questionTimeLimit);
            } else {
                // Simple scoring fallback
                score = isCorrect ? 1000 : 0;
            }
        }
        
        playerUpdates[`${playerId}/questionScore`] = score;
        playerUpdates[`${playerId}/scoreBreakdown`] = scoreBreakdown;
        playerUpdates[`${playerId}/isCorrect`] = player.currentAnswer === question.correct;
    });
    
    try {
        const playersRef = database.ref(`games/${hostGameInstance.gamePin}/players`);
        await playersRef.update(playerUpdates);
        
        // Update total scores
        for (const [playerId, player] of Object.entries(hostCurrentPlayers)) {
            const questionScore = playerUpdates[`${playerId}/questionScore`] || 0;
            
            const playerRef = database.ref(`games/${hostGameInstance.gamePin}/players/${playerId}`);
            await playerRef.transaction((playerData) => {
                if (playerData) {
                    playerData.score = (playerData.score || 0) + questionScore;
                    return playerData;
                }
                return playerData;
            });
        }
    } catch (error) {
        console.error('Error updating player scores:', error);
    }
}

function updatePlayerResponses(players) {
    hostCurrentPlayers = players;
    const responsesContainer = document.getElementById('responses-container');
    responsesContainer.innerHTML = '';
    
    // Show individual player status (removed response summary)
    Object.values(players).forEach(player => {
        const responseItem = document.createElement('div');
        responseItem.className = 'player-item';
        
        let statusInfo = '';
        if (player.status === 'answered') {
            const responseTime = player.responseTime ? `${player.responseTime.toFixed(1)}s` : 'Unknown';
            statusInfo = `✅ Answered (${responseTime})`;
        } else {
            statusInfo = '⏳ Waiting...';
        }
        
        responseItem.innerHTML = `
            <span class="player-name">${player.name}</span>
            <div style="text-align: right;">
                <div class="player-status">${statusInfo}</div>
                ${player.questionScore !== undefined && player.questionScore !== null ? 
                    `<small>+${player.questionScore} points</small>` : ''}
            </div>
        `;
        responsesContainer.appendChild(responseItem);
    });
}

async function nextQuestion() {
    if (!hostGameInstance) return;
    
    const nextQuestionIndex = hostQuestionIndex + 1;
    
    try {
        const gameStateRef = database.ref(`games/${hostGameInstance.gamePin}/gameState`);
        await gameStateRef.update({
            currentQuestion: nextQuestionIndex,
            status: 'playing'
        });
        
        hostQuestionIndex = nextQuestionIndex;
        hostGameInstance.currentQuestion = nextQuestionIndex;
        
        displayQuestion(nextQuestionIndex);
    } catch (error) {
        console.error('Error moving to next question:', error);
        showStatus('Failed to move to next question', 'error');
    }
}

function showResults() {
    hideElement('active-game');
    showElement('results-screen');
    
    const leaderboard = document.getElementById('final-leaderboard');
    const sortedPlayers = Object.values(hostCurrentPlayers).sort((a, b) => (b.score || 0) - (a.score || 0));
    
    leaderboard.innerHTML = '<h3>🏆 Final Standings</h3>';
    
    sortedPlayers.forEach((player, index) => {
        const playerScore = document.createElement('div');
        playerScore.className = `player-score rank-${index + 1}`;
        playerScore.innerHTML = `
            <span class="player-name">#${index + 1} ${player.name}</span>
            <span class="player-points">${player.score || 0} points</span>
        `;
        leaderboard.appendChild(playerScore);
    });
    
    if (hostGameInstance) {
        hostGameInstance.endGame();
    }
    
    // Save final state
    saveHostState('results');
}

async function endQuiz() {
    if (confirm('Are you sure you want to end the quiz?')) {
        if (hostGameInstance) {
            await hostGameInstance.endGame();
            showResults();
        }
    }
}

function resetGame() {
    if (hostGameInstance) {
        hostGameInstance.cleanup();
    }
    
    if (hostQuestionTimer) {
        clearInterval(hostQuestionTimer);
        hostQuestionTimer = null;
    }
    
    // Clear state
    clearHostState();
    
    hostGameInstance = null;
    hostCurrentQuiz = null;
    hostCurrentQuizData = null;
    hostCurrentPlayers = {};
    hostQuestionIndex = 0;
    questionStartTime = null;
    
    hideElement('game-lobby');
    hideElement('active-game');
    hideElement('results-screen');
    showElement('quiz-selection');
    
    loadAvailableQuizzes();
}

function createCustomQuiz() {
    console.log('📝 HOST: Redirecting to quiz creation...');
    location.href = 'manage.html';
}

function showStatus(message, type) {
    console.log(`📢 HOST STATUS (${type}):`, message);
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

function hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'none';
}

function showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'block';
}

// Cleanup when leaving the page
window.addEventListener('beforeunload', () => {
    if (hostGameInstance) {
        hostGameInstance.cleanup();
    }
    if (hostQuestionTimer) {
        clearInterval(hostQuestionTimer);
        hostQuestionTimer = null;
    }
    
    // Only clear state if we're actually leaving the site, not just refreshing
    // The state will be cleared when the game naturally ends or user explicitly resets
});

// Handle page visibility changes (tab switching, etc.)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && document.getElementById('quiz-selection') && 
        document.getElementById('quiz-selection').style.display !== 'none' && 
        !isRecoveringState) {
        loadAvailableQuizzes();
    }
});

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 HOST: DOM loaded, starting initialization...');
    initializeHost();
});