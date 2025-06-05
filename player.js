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
            const newPlayerId = Date.now().toString() + '_' + Math.floor(Math.random() * 1000);
            const playerData = { id: newPlayerId, name: playerName, score: 0, status: 'waiting', joinedAt: Date.now() };
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
            if (gameState) callback(gameState);
        }, (error) => console.error('💥 GAME: Game state listener error:', error));
    }
    listenToPlayers(callback) {
        console.log('👥 GAME: Setting up players listener');
        const playersRef = database.ref(`games/${this.gamePin}/players`);
        playersRef.on('value', (snapshot) => {
            const players = snapshot.val() || {};
            console.log('👥 GAME: Players update:', Object.keys(players).length, 'players');
            callback(players);
        }, (error) => console.error('💥 GAME: Players listener error:', error));
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

    const newGamePin = localStorage.getItem('gamePin');
    const newPlayerName = localStorage.getItem('playerName');
    console.log('🎮 PLAYER: Retrieved join info - PIN:', newGamePin, 'Name:', newPlayerName);

    clearOldSessionState(); // Clears variables and localStorage for a totally new start

    answerManager = new SimpleAnswerManager();
    currentGamePin = newGamePin;
    playerGamePlayerName = newPlayerName;

    if (!currentGamePin || !playerGamePlayerName) {
        console.error('❌ PLAYER: Missing game information. Redirecting to home.');
        showStatus('Invalid game information. Please enter game PIN and name.', 'error');
        setTimeout(() => { window.location.href = 'index.html'; }, 3000);
        return;
    }

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
        playerGamePlayerId = await playerGameInstance.joinGame(playerGamePlayerName);
        if (!playerGamePlayerId) throw new Error('Failed to get player ID from join operation');
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
                case 'playing': case 'question_ended': showWaitingNext(); showStatus('Game in progress. Wait for next question!', 'info'); savePlayerState('waiting-next'); break;
                case 'finished': await showFinalResults(); showStatus('Game has already ended!', 'info'); break; // Ensure this await is handled
                default: showElement('waiting-lobby'); showStatus('Joined successfully!', 'success'); savePlayerState('lobby');
            }
        } else { showElement('waiting-lobby'); showStatus('Joined successfully!', 'success'); savePlayerState('lobby'); }
        console.log('✅ PLAYER: Setup complete!');
    } catch (error) {
        console.error('💥 PLAYER: Join failed:', error);
        showStatus('Failed to join: ' + error.message, 'error');
        localStorage.removeItem('gamePin'); localStorage.removeItem('playerName');
        setTimeout(() => { window.location.href = 'index.html'; }, 3000);
    }
}

function checkGameExistsDetailed() {
    // ... (checkGameExistsDetailed implementation as before)
    return new Promise((resolve) => {
        // console.log('🔍 PLAYER: Detailed game check for PIN:', currentGamePin);
        const gameRef = database.ref(`games/${currentGamePin}`);
        const timeout = setTimeout(() => { console.error('⏰ PLAYER: Game check timeout'); gameRef.off(); resolve({ exists: false, reason: 'timeout', message: 'Connection timeout. Check internet.'}); }, 10000);
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

function showScoreIncrease(points) { /* ... (implementation as before) ... */ }
function showWaitingLobby() { /* ... (implementation as before) ... */ }
function showActiveQuestion(gameState) { /* ... (implementation as before, sets currentQuestionData) ... */ }
function displayQuestion(question, questionNumber) { /* ... (implementation as before) ... */ }
function startTimerPlayer(duration) { /* ... (implementation as before) ... */ }
async function selectAnswer(answerIndex) { /* ... (implementation as before, uses currentQuestionData) ... */ }
function onTimeout() { /* ... (implementation as before) ... */ }
function showFeedback(message) { /* ... (implementation as before) ... */ }

function showWaitingNext() {
    console.log('⏳ PLAYER: Showing waiting for next screen.');
    // Get the current player count from the DOM element that is already updated by onPlayersUpdate
    const playerCountEl = document.getElementById('lobby-player-count');
    const currentPlayerCount = playerCountEl ? parseInt(playerCountEl.textContent) : 0;

    // Use currentPlayerCount for displaying information to the user.
    // Replace any lines that might have previously referenced 'hostPlayers'.
    console.log(`📢 PLAYER (info): Waiting for the next question... Current players: ${currentPlayerCount}`);

    // If there's an element that was supposed to display hostPlayers, update it like this:
    // const waitingScreenPlayerCountEl = document.getElementById('some-id-on-waiting-screen');
    // if (waitingScreenPlayerCountEl) {
    //     waitingScreenPlayerCountEl.textContent = currentPlayerCount;
    // }

    hideAllScreens();
    showElement('waiting-next-question'); // Assuming you have a screen for this state
    // You might also update the 'lobby-player-count' element visibility here if it's not always visible
    // or if you have a separate element for this waiting screen.
    const currentScoreEl = document.getElementById('current-score');
    if (currentScoreEl) {
        currentScoreEl.textContent = playerScore;
    }
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

function updateLeaderboards(players) { /* ... (implementation as before) ... */ }
function updateLeaderboard(elementId, players) { /* ... (implementation as before) ... */ }

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

function hideAllScreens() { /* ... (implementation as before) ... */ }
function hideElement(id) { /* ... (implementation as before) ... */ }
function showElement(id) { /* ... (implementation as before) ... */ }
function showStatus(message, type) { /* ... (implementation as before) ... */ }

window.addEventListener('beforeunload', () => {
    console.log('🧹 PLAYER: Page unloading - potential cleanup');
    if (playerGameInstance && !hasShownFinalResults) { // Only cleanup if game wasn't formally finished
        // This is tricky; abrupt leave might corrupt host view or not clear player from game node.
        // For now, basic listener cleanup.
        // playerGameInstance.cleanup(); // Might be too aggressive if just a refresh
    }
    if (currentTimerInterval) clearInterval(currentTimerInterval);
});

document.addEventListener('visibilitychange', () => { /* ... (implementation as before) ... */ });

function playAgain() {
    console.log('🔄 PLAYER: Play again clicked. Resetting for new session.');
    hasShownFinalResults = false; // CRITICAL: Reset this flag

    // Clear all localStorage items that might persist from the previous session
    Object.values(PLAYER_STATE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });
    localStorage.removeItem('gamePin'); // Used by index.html to pass info
    localStorage.removeItem('playerName'); // Used by index.html to pass info

    window.location.href = 'index.html';
}
window.playAgain = playAgain;

const playerEnhancedCSS = ` /* ... (CSS as before) ... */ `;
if (!document.getElementById('player-enhanced-scoring')) { /* ... (CSS injection as before) ... */ }

console.log('🎮 PLAYER: Enhanced player.js loaded successfully - v3');
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 PLAYER: DOM loaded, initializing player...');
    initializePlayer();
});