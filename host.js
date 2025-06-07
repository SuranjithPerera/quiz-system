// CRITICAL FIX: Enhanced endQuiz function to properly notify players
async function endQuiz() {
    console.log('🏁 HOST: Ending quiz and notifying all players');
    
    if (hostQuestionTimer) {
        clearInterval(hostQuestionTimer);
        hostQuestionTimer = null;
    }
    
    // Clear auto-cleanup timer
    if (gameAutoCleanupTimer) {
        clearTimeout(gameAutoCleanupTimer);
        gameAutoCleanupTimer = null;
    }
    
    try {
        // CRITICAL FIX: Ensure game state is set to 'finished' so players get notified
        if (hostGameInstance && database && hostGamePin) {
            console.log('📡 HOST: Setting game state to finished in Firebase...');
            
            const gameStateRef = database.ref(`games/${hostGamePin}/gameState`);
            await gameStateRef.update({
                status: 'finished',
                endedAt: Date.now(),
                endReason: 'host_ended',
                message: 'Quiz completed by host'
            });
            
            console.log('✅ HOST: Game state updated to finished in Firebase');
            
            // Also call the game instance end method
            await hostGameInstance.endGame();
        } else {
            console.warn('⚠️ HOST: Missing game instance or database for proper game ending');
        }
        
        // Show results screen on host side
        showResults();
        showStatus('Quiz ended! All players have been notified.', 'success');
        
    } catch (error) {
        console.error('💥 HOST: Error ending quiz:', error);
        showStatus('Error ending quiz: ' + error.message, 'error');
        
        // Still show results even if there was an error
        showResults();
    }
}

// ENHANCED: Next question function with automatic game ending
async function nextQuestion() {
    console.log('➡️ HOST: Moving to next question');
    
    // Clear timer
    if (hostQuestionTimer) {
        clearInterval(hostQuestionTimer);
        hostQuestionTimer = null;
    }
    
    // CRITICAL FIX: Check if this was the last question
    if (hostCurrentQuestionIndex >= hostCurrentQuiz.questions.length - 1) {
        console.log('🏁 HOST: That was the last question! Automatically ending quiz...');
        showStatus('All questions completed! Ending quiz...', 'info');
        
        // Automatically end the quiz
        setTimeout(() => {
            endQuiz();
        }, 2000);
        return;
    }
    
    try {
        hostCurrentQuestionIndex++;
        
        // Reset player statuses for next question
        const playerUpdates = {};
        Object.keys(hostPlayers).forEach(playerId => {
            playerUpdates[`players/${playerId}/status`] = 'waiting';
            playerUpdates[`players/${playerId}/currentAnswer`] = null;
            playerUpdates[`players/${playerId}/responseTime`] = null;
            playerUpdates[`players/${playerId}/answerTime`] = null;
        });
        
        // Update game state and player statuses
        playerUpdates['gameState/status'] = 'playing';
        playerUpdates['gameState/currentQuestion'] = hostCurrentQuestionIndex;
        playerUpdates['gameState/questionStartTime'] = Date.now();
        
        await database.ref(`games/${hostGamePin}`).update(playerUpdates);
        
        console.log('✅ HOST: Moved to question', hostCurrentQuestionIndex + 1);
        
        // Display the new question
        displayCurrentQuestion();
        
    } catch (error) {
        console.error('💥 HOST: Error moving to next question:', error);
        showStatus('Error moving to next question', 'error');
    }
}

// Show results with proper cleanup
function showResults() {
    console.log('🏆 HOST: Showing final results');
    
    if (hostQuestionTimer) {
        clearInterval(hostQuestionTimer);
        hostQuestionTimer = null;
    }
    
    // Clear auto-cleanup timer
    if (gameAutoCleanupTimer) {
        clearTimeout(gameAutoCleanupTimer);
        gameAutoCleanupTimer = null;
    }
    
    hideElement('active-game');
    showElement('results-screen');
    
    displayFinalLeaderboard();
}

// ENHANCED: Show element helper
function hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'none';
}

function showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'block';
}

function showStatus(message, type) {
    console.log(`📢 HOST (${type}):`, message);
    const statusEl = document.getElementById('status-message');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`;
        setTimeout(() => {
            statusEl.textContent = '';
            statusEl.className = 'status-message';
        }, 3000);
    }
}