// Player.js - Skip Database Connection Test (Fixed)
let playerGameInstance = null;
let playerId = null;
let playerName = null;
let currentGamePin = null;
let playerScore = 0;
let hasAnswered = false;
let questionStartTime = null;
let currentTimerInterval = null;
let currentQuestionData = null;

// Simple Answer Manager (built-in)
class SimpleAnswerManager {
    constructor() {
        this.questionStartTime = null;
        this.hasAnswered = false;
    }

    startQuestion(startTime) {
        this.questionStartTime = startTime || Date.now();
        this.hasAnswered = false;
    }

    getResponseTime() {
        if (!this.questionStartTime) return 0;
        return (Date.now() - this.questionStartTime) / 1000;
    }

    markAnswered() {
        this.hasAnswered = true;
    }

    canAnswer() {
        return !this.hasAnswered;
    }
}

// Simple Game Class (built-in)
class SimpleQuizGame {
    constructor(gamePin, isHost = false) {
        this.gamePin = gamePin;
        this.isHost = isHost;
    }

    async joinGame(playerName) {
        try {
            console.log('🎮 GAME: Joining game with name:', playerName);
            
            const playerId = Date.now().toString() + '_' + Math.floor(Math.random() * 1000);
            const playerData = {
                id: playerId,
                name: playerName,
                score: 0,
                status: 'waiting',
                joinedAt: Date.now()
            };

            console.log('📤 GAME: Writing player data to Firebase...');
            const playerRef = database.ref(`games/${this.gamePin}/players/${playerId}`);
            await playerRef.set(playerData);
            
            console.log('✅ GAME: Player data written successfully');
            return playerId;
        } catch (error) {
            console.error('💥 GAME: Error joining game:', error);
            return null;
        }
    }

    listenToGameState(callback) {
        console.log('🎧 GAME: Setting up game state listener');
        const gameStateRef = database.ref(`games/${this.gamePin}/gameState`);
        
        gameStateRef.on('value', (snapshot) => {
            const gameState = snapshot.val();
            console.log('📡 GAME: Game state update:', gameState);
            if (gameState) {
                callback(gameState);
            }
        }, (error) => {
            console.error('💥 GAME: Game state listener error:', error);
        });
    }

    listenToPlayers(callback) {
        console.log('👥 GAME: Setting up players listener');
        const playersRef = database.ref(`games/${this.gamePin}/players`);
        
        playersRef.on('value', (snapshot) => {
            const players = snapshot.val() || {};
            console.log('👥 GAME: Players update:', Object.keys(players).length, 'players');
            callback(players);
        }, (error) => {
            console.error('💥 GAME: Players listener error:', error);
        });
    }

    cleanup() {
        if (this.gamePin && typeof database !== 'undefined') {
            console.log('🧹 GAME: Cleaning up listeners');
            database.ref(`games/${this.gamePin}`).off();
        }
    }
}

let answerManager = null;

function initializePlayer() {
    console.log('🎮 PLAYER: Starting initialization...');
    
    // Initialize answer manager
    answerManager = new SimpleAnswerManager();
    
    // Get player info from localStorage
    currentGamePin = localStorage.getItem('gamePin');
    playerName = localStorage.getItem('playerName');
    
    console.log('🎮 PLAYER: Retrieved - PIN:', currentGamePin, 'Name:', playerName);
    
    if (!currentGamePin || !playerName) {
        console.error('❌ PLAYER: Missing game information');
        showStatus('Invalid game information. Please refresh and try again.', 'error');
        return;
    }
    
    // Update UI immediately
    const gamePinEl = document.getElementById('player-game-pin');
    const playerNameEl = document.getElementById('player-name-display');
    
    if (gamePinEl) gamePinEl.textContent = currentGamePin;
    if (playerNameEl) playerNameEl.textContent = playerName;
    
    // Wait for Firebase to be ready
    waitForFirebaseReady();
}

function waitForFirebaseReady() {
    let attempts = 0;
    const maxAttempts = 40;
    
    function checkReady() {
        attempts++;
        console.log(`🔄 PLAYER: Firebase check ${attempts}/${maxAttempts}`);
        
        const firebaseReady = typeof firebase !== 'undefined';
        const databaseReady = typeof database !== 'undefined' && database && database.ref;
        
        console.log('🔍 PLAYER: Readiness check:', {
            firebase: firebaseReady,
            database: databaseReady
        });
        
        if (firebaseReady && databaseReady) {
            console.log('✅ PLAYER: Firebase and database ready!');
            setTimeout(() => {
                joinGame();
            }, 500);
        } else if (attempts >= maxAttempts) {
            console.error('❌ PLAYER: Timeout after', maxAttempts, 'attempts');
            showStatus('Connection timeout. Firebase/Database not loading.', 'error');
        } else {
            setTimeout(checkReady, 500);
        }
    }
    
    checkReady();
}

async function joinGame() {
    console.log('🚀 PLAYER: Starting join process...');
    showStatus('Checking game...', 'info');
    
    try {
        // SKIP DATABASE CONNECTION TEST - Go directly to game check
        console.log('⚡ PLAYER: Skipping database connection test, proceeding directly...');
        
        // Step 1: Check if game exists with detailed logging
        console.log('🔍 PLAYER: Checking if game exists...');
        const gameCheckResult = await checkGameExistsDetailed();
        
        if (!gameCheckResult.exists) {
            console.error('❌ PLAYER: Game not found -', gameCheckResult.reason);
            showStatus(gameCheckResult.message, 'error');
            return;
        }
        
        console.log('✅ PLAYER: Game found and joinable!');
        showStatus('Game found! Joining...', 'info');
        
        // Step 2: Create game instance and join
        playerGameInstance = new SimpleQuizGame(currentGamePin, false);
        playerId = await playerGameInstance.joinGame(playerName);
        
        if (!playerId) {
            throw new Error('Failed to get player ID from join operation');
        }
        
        console.log('🎉 PLAYER: Successfully joined with ID:', playerId);
        
        // Step 3: Update UI and set up listeners
        hideElement('joining-game');
        showElement('waiting-lobby');
        showStatus('Joined successfully!', 'success');
        
        // Step 4: Start listening for game updates
        console.log('🎧 PLAYER: Setting up listeners...');
        playerGameInstance.listenToGameState(onGameStateChange);
        playerGameInstance.listenToPlayers(onPlayersUpdate);
        
        console.log('✅ PLAYER: Setup complete! Waiting for game to start...');
        
    } catch (error) {
        console.error('💥 PLAYER: Join failed:', error);
        showStatus('Failed to join: ' + error.message, 'error');
    }
}

function checkGameExistsDetailed() {
    return new Promise((resolve) => {
        console.log('🔍 PLAYER: Detailed game check for PIN:', currentGamePin);
        
        const gameRef = database.ref(`games/${currentGamePin}`);
        
        const timeout = setTimeout(() => {
            console.error('⏰ PLAYER: Game check timeout');
            resolve({
                exists: false,
                reason: 'timeout',
                message: 'Connection timeout. Please check your internet and try again.'
            });
        }, 10000);
        
        gameRef.once('value', (snapshot) => {
            clearTimeout(timeout);
            const gameData = snapshot.val();
            
            console.log('📦 PLAYER: Game data received:', !!gameData);
            console.log('📊 PLAYER: Raw game data:', gameData);
            
            if (!gameData) {
                console.log('❌ PLAYER: No game data found');
                resolve({
                    exists: false,
                    reason: 'not_found',
                    message: 'Game not found. Please check the PIN and try again.'
                });
                return;
            }
            
            console.log('📋 PLAYER: Game details:', {
                hasQuiz: !!gameData.quiz,
                hasGameState: !!gameData.gameState,
                status: gameData.gameState?.status,
                quizTitle: gameData.quiz?.title,
                questionCount: gameData.quiz?.questions?.length,
                playerCount: Object.keys(gameData.players || {}).length
            });
            
            // Check if game has required data
            if (!gameData.quiz || !gameData.quiz.questions || gameData.quiz.questions.length === 0) {
                console.error('❌ PLAYER: Invalid quiz data');
                resolve({
                    exists: false,
                    reason: 'invalid_quiz',
                    message: 'Game has invalid quiz data.'
                });
                return;
            }
            
            // Check if game is joinable
            const gameStatus = gameData.gameState?.status;
            if (gameStatus && gameStatus !== 'waiting') {
                console.error('❌ PLAYER: Game not joinable, status:', gameStatus);
                resolve({
                    exists: false,
                    reason: 'game_started',
                    message: `Game has already ${gameStatus}. Cannot join now.`
                });
                return;
            }
            
            console.log('✅ PLAYER: Game is valid and joinable');
            resolve({
                exists: true,
                reason: 'success',
                message: 'Game found!'
            });
            
        }, (error) => {
            clearTimeout(timeout);
            console.error('💥 PLAYER: Database error during game check:', error);
            console.error('💥 PLAYER: Error details:', error.message, error.code);
            resolve({
                exists: false,
                reason: 'database_error',
                message: 'Database error: ' + error.message
            });
        });
    });
}

function onGameStateChange(gameState) {
    console.log('🎮 PLAYER: Game state changed:', gameState?.status);
    
    if (!gameState) {
        console.log('⚠️ PLAYER: No game state received');
        return;
    }
    
    switch (gameState.status) {
        case 'waiting':
            console.log('🏠 PLAYER: Game waiting - showing lobby');
            showWaitingLobby();
            break;
        case 'playing':
            console.log('🎯 PLAYER: Game playing - showing question');
            hasAnswered = false;
            if (answerManager) {
                answerManager.startQuestion(gameState.questionStartTime);
            }
            showActiveQuestion(gameState);
            break;
        case 'finished':
            console.log('🏁 PLAYER: Game finished - showing results');
            showFinalResults();
            break;
        default:
            console.log('❓ PLAYER: Unknown game status:', gameState.status);
    }
}

function onPlayersUpdate(players) {
    const playerCount = Object.keys(players).length;
    console.log('👥 PLAYER: Players update - count:', playerCount);
    
    // Update lobby count
    const countEl = document.getElementById('lobby-player-count');
    if (countEl) countEl.textContent = playerCount;
    
    // Update player score
    if (players[playerId]) {
        playerScore = players[playerId].score || 0;
        updateScoreDisplay();
    }
    
    updateLeaderboards(players);
}

function showWaitingLobby() {
    console.log('🏠 PLAYER: Showing lobby');
    hideAllScreens();
    showElement('waiting-lobby');
}

function showActiveQuestion(gameState) {
    console.log('❓ PLAYER: Showing question', gameState.currentQuestion);
    
    // Get question from Firebase
    database.ref(`games/${currentGamePin}`).once('value', (snapshot) => {
        const gameData = snapshot.val();
        const question = gameData?.quiz?.questions?.[gameState.currentQuestion];
        
        if (question) {
            console.log('📝 PLAYER: Question loaded:', question.question.substring(0, 50) + '...');
            displayQuestion(question, gameState.currentQuestion + 1);
        } else {
            console.error('❌ PLAYER: Question not found at index:', gameState.currentQuestion);
            showStatus('Error loading question', 'error');
        }
    }, (error) => {
        console.error('💥 PLAYER: Error fetching question:', error);
        showStatus('Error loading question', 'error');
    });
}

function displayQuestion(question, questionNumber) {
    console.log('📝 PLAYER: Displaying question', questionNumber);
    
    hideAllScreens();
    showElement('active-question');
    
    // Clear timer
    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
    }
    
    // Update UI
    document.getElementById('question-num').textContent = questionNumber;
    document.getElementById('question-text').textContent = question.question;
    
    // Create answer buttons
    const grid = document.getElementById('answers-grid');
    grid.innerHTML = '';
    hasAnswered = false;
    
    question.answers.forEach((answer, index) => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn';
        btn.textContent = answer;
        btn.onclick = () => selectAnswer(index);
        grid.appendChild(btn);
    });
    
    // Start timer
    startTimer(question.timeLimit || 20);
    hideElement('answer-feedback');
}

function startTimer(duration) {
    const display = document.getElementById('question-timer');
    let timeLeft = duration;
    
    const update = () => {
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(currentTimerInterval);
            onTimeout();
        } else {
            timeLeft--;
        }
    };
    
    update();
    currentTimerInterval = setInterval(update, 1000);
}

async function selectAnswer(answerIndex) {
    if (hasAnswered) {
        console.log('⚠️ PLAYER: Already answered, ignoring click');
        return;
    }
    
    console.log('✅ PLAYER: Selected answer:', answerIndex);
    hasAnswered = true;
    if (answerManager) {
        answerManager.markAnswered();
    }
    
    const responseTime = answerManager ? answerManager.getResponseTime() : 0;
    
    // Clear timer
    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
    }
    
    // Update UI
    const buttons = document.querySelectorAll('.answer-btn');
    buttons.forEach((btn, index) => {
        btn.disabled = true;
        if (index === answerIndex) {
            btn.style.transform = 'scale(1.05)';
            btn.style.border = '3px solid #fff';
        }
    });
    
    // Submit answer
    try {
        const playerRef = database.ref(`games/${currentGamePin}/players/${playerId}`);
        await playerRef.update({
            currentAnswer: answerIndex,
            responseTime: responseTime,
            status: 'answered',
            answerTime: Date.now()
        });
        
        console.log('📤 PLAYER: Answer submitted successfully');
        showFeedback(`Answer submitted! (${responseTime.toFixed(1)}s)`);
        setTimeout(showWaitingNext, 1500);
        
    } catch (error) {
        console.error('💥 PLAYER: Submit failed:', error);
        showStatus('Failed to submit answer', 'error');
        
        // Reset answer state so they can try again
        hasAnswered = false;
        if (answerManager) {
            answerManager = new SimpleAnswerManager();
        }
        
        buttons.forEach(btn => {
            btn.disabled = false;
            btn.style.transform = '';
            btn.style.border = '';
        });
    }
}

function onTimeout() {
    console.log('⏰ PLAYER: Question timeout');
    if (!hasAnswered) {
        hasAnswered = true;
        showFeedback('Time\'s up!');
        setTimeout(showWaitingNext, 1500);
    }
}

function showFeedback(message) {
    const feedback = document.getElementById('answer-feedback');
    const messageEl = document.getElementById('feedback-message');
    if (messageEl) messageEl.textContent = message;
    showElement('answer-feedback');
}

function showWaitingNext() {
    console.log('⏳ PLAYER: Waiting for next question');
    hideAllScreens();
    showElement('waiting-next');
    updateScoreDisplay();
}

function updateScoreDisplay() {
    const scoreEl = document.getElementById('current-score');
    if (scoreEl) scoreEl.textContent = playerScore;
    
    const finalEl = document.getElementById('player-final-score');
    if (finalEl) finalEl.textContent = `${playerScore} points`;
}

function updateLeaderboards(players) {
    const sorted = Object.values(players).sort((a, b) => (b.score || 0) - (a.score || 0));
    
    updateLeaderboard('current-leaderboard', sorted.slice(0, 5));
    updateLeaderboard('final-leaderboard-player', sorted);
    
    const rank = sorted.findIndex(p => p.id === playerId) + 1;
    const rankEl = document.getElementById('player-final-rank');
    if (rankEl) rankEl.textContent = `#${rank} of ${sorted.length}`;
}

function updateLeaderboard(elementId, players) {
    const board = document.getElementById(elementId);
    if (!board) return;
    
    board.innerHTML = '<h3>🏆 Leaderboard</h3>';
    
    players.forEach((player, index) => {
        const div = document.createElement('div');
        div.className = `player-score ${index < 3 ? `rank-${index + 1}` : ''}`;
        
        if (player.id === playerId) {
            div.style.backgroundColor = '#e3f2fd';
            div.style.fontWeight = 'bold';
        }
        
        div.innerHTML = `
            <span>#${index + 1} ${player.name} ${player.id === playerId ? '(You)' : ''}</span>
            <span>${player.score || 0} points</span>
        `;
        board.appendChild(div);
    });
}

function showFinalResults() {
    console.log('🏁 PLAYER: Showing final results');
    
    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
    }
    
    hideAllScreens();
    showElement('final-results');
    updateScoreDisplay();
}

function hideAllScreens() {
    const screens = ['joining-game', 'waiting-lobby', 'active-question', 'waiting-next', 'final-results'];
    screens.forEach(hideElement);
}

function hideElement(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

function showElement(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'block';
}

function showStatus(message, type) {
    console.log(`📢 PLAYER (${type}):`, message);
    const status = document.getElementById('status');
    if (status) {
        status.textContent = message;
        status.className = `status-message ${type}`;
        setTimeout(() => {
            status.textContent = '';
            status.className = 'status-message';
        }, 3000);
    }
}

// Cleanup
window.addEventListener('beforeunload', () => {
    console.log('🧹 PLAYER: Page unloading - cleanup');
    if (currentTimerInterval) clearInterval(currentTimerInterval);
    if (playerGameInstance) playerGameInstance.cleanup();
    localStorage.removeItem('gamePin');
    localStorage.removeItem('playerName');
});

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializePlayer);