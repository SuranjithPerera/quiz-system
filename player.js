// Enhanced Player Page JavaScript with Time-Based Scoring
let playerGameInstance = null;
let playerId = null;
let playerName = null;
let currentGamePin = null;
let playerScore = 0;
let hasAnswered = false;
let questionStartTime = null;
let currentTimerInterval = null;
let currentQuestionData = null;
let playerAnswerManager = null;

function initializePlayer() {
    console.log('Initializing player page...');
    
    // Initialize answer manager
    playerAnswerManager = new PlayerAnswerManager();
    
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
            playerAnswerManager.startQuestion(gameState.questionStartTime);
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
    
    // Update current player score and score breakdown
    if (players[playerId]) {
        const playerData = players[playerId];
        playerScore = playerData.score || 0;
        console.log('Player score updated:', playerScore);
        
        // Show score breakdown if available
        if (playerData.scoreBreakdown && playerData.questionScore !== undefined) {
            showScoreBreakdown(playerData.scoreBreakdown, playerData.questionScore);
        }
        
        updateScoreDisplay();
    }
    
    // Update leaderboards
    updateLeaderboards(players);
}

function showScoreBreakdown(breakdown, questionScore) {
    // Create or update score breakdown display
    let breakdownEl = document.getElementById('score-breakdown');
    if (!breakdownEl) {
        breakdownEl = document.createElement('div');
        breakdownEl.id = 'score-breakdown';
        breakdownEl.style.cssText = `
            background: rgba(255, 255, 255, 0.95);
            color: #333;
            padding: 15px;
            border-radius: 10px;
            margin: 15px 0;
            border-left: 4px solid #4caf50;
            font-size: 14px;
        `;
        
        // Add to the waiting-next screen
        const waitingNext = document.getElementById('waiting-next');
        const scoreInfo = waitingNext.querySelector('#score-info');
        if (scoreInfo) {
            scoreInfo.appendChild(breakdownEl);
        }
    }
    
    breakdownEl.innerHTML = `
        <h4 style="margin: 0 0 10px 0; color: #4caf50;">Question Score: +${questionScore} points</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px;">
            <div>Base Score: ${breakdown.baseScore}</div>
            <div>Speed Bonus: +${breakdown.speedBonus}</div>
            <div>Correct Bonus: +${breakdown.correctBonus}</div>
            <div>Response Time: ${breakdown.responseTime?.toFixed(1)}s</div>
        </div>
        <div style="margin-top: 10px; font-weight: bold; color: #667eea;">
            ${breakdown.message}
        </div>
    `;
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
                currentQuestionData = {
                    ...question,
                    questionIndex: gameState.currentQuestion,
                    startTime: gameState.questionStartTime || Date.now()
                };
                displayQuestion(question, gameState.currentQuestion + 1, gameState.questionStartTime);
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

function displayQuestion(question, questionNumber, startTime) {
    console.log('Displaying question', questionNumber, ':', question.question);
    
    hideAllScreens();
    showElement('active-question');
    
    // Clear any existing timer
    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
        currentTimerInterval = null;
    }
    
    // Set question start time
    questionStartTime = startTime || Date.now();
    playerAnswerManager.startQuestion(questionStartTime);
    
    document.getElementById('question-num').textContent = questionNumber;
    document.getElementById('question-text').textContent = question.question;
    
    // Create answer buttons
    const answersGrid = document.getElementById('answers-grid');
    answersGrid.innerHTML = '';
    hasAnswered = false;
    
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
    if (hasAnswered || !playerAnswerManager.canAnswer()) return;
    
    console.log('Player selected answer:', answerIndex);
    hasAnswered = true;
    playerAnswerManager.markAnswered();
    
    const responseTime = playerAnswerManager.getResponseTime();
    
    // Clear timer
    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
        currentTimerInterval = null;
    }
    
    // Disable all answer buttons and highlight selected
    const answerButtons = document.querySelectorAll('.answer-btn');
    answerButtons.forEach((btn, index) => {
        btn.disabled = true;
        if (index === answerIndex) {
            btn.style.transform = 'scale(1.05)';
            btn.style.opacity = '0.8';
            btn.style.border = '3px solid #fff';
        }
    });
    
    // Submit answer with time tracking to Firebase
    const success = await submitAnswerWithTime(answerIndex, responseTime);
    if (success) {
        console.log('Answer submitted successfully with response time:', responseTime);
        showAnswerFeedback(`Answer submitted! (${responseTime.toFixed(1)}s)`);
        setTimeout(() => {
            showWaitingForNext();
        }, 1500);
    } else {
        console.error('Failed to submit answer');
        showStatus('Failed to submit answer', 'error');
        hasAnswered = false;
        playerAnswerManager = new PlayerAnswerManager(); // Reset
        answerButtons.forEach(btn => {
            btn.disabled = false;
            btn.style.transform = '';
            btn.style.opacity = '';
            btn.style.border = '';
        });
    }
}

async function submitAnswerWithTime(answerIndex, responseTime) {
    try {
        const playerRef = getPlayersRef(currentGamePin).child(playerId);
        
        const answerData = {
            currentAnswer: answerIndex,
            responseTime: responseTime,
            status: 'answered',
            answerTime: Date.now()
        };
        
        await playerRef.update(answerData);
        return true;
        
    } catch (error) {
        console.error('Error submitting answer with time:', error);
        return false;
    }
}

function onQuestionTimeout() {
    console.log('Question timeout reached');
    if (!hasAnswered && playerAnswerManager.canAnswer()) {
        hasAnswered = true;
        playerAnswerManager.markAnswered();
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
    
    // Clear any existing score breakdown
    const existingBreakdown = document.getElementById('score-breakdown');
    if (existingBreakdown) {
        existingBreakdown.remove();
    }
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
    
    // Update result message based on performance
    const resultMessageEl = document.getElementById('result-message');
    if (resultMessageEl && playerRank) {
        resultMessageEl.textContent = getResultMessage(playerScore, sortedPlayers.length, playerRank);
    }
}

function updateLeaderboard(elementId, players) {
    const leaderboard = document.getElementById(elementId);
    if (!leaderboard) return;
    
    leaderboard.innerHTML = '<h3>🏆 Leaderboard</h3>';
    
    players.forEach((player, index) => {
        const playerScoreDiv = document.createElement('div');
        playerScoreDiv.className = `player-score ${index < 3 ? `rank-${index + 1}` : ''}`;
        
        // Highlight current player
        if (player.id === playerId) {
            playerScoreDiv.style.backgroundColor = '#e3f2fd';
            playerScoreDiv.style.fontWeight = 'bold';
            playerScoreDiv.style.border = '2px solid #2196f3';
        }
        
        playerScoreDiv.innerHTML = `
            <span class="player-name">#${index + 1} ${player.name} ${player.id === playerId ? '(You)' : ''}</span>
            <span class="player-points">${player.score || 0} points</span>
        `;
        leaderboard.appendChild(playerScoreDiv);
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
        return "🏆 Outstanding! You're the Champion!";
    } else if (rank <= 3) {
        return "🥉 Excellent! You made the podium!";
    } else if (rank <= Math.ceil(totalPlayers / 2)) {
        return "👍 Great job! Above average performance!";
    } else {
        return "👏 Thanks for playing! Keep practicing!";
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