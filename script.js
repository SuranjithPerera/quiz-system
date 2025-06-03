// Enhanced Quiz System JavaScript - Kokoot! V11 - Fixed Scoring System

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
    },
    {
        id: 'sample2',
        title: 'Science Quiz',
        questions: [
            {
                question: "What is the chemical symbol for water?",
                answers: ["H2O", "CO2", "NaCl", "O2"],
                correct: 0,
                timeLimit: 15
            },
            {
                question: "How many bones are in the human body?",
                answers: ["106", "206", "306", "406"],
                correct: 1,
                timeLimit: 25
            },
            {
                question: "What gas do plants absorb from the atmosphere?",
                answers: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"],
                correct: 2,
                timeLimit: 20
            }
        ]
    }
];

// FIXED: Enhanced Scoring System with proper calculations
class ScoringSystem {
    constructor() {
        this.baseScore = 1000;
        this.speedBonusMultiplier = 0.5;
        this.correctAnswerBonus = 100;
    }

    calculateScore(isCorrect, responseTime, questionTimeLimit, questionDifficulty = 1) {
        console.log('🏆 SCORING: Calculating score:', {
            isCorrect,
            responseTime,
            questionTimeLimit,
            questionDifficulty
        });

        if (!isCorrect) {
            console.log('❌ SCORING: Incorrect answer, score = 0');
            return 0;
        }

        // Base score for correct answer
        let score = this.baseScore * questionDifficulty;
        
        // Time bonus calculation (faster response = higher bonus)
        const timePercentage = Math.max(0, (questionTimeLimit - responseTime) / questionTimeLimit);
        const speedBonus = Math.floor(this.baseScore * this.speedBonusMultiplier * timePercentage);
        
        // Correct answer bonus
        const correctBonus = this.correctAnswerBonus * questionDifficulty;
        
        // Total score
        const totalScore = score + speedBonus + correctBonus;

        console.log('🎯 SCORING: Score breakdown:', {
            baseScore: score,
            speedBonus,
            correctBonus,
            totalScore
        });

        return Math.max(0, Math.floor(totalScore));
    }
}

// Player Answer Manager with enhanced tracking
class PlayerAnswerManager {
    constructor() {
        this.questionStartTime = null;
        this.hasAnswered = false;
        this.answerSubmittedTime = null;
    }

    startQuestion(startTime) {
        this.questionStartTime = startTime || Date.now();
        this.hasAnswered = false;
        this.answerSubmittedTime = null;
        console.log('📝 ANSWER_MGR: Question started at', new Date(this.questionStartTime).toLocaleTimeString());
    }

    getResponseTime() {
        if (!this.questionStartTime) {
            console.warn('⚠️ ANSWER_MGR: No start time recorded');
            return 0;
        }
        const responseTime = (Date.now() - this.questionStartTime) / 1000;
        console.log('⏱️ ANSWER_MGR: Response time calculated:', responseTime.toFixed(2), 'seconds');
        return responseTime;
    }

    markAnswered() {
        this.hasAnswered = true;
        this.answerSubmittedTime = Date.now();
        console.log('✅ ANSWER_MGR: Marked as answered at', new Date(this.answerSubmittedTime).toLocaleTimeString());
    }

    canAnswer() {
        return !this.hasAnswered;
    }

    getSubmissionDelay() {
        if (!this.answerSubmittedTime || !this.questionStartTime) return 0;
        return (this.answerSubmittedTime - this.questionStartTime) / 1000;
    }
}

// FIXED: Enhanced Game state management with proper scoring
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
        this.scoringSystem = new ScoringSystem();
        console.log('🎮 GAME: Created game instance for PIN:', gamePin, 'Host:', isHost);
    }

    async createGame(quiz) {
        if (!this.isHost) {
            console.error('❌ GAME: Only host can create game');
            return false;
        }
        
        try {
            console.log('🎮 GAME: Creating game with quiz:', quiz.title);
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
            console.log('✅ GAME: Game created successfully in Firebase');
            return true;
        } catch (error) {
            console.error('💥 GAME: Error creating game:', error);
            return false;
        }
    }

    async joinGame(playerName) {
        try {
            console.log('🎮 GAME: Player joining:', playerName);
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
                isCorrect: null,
                lastQuestionScore: 0,
                lastQuestionCorrect: false
            };

            const playerRef = db.ref(`games/${this.gamePin}/players/${playerId}`);
            await playerRef.set(playerData);
            console.log('✅ GAME: Player joined successfully with ID:', playerId);
            return playerId;
        } catch (error) {
            console.error('💥 GAME: Error joining game:', error);
            return null;
        }
    }

    async startGame() {
        if (!this.isHost) {
            console.error('❌ GAME: Only host can start game');
            return false;
        }
        
        try {
            console.log('🚀 GAME: Starting game...');
            const db = await this.waitForDatabase();
            if (!db) throw new Error('Database not available');
            
            const startTime = Date.now();
            const gameStateRef = db.ref(`games/${this.gamePin}/gameState`);
            await gameStateRef.update({
                status: 'playing',
                currentQuestion: 0,
                questionStartTime: startTime
            });
            
            this.questionStartTime = startTime;
            console.log('✅ GAME: Game started successfully');
            return true;
        } catch (error) {
            console.error('💥 GAME: Error starting game:', error);
            return false;
        }
    }

    async nextQuestion() {
        if (!this.isHost) {
            console.error('❌ GAME: Only host can advance questions');
            return false;
        }
        
        try {
            const nextQuestionIndex = this.currentQuestion + 1;
            const startTime = Date.now();
            
            console.log('➡️ GAME: Moving to question', nextQuestionIndex + 1);
            
            const db = await this.waitForDatabase();
            if (!db) throw new Error('Database not available');
            
            // Reset all player statuses for new question
            const updates = {};
            updates['gameState/currentQuestion'] = nextQuestionIndex;
            updates['gameState/questionStartTime'] = startTime;
            updates['gameState/status'] = 'playing';
            
            // Reset player states
            const playersSnapshot = await db.ref(`games/${this.gamePin}/players`).once('value');
            const players = playersSnapshot.val() || {};
            
            Object.keys(players).forEach(playerId => {
                updates[`players/${playerId}/status`] = 'waiting';
                updates[`players/${playerId}/currentAnswer`] = null;
                updates[`players/${playerId}/responseTime`] = null;
                updates[`players/${playerId}/answerTime`] = null;
            });
            
            await db.ref(`games/${this.gamePin}`).update(updates);
            
            this.currentQuestion = nextQuestionIndex;
            this.questionStartTime = startTime;
            console.log('✅ GAME: Successfully moved to question', nextQuestionIndex + 1);
            return true;
        } catch (error) {
            console.error('💥 GAME: Error moving to next question:', error);
            return false;
        }
    }

    async endGame() {
        if (!this.isHost) {
            console.error('❌ GAME: Only host can end game');
            return false;
        }
        
        try {
            console.log('🏁 GAME: Ending game...');
            const db = await this.waitForDatabase();
            if (!db) throw new Error('Database not available');
            
            const gameStateRef = db.ref(`games/${this.gamePin}/gameState`);
            await gameStateRef.update({
                status: 'finished',
                endedAt: Date.now()
            });
            
            console.log('✅ GAME: Game ended successfully');
            return true;
        } catch (error) {
            console.error('💥 GAME: Error ending game:', error);
            return false;
        }
    }

    // FIXED: Score calculation with proper timing
    async calculatePlayerScore(playerId, answerIndex, correctIndex, responseTime, questionTimeLimit) {
        const isCorrect = answerIndex === correctIndex;
        const score = this.scoringSystem.calculateScore(isCorrect, responseTime, questionTimeLimit);
        
        console.log('🏆 GAME: Calculated score for player', playerId, ':', score);
        
        try {
            const db = await this.waitForDatabase();
            if (!db) throw new Error('Database not available');
            
            const playerRef = db.ref(`games/${this.gamePin}/players/${playerId}`);
            const playerSnapshot = await playerRef.once('value');
            const playerData = playerSnapshot.val();
            
            if (playerData) {
                const newTotalScore = (playerData.score || 0) + score;
                
                await playerRef.update({
                    score: newTotalScore,
                    lastQuestionScore: score,
                    lastQuestionCorrect: isCorrect,
                    questionScore: score,
                    isCorrect: isCorrect,
                    scoredAt: Date.now()
                });
                
                console.log('✅ GAME: Score updated for player', playerId, '- Total:', newTotalScore);
                return { score, totalScore: newTotalScore, isCorrect };
            }
        } catch (error) {
            console.error('💥 GAME: Error updating player score:', error);
        }
        
        return { score: 0, totalScore: 0, isCorrect: false };
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
                    console.error('💥 GAME: Database timeout after', maxAttempts, 'attempts');
                    resolve(null);
                } else {
                    setTimeout(checkDatabase, 200);
                }
            };
            
            checkDatabase();
        });
    }

    generatePlayerId() {
        return Date.now().toString() + '_' + Math.floor(Math.random() * 1000).toString();
    }

    listenToGameState(callback) {
        this.waitForDatabase().then(db => {
            if (!db) {
                console.error('💥 GAME: Database not available for game state listener');
                return;
            }
            
            console.log('🎧 GAME: Setting up game state listener');
            const gameStateRef = db.ref(`games/${this.gamePin}/gameState`);
            gameStateRef.on('value', (snapshot) => {
                const gameState = snapshot.val();
                if (gameState) {
                    console.log('📡 GAME: Game state update received:', gameState.status);
                    if (gameState.questionStartTime) {
                        this.questionStartTime = gameState.questionStartTime;
                    }
                    callback(gameState);
                }
            }, (error) => {
                console.error('💥 GAME: Game state listener error:', error);
            });
        });
    }

    listenToPlayers(callback) {
        this.waitForDatabase().then(db => {
            if (!db) {
                console.error('💥 GAME: Database not available for players listener');
                return;
            }
            
            console.log('👥 GAME: Setting up players listener');
            const playersRef = db.ref(`games/${this.gamePin}/players`);
            playersRef.on('value', (snapshot) => {
                const players = snapshot.val() || {};
                console.log('👥 GAME: Players update received:', Object.keys(players).length, 'players');
                callback(players);
            }, (error) => {
                console.error('💥 GAME: Players listener error:', error);
            });
        });
    }

    cleanup() {
        console.log('🧹 GAME: Cleaning up game instance');
        this.waitForDatabase().then(db => {
            if (this.gamePin && db) {
                db.ref(`games/${this.gamePin}`).off();
                db.ref(`games/${this.gamePin}/players`).off();
                db.ref(`games/${this.gamePin}/gameState`).off();
            }
        });
        
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}

// Utility functions
function generateGamePin() {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('🎯 UTIL: Generated game PIN:', pin);
    return pin;
}

function generatePlayerId() {
    const id = Date.now().toString() + '_' + Math.floor(Math.random() * 1000).toString();
    console.log('👤 UTIL: Generated player ID:', id);
    return id;
}

// FIXED: Proper score calculation utility
function calculateScore(isCorrect, responseTime, maxTime) {
    console.log('🏆 UTIL: Legacy score calculation called:', {
        isCorrect,
        responseTime,
        maxTime
    });

    if (!isCorrect) return 0;
    
    const baseScore = 1000;
    const timeBonus = Math.floor((Math.max(0, maxTime - responseTime) / maxTime) * 500);
    const totalScore = baseScore + timeBonus;
    
    console.log('🎯 UTIL: Legacy score result:', totalScore);
    return totalScore;
}

function showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'block';
        console.log('👁️ UTIL: Showing element:', elementId);
    }
}

function hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'none';
        console.log('🙈 UTIL: Hiding element:', elementId);
    }
}

// Wait for Firebase with enhanced logging
function waitForFirebase(callback, maxRetries = 30) {
    let retries = 0;
    console.log('⏳ UTIL: Waiting for Firebase to be ready...');
    
    const checkFirebase = () => {
        retries++;
        console.log(`🔍 UTIL: Firebase check ${retries}/${maxRetries}`);
        
        const databaseReady = window.database && typeof window.database.ref === 'function';
        const authReady = window.auth && typeof window.auth.onAuthStateChanged === 'function';
        
        console.log('📊 UTIL: Firebase status:', {
            database: databaseReady,
            auth: authReady,
            firebase: typeof firebase !== 'undefined'
        });
        
        if (databaseReady || retries >= maxRetries) {
            console.log('✅ UTIL: Firebase check complete, calling callback');
            callback();
        } else {
            setTimeout(checkFirebase, 200);
        }
    };
    checkFirebase();
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 SCRIPT: Kokoot! V11 Enhanced Quiz system initializing...');
    
    waitForFirebase(() => {
        console.log('✅ SCRIPT: Quiz system ready');
        
        // Make classes globally available
        window.ScoringSystem = ScoringSystem;
        window.PlayerAnswerManager = PlayerAnswerManager;
        window.QuizGame = QuizGame;
        
        // Make utility functions available
        window.generateGamePin = generateGamePin;
        window.generatePlayerId = generatePlayerId;
        window.calculateScore = calculateScore;
        window.showElement = showElement;
        window.hideElement = hideElement;
        
        console.log('📄 SCRIPT: All classes and utilities loaded successfully');
        
        // Log system status
        console.log('🎮 SCRIPT: Kokoot! V11 System Status:', {
            sampleQuizzes: sampleQuizzes.length,
            scoringSystem: 'Enhanced with time-based bonuses',
            answerManager: 'Enhanced with submission tracking',
            gameClass: 'Enhanced with proper scoring integration'
        });
    });
});

console.log('📜 SCRIPT: Kokoot! V11 Enhanced script.js loaded successfully');