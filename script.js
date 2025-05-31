// Enhanced Quiz System JavaScript with Time-Based Scoring

// Sample quiz data
const sampleQuizzes = [
    {
        id: 'sample1',
        title: 'General Knowledge Quiz',
        questions: [
            {
                question: "What is the capital of France?",
                answers: ["London", "Berlin", "Paris", "Madrid"],
                correct: 2,
                timeLimit: 20
            },
            {
                question: "Which planet is known as the Red Planet?",
                answers: ["Venus", "Mars", "Jupiter", "Saturn"],
                correct: 1,
                timeLimit: 20
            },
            {
                question: "What is 2 + 2?",
                answers: ["3", "4", "5", "6"],
                correct: 1,
                timeLimit: 15
            },
            {
                question: "Who painted the Mona Lisa?",
                answers: ["Van Gogh", "Picasso", "Da Vinci", "Monet"],
                correct: 2,
                timeLimit: 25
            }
        ]
    }
];

// Enhanced Scoring System
class ScoringSystem {
    constructor() {
        this.baseScore = 1000;
        this.speedBonusMultiplier = 0.5; // 50% of base score as max speed bonus
        this.correctAnswerBonus = 100;
    }

    calculateScore(isCorrect, responseTime, questionTimeLimit, questionDifficulty = 1) {
        if (!isCorrect) {
            return 0;
        }

        // Base score for correct answer
        let score = this.baseScore * questionDifficulty;

        // Speed bonus calculation
        const timePercentage = Math.max(0, (questionTimeLimit - responseTime) / questionTimeLimit);
        const speedBonus = Math.floor(this.baseScore * this.speedBonusMultiplier * timePercentage);

        // Correct answer bonus
        const correctBonus = this.correctAnswerBonus * questionDifficulty;

        // Total score
        const totalScore = score + speedBonus + correctBonus;

        return Math.max(0, Math.floor(totalScore));
    }

    getScoreBreakdown(isCorrect, responseTime, questionTimeLimit, questionDifficulty = 1) {
        if (!isCorrect) {
            return {
                totalScore: 0,
                baseScore: 0,
                speedBonus: 0,
                correctBonus: 0,
                message: "Incorrect answer"
            };
        }

        const baseScore = this.baseScore * questionDifficulty;
        const timePercentage = Math.max(0, (questionTimeLimit - responseTime) / questionTimeLimit);
        const speedBonus = Math.floor(this.baseScore * this.speedBonusMultiplier * timePercentage);
        const correctBonus = this.correctAnswerBonus * questionDifficulty;
        const totalScore = baseScore + speedBonus + correctBonus;

        return {
            totalScore: Math.floor(totalScore),
            baseScore: baseScore,
            speedBonus: speedBonus,
            correctBonus: correctBonus,
            responseTime: responseTime,
            timePercentage: Math.round(timePercentage * 100),
            message: this.getPerformanceMessage(timePercentage)
        };
    }

    getPerformanceMessage(timePercentage) {
        if (timePercentage >= 0.8) return "Lightning fast! ⚡";
        if (timePercentage >= 0.6) return "Quick thinking! 🚀";
        if (timePercentage >= 0.4) return "Good timing! 👍";
        if (timePercentage >= 0.2) return "Made it in time! ⏰";
        return "Just in time! 😅";
    }
}

// Player Answer Manager for time tracking
class PlayerAnswerManager {
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

// Enhanced Game state management
class QuizGame {
    constructor(gamePin, isHost = false) {
        this.gamePin = gamePin;
        this.isHost = isHost;
        this.currentQuestion = 0;
        this.players = {};
        this.gameState = 'waiting'; // waiting, playing, finished
        this.timer = null;
        this.timeLeft = 0;
        this.questionStartTime = null;
    }

    async createGame(quiz) {
        if (!this.isHost) return false;
        
        try {
            const gameData = {
                gamePin: this.gamePin,
                quiz: quiz,
                gameState: {
                    status: 'waiting',
                    currentQuestion: 0,
                    timeLeft: 0,
                    questionStartTime: null
                },
                players: {},
                createdAt: Date.now(),
                hostId: generatePlayerId()
            };

            await getGameRef(this.gamePin).set(gameData);
            return true;
        } catch (error) {
            console.error('Error creating game:', error);
            return false;
        }
    }

    async joinGame(playerName) {
        try {
            const playerId = generatePlayerId();
            const playerData = {
                id: playerId,
                name: playerName,
                score: 0,
                status: 'waiting',
                joinedAt: Date.now(),
                currentAnswer: null,
                responseTime: null,
                questionScore: null,
                isCorrect: null
            };

            await getPlayersRef(this.gamePin).child(playerId).set(playerData);
            return playerId;
        } catch (error) {
            console.error('Error joining game:', error);
            return null;
        }
    }

    async startGame() {
        if (!this.isHost) return false;
        
        try {
            await getGameStateRef(this.gamePin).update({
                status: 'playing',
                currentQuestion: 0,
                questionStartTime: Date.now()
            });
            return true;
        } catch (error) {
            console.error('Error starting game:', error);
            return false;
        }
    }

    async nextQuestion() {
        if (!this.isHost) return false;
        
        try {
            const nextQuestionIndex = this.currentQuestion + 1;
            const startTime = Date.now();
            
            await getGameStateRef(this.gamePin).update({
                currentQuestion: nextQuestionIndex,
                timeLeft: 0,
                questionStartTime: startTime,
                status: 'playing'
            });
            
            this.currentQuestion = nextQuestionIndex;
            this.questionStartTime = startTime;
            return true;
        } catch (error) {
            console.error('Error moving to next question:', error);
            return false;
        }
    }

    async submitAnswer(playerId, answerIndex) {
        try {
            const playerRef = getPlayersRef(this.gamePin).child(playerId);
            const submitTime = Date.now();
            const responseTime = this.questionStartTime ? 
                (submitTime - this.questionStartTime) / 1000 : 0;

            await playerRef.update({
                currentAnswer: answerIndex,
                responseTime: responseTime,
                status: 'answered',
                answerTime: submitTime
            });
            return true;
        } catch (error) {
            console.error('Error submitting answer:', error);
            return false;
        }
    }

    async endGame() {
        if (!this.isHost) return false;
        
        try {
            await getGameStateRef(this.gamePin).update({
                status: 'finished'
            });
            return true;
        } catch (error) {
            console.error('Error ending game:', error);
            return false;
        }
    }

    // Real-time listeners
    listenToGameState(callback) {
        getGameStateRef(this.gamePin).on('value', (snapshot) => {
            const gameState = snapshot.val();
            if (gameState) {
                // Update local question start time
                if (gameState.questionStartTime) {
                    this.questionStartTime = gameState.questionStartTime;
                }
                callback(gameState);
            }
        });
    }

    listenToPlayers(callback) {
        getPlayersRef(this.gamePin).on('value', (snapshot) => {
            const players = snapshot.val() || {};
            callback(players);
        });
    }

    listenToGame(callback) {
        getGameRef(this.gamePin).on('value', (snapshot) => {
            const gameData = snapshot.val();
            if (gameData) {
                callback(gameData);
            }
        });
    }

    // Clean up listeners
    cleanup() {
        if (this.gamePin) {
            getGameRef(this.gamePin).off();
            getPlayersRef(this.gamePin).off();
            getGameStateRef(this.gamePin).off();
        }
        if (this.timer) {
            clearInterval(this.timer);
        }
    }
}

// Timer functions
function startTimer(duration, display, onComplete) {
    let timer = duration;
    const interval = setInterval(() => {
        const minutes = parseInt(timer / 60, 10);
        const seconds = parseInt(timer % 60, 10);
        
        const displayMinutes = minutes < 10 ? "0" + minutes : minutes;
        const displaySeconds = seconds < 10 ? "0" + seconds : seconds;
        
        if (display) {
            display.textContent = displayMinutes + ":" + displaySeconds;
        }
        
        if (--timer < 0) {
            clearInterval(interval);
            if (onComplete) onComplete();
        }
    }, 1000);
    
    return interval;
}

// Enhanced score calculation (kept for backward compatibility)
function calculateScore(isCorrect, timeLeft, maxTime) {
    if (!isCorrect) return 0;
    
    const baseScore = 1000;
    const timeBonus = Math.floor((timeLeft / maxTime) * 500);
    return baseScore + timeBonus;
}

// Utility functions for UI
function showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'block';
}

function hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'none';
}

function updateElement(elementId, content) {
    const element = document.getElementById(elementId);
    if (element) element.textContent = content;
}

function setElementHTML(elementId, html) {
    const element = document.getElementById(elementId);
    if (element) element.innerHTML = html;
}

// Sound effects (optional - you can add audio files to your project)
function playSound(soundName) {
    // Uncomment and modify if you add sound files
    // const audio = new Audio(`sounds/${soundName}.mp3`);
    // audio.play().catch(e => console.log('Audio play failed:', e));
}

// Local storage helpers
function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

function getFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Error reading from localStorage:', error);
        return null;
    }
}

// Enhanced response time tracking utilities
function formatTime(seconds) {
    if (seconds < 60) {
        return `${seconds.toFixed(1)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
}

function getSpeedRating(responseTime, timeLimit) {
    const percentage = (timeLimit - responseTime) / timeLimit;
    if (percentage >= 0.8) return { rating: 'Lightning', emoji: '⚡', color: '#ffd700' };
    if (percentage >= 0.6) return { rating: 'Fast', emoji: '🚀', color: '#4caf50' };
    if (percentage >= 0.4) return { rating: 'Good', emoji: '👍', color: '#2196f3' };
    if (percentage >= 0.2) return { rating: 'OK', emoji: '⏰', color: '#ff9800' };
    return { rating: 'Slow', emoji: '😅', color: '#f44336' };
}

// Response statistics calculation
function calculateResponseStats(players) {
    const responseTimes = [];
    let answeredCount = 0;
    let correctCount = 0;
    
    Object.values(players).forEach(player => {
        if (player.status === 'answered' && player.responseTime !== null) {
            responseTimes.push(player.responseTime);
            answeredCount++;
            if (player.isCorrect) {
                correctCount++;
            }
        }
    });
    
    const stats = {
        totalPlayers: Object.keys(players).length,
        answeredCount: answeredCount,
        correctCount: correctCount,
        accuracy: answeredCount > 0 ? (correctCount / answeredCount * 100).toFixed(1) : 0,
        avgResponseTime: 0,
        fastestTime: null,
        slowestTime: null
    };
    
    if (responseTimes.length > 0) {
        stats.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        stats.fastestTime = Math.min(...responseTimes);
        stats.slowestTime = Math.max(...responseTimes);
    }
    
    return stats;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Add any initialization code here
    console.log('Enhanced Quiz system initialized with time-based scoring');
    
    // Make classes globally available
    window.ScoringSystem = ScoringSystem;
    window.PlayerAnswerManager = PlayerAnswerManager;
    window.QuizGame = QuizGame;
    
    // Check if we're on a specific page and initialize accordingly
    const path = window.location.pathname;
    const page = path.substring(path.lastIndexOf('/') + 1);
    
    switch(page) {
        case 'host.html':
            if (typeof initializeHost === 'function') {
                initializeHost();
            }
            break;
        case 'player.html':
            if (typeof initializePlayer === 'function') {
                initializePlayer();
            }
            break;
        case 'manage.html':
            if (typeof initializeManage === 'function') {
                initializeManage();
            }
            break;
    }
});

// Export for Node.js environments (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ScoringSystem,
        PlayerAnswerManager,
        QuizGame,
        sampleQuizzes,
        calculateScore,
        formatTime,
        getSpeedRating,
        calculateResponseStats
    };
}