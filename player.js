// Player Page JavaScript - No Authentication Required
let playerGameInstance = null;
let playerId = null;
let playerName = null;
let currentGamePin = null;
let playerScore = 0;
let hasAnswered = false;
let questionStartTime = null;
let currentTimerInterval = null;

function initializePlayer() {
    console.log('Initializing player page...');
    
    // Get player info from localStorage
    currentGamePin = localStorage.getItem('gamePin');
    playerName = localStorage.getItem('playerName');
    
    if (!currentGamePin || !playerName) {
        showStatus('Invalid game information. Redirecting...', 'error');
        setTimeout(() => {
            location.href = 'index.html';
        }, 2000);
        return;
    }
    
    console.log('Player joining game:', currentGamePin, 'as', playerName);
    
    document.getElementById('player-game-pin').textContent = currentGamePin;
    document.getElementById('player-name-display').textContent = playerName;
    
    joinGame();
}

async function joinGame() {
    try {
        console.log('Creating game instance...');
        playerGameInstance = new QuizGame(currentGamePin, false);
        
        // Check if game exists
        console.log('Checking if game exists...');
        const gameExists = await checkGameExists();
        if (!gameExists) {
            showStatus('Game not found. Please check the PIN.', 'error');
            setTimeout(() => location.href = 'index.html', 3000);
            return;
        }
        
        console.log('Game exists, joining...');
        // Join the game with the original player name
        playerId = await playerGameInstance.joinGame(playerName);
        
        if (playerId) {
            console.log('Successfully joined game with player ID:', playerId);
            showStatus('Successfully joined the game!', 'success');
            
            // Hide joining screen and show lobby
            hideElement('joining-game');
            showElement('waiting-lobby');
            
            // Listen for game state changes
            playerGameInstance.listenToGameState(onGameStateChange);
            playerGameInstance.listenToPlayers(onPlayersUpdate);
            
        } else {
            console.error('Failed to get player ID');
            showStatus('Failed to join game. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error joining game:', error);
        showStatus('Connection error. Please check your internet connection.', 'error');
    }
}

async function checkGameExists() {
    return new Promise((resolve) => {
        getGameRef(currentGamePin).once('value', (snapshot) => {
            const exists = snapshot.exists();
            console.log('Game exists check result:', exists);
            resolve(exists);
        }, (error) => {
            console.error('Error checking game existence:', error);
            resolve(false);
        });
    });
}

function onGameStateChange(gameState) {
    console.log('Game state changed:', gameState);
    
    if (!gameState) {
        console.log('No game state received');
        return;
    }
    
    switch (gameState.status) {
        case 'waiting':
            console.log('Game status: waiting');
            showWaitingLobby();
            break;
        case 'playing':
            console.log('Game status: playing, question:', gameState.currentQuestion);
            // Reset answer state for new question
            hasAnswered = false;
            showActiveQuestion(gameState);
            break;
        case 'finished':
            console.log('Game status: finished');
            showFinalResults();
            break;
        default:
            console.log('Unknown game status:', gameState.status);
    }
}

function onPlayersUpdate(players) {
    console.log('Players updated:', Object.keys(players).length, 'players');
    
    const playerCount = Object.keys(players).length;
    
    // Update lobby player count
    const lobbyCountEl = document.getElementById('lobby-player-count');
    if (lobbyCountEl) {
        lobbyCountEl.textContent = playerCount;
    }
    
    // Update current player score
    if (players[playerId]) {
        playerScore = players[playerId].score || 0;
        console.log('Player score updated:', playerScore);
        updateScoreDisplay();
    }
    
    // Update leaderboards
    updateLeaderboards(players);
}

function showWaitingLobby() {
    console.log('Showing waiting lobby');
    hideAllScreens();
    showElement('waiting-lobby');
}

function showActiveQuestion(gameState) {
    console.log('Showing active question for question index:', gameState.currentQuestion);
    
    // Get current question from Firebase
    getGameRef(currentGamePin).once('value', (snapshot) => {
        const gameData = snapshot.val();
        if (gameData && gameData.quiz && gameData.quiz.questions) {
            const question = gameData.quiz.questions[gameState.currentQuestion];
            if (question) {
                console.log('Displaying question:', question.question);
                displayQuestion(question, gameState.currentQuestion + 1);
            } else {
                console.error('Question not found at index:', gameState.currentQuestion);
            }
        } else {
            console.error('Game data or questions not found');
        }
    }, (error) => {
        console.error('Error fetching question:', error);
    });
}

function displayQuestion(question, questionNumber) {
    console.log('Displaying question', questionNumber, ':', question.question);
    
    hideAllScreens();
    showElement('active-question');
    
    // Clear any existing timer
    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
        currentTimerInterval = null;
    }
    
    document.getElementById('question-num').textContent = questionNumber;
    document.getElementById('question-text').textContent = question.question;
    
    // Create answer buttons
    const answersGrid = document.getElementById('answers-grid');
    answersGrid.innerHTML = '';
    hasAnswered = false;
    questionStartTime = Date.now();
    
    question.answers.forEach((answer, index) => {
        const answerBtn = document.createElement('button');
        answerBtn.className = 'answer-btn';
        answerBtn.textContent = answer;
        answerBtn.onclick = () => selectAnswer(index);
        answersGrid.appendChild(answerBtn);
    });
    
    // Start timer
    startQuestionTimer(question.timeLimit || 20);
    hideElement('answer-feedback');
}

function startQuestionTimer(duration) {
    const timerDisplay = document.getElementById('question-timer');
    let timeLeft = duration;
    
    const updateTimer = () => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(currentTimerInterval);
            currentTimerInterval = null;
            onQuestionTimeout();
        } else {
            timeLeft--;
        }
    };
    
    updateTimer();
    currentTimerInterval = setInterval(updateTimer, 1000);
}

async function selectAnswer(answerIndex) {
    if (hasAnswered) return;
    
    console.log('Player selected answer:', answerIndex);
    hasAnswered = true;
    const answerTime = Date.now();
    
    // Clear timer
    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
        currentTimerInterval = null;
    }
    
    // Disable all answer buttons
    const answerButtons = document.querySelectorAll('.answer-btn');
    answerButtons.forEach((btn, index) => {
        btn.disabled = true;
        if (index === answerIndex) {
            btn.style.transform = 'scale(1.05)';
            btn.style.opacity = '0.8';
        }
    });
    
    // Submit answer to Firebase
    const success = await playerGameInstance.submitAnswer(playerId, answerIndex);
    if (success) {
        console.log('Answer submitted successfully');
        showAnswerFeedback('Answer submitted!');
        setTimeout(() => {
            showWaitingForNext();
        }, 1500);
    } else {
        console.error('Failed to submit answer');
        showStatus('Failed to submit answer', 'error');
        hasAnswered = false; // Allow retry
        answerButtons.forEach(btn => {
            btn.disabled = false;
            btn.style.transform = '';
            btn.style.opacity = '';
        });
    }
}

function onQuestionTimeout() {
    console.log('Question timeout reached');
    if (!hasAnswered) {
        hasAnswered = true;
        showAnswerFeedback('Time\'s up!');
        setTimeout(() => {
            showWaitingForNext();
        }, 1500);
    }
}

function showAnswerFeedback(message) {
    const feedbackEl = document.getElementById('answer-feedback');
    const messageEl = document.getElementById('feedback-message');
    messageEl.textContent = message;
    showElement('answer-feedback');
}

function showWaitingForNext() {
    console.log('Showing waiting for next question screen');
    hideAllScreens();
    showElement('waiting-next');
    updateScoreDisplay();
    
    // The player will automatically move to the next question when the host advances
    // This is handled by the onGameStateChange listener
}

function updateScoreDisplay() {
    const scoreEl = document.getElementById('current-score');
    if (scoreEl) {
        scoreEl.textContent = playerScore;
    }
    
    const finalScoreEl = document.getElementById('player-final-score');
    if (finalScoreEl) {
        finalScoreEl.textContent = `${playerScore} points`;
    }
}

function updateLeaderboards(players) {
    const sortedPlayers = Object.values(players).sort((a, b) => (b.score || 0) - (a.score || 0));
    
    // Update current leaderboard
    updateLeaderboard('current-leaderboard', sortedPlayers.slice(0, 5));
    
    // Update final leaderboard
    updateLeaderboard('final-leaderboard-player', sortedPlayers);
    
    // Update player rank
    const playerRank = sortedPlayers.findIndex(p => p.id === playerId) + 1;
    const rankEl = document.getElementById('player-final-rank');
    if (rankEl) {
        rankEl.textContent = `#${playerRank} of ${sortedPlayers.length}`;
    }
}

function updateLeaderboard(elementId, players) {
    const leaderboard = document.getElementById(elementId);
    if (!leaderboard) return;
    
    leaderboard.innerHTML = '<h3>🏆 Leaderboard</h3>';
    
    players.forEach((player, index) => {
        const playerScore = document.createElement('div');
        playerScore.className = `player-score ${index < 3 ? `rank-${index + 1}` : ''}`;
        
        // Highlight current player
        if (player.id === playerId) {
            playerScore.style.backgroundColor = '#e3f2fd';
            playerScore.style.fontWeight = 'bold';
        }
        
        playerScore.innerHTML = `
            <span class="player-name">#${index + 1} ${player.name}</span>
            <span class="player-points">${player.score || 0} points</span>
        `;
        leaderboard.appendChild(playerScore);
    });
}

function showFinalResults() {
    console.log('Showing final results');
    
    // Clear any existing timer
    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
        currentTimerInterval = null;
    }
    
    hideAllScreens();
    showElement('final-results');
    updateScoreDisplay();
}

function hideAllScreens() {
    const screens = [
        'joining-game', 
        'waiting-lobby', 
        'active-question', 
        'waiting-next', 
        'final-results'
    ];
    screens.forEach(hideElement);
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
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`;
        setTimeout(() => {
            statusEl.textContent = '';
            statusEl.className = 'status-message';
        }, 3000);
    }
}

// Result messages based on performance
function getResultMessage(score, totalPlayers, rank) {
    if (rank === 1) {
        return "🏆 Excellent! You're #1!";
    } else if (rank <= 3) {
        return "🥉 Great job! Top 3!";
    } else if (rank <= totalPlayers / 2) {
        return "👍 Good work!";
    } else {
        return "👏 Thanks for playing!";
    }
}

// Cleanup when leaving the page
window.addEventListener('beforeunload', () => {
    console.log('Player page unloading, cleaning up...');
    
    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
    }
    
    if (playerGameInstance) {
        playerGameInstance.cleanup();
    }
    
    // Clear localStorage
    localStorage.removeItem('gamePin');
    localStorage.removeItem('playerName');
});

// Auto-initialize when page loads
document.addEventListener('DOMContentLoaded', initializePlayer);