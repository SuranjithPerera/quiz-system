// Admin Dashboard JavaScript - Enhanced System Management
// FIXED: Removed duplicate variable declarations to avoid conflicts with config.js

let isAdmin = false;
let adminData = {
    users: [],
    quizzes: [],
    games: [],
    stats: {},
    systemLogs: []
};

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 ADMIN: Initializing admin dashboard...');
    initializeAdminDashboard();
});

async function initializeAdminDashboard() {
    showElement('loading-screen');
    hideElement('admin-content');
    hideElement('access-denied');
    
    try {
        // Wait for Firebase to be ready
        await waitForFirebase();
        
        // Check authentication - use global currentUser from config.js
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                console.log('👤 ADMIN: User authenticated:', user.email);
                // Use global currentUser from config.js instead of local variable
                window.currentUser = user;
                
                // Check admin privileges
                const hasAdminAccess = await checkAdminPrivileges(user);
                
                if (hasAdminAccess) {
                    console.log('✅ ADMIN: Admin access granted');
                    isAdmin = true;
                    await loadAdminDashboard();
                } else {
                    console.log('❌ ADMIN: Access denied - not an admin');
                    showAccessDenied();
                }
            } else {
                console.log('🚫 ADMIN: User not authenticated');
                // Redirect to auth page
                window.location.href = 'auth.html';
            }
        });
        
    } catch (error) {
        console.error('💥 ADMIN: Initialization failed:', error);
        showStatus('Failed to initialize admin dashboard', 'error');
        showAccessDenied();
    }
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
        
        // Load all data in parallel
        await Promise.all([
            loadUsers(),
            loadQuizzes(),
            loadGames(),
            loadSystemStats(),
            checkSystemHealth()
        ]);
        
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
        showStatus('Error loading dashboard: ' + error.message, 'error');
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
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    adminData.stats = {
        totalUsers: adminData.users.length,
        totalQuizzes: adminData.quizzes.length,
        totalGames: adminData.games.length,
        activeGames: adminData.games.filter(g => ['waiting', 'playing'].includes(g.gameState?.status)).length,
        newUsersToday: adminData.users.filter(u => u.createdAt > oneDayAgo).length,
        newUsersThisWeek: adminData.users.filter(u => u.createdAt > oneWeekAgo).length,
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

function setupRealTimeUpdates() {
    console.log('🔄 ADMIN: Setting up real-time updates...');
    
    // Listen for new games
    database.ref('games').on('child_added', (snapshot) => {
        const gameData = snapshot.val();
        adminData.games.push({
            gamePin: snapshot.key,
            ...gameData,
            playerCount: gameData.players ? Object.keys(gameData.players).length : 0
        });
        updateStatsCards();
        updateGamesTab();
    });
    
    // Listen for game changes
    database.ref('games').on('child_changed', (snapshot) => {
        const gameData = snapshot.val();
        const gameIndex = adminData.games.findIndex(g => g.gamePin === snapshot.key);
        if (gameIndex !== -1) {
            adminData.games[gameIndex] = {
                gamePin: snapshot.key,
                ...gameData,
                playerCount: gameData.players ? Object.keys(gameData.players).length : 0
            };
            updateStatsCards();
            updateGamesTab();
        }
    });
    
    // Listen for new users
    database.ref('users').on('child_added', (snapshot) => {
        const userData = snapshot.val();
        adminData.users.push({
            uid: snapshot.key,
            ...userData,
            quizCount: userData.quizzes ? Object.keys(userData.quizzes).length : 0
        });
        updateStatsCards();
        updateUsersTab();
    });
}

function updateStatsCards() {
    loadSystemStats().then(() => {
        document.getElementById('total-users').textContent = adminData.stats.totalUsers;
        document.getElementById('total-quizzes').textContent = adminData.stats.totalQuizzes;
        document.getElementById('total-games').textContent = adminData.stats.totalGames;
        document.getElementById('active-games').textContent = adminData.stats.activeGames;
    });
}

function updateOverviewTab() {
    updateRecentActivity();
    updateTopUsers();
}

function updateRecentActivity() {
    const activityList = document.getElementById('recent-activity');
    const activities = [];
    
    // Recent games
    adminData.games
        .filter(g => g.createdAt)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 5)
        .forEach(game => {
            activities.push({
                action: `Game ${game.gamePin} created`,
                time: game.createdAt,
                type: 'game'
            });
        });
    
    // Recent users
    adminData.users
        .filter(u => u.createdAt)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 3)
        .forEach(user => {
            activities.push({
                action: `${user.displayName || user.email} joined`,
                time: user.createdAt,
                type: 'user'
            });
        });
    
    // Sort by time
    activities.sort((a, b) => b.time - a.time);
    
    activityList.innerHTML = activities.slice(0, 8).map(activity => `
        <div class="activity-item">
            <span class="activity-action">${activity.action}</span>
            <span class="activity-time">${formatTimeAgo(activity.time)}</span>
        </div>
    `).join('') || '<div class="loading-item">No recent activity</div>';
}

function updateTopUsers() {
    const topUsersList = document.getElementById('top-users');
    
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
                <button class="action-btn warning" onclick="resetUserData('${user.uid}')">Reset</button>
                <button class="action-btn danger" onclick="deleteUser('${user.uid}')">Delete</button>
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
            <div class="quiz-actions-admin">
                <button class="action-btn" onclick="viewQuizDetails('${quiz.id}')">View</button>
                <button class="action-btn warning" onclick="editQuiz('${quiz.id}')">Edit</button>
                <button class="action-btn danger" onclick="deleteQuiz('${quiz.id}', '${quiz.userId}')">Delete</button>
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
                <div>Quiz: ${game.quiz?.title || 'Unknown'}</div>
                <div>Players: ${game.playerCount}</div>
                <div>Created: ${formatDate(game.createdAt)}</div>
            </div>
            <div>
                <span class="game-status-admin ${game.gameState?.status || 'unknown'}">
                    ${(game.gameState?.status || 'unknown').toUpperCase()}
                </span>
            </div>
            <div>
                <button class="action-btn" onclick="viewGameDetails('${game.gamePin}')">View</button>
                <button class="action-btn danger" onclick="endGame('${game.gamePin}')">End</button>
            </div>
        </div>
    `).join('');
}

function updateSystemTab() {
    updateSystemLogs();
}

function updateSystemLogs() {
    const logsContainer = document.getElementById('system-logs');
    
    // Mock system logs for demo
    const logs = [
        { timestamp: Date.now(), level: 'info', message: 'Admin dashboard loaded successfully' },
        { timestamp: Date.now() - 300000, level: 'warn', message: 'High memory usage detected' },
        { timestamp: Date.now() - 600000, level: 'info', message: 'Database backup completed' },
        { timestamp: Date.now() - 900000, level: 'error', message: 'Failed to send notification email' },
        { timestamp: Date.now() - 1200000, level: 'info', message: 'System startup completed' }
    ];
    
    logsContainer.innerHTML = logs.map(log => `
        <div class="log-entry">
            <span class="log-timestamp">[${formatTime(log.timestamp)}]</span>
            <span class="log-level ${log.level}">${log.level.toUpperCase()}</span>
            <span class="log-message">${log.message}</span>
        </div>
    `).join('');
}

// Tab Management
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabName + '-tab').classList.add('active');
    
    console.log('📑 ADMIN: Switched to', tabName, 'tab');
}

// Filter Functions
function filterUsers() {
    const searchTerm = document.getElementById('user-search').value.toLowerCase();
    const rows = document.querySelectorAll('#users-table-body tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

function filterQuizzes() {
    const searchTerm = document.getElementById('quiz-search').value.toLowerCase();
    const cards = document.querySelectorAll('.quiz-card-admin');
    
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

function filterGames() {
    const statusFilter = document.getElementById('game-status-filter').value;
    const games = document.querySelectorAll('.game-item');
    
    games.forEach(game => {
        const status = game.querySelector('.game-status-admin').textContent.toLowerCase();
        if (statusFilter === 'all' || status.includes(statusFilter)) {
            game.style.display = '';
        } else {
            game.style.display = 'none';
        }
    });
}

// Action Functions
async function viewUserDetails(userId) {
    const user = adminData.users.find(u => u.uid === userId);
    if (!user) return;
    
    const content = `
        <h3>User Information</h3>
        <p><strong>Name:</strong> ${user.displayName || 'Not set'}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>User ID:</strong> ${user.uid}</p>
        <p><strong>Joined:</strong> ${formatDate(user.createdAt)}</p>
        <p><strong>Last Login:</strong> ${formatDate(user.lastLogin)}</p>
        <p><strong>Quiz Count:</strong> ${user.quizCount}</p>
        <p><strong>Total Plays:</strong> ${user.totalPlays || 0}</p>
    `;
    
    document.getElementById('user-details-content').innerHTML = content;
    showModal('user-details-modal');
}

async function resetUserData(userId) {
    if (!confirm('Are you sure you want to reset this user\'s data? This will delete all their quizzes.')) {
        return;
    }
    
    try {
        showStatus('Resetting user data...', 'info');
        
        // Reset user data in Firebase
        await database.ref(`users/${userId}/quizzes`).remove();
        await database.ref(`users/${userId}/stats`).set({
            quizCount: 0,
            totalPlays: 0
        });
        
        // Update local data
        const userIndex = adminData.users.findIndex(u => u.uid === userId);
        if (userIndex !== -1) {
            adminData.users[userIndex].quizCount = 0;
            adminData.users[userIndex].quizzes = {};
        }
        
        // Remove user's quizzes from admin data
        adminData.quizzes = adminData.quizzes.filter(q => q.userId !== userId);
        
        updateUsersTab();
        updateQuizzesTab();
        updateStatsCards();
        
        showStatus('User data reset successfully', 'success');
        
    } catch (error) {
        console.error('💥 ADMIN: Error resetting user data:', error);
        showStatus('Error resetting user data: ' + error.message, 'error');
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to permanently delete this user? This action cannot be undone.')) {
        return;
    }
    
    try {
        showStatus('Deleting user...', 'info');
        
        // Delete user data from Firebase
        await database.ref(`users/${userId}`).remove();
        
        // Update local data
        adminData.users = adminData.users.filter(u => u.uid !== userId);
        adminData.quizzes = adminData.quizzes.filter(q => q.userId !== userId);
        
        updateUsersTab();
        updateQuizzesTab();
        updateStatsCards();
        
        showStatus('User deleted successfully', 'success');
        
    } catch (error) {
        console.error('💥 ADMIN: Error deleting user:', error);
        showStatus('Error deleting user: ' + error.message, 'error');
    }
}

async function viewQuizDetails(quizId) {
    const quiz = adminData.quizzes.find(q => q.id === quizId);
    if (!quiz) return;
    
    const content = `
        <h3>${quiz.title}</h3>
        <p><strong>Creator:</strong> ${quiz.userName}</p>
        <p><strong>Questions:</strong> ${quiz.questions?.length || 0}</p>
        <p><strong>Created:</strong> ${formatDate(quiz.createdAt)}</p>
        <p><strong>Updated:</strong> ${formatDate(quiz.updatedAt)}</p>
        <h4>Questions Preview:</h4>
        ${quiz.questions?.slice(0, 3).map((q, i) => `
            <p><strong>Q${i + 1}:</strong> ${q.question}</p>
        `).join('') || '<p>No questions found</p>'}
    `;
    
    document.getElementById('quiz-details-content').innerHTML = content;
    showModal('quiz-details-modal');
}

async function editQuiz(quizId) {
    showStatus('Edit functionality not implemented yet', 'info');
}

async function deleteQuiz(quizId, userId) {
    if (!confirm('Are you sure you want to delete this quiz?')) {
        return;
    }
    
    try {
        showStatus('Deleting quiz...', 'info');
        
        // Delete quiz from Firebase
        await database.ref(`users/${userId}/quizzes/${quizId}`).remove();
        
        // Update local data
        adminData.quizzes = adminData.quizzes.filter(q => q.id !== quizId);
        
        const userIndex = adminData.users.findIndex(u => u.uid === userId);
        if (userIndex !== -1) {
            adminData.users[userIndex].quizCount--;
        }
        
        updateQuizzesTab();
        updateUsersTab();
        updateStatsCards();
        
        showStatus('Quiz deleted successfully', 'success');
        
    } catch (error) {
        console.error('💥 ADMIN: Error deleting quiz:', error);
        showStatus('Error deleting quiz: ' + error.message, 'error');
    }
}

async function viewGameDetails(gamePin) {
    showStatus('Game details functionality not implemented yet', 'info');
}

async function endGame(gamePin) {
    if (!confirm('Are you sure you want to end this game?')) {
        return;
    }
    
    try {
        showStatus('Ending game...', 'info');
        
        // End game in Firebase
        await database.ref(`games/${gamePin}/gameState`).update({
            status: 'finished',
            endedAt: Date.now(),
            endReason: 'admin_ended'
        });
        
        // Update local data
        const gameIndex = adminData.games.findIndex(g => g.gamePin === gamePin);
        if (gameIndex !== -1) {
            adminData.games[gameIndex].gameState.status = 'finished';
        }
        
        updateGamesTab();
        updateStatsCards();
        
        showStatus('Game ended successfully', 'success');
        
    } catch (error) {
        console.error('💥 ADMIN: Error ending game:', error);
        showStatus('Error ending game: ' + error.message, 'error');
    }
}

// System Management Functions
async function cleanupOldGames() {
    if (!confirm('This will remove games older than 24 hours. Continue?')) {
        return;
    }
    
    try {
        showStatus('Cleaning up old games...', 'info');
        
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const oldGames = adminData.games.filter(g => 
            g.createdAt < oneDayAgo && 
            g.gameState?.status === 'finished'
        );
        
        for (const game of oldGames) {
            await database.ref(`games/${game.gamePin}`).remove();
        }
        
        adminData.games = adminData.games.filter(g => !oldGames.includes(g));
        updateGamesTab();
        updateStatsCards();
        
        showStatus(`Cleaned up ${oldGames.length} old games`, 'success');
        
    } catch (error) {
        console.error('💥 ADMIN: Error cleaning up games:', error);
        showStatus('Error cleaning up games: ' + error.message, 'error');
    }
}

async function removeInactiveUsers() {
    if (!confirm('This will remove users inactive for 30+ days. Continue?')) {
        return;
    }
    
    try {
        showStatus('Removing inactive users...', 'info');
        
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const inactiveUsers = adminData.users.filter(u => 
            (u.lastLogin || u.createdAt) < thirtyDaysAgo &&
            u.quizCount === 0
        );
        
        for (const user of inactiveUsers) {
            await database.ref(`users/${user.uid}`).remove();
        }
        
        adminData.users = adminData.users.filter(u => !inactiveUsers.includes(u));
        updateUsersTab();
        updateStatsCards();
        
        showStatus(`Removed ${inactiveUsers.length} inactive users`, 'success');
        
    } catch (error) {
        console.error('💥 ADMIN: Error removing inactive users:', error);
        showStatus('Error removing inactive users: ' + error.message, 'error');
    }
}

// Export Functions
function exportUserData() {
    const data = adminData.users.map(user => ({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        createdAt: formatDate(user.createdAt),
        lastLogin: formatDate(user.lastLogin),
        quizCount: user.quizCount
    }));
    
    downloadJSON(data, 'users_export.json');
    showStatus('User data exported successfully', 'success');
}

function exportQuizData() {
    const data = adminData.quizzes.map(quiz => ({
        id: quiz.id,
        title: quiz.title,
        creator: quiz.userName,
        questions: quiz.questions?.length || 0,
        createdAt: formatDate(quiz.createdAt)
    }));
    
    downloadJSON(data, 'quizzes_export.json');
    showStatus('Quiz data exported successfully', 'success');
}

function exportGameData() {
    const data = adminData.games.map(game => ({
        gamePin: game.gamePin,
        quizTitle: game.quiz?.title,
        playerCount: game.playerCount,
        status: game.gameState?.status,
        createdAt: formatDate(game.createdAt)
    }));
    
    downloadJSON(data, 'games_export.json');
    showStatus('Game data exported successfully', 'success');
}

// Utility Functions
function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function formatDate(timestamp) {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleDateString() + ' ' + new Date(timestamp).toLocaleTimeString();
}

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString();
}

function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Never';
    
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

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

// System broadcast and maintenance (placeholder functions)
function broadcastMessage() {
    const message = prompt('Enter message to broadcast to all users:');
    if (message) {
        showStatus(`Broadcasting: "${message}"`, 'info');
        // Implementation would send message to all connected clients
    }
}

function maintenanceMode() {
    if (confirm('Enable maintenance mode? This will prevent new games from starting.')) {
        showStatus('Maintenance mode enabled', 'warning');
        // Implementation would set maintenance flag in database
    }
}

console.log('🔧 ADMIN: Enhanced admin dashboard script loaded successfully');
