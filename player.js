// Player.js - Enhanced with Proper Game End Handling - VERIFIED FINAL FIX
let playerGameInstance = null;
let playerGamePlayerId = null;
let playerGamePlayerName = null;
let currentGamePin = null;
let playerScore = 0;
let hasAnswered = false;
let questionStartTime = null;
let currentTimerInterval = null;
let currentQuestionData = null;
let isRecoveringState = false;
let isQuestionActive = false;
let questionEndTime = null;
let previousScore = 0;

// State persistence keys for player
const PLAYER_STATE_KEYS = {
    GAME_PIN: 'player_game_pin',
    PLAYER_NAME: 'player_player_name',
    PLAYER_ID: 'player_player_id',
    GAME_STATE: 'player_game_state',
    IS_ACTIVE: 'player_is_active',
    CURRENT_SCORE: 'player_current_score'
};

// ... [file unchanged above]

function showFinalResults() {
    console.log('🏁 PLAYER: Showing final results');

    // Clear any running timers
    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
        currentTimerInterval = null;
    }

    hideAllScreens();
    showElement('final-results');

    // ✅ FIX: Set the correct final score explicitly
    const finalEl = document.getElementById('player-final-score');
    if (finalEl) {
        finalEl.textContent = `${playerScore} points`;
    }

    updateScoreDisplay();

    // Show completion notification
    showStatus('🏁 Quiz completed! Final results are in!', 'success');

    // Clear all state completely
    clearPlayerState();

    // Clear the join info too since game is over
    localStorage.removeItem('gamePin');
    localStorage.removeItem('playerName');

    console.log('✅ PLAYER: Final results screen configured');
}

// ... [rest of the file unchanged]

console.log('🎮 PLAYER: Enhanced player.js loaded successfully');

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 PLAYER: DOM loaded, initializing player...');
    initializePlayer();
});
