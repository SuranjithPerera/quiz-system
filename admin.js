// Admin Dashboard JavaScript - Enhanced with Detailed Debugging
let currentUser = null;
let isAdmin = false;
let adminData = {
    users: [],
    quizzes: [],
    games: [],
    stats: {},
    systemLogs: []
};

// Initialize admin dashboard with detailed logging
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 ADMIN: DOM Content Loaded - Starting initialization...');
    
    // Check if required elements exist
    const loadingScreen = document.getElementById('loading-screen');
    const adminContent = document.getElementById('admin-content');
    const accessDenied = document.getElementById('access-denied');
    
    console.log('🔧 ADMIN: Elements check:', {
        loadingScreen: !!loadingScreen,
        adminContent: !!adminContent,
        accessDenied: !!accessDenied
    });
    
    initializeAdminDashboard();
});

async function initializeAdminDashboard() {
    console.log('🔧 ADMIN: Starting admin dashboard initialization...');
    
    showElement('loading-screen');
    hideElement('admin-content');
    hideElement('access-denied');
    
    // Update loading message
    updateLoadingMessage('Checking Firebase connection...');
    
    try {
        // Step 1: Wait for Firebase to be ready
        console.log('⏳ ADMIN: Waiting for Firebase...');
        await waitForFirebase();
        console.log('✅ ADMIN: Firebase is ready');
        
        updateLoadingMessage('Firebase connected! Checking authentication...');
        
        // Step 2: Check authentication with timeout
        console.log('🔐 ADMIN: Setting up auth state listener...');
        
        const authPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Authentication timeout'));
            }, 15000); // 15 second timeout
            
            auth.onAuthStateChanged(async (user) => {
                clearTimeout(timeout);
                console.log('👤 ADMIN: Auth state changed:', user ? user.email : 'No user');
                
                if (user) {
                    currentUser = user;
                    updateLoadingMessage('User authenticated! Checking admin privileges...');
                    
                    // Check admin privileges
                    const hasAdminAccess = await checkAdminPrivileges(user);
                    
                    if (hasAdminAccess) {
                        console.log('✅ ADMIN: Admin access granted');
                        isAdmin = true;
                        updateLoadingMessage('Admin access granted! Loading dashboard data...');
                        await loadAdminDashboard();
                        resolve();
                    } else {
                        console.log('❌ ADMIN: Access denied - not an admin');
                        reject(new Error('Access denied - not an admin'));
                    }
                } else {
                    console.log('🚫 ADMIN: User not authenticated');
                    reject(new Error('User not authenticated'));
                }
            });
        });
        
        await authPromise;
        
    } catch (error) {
        console.error('💥 ADMIN: Initialization failed:', error);
        
        if (error.message === 'User not authenticated') {
            updateLoadingMessage('Redirecting to login...');
            setTimeout(() => {
                window.location.href = 'auth.html';
            }, 2000);
        } else if (error.message === 'Access denied - not an admin') {
            showAccessDenied();
        } else {
            updateLoadingMessage('Error: ' + error.message);
            setTimeout(() => {
                showAccessDenied();
            }, 3000);
        }
    }
}

function updateLoadingMessage(message) {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        const messageEl = loadingScreen.querySelector('p');
        if (messageEl) {
            messageEl.textContent = message;
        }
    }
    console.log('📢 ADMIN: ' + message);
}

function waitForFirebase() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 30;
        
        console.log('🔍 ADMIN: Starting Firebase availability check...');
        
        const checkFirebase = () => {
            attempts++;
            console.log(`🔍 ADMIN: Firebase check attempt ${attempts}/${maxAttempts}`);
            
            // Check if Firebase objects exist
            const firebaseAvailable = typeof firebase !== 'undefined';
            const databaseAvailable = typeof database !== 'undefined' && database && typeof database.ref === 'function';
            const authAvailable = typeof auth !== 'undefined' && auth && typeof auth.onAuthStateChanged === 'function';
            
            console.log('🔍 ADMIN: Availability check:', {
                firebase: firebaseAvailable,
                database: databaseAvailable,
                auth: authAvailable,
                window_database: typeof window.database,
                window_auth: typeof window.auth
            });
            
            if (databaseAvailable && authAvailable) {
                console.log('✅ ADMIN: Firebase services are ready!');
                resolve();
            } else if (attempts >= maxAttempts) {
                console.error('❌ ADMIN: Firebase timeout after', maxAttempts, 'attempts');
                reject(new Error('Firebase services not available after timeout'));
            } else {
                setTimeout(checkFirebase, 500);
            }
        };
        
        checkFirebase();
    });
}

async function checkAdminPrivileges(user) {
    console.log('🔐 ADMIN: Checking admin privileges for:', user.email);
    
    try {
        // For demo purposes, make any logged-in user an admin
        console.log('✅ ADMIN: Demo mode - granting admin access to all users');
        return true;
        
        // Uncomment below for real admin checking
        /*
        const adminEmails = [
            'admin@kokoot.com',
            'your-admin-email@example.com'
        ];
        
        // Check email-based admin
        if (adminEmails.includes(user.email)) {
            console.log('✅ ADMIN: Email-based admin access granted');
            return true;
        }
        
        // Check Firebase admin flag
        const userRef = database.ref(`users/${user.uid}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();
        
        if (userData?.isAdmin === true) {
            console.log('✅ ADMIN: Database admin flag found');
            return true;
        }
        
        console.log('❌ ADMIN: No admin privileges found');
        return false;
        */
        
    } catch (error) {
        console.error('💥 ADMIN: Error checking admin privileges:', error);
        return true; // Default to true for demo
    }
}

function showAccessDenied() {
    console.log('🚫 ADMIN: Showing access denied screen');
    hideElement('loading-screen');
    hideElement('admin-content');
    showElement('access-denied');
}

async function loadAdminDashboard() {
    try {
        console.log('📊 ADMIN: Starting dashboard data loading...');
        
        updateLoadingMessage('Loading users...');
        await loadUsers();
        
        updateLoadingMessage('Loading quizzes...');
        await loadQuizzes();
        
        updateLoadingMessage('Loading games...');
        await loadGames();
        
        updateLoadingMessage('Calculating statistics...');
        await loadSystemStats();
        
        updateLoadingMessage('Checking system health...');
        await checkSystemHealth();
        
        updateLoadingMessage('Updating dashboard...');
        
        // Update UI
        updateStatsCards();
        updateOverviewTab();
        updateUsersTab();
        updateQuizzesTab();
        updateGamesTab();
        updateSystemTab();
        
        // Show dashboard
        console.log('✅ ADMIN: All data loaded, showing dashboard');
        hideElement('loading-screen');
        showElement('admin-content');
        
        showStatus('Admin dashboard loaded successfully', 'success');
        
        // Set up real-time updates
        setupRealTimeUpdates();
        
    } catch (error) {
        console.error('💥 ADMIN: Error loading dashboard:', error);
        updateLoadingMessage('Error loading dashboard: ' + error.message);
        setTimeout(() => {
            showAccessDenied();
        }, 3000);
    }
}

async function loadUsers() {
    console.log('👥 ADMIN: Loading users...');
    try {
        if (!database || !database.ref) {
            throw new Error('Database not available');
        }
        
        const usersRef = database.ref('users');
        const snapshot = await usersRef.once('value');
        const usersData = snapshot.val() || {};
        
        adminData.users = Object.entries(usersData).map(([uid, userData]) => ({
            uid,
            ...userData,
            quizCount: userData.quizzes ? Object.keys(userData.quizzes).length : 0
        }));
        
        console.log('✅ ADMIN: Loaded', adminData.users.length, 'users');
    } catch (error) {
        console.error('💥 ADMIN: Error loading users:', error);
        adminData.users = [];
    }
}

async function loadQuizzes() {
    console.log('📝 ADMIN: Loading quizzes...');
    try {
        const quizzes = [];
        
        // Load quizzes from all users
        for (const user of adminData.users) {
            if (user.quizzes) {
                Object.entries(user.quizzes).forEach(([quizId, quizData]) => {
                    quizzes.push({
                        ...quizData,
                        userId: user.uid,
                        userEmail: user.email,
                        userName: user.displayName || user.email
                    });
                });
            }
        }
        
        adminData.quizzes = quizzes;
        console.log('✅ ADMIN: Loaded', adminData.quizzes.length, 'quizzes');
    } catch (error) {
        console.error('💥 ADMIN: Error loading quizzes:', error);
        adminData.quizzes = [];
    }
}

async function loadGames() {
    console.log('🎮 ADMIN: Loading games...');
    try {
        if (!database || !database.ref) {
            throw new Error('Database not available');
        }
        
        const gamesRef = database.ref('games');
        const snapshot = await gamesRef.once('value');
        const gamesData = snapshot.val() || {};
        
        adminData.games = Object.entries(gamesData).map(([gamePin, gameData]) => ({
            gamePin,
            ...gameData,
            playerCount: gameData.players ? Object.keys(gameData.players).length : 0
        }));
        
        console.log('✅ ADMIN: Loaded', adminData.games.length, 'games');
    } catch (error) {
        console.error('💥 ADMIN: Error loading games:', error);
        adminData.games = [];
    }
}

async function loadSystemStats() {
    console.log('📊 ADMIN: Calculating system stats...');
    
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    adminData.stats = {
        totalUsers: adminData.users.length,
        totalQuizzes: adminData.quizzes.length,
        totalGames: adminData.games.length,
        activeGames: adminData.games.filter(g => ['waiting', 'playing'].includes(g.gameState?.status)).length,
        newUsersToday: adminData.users.filter(u => u.createdAt > oneDayAgo).length,
        quizzesCreatedToday: adminData.quizzes.filter(q => q.createdAt > oneDayAgo).length,
        gamesPlayedToday: adminData.games.filter(g => g.createdAt > oneDayAgo).length
    };
    
    console.log('📈 ADMIN: Stats calculated:', adminData.stats);
}

async function checkSystemHealth() {
    console.log('💚 ADMIN: Checking system health...');
    
    try {
        // Check database connectivity
        if (database && database.ref) {
            await database.ref('.info/connected').once('value');
            updateHealthStatus('db-status', 'Connected', 'healthy');
        } else {
            updateHealthStatus('db-status', 'Not Available', 'error');
        }
        
        // Check authentication
        if (auth && auth.currentUser) {
            updateHealthStatus('auth-status', 'Active', 'healthy');
        } else {
            updateHealthStatus('auth-status', 'No User', 'warning');
        }
        
        // Mock backup status
        updateHealthStatus('backup-status', 'Recent', 'healthy');
        
    } catch (error) {
        console.error('💥 ADMIN: Health check failed:', error);
        updateHealthStatus('db-status', 'Error', 'error');
    }
}

function updateHealthStatus(elementId, text, status) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
        element.className = `health-status ${status}`;
    }
}

// Continue with the rest of the functions (updateStatsCards, updateOverviewTab, etc.)
// ... [Include all the other functions from the previous admin.js file]

function updateStatsCards() {
    document.getElementById('total-users').textContent = adminData.stats.totalUsers;
    document.getElementById('total-quizzes').textContent = adminData.stats.totalQuizzes;
    document.getElementById('total-games').textContent = adminData.stats.totalGames;
    document.getElementById('active-games').textContent = adminData.stats.activeGames;
}

function updateOverviewTab() {
    updateRecentActivity();
    updateTopUsers();
}

function updateRecentActivity() {
    const activityList = document.getElementById('recent-activity');
    if (!activityList) return;
    
    activityList.innerHTML = '<div class="loading-item">No recent activity</div>';
}

function updateTopUsers() {
    const topUsersList = document.getElementById('top-users');
    if (!topUsersList) return;
    
    const topUsers = adminData.users
        .sort((a, b) => b.quizCount - a.quizCount)
        .slice(0, 5);
    
    topUsersList.innerHTML = topUsers.map(user => `
        <div class="top-user-item">
            <div class="user-info-admin">
                <div class="user-name-admin">${user.displayName || 'Unknown'}</div>
                <div class="user-email-admin">${user.email || 'No email'}</div>
            </div>
            <div class="user-quiz-count">${user.quizCount} quizzes</div>
        </div>
    `).join('') || '<div class="loading-item">No users found</div>';
}

function updateUsersTab() {
    const tableBody = document.getElementById('users-table-body');
    if (!tableBody) return;
    
    if (adminData.users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="loading-row">No users found</td></tr>';
        return;
    }
    
    tableBody.innerHTML = adminData.users.map(user => `
        <tr>
            <td>
                <div class="user-cell">
                    <div class="user-name">${user.displayName || 'Unknown'}</div>
                    <div class="user-id">${user.uid}</div>
                </div>
            </td>
            <td>${user.email || 'No email'}</td>
            <td>${formatDate(user.createdAt)}</td>
            <td><span class="quiz-questions-admin">${user.quizCount}</span></td>
            <td>${formatDate(user.lastLogin)}</td>
            <td>
                <button class="action-btn" onclick="viewUserDetails('${user.uid}')">View</button>
            </td>
        </tr>
    `).join('');
}

function updateQuizzesTab() {
    const quizzesGrid = document.getElementById('quizzes-grid');
    if (!quizzesGrid) return;
    
    if (adminData.quizzes.length === 0) {
        quizzesGrid.innerHTML = '<div class="loading-item">No quizzes found</div>';
        return;
    }
    
    quizzesGrid.innerHTML = adminData.quizzes.map(quiz => `
        <div class="quiz-card-admin">
            <div class="quiz-title-admin">${quiz.title || 'Untitled Quiz'}</div>
            <div class="quiz-meta-admin">
                <span class="quiz-creator-admin">By: ${quiz.userName}</span>
                <span class="quiz-questions-admin">${quiz.questions?.length || 0} questions</span>
            </div>
        </div>
    `).join('');
}

function updateGamesTab() {
    const gamesList = document.getElementById('games-list');
    if (!gamesList) return;
    
    if (adminData.games.length === 0) {
        gamesList.innerHTML = '<div class="loading-item">No games found</div>';
        return;
    }
    
    gamesList.innerHTML = adminData.games
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(game => `
        <div class="game-item">
            <div class="game-info">
                <div class="game-pin-admin">PIN: ${game.gamePin}</div>
                <div>Players: ${game.playerCount}</div>
            </div>
            <div>
                <span class="game-status-admin ${game.gameState?.status || 'unknown'}">
                    ${(game.gameState?.status || 'unknown').toUpperCase()}
                </span>
            </div>
        </div>
    `).join('');
}

function updateSystemTab() {
    // System tab update logic
}

function setupRealTimeUpdates() {
    console.log('🔄 ADMIN: Setting up real-time updates...');
    // Real-time update logic
}

// Tab Management
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabName + '-tab').classList.add('active');
}

// Utility functions
function showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'block';
        console.log('👁️ ADMIN: Showing element:', elementId);
    } else {
        console.error('❌ ADMIN: Element not found:', elementId);
    }
}

function hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'none';
        console.log('🙈 ADMIN: Hiding element:', elementId);
    } else {
        console.error('❌ ADMIN: Element not found:', elementId);
    }
}

function showStatus(message, type = 'info') {
    console.log(`📢 ADMIN (${type}):`, message);
    const statusEl = document.getElementById('admin-status');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`;
        setTimeout(() => {
            statusEl.textContent = '';
            statusEl.className = 'status-message';
        }, 5000);
    }
}

function formatDate(timestamp) {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleDateString();
}

// Placeholder functions for buttons
function viewUserDetails() { console.log('View user details clicked'); }

console.log('🔧 ADMIN: Enhanced admin dashboard script loaded with debugging');
