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
    let attempts = 0;
    const maxAttempts = 40;
    function checkReady() {
        attempts++;
        const firebaseReady = typeof firebase !== 'undefined';
        const databaseReady = typeof database !== 'undefined' && database && database.ref;
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
                case 'finished': await showFinalResults(); showStatus('Game has already ended!', 'info'); break;
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
    return new Promise((resolve) => {
        const gameRef = database.ref(`games/${currentGamePin}`);
        const timeout = setTimeout(() => { console.error('⏰ PLAYER: Game check timeout'); gameRef.off(); resolve({ exists: false, reason: 'timeout', message: 'Connection timeout. Check internet.'}); }, 10000);
        gameRef.once('value', (snapshot) => {
            clearTimeout(timeout);
            const gameData = snapshot.val();
            if (!gameData) { resolve({ exists: false, reason: 'not_found', message: 'Game not found. Check PIN.' }); return; }
            if (!gameData.quiz || !gameData.quiz.questions || gameData.quiz.questions.length === 0) { resolve({ exists: false, reason: 'invalid_quiz', message: 'Game has invalid quiz data.' }); return; }
            resolve({ exists: true, reason: 'success', message: 'Game found!' });
        }, (error) => { clearTimeout(timeout); console.error('💥 PLAYER: DB error game check:', error); resolve({ exists: false, reason: 'database_error', message: 'DB error: ' + error.message }); });
    });
}

async function onGameStateChange(gameState) {
    console.log('🎮 PLAYER: Game state changed to:', gameState?.status);
    if (!gameState) { console.log('⚠️ PLAYER: No game state received'); return; }
    switch (gameState.status) {
        case 'waiting': hideAllScreens(); showElement('waiting-lobby'); savePlayerState('lobby'); break;
        case 'playing': hasAnswered = false; isQuestionActive = true; questionEndTime = null; if (answerManager) answerManager.startQuestion(gameState.questionStartTime); showActiveQuestion(gameState); savePlayerState('playing'); break;
        case 'question_ended': isQuestionActive = false; questionEndTime = gameState.questionEndTime || Date.now(); if (currentTimerInterval) { clearInterval(currentTimerInterval); currentTimerInterval = null; } setTimeout(() => { showWaitingNext(); savePlayerState('question-ended'); }, 1500); break;
        case 'finished': console.log('🏁 PLAYER: Game state is finished. Processing final results display.'); if (currentTimerInterval) { clearInterval(currentTimerInterval); currentTimerInterval = null; } await showFinalResults(); break;
        case 'abandoned': console.log('👋 PLAYER: Game abandoned by host'); if (currentTimerInterval) clearInterval(currentTimerInterval); if (playerGameInstance) playerGameInstance.cleanup(); clearCurrentGameRuntimeVariables(); hasShownFinalResults = true; showStatus('Game ended - host disconnected', 'info'); Object.values(PLAYER_STATE_KEYS).forEach(key => localStorage.removeItem(key)); localStorage.removeItem('gamePin'); localStorage.removeItem('playerName'); setTimeout(() => { window.location.href = 'index.html'; }, 3000); break;
        default: console.log('❓ PLAYER: Unknown game status:', gameState.status);
    }
}

function onPlayersUpdate(players) {
    const playerCount = Object.keys(players).length;
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
    const scoreIncreaseEl = document.getElementById('score-increase-display');
    if (scoreIncreaseEl) {
        scoreIncreaseEl.textContent = `+${points}`;
        scoreIncreaseEl.classList.remove('hidden');
        scoreIncreaseEl.classList.add('fade-up');
        scoreIncreaseEl.style.opacity = '1';
        scoreIncreaseEl.style.transform = 'translateY(0)';

        setTimeout(() => {
            scoreIncreaseEl.classList.remove('fade-up');
            scoreIncreaseEl.classList.add('hidden');
            scoreIncreaseEl.style.opacity = '0';
            scoreIncreaseEl.style.transform = 'translateY(-20px)';
        }, 1500);
    }
}

function showWaitingLobby() {
    hideAllScreens();
    showElement('waiting-lobby');
    showStatus('Joined successfully! Waiting for host to start...', 'success');
}

function showActiveQuestion(gameState) {
    if (!gameState || !gameState.quiz || gameState.currentQuestion === undefined) {
        console.error('💥 PLAYER: Invalid game state for active question display.');
        return;
    }
    currentQuestionData = gameState.quiz.questions[gameState.currentQuestion];
    if (!currentQuestionData) {
        console.error('💥 PLAYER: No quiz data found in localStorage.');
        return;
    }

    hideAllScreens();
    showElement('active-question');

    document.getElementById('question-number').textContent = `Question ${gameState.currentQuestion + 1}`;
    document.getElementById('question-text').textContent = currentQuestionData.question;

    const answersContainer = document.getElementById('answers-container');
    answersContainer.innerHTML = '';
    currentQuestionData.answers.forEach((answer, index) => {
        const button = document.createElement('button');
        button.className = 'answer-btn';
        button.textContent = answer.text;
        button.onclick = () => selectAnswer(index);
        answersContainer.appendChild(button);
    });

    startTimerPlayer(gameState.timeLeft); // Use timeLeft from host's state
    hasAnswered = false; // Reset answered status for new question
}

function displayQuestion(question, questionNumber) {
    // This function is likely redundant if showActiveQuestion is called directly.
    // Ensure showActiveQuestion is the primary display function.
    console.log('❓ PLAYER: Displaying question (via displayQuestion):', questionNumber);
    document.getElementById('question-number').textContent = `Question ${questionNumber + 1}`;
    document.getElementById('question-text').textContent = question.question;

    const answersContainer = document.getElementById('answers-container');
    answersContainer.innerHTML = '';
    question.answers.forEach((answer, index) => {
        const button = document.createElement('button');
        button.className = 'answer-btn';
        button.textContent = answer.text;
        button.onclick = () => selectAnswer(index);
        answersContainer.appendChild(button);
    });
}

function startTimerPlayer(duration) {
    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
    }
    let timeLeft = duration;
    const timerDisplay = document.getElementById('player-timer');
    timerDisplay.textContent = `Time: ${timeLeft}s`;

    currentTimerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = `Time: ${timeLeft}s`;

        if (timeLeft <= 5 && timeLeft > 0) {
            timerDisplay.classList.add('timer-warning');
        } else {
            timerDisplay.classList.remove('timer-warning');
        }

        if (timeLeft <= 0) {
            clearInterval(currentTimerInterval);
            currentTimerInterval = null;
            onTimeout();
        }
    }, 1000);
}

async function selectAnswer(answerIndex) {
    if (!currentQuestionData) {
        console.error('💥 PLAYER: No current question data to answer.');
        showStatus('No active question to answer!', 'error');
        return;
    }

    if (!answerManager.canAnswer()) {
        showFeedback('You already answered this question!');
        return;
    }

    answerManager.markAnswered(); // Mark as answered locally

    const selectedAnswer = currentQuestionData.answers[answerIndex];
    const isCorrect = selectedAnswer.isCorrect;
    const responseTime = answerManager.getResponseTime();
    let pointsAwarded = 0;

    if (isCorrect) {
        pointsAwarded = Math.max(0, 100 - Math.floor(responseTime * 5)); // Example scoring
        playerScore += pointsAwarded;
        showFeedback('Correct! +' + pointsAwarded + ' points');
    } else {
        showFeedback('Incorrect. Try again next time!');
    }

    // Disable all answer buttons after answering
    const answerButtons = document.querySelectorAll('#answers-container .answer-btn');
    answerButtons.forEach(button => {
        button.disabled = true;
        if (currentQuestionData.answers[Array.from(answerButtons).indexOf(button)].isCorrect) {
            button.classList.add('correct-answer-highlight'); // Highlight correct answer on player side
        } else if (button === answerButtons[answerIndex] && !isCorrect) {
            button.classList.add('incorrect-answer-highlight'); // Highlight chosen incorrect answer
        }
    });

    // Send answer to Firebase
    try {
        const answerData = {
            playerId: playerGamePlayerId,
            questionIndex: currentQuestionData.questionIndex, // Assuming currentQuestionData has questionIndex
            answerIndex: answerIndex,
            isCorrect: isCorrect,
            points: pointsAwarded,
            responseTime: responseTime,
            answeredAt: Date.now()
        };
        await database.ref(`games/${currentGamePin}/answers/${playerGamePlayerId}/${Date.now()}`).set(answerData);
        // Update player's score in Firebase
        await database.ref(`games/${currentGamePin}/players/${playerGamePlayerId}/score`).set(playerScore);

        console.log('✅ PLAYER: Answer submitted:', answerData);
    } catch (error) {
        console.error('💥 PLAYER: Error submitting answer:', error);
        showStatus('Error submitting answer.', 'error');
    }

    updateScoreDisplay(); // Update local score display
}

function onTimeout() {
    console.log('⏰ PLAYER: Time ran out!');
    if (!hasAnswered) { // Only show feedback if they haven't answered yet
        showFeedback('Time\'s up! No answer submitted.');
    }
    // Disable all answer buttons
    const answerButtons = document.querySelectorAll('#answers-container .answer-btn');
    answerButtons.forEach(button => {
        button.disabled = true;
        // Optionally show correct answer after timeout
        if (currentQuestionData) {
            const index = Array.from(answerButtons).indexOf(button);
            if (currentQuestionData.answers[index].isCorrect) {
                button.classList.add('correct-answer-highlight');
            }
        }
    });
}

function showFeedback(message) {
    const feedbackEl = document.getElementById('feedback-message');
    if (feedbackEl) {
        feedbackEl.textContent = message;
        feedbackEl.classList.remove('hidden');
        feedbackEl.classList.add('active'); // Add active class for styling
        setTimeout(() => {
            feedbackEl.classList.remove('active');
            feedbackEl.classList.add('hidden');
        }, 2000); // Display for 2 seconds
    }
}

function showWaitingNext() {
    console.log('⏳ PLAYER: Showing waiting for next screen.');
    // Get the current player count from the DOM element that is already updated by onPlayersUpdate
    const playerCountEl = document.getElementById('lobby-player-count');
    const currentPlayerCount = playerCountEl ? parseInt(playerCountEl.textContent) : 0;

    // Use currentPlayerCount for displaying information to the user.
    // Replace any lines that might have previously referenced 'hostPlayers'.
    console.log(`📢 PLAYER (info): Waiting for the next question... Current players: ${currentPlayerCount}`);

    // Assuming you have a screen for this state
    hideAllScreens();
    showElement('waiting-next-question');

    // Update player's current score display on this screen
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

function updateLeaderboards(players) {
    // Implement logic to update a real-time leaderboard if needed
    // This is optional for player view, host typically manages primary leaderboard display
    const inGameLeaderboardEl = document.getElementById('in-game-leaderboard');
    if (inGameLeaderboardEl) {
        const playerArray = Object.values(players || {});
        const sortedPlayers = playerArray.sort((a, b) => b.score - a.score);

        inGameLeaderboardEl.innerHTML = '';
        sortedPlayers.slice(0, 5).forEach((player, index) => { // Show top 5
            const li = document.createElement('li');
            li.textContent = `${index + 1}. ${player.name}: ${player.score}`;
            inGameLeaderboardEl.appendChild(li);
        });
    }
}
function updateLeaderboard(elementId, players) {
    // This function can be merged with updateLeaderboards or adapted.
    // Keeping it for now if there are separate leaderboard elements.
    const leaderboardEl = document.getElementById(elementId);
    if (!leaderboardEl) {
        console.warn(`Leaderboard element with ID ${elementId} not found.`);
        return;
    }
    leaderboardEl.innerHTML = ''; // Clear previous entries

    const playerArray = Object.values(players || {});
    const sortedPlayers = playerArray.sort((a, b) => b.score - a.score);

    sortedPlayers.forEach((player, index) => {
        const li = document.createElement('li');
        li.classList.add('leaderboard-item');
        if (player.id === playerGamePlayerId) {
            li.classList.add('current-player'); // Highlight current player
        }
        li.innerHTML = `
            <span class="rank">${index + 1}.</span>
            <span class="player-name">${player.name}</span>
            <span class="player-score">${player.score} points</span>
        `;
        leaderboardEl.appendChild(li);
    });
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
    const screens = ['joining-game', 'waiting-lobby', 'active-question', 'waiting-next-question', 'final-results'];
    screens.forEach(id => hideElement(id));
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
    const statusEl = document.getElementById('player-status-message');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`; // Add type class for styling
        statusEl.style.display = 'block';
        setTimeout(() => {
            statusEl.textContent = '';
            statusEl.className = 'status-message';
        }, 3000);
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
    // You might want to pause/resume game state or re-check Firebase if the player tab goes to background/foreground
    // For now, no specific action is taken.
    if (document.hidden) {
        console.log('👤 PLAYER: Tab is hidden.');
    } else {
        console.log('👤 PLAYER: Tab is visible again.');
        // Potentially re-sync state or check if game progressed while hidden
    }
});

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

const playerEnhancedCSS = `
/* Enhanced styling for player pages */
body {
    font-family: 'Arial', sans-serif;
    background-color: #f0f2f5;
    color: #333;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    margin: 0;
    overflow: hidden; /* Prevent scroll on confetti */
}

.container {
    background-color: #fff;
    padding: 30px;
    border-radius: 12px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
    text-align: center;
    max-width: 500px;
    width: 90%;
    box-sizing: border-box;
    position: relative; /* For status messages */
}

.quiz-container {
    padding: 20px;
}

h1, h2 {
    color: #007bff;
    margin-bottom: 20px;
}

.game-info p {
    font-size: 1.1em;
    margin: 10px 0;
}

.game-pin {
    font-weight: bold;
    color: #28a745;
    font-size: 1.2em;
}

#lobby-player-count {
    font-weight: bold;
    color: #007bff;
}

.question-card {
    background-color: #f8f9fa;
    border: 1px solid #e2e6ea;
    border-radius: 8px;
    padding: 25px;
    margin-bottom: 20px;
}

#question-text {
    font-size: 1.4em;
    margin-bottom: 25px;
    color: #343a40;
    min-height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
}

#answers-container {
    display: grid;
    grid-template-columns: 1fr;
    gap: 15px;
    margin-top: 20px;
}

.answer-btn {
    background-color: #007bff;
    color: white;
    padding: 15px 20px;
    border: none;
    border-radius: 8px;
    font-size: 1.1em;
    cursor: pointer;
    transition: background-color 0.3s ease, transform 0.1s ease;
    width: 100%;
    box-sizing: border-box;
}

.answer-btn:hover:not(:disabled) {
    background-color: #0056b3;
    transform: translateY(-2px);
}

.answer-btn:active:not(:disabled) {
    transform: translateY(0);
}

.answer-btn:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
    opacity: 0.8;
}

#player-timer {
    font-size: 1.5em;
    font-weight: bold;
    color: #dc3545;
    margin-top: 20px;
    padding: 10px;
    background-color: #ffebeb;
    border-radius: 8px;
}

.timer-warning {
    animation: pulseRed 1s infinite;
}

@keyframes pulseRed {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.05); opacity: 0.8; }
    100% { transform: scale(1); opacity: 1; }
}

#feedback-message {
    margin-top: 20px;
    font-size: 1.2em;
    font-weight: bold;
    color: #28a745; /* Green for correct */
    min-height: 20px;
    opacity: 0;
    transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out;
    transform: translateY(10px);
}

#feedback-message.active {
    opacity: 1;
    transform: translateY(0);
}

#score-increase-display {
    position: absolute;
    top: 10px;
    right: 10px;
    background-color: #28a745; /* Green */
    color: white;
    padding: 5px 10px;
    border-radius: 5px;
    font-weight: bold;
    font-size: 1em;
    opacity: 0;
    transform: translateY(0);
    transition: opacity 0.5s ease-out, transform 0.5s ease-out;
    pointer-events: none;
    z-index: 10;
}

#score-increase-display.fade-up {
    opacity: 1;
    transform: translateY(-20px);
}

#score-increase-display.hidden {
    display: none;
}

.status-message {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    padding: 10px 0;
    font-size: 1.1em;
    font-weight: bold;
    background-color: #f8d7da; /* Default for error/info */
    color: #721c24; /* Default for error/info */
    border-radius: 8px 8px 0 0;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    z-index: 100;
    display: none;
    box-sizing: border-box;
}

.status-message.success {
    background-color: #d4edda;
    color: #155724;
}

.status-message.error {
    background-color: #f8d7da;
    color: #721c24;
}

.status-message.info {
    background-color: #d1ecf1;
    color: #0c5460;
}

/* Score display on player view */
#current-score-container {
    margin-top: 20px;
    font-size: 1.2em;
    color: #007bff;
    font-weight: bold;
}

#current-score {
    font-size: 1.8em;
    color: #28a745;
    transition: all 0.3s ease-in-out;
}

#current-score.score-updated {
    transform: scale(1.1);
    color: #1e7e34;
}

/* Final Results Screen */
#final-results h2 {
    color: #28a745;
}

#player-final-score {
    font-size: 2em;
    font-weight: bold;
    color: #007bff;
    margin: 20px 0;
    background: linear-gradient(135deg, #007bff 0%, #28a745 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
}

.leaderboard-list {
    list-style: none;
    padding: 0;
    margin-top: 20px;
    max-height: 250px;
    overflow-y: auto;
    border: 1px solid #eee;
    border-radius: 8px;
    background-color: #fcfcfc;
}

.leaderboard-item {
    display: flex;
    justify-content: space-between;
    padding: 10px 15px;
    border-bottom: 1px solid #eee;
    font-size: 1.1em;
}

.leaderboard-item:last-child {
    border-bottom: none;
}

.leaderboard-item.current-player {
    background-color: #e6f7ff;
    font-weight: bold;
    color: #0056b3;
}

.rank {
    font-weight: bold;
    color: #666;
    margin-right: 10px;
}
.player-name {
    flex-grow: 1;
    text-align: left;
}
.player-score {
    font-weight: bold;
    color: #28a745;
}

button.play-again-btn {
    background-color: #6f42c1; /* Purple */
    margin-top: 30px;
    padding: 15px 30px;
    font-size: 1.2em;
    border-radius: 10px;
}

button.play-again-btn:hover {
    background-color: #5a2e9e;
}

/* Game Over animation for player-final-score */
@keyframes gameOverPulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
}

#player-final-score {
    /* Existing styles */
    border: 4px solid #ffffff; /* Example border */
    animation: gameOverPulse 2s ease-in-out infinite alternate;
}

.confetti {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    overflow: hidden;
}

.confetti::before,
.confetti::after {
    content: '🎉';
    position: absolute;
    font-size: 2rem;
    animation: confettiFall 3s linear infinite;
}

.confetti::before {
    left: 20%;
    animation-delay: 0s;
}

.confetti::after {
    right: 20%;
    animation-delay: 1s;
}

@keyframes confettiFall {
    0% {
        transform: translateY(-100px) rotate(0deg);
        opacity: 1;
    }
    100% {
        transform: translateY(100vh) rotate(360deg);
        opacity: 0;
    }
}
`;

// Inject the game over CSS
if (!document.getElementById('player-enhanced-scoring')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'player-enhanced-scoring';
    styleSheet.type = 'text/css';
    styleSheet.innerText = playerEnhancedCSS;
    document.head.appendChild(styleSheet);
}

console.log('🎮 PLAYER: Enhanced player.js loaded successfully - v3');
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 PLAYER: DOM loaded, initializing player...');
    initializePlayer();
});