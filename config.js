// Enhanced Firebase Configuration - FINAL FIXED VERSION
const firebaseConfig = {
    apiKey: "AIzaSyDdVOTMNZfO-Pky1KWNcA0O1UKYBXDPlU8",
    authDomain: "quiz-system-1b9cc.firebaseapp.com",
    databaseURL: "https://quiz-system-1b9cc-default-rtdb.firebaseio.com",
    projectId: "quiz-system-1b9cc",
    storageBucket: "quiz-system-1b9cc.firebasestorage.app",
    messagingSenderId: "769000169705",
    appId: "1:769000169705:web:2cf26d22b03839459a9078",
    measurementId: "G-Z4G7TDL4XK"
};

// Initialize Firebase and global variables
let database = null;
let auth = null;
let isFirebaseInitialized = false;
let initializationPromise = null;

// Initialize Firebase - Returns a Promise
function initializeFirebaseIfNeeded() {
    // Return existing promise if already initializing
    if (initializationPromise) {
        return initializationPromise;
    }
    
    initializationPromise = new Promise(async (resolve, reject) => {
        try {
            console.log('🔥 CONFIG: Starting Firebase initialization...');
            
            // Check if Firebase is available
            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK not loaded');
            }
            
            // Check if already initialized
            let app;
            try {
                app = firebase.app(); // This will throw if not initialized
                console.log('✅ CONFIG: Firebase already initialized');
            } catch (error) {
                // Not initialized, so initialize it
                console.log('🔥 CONFIG: Initializing Firebase...');
                app = firebase.initializeApp(firebaseConfig);
                console.log('✅ CONFIG: Firebase initialized successfully');
            }
            
            // Initialize services
            console.log('🔥 CONFIG: Initializing Auth and Database services...');
            auth = firebase.auth();
            database = firebase.database();
            
            // Make globally available IMMEDIATELY
            window.auth = auth;
            window.database = database;
            
            console.log('✅ CONFIG: Auth and Database services initialized');
            
            // Test database connection
            database.ref('.info/connected').on('value', function(snapshot) {
                if (snapshot.val() === true) {
                    console.log('✅ CONFIG: Connected to Firebase Database');
                } else {
                    console.log('❌ CONFIG: Disconnected from Firebase Database');
                }
            });
            
            isFirebaseInitialized = true;
            console.log('🎉 CONFIG: Firebase initialization complete');
            resolve({ auth, database });
            
        } catch (error) {
            console.error('💥 CONFIG: Firebase initialization error:', error);
            createMockServices();
            reject(error);
        }
    });
    
    return initializationPromise;
}

function createMockServices() {
    console.warn('🔧 CONFIG: Creating mock services for offline testing');
    
    // Create mock auth
    const mockAuth = {
        onAuthStateChanged: function(callback) {
            console.warn('🔧 CONFIG: Mock auth - calling callback with null user');
            setTimeout(() => callback(null), 100);
            return () => {}; // Return unsubscribe function
        },
        signOut: function() {
            return Promise.resolve();
        },
        currentUser: null
    };
    
    // Create mock database
    const mockDatabase = {
        ref: function(path) {
            console.warn('🔧 CONFIG: Mock database ref for:', path);
            return {
                set: function(data) {
                    return Promise.reject(new Error('Firebase not available'));
                },
                update: function(data) {
                    return Promise.reject(new Error('Firebase not available'));
                },
                once: function(event, callback, errorCallback) {
                    if (errorCallback) {
                        setTimeout(() => errorCallback(new Error('Firebase not available')), 100);
                    }
                    return Promise.reject(new Error('Firebase not available'));
                },
                on: function(event, callback, errorCallback) {
                    if (errorCallback) {
                        setTimeout(() => errorCallback(new Error('Firebase not available')), 100);
                    }
                },
                off: function() {
                    // No-op for cleanup
                }
            };
        }
    };
    
    // Set global variables
    auth = mockAuth;
    database = mockDatabase;
    window.auth = mockAuth;
    window.database = mockDatabase;
    
    console.log('🔧 CONFIG: Mock services created and assigned');
}

// Global variables for the quiz system
let currentUser = null;
let currentGame = null;
let currentQuestionIndex = 0;
let gamePin = null;
let isHost = false;
let sessionData = {
    quizzes: [],
    stats: {},
    userData: {}
};

// Enhanced Session Management Class
class SessionManager {
    constructor() {
        this.sessionKey = 'quizmaster_session';
        this.tempDataKey = 'quizmaster_temp_data';
        this.recoveryKey = 'quizmaster_recovery';
        this.isInitialized = false;
    }

    // Initialize session from localStorage or create new
    initializeSession() {
        try {
            const savedSession = localStorage.getItem(this.sessionKey);
            if (savedSession) {
                sessionData = JSON.parse(savedSession);
                console.log('📦 CONFIG: Session loaded from localStorage:', sessionData);
            } else {
                this.createNewSession();
            }
            this.isInitialized = true;
            
            // Handle recovery from unexpected shutdowns
            this.handleRecovery();
        } catch (error) {
            console.error('💥 CONFIG: Error initializing session:', error);
            this.createNewSession();
        }
    }

    // Handle recovery scenarios
    handleRecovery() {
        try {
            const recoveryData = localStorage.getItem(this.recoveryKey);
            if (recoveryData) {
                const recovery = JSON.parse(recoveryData);
                const timeSinceLastSave = Date.now() - recovery.timestamp;
                
                // If less than 5 minutes, consider it a valid recovery scenario
                if (timeSinceLastSave < 5 * 60 * 1000) {
                    console.log('🔄 CONFIG: Recovery data found:', recovery);
                    
                    // Merge recovery data if it's newer
                    if (recovery.sessionData && 
                        (!sessionData.lastUpdated || recovery.sessionData.lastUpdated > sessionData.lastUpdated)) {
                        sessionData = { ...sessionData, ...recovery.sessionData };
                        this.saveSession();
                        console.log('✅ CONFIG: Session recovered from recovery data');
                    }
                }
                
                // Clean up old recovery data
                if (timeSinceLastSave > 10 * 60 * 1000) { // Older than 10 minutes
                    localStorage.removeItem(this.recoveryKey);
                }
            }
        } catch (error) {
            console.error('💥 CONFIG: Error during recovery handling:', error);
        }
    }

    // Save recovery checkpoint
    saveRecoveryCheckpoint() {
        try {
            const recoveryData = {
                timestamp: Date.now(),
                sessionData: { ...sessionData, lastUpdated: Date.now() }
            };
            localStorage.setItem(this.recoveryKey, JSON.stringify(recoveryData));
        } catch (error) {
            console.error('💥 CONFIG: Error saving recovery checkpoint:', error);
        }
    }

    // Create a new session
    createNewSession() {
        sessionData = {
            quizzes: this.getTempQuizzes() || [],
            stats: { quizCount: 0, totalPlays: 0 },
            userData: {},
            sessionId: this.generateSessionId(),
            createdAt: Date.now(),
            lastUpdated: Date.now(),
            isGuest: true
        };
        this.saveSession();
        console.log('🆕 CONFIG: New session created:', sessionData);
    }

    // Get temporary quizzes from old localStorage format
    getTempQuizzes() {
        try {
            const tempQuizzes = localStorage.getItem('savedQuizzes');
            return tempQuizzes ? JSON.parse(tempQuizzes) : [];
        } catch (error) {
            console.error('💥 CONFIG: Error getting temp quizzes:', error);
            return [];
        }
    }

    // Save session to localStorage
    saveSession() {
        try {
            sessionData.lastUpdated = Date.now();
            localStorage.setItem(this.sessionKey, JSON.stringify(sessionData));
            
            // Save recovery checkpoint every 30 seconds
            if (!this.lastRecoveryCheckpoint || 
                Date.now() - this.lastRecoveryCheckpoint > 30000) {
                this.saveRecoveryCheckpoint();
                this.lastRecoveryCheckpoint = Date.now();
            }
        } catch (error) {
            console.error('💥 CONFIG: Error saving session:', error);
        }
    }

    // Generate unique session ID
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Get current session quizzes
    getSessionQuizzes() {
        return sessionData.quizzes || [];
    }

    // Get current session stats
    getSessionStats() {
        return sessionData.stats || { quizCount: 0, totalPlays: 0 };
    }

    // Add quiz to session
    addQuizToSession(quiz) {
        if (!sessionData.quizzes) {
            sessionData.quizzes = [];
        }
        
        if (!sessionData.stats) {
            sessionData.stats = { quizCount: 0, totalPlays: 0 };
        }
        
        const existingIndex = sessionData.quizzes.findIndex(q => q.id === quiz.id);
        if (existingIndex !== -1) {
            sessionData.quizzes[existingIndex] = quiz;
        } else {
            sessionData.quizzes.push(quiz);
            sessionData.stats.quizCount = (sessionData.stats.quizCount || 0) + 1;
        }
        
        this.saveSession();
        
        // If user is logged in and Firebase is available, also save to Firebase
        if (currentUser && !sessionData.isGuest && database && database.ref) {
            this.saveQuizToFirebase(currentUser.uid, quiz).catch(console.error);
        }
    }

    // Save quiz to Firebase
    async saveQuizToFirebase(userId, quiz, retryCount = 0) {
        try {
            if (!database || !database.ref) {
                throw new Error('Firebase not available');
            }
            
            await database.ref(`users/${userId}/quizzes/${quiz.id}`).set({
                ...quiz,
                userId: userId,
                updatedAt: Date.now(),
                syncedAt: Date.now()
            });
            
            console.log('✅ CONFIG: Quiz synced to Firebase:', quiz.title);
        } catch (error) {
            console.error('💥 CONFIG: Error saving quiz to Firebase:', error);
            
            // Retry once after a delay
            if (retryCount < 1) {
                console.log('🔄 CONFIG: Retrying Firebase sync in 3 seconds...');
                setTimeout(() => {
                    this.saveQuizToFirebase(userId, quiz, retryCount + 1);
                }, 3000);
            }
            throw error;
        }
    }

    // Load user data from Firebase when logged in
    async loadUserDataFromFirebase(user) {
        console.log('📚 CONFIG: Loading user data from Firebase for:', user.email);
        
        try {
            if (!database || !database.ref) {
                throw new Error('Firebase not available');
            }

            const userData = await this.getFirebaseUserData(user.uid);
            const quizzes = await this.getFirebaseQuizzes(user.uid);

            // Merge with existing session data
            const localQuizzes = sessionData.quizzes || [];
            const mergedQuizzes = this.mergeQuizzes(localQuizzes, quizzes);

            // Update session data
            sessionData.quizzes = mergedQuizzes;
            sessionData.stats = userData.stats || sessionData.stats || { quizCount: 0, totalPlays: 0 };
            sessionData.userData = userData;
            sessionData.isGuest = false;
            sessionData.userId = user.uid;
            sessionData.userEmail = user.email;

            this.saveSession();

            console.log('📊 CONFIG: User data loaded and merged from Firebase:', { 
                quizzes: mergedQuizzes.length, 
                stats: sessionData.stats 
            });

            return { success: true, quizzes: mergedQuizzes, userData };

        } catch (error) {
            console.error('💥 CONFIG: Error loading user data from Firebase:', error);
            return { success: false, error: error.message };
        }
    }

    // Smart merge of local and remote quizzes
    mergeQuizzes(localQuizzes, remoteQuizzes) {
        const merged = [];
        const processedIds = new Set();

        // Add remote quizzes first (they're authoritative)
        remoteQuizzes.forEach(remoteQuiz => {
            merged.push(remoteQuiz);
            processedIds.add(remoteQuiz.id);
        });

        // Add local quizzes that don't exist remotely
        localQuizzes.forEach(localQuiz => {
            if (!processedIds.has(localQuiz.id)) {
                merged.push(localQuiz);
                processedIds.add(localQuiz.id);
            }
        });

        return merged;
    }

    // Get user data from Firebase
    async getFirebaseUserData(userId) {
        try {
            if (!database || !database.ref) {
                throw new Error('Firebase not available');
            }
            const snapshot = await database.ref(`users/${userId}`).once('value');
            return snapshot.val() || {};
        } catch (error) {
            console.error('💥 CONFIG: Error getting Firebase user data:', error);
            return {};
        }
    }

    // Get user quizzes from Firebase
    async getFirebaseQuizzes(userId) {
        try {
            if (!database || !database.ref) {
                throw new Error('Firebase not available');
            }
            const snapshot = await database.ref(`users/${userId}/quizzes`).once('value');
            const quizzes = snapshot.val() || {};
            return Object.values(quizzes);
        } catch (error) {
            console.error('💥 CONFIG: Error getting Firebase quizzes:', error);
            return [];
        }
    }

    // Clear session
    clearSession() {
        localStorage.removeItem(this.sessionKey);
        localStorage.removeItem(this.recoveryKey);
        this.createNewSession();
    }
}

// Initialize session manager
const sessionManager = new SessionManager();

// Authentication state management with proper null checking
async function setupAuthStateListener() {
    try {
        // Wait for auth to be available
        await waitForAuth();
        
        if (auth && typeof auth.onAuthStateChanged === 'function') {
            console.log('🔐 CONFIG: Setting up auth state listener...');
            
            auth.onAuthStateChanged(async (user) => {
                const wasGuest = sessionData.isGuest;
                currentUser = user;
                
                if (user) {
                    console.log('👤 CONFIG: User signed in:', user.email);
                    
                    // Store user info for easy access
                    localStorage.setItem('userEmail', user.email);
                    localStorage.setItem('userName', user.displayName || user.email);
                    localStorage.setItem('userId', user.uid);
                    
                    // Load existing user data from Firebase
                    const loadResult = await sessionManager.loadUserDataFromFirebase(user);
                    if (loadResult.success) {
                        // Trigger refresh of any open quiz management pages
                        window.dispatchEvent(new CustomEvent('userDataUpdated', { 
                            detail: { quizzes: loadResult.quizzes, userData: loadResult.userData }
                        }));
                    }
                    
                } else {
                    console.log('👋 CONFIG: User signed out');
                    
                    // Clear user info but keep session data
                    localStorage.removeItem('userEmail');
                    localStorage.removeItem('userName');
                    localStorage.removeItem('userId');
                    
                    // Reset session to guest mode
                    sessionData.isGuest = true;
                    sessionData.userId = null;
                    sessionData.userEmail = null;
                    sessionManager.saveSession();
                }
            });
            
            console.log('✅ CONFIG: Auth state listener set up successfully');
        } else {
            console.error('💥 CONFIG: Auth not available for state listener');
        }
    } catch (error) {
        console.error('💥 CONFIG: Error setting up auth state listener:', error);
    }
}

// Wait for auth to be available
function waitForAuth() {
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 20;
        
        const checkAuth = () => {
            attempts++;
            
            if (window.auth && typeof window.auth.onAuthStateChanged === 'function') {
                console.log('✅ CONFIG: Auth is ready');
                resolve();
            } else if (attempts >= maxAttempts) {
                console.error('💥 CONFIG: Auth timeout after', maxAttempts, 'attempts');
                resolve(); // Resolve anyway to prevent hanging
            } else {
                console.log(`⏳ CONFIG: Waiting for auth... attempt ${attempts}/${maxAttempts}`);
                setTimeout(checkAuth, 100);
            }
        };
        
        checkAuth();
    });
}

// Utility functions
function generateGamePin() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function generatePlayerId() {
    return Date.now().toString() + Math.floor(Math.random() * 1000).toString();
}

// Database reference helpers with better error checking
function getGameRef(pin) {
    if (database && typeof database.ref === 'function') {
        return database.ref(`games/${pin}`);
    }
    console.warn('⚠️ CONFIG: Database not available for getGameRef');
    return null;
}

function getPlayersRef(pin) {
    if (database && typeof database.ref === 'function') {
        return database.ref(`games/${pin}/players`);
    }
    console.warn('⚠️ CONFIG: Database not available for getPlayersRef');
    return null;
}

function getGameStateRef(pin) {
    if (database && typeof database.ref === 'function') {
        return database.ref(`games/${pin}/gameState`);
    }
    console.warn('⚠️ CONFIG: Database not available for getGameStateRef');
    return null;
}

// User-specific database references
function getUserQuizzesRef(userId) {
    if (database && typeof database.ref === 'function') {
        return database.ref(`users/${userId}/quizzes`);
    }
    console.warn('⚠️ CONFIG: Database not available for getUserQuizzesRef');
    return null;
}

function getUserDataRef(userId) {
    if (database && typeof database.ref === 'function') {
        return database.ref(`users/${userId}`);
    }
    console.warn('⚠️ CONFIG: Database not available for getUserDataRef');
    return null;
}

function getUserStatsRef(userId) {
    if (database && typeof database.ref === 'function') {
        return database.ref(`users/${userId}/stats`);
    }
    console.warn('⚠️ CONFIG: Database not available for getUserStatsRef');
    return null;
}

// Quiz management functions
async function saveQuizToSystem(quizData) {
    console.log('💾 CONFIG: Saving quiz to system:', quizData.title);
    
    // Always save to session first
    sessionManager.addQuizToSession(quizData);
    
    // If user is logged in, also save to Firebase
    if (currentUser && database && database.ref) {
        try {
            await sessionManager.saveQuizToFirebase(currentUser.uid, quizData);
            console.log('✅ CONFIG: Quiz saved to Firebase successfully');
            return { success: true, location: 'firebase' };
        } catch (error) {
            console.error('💥 CONFIG: Failed to save to Firebase, saved locally:', error);
            return { success: true, location: 'local', error: error.message };
        }
    } else {
        console.log('📱 CONFIG: Quiz saved to local session');
        return { success: true, location: 'session' };
    }
}

async function loadAllQuizzes() {
    console.log('📚 CONFIG: Loading all quizzes...');
    
    if (currentUser && database && database.ref) {
        // Load from Firebase for logged-in users
        const result = await sessionManager.loadUserDataFromFirebase(currentUser);
        if (result.success) {
            return result.quizzes;
        }
    }
    
    // Fallback to session data
    return sessionManager.getSessionQuizzes();
}

async function deleteQuizFromSystem(quizId) {
    console.log('🗑️ CONFIG: Deleting quiz:', quizId);
    
    // Remove from session
    sessionData.quizzes = sessionData.quizzes.filter(q => q.id !== quizId);
    sessionManager.saveSession();
    
    // If user is logged in, also delete from Firebase
    if (currentUser && database && database.ref) {
        try {
            await database.ref(`users/${currentUser.uid}/quizzes/${quizId}`).remove();
            console.log('✅ CONFIG: Quiz deleted from Firebase');
        } catch (error) {
            console.error('💥 CONFIG: Failed to delete from Firebase:', error);
        }
    }
    
    return true;
}

// Sign out function
async function signOut() {
    try {
        sessionManager.saveRecoveryCheckpoint();
        
        if (auth && typeof auth.signOut === 'function') {
            await auth.signOut();
        }
    } catch (error) {
        console.error('💥 CONFIG: Sign out error:', error);
    }
}

// Status display function
function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('status-message') || document.getElementById('status');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`;
        setTimeout(() => {
            statusEl.textContent = '';
            statusEl.className = 'status-message';
        }, 3000);
    }
}

// Initialize everything when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 CONFIG: Initializing configuration system...');
    
    // Initialize session first
    sessionManager.initializeSession();
    
    // Initialize Firebase and set up auth listener
    initializeFirebaseIfNeeded()
        .then(() => {
            console.log('🎉 CONFIG: Firebase initialization completed');
            return setupAuthStateListener();
        })
        .then(() => {
            console.log('✅ CONFIG: Configuration system fully initialized');
        })
        .catch(error => {
            console.error('💥 CONFIG: Configuration system initialization failed:', error);
        });
});

// Export session manager and make functions globally available
window.sessionManager = sessionManager;
window.saveQuizToSystem = saveQuizToSystem;
window.loadAllQuizzes = loadAllQuizzes;
window.deleteQuizFromSystem = deleteQuizFromSystem;
window.signOut = signOut;
window.showStatus = showStatus;
window.generateGamePin = generateGamePin;
window.generatePlayerId = generatePlayerId;
window.getGameRef = getGameRef;
window.getPlayersRef = getPlayersRef;
window.getGameStateRef = getGameStateRef;
window.getUserQuizzesRef = getUserQuizzesRef;
window.getUserDataRef = getUserDataRef;
window.getUserStatsRef = getUserStatsRef;

console.log('✅ CONFIG: Configuration system loaded successfully');