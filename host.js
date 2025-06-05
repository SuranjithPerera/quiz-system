// CRITICAL FIX: Enhanced endQuiz function to properly notify players
async function endQuiz() {
    console.log('🏁 HOST: Ending quiz and notifying all players');

    if (hostQuestionTimer) {
        clearInterval(hostQuestionTimer);
        hostQuestionTimer = null;
    }

    // Clear auto-cleanup timer
    if (gameAutoCleanupTimer) {
        clearTimeout(gameAutoCleanupTimer);
        gameAutoCleanupTimer = null;
    }

    try {
        // CRITICAL FIX: Ensure game state is set to 'finished' so players get notified
        if (hostGameInstance && database && hostGamePin) {
            console.log('📡 HOST: Setting game state to finished in Firebase...');

            const gameStateRef = database.ref(`games/${hostGamePin}/gameState`);
            await gameStateRef.update({
                status: 'finished',
                endedAt: Date.now(),
                endReason: 'host_ended',
                message: 'Quiz completed by host'
            });

            console.log('✅ HOST: Game state updated to finished in Firebase');

            // Also call the game instance end method
            await hostGameInstance.endGame();
        } else {
            console.warn('⚠️ HOST: Missing game instance or database for proper game ending');
        }

        // Show results screen on host side
        showResults();
        showStatus('Quiz ended! All players have been notified.', 'success'); // Typo fix: 'sucess' -> 'success'
    } catch (error) {
        console.error('💥 HOST: Error ending quiz:', error);
        showStatus('Error ending quiz', 'error');
    }
}

// Global variables for the host side
let database;
let hostGameInstance = null;
let hostGamePin = null;
let currentQuizData = null;
let currentQuestionIndex = 0;
let hostQuestionTimer = null;
let isHostGameActive = false;
let gameAutoCleanupTimer = null; // Timer to clean up game data if host abandons

const QUIZ_STATE_KEYS = {
    GAME_PIN: 'host_game_pin',
    QUIZ_DATA: 'host_quiz_data',
    QUESTION_INDEX: 'host_question_index',
    GAME_STATE: 'host_game_state',
    IS_ACTIVE: 'host_is_active'
};

// Simple Quiz Game class (Host side)
class SimpleQuizGameHost {
    constructor(gamePin, quizData) {
        this.gamePin = gamePin;
        this.quizData = quizData;
        this.playersRef = database.ref(`games/${gamePin}/players`);
        this.gameStateRef = database.ref(`games/${gamePin}/gameState`);
        this.gameRootRef = database.ref(`games/${gamePin}`);
    }

    async createGame() {
        console.log('🎮 HOST: Creating new game in Firebase...');
        const initialGameState = {
            status: 'waiting',
            currentQuestion: 0,
            timeLeft: 0,
            hostId: firebase.auth().currentUser ? firebase.auth().currentUser.uid : 'anon_host_' + Date.now()
        };
        await this.gameRootRef.set({
            quiz: this.quizData,
            gameState: initialGameState,
            createdAt: Date.now(),
            hostId: initialGameState.hostId
        });
        console.log('✅ HOST: Game created in Firebase:', this.gamePin);
    }

    async updateGameState(status, questionIndex = 0, timeLeft = 0, questionStartTime = null, questionEndTime = null) {
        const updateData = { status, currentQuestion: questionIndex, timeLeft };
        if (questionStartTime) updateData.questionStartTime = questionStartTime;
        if (questionEndTime) updateData.questionEndTime = questionEndTime;
        await this.gameStateRef.update(updateData);
    }

    listenToPlayers(callback) {
        console.log('🎧 HOST: Setting up players listener...');
        this.playersRef.on('value', (snapshot) => {
            const players = snapshot.val() || {};
            console.log('👥 HOST: Players update:', Object.keys(players).length, 'players');
            callback(players);
        });
    }

    async endGame() {
        console.log('🏁 HOST: Ending game instance and cleaning up...');
        if (this.gamePin) {
            // Detach listeners
            if (this.playersRef) this.playersRef.off();
            if (this.gameStateRef) this.gameStateRef.off();

            // Clear specific game state in Firebase, but retain game node for results retrieval
            if (this.gameStateRef) {
                await this.gameStateRef.update({
                    status: 'finished',
                    endedAt: Date.now(),
                    message: 'Game officially ended by host'
                }).catch(e => console.error('Error updating game state to finished on end:', e));
            }
            console.log('✅ HOST: Game instance cleaned up.');
        }
    }

    // New method for full game cleanup (e.g., for 'resetGame' or host abandonment)
    async deleteGameData() {
        console.log('🗑️ HOST: Deleting all game data for PIN:', this.gamePin);
        if (this.gameRootRef) {
            await this.gameRootRef.remove()
                .then(() => console.log('✅ HOST: Game data successfully removed from Firebase.'))
                .catch(error => console.error('💥 HOST: Error removing game data:', error));
        }
    }

    cleanup() { // Legacy cleanup, prefer endGame for graceful end and deleteGameData for full removal
        console.log('🧹 HOST: Generic cleanup method called. Detaching listeners.');
        if (this.playersRef) this.playersRef.off();
        if (this.gameStateRef) this.gameStateRef.off();
    }
}


function initializeHost() {
    console.log('🎮 HOST: Starting initialization...');
    hideAllScreens();
    showElement('welcome-screen');

    waitForFirebaseReady(authenticateAndLoad);
}

function waitForFirebaseReady(callback) {
    let attempts = 0;
    const maxAttempts = 40; // 20 seconds total
    function checkReady() {
        attempts++;
        const firebaseReady = typeof firebase !== 'undefined';
        const databaseReady = typeof database !== 'undefined' && database && database.ref;
        if (firebaseReady && databaseReady) {
            console.log('✅ HOST: Firebase and database ready!');
            callback();
        } else if (attempts >= maxAttempts) {
            console.error('❌ HOST: Timeout waiting for Firebase. Please refresh.');
            showStatus('Connection timeout. Please refresh and try again.', 'error');
        } else {
            setTimeout(checkReady, 500);
        }
    }
    checkReady();
}

function authenticateAndLoad() {
    firebase.auth().signInAnonymously()
        .then(() => {
            database = firebase.database();
            console.log('✅ HOST: Firebase authenticated anonymously and database initialized.');
            checkPreviousSession();
        })
        .catch((error) => {
            console.error('💥 HOST: Firebase authentication failed:', error);
            showStatus('Authentication failed: ' + error.message, 'error');
        });
}

async function checkPreviousSession() {
    console.log('🔍 HOST: Checking for previous session...');
    const savedPin = localStorage.getItem(QUIZ_STATE_KEYS.GAME_PIN);
    const savedQuizData = JSON.parse(localStorage.getItem(QUIZ_STATE_KEYS.QUIZ_DATA));
    const savedQuestionIndex = parseInt(localStorage.getItem(QUIZ_STATE_KEYS.QUESTION_INDEX));
    const savedGameState = localStorage.getItem(QUIZ_STATE_KEYS.GAME_STATE);
    const wasActive = localStorage.getItem(QUIZ_STATE_KEYS.IS_ACTIVE) === 'true';

    if (savedPin && savedQuizData && wasActive) {
        console.log('🔄 HOST: Found active previous session. Attempting to restore...');
        hostGamePin = savedPin;
        currentQuizData = savedQuizData;
        currentQuestionIndex = savedQuestionIndex || 0;

        // Verify if the game still exists in Firebase
        try {
            const gameSnapshot = await database.ref(`games/${hostGamePin}`).once('value');
            const gameExists = gameSnapshot.exists();
            const gameStatus = gameSnapshot.val()?.gameState?.status;

            if (gameExists && gameStatus !== 'finished' && gameStatus !== 'abandoned') {
                hostGameInstance = new SimpleQuizGameHost(hostGamePin, currentQuizData);
                hostGameInstance.listenToPlayers(updatePlayerList);
                showElement('lobby-screen'); // Or directly active game if status was 'playing'
                document.getElementById('game-pin-display').textContent = hostGamePin;
                showStatus('Restored previous game session!', 'info');
                isHostGameActive = true;
                if (savedGameState === 'playing' || savedGameState === 'question_ended') {
                    // Attempt to display current question or waiting for next
                    displayCurrentQuestion(); // This will show the UI elements
                    // The actual state handling (timer, etc.) should come from Firebase
                    // as onGameStateChange (which is player-side) isn't directly replicated for host.
                    // Host should rely on its own timer management after restore.
                } else {
                    showElement('lobby-screen');
                }
                console.log('✅ HOST: Previous session restored.');
                return;
            } else {
                console.log('⚠️ HOST: Previous game does not exist or is finished/abandoned. Clearing session.');
                clearHostSessionState();
            }
        } catch (error) {
            console.error('💥 HOST: Error checking previous game state in Firebase:', error);
            clearHostSessionState();
        }
    }
    console.log('✅ HOST: No active previous session to restore. Showing welcome.');
    showElement('welcome-screen');
}

function clearHostSessionState() {
    console.log('🧹 HOST: Clearing host session state from localStorage.');
    Object.values(QUIZ_STATE_KEYS).forEach(key => localStorage.removeItem(key));
    hostGamePin = null;
    currentQuizData = null;
    currentQuestionIndex = 0;
    isHostGameActive = false;
    if (hostGameInstance) {
        hostGameInstance.cleanup(); // Detach Firebase listeners
        hostGameInstance = null;
    }
    if (hostQuestionTimer) {
        clearInterval(hostQuestionTimer);
        hostQuestionTimer = null;
    }
    if (gameAutoCleanupTimer) {
        clearTimeout(gameAutoCleanupTimer);
        gameAutoCleanupTimer = null;
    }
    console.log('✅ HOST: Host session state cleared.');
}

function saveHostState(gameState) {
    localStorage.setItem(QUIZ_STATE_KEYS.GAME_PIN, hostGamePin);
    localStorage.setItem(QUIZ_STATE_KEYS.QUIZ_DATA, JSON.stringify(currentQuizData));
    localStorage.setItem(QUIZ_STATE_KEYS.QUESTION_INDEX, currentQuestionIndex.toString());
    localStorage.setItem(QUIZ_STATE_KEYS.GAME_STATE, gameState);
    localStorage.setItem(QUIZ_STATE_KEYS.IS_ACTIVE, 'true');
    console.log('💾 HOST: State saved:', { gamePin: hostGamePin, questionIndex: currentQuestionIndex, gameState });
}

function selectQuiz(quizName) {
    console.log('📚 HOST: Selected quiz:', quizName);
    const quiz = quizzes.find(q => q.name === quizName);
    if (quiz) {
        currentQuizData = quiz;
        document.getElementById('selected-quiz-name').textContent = quiz.name;
        hideElement('welcome-screen');
        showElement('lobby-screen');
        createGameSession();
    } else {
        showStatus('Quiz not found!', 'error');
    }
}

async function createGameSession() {
    console.log('✨ HOST: Creating new game session...');
    clearHostSessionState(); // Ensure clean slate for new game

    hostGamePin = generateGamePin();
    document.getElementById('game-pin-display').textContent = hostGamePin;

    hostGameInstance = new SimpleQuizGameHost(hostGamePin, currentQuizData);
    try {
        await hostGameInstance.createGame();
        hostGameInstance.listenToPlayers(updatePlayerList);
        isHostGameActive = true;
        currentQuestionIndex = 0; // Reset question index for new game
        saveHostState('waiting');
        showStatus('Game created! Share PIN: ' + hostGamePin, 'success');

        // Set a timer to automatically clean up game if host leaves without ending
        // This is a safety net. Adjust time as needed (e.g., 1 hour = 3600000 ms)
        gameAutoCleanupTimer = setTimeout(async () => {
            console.warn('⚠️ HOST: Auto-cleanup triggered due to inactivity or host abandonment.');
            if (hostGameInstance) {
                await hostGameInstance.deleteGameData();
                clearHostSessionState();
                showStatus('Game automatically cleaned up.', 'info');
                window.location.reload(); // Refresh to clean slate
            }
        }, 3600000); // 1 hour

    }
    catch (error) {
        console.error('💥 HOST: Error creating game session:', error);
        showStatus('Failed to create game. Try again.', 'error');
        hostGameInstance = null;
        hostGamePin = null;
        isHostGameActive = false;
        hideAllScreens();
        showElement('welcome-screen');
    }
}

function updatePlayerList(players) {
    const playerListEl = document.getElementById('player-list');
    if (!playerListEl) { console.error('Player list element not found!'); return; }
    playerListEl.innerHTML = '';
    const playerArray = Object.values(players || {});
    playerArray.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.name + (player.score !== undefined ? ` (${player.score})` : '');
        playerListEl.appendChild(li);
    });
    document.getElementById('player-count').textContent = playerArray.length;

    // Dynamically enable/disable start button based on player count
    const startButton = document.getElementById('start-quiz-btn');
    if (startButton) {
        startButton.disabled = playerArray.length === 0;
    }
}

function startQuiz() {
    console.log('🚀 HOST: Starting quiz...');
    if (!hostGameInstance || !currentQuizData || currentQuizData.questions.length === 0) {
        showStatus('No quiz selected or quiz has no questions!', 'error');
        return;
    }
    hideAllScreens();
    showElement('active-game');
    currentQuestionIndex = 0;
    hostGameInstance.updateGameState('playing', currentQuestionIndex, 0); // Reset timer initially
    saveHostState('playing');
    displayCurrentQuestion();
    showStatus('Quiz has started!', 'success');
}

function displayCurrentQuestion() {
    console.log('❓ HOST: Displaying question:', currentQuestionIndex);
    const question = currentQuizData.questions[currentQuestionIndex];
    if (!question) {
        console.log('⚠️ HOST: No more questions. Showing results.');
        showResults();
        return;
    }

    document.getElementById('question-number').textContent = `Question ${currentQuestionIndex + 1} / ${currentQuizData.questions.length}`;
    document.getElementById('question-text').textContent = question.question;

    const answersContainer = document.getElementById('answers-container');
    answersContainer.innerHTML = ''; // Clear previous answers
    question.answers.forEach((answer, index) => {
        const button = document.createElement('button');
        button.className = 'answer-btn';
        button.textContent = answer.text;
        // No click listener for host; host just displays
        answersContainer.appendChild(button);
    });

    startQuestionTimer(question.time || 15); // Default to 15 seconds
}

function startQuestionTimer(duration) {
    if (hostQuestionTimer) {
        clearInterval(hostQuestionTimer);
    }
    let timeLeft = duration;
    const timerDisplay = document.getElementById('timer-display');
    timerDisplay.textContent = `Time: ${timeLeft}s`;

    hostGameInstance.updateGameState('playing', currentQuestionIndex, timeLeft, Date.now()); // Update initial state with start time

    hostQuestionTimer = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = `Time: ${timeLeft}s`;

        if (timeLeft <= 5 && timeLeft > 0) {
            timerDisplay.classList.add('timer-warning');
        } else {
            timerDisplay.classList.remove('timer-warning');
        }

        hostGameInstance.updateGameState('playing', currentQuestionIndex, timeLeft); // Update current time left
        if (timeLeft <= 0) {
            clearInterval(hostQuestionTimer);
            hostQuestionTimer = null;
            endQuestion();
        }
    }, 1000);
}

async function endQuestion() {
    console.log('🛑 HOST: Question ended.');
    if (hostQuestionTimer) {
        clearInterval(hostQuestionTimer);
        hostQuestionTimer = null;
    }

    const questionEndTime = Date.now();
    await hostGameInstance.updateGameState('question_ended', currentQuestionIndex, 0, null, questionEndTime); // Notify players question ended

    // Optionally display correct answer or quick results here for host
    const question = currentQuizData.questions[currentQuestionIndex];
    if (question) {
        const answersContainer = document.getElementById('answers-container');
        // Temporarily highlight correct answer for host
        answersContainer.childNodes.forEach((button, index) => {
            if (question.answers[index].isCorrect) {
                button.classList.add('correct-answer-highlight');
            } else {
                button.classList.add('incorrect-answer-fade');
            }
        });
    }

    // Wait a moment before moving to the next question or results
    setTimeout(() => {
        if (question) { // Clean up highlights
            const answersContainer = document.getElementById('answers-container');
            answersContainer.childNodes.forEach((button) => {
                button.classList.remove('correct-answer-highlight', 'incorrect-answer-fade');
            });
        }
        nextQuestion();
    }, 3000); // 3-second pause after question ends
}

async function nextQuestion() {
    console.log('⏭️ HOST: Moving to next question...');
    currentQuestionIndex++;
    saveHostState('playing'); // Save state with updated index

    try {
        if (currentQuestionIndex < currentQuizData.questions.length) {
            // Display the new question
            displayCurrentQuestion();
        } else {
            // No more questions, show final results
            console.log('🏁 HOST: All questions complete. Showing final results.');
            await hostGameInstance.updateGameState('finished', currentQuestionIndex, 0, null, Date.now());
            endQuiz(); // This will call showResults internally
        }
    }
    catch (error) {
        console.error('💥 HOST: Error moving to next question:', error);
        showStatus('Error moving to next question', 'error');
    }
}

// Show results with proper cleanup
function showResults() {
    console.log('🏆 HOST: Showing final results');

    if (hostQuestionTimer) {
        clearInterval(hostQuestionTimer);
        hostQuestionTimer = null;
    }

    // Clear auto-cleanup timer
    if (gameAutoCleanupTimer) {
        clearTimeout(gameAutoCleanupTimer);
        gameAutoCleanupTimer = null;
    }

    hideElement('active-game');
    showElement('results-screen');

    displayFinalLeaderboard();
}

async function displayFinalLeaderboard() {
    const finalLeaderboardEl = document.getElementById('final-leaderboard');
    if (!finalLeaderboardEl) {
        console.error('Final leaderboard element not found!');
        return;
    }
    finalLeaderboardEl.innerHTML = '<li>Loading results...</li>';

    try {
        const playersSnapshot = await hostGameInstance.playersRef.orderByChild('score').once('value');
        const players = playersSnapshot.val() || {};
        const sortedPlayers = Object.values(players).sort((a, b) => b.score - a.score);

        finalLeaderboardEl.innerHTML = ''; // Clear loading message

        if (sortedPlayers.length === 0) {
            finalLeaderboardEl.innerHTML = '<li>No players participated or scored.</li>';
            return;
        }

        sortedPlayers.forEach((player, index) => {
            const li = document.createElement('li');
            li.classList.add('leaderboard-item');
            if (index === 0) li.classList.add('gold');
            else if (index === 1) li.classList.add('silver');
            else if (index === 2) li.classList.add('bronze');

            li.innerHTML = `
                <span class="rank">${index + 1}.</span>
                <span class="player-name">${player.name}</span>
                <span class="player-score">${player.score} points</span>
            `;
            finalLeaderboardEl.appendChild(li);
        });
    }
    catch (error) {
        console.error('💥 HOST: Error displaying final leaderboard:', error);
        finalLeaderboardEl.innerHTML = '<li>Error loading leaderboard.</li>';
        showStatus('Error displaying final leaderboard', 'error');
    }
}

// Reset the game entirely, ready for a new quiz selection
async function resetGame() {
    console.log('🔄 HOST: Resetting game...');
    if (hostGameInstance) {
        await hostGameInstance.deleteGameData(); // Fully remove from Firebase
    }
    clearHostSessionState(); // Clear host's local state
    hideAllScreens();
    showElement('welcome-screen');
    showStatus('Game has been reset. Ready for a new quiz!', 'success');
}

// ENHANCED: Custom quiz creation
function createCustomQuiz() {
    hideAllScreens();
    showElement('custom-quiz-creator');
    // Implement logic to build a custom quiz and then save it to 'quizzes' array
    // For simplicity, this example just shows the screen.
    // A real implementation would involve input fields and a 'save' button.
    showStatus('Create your own quiz!', 'info');
}

// ENHANCED: Show element helper
function hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'none';
}

function showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'block';
}

function hideAllScreens() {
    const screens = ['welcome-screen', 'lobby-screen', 'active-game', 'results-screen', 'custom-quiz-creator'];
    screens.forEach(id => hideElement(id));
}

function showStatus(message, type) {
    console.log(`📢 HOST (${type}):`, message);
    const statusEl = document.getElementById('status-message');
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

function generateGamePin() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    console.log('🧹 HOST: Page unloading - cleanup');
    if (hostQuestionTimer) clearInterval(hostQuestionTimer);
    // Consider if game should be automatically ended or cleaned from DB if host leaves abruptly
    // if (hostGameInstance && isHostGameActive) {
    //    database.ref(`games/${hostGamePin}`).update({'gameState/status': 'aborted_host_left'});
    // }
    if (hostGameInstance) hostGameInstance.cleanup(); // Clean up listeners
    // For a more robust solution on host abrupt leave, you might set a "host_left" flag
    // and have a cloud function or periodic check to clean up old games.
});

// Global function exposure
window.selectQuiz = selectQuiz;
window.startQuiz = startQuiz;
window.nextQuestion = nextQuestion;
window.showResults = showResults; // Not directly called in current flow but kept for legacy
window.endQuiz = endQuiz;
window.resetGame = resetGame;
window.createCustomQuiz = createCustomQuiz;

// Sample Quiz Data (can be loaded from a file or created dynamically)
const quizzes = [
    {
        name: "General Knowledge Quiz",
        questions: [
            {
                question: "What is the capital of France?",
                answers: [
                    { text: "Berlin", isCorrect: false },
                    { text: "Madrid", isCorrect: false },
                    { text: "Paris", isCorrect: true },
                    { text: "Rome", isCorrect: false }
                ],
                time: 15
            },
            {
                question: "Which planet is known as the Red Planet?",
                answers: [
                    { text: "Earth", isCorrect: false },
                    { text: "Mars", isCorrect: true },
                    { text: "Jupiter", isCorrect: false },
                    { text: "Venus", isCorrect: false }
                ],
                time: 15
            },
            {
                question: "What is 7 + 8?",
                answers: [
                    { text: "12", isCorrect: false },
                    { text: "13", isCorrect: false },
                    { text: "14", isCorrect: false },
                    { text: "15", isCorrect: true }
                ],
                time: 10
            }
        ]
    },
    {
        name: "Science Basics",
        questions: [
            {
                question: "What is the chemical symbol for water?",
                answers: [
                    { text: "O2", isCorrect: false },
                    { text: "H2O", isCorrect: true },
                    { text: "CO2", isCorrect: false },
                    { text: "NaCl", isCorrect: false }
                ],
                time: 15
            },
            {
                question: "What force keeps us on the ground?",
                answers: [
                    { text: "Magnetism", isCorrect: false },
                    { text: "Friction", isCorrect: false },
                    { text: "Gravity", isCorrect: true },
                    { text: "Tension", isCorrect: false }
                ],
                time: 15
            }
        ]
    }
];
window.quizzes = quizzes; // Expose for selection logic in HTML if needed

console.log('🎯 HOST: QuizMaster host.js loaded successfully');

// Auto-initialize if DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeHost);
} else {
    initializeHost();
}