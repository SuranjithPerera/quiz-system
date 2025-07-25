// Kokoot – Admin Dashboard (UPDATED FOR ALL USERS)
// Shows every game's players (name + score), accessible to all logged-in users

/************ CONFIG SECTION ************/
const SESSION_KEY = "kokoot_admin_session";
const SESSION_MINUTES = 60; // 1h

/************ GLOBAL STATE ************/
let adminData = { games: [], stats: {} };

/* ---------- helpers for session ---------- */
function saveSession(uid, email) {
    const data = { uid, email, exp: Date.now() + SESSION_MINUTES * 60 * 1000 };
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

function hasValidSession() {
    try {
        const d = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
        return d && Date.now() < d.exp;
    } catch { 
        return false; 
    }
}

function clearSession() { 
    localStorage.removeItem(SESSION_KEY); 
}

/* ---------- DOM helpers ---------- */
const $ = id => document.getElementById(id);
function show(id) { $(id).style.display = 'block'; }
function hide(id) { $(id).style.display = 'none'; }
function toast(msg, type = 'info') {
    const el = $('admin-status'); 
    if (!el) return;
    el.textContent = msg; 
    el.className = 'status-message ' + type;
    setTimeout(() => {
        el.textContent = ''; 
        el.className = 'status-message';
    }, 5000);
}

/* ---------- wait until firebase ready ---------- */
function waitFirebase() {
    return new Promise((res, rej) => {
        let tries = 0; 
        (function check() {
            if (typeof database !== 'undefined' && typeof auth !== 'undefined') return res();
            if (++tries > 30) return rej(new Error('Firebase not available'));
            setTimeout(check, 250);
        })();
    });
}

/* ---------- UPDATED: Allow any logged-in user ---------- */
async function isAdminUser(user) {
    // Return true for ANY authenticated user
    return !!user;
}

/* ---------- bootstrap ---------- */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔧 ADMIN: Starting admin dashboard for all users...');
    show('loading-screen');
    await waitFirebase().catch(() => location.href = 'index.html');

    if (hasValidSession() && auth.currentUser) {
        initDashboard();
    } else {
        auth.onAuthStateChanged(async user => {
            if (!user) { 
                clearSession(); 
                showDenied();
                return;
            }
            if (await isAdminUser(user)) {
                saveSession(user.uid, user.email); 
                initDashboard();
            } else {
                clearSession(); 
                showDenied();
            }
        });
    }
});

/* ---------- access denied screen ---------- */
function showDenied() {
    hide('loading-screen'); 
    hide('admin-content'); 
    show('access-denied');
}

/* ---------- dashboard load ---------- */
async function initDashboard() {
    try {
        await loadGames();        
        calcStats();              
        renderStats();
        renderGames();
        hide('loading-screen'); 
        show('admin-content');
        toast('Admin dashboard ready', 'success');
        realTimeGames();
    } catch (e) {
        console.error(e);
        toast('Error loading dashboard', 'error');
    }
}

/* ---------- load all games & players ---------- */
async function loadGames() {
    adminData.games = [];
    const snap = await database.ref('games').once('value');
    const obj = snap.val() || {};
    Object.entries(obj).forEach(([pin, data]) => {
        adminData.games.push({
            gamePin: pin,
            quiz: data.quiz || {},
            gameState: data.gameState || {},
            createdAt: data.createdAt || 0,
            players: data.players ? Object.values(data.players) : [],
            playerCount: data.players ? Object.keys(data.players).length : 0
        });
    });
}

/* ---------- compute quick stats ---------- */
function calcStats() {
    adminData.stats.totalGames = adminData.games.length;
    adminData.stats.activeGames = adminData.games.filter(g => ['waiting', 'playing'].includes(g.gameState.status)).length;
}

/* ---------- render quick stats ---------- */
function renderStats() {
    $('total-games').textContent = adminData.stats.totalGames;
    $('active-games').textContent = adminData.stats.activeGames;
}

/* ---------- render list of games ---------- */
function renderGames() {
    const list = $('games-list');
    if (!list) return;
    if (adminData.games.length === 0) {
        list.innerHTML = '<div class="loading-item">No games found</div>'; 
        return;
    }
    adminData.games.sort((a, b) => b.createdAt - a.createdAt);
    list.innerHTML = adminData.games.map(g => `
        <div class="game-item">
            <div class="game-info">
                <div class="game-pin-admin">PIN: ${g.gamePin}</div>
                <div>Quiz: ${g.quiz.title || 'Untitled'}</div>
                <div>Players: ${g.playerCount}</div>
                <div>Created: ${fmtDate(g.createdAt)}</div>
            </div>
            <div><span class="game-status-admin ${g.gameState.status || 'unknown'}">${(g.gameState.status || 'unknown').toUpperCase()}</span></div>
            <div>
                <button class="action-btn" onclick="viewPlayers('${g.gamePin}')">View Players</button>
                <button class="action-btn danger" onclick="endGame('${g.gamePin}')">End</button>
            </div>
        </div>
    `).join('');
}

/* ---------- show players modal ---------- */
window.viewPlayers = gamePin => {
    const g = adminData.games.find(x => x.gamePin === gamePin);
    if (!g) { 
        toast('Game not found', 'error'); 
        return; 
    }
    let html = `<h3 style="margin-top:0">Players – Game ${gamePin}</h3>`;
    if (g.playerCount === 0) {
        html += '<p>No players joined this game.</p>';
    } else {
        html += `<table>
            <tr>
                <th>Player Name</th>
                <th>Score</th>
                <th>Status</th>
            </tr>` +
            g.players.map(p => `
                <tr>
                    <td>${p.name || '?'}</td>
                    <td style="text-align:center; font-weight:bold;">${p.score || 0}</td>
                    <td>${p.status || 'waiting'}</td>
                </tr>
            `).join('') +
            '</table>';
    }
    $('players-content').innerHTML = html;
    show('players-modal');
};

window.closeModal = id => hide(id);

/* ---------- end game ---------- */
window.endGame = async pin => {
    if (!confirm('End game ' + pin + ' ?')) return;
    try {
        await database.ref('games/' + pin + '/gameState').update({
            status: 'finished', 
            endedAt: Date.now(), 
            endReason: 'admin'
        });
        toast('Game ended', 'success');
    } catch (e) { 
        console.error(e); 
        toast('Error', 'error'); 
    }
};

/* ---------- real-time updates without duplicates ---------- */
function realTimeGames() {
    let first = true;
    const ref = database.ref('games');
    ref.on('child_added', snap => {
        if (first) return;          
        const pin = snap.key, data = snap.val();
        if (adminData.games.find(g => g.gamePin === pin)) return;      
        adminData.games.unshift({
            gamePin: pin, 
            quiz: data.quiz || {}, 
            gameState: data.gameState || {},
            createdAt: data.createdAt || 0,
            players: data.players ? Object.values(data.players) : [], 
            playerCount: data.players ? Object.keys(data.players).length : 0
        });
        calcStats(); 
        renderStats(); 
        renderGames();
    });
    ref.on('child_changed', snap => {
        const pin = snap.key, data = snap.val();
        const idx = adminData.games.findIndex(g => g.gamePin === pin);
        if (idx > -1) {
            adminData.games[idx] = { 
                gamePin: pin, 
                quiz: data.quiz || {}, 
                gameState: data.gameState || {},
                createdAt: data.createdAt || 0,
                players: data.players ? Object.values(data.players) : [], 
                playerCount: data.players ? Object.keys(data.players).length : 0
            };
            calcStats(); 
            renderStats(); 
            renderGames();
        }
    });
    ref.on('child_removed', snap => {
        adminData.games = adminData.games.filter(g => g.gamePin !== snap.key);
        calcStats(); 
        renderStats(); 
        renderGames();
    });
    setTimeout(() => { first = false; }, 1500);   
}

/* ---------- filter games ---------- */
window.filterGames = () => {
    const statusFilter = $('game-status-filter').value;
    const games = document.querySelectorAll('.game-item');
    
    games.forEach(game => {
        const status = game.querySelector('.game-status-admin').textContent.toLowerCase();
        if (statusFilter === 'all' || status.includes(statusFilter)) {
            game.style.display = '';
        } else {
            game.style.display = 'none';
        }
    });
};

/* ---------- tab helper ---------- */
window.switchTab = name => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    event.target.classList.add('active');
    $(name + '-tab').classList.add('active');
};

/* ---------- util ---------- */
function fmtDate(ts) { 
    if (!ts) return '—'; 
    const d = new Date(ts); 
    return d.toLocaleDateString() + " " + d.toLocaleTimeString(); 
}

console.log('🔧 ADMIN: Complete admin dashboard loaded successfully for all users');
