// Host Page JavaScript - Requires Authentication
let hostCurrentQuiz = null;
let hostGameInstance = null;
let hostCurrentQuizData = null;
let hostQuestionTimer = null;
let hostCurrentPlayers = {};
let hostQuestionIndex = 0;

function initializeHost() {
    console.log('Host page initializing...');
    
    // Wait for Firebase to be ready
    if (typeof auth === 'undefined') {
        console.log('Waiting for Firebase auth to load...');
        setTimeout(initializeHost, 100);
        return;
    }
    
    // Check authentication and load quizzes
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log('Host authenticated:', user.email);
            showUserStatus(user);
            loadAvailableQuizzes();
        } else {
            console.log('Host not authenticated, redirecting...');
            showStatus('Login required to host quizzes', 'error');
            setTimeout(() => {
                window.location.href = 'auth.html';
            }, 2000);
        }
    });

    // Listen for user data updates (after login/migration)
    window.addEventListener('userDataUpdated', (event) => {
        console.log('User data updated, refreshing quiz list');
        loadAvailableQuizzes();
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

function loadAvailableQuizzes() {
    console.log('Loading available quizzes...');
    const quizList = document.getElementById('quiz-list');
    
    // Always clear the list first to prevent duplicates
    quizList.innerHTML = '<div style="text-align: center; padding: 20px;">Loading quizzes...</div>';
    
    let hasQuizzes = false;
    let loadedQuizIds = new Set(); // Track loaded quiz IDs to prevent duplicates
    
    // Function to add sample quizzes
    function addSampleQuizzes() {
        if (typeof sampleQuizzes !== 'undefined' && sampleQuizzes && sampleQuizzes.length > 0) {
            console.log('Adding sample quizzes:', sampleQuizzes.length);
            
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
    }
    
    // Function to add saved quizzes
    function addSavedQuizzes(savedQuizzes) {
        if (savedQuizzes && savedQuizzes.length > 0) {
            console.log('Adding saved quizzes:', savedQuizzes.length);
            
            savedQuizzes.forEach(quiz => {
                // Only add if we haven't already added this quiz
                if (!loadedQuizIds.has(quiz.id)) {
                    const quizCard = document.createElement('div');
                    quizCard.className = 'menu-card';
                    quizCard.innerHTML = `
                        <div style="text-align: left;">
                            <h3>${quiz.title}</h3>
                            <p>${quiz.questions.length} questions</p>
                            <p><small>💾 Created: ${new Date(quiz.createdAt).toLocaleDateString()}</small></p>
                        </div>
                        <button onclick="selectQuiz('${quiz.id}', 'saved')" class="btn btn-primary">Select Quiz</button>
                    `;
                    quizList.appendChild(quizCard);
                    loadedQuizIds.add(quiz.id);
                    hasQuizzes = true;
                }
            });
        }
    }
    
    // Load saved quizzes first, then add everything together
    loadUserQuizzes().then(savedQuizzes => {
        console.log('Loaded saved quizzes:', savedQuizzes.length);
        
        // Clear the loading message now that we have data
        quizList.innerHTML = '';
        
        // Add sample quizzes first
        addSampleQuizzes();
        
        // Add saved quizzes
        addSavedQuizzes(savedQuizzes);
        
        // Show message if no quizzes available
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
        
    }).catch(error => {
        console.error('Error loading user quizzes:', error);
        
        // Clear loading message
        quizList.innerHTML = '';
        
        // Still add sample quizzes even if saved quizzes fail to load
        addSampleQuizzes();
        
        // Show error message if no quizzes at all
        if (!hasQuizzes) {
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
    });
}

async function loadUserQuizzes() {
    try {
        // Check if the global loadAllQuizzes function exists
        if (typeof loadAllQuizzes === 'function') {
            // Use the enhanced system from config.js
            return await loadAllQuizzes();
        } else {
            console.log('loadAllQuizzes not available, using fallback');
            // Fallback to session data
            if (typeof sessionManager !== 'undefined' && sessionManager) {
                return sessionManager.getSessionQuizzes();
            } else {
                // Final fallback to localStorage
                const savedQuizzes = localStorage.getItem('savedQuizzes');
                return savedQuizzes ? JSON.parse(savedQuizzes) : [];
            }
        }
    } catch (error) {
        console.error('Error loading user quizzes:', error);
        // Fallback to localStorage on any error
        try {
            const savedQuizzes = localStorage.getItem('savedQuizzes');
            return savedQuizzes ? JSON.parse(savedQuizzes) : [];
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
            return [];
        }
    }
}

function selectQuiz(quizId, source = 'sample') {
    console.log('Selecting quiz:', quizId, 'from source:', source);
    
    let selectedQuiz = null;
    
    if (source === 'sample') {
        selectedQuiz = sampleQuizzes.find(q => q.id === quizId);
    } else if (source === 'saved') {
        // Try to find from loaded quizzes
        loadUserQuizzes().then(quizzes => {
            selectedQuiz = quizzes.find(q => q.id === quizId);
            if (selectedQuiz) {
                proceedWithQuizSelection(selectedQuiz);
            } else {
                console.error('Quiz not found:', quizId);
                showStatus('Quiz not found or invalid quiz format', 'error');
            }
        });
        return; // Exit early since we're handling this asynchronously
    }
    
    if (selectedQuiz) {
        proceedWithQuizSelection(selectedQuiz);
    } else {
        console.error('Quiz not found:', quizId);
        showStatus('Quiz not found or invalid quiz format', 'error');
    }
}

function proceedWithQuizSelection(selectedQuiz) {
    if (selectedQuiz && selectedQuiz.questions && selectedQuiz.questions.length > 0) {
        hostCurrentQuiz = selectedQuiz;
        createGameSession();
    } else {
        console.error('Invalid quiz format or no questions');
        showStatus('Invalid quiz format or no questions found', 'error');
    }
}

async function createGameSession() {
    console.log('Creating game session with quiz:', hostCurrentQuiz.title);
    
    const gamePin = generateGamePin();
    hostGameInstance = new QuizGame(gamePin, true);
    hostQuestionIndex = 0;
    
    const success = await hostGameInstance.createGame(hostCurrentQuiz);
    if (success) {
        document.getElementById('game-pin').textContent = gamePin;
        hideElement('quiz-selection');
        showElement('game-lobby');
        
        hostGameInstance.listenToPlayers(updatePlayersList);
        
        showStatus('Game created! Share the PIN with players.', 'success');
    } else {
        showStatus('Failed to create game. Please try again.', 'error');
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
    } else {
        showStatus('Failed to start quiz', 'error');
    }
}

function displayQuestion(questionIndex) {
    if (!hostCurrentQuizData || questionIndex >= hostCurrentQuizData.questions.length) {
        showResults();
        return;
    }
    
    hostQuestionIndex = questionIndex;
    const question = hostCurrentQuizData.questions[questionIndex];
    
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
    
    startQuestionTimer(question.timeLimit || 20);
    
    Object.keys(hostCurrentPlayers).forEach(playerId => {
        getPlayersRef(hostGameInstance.gamePin).child(playerId).update({
            status: 'waiting',
            currentAnswer: null
        });
    });
    
    hideElement('next-btn');
    hideElement('results-btn');
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
    
    for (let i = 0; i < answerElements.length; i++) {
        if (i === question.correct) {
            answerElements[i].classList.add('correct');
        } else {
            answerElements[i].classList.add('incorrect');
        }
    }
    
    calculateAndUpdateScores();
    
    if (hostQuestionIndex < hostCurrentQuizData.questions.length - 1) {
        showElement('next-btn');
    } else {
        showElement('results-btn');
    }
}

function calculateAndUpdateScores() {
    const question = hostCurrentQuizData.questions[hostQuestionIndex];
    const questionTimeLimit = question.timeLimit || 20;
    
    Object.entries(hostCurrentPlayers).forEach(([playerId, player]) => {
        if (player.currentAnswer !== null && player.currentAnswer !== undefined) {
            const isCorrect = player.currentAnswer === question.correct;
            const score = calculateScore(isCorrect, questionTimeLimit - 5, questionTimeLimit);
            
            getPlayersRef(hostGameInstance.gamePin).child(playerId).transaction((playerData) => {
                if (playerData) {
                    playerData.score = (playerData.score || 0) + score;
                    return playerData;
                }
                return playerData;
            });
        }
    });
}

function updatePlayerResponses(players) {
    hostCurrentPlayers = players;
    const responsesContainer = document.getElementById('responses-container');
    responsesContainer.innerHTML = '';
    
    Object.values(players).forEach(player => {
        const responseItem = document.createElement('div');
        responseItem.className = 'player-item';
        
        let answerText = 'Not answered';
        if (player.currentAnswer !== null && player.currentAnswer !== undefined && hostCurrentQuizData) {
            const question = hostCurrentQuizData.questions[hostQuestionIndex];
            if (question && question.answers[player.currentAnswer]) {
                answerText = question.answers[player.currentAnswer];
            }
        }
        
        responseItem.innerHTML = `
            <span class="player-name">${player.name}</span>
            <div>
                <div class="player-status status-${player.status}">${player.status}</div>
                <small>${answerText}</small>
            </div>
        `;
        responsesContainer.appendChild(responseItem);
    });
}

async function nextQuestion() {
    if (!hostGameInstance) return;
    
    const nextQuestionIndex = hostQuestionIndex + 1;
    
    try {
        await getGameStateRef(hostGameInstance.gamePin).update({
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
    
    hostGameInstance = null;
    hostCurrentQuiz = null;
    hostCurrentQuizData = null;
    hostCurrentPlayers = {};
    hostQuestionIndex = 0;
    
    hideElement('game-lobby');
    hideElement('active-game');
    hideElement('results-screen');
    showElement('quiz-selection');
    
    loadAvailableQuizzes();
}

function createCustomQuiz() {
    location.href = 'manage.html';
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

// Cleanup when leaving the page
window.addEventListener('beforeunload', () => {
    if (hostGameInstance) {
        hostGameInstance.cleanup();
    }
    if (hostQuestionTimer) {
        clearInterval(hostQuestionTimer);
        hostQuestionTimer = null;
    }
});

// Auto-refresh quiz list when page becomes visible
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && document.getElementById('quiz-selection').style.display !== 'none') {
        loadAvailableQuizzes();
    }
});

// Auto-initialize when page loads
document.addEventListener('DOMContentLoaded', initializeHost);