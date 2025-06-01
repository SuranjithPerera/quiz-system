// Add this fix to your existing host.js file around line 300-320
// Look for the loadAvailableQuizzes function and add data validation

async function loadAvailableQuizzes() {
    console.log('📚 HOST: Loading available quizzes...');
    const quizList = document.getElementById('quiz-list');
    
    if (!quizList) {
        console.error('❌ HOST: Quiz list element not found');
        return;
    }
    
    quizList.innerHTML = '<div style="text-align: center; padding: 20px;">Loading quizzes...</div>';
    
    let hasQuizzes = false;
    let loadedQuizIds = new Set();
    
    try {
        // Load user's saved quizzes first
        console.log('🔍 HOST: Loading user quizzes...');
        const savedQuizzes = await loadUserQuizzes();
        console.log('📝 HOST: Found saved quizzes:', savedQuizzes.length);
        
        quizList.innerHTML = ''; // Clear loading message
        
        // Add saved quizzes with CRITICAL FIX for data validation
        if (savedQuizzes && savedQuizzes.length > 0) {
            savedQuizzes.forEach(quiz => {
                // CRITICAL FIX: Enhanced validation before processing
                if (!quiz || !quiz.id || !quiz.title) {
                    console.warn('⚠️ HOST: Skipping invalid quiz structure:', quiz);
                    return; // Skip invalid quizzes
                }
                
                // CRITICAL FIX: Ensure questions array exists and is valid
                if (!quiz.questions || !Array.isArray(quiz.questions)) {
                    console.warn('⚠️ HOST: Quiz has invalid questions array, fixing:', quiz.id, quiz.title);
                    quiz.questions = []; // Set empty array as fallback
                }
                
                // CRITICAL FIX: Validate each question in the array
                quiz.questions = quiz.questions.filter((question, index) => {
                    if (!question || typeof question !== 'object') {
                        console.warn(`⚠️ HOST: Removing invalid question at index ${index} in quiz ${quiz.title}`);
                        return false;
                    }
                    if (!question.answers || !Array.isArray(question.answers) || question.answers.length < 2) {
                        console.warn(`⚠️ HOST: Removing question with invalid answers at index ${index} in quiz ${quiz.title}`);
                        return false;
                    }
                    return true;
                });
                
                if (!loadedQuizIds.has(quiz.id)) {
                    const quizCard = document.createElement('div');
                    quizCard.className = 'menu-card';
                    
                    // CRITICAL FIX: Safe length check
                    const questionsCount = (quiz.questions && Array.isArray(quiz.questions)) ? quiz.questions.length : 0;
                    
                    quizCard.innerHTML = `
                        <div style="text-align: left;">
                            <h3>${quiz.title}</h3>
                            <p>${questionsCount} questions</p>
                            <p><small>💾 Created: ${new Date(quiz.createdAt).toLocaleDateString()}</small></p>
                            ${quiz.updatedAt && quiz.updatedAt !== quiz.createdAt ? 
                                `<p><small>Updated: ${new Date(quiz.updatedAt).toLocaleDateString()}</small></p>` : ''}
                        </div>
                        <button onclick="selectQuiz('${quiz.id}', 'saved')" class="btn btn-primary">Select Quiz</button>
                    `;
                    quizList.appendChild(quizCard);
                    loadedQuizIds.add(quiz.id);
                    hasQuizzes = true;
                }
            });
        }
        
        // Add sample quizzes with validation
        if (typeof sampleQuizzes !== 'undefined' && sampleQuizzes && sampleQuizzes.length > 0) {
            console.log('📚 HOST: Adding sample quizzes:', sampleQuizzes.length);
            
            sampleQuizzes.forEach(quiz => {
                if (!loadedQuizIds.has(quiz.id)) {
                    // CRITICAL FIX: Validate sample quiz structure too
                    if (!quiz || !quiz.id || !quiz.title) {
                        console.warn('⚠️ HOST: Skipping invalid sample quiz:', quiz);
                        return;
                    }
                    
                    // CRITICAL FIX: Ensure sample quiz has questions
                    if (!quiz.questions || !Array.isArray(quiz.questions)) {
                        console.warn('⚠️ HOST: Sample quiz has invalid questions array:', quiz.title);
                        quiz.questions = [];
                    }
                    
                    const questionsCount = quiz.questions.length;
                    
                    const quizCard = document.createElement('div');
                    quizCard.className = 'menu-card';
                    quizCard.innerHTML = `
                        <div style="text-align: left;">
                            <h3>${quiz.title}</h3>
                            <p>${questionsCount} questions</p>
                            <p><small><strong>📚 Sample Quiz</strong></small></p>
                        </div>
                        <button onclick="selectQuiz('${quiz.id}', 'sample')" class="btn btn-primary">Select Quiz</button>
                    `;
                    quizList.appendChild(quizCard);
                    loadedQuizIds.add(quiz.id);
                    hasQuizzes = true;
                }
            });
        }
        
        if (!hasQuizzes) {
            quizList.innerHTML = `
                <div class="menu-card">
                    <div style="text-align: center; color: #666;">
                        <h3>No Quizzes Available</h3>
                        <p>Create your first quiz to get started!</p>
                        <button onclick="createCustomQuiz()" class="btn btn-tertiary">Create New Quiz</button>
                    </div>
                </div>
            `;
        }
        
        console.log('✅ HOST: Quiz loading complete. Total quizzes:', loadedQuizIds.size);
        
    } catch (error) {
        console.error('💥 HOST: Error loading quizzes:', error);
        quizList.innerHTML = `
            <div class="menu-card">
                <div style="text-align: center; color: #666;">
                    <h3>Error Loading Quizzes</h3>
                    <p>Please try refreshing the page</p>
                    <button onclick="loadAvailableQuizzes()" class="btn btn-primary">Retry</button>
                </div>
            </div>
        `;
    }
}

// Also add this function to validate quiz selection
function proceedWithQuizSelection(selectedQuiz) {
    // CRITICAL FIX: Enhanced validation before using quiz
    if (!selectedQuiz || typeof selectedQuiz !== 'object') {
        console.error('❌ HOST: Invalid quiz object:', selectedQuiz);
        showStatus('Invalid quiz format', 'error');
        return;
    }
    
    if (!selectedQuiz.questions || !Array.isArray(selectedQuiz.questions)) {
        console.error('❌ HOST: Quiz has no questions array:', selectedQuiz.title);
        showStatus('Quiz has no questions', 'error');
        return;
    }
    
    if (selectedQuiz.questions.length === 0) {
        console.error('❌ HOST: Quiz has empty questions array:', selectedQuiz.title);
        showStatus('Quiz has no questions', 'error');
        return;
    }
    
    // Validate each question
    const validQuestions = selectedQuiz.questions.filter((question, index) => {
        if (!question || typeof question !== 'object') {
            console.warn(`⚠️ HOST: Invalid question at index ${index}`);
            return false;
        }
        if (!question.answers || !Array.isArray(question.answers) || question.answers.length < 2) {
            console.warn(`⚠️ HOST: Invalid answers at question ${index}`);
            return false;
        }
        if (typeof question.correct !== 'number' || question.correct < 0 || question.correct >= question.answers.length) {
            console.warn(`⚠️ HOST: Invalid correct answer at question ${index}`);
            return false;
        }
        return true;
    });
    
    if (validQuestions.length === 0) {
        console.error('❌ HOST: No valid questions found in quiz:', selectedQuiz.title);
        showStatus('Quiz has no valid questions', 'error');
        return;
    }
    
    if (validQuestions.length < selectedQuiz.questions.length) {
        console.warn(`⚠️ HOST: Fixed quiz questions: ${selectedQuiz.questions.length} -> ${validQuestions.length}`);
        selectedQuiz.questions = validQuestions;
    }
    
    console.log('✅ HOST: Quiz validation passed:', selectedQuiz.title, 'with', validQuestions.length, 'questions');
    hostCurrentQuiz = selectedQuiz;
    createGameSession();
}