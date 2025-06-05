// player.js

// ... (existing global variables and imports)

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
        return (Date.now() - this.questionStartTime);
    }
    markAnswered() {
        this.hasAnswered = true;
    }
    getHasAnswered() {
        return this.hasAnswered;
    }
}

const answerManager = new SimpleAnswerManager();

// Helper functions for showing/hiding elements
function showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'block';
}

function hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'none';
}

function showStatus(message, type = 'info') {
    console.log(`📢 PLAYER (${type}):`, message);
    const statusEl = document.getElementById('join-status'); // Assuming 'join-status' is used for general messages
    if (statusEl) {
        statusEl.innerHTML = `<p class="${type}">${message}</p>`; // Added class for styling
    }
}

// Function to display the waiting lobby
function displayPlayerLobby(gamePin, playerName, playerId, playerCount) {
    console.log('🎯 PLAYER: Displaying player lobby');
    hideElement('joining-game');
    showElement('waiting-lobby');
    document.getElementById('player-game-pin').textContent = gamePin;
    document.getElementById('player-name-display').textContent = playerName;
    document.getElementById('lobby-player-count').textContent = playerCount;
}

// Function to display an active question
function displayQuestion(questionData, questionNumber, totalQuestions) {
    console.log(`❓ PLAYER: Displaying question ${questionNumber}/${totalQuestions}`);
    hideElement('waiting-lobby');
    hideElement('results-screen');
    showElement('active-game');
    showElement('question-timer-container'); // Ensure timer is visible
    showElement('score-display-container'); // Ensure score is visible

    document.getElementById('question-number').textContent = `Question ${questionNumber}/${totalQuestions}`;
    document.getElementById('player-question-text').textContent = questionData.question;
    document.getElementById('player-current-score').textContent = playerScore;

    const answersContainer = document.getElementById('answers-container');
    answersContainer.innerHTML = ''; // Clear previous answers

    questionData.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'answer-btn';
        button.textContent = option;
        button.dataset.index = index;
        button.onclick = () => submitAnswer(index);
        answersContainer.appendChild(button);
    });

    // Reset answered state for new question
    hasAnswered = false;
    currentQuestionData = questionData;
    // Visually enable all answer buttons for the new question
    document.querySelectorAll('.answer-btn').forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('selected-answer', 'correct-answer', 'incorrect-answer');
    });

    answerManager.startQuestion(questionStartTime); // Reset timer for new question
    startQuestionTimer(questionData.timeLimit);
}

// Function to update the player count in the lobby dynamically
function updateLobbyPlayerCount(count) {
    const lobbyPlayerCountEl = document.getElementById('lobby-player-count');
    if (lobbyPlayerCountEl) {
        lobbyPlayerCountEl.textContent = count;
    }
}


// Start the question timer
function startQuestionTimer(timeLimit) {
    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
    }

    const timerDisplay = document.getElementById('question-timer');
    let timeLeft = timeLimit / 1000; // Convert to seconds

    timerDisplay.textContent = timeLeft;
    timerDisplay.style.color = 'white'; // Reset color

    currentTimerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = timeLeft;

        if (timeLeft <= 5) {
            timerDisplay.style.color = 'red';
        }

        if (timeLeft <= 0) {
            clearInterval(currentTimerInterval);
            timerDisplay.textContent = 'Time Up!';
            // Disable answers if time runs out and not already answered
            if (!hasAnswered) {
                document.querySelectorAll('.answer-btn').forEach(button => {
                    button.disabled = true;
                });
            }
        }
    }, 1000);
}


async function submitAnswer(selectedIndex) {
    if (hasAnswered || !isQuestionActive) { // Prevent re-answering or answering inactive questions
        console.warn('⚠️ PLAYER: Already answered or question not active.');
        return;
    }

    hasAnswered = true; // Mark as answered immediately
    answerManager.markAnswered(); // Update SimpleAnswerManager
    clearInterval(currentTimerInterval); // Stop the timer as soon as an answer is submitted

    const responseTime = answerManager.getResponseTime();
    console.log(`✅ PLAYER: Answer submitted: ${selectedIndex}, Response Time: ${responseTime}ms`);

    // Visually mark the selected answer
    document.querySelectorAll('.answer-btn').forEach((button, index) => {
        button.disabled = true; // Disable all buttons after an answer is submitted
        if (index === selectedIndex) {
            button.classList.add('selected-answer'); // Add a class for styling
        }
    });

    // Send answer to Firebase
    try {
        if (playerGameInstance && currentGamePin && playerGamePlayerId) {
            await playerGameInstance.submitAnswer(currentGamePin, playerGamePlayerId, selectedIndex, responseTime);
            showStatus('Answer submitted! Waiting for next question...', 'success');
        } else {
            console.error('💥 PLAYER: Cannot submit answer - missing game instance, pin or player ID.');
            showStatus('Error submitting answer.', 'error');
        }
    } catch (error) {
        console.error('💥 PLAYER: Error submitting answer:', error);
        showStatus('Error submitting answer.', 'error');
    }
}

// Initialize player - main function
async function initializePlayer() {
    console.log('🚀 PLAYER: Initializing player...');

    // Load state from localStorage
    currentGamePin = localStorage.getItem(PLAYER_STATE_KEYS.GAME_PIN);
    playerGamePlayerName = localStorage.getItem(PLAYER_STATE_KEYS.PLAYER_NAME);
    playerGamePlayerId = localStorage.getItem(PLAYER_STATE_KEYS.PLAYER_ID);
    playerScore = parseInt(localStorage.getItem(PLAYER_STATE_KEYS.CURRENT_SCORE) || '0', 10);

    // If no game PIN or player name, redirect to index
    if (!currentGamePin || !playerGamePlayerName) {
        console.warn('⚠️ PLAYER: Missing game PIN or player name, redirecting to index.html');
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('player-game-pin').textContent = currentGamePin;
    document.getElementById('player-name-display').textContent = playerGamePlayerName;
    document.getElementById('player-current-score').textContent = playerScore;


    // Initialize Firebase and GameInstance
    try {
        await initializeFirebase();
        playerGameInstance = new GameInstance(database);
        console.log('✅ PLAYER: Firebase and GameInstance initialized.');

        // CRITICAL FIX: Add listener for game state
        const gameRef = database.ref(`games/${currentGamePin}`);
        gameRef.on('value', async (snapshot) => {
            const gameData = snapshot.val();
            if (!gameData) {
                showStatus('Game not found or ended by host.', 'error');
                hideElement('active-game');
                hideElement('waiting-lobby');
                showElement('joining-game'); // Go back to joining state or show an error
                document.getElementById('join-status').innerHTML = '<p class="error">Game not found or ended.</p><button onclick="playAgain()">Play Again</button>';
                console.warn('⚠️ PLAYER: Game data not found for PIN:', currentGamePin);
                return;
            }

            const gameState = gameData.gameState;
            const players = gameData.players || {};
            const currentPlayer = players[playerGamePlayerId];

            console.log('📡 PLAYER: Game state updated:', gameState.status);

            // Update local score from Firebase if it exists
            if (currentPlayer && typeof currentPlayer.score === 'number') {
                previousScore = playerScore; // Store previous score
                playerScore = currentPlayer.score;
                document.getElementById('player-current-score').textContent = playerScore;

                // Show score change if current question data is available and score changed
                if (currentQuestionData && playerScore !== previousScore) {
                    const scoreChange = playerScore - previousScore;
                    showScoreChange(scoreChange);
                }
            }


            // Handle different game states
            switch (gameState.status) {
                case 'lobby':
                    console.log('🎯 PLAYER: Game is in lobby state.');
                    // Update player ID if not already set (e.g., first join)
                    if (!playerGamePlayerId) {
                        playerGamePlayerId = localStorage.getItem(PLAYER_STATE_KEYS.PLAYER_ID); // Re-fetch in case it was just set
                    }
                    if (playerGamePlayerId && !players[playerGamePlayerId]) {
                        console.warn('⚠️ PLAYER: Player not found in game players list, re-joining...');
                        await playerGameInstance.addPlayerToGame(currentGamePin, playerGamePlayerName, playerGamePlayerId);
                        showStatus('Re-joined game lobby. Waiting for host.', 'info');
                    } else if (!playerGamePlayerId) {
                        // This case should ideally be handled by index.html redirecting to player.html with player ID
                        // But as a fallback, create a new player ID if it doesn't exist
                        const newPlayerId = database.ref().child('games').child(currentGamePin).child('players').push().key;
                        playerGamePlayerId = newPlayerId;
                        localStorage.setItem(PLAYER_STATE_KEYS.PLAYER_ID, playerGamePlayerId);
                        await playerGameInstance.addPlayerToGame(currentGamePin, playerGamePlayerName, playerGamePlayerId);
                        showStatus('Joined game lobby. Waiting for host.', 'info');
                    } else {
                        showStatus('Joined game lobby. Waiting for host to start.', 'info');
                    }

                    // Display lobby
                    const playerCount = Object.keys(players).length;
                    displayPlayerLobby(currentGamePin, playerGamePlayerName, playerGamePlayerId, playerCount);
                    updateLobbyPlayerCount(playerCount); // Update player count dynamically

                    hideElement('question-timer-container'); // Hide timer in lobby
                    hideElement('score-display-container'); // Hide score in lobby
                    break;

                case 'active':
                    console.log('🏃 PLAYER: Game is active!');
                    const currentQuestionIndex = gameState.currentQuestionIndex;
                    const quizData = gameData.quizData; // Get quizData from gameData

                    if (quizData && quizData.questions && quizData.questions[currentQuestionIndex]) {
                        const questionData = quizData.questions[currentQuestionIndex];
                        const totalQuestions = quizData.questions.length;
                        displayQuestion(questionData, currentQuestionIndex + 1, totalQuestions);
                        isQuestionActive = true;
                        questionStartTime = gameState.questionStartTime; // Sync question start time
                    } else {
                        console.error('💥 PLAYER: Missing question data or quizData for active game state.');
                        showStatus('Error loading question data.', 'error');
                    }
                    break;

                case 'displaying_answers':
                    console.log('👀 PLAYER: Host is displaying answers.');
                    if (currentQuestionData) {
                        const correctAnswerIndex = currentQuestionData.correctAnswer;
                        const answerButtons = document.querySelectorAll('.answer-btn');
                        answerButtons.forEach((button, index) => {
                            button.disabled = true; // Disable all buttons
                            if (index === correctAnswerIndex) {
                                button.classList.add('correct-answer');
                            } else if (button.classList.contains('selected-answer')) {
                                button.classList.add('incorrect-answer');
                            }
                        });
                        showStatus('Host is revealing answers. Get ready for the next question!', 'info');
                    }
                    isQuestionActive = false;
                    clearInterval(currentTimerInterval);
                    break;

                case 'showing_leaderboard':
                    console.log('📊 PLAYER: Host is showing leaderboard.');
                    // Optionally display a temporary leaderboard state or message to the player
                    showStatus('Host is showing the leaderboard. Your current score: ' + playerScore, 'info');
                    hideElement('active-game');
                    hideElement('waiting-lobby');
                    hideElement('results-screen'); // Hide results screen if it was showing
                    showElement('joining-game'); // Revert to joining-game, perhaps show a specific "waiting for next round"
                    document.getElementById('join-status').innerHTML = `<p>Host is showing leaderboard. Get ready for next question!</p><p>Your score: ${playerScore}</p>`;
                    isQuestionActive = false;
                    clearInterval(currentTimerInterval);
                    break;

                case 'finished':
                    console.log('🏁 PLAYER: Game has finished!');
                    // Only show final results once to prevent multiple calls on state changes
                    if (!hasShownFinalResults) {
                        displayFinalResults(gameData.leaderboard || []); // Pass the leaderboard data
                        hasShownFinalResults = true; // Set the flag
                    }
                    isQuestionActive = false;
                    clearInterval(currentTimerInterval);
                    break;

                case 'aborted_host_left':
                    console.log('🛑 PLAYER: Game aborted - host left.');
                    showStatus('The host has ended the game unexpectedly. Game aborted.', 'error');
                    hideElement('active-game');
                    hideElement('waiting-lobby');
                    showElement('joining-game');
                    document.getElementById('join-status').innerHTML = '<p class="error">Game aborted: Host left.</p><button onclick="playAgain()">Play Again</button>';
                    isQuestionActive = false;
                    clearInterval(currentTimerInterval);
                    break;

                default:
                    console.warn('❓ PLAYER: Unknown game state:', gameState.status);
                    showStatus('Unknown game state. Please wait...', 'info');
            }
        });

    } catch (error) {
        console.error('💥 PLAYER: Initialization failed:', error);
        showStatus('Failed to connect to game. Please try again.', 'error');
        // Provide a way to retry or go back
        document.getElementById('join-status').innerHTML = `<p class="error">Failed to connect: ${error.message}</p><button onclick="playAgain()">Play Again</button>`;
    }
}


// Function to display final results
function displayFinalResults(leaderboard) {
    console.log('🏆 PLAYER: Displaying final results');
    hideElement('active-game');
    hideElement('waiting-lobby');
    showElement('results-screen');

    const finalScoreEl = document.getElementById('final-score');
    if (finalScoreEl) {
        finalScoreEl.textContent = `Your Final Score: ${playerScore}`;
    }

    const leaderboardList = document.getElementById('final-leaderboard-list');
    if (leaderboardList) {
        leaderboardList.innerHTML = ''; // Clear previous entries
        if (leaderboard && leaderboard.length > 0) {
            leaderboard.sort((a, b) => b.score - a.score); // Sort by score descending
            leaderboard.forEach((player, index) => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${index + 1}. ${player.name}</span> <span>${player.score}</span>`;
                leaderboardList.appendChild(li);
            });
        } else {
            leaderboardList.innerHTML = '<li>No final scores available.</li>';
        }
    }

    // Add confetti for winning (if applicable, based on your logic)
    const playerRank = leaderboard.findIndex(p => p.id === playerGamePlayerId);
    if (playerRank === 0) { // Assuming rank 0 is the winner
        injectConfettiCSS();
        document.getElementById('results-screen').classList.add('game-over-winner');
        const confettiContainer = document.createElement('div');
        confettiContainer.className = 'confetti';
        document.getElementById('results-screen').appendChild(confettiContainer);
    } else {
        document.getElementById('results-screen').classList.remove('game-over-winner');
        const existingConfetti = document.querySelector('.confetti');
        if (existingConfetti) existingConfetti.remove();
    }
}


function showScoreChange(scoreChange) {
    const scoreChangeEl = document.getElementById('score-change');
    if (scoreChangeEl) {
        scoreChangeEl.textContent = scoreChange >= 0 ? `+${scoreChange}` : `${scoreChange}`;
        scoreChangeEl.className = 'score-change-animation ' + (scoreChange >= 0 ? 'score-increase' : 'score-decrease');
        scoreChangeEl.style.display = 'block';

        // Remove the element after animation
        scoreChangeEl.addEventListener('animationend', () => {
            scoreChangeEl.style.display = 'none';
            scoreChangeEl.className = ''; // Clear classes
        }, {
            once: true
        });
    }
}

// Function to inject confetti CSS - ensure this is present
function injectConfettiCSS() {
    const styleId = 'confetti-style';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .confetti {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                pointer-events: none;
                overflow: hidden;
                z-index: 9999;
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
            .game-over-winner {
                background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%);
                border: 4px solid #ffffff;
                animation: gameOverPulse 2s ease-in-out infinite alternate;
            }
            @keyframes gameOverPulse {
                0% { box-shadow: 0 0 10px rgba(0, 255, 0, 0.5); }
                100% { box-shadow: 0 0 20px rgba(0, 255, 0, 0.9); }
            }
        `;
        document.head.appendChild(style);
    }
}


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
        showStatus('Quiz ended! All players have been notified.', 'success');

        // Start auto-cleanup for the host's game after a delay
        gameAutoCleanupTimer = setTimeout(async () => {
            console.log(`🧹 HOST: Auto-cleaning up game ${hostGamePin} after ${AUTO_CLEANUP_DELAY_MS / 1000} seconds.`);
            if (hostGameInstance) {
                await hostGameInstance.cleanupGame(hostGamePin);
                console.log(`✅ HOST: Game ${hostGamePin} cleaned up from database.`);
                showStatus('Game data cleaned up. You can start a new quiz.', 'info');
                // Optionally redirect or reset UI further for host
            }
        }, AUTO_CLEANUP_DELAY_MS);

    } catch (error) {
        console.error('💥 HOST: Error ending quiz:', error);
        showStatus('Error ending quiz.', 'error');
    }
}


// Cleanup on page unload for player
window.addEventListener('beforeunload', () => {
    console.log('🧹 PLAYER: Page unloading - cleanup');
    if (playerGameInstance && !hasShownFinalResults) { // Only cleanup if game wasn't formally finished
        // This is tricky; abrupt leave might corrupt host view or not clear player from game node.
        // For now, basic listener cleanup.
        // Consider if player should be removed from game's player list on abrupt leave
        // If the game state is 'active' or 'lobby', removing the player might be desirable
        // For now, just clear timer.
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
                startQuestionTimer(timeLeft); // Restart timer with remaining time
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
    Object.values(PLAYER_STATE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });
    localStorage.removeItem('gamePin'); // Used by index.html to pass info
    localStorage.removeItem('playerName'); // Used by index.html to pass info

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