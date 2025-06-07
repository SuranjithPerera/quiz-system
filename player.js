// ... existing code ...

function showFinalResults() {
    console.log('🏁 PLAYER: Showing final results');
    
    // Clear any running timers
    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
        currentTimerInterval = null;
    }
    
    hideAllScreens();
    showElement('final-results');
    
    updateScoreDisplay();
    
    // Show completion notification
    showStatus('🏁 Quiz completed! Final results are in!', 'success');
    
    // Remove the join info so that if the player refreshes, they don't rejoin
    localStorage.removeItem('gamePin');
    localStorage.removeItem('playerName');
    
    // Clean up Firebase listeners to avoid unnecessary updates
    if (playerGameInstance) {
        playerGameInstance.cleanup();
        playerGameInstance = null;
    }
    
    console.log('✅ PLAYER: Final results screen configured');
}

// ... existing code ...