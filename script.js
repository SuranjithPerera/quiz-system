// Enhanced Quiz System JavaScript with Time-Based Scoring - CLEAN VERSION

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
        this.speedBonusMultiplier = 0.5;
        this.correctAnswerBonus = 100;
    }

    calculateScore(isCorrect, responseTime, questionTimeLimit, questionDifficulty = 1) {
        if (!isCorrect) return 0;

        let score = this.baseScore * questionDifficulty;
        const timePercentage = Math.max(0, (questionTimeLimit - responseTime) / questionTimeLimit);
        const speedBonus = Math.floor(this.baseScore * this.speedBonusMultiplier * timePercentage);
        const correctBonus = this.correctAnswerBonus * questionDifficulty;
        const totalScore = score + speedBonus + correctBonus;

        return Math.max(0, Math.floor(totalScore));
    }
}

// Player Answer Manager
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
        this.gameState = 'waiting';
        this.timer = null;
        this.timeLeft = 0;
        this.questionStartTime = null;
    }

    async createGame(quiz) {
        if (!this.isHost) {
            console.error('Only host can create game');
            return false;
        }
        
        try {
            const db = await this.waitForDatabase();
            if (!db) throw new Error('Database not available');
            
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
                hostId: this.generatePlayerId()
            };

            const gameRef = db.ref(`games/${this.gamePin}`);
            await gameRef.set(gameData);
            return true;
        } catch (error) {
            console.error('Error creating game:', error);
            return false;
        }
    }

    async joinGame(playerName) {
        try {
            const db = await this.waitForDatabase();
            if (!db) throw new Error('Database not available');
            
            const playerId = this.generatePlayerId();
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

            const playerRef = db.ref(`games/${this.gamePin}/players/${playerId}`);
            await playerRef.set(playerData);
            return playerId;
        } catch (error) {
            console.error('Error joining game:', error);
            return null;
        }
    }

    async startGame() {
        if (!this.isHost) return false;
        
        try {
            const db = await this.waitForDatabase();
            if (!db) throw new Error('Database not available');
            
            const gameStateRef = db.ref(`games/${this.gamePin}/gameState`);
            await gameStateRef.update({
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
            
            const db = await this.waitForDatabase();
            if (!db) throw new Error('Database not available');
            
            const gameStateRef = db.ref(`games/${this.gamePin}/gameState`);
            await gameStateRef.update({
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

    async endGame() {
        if (!this.isHost) return false;
        
        try {
            const db = await this.waitForDatabase();
            if (!db) throw new Error('Database not available');
            
            const gameStateRef = db.ref(`games/${this.gamePin}/gameState`);
            await gameStateRef.update({
                status: 'finished'
            });
            return true;
        } catch (error) {
            console.error('Error ending game:', error);
            return false;
        }
    }

    async waitForDatabase() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 20;
            
            const checkDatabase = () => {
                attempts++;
                
                if (window.database && typeof window.database.ref === 'function') {
                    resolve(window.database);
                } else if (attempts >= maxAttempts) {
                    resolve(null);
                } else {
                    setTimeout(checkDatabase, 200);
                }
            };
            
            checkDatabase();
        });
    }

    generatePlayerId() {
        return Date.now().toString() + Math.floor(Math.random() * 1000).toString();
    }

    listenToGameState(callback) {
        this.waitForDatabase().then(db => {
            if (!db) return;
            
            const gameStateRef = db.ref(`games/${this.gamePin}/gameState`);
            gameStateRef.on('value', (snapshot) => {
                const gameState = snapshot.val();
                if (gameState) {
                    if (gameState.questionStartTime) {
                        this.questionStartTime = gameState.questionStartTime;
                    }
                    callback(gameState);
                }
            });
        });
    }

    listenToPlayers(callback) {
        this.waitForDatabase().then(db => {
            if (!db) return;
            
            const playersRef = db.ref(`games/${this.gamePin}/players`);
            playersRef.on('value', (snapshot) => {
                const players = snapshot.val() || {};
                callback(players);
            });
        });
    }

    cleanup() {
        this.waitForDatabase().then(db => {
            if (this.gamePin && db) {
                db.ref(`games/${this.gamePin}`).off();
                db.ref(`games/${this.gamePin}/players`).off();
                db.ref(`games/${this.gamePin}/gameState`).off();
            }
        });
        
        if (this.timer) {
            clearInterval(this.timer);
        }
    }
}

// Utility functions
function generateGamePin() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function generatePlayerId() {
    return Date.now().toString() + Math.floor(Math.random() * 1000).toString();
}

function calculateScore(isCorrect, timeLeft, maxTime) {
    if (!isCorrect) return 0;
    const baseScore = 1000;
    const timeBonus = Math.floor((timeLeft / maxTime) * 500);
    return baseScore + timeBonus;
}

function showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'block';
}

function hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'none';
}

// Wait for Firebase
function waitForFirebase(callback, maxRetries = 30) {
    let retries = 0;
    const checkFirebase = () => {
        retries++;
        
        const databaseReady = window.database && typeof window.database.ref === 'function';
        const authReady = window.auth && typeof window.auth.onAuthStateChanged === 'function';
        
        if (databaseReady || retries >= maxRetries) {
            callback();
        } else {
            setTimeout(checkFirebase, 200);
        }
    };
    checkFirebase();
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 SCRIPT: Enhanced Quiz system initializing...');
    
    waitForFirebase(() => {
        console.log('✅ SCRIPT: Quiz system ready');
        
        // Make classes globally available
        window.ScoringSystem = ScoringSystem;
        window.PlayerAnswerManager = PlayerAnswerManager;
        window.QuizGame = QuizGame;
        
        console.log('📄 SCRIPT: All classes loaded successfully');
    });
});

console.log('📜 SCRIPT: Enhanced script.js loaded successfully');