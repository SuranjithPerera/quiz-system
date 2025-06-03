// Player.js - Enhanced with Proper Scoring and Timer Fixes - COMPLETE VERSION
let playerGameInstance = null;
let playerGamePlayerId = null;
let playerGamePlayerName = null;
let currentGamePin = null;
let playerScore = 0;
let hasAnswered = false;
let questionStartTime = null;
let currentTimerInterval = null;
let currentQuestionData = null;
let isRecoveringState = false;
let isQuestionActive = true;
let questionEndTime = null;
let previousScore = 0; // Track previous score for animations

// State persistence keys for player
const PLAYER_STATE_KEYS = {
    GAME_PIN: 'player_game_pin',
    PLAYER_NAME: 'player_player_name',
    PLAYER_ID: 'player_player_id',
    GAME_STATE: 'player_game_state',
    IS_ACTIVE: 'player_is_active',
    CURRENT_SCORE: 'player_current_score'
};

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
            
            const newPlayerId = Date.now().toString() + '_' + Math.floor(Math.random() * 1000);
            const playerData = {
                id: newPlayerId,
                name: playerName,
                score: 0,
                status: 'waiting',
                joinedAt: Date.now()
            };

            console.log('📤 GAME: Writing player data to Firebase...');
            const playerRef = database.ref(`games/${this.gamePin}/players/${newPlayerId}`);
            await playerRef.set(playerData);
            
            console.log('✅ GAME: Player data written successfully');
            return newPlayerId;
        } catch (error) {
            console.error('💥 GAME: Error joining game:', error);
            return null;
        }
    }

    async rejoinGame(existingPlayerId, playerName) {
        try {
            console.log('🔄 GAME: Rejoining game with existing ID:', existingPlayerId);
            
            const playerRef = database.ref(`games/${this.gamePin}/players/${existingPlayerId}`);
            
            // Check if player still exists in the game
            const snapshot = await playerRef.once('value');
            if (!snapshot.exists()) {
                console.log('❌ GAME: Player no longer exists, creating new...');
                return await this.joinGame(playerName);
            }
            
            // Update rejoined status
            await playerRef.update({
                status: 'waiting',
                rejoinedAt: Date.now()
            });
            
            console.log('✅ GAME: Successfully rejoined game');
            return existingPlayerId;
        } catch (error) {
            console.error('💥 GAME: Error rejoining game:', error);
            // Fallback to new join
            return await this.joinGame(playerName);
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
    
    // Check for state recovery first
    const needsRecovery = checkForStateRecovery();
    
    if (needsRecovery) {
        console.log('🔄 PLAYER: Recovery needed, starting recovery process...');
        waitForFirebaseReady(() => {
            recoverPlayerState();
        });
    } else {
        // Get player info from localStorage (new join)
        currentGamePin = localStorage.getItem('gamePin');
        playerGamePlayerName = localStorage.getItem('playerName');
        
        console.log('🎮 PLAYER: Retrieved - PIN:', currentGamePin, 'Name:', playerGamePlayerName);
        
        if (!currentGamePin || !playerGamePlayerName) {
            console.error('❌ PLAYER: Missing game information');
            showStatus('Invalid game information. Please refresh and try again.', 'error');
            return;
        }
        
        // Update UI immediately
        const gamePinEl = document.getElementById('player-game-pin');
        const playerNameEl = document.getElementById('player-name-display');
        
        if (gamePinEl) gamePinEl.textContent = currentGamePin;
        if (playerNameEl) playerNameEl.textContent = playerGamePlayerName;
        
        // Wait for Firebase to be ready
        waitForFirebaseReady(() => {
            joinGame();
        });
    }
}

// State Recovery Functions (keeping existing logic)
function checkForStateRecovery() {
    const isActive = localStorage.getItem(PLAYER_STATE_KEYS.IS_ACTIVE);
    const savedGamePin = localStorage.getItem(PLAYER_STATE_KEYS.GAME_PIN);
    const savedPlayerId = localStorage.getItem(PLAYER_STATE_KEYS.PLAYER_ID);
    const savedPlayerName = localStorage.getItem(PLAYER_STATE_KEYS.PLAYER_NAME);
    const savedGameState = localStorage.getItem(PLAYER_STATE_KEYS.GAME_STATE);
    
    console.log('🔍 PLAYER: Checking recovery state:', {
        isActive: !!isActive,
        hasGamePin: !!savedGamePin,
        hasPlayerId: !!savedPlayerId,
        hasPlayerName: !!savedPlayerName,
        gameState: savedGameState
    });
    
    // Don't recover if game is finished
    if (savedGameState === 'finished') {
        console.log('🏁 PLAYER: Game was finished, clearing state instead of recovering');
        clearPlayerState();
        return false;
    }
    
    return isActive && savedGamePin && savedPlayerId && savedPlayerName && savedGameState !== 'finished';
}

async function recoverPlayerState() {
    console.log('🔄 PLAYER: Starting state recovery...');
    isRecoveringState = true;
    
    try {
        // Get saved state
        currentGamePin = localStorage.getItem(PLAYER_STATE_KEYS.GAME_PIN);
        playerGamePlayerId = localStorage.getItem(PLAYER_STATE_KEYS.PLAYER_ID);
        playerGamePlayerName = localStorage.getItem(PLAYER_STATE_KEYS.PLAYER_NAME);
        const savedGameState = localStorage.getItem(PLAYER_STATE_KEYS.GAME_STATE);
        const savedScore = localStorage.getItem(PLAYER_STATE_KEYS.CURRENT_SCORE);
        
        if (savedScore) {
            playerScore = parseInt(savedScore) || 0;
            previousScore = playerScore;
        }
        
        console.log('📝 PLAYER: Recovered state:', {
            gamePin: currentGamePin,
            playerId: playerGamePlayerId,
            playerName: playerGamePlayerName,
            gameState: savedGameState,
            score: playerScore
        });
        
        // Update UI
        const gamePinEl = document.getElementById('player-game-pin');
        const playerNameEl = document.getElementById('player-name-display');
        
        if (gamePinEl) gamePinEl.textContent = currentGamePin;
        if (playerNameEl) playerNameEl.textContent = playerGamePlayerName;
        
        // Check if game still exists
        const gameExists = await checkGameExists(currentGamePin);
        if (!gameExists) {
            console.log('❌ PLAYER: Game no longer exists');
            clearPlayerState();
            showStatus('Game no longer exists', 'error');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 3000);
            return;
        }
        
        // Rejoin the game
        playerGameInstance = new SimpleQuizGame(currentGamePin, false);
        const rejoinedPlayerId = await playerGameInstance.rejoinGame(playerGamePlayerId, playerGamePlayerName);
        
        if (rejoinedPlayerId) {
            playerGamePlayerId = rejoinedPlayerId;
            
            // Get current game state to determine which screen to show
            const gameStateRef = database.ref(`games/${currentGamePin}/gameState`);
            const gameStateSnapshot = await gameStateRef.once('value');
            const currentGameState = gameStateSnapshot.val();
            
            if (currentGameState) {
                await recoverToCorrectScreen(currentGameState, savedGameState);
            } else {
                // Default to lobby
                showWaitingLobby();
            }
            
            // Set up listeners
            playerGameInstance.listenToGameState(onGameStateChange);
            playerGameInstance.listenToPlayers(onPlayersUpdate);
            
            showStatus('Reconnected to game!', 'success');
            console.log('✅ PLAYER: State recovery complete');
        } else {
            throw new Error('Failed to rejoin game');
        }
        
    } catch (error) {
        console.error('💥 PLAYER: Recovery failed:', error);
        clearPlayerState();
        showStatus('Failed to reconnect to game', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);
    } finally {
        isRecoveringState = false;
    }
}

async function recoverToCorrectScreen(currentGameState, savedGameState) {
    console.log('🎯 PLAYER: Recovering to correct screen:', currentGameState.status);
    
    switch (currentGameState.status) {
        case 'waiting':
            showWaitingLobby();
            break;
        case 'playing':
            // Get current question and show it
            const gameRef = database.ref(`games/${currentGamePin}`);
            const gameSnapshot = await gameRef.once('value');
            const gameData = gameSnapshot.val();
            
            if (gameData && gameData.quiz && gameData.quiz.questions) {
                const currentQuestion = gameData.quiz.questions[currentGameState.currentQuestion];
                if (currentQuestion) {
                    showActiveQuestion(currentGameState);
                } else {
                    showWaitingNext();
                }
            } else {
                showWaitingLobby();
            }
            break;
        case 'question_ended':
            // Question time is up, wait for next question
            showWaitingNext();
            break;
        case 'finished':
            showFinalResults();
            break;
        default:
            showWaitingLobby();
    }
}

async function checkGameExists(gamePin) {
    try {
        const gameRef = database.ref(`games/${gamePin}`);
        const snapshot = await gameRef.once('value');
        return snapshot.exists();
    } catch (error) {
        console.error('Error checking game existence:', error);
        return false;
    }
}

function savePlayerState(gameState = 'lobby') {
    try {
        localStorage.setItem(PLAYER_STATE_KEYS.IS_ACTIVE, 'true');
        localStorage.setItem(PLAYER_STATE_KEYS.GAME_PIN, currentGamePin);
        localStorage.setItem(PLAYER_STATE_KEYS.PLAYER_ID, playerGamePlayerId);
        localStorage.setItem(PLAYER_STATE_KEYS.PLAYER_NAME, playerGamePlayerName);
        localStorage.setItem(PLAYER_STATE_KEYS.GAME_STATE, gameState);
        localStorage.setItem(PLAYER_STATE_KEYS.CURRENT_SCORE, playerScore.toString());
        
        console.log('💾 PLAYER: State saved:', {
            gamePin: currentGamePin,
            playerId: playerGamePlayerId,
            gameState,
            score: playerScore
        });
    } catch (error) {
        console.error('Error saving player state:', error);
    }
}

function clearPlayerState() {
    console.log('🧹 PLAYER: Clearing saved state');
    Object.values(PLAYER_STATE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });
    
    // Also clear the original localStorage items
    localStorage.removeItem('gamePin');
    localStorage.removeItem('playerName');
    
    // Reset all global variables
    currentGamePin = null;
    playerGamePlayerId = null;
    playerGamePlayerName = null;
    playerScore = 0;
    previousScore = 0;
    hasAnswered = false;
    isQuestionActive = true;
    questionEndTime = null;
    
    console.log('✅ PLAYER: All state cleared');
}

function waitForFirebaseReady(callback) {
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
                callback();
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
        playerGamePlayerId = await playerGameInstance.joinGame(playerGamePlayerName);
        
        if (!playerGamePlayerId) {
            throw new Error('Failed to get player ID from join operation');
        }
        
        console.log('🎉 PLAYER: Successfully joined with ID:', playerGamePlayerId);
        
        // Step 3: Update UI and set up listeners
        hideElement('joining-game');
        showElement('waiting-lobby');
        showStatus('Joined successfully!', 'success');
        
        // Step 4: Start listening for game updates
        console.log('🎧 PLAYER: Setting up listeners...');
        playerGameInstance.listenToGameState(onGameStateChange);
        playerGameInstance.listenToPlayers(onPlayersUpdate);
        
        // Save initial state
        savePlayerState('lobby');
        
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
            
            if (!gameData) {
                console.log('❌ PLAYER: No game data found');
                resolve({
                    exists: false,
                    reason: 'not_found',
                    message: 'Game not found. Please check the PIN and try again.'
                });
                return;
            }
            
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
            if (gameStatus && gameStatus !== 'waiting' && gameStatus !== 'playing') {
                console.error('❌ PLAYER: Game not joinable, status:', gameStatus);
                resolve({
                    exists: false,
                    reason: 'game_finished',
                    message: `Game has ${gameStatus}. Cannot join now.`
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
            resolve({
                exists: false,
                reason: 'database_error',
                message: 'Database error: ' + error.message
            });
        });
    });
}

// ENHANCED: Handle game state changes with proper scoring updates
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
            savePlayerState('lobby');
            break;
        case 'playing':
            console.log('🎯 PLAYER: Game playing - showing question');
            hasAnswered = false;
            isQuestionActive = true;
            questionEndTime = null;
            if (answerManager) {
                answerManager.startQuestion(gameState.questionStartTime);
            }
            showActiveQuestion(gameState);
            savePlayerState('playing');
            break;
        case 'question_ended':
            console.log('⏰ PLAYER: Question ended - disabling answers and showing waiting screen');
            isQuestionActive = false;
            questionEndTime = gameState.questionEndTime || Date.now();
            
            // Clear timer if still running
            if (currentTimerInterval) {
                clearInterval(currentTimerInterval);
                currentTimerInterval = null;
            }
            
            // Update timer display to show "TIME'S UP"
            const timerEl = document.getElementById('question-timer');
            if (timerEl) {
                timerEl.textContent = "TIME'S UP";
                timerEl.style.background = 'linear-gradient(135deg, #e21b3c 0%, #ff4757 100%)';
                timerEl.style.animation = 'pulse 1s infinite';
            }
            
            // Disable answer buttons if still enabled
            const buttons = document.querySelectorAll('.answer-btn');
            buttons.forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = '0.6';
            });
            
            // Show feedback about time being up
            if (!hasAnswered) {
                showFeedback('Time\'s up! No answer submitted.');
            } else {
                showFeedback('Time\'s up! Answer submitted.');
            }
            
            // Auto-transition to waiting screen after a delay
            setTimeout(() => {
                showWaitingNext();
            }, 2000);
            
            savePlayerState('question-ended');
            break;
        case 'finished':
            console.log('🏁 PLAYER: Game finished - showing results');
            clearPlayerState();
            showFinalResults();
            break;
        case 'abandoned':
            console.log('👋 PLAYER: Game abandoned by host');
            showStatus('Game ended - host disconnected', 'info');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 3000);
            break;
        default:
            console.log('❓ PLAYER: Unknown game status:', gameState.status);
    }
}

// ENHANCED: Players update with proper scoring handling
function onPlayersUpdate(players) {
    const playerCount = Object.keys(players).length;
    console.log('👥 PLAYER: Players update - count:', playerCount);
    
    // Update lobby count
    const countEl = document.getElementById('lobby-player-count');
    if (countEl) countEl.textContent = playerCount;
    
    // ENHANCED: Update player score with animations
    if (players[playerGamePlayerId]) {
        const oldScore = playerScore;
        const newScore = players[playerGamePlayerId].score || 0;
        
        // Log score changes and show animations
        if (oldScore !== newScore) {
            console.log('🏆 PLAYER: Score updated from', oldScore, 'to', newScore);
            
            // Show score increase animation if score went up
            if (newScore > oldScore) {
                const increase = newScore - oldScore;
                showScoreIncrease(increase);
            }
            
            previousScore = oldScore;
            playerScore = newScore;
        }
        
        updateScoreDisplay();
        savePlayerState(); // Save updated score
    }
    
    updateLeaderboards(players);
}

// NEW: Score increase animation
function showScoreIncrease(points) {
    // Create floating score animation
    const scoreFloat = document.createElement('div');
    scoreFloat.textContent = `+${points}`;
    scoreFloat.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%);
        color: white;
        padding: 15px 25px;
        border-radius: 30px;
        font-size: 2rem;
        font-weight: 900;
        z-index: 10000;
        pointer-events: none;
        animation: scoreFloatUp 3s ease-out forwards;
        box-shadow: 0 10px 30px rgba(76, 175, 80, 0.5);
        border: 3px solid rgba(255, 255, 255, 0.8);
        text-shadow: 2px 2px 6px rgba(0, 0, 0, 0.3);
    `;
    
    document.body.appendChild(scoreFloat);
    
    setTimeout(() => {
        if (scoreFloat.parentNode) {
            scoreFloat.parentNode.removeChild(scoreFloat);
        }
    }, 3000);
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
    isQuestionActive = true;
    questionEndTime = null;
    
    question.answers.forEach((answer, index) => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn';
        btn.textContent = answer;
        btn.onclick = () => selectAnswer(index);
        grid.appendChild(btn);
    });
    
    // Start timer with EXACT 1-second intervals
    startTimerPlayer(question.timeLimit || 20);
    hideElement('answer-feedback');
}

// FIXED: Player timer with proper 1-second intervals
function startTimerPlayer(duration) {
    const display = document.getElementById('question-timer');
    let timeLeft = duration;
    
    // Clear existing timer
    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
    }
    
    const update = () => {
        // CRITICAL FIX: Display current timeLeft, then decrement
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        // Enhanced visual urgency indicators
        if (timeLeft <= 5) {
            display.style.background = 'linear-gradient(135deg, #e21b3c 0%, #ff4757 100%)';
            display.classList.add('urgent');
        } else if (timeLeft <= 10) {
            display.style.background = 'linear-gradient(135deg, #ff6900 0%, #ff8c00 100%)';
            display.classList.add('warning');
            display.classList.remove('urgent');
        } else {
            display.style.background = 'linear-gradient(135deg, #26d0ce 0%, #1dd1a1 100%)';
            display.classList.remove('urgent', 'warning');
            display.style.animation = 'none';
        }
        
        // Check if time is up AFTER displaying
        if (timeLeft <= 0) {
            clearInterval(currentTimerInterval);
            currentTimerInterval = null;
            onTimeout();
        } else {
            timeLeft--; // Decrement AFTER displaying
        }
    };
    
    // Update immediately, then every second
    update();
    currentTimerInterval = setInterval(update, 1000); // FIXED: Exactly 1000ms
}

// ENHANCED: Handle answer selection with better validation
async function selectAnswer(answerIndex) {
    // Enhanced validation
    if (hasAnswered || !isQuestionActive || questionEndTime) {
        console.log('⚠️ PLAYER: Cannot answer - conditions not met:', {
            hasAnswered,
            isQuestionActive,
            questionEnded: !!questionEndTime
        });
        return;
    }
    
    console.log('✅ PLAYER: Selected answer:', answerIndex);
    hasAnswered = true;
    if (answerManager) {
        answerManager.markAnswered();
    }
    
    // CRITICAL FIX: Calculate proper response time
    const responseTime = answerManager ? answerManager.getResponseTime() : 0;
    
    // Clear timer
    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
    }
    
    // Update UI - show selected answer
    const buttons = document.querySelectorAll('.answer-btn');
    buttons.forEach((btn, index) => {
        btn.disabled = true;
        if (index === answerIndex) {
            btn.style.transform = 'scale(1.05)';
            btn.style.border = '4px solid #fff';
            btn.style.boxShadow = '0 0 25px rgba(255, 255, 255, 0.7)';
            btn.style.zIndex = '1000';
        } else {
            btn.style.opacity = '0.6';
        }
    });
    
    // Submit answer
    try {
        const playerRef = database.ref(`games/${currentGamePin}/players/${playerGamePlayerId}`);
        await playerRef.update({
            currentAnswer: answerIndex,
            responseTime: responseTime,
            status: 'answered',
            answerTime: Date.now()
        });
        
        console.log('📤 PLAYER: Answer submitted successfully - Response time:', responseTime.toFixed(1), 'seconds');
        showFeedback(`Answer submitted! Response time: ${responseTime.toFixed(1)}s`);
        
        // Update timer to show "ANSWERED"
        const timerEl = document.getElementById('question-timer');
        if (timerEl) {
            timerEl.textContent = "ANSWERED";
            timerEl.style.background = 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)';
            timerEl.style.animation = 'none';
            timerEl.classList.remove('urgent', 'warning');
        }
        
    } catch (error) {
        console.error('💥 PLAYER: Submit failed:', error);
        showStatus('Failed to submit answer', 'error');
        
        // Reset answer state so they can try again if question is still active
        if (isQuestionActive && !questionEndTime) {
            hasAnswered = false;
            if (answerManager) {
                answerManager = new SimpleAnswerManager();
            }
            
            buttons.forEach(btn => {
                btn.disabled = false;
                btn.style.transform = '';
                btn.style.border = '';
                btn.style.boxShadow = '';
                btn.style.opacity = '';
                btn.style.zIndex = '';
            });
            
            // Restart timer if needed
            const timeLeftEstimate = Math.max(5, 20 - responseTime);
            startTimerPlayer(timeLeftEstimate);
        }
    }
}

// ENHANCED: Handle timeout with better state management
function onTimeout() {
    console.log('⏰ PLAYER: Question timeout on client side');
    isQuestionActive = false;
    questionEndTime = Date.now();
    
    if (!hasAnswered) {
        hasAnswered = true;
        
        // Disable all buttons with better visual feedback
        const buttons = document.querySelectorAll('.answer-btn');
        buttons.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.6';
            btn.style.cursor = 'not-allowed';
        });
        
        showFeedback('Time\'s up! No answer submitted.');
        
        // Update timer display
        const timerEl = document.getElementById('question-timer');
        if (timerEl) {
            timerEl.textContent = "TIME'S UP";
            timerEl.style.background = 'linear-gradient(135deg, #e21b3c 0%, #ff4757 100%)';
            timerEl.style.animation = 'pulse 1s infinite';
        }
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
    savePlayerState('waiting-next');
}

// ENHANCED: Score display with animations
function updateScoreDisplay() {
    const scoreEl = document.getElementById('current-score');
    if (scoreEl) {
        // Add animation class for score updates
        if (previousScore !== playerScore && playerScore > previousScore) {
            scoreEl.classList.add('score-updated');
            setTimeout(() => {
                scoreEl.classList.remove('score-updated');
            }, 1000);
        }
        scoreEl.textContent = playerScore;
    }
    
    const finalEl = document.getElementById('player-final-score');
    if (finalEl) finalEl.textContent = `${playerScore} points`;
}

function updateLeaderboards(players) {
    const sorted = Object.values(players).sort((a, b) => (b.score || 0) - (a.score || 0));
    
    updateLeaderboard('current-leaderboard', sorted.slice(0, 5));
    updateLeaderboard('final-leaderboard-player', sorted);
    
    const rank = sorted.findIndex(p => p.id === playerGamePlayerId) + 1;
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
        
        if (player.id === playerGamePlayerId) {
            div.style.backgroundColor = '#e3f2fd';
            div.style.fontWeight = 'bold';
            div.style.border = '3px solid #1368ce';
        }
        
        div.innerHTML = `
            <span>#${index + 1} ${player.name} ${player.id === playerGamePlayerId ? '(You)' : ''}</span>
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
    
    // Clear state immediately when game is finished
    clearPlayerState();
    
    // Also disable state recovery to prevent auto-redirect
    localStorage.removeItem('gamePin');
    localStorage.removeItem('playerName');
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

// Enhanced cleanup
window.addEventListener('beforeunload', () => {
    console.log('🧹 PLAYER: Page unloading - cleanup');
    if (currentTimerInterval) clearInterval(currentTimerInterval);
    if (playerGameInstance) playerGameInstance.cleanup();
    
    // Only clear localStorage items for new joins, keep state for recovery
    if (!isRecoveringState) {
        localStorage.removeItem('gamePin');
        localStorage.removeItem('playerName');
    }
});

// Handle page visibility changes for better mobile experience
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && playerGamePlayerId && currentGamePin) {
        // Page became visible again, save current state
        savePlayerState();
        console.log('📱 PLAYER: Page visible - state saved');
    }
});

// Handle Play Again button
function playAgain() {
    console.log('🔄 PLAYER: Play again clicked - clearing all state');
    clearPlayerState();
    window.location.href = 'index.html';
}

// Make play again function globally available
window.playAgain = playAgain;

// Add enhanced CSS for player scoring animations
const playerEnhancedCSS = `
<style id="player-enhanced-scoring">
/* Score animation keyframes */
@keyframes scoreFloatUp {
    0% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.5) rotate(-10deg);
    }
    15% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1.3) rotate(0deg);
    }
    85% {
        opacity: 1;
        transform: translate(-50%, -70%) scale(1) rotate(0deg);
    }
    100% {
        opacity: 0;
        transform: translate(-50%, -90%) scale(0.8) rotate(5deg);
    }
}

/* Score update animation for current score display */
@keyframes scoreUpdate {
    0% { transform: scale(1); }
    50% { transform: scale(1.2); color: #4caf50; }
    100% { transform: scale(1); }
}

.score-updated {
    animation: scoreUpdate 0.8s ease-out !important;
}

/* Enhanced timer states */
.timer.urgent {
    animation: urgentPulse 0.5s infinite !important;
    box-shadow: 0 0 30px rgba(226, 27, 60, 0.8) !important;
}

.timer.warning {
    animation: warningPulse 1s infinite !important;
    box-shadow: 0 0 20px rgba(255, 105, 0, 0.6) !important;
}

@keyframes urgentPulse {
    0%, 100% { 
        opacity: 1; 
        transform: scale(1);
        box-shadow: 0 0 30px rgba(226, 27, 60, 0.8);
    }
    50% { 
        opacity: 0.8; 
        transform: scale(1.05);
        box-shadow: 0 0 40px rgba(226, 27, 60, 1);
    }
}

@keyframes warningPulse {
    0%, 100% { 
        opacity: 1;
        box-shadow: 0 0 20px rgba(255, 105, 0, 0.6);
    }
    50% { 
        opacity: 0.9;
        box-shadow: 0 0 25px rgba(255, 105, 0, 0.8);
    }
}

/* Enhanced answer button selection */
.answer-btn {
    transition: all 0.3s ease !important;
}

.answer-btn:disabled {
    transition: all 0.5s ease !important;
}

/* Leaderboard your position highlight */
.player-score {
    transition: all 0.3s ease !important;
}

/* Enhanced feedback styling */
#answer-feedback {
    animation: slideInUp 0.5s ease-out !important;
}

@keyframes slideInUp {
    0% {
        opacity: 0;
        transform: translateY(20px);
    }
    100% {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Score display enhancement */
#current-score, #player-final-score {
    transition: all 0.3s ease !important;
    font-weight: bold !important;
}

/* Make status messages more prominent */
.status-message {
    animation: statusBounce 0.5s ease-out !important;
}

@keyframes statusBounce {
    0% {
        opacity: 0;
        transform: translateY(-10px) scale(0.9);
    }
    60% {
        opacity: 1;
        transform: translateY(0) scale(1.05);
    }
    100% {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}
</style>
`;

// Inject the enhanced CSS
if (!document.getElementById('player-enhanced-scoring')) {
    const styleElement = document.createElement('div');
    styleElement.innerHTML = playerEnhancedCSS;
    document.head.appendChild(styleElement.firstElementChild);
}

console.log('🎮 PLAYER: Enhanced player.js with proper scoring and timer fixes loaded successfully');

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializePlayer);