// Player.js - Final attempt to fix score display issue
let playerGameInstance = null;
let playerGamePlayerId = null;
let playerGamePlayerName = null;
let currentGamePin = null;
let playerScore = 0;
let hasAnswered = false;
let questionStartTime = null;
let currentTimerInterval = null;
let currentQuestionData = null; // Used to store current question for timer logic on re-answer
let isRecoveringState = false; // Not actively used in current flow, but kept for context
let isQuestionActive = false;
let questionEndTime = null;
let previousScore = 0;

let hasShownFinalResults = false; // Guard flag for final results display

const PLAYER_STATE_KEYS = {
    GAME_PIN: 'player_game_pin',
    PLAYER_NAME: 'player_player_name',
    PLAYER_ID: 'player_player_id',
    GAME_STATE: 'player_game_state',
    IS_ACTIVE: 'player_is_active',
    CURRENT_SCORE: 'player_current_score'
};

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
    markAnswered() { this.hasAnswered = true; }
    canAnswer() { return !this.hasAnswered; }
}

class SimpleQuizGame {
    constructor(gamePin, isHost = false) {
        this.gamePin = gamePin;
        this.isHost = isHost;
    }
    async joinGame(playerName) {
        try {
            console.log('🎮 GAME: Joining game with name:', playerName);
            // Ensure playerGamePlayerId is unique and persisted for recovery
            // Use a persistent ID if one exists, otherwise generate a new one
            let existingPlayerId = localStorage.getItem(PLAYER_STATE_KEYS.PLAYER_ID);
            let newPlayerId = existingPlayerId || (Date.now().toString() + '_' + Math.floor(Math.random() * 1000));

            const playerData = { id: newPlayerId, name: playerName, score: 0, status: 'waiting', joinedAt: Date.now() };
            console.log('📤 GAME: Writing player data to Firebase with ID:', newPlayerId);
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
            if (gameState) callback(gameState);
        }, (error) => console.log('💥 GAME: Game state listener error:', error)); // Changed to console.log to avoid stopping
    }
    listenToPlayers(callback) {
        console.log('👥 GAME: Setting up players listener');
        const playersRef = database.ref(`games/${this.gamePin}/players`);
        playersRef.on('value', (snapshot) => {
            const players = snapshot.val() || {};
            console.log('👥 GAME: Players update:', Object.keys(players).length, 'players');
            callback(players);
        }, (error) => console.log('💥 GAME: Players listener error:', error)); // Changed to console.log to avoid stopping
    }
    cleanup() {
        if (this.gamePin && typeof database !== 'undefined') {
            console.log('🧹 GAME: Cleaning up listeners for game:', this.gamePin);
            database.ref(`games/${this.gamePin}`).off();
        }
    }
}

let answerManager = null;

// Called by initializePlayer to prepare for a completely new session
function clearOldSessionState() {
    console.log('🧹 PLAYER: Clearing old session state (for new session start)');
    Object.values(PLAYER_STATE_KEYS).forEach(key => localStorage.removeItem(key));
    localStorage.removeItem('gamePin');
    localStorage.removeItem('playerName');

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
    currentQuestionData = null;

    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
        currentTimerInterval = null;
    }
    console.log('✅ PLAYER: Old session state cleared.');
}

function initializePlayer() {
    console.log('🎮 PLAYER: Starting initialization...');
    hasShownFinalResults = false; // CRITICAL: Reset for a new game session

    // Retrieve join info *before* potentially clearing state
    const storedGamePin = localStorage.getItem(PLAYER_STATE_KEYS.GAME_PIN) || localStorage.getItem('gamePin');
    const storedPlayerName = localStorage.getItem(PLAYER_STATE_KEYS.PLAYER_NAME) || localStorage.getItem('playerName');
    const storedPlayerId = localStorage.getItem(PLAYER_STATE_KEYS.PLAYER_ID);

    console.log('🎮 PLAYER: Retrieved join info - PIN:', storedGamePin, 'Name:', storedPlayerName, 'ID:', storedPlayerId);

    // If no stored player ID and no new game info, it's a completely fresh start or an error
    // In this case, we might want to clear old state more aggressively or redirect.
    // For now, only clear if explicitly told to (e.g., by playAgain) or if no vital info exists.
    // The playAgain() function now explicitly calls clearOldSessionState().
    // If we have no game info, we should just redirect, not clear.
    if (!storedGamePin || !storedPlayerName) {
        console.error('❌ PLAYER: Missing game information. Redirecting to home.');
        showStatus('Invalid game information. Please enter game PIN and name.', 'error');
        setTimeout(() => { window.location.href = 'index.html'; }, 3000);
        return;
    }

    // Assign to global variables
    currentGamePin = storedGamePin;
    playerGamePlayerName = storedPlayerName;
    playerGamePlayerId = storedPlayerId; // Will be null if first time, will be generated in joinGame

    answerManager = new SimpleAnswerManager();

    const gamePinEl = document.getElementById('player-game-pin');
    if (gamePinEl) gamePinEl.textContent = currentGamePin;
    const playerNameEl = document.getElementById('player-name-display');
    if (playerNameEl) playerNameEl.textContent = playerGamePlayerName;

    hideAllScreens();
    showElement('joining-game');
    waitForFirebaseReady(joinGame);
}

// Called by showFinalResults to clear runtime variables of the game that just ended.
// This does NOT reset hasShownFinalResults.
function clearCurrentGameRuntimeVariables() {
    console.log('🧹 PLAYER: Clearing runtime variables for the just-ended game.');
    // Only reset variables that pertain to the active game flow.
    // Keep playerGamePlayerId and currentGamePin if they might be used by a final leaderboard update
    // that could still be pending display, though listeners should be off.
    // For safety, we primarily care about playerScore not being 0 for display.
    // The critical part is that playerScore is set correctly BEFORE this.
    playerScore = 0; // This is reset *after* its final value has been used for display
    previousScore = 0;
    hasAnswered = false;
    isQuestionActive = false;
    questionEndTime = null;
    currentQuestionData = null;
    console.log('✅ PLAYER: Runtime variables for ended game cleared (global playerScore is now 0).');
}


function savePlayerState(gameState = 'lobby') {
    // ... (savePlayerState implementation as before)
    try {
        localStorage.setItem(PLAYER_STATE_KEYS.IS_ACTIVE, 'true');
        localStorage.setItem(PLAYER_STATE_KEYS.GAME_PIN, currentGamePin);
        localStorage.setItem(PLAYER_STATE_KEYS.PLAYER_ID, playerGamePlayerId);
        localStorage.setItem(PLAYER_STATE_KEYS.PLAYER_NAME, playerGamePlayerName);
        localStorage.setItem(PLAYER_STATE_KEYS.GAME_STATE, gameState);
        localStorage.setItem(PLAYER_STATE_KEYS.CURRENT_SCORE, playerScore.toString());
        console.log('💾 PLAYER: State saved:', { gamePin: currentGamePin, playerId: playerGamePlayerId, gameState, score: playerScore });
    } catch (error) {
        console.error('Error saving player state:', error);
    }
}

function waitForFirebaseReady(callback) {
    // ... (waitForFirebaseReady implementation as before)
    let attempts = 0;
    const maxAttempts = 40;
    function checkReady() {
        attempts++;
        // console.log(`🔄 PLAYER: Firebase check ${attempts}/${maxAttempts}`);
        const firebaseReady = typeof firebase !== 'undefined';
        const databaseReady = typeof database !== 'undefined' && database && database.ref;
        // console.log('🔍 PLAYER: Readiness check:', { firebase: firebaseReady, database: databaseReady });
        if (firebaseReady && databaseReady) {
            console.log('✅ PLAYER: Firebase and database ready!');
            setTimeout(callback, 200); // Short delay
        } else if (attempts >= maxAttempts) {
            console.error('❌ PLAYER: Timeout waiting for Firebase. Please refresh.');
            showStatus('Connection timeout. Please refresh and try again.', 'error');
        } else {
            setTimeout(checkReady, 500);
        }
    }
    checkReady();
}

async function joinGame() {
    // ... (joinGame implementation as before, calls showFinalResults if game already finished)
    console.log('🚀 PLAYER: Starting join process...');
    showStatus('Connecting to game...', 'info');
    try {
        console.log('🔍 PLAYER: Checking if game exists...');
        const gameCheckResult = await checkGameExistsDetailed();
        if (!gameCheckResult.exists) {
            console.error('❌ PLAYER: Game not found -', gameCheckResult.reason);
            showStatus(gameCheckResult.message, 'error');
            localStorage.removeItem('gamePin'); localStorage.removeItem('playerName');
            setTimeout(() => { window.location.href = 'index.html'; }, 3000);
            return;
        }
        console.log('✅ PLAYER: Game found and joinable!');
        showStatus('Game found! Joining...', 'info');

        playerGameInstance = new SimpleQuizGame(currentGamePin, false);

        // Pass the globally defined playerGamePlayerId (which might be null if new)
        playerGamePlayerId = await playerGameInstance.joinGame(playerGamePlayerName);

        if (!playerGamePlayerId) throw new Error('Failed to get player ID from join operation');

        // Persist the newly obtained or confirmed player ID
        localStorage.setItem(PLAYER_STATE_KEYS.PLAYER_ID, playerGamePlayerId);

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
                case 'waiting': showElement('waiting-lobby'); showStatus('Joined successfully! Waiting for host to start...', 'success'); savePlayerState('lobby'); break;
                case 'playing':
                case 'question_ended':
                    showWaitingNext(); showStatus('Game in progress. Wait for next question!', 'info'); savePlayerState('waiting-next'); break;
                case 'finished': await showFinalResults(); showStatus('Game has already ended!', 'info'); break; // Ensure this await is handled
                default: showElement('waiting-lobby'); showStatus('Joined successfully!', 'success'); savePlayerState('lobby');
            }
        } else { showElement('waiting-lobby'); showStatus('Joined successfully!', 'success'); savePlayerState('lobby'); }
        console.log('✅ PLAYER: Setup complete!');
    } catch (error) {
        console.error('💥 PLAYER: Join failed:', error);
        showStatus('Failed to join: ' + error.message, 'error');
        localStorage.removeItem('gamePin'); localStorage.removeItem('playerName');
        localStorage.removeItem(PLAYER_STATE_KEYS.GAME_PIN); // Also clear new keys
        localStorage.removeItem(PLAYER_STATE_KEYS.PLAYER_NAME);
        localStorage.removeItem(PLAYER_STATE_KEYS.PLAYER_ID);
        setTimeout(() => { window.location.href = 'index.html'; }, 3000);
    }
}

function checkGameExistsDetailed() {
    // ... (checkGameExistsDetailed implementation as before)
    return new Promise((resolve) => {
        // console.log('🔍 PLAYER: Detailed game check for PIN:', currentGamePin);
        const gameRef = database.ref(`games/${currentGamePin}`);
        const timeout = setTimeout(() => { console.error('⏰ PLAYER: Game check timeout'); gameRef.off(); resolve({ exists: false, reason: 'timeout', message: 'Connection timeout. Check internet.' }); }, 10000);
        gameRef.once('value', (snapshot) => {
            clearTimeout(timeout);
            const gameData = snapshot.val();
            // console.log('📦 PLAYER: Game data received:', !!gameData);
            if (!gameData) { resolve({ exists: false, reason: 'not_found', message: 'Game not found. Check PIN.' }); return; }
            if (!gameData.quiz || !gameData.quiz.questions || gameData.quiz.questions.length === 0) { resolve({ exists: false, reason: 'invalid_quiz', message: 'Game has invalid quiz data.' }); return; }
            resolve({ exists: true, reason: 'success', message: 'Game found!' });
        }, (error) => { clearTimeout(timeout); console.error('💥 PLAYER: DB error game check:', error); resolve({ exists: false, reason: 'database_error', message: 'DB error: ' + error.message }); });
    });
}

async function onGameStateChange(gameState) {
    // ... (onGameStateChange implementation as before, calls showFinalResults)
    console.log('🎮 PLAYER: Game state changed to:', gameState?.status);
    if (!gameState) { console.log('⚠️ PLAYER: No game state received'); return; }
    switch (gameState.status) {
        case 'waiting': /* ... */ hideAllScreens(); showElement('waiting-lobby'); savePlayerState('lobby'); break;
        case 'playing': /* ... */ hasAnswered = false; isQuestionActive = true; questionEndTime = null; if (answerManager) answerManager.startQuestion(gameState.questionStartTime); showActiveQuestion(gameState); savePlayerState('playing'); break;
        case 'question_ended': /* ... */ isQuestionActive = false; questionEndTime = gameState.questionEndTime || Date.now(); if (currentTimerInterval) { clearInterval(currentTimerInterval); currentTimerInterval = null; } setTimeout(() => { showWaitingNext(); savePlayerState('question-ended'); }, 1500); break; // Reduced delay
        case 'finished': console.log('🏁 PLAYER: Game state is finished. Processing final results display.'); if (currentTimerInterval) { clearInterval(currentTimerInterval); currentTimerInterval = null; } await showFinalResults(); break;
        case 'abandoned': /* ... */ console.log('👋 PLAYER: Game abandoned by host'); if (currentTimerInterval) clearInterval(currentTimerInterval); if (playerGameInstance) playerGameInstance.cleanup(); clearActiveGameStateVariables(); hasShownFinalResults = true; showStatus('Game ended - host disconnected', 'info'); Object.values(PLAYER_STATE_KEYS).forEach(key => localStorage.removeItem(key)); localStorage.removeItem('gamePin'); localStorage.removeItem('playerName'); setTimeout(() => { window.location.href = 'index.html'; }, 3000); break;
        default: console.log('❓ PLAYER: Unknown game status:', gameState.status);
    }
}

function onPlayersUpdate(players) {
    // ... (onPlayersUpdate implementation as before)
    const playerCount = Object.keys(players).length;
    // console.log('👥 PLAYER: Players update - count:', playerCount);
    const countEl = document.getElementById('lobby-player-count');
    if (countEl) countEl.textContent = playerCount;
    if (playerGamePlayerId && players[playerGamePlayerId]) {
        const oldScore = playerScore;
        const newScore = players[playerGamePlayerId].score || 0;
        if (oldScore !== newScore) {
            console.log('🏆 PLAYER: Score updated from', oldScore, 'to', newScore);
            if (newScore > oldScore) showScoreIncrease(newScore - oldScore);
            previousScore = oldScore; playerScore = newScore;
        }
        updateScoreDisplay(); savePlayerState();
    } else if (playerGamePlayerId) { console.warn(`PLAYER: Player ID ${playerGamePlayerId} not found in players update.`); }
    updateLeaderboards(players);
}

function showScoreIncrease(points) {
    const scoreChangeEl = document.getElementById('score-change');
    if (scoreChangeEl) {
        scoreChangeEl.textContent = `+${points}`;
        scoreChangeEl.className = 'score-change-animation score-increase';
        scoreChangeEl.style.display = 'block';

        scoreChangeEl.addEventListener('animationend', () => {
            scoreChangeEl.style.display = 'none';
            scoreChangeEl.className = '';
        }, { once: true });
    }
}
function showWaitingLobby() { /* ... (implementation as before) ... */ }
function showActiveQuestion(gameState) { /* ... (implementation as before, sets currentQuestionData) ... */
    hideElement('waiting-lobby');
    hideElement('final-results');
    showElement('active-game');

    const quizData = localStorage.getItem('quizData'); // Assuming quizData is stored here
    if (quizData) {
        const parsedQuizData = JSON.parse(quizData);
        currentQuestionData = parsedQuizData.questions[gameState.currentQuestion];
        if (currentQuestionData) {
            displayQuestion(currentQuestionData, gameState.currentQuestion + 1);
            startTimerPlayer(currentQuestionData.timeLimit);
        } else {
            console.error('💥 PLAYER: No question data for current question index:', gameState.currentQuestion);
        }
    } else {
        console.error('💥 PLAYER: No quiz data found in localStorage.');
    }
}
function displayQuestion(question, questionNumber) {
    document.getElementById('player-question-text').textContent = question.question;
    document.getElementById('question-number').textContent = `Question ${questionNumber}`;
    const answersContainer = document.getElementById('answers-container');
    answersContainer.innerHTML = '';
    question.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'answer-btn';
        button.textContent = option;
        button.dataset.index = index;
        button.onclick = () => selectAnswer(index);
        answersContainer.appendChild(button);
    });
    // Ensure buttons are enabled for new question
    document.querySelectorAll('.answer-btn').forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('selected-answer', 'correct-answer', 'incorrect-answer');
    });
}
function startTimerPlayer(duration) {
    if (currentTimerInterval) clearInterval(currentTimerInterval);
    let timeLeft = duration / 1000;
    const timerDisplay = document.getElementById('question-timer');
    timerDisplay.textContent = timeLeft;
    timerDisplay.style.color = 'white'; // Reset color

    currentTimerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = timeLeft;
        if (timeLeft <= 5) timerDisplay.style.color = 'red';
        if (timeLeft <= 0) {
            clearInterval(currentTimerInterval);
            timerDisplay.textContent = 'Time Up!';
            onTimeout();
        }
    }, 1000);
}
async function selectAnswer(answerIndex) {
    if (!answerManager.canAnswer() || !isQuestionActive) {
        console.warn('⚠️ PLAYER: Cannot answer, already answered or question not active.');
        return;
    }
    answerManager.markAnswered(); // Mark as answered locally immediately
    isQuestionActive = false; // Prevent further answers for this question
    clearInterval(currentTimerInterval); // Stop timer

    const responseTime = answerManager.getResponseTime();
    console.log(`✅ PLAYER: Answer submitted: ${answerIndex}, Response Time: ${responseTime}s`);

    // Visually mark the selected answer
    document.querySelectorAll('.answer-btn').forEach((button, index) => {
        button.disabled = true;
        if (index === answerIndex) {
            button.classList.add('selected-answer');
        }
    });

    try {
        if (playerGameInstance && currentGamePin && playerGamePlayerId && currentQuestionData) {
            const answerCorrect = (answerIndex === currentQuestionData.correctAnswer);
            await database.ref(`games/${currentGamePin}/players/${playerGamePlayerId}`).update({
                currentAnswer: answerIndex,
                responseTime: responseTime,
                status: 'answered',
                answerTime: Date.now() // Record when answer was submitted
            });

            // No immediate score update for player, wait for host to process
            showStatus('Answer submitted! Waiting for host...', 'success');
        } else {
            console.error('💥 PLAYER: Missing data to submit answer.', { playerGameInstance, currentGamePin, playerGamePlayerId, currentQuestionData });
            showStatus('Error: Could not submit answer.', 'error');
        }
    } catch (error) {
        console.error('💥 PLAYER: Error submitting answer to Firebase:', error);
        showStatus('Error submitting answer: ' + error.message, 'error');
    }
}

function onTimeout() {
    console.log('⏰ PLAYER: Time ran out!');
    if (!hasAnswered) { // If player hasn't answered yet
        document.querySelectorAll('.answer-btn').forEach(button => button.disabled = true);
        showStatus('Time Up! Waiting for host...', 'info');
        // Optionally, send a 'timed_out' status to Firebase if needed
        if (playerGameInstance && currentGamePin && playerGamePlayerId) {
            database.ref(`games/${currentGamePin}/players/${playerGamePlayerId}`).update({
                status: 'timed_out',
                currentAnswer: null,
                responseTime: 0 // Or some indicator for timeout
            }).catch(e => console.error("Error setting timeout status:", e));
        }
    }
    isQuestionActive = false;
}
function showFeedback(message) { /* ... (implementation as before) ... */ }
function showWaitingNext() {
    console.log('⏳ PLAYER: Showing waiting for next screen.');
    hideElement('active-game');
    hideElement('waiting-lobby');
    hideElement('final-results');
    showElement('waiting-next-question');
    showStatus('Waiting for the next question...', 'info');
    // Ensure scoreboard is visible here if you want it after each question
    updateScoreDisplay();
    updateLeaderboards(Object.values(hostPlayers)); // Assuming hostPlayers is accessible, otherwise fetch from Firebase
}


function updateScoreDisplay() {
    const scoreEl = document.getElementById('current-score');
    if (scoreEl) {
        if (previousScore !== playerScore && playerScore > previousScore) {
            scoreEl.classList.add('score-updated');
            setTimeout(() => scoreEl.classList.remove('score-updated'), 1000);
        }
        scoreEl.textContent = playerScore;
    }
    // The #player-final-score element is now exclusively updated by showFinalResults
}

function updateLeaderboards(players) {
    const sortedPlayers = Object.values(players).sort((a, b) => b.score - a.score);
    updateLeaderboard('lobby-leaderboard-list', sortedPlayers);
    updateLeaderboard('in-game-leaderboard-list', sortedPlayers);
}

function updateLeaderboard(elementId, players) {
    const listEl = document.getElementById(elementId);
    if (listEl) {
        listEl.innerHTML = '';
        players.slice(0, 5).forEach((p, index) => { // Show top 5
            const li = document.createElement('li');
            li.innerHTML = `<span>${index + 1}. ${p.name}</span> <span>${p.score}</span>`;
            if (p.id === playerGamePlayerId) {
                li.classList.add('current-player-rank'); // Highlight current player
            }
            listEl.appendChild(li);
        });
    }
}

async function showFinalResults() {
    if (hasShownFinalResults) {
        console.log('🏁 PLAYER: Final results display already processed. Skipping redundant call.');
        return;
    }
    console.log('🏁 PLAYER: Processing final results display...');
    hasShownFinalResults = true; // Set guard flag

    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
        currentTimerInterval = null;
    }

    let finalScoreToDisplay = playerScore; // Default to current global playerScore (which should be up-to-date via onPlayersUpdate)

    // Attempt to fetch the most up-to-date score directly from Firebase as a final confirmation
    if (playerGamePlayerId && currentGamePin && typeof database !== 'undefined' && database.ref) {
        try {
            console.log(`PLAYER: Attempting to fetch definitive final score for player ${playerGamePlayerId} in game ${currentGamePin}`);
            const playerRef = database.ref(`games/${currentGamePin}/players/${playerGamePlayerId}`);
            const snapshot = await playerRef.once('value');
            const playerData = snapshot.val();

            if (playerData && typeof playerData.score === 'number') {
                finalScoreToDisplay = playerData.score;
                // Sync global playerScore one last time for any immediate subsequent reads if needed, though display uses finalScoreToDisplay
                playerScore = finalScoreToDisplay;
                console.log('PLAYER: Fetched definitive final score from Firebase:', finalScoreToDisplay);
            } else {
                console.log('PLAYER: Definitive final score not found/not a number in direct Firebase fetch. Using current global playerScore:', playerScore);
                finalScoreToDisplay = playerScore; // Ensure it uses the global if fetch fails
            }
        } catch (err) {
            console.error('PLAYER: Error fetching definitive final score from Firebase. Using current global playerScore:', err);
            finalScoreToDisplay = playerScore; // Ensure it uses the global on error
        }
    } else {
        console.log('PLAYER: Skipping direct Firebase fetch for final score (missing vital info). Using current global playerScore:', playerScore);
        finalScoreToDisplay = playerScore; // Ensure it uses the global
    }

    hideAllScreens();
    showElement('final-results');

    const finalEl = document.getElementById('player-final-score');
    if (finalEl) {
        finalEl.textContent = `${finalScoreToDisplay} points`; // Use the definitive score
    }
    const currentScoreElOnWaitingScreen = document.getElementById('current-score');
    if (currentScoreElOnWaitingScreen) { // Update this too, though screen is hidden
        currentScoreElOnWaitingScreen.textContent = finalScoreToDisplay;
    }

    showStatus('🏁 Quiz completed! Final results are in!', 'success');

    if (playerGameInstance) {
        playerGameInstance.cleanup(); // Detach Firebase listeners
    }

    clearCurrentGameRuntimeVariables(); // Clears global playerScore to 0, etc.

    // Clear persistent storage for the game just ended
    console.log('PLAYER: Clearing game-specific localStorage items.');
    localStorage.removeItem(PLAYER_STATE_KEYS.GAME_PIN); // If these specific keys were used
    localStorage.removeItem(PLAYER_STATE_KEYS.PLAYER_ID);
    localStorage.removeItem(PLAYER_STATE_KEYS.PLAYER_NAME);
    localStorage.removeItem('gamePin');     // Clear direct keys from index.html
    localStorage.removeItem('playerName');
    localStorage.removeItem(PLAYER_STATE_KEYS.IS_ACTIVE);
    localStorage.removeItem(PLAYER_STATE_KEYS.GAME_STATE);
    localStorage.removeItem(PLAYER_STATE_KEYS.CURRENT_SCORE);

    console.log('✅ PLAYER: Final results screen configured and state handled.');
}

function hideAllScreens() {
    hideElement('joining-game');
    hideElement('waiting-lobby');
    hideElement('active-game');
    hideElement('waiting-next-question');
    hideElement('final-results');
}
function hideElement(id) {
    const element = document.getElementById(id);
    if (element) element.style.display = 'none';
}
function showElement(id) {
    const element = document.getElementById(id);
    if (element) element.style.display = 'block';
}
function showStatus(message, type) {
    console.log(`📢 PLAYER (${type}):`, message);
    const statusEl = document.getElementById('join-status'); // Assuming 'join-status' is used for general messages
    if (statusEl) {
        statusEl.innerHTML = `<p class="${type}">${message}</p>`; // Added class for styling
    }
}

window.addEventListener('beforeunload', () => {
    console.log('🧹 PLAYER: Page unloading - potential cleanup');
    if (playerGameInstance && !hasShownFinalResults) { // Only cleanup if game wasn't formally finished
        // This is tricky; abrupt leave might corrupt host view or not clear player from game node.
        // For now, basic listener cleanup.
        // playerGameInstance.cleanup(); // Might be too aggressive if just a refresh
    }
    if (currentTimerInterval) clearInterval(currentTimerInterval);
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('⏸️ PLAYER: Page hidden. Pausing non-critical updates.');
        // Potentially pause timer updates or heavy operations
    } else {
        console.log('▶️ PLAYER: Page visible. Resuming updates.');
        // Potentially re-sync game state if necessary
        // Re-evaluate if current question timer needs to be re-started/adjusted
        if (isQuestionActive && currentQuestionData && questionStartTime) {
            const timeElapsed = Date.now() - questionStartTime;
            const timeLeft = (currentQuestionData.timeLimit - timeElapsed);
            if (timeLeft > 0) {
                startTimerPlayer(timeLeft); // Restart timer with remaining time
            } else {
                // If time has run out, ensure answers are disabled
                clearInterval(currentTimerInterval);
                document.getElementById('question-timer').textContent = 'Time Up!';
                document.querySelectorAll('.answer-btn').forEach(button => {
                    button.disabled = true;
                });
            }
        }
    }
});

function playAgain() {
    console.log('🔄 PLAYER: Play again clicked. Resetting for new session.');
    hasShownFinalResults = false; // CRITICAL: Reset this flag

    // Clear all localStorage items that might persist from the previous session
    clearOldSessionState(); // Now correctly used here for a full reset

    window.location.href = 'index.html';
}
window.playAgain = playAgain;

const playerEnhancedCSS = `
    /* Styles for score change animation */
    #score-change {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 3em;
        font-weight: bold;
        color: limegreen; /* Default for increase */
        text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
        opacity: 0;
        animation-duration: 1.5s;
        animation-fill-mode: forwards;
        pointer-events: none;
        z-index: 1000;
        display: none; /* Hidden by default */
    }

    .score-increase {
        color: limegreen;
        animation-name: fadeAndMoveUpIncrease;
    }

    .score-decrease {
        color: red;
        animation-name: fadeAndMoveUpDecrease;
    }

    @keyframes fadeAndMoveUpIncrease {
        0% { opacity: 0; transform: translate(-50%, 0%); }
        20% { opacity: 1; transform: translate(-50%, -50%); }
        80% { opacity: 1; transform: translate(-50%, -100%); }
        100% { opacity: 0; transform: translate(-50%, -150%); }
    }
    @keyframes fadeAndMoveUpDecrease {
        0% { opacity: 0; transform: translate(-50%, 0%); }
        20% { opacity: 1; transform: translate(-50%, -50%); }
        80% { opacity: 1; transform: translate(-50%, -100%); }
        100% { opacity: 0; transform: translate(-50%, -150%); }
    }

    /* Styles for selected/correct/incorrect answers */
    .answer-btn.selected-answer {
        background-color: #ffc107; /* Amber for selected */
        border-color: #ff9800;
        color: #333;
    }
    .answer-btn.correct-answer {
        background-color: #4CAF50; /* Green for correct */
        border-color: #388E3C;
        color: white;
    }
    .answer-btn.incorrect-answer {
        background-color: #f44336; /* Red for incorrect */
        border-color: #D32F2F;
        color: white;
    }
    /* Additions for new screens */
    #waiting-next-question {
        text-align: center;
        padding: 20px;
    }
    #final-results {
        text-align: center;
        padding: 20px;
    }
    #final-leaderboard-list {
        list-style: none;
        padding: 0;
        max-width: 400px;
        margin: 20px auto;
        background-color: rgba(255, 255, 255, 0.1);
        border-radius: 8px;
    }
    #final-leaderboard-list li {
        display: flex;
        justify-content: space-between;
        padding: 10px 15px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        font-size: 1.1em;
    }
    #final-leaderboard-list li:last-child {
        border-bottom: none;
    }
    #final-leaderboard-list li:nth-child(1) { font-weight: bold; color: gold; }
    #final-leaderboard-list li:nth-child(2) { font-weight: bold; color: silver; }
    #final-leaderboard-list li:nth-child(3) { font-weight: bold; color: #cd7f32; /* Bronze */ }
    .current-player-rank {
        background-color: rgba(0, 255, 255, 0.2); /* Highlight current player in leaderboards */
        border: 1px dashed aqua;
    }
`;
if (!document.getElementById('player-enhanced-scoring')) {
    const style = document.createElement('style');
    style.id = 'player-enhanced-scoring';
    style.textContent = playerEnhancedCSS;
    document.head.appendChild(style);
}

console.log('🎮 PLAYER: Enhanced player.js loaded successfully - v3');
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 PLAYER: DOM loaded, initializing player...');
    initializePlayer();
});