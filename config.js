// Enhanced Firebase Configuration with Better Error Handling and State Management
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

// Initialize Firebase with error handling
try {
    console.log('Initializing Firebase...');
    firebase.initializeApp(firebaseConfig);
    
    // Initialize services
    const database = firebase.database();
    const auth = firebase.auth();
    
    // Make globally available
    window.database = database;
    window.auth = auth;
    
    console.log('Firebase initialized successfully');
    
    // Test database connection
    database.ref('.info/connected').on('value', function(snapshot) {
        if (snapshot.val() === true) {
            console.log('✅ Connected to Firebase Database');
        } else {
            console.log('❌ Disconnected from Firebase Database');
        }
    });
    
} catch (error) {
    console.error('Firebase initialization error:', error);
    
    // Create mock database for offline testing
    window.database = {
        ref: function(path) {
            console.warn('Using mock database - Firebase not available');
            return {
                set: function(data) {
                    return Promise.reject(new Error('Firebase not available'));
                },
                update: function(data) {
                    return Promise.reject(new Error('Firebase not available'));
                },
                once: function(event, callback, errorCallback) {
                    if (errorCallback) {
                        errorCallback(new Error('Firebase not available'));
                    }
                },
                on: function(event, callback, errorCallback) {
                    if (errorCallback) {
                        errorCallback(new Error('Firebase not available'));
                    }
                },
                off: function() {
                    // No-op for cleanup
                }
            };
        }
    };
    
    window.auth = {
        onAuthStateChanged: function(callback) {
            // Call with null user for offline mode
            callback(null);
        },
        signOut: function() {
            return Promise.resolve();
        }
    };
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

// Enhanced Session Management Class with Recovery Support
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
                console.log('Session loaded from localStorage:', sessionData);
            } else {
                this.createNewSession();
            }
            this.isInitialized = true;
            
            // Handle recovery from unexpected shutdowns
            this.handleRecovery();
        } catch (error) {
            console.error('Error initializing session:', error);
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
                    console.log('🔄 Recovery data found:', recovery);
                    
                    // Merge recovery data if it's newer
                    if (recovery.sessionData && 
                        (!sessionData.lastUpdated || recovery.sessionData.lastUpdated > sessionData.lastUpdated)) {
                        sessionData = { ...sessionData, ...recovery.sessionData };
                        this.saveSession();
                        console.log('✅ Session recovered from recovery data');
                    }
                }
                
                // Clean up old recovery data
                if (timeSinceLastSave > 10 * 60 * 1000) { // Older than 10 minutes
                    localStorage.removeItem(this.recoveryKey);
                }
            }
        } catch (error) {
            console.error('Error during recovery handling:', error);
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
            console.error('Error saving recovery checkpoint:', error);
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
        console.log('New session created:', sessionData);
    }

    // Get temporary quizzes from old localStorage format
    getTempQuizzes() {
        try {
            const tempQuizzes = localStorage.getItem('savedQuizzes');
            return tempQuizzes ? JSON.parse(tempQuizzes) : [];
        } catch (error) {
            console.error('Error getting temp quizzes:', error);
            return [];
        }
    }

    // Save session to localStorage with recovery checkpoint
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
            console.error('Error saving session:', error);
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

    // Check if user is logged in
    isUserLoggedIn() {
        return currentUser && !sessionData.isGuest;
    }

    // Add quiz to session with enhanced tracking
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
        if (currentUser && !sessionData.isGuest && typeof database !== 'undefined') {
            this.saveQuizToFirebase(currentUser.uid, quiz).catch(console.error);
        }
    }

    // Save quiz to Firebase with retry logic
    async saveQuizToFirebase(userId, quiz, retryCount = 0) {
        try {
            if (typeof database === 'undefined') {
                throw new Error('Firebase not available');
            }
            
            await database.ref(`users/${userId}/quizzes/${quiz.id}`).set({
                ...quiz,
                userId: userId,
                updatedAt: Date.now(),
                syncedAt: Date.now()
            });
            
            console.log('✅ Quiz synced to Firebase:', quiz.title);
        } catch (error) {
            console.error('Error saving quiz to Firebase:', error);
            
            // Retry once after a delay
            if (retryCount < 1) {
                console.log('Retrying Firebase sync in 3 seconds...');
                setTimeout(() => {
                    this.saveQuizToFirebase(userId, quiz, retryCount + 1);
                }, 3000);
            } else {
                // Store for later sync
                this.queueForLaterSync(quiz);
            }
            throw error;
        }
    }

    // Queue items for later sync when Firebase is available
    queueForLaterSync(quiz) {
        try {
            let syncQueue = JSON.parse(localStorage.getItem('firebase_sync_queue') || '[]');
            syncQueue.push({
                type: 'quiz',
                data: quiz,
                timestamp: Date.now()
            });
            localStorage.setItem('firebase_sync_queue', JSON.stringify(syncQueue));
            console.log('📦 Quiz queued for later sync:', quiz.title);
        } catch (error) {
            console.error('Error queuing for sync:', error);
        }
    }

    // Process sync queue when Firebase becomes available
    async processSyncQueue(userId) {
        try {
            const syncQueue = JSON.parse(localStorage.getItem('firebase_sync_queue') || '[]');
            if (syncQueue.length === 0) return;
            
            console.log('🔄 Processing sync queue:', syncQueue.length, 'items');
            
            for (const item of syncQueue) {
                if (item.type === 'quiz') {
                    await this.saveQuizToFirebase(userId, item.data);
                }
            }
            
            // Clear queue after successful sync
            localStorage.removeItem('firebase_sync_queue');
            console.log('✅ Sync queue processed successfully');
        } catch (error) {
            console.error('Error processing sync queue:', error);
        }
    }

    // Load user data from Firebase when logged in with state preservation
    async loadUserDataFromFirebase(user) {
        console.log('Loading user data from Firebase for:', user.email);
        
        try {
            if (typeof database === 'undefined') {
                throw new Error('Firebase not available');
            }

            const userData = await this.getFirebaseUserData(user.uid);
            const quizzes = await this.getFirebaseQuizzes(user.uid);

            // Merge with existing session data (preserve local changes)
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

            // Process any pending sync items
            await this.processSyncQueue(user.uid);

            console.log('User data loaded and merged from Firebase:', { 
                quizzes: mergedQuizzes.length, 
                stats: sessionData.stats 
            });

            return { success: true, quizzes: mergedQuizzes, userData };

        } catch (error) {
            console.error('Error loading user data from Firebase:', error);
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

        // Add local quizzes that don't exist remotely or are newer
        localQuizzes.forEach(localQuiz => {
            if (!processedIds.has(localQuiz.id)) {
                // New local quiz, add it
                merged.push(localQuiz);
                processedIds.add(localQuiz.id);
                
                // Queue for sync if user is logged in
                if (currentUser && !sessionData.isGuest) {
                    this.queueForLaterSync(localQuiz);
                }
            } else {
                // Quiz exists in both, check if local version is newer
                const remoteQuiz = remoteQuizzes.find(q => q.id === localQuiz.id);
                if (localQuiz.updatedAt && remoteQuiz.updatedAt && 
                    localQuiz.updatedAt > remoteQuiz.updatedAt) {
                    // Local version is newer, replace remote version
                    const index = merged.findIndex(q => q.id === localQuiz.id);
                    if (index !== -1) {
                        merged[index] = localQuiz;
                        // Queue for sync
                        if (currentUser && !sessionData.isGuest) {
                            this.queueForLaterSync(localQuiz);
                        }
                    }
                }
            }
        });

        return merged;
    }

    // Get user data from Firebase
    async getFirebaseUserData(userId) {
        try {
            if (typeof database === 'undefined') {
                throw new Error('Firebase not available');
            }
            const snapshot = await database.ref(`users/${userId}`).once('value');
            return snapshot.val() || {};
        } catch (error) {
            console.error('Error getting Firebase user data:', error);
            return {};
        }
    }

    // Get user quizzes from Firebase
    async getFirebaseQuizzes(userId) {
        try {
            if (typeof database === 'undefined') {
                throw new Error('Firebase not available');
            }
            const snapshot = await database.ref(`users/${userId}/quizzes`).once('value');
            const quizzes = snapshot.val() || {};
            return Object.values(quizzes);
        } catch (error) {
            console.error('Error getting Firebase quizzes:', error);
            return [];
        }
    }

    // Clear session and recovery data
    clearSession() {
        localStorage.removeItem(this.sessionKey);
        localStorage.removeItem(this.recoveryKey);
        localStorage.removeItem('firebase_sync_queue');
        this.createNewSession();
    }
}

// Initialize session manager
const sessionManager = new SessionManager();

// Initialize session immediately when script loads
sessionManager.initializeSession();

// Enhanced Authentication state management with better error handling
if (typeof auth !== 'undefined') {
    auth.onAuthStateChanged(async (user) => {
        const wasGuest = sessionData.isGuest;
        currentUser = user;
        
        if (user) {
            console.log('User signed in:', user.email);
            
            // Store user info for easy access
            localStorage.setItem('userEmail', user.email);
            localStorage.setItem('userName', user.displayName || user.email);
            localStorage.setItem('userId', user.uid);
            
            // Load existing user data from Firebase with merge
            const loadResult = await sessionManager.loadUserDataFromFirebase(user);
            if (loadResult.success) {
                // Trigger refresh of any open quiz management pages
                window.dispatchEvent(new CustomEvent('userDataUpdated', { 
                    detail: { quizzes: loadResult.quizzes, userData: loadResult.userData }
                }));
            }
            
        } else {
            console.log('User signed out');
            
            // Clear user info but keep session data
            localStorage.removeItem('userEmail');
            localStorage.removeItem('userName');
            localStorage.removeItem('userId');
            
            // Reset session to guest mode but keep existing quizzes
            sessionData.isGuest = true;
            sessionData.userId = null;
            sessionData.userEmail = null;
            sessionManager.saveSession();
            
            // Only redirect to auth page if we're on host or manage pages
            const currentPage = window.location.pathname.split('/').pop();
            if (currentPage === 'host.html' || currentPage === 'manage.html') {
                window.location.href = 'auth.html';
            }
        }
    });
} else {
    console.log('Firebase Auth not available - running in offline mode');
}

// Utility functions
function generateGamePin() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function generatePlayerId() {
    return Date.now().toString() + Math.floor(Math.random() * 1000).toString();
}

// Database reference helpers with fallbacks
function getGameRef(pin) {
    if (typeof database !== 'undefined') {
        return database.ref(`games/${pin}`);
    }
    console.warn('Database not available');
    return null;
}

function getPlayersRef(pin) {
    if (typeof database !== 'undefined') {
        return database.ref(`games/${pin}/players`);
    }
    console.warn('Database not available');
    return null;
}

function getQuestionsRef(pin) {
    if (typeof database !== 'undefined') {
        return database.ref(`games/${pin}/questions`);
    }
    console.warn('Database not available');
    return null;
}

function getGameStateRef(pin) {
    if (typeof database !== 'undefined') {
        return database.ref(`games/${pin}/gameState`);
    }
    console.warn('Database not available');
    return null;
}

// User-specific database references
function getUserQuizzesRef(userId) {
    if (typeof database !== 'undefined') {
        return database.ref(`users/${userId}/quizzes`);
    }
    console.warn('Database not available');
    return null;
}

function getUserDataRef(userId) {
    if (typeof database !== 'undefined') {
        return database.ref(`users/${userId}`);
    }
    console.warn('Database not available');
    return null;
}

function getUserStatsRef(userId) {
    if (typeof database !== 'undefined') {
        return database.ref(`users/${userId}/stats`);
    }
    console.warn('Database not available');
    return null;
}

// Authentication helper functions
function requireAuth() {
    if (!currentUser) {
        return false;
    }
    return true;
}

function getCurrentUserId() {
    return currentUser ? currentUser.uid : sessionData.userId;
}

function getCurrentUserEmail() {
    return currentUser ? currentUser.email : sessionData.userEmail;
}

function getCurrentUserName() {
    return currentUser ? (currentUser.displayName || currentUser.email) : 
           (sessionData.userData.displayName || sessionData.userEmail);
}

// Enhanced quiz management functions with recovery support
async function saveQuizToSystem(quizData) {
    console.log('Saving quiz to system:', quizData.title);
    
    // Always save to session first
    sessionManager.addQuizToSession(quizData);
    
    // If user is logged in, also save to Firebase
    if (currentUser && typeof database !== 'undefined') {
        try {
            await sessionManager.saveQuizToFirebase(currentUser.uid, quizData);
            console.log('Quiz saved to Firebase successfully');
            return { success: true, location: 'firebase' };
        } catch (error) {
            console.error('Failed to save to Firebase, saved locally:', error);
            return { success: true, location: 'local', error: error.message };
        }
    } else {
        console.log('Quiz saved to local session');
        return { success: true, location: 'session' };
    }
}

async function loadAllQuizzes() {
    console.log('Loading all quizzes...');
    
    if (currentUser && typeof database !== 'undefined') {
        // Load from Firebase for logged-in users with merge
        const result = await sessionManager.loadUserDataFromFirebase(currentUser);
        if (result.success) {
            return result.quizzes;
        }
    }
    
    // Fallback to session data
    return sessionManager.getSessionQuizzes();
}

async function deleteQuizFromSystem(quizId) {
    console.log('Deleting quiz:', quizId);
    
    // Remove from session
    sessionData.quizzes = sessionData.quizzes.filter(q => q.id !== quizId);
    sessionManager.saveSession();
    
    // If user is logged in, also delete from Firebase
    if (currentUser && typeof database !== 'undefined') {
        try {
            await database.ref(`users/${currentUser.uid}/quizzes/${quizId}`).remove();
            console.log('Quiz deleted from Firebase');
        } catch (error) {
            console.error('Failed to delete from Firebase:', error);
        }
    }
    
    return true;
}

// Sign out function with cleanup
async function signOut() {
    try {
        // Save recovery checkpoint before signing out
        sessionManager.saveRecoveryCheckpoint();
        
        if (typeof auth !== 'undefined') {
            await auth.signOut();
        }
        // Redirect logic is handled in onAuthStateChanged
    } catch (error) {
        console.error('Sign out error:', error);
    }
}

// Common status display function
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

// Enhanced backward compatibility functions
function saveToLocalStorage(key, data) {
    if (key === 'savedQuizzes') {
        // Redirect to session manager
        data.forEach(quiz => sessionManager.addQuizToSession(quiz));
    } else {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }
}

function getFromLocalStorage(key) {
    if (key === 'savedQuizzes') {
        // Redirect to session manager
        return sessionManager.getSessionQuizzes();
    } else {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return null;
        }
    }
}

// Periodic session sync and recovery checkpoint
setInterval(() => {
    if (sessionManager && sessionManager.isInitialized) {
        sessionManager.saveRecoveryCheckpoint();
    }
}, 60000); // Every minute

// Handle beforeunload for graceful shutdowns
window.addEventListener('beforeunload', () => {
    if (sessionManager) {
        sessionManager.saveRecoveryCheckpoint();
    }
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && sessionManager) {
        // Page became visible, save recovery checkpoint
        sessionManager.saveRecoveryCheckpoint();
    }
});

// Export session manager for use in other files
window.sessionManager = sessionManager;

// Log initialization status
console.log('Enhanced Firebase config loaded with state recovery support');