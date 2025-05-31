// Enhanced Firebase Configuration with Session Management
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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

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

// Session Management Class
class SessionManager {
    constructor() {
        this.sessionKey = 'quizmaster_session';
        this.tempDataKey = 'quizmaster_temp_data';
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
        } catch (error) {
            console.error('Error initializing session:', error);
            this.createNewSession();
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

    // Save session to localStorage
    saveSession() {
        try {
            localStorage.setItem(this.sessionKey, JSON.stringify(sessionData));
        } catch (error) {
            console.error('Error saving session:', error);
        }
    }

    // Generate unique session ID
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Migrate session data to Firebase when user logs in
    async migrateToFirebase(user) {
        console.log('Migrating session data to Firebase for user:', user.email);
        
        try {
            // Ensure session data is properly initialized
            if (!sessionData.quizzes) sessionData.quizzes = [];
            if (!sessionData.stats) sessionData.stats = { quizCount: 0, totalPlays: 0 };
            
            // Get existing Firebase data
            const firebaseUserData = await this.getFirebaseUserData(user.uid);
            const firebaseQuizzes = await this.getFirebaseQuizzes(user.uid);

            console.log('Session quizzes to migrate:', sessionData.quizzes.length);
            console.log('Existing Firebase quizzes:', firebaseQuizzes.length);
            console.log('Firebase user data:', firebaseUserData);

            // Merge session quizzes with Firebase quizzes
            const mergedQuizzes = this.mergeQuizzes(sessionData.quizzes, firebaseQuizzes);
            
            // Merge stats - ensure firebaseUserData.stats exists
            const mergedStats = this.mergeStats(sessionData.stats, firebaseUserData.stats || {});

            console.log('Merged quizzes:', mergedQuizzes.length);
            console.log('Merged stats:', mergedStats);

            // Save merged data to Firebase
            await this.saveUserDataToFirebase(user.uid, {
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                stats: mergedStats,
                lastLogin: Date.now(),
                sessionMigrated: true,
                migratedAt: Date.now()
            });

            // Save merged quizzes to Firebase
            for (const quiz of mergedQuizzes) {
                await this.saveQuizToFirebase(user.uid, quiz);
            }

            // Update session data
            sessionData.quizzes = mergedQuizzes;
            sessionData.stats = mergedStats;
            sessionData.userData = firebaseUserData;
            sessionData.isGuest = false;
            sessionData.userId = user.uid;
            sessionData.userEmail = user.email;

            this.saveSession();

            // Clear old localStorage data
            this.clearTempData();

            console.log('Session migration completed successfully');
            return { success: true, quizzes: mergedQuizzes, stats: mergedStats };

        } catch (error) {
            console.error('Error migrating session to Firebase:', error);
            return { success: false, error: error.message };
        }
    }

    // Merge quizzes from session and Firebase (avoid duplicates)
    mergeQuizzes(sessionQuizzes, firebaseQuizzes) {
        // Ensure both parameters are arrays
        const session = Array.isArray(sessionQuizzes) ? sessionQuizzes : [];
        const firebase = Array.isArray(firebaseQuizzes) ? firebaseQuizzes : [];
        
        const merged = [...firebase];
        const existingIds = new Set(firebase.map(q => q.id));

        session.forEach(quiz => {
            if (!existingIds.has(quiz.id)) {
                // Mark as migrated from session
                quiz.migratedFromSession = true;
                quiz.migratedAt = Date.now();
                merged.push(quiz);
            }
        });

        return merged.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    }

    // Merge stats from session and Firebase
    mergeStats(sessionStats, firebaseStats) {
        // Ensure both parameters are objects
        const session = sessionStats || { quizCount: 0, totalPlays: 0 };
        const firebase = firebaseStats || { quizCount: 0, totalPlays: 0 };
        
        return {
            quizCount: (session.quizCount || 0) + (firebase.quizCount || 0),
            totalPlays: (session.totalPlays || 0) + (firebase.totalPlays || 0),
            lastUpdated: Date.now()
        };
    }

    // Get user data from Firebase
    async getFirebaseUserData(userId) {
        try {
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
            const snapshot = await database.ref(`users/${userId}/quizzes`).once('value');
            const quizzes = snapshot.val() || {};
            return Object.values(quizzes);
        } catch (error) {
            console.error('Error getting Firebase quizzes:', error);
            return [];
        }
    }

    // Save user data to Firebase
    async saveUserDataToFirebase(userId, userData) {
        try {
            await database.ref(`users/${userId}`).update(userData);
        } catch (error) {
            console.error('Error saving user data to Firebase:', error);
            throw error;
        }
    }

    // Save quiz to Firebase
    async saveQuizToFirebase(userId, quiz) {
        try {
            await database.ref(`users/${userId}/quizzes/${quiz.id}`).set({
                ...quiz,
                userId: userId,
                updatedAt: Date.now()
            });
        } catch (error) {
            console.error('Error saving quiz to Firebase:', error);
            throw error;
        }
    }

    // Clear temporary data
    clearTempData() {
        try {
            localStorage.removeItem('savedQuizzes');
            localStorage.removeItem(this.tempDataKey);
            console.log('Temporary data cleared');
        } catch (error) {
            console.error('Error clearing temp data:', error);
        }
    }

    // Load user data from Firebase when logged in
    async loadUserDataFromFirebase(user) {
        console.log('Loading user data from Firebase for:', user.email);
        
        try {
            const userData = await this.getFirebaseUserData(user.uid);
            const quizzes = await this.getFirebaseQuizzes(user.uid);

            // Update session data
            sessionData.quizzes = quizzes;
            sessionData.stats = userData.stats || { quizCount: 0, totalPlays: 0 };
            sessionData.userData = userData;
            sessionData.isGuest = false;
            sessionData.userId = user.uid;
            sessionData.userEmail = user.email;

            this.saveSession();

            console.log('User data loaded from Firebase:', { 
                quizzes: quizzes.length, 
                stats: sessionData.stats 
            });

            return { success: true, quizzes, userData };

        } catch (error) {
            console.error('Error loading user data from Firebase:', error);
            return { success: false, error: error.message };
        }
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
        
        // If user is logged in, also save to Firebase
        if (currentUser && !sessionData.isGuest) {
            this.saveQuizToFirebase(currentUser.uid, quiz).catch(console.error);
            this.updateUserStats(currentUser.uid, { quizCount: 1 }).catch(console.error);
        }
    }

    // Update user stats
    async updateUserStats(userId, statsUpdate) {
        try {
            const userStatsRef = database.ref(`users/${userId}/stats`);
            const snapshot = await userStatsRef.once('value');
            const currentStats = snapshot.val() || {};
            
            const updatedStats = {};
            Object.keys(statsUpdate).forEach(key => {
                updatedStats[key] = (currentStats[key] || 0) + statsUpdate[key];
            });
            
            await userStatsRef.update(updatedStats);
            
            // Update session stats too
            Object.keys(updatedStats).forEach(key => {
                sessionData.stats[key] = updatedStats[key];
            });
            this.saveSession();
            
        } catch (error) {
            console.error('Error updating user stats:', error);
        }
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
}

// Initialize session manager
const sessionManager = new SessionManager();

// Initialize session immediately when script loads
sessionManager.initializeSession();

// Authentication state management with session handling
auth.onAuthStateChanged(async (user) => {
    const wasGuest = sessionData.isGuest;
    currentUser = user;
    
    if (user) {
        console.log('User signed in:', user.email);
        
        // Store user info for easy access
        localStorage.setItem('userEmail', user.email);
        localStorage.setItem('userName', user.displayName || user.email);
        localStorage.setItem('userId', user.uid);
        
        // If user was a guest, migrate session data to Firebase
        if (wasGuest && sessionData.quizzes && sessionData.quizzes.length > 0) {
            console.log('Migrating guest session to user account...');
            const migrationResult = await sessionManager.migrateToFirebase(user);
            if (migrationResult.success) {
                console.log('Session migration successful');
                // Trigger refresh of any open quiz management pages
                window.dispatchEvent(new CustomEvent('userDataUpdated', { 
                    detail: { quizzes: migrationResult.quizzes, stats: migrationResult.stats }
                }));
            }
        } else {
            // Load existing user data from Firebase
            const loadResult = await sessionManager.loadUserDataFromFirebase(user);
            if (loadResult.success) {
                // Trigger refresh of any open quiz management pages
                window.dispatchEvent(new CustomEvent('userDataUpdated', { 
                    detail: { quizzes: loadResult.quizzes, userData: loadResult.userData }
                }));
            }
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

// Utility functions
function generateGamePin() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function generatePlayerId() {
    return Date.now().toString() + Math.floor(Math.random() * 1000).toString();
}

// Database reference helpers
function getGameRef(pin) {
    return database.ref(`games/${pin}`);
}

function getPlayersRef(pin) {
    return database.ref(`games/${pin}/players`);
}

function getQuestionsRef(pin) {
    return database.ref(`games/${pin}/questions`);
}

function getGameStateRef(pin) {
    return database.ref(`games/${pin}/gameState`);
}

// User-specific database references
function getUserQuizzesRef(userId) {
    return database.ref(`users/${userId}/quizzes`);
}

function getUserDataRef(userId) {
    return database.ref(`users/${userId}`);
}

function getUserStatsRef(userId) {
    return database.ref(`users/${userId}/stats`);
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

// Enhanced quiz management functions
async function saveQuizToSystem(quizData) {
    console.log('Saving quiz to system:', quizData.title);
    
    // Always save to session first
    sessionManager.addQuizToSession(quizData);
    
    // If user is logged in, also save to Firebase
    if (currentUser) {
        try {
            await sessionManager.saveQuizToFirebase(currentUser.uid, quizData);
            await sessionManager.updateUserStats(currentUser.uid, { quizCount: 1 });
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
    
    if (currentUser) {
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
    console.log('Deleting quiz:', quizId);
    
    // Remove from session
    sessionData.quizzes = sessionData.quizzes.filter(q => q.id !== quizId);
    sessionManager.saveSession();
    
    // If user is logged in, also delete from Firebase
    if (currentUser) {
        try {
            await database.ref(`users/${currentUser.uid}/quizzes/${quizId}`).remove();
            console.log('Quiz deleted from Firebase');
        } catch (error) {
            console.error('Failed to delete from Firebase:', error);
        }
    }
    
    return true;
}

// Sign out function
async function signOut() {
    try {
        await auth.signOut();
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

// Backward compatibility functions
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

// Export session manager for use in other files
window.sessionManager = sessionManager;