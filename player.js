// Player.js - Enhanced with Proper Game End Handling - VERIFIED FINAL FIX
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
let isQuestionActive = false;
let questionEndTime = null;
let previousScore = 0;

let hasShownFinalResults = false; // Guard flag for final results display

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

function clearOldPlayerState() {
    console.log('🧹 PLAYER: Clearing old player state (called by initializePlayer)');
    
    Object.values(PLAYER_STATE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });
    
    playerGameInstance = null;
    playerGamePlayerId = null;
    playerGamePlayerName = null;
    currentGamePin = null;
    playerScore = 0;
    hasAnswered = false;
    questionStartTime = null;
    isQuestionActive = false;
    questionEndTime = null;
    previousScore = 0;
    currentQuestionData = null; // Ensure this is also cleared
    
    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
        currentTimerInterval = null;
    }
    // hasShownFinalResults is reset by initializePlayer directly
    console.log('✅ PLAYER: Old state cleared');
}

function initializePlayer() {
    console.log('🎮 PLAYER: Starting initialization...');
    hasShownFinalResults = false; // Reset flag for a new game session
    
    const newGamePin = localStorage.getItem('gamePin');
    const newPlayerName = localStorage.getItem('playerName');
    
    console.log('🎮 PLAYER: Retrieved join info - PIN:', newGamePin, 'Name:', newPlayerName);
    
    clearOldPlayerState(); // Clears variables and some localStorage
    
    answerManager = new SimpleAnswerManager();
    
    currentGamePin = newGamePin;
    playerGamePlayerName = newPlayerName;
    
    if (!currentGamePin || !playerGamePlayerName) {
        console.error('❌ PLAYER: Missing game information');
        showStatus('Invalid game information. Please enter game PIN and name.', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);
        return;
    }
    
    const gamePinEl = document.getElementById('player-game-pin');
    const playerNameEl = document.getElementById('player-name-display');
    
    if (gamePinEl) gamePinEl.textContent = currentGamePin;
    if (playerNameEl) playerNameEl.textContent = playerGamePlayerName;
    
    hideAllScreens();
    showElement('joining-game');
    
    waitForFirebaseReady(() => {
        joinGame();
    });
}

// This function is called by showFinalResults and on page unload.
// It should clear runtime variables for the current game.
function clearActiveGameStateVariables() {
    console.log('🧹 PLAYER: Clearing active game state variables.');
    
    // Reset runtime variables related to the active game session
    // currentGamePin, playerGamePlayerId, playerGamePlayerName are NOT cleared here
    // as they might be needed if a direct fetch in showFinalResults is attempted
    // and localStorage for them is cleared separately in showFinalResults.
    playerScore = 0;
    previousScore = 0;
    hasAnswered = false;
    isQuestionActive = false;
    questionEndTime = null;
    currentQuestionData = null; 
    
    // hasShownFinalResults is managed by initializePlayer and showFinalResults/playAgain
    console.log('✅ PLAYER: Active game variables cleared.');
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
            showStatus('Connection timeout. Please refresh and try again.', 'error');
        } else {
            setTimeout(checkReady, 500);
        }
    }
    
    checkReady();
}

async function joinGame() {
    console.log('🚀 PLAYER: Starting join process...');
    showStatus('Connecting to game...', 'info');
    
    try {
        console.log('🔍 PLAYER: Checking if game exists...');
        const gameCheckResult = await checkGameExistsDetailed();
        
        if (!gameCheckResult.exists) {
            console.error('❌ PLAYER: Game not found -', gameCheckResult.reason);
            showStatus(gameCheckResult.message, 'error');
            
            localStorage.removeItem('gamePin'); // Clear join info
            localStorage.removeItem('playerName');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 3000);
            return;
        }
        
        console.log('✅ PLAYER: Game found and joinable!');
        showStatus('Game found! Joining...', 'info');
        
        playerGameInstance = new SimpleQuizGame(currentGamePin, false);
        playerGamePlayerId = await playerGameInstance.joinGame(playerGamePlayerName);
        
        if (!playerGamePlayerId) {
            throw new Error('Failed to get player ID from join operation');
        }
        
        console.log('🎉 PLAYER: Successfully joined with ID:', playerGamePlayerId);
        
        const gameStateRef = database.ref(`games/${currentGamePin}/gameState`);
        const gameStateSnapshot = await gameStateRef.once('value');
        const currentState = gameStateSnapshot.val();
        
        console.log('🎮 PLAYER: Current game state on join:', currentState);
        
        console.log('🎧 PLAYER: Setting up listeners...');
        playerGameInstance.listenToGameState(onGameStateChange);
        playerGameInstance.listenToPlayers(onPlayersUpdate);
        
        hideElement('joining-game');
        
        if (currentState) {
            switch (currentState.status) {
                case 'waiting':
                    showElement('waiting-lobby');
                    showStatus('Joined successfully! Waiting for host to start...', 'success');
                    savePlayerState('lobby');
                    break;
                    
                case 'playing':
                case 'question_ended':
                    showWaitingNext();
                    showStatus('Game in progress. Wait for next question!', 'info');
                    savePlayerState('waiting-next');
                    break;
                    
                case 'finished':
                    await showFinalResults(); 
                    showStatus('Game has already ended!', 'info');
                    break;
                    
                default:
                    showElement('waiting-lobby');
                    showStatus('Joined successfully!', 'success');
                    savePlayerState('lobby');
            }
        } else {
            showElement('waiting-lobby');
            showStatus('Joined successfully!', 'success');
            savePlayerState('lobby');
        }
        
        console.log('✅ PLAYER: Setup complete!');
        
    } catch (error) {
        console.error('💥 PLAYER: Join failed:', error);
        showStatus('Failed to join: ' + error.message, 'error');
        
        localStorage.removeItem('gamePin');
        localStorage.removeItem('playerName');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);
    }
}

function checkGameExistsDetailed() {
    return new Promise((resolve) => {
        console.log('🔍 PLAYER: Detailed game check for PIN:', currentGamePin);
        
        const gameRef = database.ref(`games/${currentGamePin}`);
        
        const timeout = setTimeout(() => {
            console.error('⏰ PLAYER: Game check timeout');
            gameRef.off(); // Detach listener on timeout
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
            
            if (!gameData.quiz || !gameData.quiz.questions || gameData.quiz.questions.length === 0) {
                console.error('❌ PLAYER: Invalid quiz data');
                resolve({
                    exists: false,
                    reason: 'invalid_quiz',
                    message: 'Game has invalid quiz data.'
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

async function onGameStateChange(gameState) {
    console.log('🎮 PLAYER: Game state changed:', gameState?.status);
    
    if (!gameState) {
        console.log('⚠️ PLAYER: No game state received');
        return;
    }
    
    switch (gameState.status) {
        case 'waiting':
            console.log('🏠 PLAYER: Game waiting - showing lobby');
            hideAllScreens();
            showElement('waiting-lobby');
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
            console.log('⏰ PLAYER: Question ended');
            isQuestionActive = false;
            questionEndTime = gameState.questionEndTime || Date.now();
            
            if (currentTimerInterval) {
                clearInterval(currentTimerInterval);
                currentTimerInterval = null;
            }
            
            setTimeout(() => {
                showWaitingNext();
                savePlayerState('question-ended');
            }, 2000);
            break;
            
        case 'finished':
            console.log('🏁 PLAYER: Game state is finished. Calling showFinalResults.');
            if (currentTimerInterval) {
                clearInterval(currentTimerInterval);
                currentTimerInterval = null;
            }
            await showFinalResults();
            break;
            
        case 'abandoned':
            console.log('👋 PLAYER: Game abandoned by host');
            if (currentTimerInterval) {
                clearInterval(currentTimerInterval);
                currentTimerInterval = null;
            }
            if (playerGameInstance) playerGameInstance.cleanup(); // Cleanup listeners
            clearActiveGameStateVariables(); // Clear runtime vars
            hasShownFinalResults = true; // Prevent final results screen if game is abruptly ended
            showStatus('Game ended - host disconnected', 'info');
            localStorage.removeItem('gamePin'); // Clear join info
            localStorage.removeItem('playerName');
            Object.values(PLAYER_STATE_KEYS).forEach(key => localStorage.removeItem(key)); // Clear all saved states
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 3000);
            break;
            
        default:
            console.log('❓ PLAYER: Unknown game status:', gameState.status);
    }
}

function onPlayersUpdate(players) {
    const playerCount = Object.keys(players).length;
    console.log('👥 PLAYER: Players update - count:', playerCount);
    
    const countEl = document.getElementById('lobby-player-count');
    if (countEl) countEl.textContent = playerCount;
    
    if (playerGamePlayerId && players[playerGamePlayerId]) {
        const oldScore = playerScore;
        const newScore = players[playerGamePlayerId].score || 0;
        
        if (oldScore !== newScore) {
            console.log('🏆 PLAYER: Score updated from', oldScore, 'to', newScore);
            
            if (newScore > oldScore) {
                const increase = newScore - oldScore;
                showScoreIncrease(increase);
            }
            
            previousScore = oldScore;
            playerScore = newScore;
        }
        
        updateScoreDisplay();
        savePlayerState(); // Save current state including score
    } else if (playerGamePlayerId) { 
        console.warn(`PLAYER: Player ID ${playerGamePlayerId} not found in players update. Score might not update.`);
    }
    
    updateLeaderboards(players);
}

function showScoreIncrease(points) {
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
    
    database.ref(`games/${currentGamePin}`).once('value', (snapshot) => {
        const gameData = snapshot.val();
        const question = gameData?.quiz?.questions?.[gameState.currentQuestion];
        
        if (question) {
            console.log('📝 PLAYER: Question loaded:', question.question.substring(0, 50) + '...');
            currentQuestionData = question; // Store for timer
            displayQuestion(question, gameState.currentQuestion + 1);
        } else {
            console.error('❌ PLAYER: Question not found at index:', gameState.currentQuestion);
            showStatus('Error loading question', 'error');
            showWaitingNext();
        }
    }, (error) => {
        console.error('💥 PLAYER: Error fetching question:', error);
        showStatus('Error loading question', 'error');
        showWaitingNext();
    });
}

function displayQuestion(question, questionNumber) {
    console.log('📝 PLAYER: Displaying question', questionNumber);
    
    hideAllScreens();
    showElement('active-question');
    
    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
    }
    
    document.getElementById('question-num').textContent = questionNumber;
    document.getElementById('question-text').textContent = question.question;
    
    const grid = document.getElementById('answers-grid');
    grid.innerHTML = '';
    hasAnswered = false; // Reset for the new question
    isQuestionActive = true;
    questionEndTime = null;
    
    question.answers.forEach((answer, index) => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn';
        btn.textContent = answer;
        btn.onclick = () => selectAnswer(index);
        grid.appendChild(btn);
    });
    
    startTimerPlayer(question.timeLimit || 20);
    hideElement('answer-feedback');
}

function startTimerPlayer(duration) {
    const display = document.getElementById('question-timer');
    let timeLeft = duration;
    
    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
    }
    
    const update = () => {
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
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
        
        if (timeLeft <= 0) {
            clearInterval(currentTimerInterval);
            currentTimerInterval = null;
            onTimeout();
        } else {
            timeLeft--;
        }
    };
    
    update();
    currentTimerInterval = setInterval(update, 1000);
}

async function selectAnswer(answerIndex) {
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
    
    const responseTime = answerManager ? answerManager.getResponseTime() : 0;
    
    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
    }
    
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
        
        if (isQuestionActive && !questionEndTime) {
            hasAnswered = false;
            if (answerManager) { // Re-initialize answer manager if needed
                 answerManager.startQuestion(questionStartTime); // Use original start time
            }
            
            buttons.forEach(btn => {
                btn.disabled = false;
                btn.style.transform = '';
                btn.style.border = '';
                btn.style.boxShadow = '';
                btn.style.opacity = '';
                btn.style.zIndex = '';
            });
            
            const timeLimit = currentQuestionData ? (currentQuestionData.timeLimit || 20) : 20;
            const elapsed = responseTime; // Time already spent
            const remaining = Math.max(0, timeLimit - elapsed);
            startTimerPlayer(remaining);
        }
    }
}

function onTimeout() {
    console.log('⏰ PLAYER: Question timeout');
    isQuestionActive = false;
    questionEndTime = Date.now();
    
    if (!hasAnswered) {
        hasAnswered = true; 
        
        const buttons = document.querySelectorAll('.answer-btn');
        buttons.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.6';
            btn.style.cursor = 'not-allowed';
        });
        
        showFeedback('Time\'s up! No answer submitted.');
        
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
}

function updateScoreDisplay() {
    const scoreEl = document.getElementById('current-score');
    if (scoreEl) {
        if (previousScore !== playerScore && playerScore > previousScore) {
            scoreEl.classList.add('score-updated');
            setTimeout(() => {
                scoreEl.classList.remove('score-updated');
            }, 1000);
        }
        scoreEl.textContent = playerScore;
    }
    
    // This element is on the final results screen.
    // It will be updated by showFinalResults with the definitive score.
    const finalEl = document.getElementById('player-final-score');
    if (finalEl && document.getElementById('final-results').style.display === 'block') {
         // Only update if final results are visible, to prevent overriding definitive set.
         // Or rely on showFinalResults to set this. Let's let showFinalResults handle it.
    } else if (finalEl) {
        finalEl.textContent = `${playerScore} points`; // Keep this for intermediate states if needed
    }
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

async function showFinalResults() {
    if (hasShownFinalResults) {
        console.log('🏁 PLAYER: Final results logic already executed, skipping redundant call.');
        return;
    }
    console.log('🏁 PLAYER: Showing final results (first time for this session)');
    hasShownFinalResults = true; // Set flag immediately

    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
        currentTimerInterval = null;
    }

    let finalScoreForDisplay = playerScore; // Fallback to current global playerScore

    // Attempt to fetch the most up-to-date score directly from Firebase
    if (playerGamePlayerId && currentGamePin && typeof database !== 'undefined' && database.ref) {
        try {
            console.log(`PLAYER: Attempting to fetch definitive final score for player ${playerGamePlayerId} in game ${currentGamePin}`);
            const playerRef = database.ref(`games/${currentGamePin}/players/${playerGamePlayerId}`);
            const snapshot = await playerRef.once('value');
            const playerData = snapshot.val();
            if (playerData && typeof playerData.score === 'number') {
                finalScoreForDisplay = playerData.score;
                playerScore = finalScoreForDisplay; // Sync global playerScore one last time
                console.log('PLAYER: Fetched definitive final score from Firebase:', finalScoreForDisplay);
            } else {
                console.log('PLAYER: Definitive final score not found in direct Firebase fetch or not a number. Using current global playerScore:', playerScore);
            }
        } catch (err) {
            console.error('PLAYER: Error fetching definitive final score from Firebase. Using current global playerScore:', err);
        }
    } else {
        console.log('PLAYER: Skipping direct Firebase fetch for final score (missing playerId, pin, or db ref). Using current global playerScore:', playerScore);
    }

    hideAllScreens();
    showElement('final-results');

    // Update the main final score display element with the definitive score
    const finalEl = document.getElementById('player-final-score');
    if (finalEl) {
        finalEl.textContent = `${finalScoreForDisplay} points`;
    }

    // Also update the #current-score element on the (now hidden) waiting-next screen
    const scoreEl = document.getElementById('current-score');
    if (scoreEl) {
        scoreEl.textContent = finalScoreForDisplay;
    }
    
    showStatus('🏁 Quiz completed! Final results are in!', 'success');

    // Detach Firebase listeners *before* clearing local state that listeners might use
    if (playerGameInstance) {
        playerGameInstance.cleanup();
    }
    
    // Clear runtime game variables. Does not reset hasShownFinalResults.
    clearActiveGameStateVariables(); 
    
    // Clear localStorage items related to the finished game
    localStorage.removeItem(PLAYER_STATE_KEYS.GAME_PIN); // Was 'gamePin'
    localStorage.removeItem(PLAYER_STATE_KEYS.PLAYER_NAME); // Was 'playerName'
    localStorage.removeItem(PLAYER_STATE_KEYS.PLAYER_ID);
    localStorage.removeItem(PLAYER_STATE_KEYS.IS_ACTIVE);
    localStorage.removeItem(PLAYER_STATE_KEYS.GAME_STATE);
    localStorage.removeItem(PLAYER_STATE_KEYS.CURRENT_SCORE);
    
    console.log('✅ PLAYER: Final results screen configured and state cleared.');
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

window.addEventListener('beforeunload', () => {
    console.log('🧹 PLAYER: Page unloading - cleanup');
    
    if (playerGameInstance) {
        playerGameInstance.cleanup();
    }
    
    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
        currentTimerInterval = null;
    }
    // Don't clear localStorage here, as the user might just be refreshing.
    // State saving/loading should handle recovery if possible.
    // clearActiveGameStateVariables(); // Optionally clear runtime vars
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && playerGamePlayerId && currentGamePin) {
        console.log('📱 PLAYER: Page visible');
    }
});

function playAgain() {
    console.log('🔄 PLAYER: Play again clicked');
    hasShownFinalResults = false; // Reset this flag for a new session

    // Clear all potentially relevant localStorage to ensure a clean start
    Object.values(PLAYER_STATE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });
    localStorage.removeItem('gamePin'); // From index.html
    localStorage.removeItem('playerName'); // From index.html

    window.location.href = 'index.html';
}

window.playAgain = playAgain;

const playerEnhancedCSS = `
<style id="player-enhanced-scoring">
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

@keyframes scoreUpdate {
    0% { transform: scale(1); }
    50% { transform: scale(1.2); color: #4caf50; }
    100% { transform: scale(1); }
}

.score-updated {
    animation: scoreUpdate 0.8s ease-out !important;
}

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

.answer-btn {
    transition: all 0.3s ease !important;
}

.answer-btn:disabled {
    transition: all 0.5s ease !important;
}

.player-score {
    transition: all 0.3s ease !important;
}

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

#current-score, #player-final-score {
    transition: all 0.3s ease !important;
    font-weight: bold !important;
}

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

if (!document.getElementById('player-enhanced-scoring')) {
    const styleElement = document.createElement('div');
    styleElement.innerHTML = playerEnhancedCSS;
    document.head.appendChild(styleElement.firstElementChild);
}

console.log('🎮 PLAYER: Enhanced player.js loaded successfully');

document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 PLAYER: DOM loaded, initializing player...');
    initializePlayer();
});