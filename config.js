// Add this enhanced data validation function to your config.js file
// Place it after the SessionManager class definition

// Enhanced quiz data validation and repair
function validateQuizData(quiz) {
    console.log('🔧 VALIDATE: Checking quiz:', quiz?.title || 'Unknown');
    
    if (!quiz || typeof quiz !== 'object') {
        console.warn('❌ VALIDATE: Invalid quiz object');
        return null;
    }
    
    // Create validated quiz with safe defaults
    const validatedQuiz = {
        id: quiz.id || 'quiz_' + Date.now(),
        title: quiz.title || 'Untitled Quiz',
        questions: [],
        createdAt: quiz.createdAt || Date.now(),
        updatedAt: quiz.updatedAt || Date.now()
    };
    
    // Validate questions array
    if (!quiz.questions || !Array.isArray(quiz.questions)) {
        console.warn('❌ VALIDATE: No valid questions array in quiz:', validatedQuiz.title);
        return validatedQuiz; // Return empty quiz rather than null
    }
    
    // Validate each question
    for (let i = 0; i < quiz.questions.length; i++) {
        const question = quiz.questions[i];
        const validatedQuestion = validateQuestionData(question, i + 1);
        
        if (validatedQuestion) {
            validatedQuiz.questions.push(validatedQuestion);
        }
    }
    
    console.log('✅ VALIDATE: Quiz validated:', validatedQuiz.title, 'with', validatedQuiz.questions.length, 'questions');
    return validatedQuiz;
}

function validateQuestionData(question, questionNumber) {
    if (!question || typeof question !== 'object') {
        console.warn(`❌ VALIDATE: Invalid question ${questionNumber}`);
        return null;
    }
    
    // Check required properties
    if (!question.question || typeof question.question !== 'string' || question.question.trim() === '') {
        console.warn(`❌ VALIDATE: Question ${questionNumber} has no valid question text`);
        return null;
    }
    
    if (!question.answers || !Array.isArray(question.answers) || question.answers.length < 2) {
        console.warn(`❌ VALIDATE: Question ${questionNumber} has invalid answers array`);
        return null;
    }
    
    // Validate answers
    const validAnswers = question.answers.filter(answer => 
        answer && typeof answer === 'string' && answer.trim() !== ''
    );
    
    if (validAnswers.length < 2) {
        console.warn(`❌ VALIDATE: Question ${questionNumber} has less than 2 valid answers`);
        return null;
    }
    
    // Validate correct answer index
    const correctIndex = typeof question.correct === 'number' ? question.correct : 0;
    if (correctIndex < 0 || correctIndex >= validAnswers.length) {
        console.warn(`❌ VALIDATE: Question ${questionNumber} has invalid correct answer index, fixing to 0`);
        // Fix rather than reject
    }
    
    // Return validated question
    return {
        question: question.question.trim(),
        answers: validAnswers,
        correct: Math.max(0, Math.min(correctIndex, validAnswers.length - 1)),
        timeLimit: typeof question.timeLimit === 'number' && question.timeLimit > 0 ? question.timeLimit : 20,
        source: question.source || 'manual'
    };
}

// Enhanced loadAllQuizzes function with validation
async function loadAllQuizzesWithValidation() {
    console.log('📚 Loading all quizzes with validation...');
    
    if (currentUser && typeof database !== 'undefined') {
        // Load from Firebase for logged-in users with merge
        const result = await sessionManager.loadUserDataFromFirebase(currentUser);
        if (result.success) {
            // Validate all quizzes
            const validatedQuizzes = result.quizzes.map(quiz => validateQuizData(quiz)).filter(quiz => quiz !== null);
            console.log('✅ Validated quizzes from Firebase:', validatedQuizzes.length);
            return validatedQuizzes;
        }
    }
    
    // Fallback to session data
    const sessionQuizzes = sessionManager.getSessionQuizzes();
    const validatedQuizzes = sessionQuizzes.map(quiz => validateQuizData(quiz)).filter(quiz => quiz !== null);
    console.log('✅ Validated quizzes from session:', validatedQuizzes.length);
    return validatedQuizzes;
}

// Replace the original loadAllQuizzes function
window.loadAllQuizzes = loadAllQuizzesWithValidation;

// Add repair function for existing data
async function repairAllQuizData() {
    console.log('🔧 REPAIR: Starting comprehensive quiz data repair...');
    
    try {
        const allQuizzes = await loadAllQuizzesWithValidation();
        let repairedCount = 0;
        
        for (const quiz of allQuizzes) {
            if (quiz.questions.length === 0) {
                console.warn('🔧 REPAIR: Removing quiz with no valid questions:', quiz.title);
                await deleteQuizFromSystem(quiz.id);
                repairedCount++;
            }
        }
        
        if (repairedCount > 0) {
            console.log('✅ REPAIR: Repaired', repairedCount, 'quizzes');
            showStatus(`Repaired ${repairedCount} quiz${repairedCount !== 1 ? 'es' : ''}`, 'info');
        }
        
        return allQuizzes.filter(quiz => quiz.questions.length > 0);
    } catch (error) {
        console.error('💥 REPAIR: Error during repair process:', error);
        return [];
    }
}

// Auto-repair on page load
document.addEventListener('DOMContentLoaded', function() {
    // Run repair after a short delay to ensure everything is loaded
    setTimeout(() => {
        if (window.location.pathname.includes('host.html') || window.location.pathname.includes('manage.html')) {
            repairAllQuizData();
        }
    }, 2000);
});

console.log('🔧 Data validation and repair system loaded');