// Main Quiz System JavaScript

// Sample quiz data - you can expand this or load from Firebase
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

// Game state management
class QuizGame {
    constructor(gamePin, isHost = false) {
        this.gamePin = gamePin;
        this.isHost = isHost;
        this.currentQuestion = 0;
        this.players = {};
        this.gameState = 'waiting'; // waiting, playing, finished
        this.timer = null;
        this.timeLeft = 0;
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
                    timeLeft: 0
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
                joinedAt: Date.now()
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
                currentQuestion: 0
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
            await getGameStateRef(this.gamePin).update({
                currentQuestion: nextQuestionIndex,
                timeLeft: 0
            });
            this.currentQuestion = nextQuestionIndex;
            return true;
        } catch (error) {
            console.error('Error moving to next question:', error);
            return false;
        }
    }

    async submitAnswer(playerId, answerIndex) {
        try {
            const playerRef = getPlayersRef(this.gamePin).child(playerId);
            await playerRef.update({
                currentAnswer: answerIndex,
                status: 'answered',
                answerTime: Date.now()
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

// Score calculation
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

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Add any initialization code here
    console.log('Quiz system initialized');
    
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