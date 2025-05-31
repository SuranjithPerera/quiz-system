// Enhanced Quiz Management JavaScript with Aiken Import Support - FIXED VERSION
let currentEditingQuiz = null;
let currentQuestions = [];
let importedQuestions = [];
let currentTab = 'manual';

function initializeManage() {
    console.log('Initializing manage page...');
    
    // Wait for Firebase to be ready
    if (typeof auth === 'undefined') {
        console.log('Waiting for Firebase auth to load...');
        setTimeout(initializeManage, 100);
        return;
    }
    
    // Check authentication and load quizzes
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log('User authenticated:', user.email);
            showUserStatus(user);
            loadSavedQuizzes();
        } else {
            console.log('User not authenticated');
            showGuestStatus();
            loadSavedQuizzes();
        }
    });

    // Listen for user data updates
    window.addEventListener('userDataUpdated', (event) => {
        console.log('User data updated, refreshing quiz list');
        loadSavedQuizzes();
    });

    // Initialize file drag and drop
    initializeFileUpload();
}

function showUserStatus(user) {
    if (!document.querySelector('.user-header')) {
        const userHeaderHTML = `
            <div class="user-header" style="position: absolute; top: 20px; right: 20px; display: flex; align-items: center; gap: 15px; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); padding: 10px 20px; border-radius: 25px; border: 1px solid rgba(255, 255, 255, 0.2);">
                <div class="user-info" style="color: white; font-size: 14px;">
                    <div class="user-name" style="font-weight: bold; margin-bottom: 2px;">${user.displayName || user.email.split('@')[0]}</div>
                    <div class="user-email" style="opacity: 0.8; font-size: 12px;">${user.email}</div>
                </div>
                <button onclick="signOut()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 12px; border-radius: 15px; cursor: pointer; font-size: 12px;">Sign Out</button>
            </div>
        `;
        document.body.insertAdjacentHTML('afterbegin', userHeaderHTML);
    }
}

function showGuestStatus() {
    if (!document.querySelector('.guest-header')) {
        const guestHeaderHTML = `
            <div class="guest-header" style="position: absolute; top: 20px; right: 20px; display: flex; align-items: center; gap: 15px; background: rgba(255, 165, 0, 0.1); backdrop-filter: blur(10px); padding: 10px 20px; border-radius: 25px; border: 1px solid rgba(255, 165, 0, 0.3);">
                <div class="guest-info" style="color: white; font-size: 14px;">
                    <div style="font-weight: bold; margin-bottom: 2px;">Guest Mode</div>
                    <div style="opacity: 0.8; font-size: 12px;">Login to save to cloud</div>
                </div>
                <button onclick="location.href='auth.html'" style="background: rgba(255,165,0,0.3); border: none; color: white; padding: 8px 12px; border-radius: 15px; cursor: pointer; font-size: 12px;">Login</button>
            </div>
        `;
        document.body.insertAdjacentHTML('afterbegin', guestHeaderHTML);
    }
}

// Tab Management
function switchTab(tabName) {
    console.log('Switching to tab:', tabName);
    currentTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[onclick="switchTab('${tabName}')"]`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Reset import state when switching away from import tabs
    if (tabName === 'manual') {
        resetImportState();
    }
}

// File Upload Initialization
function initializeFileUpload() {
    const fileArea = document.querySelector('.file-upload-area');
    
    if (fileArea) {
        fileArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileArea.classList.add('dragover');
        });
        
        fileArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            fileArea.classList.remove('dragover');
        });
        
        fileArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileSelect({ target: { files: files } });
            }
        });
    }
}

// File Selection Handler
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('File selected:', file.name, file.type);
    
    if (!file.name.toLowerCase().endsWith('.txt')) {
        showStatus('Please select a .txt file in Aiken format', 'error');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
        showStatus('File too large. Please select a file smaller than 10MB', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        parseAikenContent(content, file.name);
    };
    
    reader.onerror = function() {
        showStatus('Error reading file. Please try again.', 'error');
    };
    
    reader.readAsText(file);
}

// Text Import Handler
function parseTextImport() {
    const textContent = document.getElementById('text-import').value.trim();
    
    if (!textContent) {
        showStatus('Please enter some text to import', 'error');
        return;
    }
    
    parseAikenContent(textContent, 'Text Input');
}

function clearTextImport() {
    document.getElementById('text-import').value = '';
    resetImportState();
}

// Aiken Format Parser
function parseAikenContent(content, source) {
    console.log('🔍 PARSE: Parsing Aiken content from:', source);
    console.log('📄 PARSE: Content length:', content.length, 'characters');
    console.log('📄 PARSE: First 200 chars:', content.substring(0, 200));
    
    try {
        const questions = parseAikenFormat(content);
        
        console.log('✅ PARSE: Successfully parsed', questions.length, 'questions');
        
        if (questions.length === 0) {
            console.error('❌ PARSE: No valid questions found');
            showStatus('No valid questions found in the content', 'error');
            return;
        }
        
        console.log('📝 PARSE: Sample parsed question:', questions[0]);
        
        importedQuestions = questions;
        console.log('💾 PARSE: Stored', importedQuestions.length, 'questions in importedQuestions array');
        
        showImportPreview(questions, source);
        
    } catch (error) {
        console.error('💥 PARSE: Error parsing Aiken content:', error);
        showStatus('Error parsing content: ' + error.message, 'error');
    }
}

function parseAikenFormat(content) {
    console.log('🔧 FORMAT: Starting Aiken format parsing...');
    const questions = [];
    const errors = [];
    
    // Split content into individual questions
    const questionBlocks = content.split(/\n\s*\n/).filter(block => block.trim());
    
    console.log('📊 FORMAT: Found', questionBlocks.length, 'question blocks');
    
    questionBlocks.forEach((block, blockIndex) => {
        console.log(`🔍 FORMAT: Processing block ${blockIndex + 1}:`, block.substring(0, 100) + '...');
        
        try {
            const question = parseAikenQuestion(block.trim(), blockIndex + 1);
            if (question) {
                console.log(`✅ FORMAT: Successfully parsed question ${blockIndex + 1}:`, question.question.substring(0, 50) + '...');
                questions.push(question);
            }
        } catch (error) {
            console.error(`❌ FORMAT: Error parsing block ${blockIndex + 1}:`, error.message);
            errors.push({
                block: blockIndex + 1,
                error: error.message,
                content: block.substring(0, 100) + '...'
            });
        }
    });
    
    // Store errors for display
    window.aikenParsingErrors = errors;
    
    console.log('📊 FORMAT: Parsing complete -', questions.length, 'valid questions,', errors.length, 'errors');
    
    return questions;
}

function parseAikenQuestion(block, questionNumber) {
    console.log(`🔧 QUESTION: Parsing question ${questionNumber}...`);
    
    const lines = block.split('\n').map(line => line.trim()).filter(line => line);
    
    console.log(`📝 QUESTION: Block has ${lines.length} lines:`, lines);
    
    if (lines.length < 6) { // Minimum: question + 4 answers + ANSWER line
        throw new Error(`Question ${questionNumber}: Too few lines (minimum 6 required, got ${lines.length})`);
    }
    
    // First line is the question
    const questionText = lines[0];
    if (!questionText) {
        throw new Error(`Question ${questionNumber}: Empty question text`);
    }
    
    console.log(`📝 QUESTION: Question text: "${questionText}"`);
    
    // Find the answer line
    const answerLineIndex = lines.findIndex(line => 
        line.toUpperCase().startsWith('ANSWER:') || 
        line.toUpperCase().startsWith('ANS:')
    );
    
    console.log(`📝 QUESTION: Answer line found at index: ${answerLineIndex}`);
    
    if (answerLineIndex === -1) {
        throw new Error(`Question ${questionNumber}: No ANSWER line found`);
    }
    
    // Extract answer options (between question and ANSWER line)
    const answerLines = lines.slice(1, answerLineIndex);
    const answers = [];
    const answerPattern = /^([A-Z])\)\s*(.+)$/;
    
    console.log(`📝 QUESTION: Processing ${answerLines.length} answer lines:`, answerLines);
    
    answerLines.forEach(line => {
        const match = line.match(answerPattern);
        if (match) {
            answers.push({
                letter: match[1],
                text: match[2].trim()
            });
            console.log(`📝 QUESTION: Added answer ${match[1]}: "${match[2].trim()}"`);
        } else {
            console.warn(`⚠️ QUESTION: Line doesn't match answer pattern: "${line}"`);
        }
    });
    
    if (answers.length < 2) {
        throw new Error(`Question ${questionNumber}: At least 2 answer options required (got ${answers.length})`);
    }
    
    if (answers.length > 6) {
        throw new Error(`Question ${questionNumber}: Maximum 6 answer options allowed (got ${answers.length})`);
    }
    
    // Parse correct answer
    const answerLine = lines[answerLineIndex];
    const correctAnswerMatch = answerLine.match(/ANSWER:\s*([A-Z])/i);
    
    console.log(`📝 QUESTION: Answer line: "${answerLine}"`);
    
    if (!correctAnswerMatch) {
        throw new Error(`Question ${questionNumber}: Invalid ANSWER format. Use 'ANSWER: A' format`);
    }
    
    const correctLetter = correctAnswerMatch[1].toUpperCase();
    const correctIndex = answers.findIndex(answer => answer.letter === correctLetter);
    
    console.log(`📝 QUESTION: Correct answer: ${correctLetter} (index: ${correctIndex})`);
    
    if (correctIndex === -1) {
        throw new Error(`Question ${questionNumber}: Correct answer '${correctLetter}' not found in options`);
    }
    
    const result = {
        question: questionText,
        answers: answers.map(answer => answer.text),
        correct: correctIndex,
        timeLimit: 20,
        source: 'aiken_import',
        originalBlock: block
    };
    
    console.log(`✅ QUESTION: Successfully parsed question ${questionNumber}:`, result);
    
    return result;
}

// Import Preview Functions
function showImportPreview(questions, source) {
    console.log('🖼️ PREVIEW: Showing import preview for', questions.length, 'questions from', source);
    
    // CRITICAL: Check if all required elements exist
    const previewDiv = document.getElementById('import-preview');
    const questionsDiv = document.getElementById('preview-questions');
    const previewCountEl = document.getElementById('preview-count');
    const validCountEl = document.getElementById('valid-count');
    const errorCountEl = document.getElementById('error-count');
    const importBtn = document.getElementById('confirm-import-btn');
    
    console.log('🔍 PREVIEW: Element check:', {
        previewDiv: !!previewDiv,
        questionsDiv: !!questionsDiv,
        previewCountEl: !!previewCountEl,
        validCountEl: !!validCountEl,
        errorCountEl: !!errorCountEl,
        importBtn: !!importBtn
    });
    
    if (!previewDiv) {
        console.error('❌ PREVIEW: import-preview element not found!');
        alert('Error: Import preview element not found. Please check the HTML structure.');
        return;
    }
    
    if (!questionsDiv) {
        console.error('❌ PREVIEW: preview-questions element not found!');
        alert('Error: Preview questions element not found. Please check the HTML structure.');
        return;
    }
    
    if (!importBtn) {
        console.error('❌ PREVIEW: confirm-import-btn element not found!');
        alert('Error: Import button element not found. Please check the HTML structure.');
        return;
    }
    
    // Update statistics
    const validQuestions = questions.filter(q => q.question && q.answers && q.answers.length >= 2);
    const errorCount = (window.aikenParsingErrors || []).length;
    
    console.log('📊 PREVIEW: Valid questions:', validQuestions.length, 'Errors:', errorCount);
    
    if (previewCountEl) previewCountEl.textContent = questions.length;
    if (validCountEl) validCountEl.textContent = validQuestions.length;
    if (errorCountEl) errorCountEl.textContent = errorCount;
    
    // Show/hide error section
    const errorsDiv = document.getElementById('import-errors');
    if (errorCount > 0 && errorsDiv) {
        showImportErrors(window.aikenParsingErrors);
        errorsDiv.style.display = 'block';
    } else if (errorsDiv) {
        errorsDiv.style.display = 'none';
    }
    
    // Generate preview HTML
    const previewHTML = validQuestions.map((question, index) => `
        <div class="preview-question">
            <div class="question-text">Q${index + 1}: ${question.question}</div>
            ${question.answers.map((answer, answerIndex) => `
                <div class="answer-option ${answerIndex === question.correct ? 'correct' : 'incorrect'}">
                    ${String.fromCharCode(65 + answerIndex)}) ${answer}
                    ${answerIndex === question.correct ? ' ✓' : ''}
                </div>
            `).join('')}
            <div style="margin-top: 10px; font-size: 0.9rem; color: #666;">
                Time Limit: ${question.timeLimit} seconds
            </div>
        </div>
    `).join('');
    
    console.log('📝 PREVIEW: Generated HTML length:', previewHTML.length);
    questionsDiv.innerHTML = previewHTML;
    
    // Enable/disable import button
    if (validQuestions.length > 0) {
        importBtn.disabled = false;
        importBtn.textContent = `Import ${validQuestions.length} Question${validQuestions.length !== 1 ? 's' : ''}`;
        console.log('✅ PREVIEW: Import button enabled for', validQuestions.length, 'questions');
    } else {
        importBtn.disabled = true;
        importBtn.textContent = 'No Valid Questions to Import';
        console.log('❌ PREVIEW: Import button disabled - no valid questions');
    }
    
    // Show the preview
    previewDiv.style.display = 'block';
    console.log('🖼️ PREVIEW: Preview div displayed, scrolling into view...');
    
    // Scroll into view with a slight delay
    setTimeout(() => {
        previewDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        console.log('📜 PREVIEW: Scrolled to preview');
    }, 100);
}

function showImportErrors(errors) {
    const errorDetailsDiv = document.getElementById('error-details');
    
    errorDetailsDiv.innerHTML = errors.map(error => `
        <div style="margin: 10px 0; padding: 10px; background: rgba(244, 67, 54, 0.1); border-radius: 5px;">
            <strong>Block ${error.block}:</strong> ${error.error}<br>
            <small style="color: #666;">Content: ${error.content}</small>
        </div>
    `).join('');
}

function confirmImport() {
    if (!importedQuestions || importedQuestions.length === 0) {
        showStatus('No questions to import', 'error');
        return;
    }
    
    const validQuestions = importedQuestions.filter(q => q.question && q.answers && q.answers.length >= 2);
    
    console.log('🔄 IMPORT: Confirming import of', validQuestions.length, 'questions');
    console.log('📝 IMPORT: Sample question:', validQuestions[0]);
    
    // Add imported questions to current questions array
    validQuestions.forEach(question => {
        const questionToAdd = {
            question: question.question,
            answers: [...question.answers], // Ensure we copy the array
            correct: question.correct,
            timeLimit: question.timeLimit || 20,
            source: question.source || 'aiken_import' // Ensure source is preserved
        };
        
        console.log('➕ IMPORT: Adding question:', questionToAdd.question.substring(0, 50) + '...');
        currentQuestions.push(questionToAdd);
    });
    
    console.log('✅ IMPORT: Total questions now:', currentQuestions.length);
    console.log('📊 IMPORT: Current questions array:', currentQuestions);
    
    // Switch to manual tab and refresh display
    switchTab('manual');
    loadQuestionsIntoEditor();
    resetImportState();
    
    showStatus(`Successfully imported ${validQuestions.length} question${validQuestions.length !== 1 ? 's' : ''}!`, 'success');
    
    // Scroll to questions container
    document.getElementById('questions-container').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
    });
}

function cancelImport() {
    resetImportState();
    showStatus('Import cancelled', 'info');
}

function resetImportState() {
    importedQuestions = [];
    window.aikenParsingErrors = [];
    
    // Hide preview and error sections
    document.getElementById('import-preview').style.display = 'none';
    document.getElementById('import-errors').style.display = 'none';
    
    // Clear file input
    const fileInput = document.getElementById('file-input');
    if (fileInput) fileInput.value = '';
    
    // Clear text area if on text tab
    if (currentTab === 'text') {
        const textArea = document.getElementById('text-import');
        if (textArea) textArea.value = '';
    }
}

// Quiz Management Functions
async function loadSavedQuizzes() {
    console.log('Loading saved quizzes...');
    const quizzesList = document.getElementById('saved-quizzes-list');
    
    quizzesList.innerHTML = '<div style="text-align: center; padding: 20px;">Loading your quizzes...</div>';
    
    try {
        let allQuizzes = await loadAllQuizzes();
        console.log('Found', allQuizzes.length, 'total quizzes');
        
        // CRITICAL FIX: Data validation and repair
        allQuizzes = await repairQuizData(allQuizzes);
        
        if (allQuizzes.length === 0) {
            quizzesList.innerHTML = `
                <div class="empty-state">
                    <p>No quizzes created yet.</p>
                    <p>Click "Create New Quiz" to get started!</p>
                </div>
            `;
            return;
        }
        
        quizzesList.innerHTML = '';
        allQuizzes.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
        
        allQuizzes.forEach(quiz => {
            // CRITICAL FIX: Enhanced validation before processing
            if (!quiz || !quiz.id || !quiz.title) {
                console.warn('Skipping invalid quiz structure:', quiz);
                return; // Skip invalid quizzes
            }
            
            // CRITICAL FIX: Ensure questions array exists and is valid
            if (!quiz.questions || !Array.isArray(quiz.questions)) {
                console.warn('Quiz has invalid questions array, fixing:', quiz.id, quiz.title);
                quiz.questions = []; // Set empty array as fallback
            }
            
            // CRITICAL FIX: Validate each question in the array
            quiz.questions = quiz.questions.filter((question, index) => {
                if (!question || typeof question !== 'object') {
                    console.warn(`Removing invalid question at index ${index} in quiz ${quiz.title}`);
                    return false;
                }
                if (!question.answers || !Array.isArray(question.answers) || question.answers.length < 2) {
                    console.warn(`Removing question with invalid answers at index ${index} in quiz ${quiz.title}`);
                    return false;
                }
                return true;
            });
            
            const quizCard = document.createElement('div');
            quizCard.className = 'menu-card';
            
            let sourceInfo = '';
            if (quiz.migratedFromSession) {
                sourceInfo = '🔄 Migrated • ';
            } else if (currentUser) {
                sourceInfo = '☁️ Cloud • ';
            } else {
                sourceInfo = '💾 Local • ';
            }
            
            const hasImportedQuestions = quiz.questions && quiz.questions.some(q => q && q.source === 'aiken_import');
            if (hasImportedQuestions) {
                sourceInfo += '📁 Imported • ';
            }
            
            // CRITICAL FIX: Safe length check
            const questionsCount = (quiz.questions && Array.isArray(quiz.questions)) ? quiz.questions.length : 0;
            const questionsText = questionsCount > 0 ? 
                `${questionsCount} questions` : 
                '<span style="color: #f44336;">⚠️ No questions</span>';
            
            quizCard.innerHTML = `
                <div style="text-align: left;">
                    <h3>${quiz.title}</h3>
                    <p>${questionsText}</p>
                    <p><small>${sourceInfo}Created: ${new Date(quiz.createdAt || Date.now()).toLocaleDateString()}</small></p>
                    ${quiz.updatedAt && quiz.updatedAt !== quiz.createdAt ? 
                        `<p><small>Updated: ${new Date(quiz.updatedAt).toLocaleDateString()}</small></p>` : ''}
                </div>
                <div class="quiz-actions">
                    <button onclick="editQuizById('${quiz.id}')" class="btn btn-secondary">Edit</button>
                    <button onclick="duplicateQuiz('${quiz.id}')" class="btn btn-tertiary">Duplicate</button>
                    ${questionsCount > 0 ? 
                        `<button onclick="exportQuiz('${quiz.id}')" class="btn" style="background: #26d0ce;">Export</button>` :
                        `<button disabled class="btn" style="background: #ccc; cursor: not-allowed;">Export</button>`
                    }
                    <button onclick="deleteQuiz('${quiz.id}')" class="btn" style="background: #f44336;">Delete</button>
                </div>
            `;
            quizzesList.appendChild(quizCard);
        });
        
    } catch (error) {
        console.error('Error loading quizzes:', error);
        quizzesList.innerHTML = `
            <div class="empty-state">
                <p style="color: #f44336;">Error loading quizzes. Please try again.</p>
                <button onclick="loadSavedQuizzes()" class="btn btn-primary">Retry</button>
            </div>
        `;
    }
}

// CRITICAL FIX: Data Repair Functions
async function repairQuizData(quizzes) {
    console.log('🔧 Checking quiz data integrity...');
    let repairedQuizzes = [];
    let hasRepairedData = false;
    
    for (let quiz of quizzes) {
        try {
            // Create a repaired copy of the quiz
            const repairedQuiz = await repairSingleQuiz(quiz);
            if (repairedQuiz) {
                repairedQuizzes.push(repairedQuiz);
                
                // Check if this quiz needed repair
                if (repairedQuiz._wasRepaired) {
                    hasRepairedData = true;
                    console.log('🔧 Repaired quiz:', repairedQuiz.title);
                    delete repairedQuiz._wasRepaired; // Remove repair flag
                    
                    // Save repaired quiz back to storage
                    try {
                        await saveQuizToSystem(repairedQuiz);
                        console.log('✅ Saved repaired quiz:', repairedQuiz.title);
                    } catch (error) {
                        console.error('❌ Failed to save repaired quiz:', error);
                    }
                }
            }
        } catch (error) {
            console.error('💥 Failed to repair quiz:', quiz?.title || 'Unknown', error);
            // Still add the quiz even if repair fails, but with safe defaults
            if (quiz && quiz.id) {
                repairedQuizzes.push({
                    ...quiz,
                    questions: quiz.questions || [],
                    title: quiz.title || 'Untitled Quiz',
                    createdAt: quiz.createdAt || Date.now()
                });
            }
        }
    }
    
    if (hasRepairedData) {
        showStatus('Some quiz data was automatically repaired', 'info');
    }
    
    return repairedQuizzes;
}

async function repairSingleQuiz(quiz) {
    if (!quiz || typeof quiz !== 'object') {
        console.warn('🚫 Invalid quiz object:', quiz);
        return null;
    }
    
    let wasRepaired = false;
    const repairedQuiz = { ...quiz };
    
    // Repair basic properties
    if (!repairedQuiz.id) {
        repairedQuiz.id = 'quiz_' + Date.now() + '_repaired';
        wasRepaired = true;
    }
    
    if (!repairedQuiz.title || typeof repairedQuiz.title !== 'string') {
        repairedQuiz.title = 'Untitled Quiz';
        wasRepaired = true;
    }
    
    if (!repairedQuiz.createdAt) {
        repairedQuiz.createdAt = Date.now();
        wasRepaired = true;
    }
    
    if (!repairedQuiz.updatedAt) {
        repairedQuiz.updatedAt = repairedQuiz.createdAt;
        wasRepaired = true;
    }
    
    // Repair questions array
    if (!repairedQuiz.questions || !Array.isArray(repairedQuiz.questions)) {
        console.warn('🔧 Repairing questions array for quiz:', repairedQuiz.title);
        repairedQuiz.questions = [];
        wasRepaired = true;
    } else {
        // Repair individual questions
        const repairedQuestions = [];
        
        repairedQuiz.questions.forEach((question, index) => {
            try {
                const repairedQuestion = repairSingleQuestion(question, index);
                if (repairedQuestion) {
                    repairedQuestions.push(repairedQuestion);
                    if (repairedQuestion._wasRepaired) {
                        wasRepaired = true;
                        delete repairedQuestion._wasRepaired;
                    }
                }
            } catch (error) {
                console.error('❌ Failed to repair question', index, 'in quiz:', repairedQuiz.title, error);
            }
        });
        
        repairedQuiz.questions = repairedQuestions;
    }
    
    if (wasRepaired) {
        repairedQuiz._wasRepaired = true;
        repairedQuiz.updatedAt = Date.now();
    }
    
    return repairedQuiz;
}

function repairSingleQuestion(question, index) {
    if (!question || typeof question !== 'object') {
        console.warn('🚫 Invalid question object at index', index);
        return null;
    }
    
    let wasRepaired = false;
    const repairedQuestion = { ...question };
    
    // Repair question text
    if (!repairedQuestion.question || typeof repairedQuestion.question !== 'string') {
        repairedQuestion.question = `Question ${index + 1}`;
        wasRepaired = true;
    }
    
    // Repair answers array
    if (!repairedQuestion.answers || !Array.isArray(repairedQuestion.answers)) {
        repairedQuestion.answers = ['Option A', 'Option B', 'Option C', 'Option D'];
        wasRepaired = true;
    } else {
        // Ensure minimum 2 answers
        if (repairedQuestion.answers.length < 2) {
            while (repairedQuestion.answers.length < 4) {
                repairedQuestion.answers.push(`Option ${String.fromCharCode(65 + repairedQuestion.answers.length)}`);
            }
            wasRepaired = true;
        }
        
        // Repair individual answers
        repairedQuestion.answers = repairedQuestion.answers.map((answer, answerIndex) => {
            if (!answer || typeof answer !== 'string') {
                wasRepaired = true;
                return `Option ${String.fromCharCode(65 + answerIndex)}`;
            }
            return answer;
        });
    }
    
    // Repair correct answer index
    if (typeof repairedQuestion.correct !== 'number' || 
        repairedQuestion.correct < 0 || 
        repairedQuestion.correct >= repairedQuestion.answers.length) {
        repairedQuestion.correct = 0;
        wasRepaired = true;
    }
    
    // Repair time limit
    if (typeof repairedQuestion.timeLimit !== 'number' || 
        repairedQuestion.timeLimit < 5 || 
        repairedQuestion.timeLimit > 120) {
        repairedQuestion.timeLimit = 20;
        wasRepaired = true;
    }
    
    if (wasRepaired) {
        repairedQuestion._wasRepaired = true;
    }
    
    return repairedQuestion;
}

// Export Quiz to Aiken Format
function exportQuiz(quizId) {
    console.log('Exporting quiz:', quizId);
    
    loadAllQuizzes().then(quizzes => {
        const quiz = quizzes.find(q => q.id === quizId);
        if (!quiz) {
            showStatus('Quiz not found', 'error');
            return;
        }
        
        const aikenContent = convertToAikenFormat(quiz);
        downloadAikenFile(quiz.title, aikenContent);
        showStatus('Quiz exported successfully!', 'success');
    }).catch(error => {
        console.error('Error exporting quiz:', error);
        showStatus('Error exporting quiz', 'error');
    });
}
// [The rest of the file continues with all the other functions unchanged]

function showCreateQuiz() {
    console.log('Creating new quiz...');
    
    currentEditingQuiz = null;
    currentQuestions = [];
    importedQuestions = [];
    
    document.getElementById('editor-title').textContent = 'Create New Quiz';
    document.getElementById('quiz-title').value = '';
    document.getElementById('questions-container').innerHTML = '';
    
    switchTab('manual');
    resetImportState();
    
    hideElement('quiz-list-view');
    showElement('quiz-editor');
    
    addQuestion();
}

async function editQuizById(quizId) {
    console.log('Editing quiz:', quizId);
    
    try {
        const allQuizzes = await loadAllQuizzes();
        const quiz = allQuizzes.find(q => q.id === quizId);
        
        if (quiz) {
            console.log('Found quiz to edit:', quiz.title);
            currentEditingQuiz = quiz;
            // CRITICAL FIX: Ensure questions is an array before spreading
            currentQuestions = (quiz.questions && Array.isArray(quiz.questions)) ? [...quiz.questions] : [];
            importedQuestions = [];
            
            document.getElementById('editor-title').textContent = 'Edit Quiz';
            document.getElementById('quiz-title').value = quiz.title;
            
            hideElement('quiz-list-view');
            showElement('quiz-editor');
            
            switchTab('manual');
            resetImportState();
            loadQuestionsIntoEditor();
        } else {
            console.error('Quiz not found:', quizId);
            showStatus('Quiz not found', 'error');
        }
    } catch (error) {
        console.error('Error loading quiz for edit:', error);
        showStatus('Error loading quiz', 'error');
    }
}

function loadQuestionsIntoEditor() {
    console.log('📝 EDITOR: Loading questions into editor:', currentQuestions.length);
    console.log('📝 EDITOR: Questions breakdown:', {
        total: currentQuestions.length,
        aiken: currentQuestions.filter(q => q.source === 'aiken_import').length,
        manual: currentQuestions.filter(q => !q.source || q.source !== 'aiken_import').length
    });
    
    const container = document.getElementById('questions-container');
    container.innerHTML = '';
    
    currentQuestions.forEach((question, index) => {
        console.log(`📝 EDITOR: Loading question ${index + 1}:`, {
            question: question.question.substring(0, 30) + '...',
            source: question.source || 'no-source',
            answers: question.answers ? question.answers.length : 0
        });
        addQuestionToEditor(question, index);
    });
    
    console.log('✅ EDITOR: All questions loaded into editor');
}

function addQuestion(questionData = null) {
    const questionIndex = currentQuestions.length;
    
    const defaultQuestion = questionData || {
        question: '',
        answers: ['', '', '', ''],
        correct: 0,
        timeLimit: 20
    };
    
    if (!questionData) {
        currentQuestions.push(defaultQuestion);
    }
    
    addQuestionToEditor(defaultQuestion, questionIndex);
    
    setTimeout(() => {
        const newQuestionElement = document.querySelector(`.question-editor[data-index="${questionIndex}"]`);
        if (newQuestionElement) {
            newQuestionElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
            
            const questionInput = newQuestionElement.querySelector('.question-input');
            if (questionInput) {
                questionInput.focus();
            }
        }
    }, 100);
}

function addQuestionToEditor(questionData, index) {
    console.log('Adding question to editor:', index, questionData.question);
    const container = document.getElementById('questions-container');
    
    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-editor';
    questionDiv.setAttribute('data-index', index);
    
    questionDiv.style.cssText = `
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        background: #f9f9f9 !important;
        border: 2px solid #ddd !important;
        border-radius: 10px !important;
        padding: 20px !important;
        margin: 15px 0 !important;
        min-height: 200px !important;
        width: 100% !important;
        box-sizing: border-box !important;
    `;
    
    const sourceIndicator = questionData.source === 'aiken_import' ? 
        '<span style="background: #e3f2fd; color: #1368ce; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; margin-left: 10px;">📁 IMPORTED</span>' : '';
    
    questionDiv.innerHTML = `
        <div class="question-header" style="display: flex !important; justify-content: space-between !important; align-items: center !important; margin-bottom: 15px !important; padding-bottom: 10px !important; border-bottom: 2px solid #eee !important;">
            <h4 style="color: #333 !important; margin: 0 !important;">Question ${index + 1}${sourceIndicator}</h4>
            <div style="display: flex !important; gap: 10px !important;">
                <button onclick="addQuestionAfter(${index})" style="background: #4caf50 !important; color: white !important; padding: 5px 10px !important; border: none !important; border-radius: 5px !important; cursor: pointer !important; font-size: 12px !important;">+ Add Below</button>
                <button onclick="removeQuestion(${index})" style="background: #f44336 !important; color: white !important; padding: 5px 10px !important; border: none !important; border-radius: 5px !important; cursor: pointer !important;">Remove</button>
            </div>
        </div>
        
        <div class="input-group" style="margin-bottom: 15px !important;">
            <label style="display: block !important; font-weight: bold !important; margin-bottom: 5px !important; color: #333 !important;">Question:</label>
            <input type="text" class="question-input" value="${(questionData.question || '').replace(/"/g, '&quot;')}" placeholder="Enter your question" maxlength="200" style="width: 100% !important; padding: 10px !important; border: 1px solid #ddd !important; border-radius: 5px !important; font-size: 14px !important; background: white !important; color: #333 !important; box-sizing: border-box !important;">
        </div>
        
        <div class="answers-editor" style="margin: 15px 0 !important;">
            <label style="display: block !important; font-weight: bold !important; margin-bottom: 5px !important; color: #333 !important;">Answer Options:</label>
            <div class="answers-grid">
                ${questionData.answers.map((answer, answerIndex) => `
                    <div class="answer-input-group ${questionData.correct === answerIndex ? 'correct-answer' : ''}" style="display: flex !important; align-items: center !important; margin: 8px 0 !important; gap: 10px !important; padding: 8px !important; border-radius: 5px !important; border: 2px solid ${questionData.correct === answerIndex ? '#4caf50' : 'transparent'} !important; background: ${questionData.correct === answerIndex ? '#e8f5e8' : '#f8f8f8'} !important; transition: all 0.3s ease !important;">
                        <input type="radio" name="correct-${index}" value="${answerIndex}" ${questionData.correct === answerIndex ? 'checked' : ''} onchange="updateCorrectAnswer(${index}, ${answerIndex})" style="margin: 0 !important; width: 18px !important; height: 18px !important; cursor: pointer !important;">
                        <input type="text" class="answer-input" value="${(answer || '').replace(/"/g, '&quot;')}" placeholder="Answer ${answerIndex + 1}" maxlength="100" style="flex: 1 !important; padding: 8px !important; border: 1px solid #ddd !important; border-radius: 3px !important; font-size: 14px !important; background: white !important; color: #333 !important;">
                        <span class="correct-indicator" style="display: ${questionData.correct === answerIndex ? 'inline-block' : 'none'} !important; background: #4caf50 !important; color: white !important; padding: 2px 8px !important; border-radius: 12px !important; font-size: 12px !important; font-weight: bold !important;">✓ CORRECT</span>
                    </div>
                `).join('')}
            </div>
            <small style="color: #666 !important;">Select the radio button next to the correct answer (highlighted in green)</small>
        </div>
        
        <div class="input-group" style="margin-bottom: 15px !important;">
            <label style="display: block !important; font-weight: bold !important; margin-bottom: 5px !important; color: #333 !important;">Time Limit (seconds):</label>
            <input type="number" class="time-input" value="${questionData.timeLimit || 20}" min="5" max="120" style="width: 100px !important; padding: 8px !important; border: 1px solid #ddd !important; border-radius: 5px !important; font-size: 14px !important; background: white !important; color: #333 !important;">
        </div>
    `;
    
    container.appendChild(questionDiv);
    console.log('Question added to container, total children:', container.children.length);
}

function addQuestionAfter(afterIndex) {
    console.log('Adding question after index:', afterIndex);
    
    const newQuestion = {
        question: '',
        answers: ['', '', '', ''],
        correct: 0,
        timeLimit: 20
    };
    
    currentQuestions.splice(afterIndex + 1, 0, newQuestion);
    loadQuestionsIntoEditor();
    
    setTimeout(() => {
        const newQuestionElement = document.querySelector(`.question-editor[data-index="${afterIndex + 1}"]`);
        if (newQuestionElement) {
            newQuestionElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
            
            const questionInput = newQuestionElement.querySelector('.question-input');
            if (questionInput) {
                questionInput.focus();
            }
            
            newQuestionElement.style.border = '3px solid #4caf50';
            setTimeout(() => {
                newQuestionElement.style.border = '2px solid #ddd';
            }, 2000);
        }
    }, 100);
}

function removeQuestion(index) {
    console.log('Removing question:', index);
    
    if (currentQuestions.length <= 1) {
        showStatus('A quiz must have at least one question', 'error');
        return;
    }
    
    if (confirm('Are you sure you want to remove this question?')) {
        currentQuestions.splice(index, 1);
        loadQuestionsIntoEditor();
    }
}

function collectQuizData() {
    console.log('📊 COLLECT: Starting quiz data collection...');
    const title = document.getElementById('quiz-title').value.trim();
    
    if (!title) {
        showStatus('Please enter a quiz title', 'error');
        return null;
    }
    
    const questionElements = document.querySelectorAll('.question-editor');
    const questions = [];
    
    console.log('📊 COLLECT: Found', questionElements.length, 'question elements');
    console.log('📊 COLLECT: Current questions array has', currentQuestions.length, 'items');
    
    for (let i = 0; i < questionElements.length; i++) {
        const questionEl = questionElements[i];
        const questionText = questionEl.querySelector('.question-input').value.trim();
        
        if (!questionText) {
            showStatus(`Please enter text for question ${i + 1}`, 'error');
            return null;
        }
        
        const answerInputs = questionEl.querySelectorAll('.answer-input');
        const answers = [];
        let hasEmptyAnswer = false;
        
        answerInputs.forEach(input => {
            const answer = input.value.trim();
            if (!answer) {
                hasEmptyAnswer = true;
            }
            answers.push(answer);
        });
        
        if (hasEmptyAnswer) {
            showStatus(`Please fill all answer options for question ${i + 1}`, 'error');
            return null;
        }
        
        const correctRadio = questionEl.querySelector(`input[name="correct-${i}"]:checked`);
        if (!correctRadio) {
            showStatus(`Please select the correct answer for question ${i + 1}`, 'error');
            return null;
        }
        
        const timeLimit = parseInt(questionEl.querySelector('.time-input').value);
        if (timeLimit < 5 || timeLimit > 120) {
            showStatus(`Time limit for question ${i + 1} must be between 5 and 120 seconds`, 'error');
            return null;
        }
        
        // Get the original question data to preserve source information
        const originalQuestion = currentQuestions[i];
        const questionData = {
            question: questionText,
            answers: answers,
            correct: parseInt(correctRadio.value),
            timeLimit: timeLimit
        };
        
        // CRITICAL FIX: Preserve source information from original question or currentQuestions array
        if (originalQuestion && originalQuestion.source) {
            questionData.source = originalQuestion.source;
            console.log('📊 COLLECT: Preserving source for question', i + 1, ':', questionData.source);
        }
        
        console.log('✅ COLLECT: Question', i + 1, 'data:', {
            question: questionData.question.substring(0, 30) + '...',
            answers: questionData.answers.length,
            correct: questionData.correct,
            timeLimit: questionData.timeLimit,
            source: questionData.source || 'manual'
        });
        
        questions.push(questionData);
    }
    
    console.log('✅ COLLECT: Final quiz data:', { 
        title, 
        questionCount: questions.length,
        aikenQuestions: questions.filter(q => q.source === 'aiken_import').length
    });
    
    return {
        title: title,
        questions: questions
    };
}

async function saveQuiz() {
    console.log('💾 SAVE: Starting quiz save process...');
    
    const quizData = collectQuizData();
    if (!quizData) {
        console.log('❌ SAVE: Quiz data validation failed');
        return;
    }
    
    console.log('✅ SAVE: Quiz data collected successfully:', {
        title: quizData.title,
        questionCount: quizData.questions.length,
        aikenQuestions: quizData.questions.filter(q => q.source === 'aiken_import').length,
        manualQuestions: quizData.questions.filter(q => !q.source || q.source !== 'aiken_import').length
    });
    
    showStatus('Saving quiz...', 'info');
    
    try {
        let savedQuiz;
        
        if (currentEditingQuiz) {
            console.log('📝 SAVE: Updating existing quiz:', currentEditingQuiz.id);
            savedQuiz = {
                ...currentEditingQuiz,
                title: quizData.title,
                questions: quizData.questions, // This should include the source property
                updatedAt: Date.now()
            };
        } else {
            console.log('🆕 SAVE: Creating new quiz');
            savedQuiz = {
                id: 'quiz_' + Date.now(),
                title: quizData.title,
                questions: quizData.questions, // This should include the source property
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
        }
        
        console.log('📤 SAVE: Final quiz object to save:', {
            id: savedQuiz.id,
            title: savedQuiz.title,
            questionCount: savedQuiz.questions.length,
            sampleQuestion: savedQuiz.questions[0] ? {
                question: savedQuiz.questions[0].question.substring(0, 30) + '...',
                source: savedQuiz.questions[0].source || 'no-source'
            } : 'no-questions'
        });
        
        const saveResult = await saveQuizToSystem(savedQuiz);
        
        if (saveResult.success) {
            let message;
            if (saveResult.location === 'firebase') {
                message = currentEditingQuiz ? 'Quiz updated and saved to cloud!' : 'Quiz created and saved to cloud!';
            } else if (saveResult.location === 'local') {
                message = currentEditingQuiz ? 'Quiz updated locally (cloud sync failed)' : 'Quiz created locally (cloud sync failed)';
            } else {
                message = currentEditingQuiz ? 'Quiz updated in session!' : 'Quiz created in session! Login to save to cloud.';
            }
            
            console.log('✅ SAVE: Quiz saved successfully to:', saveResult.location);
            showStatus(message, 'success');
            
            setTimeout(() => {
                cancelEdit();
                loadSavedQuizzes();
            }, 1500);
        } else {
            throw new Error(saveResult.error || 'Failed to save quiz');
        }
        
    } catch (error) {
        console.error('💥 SAVE: Error saving quiz:', error);
        showStatus('Failed to save quiz: ' + error.message, 'error');
    }
}

function previewQuiz() {
    const quizData = collectQuizData();
    if (!quizData) return;
    
    document.getElementById('preview-title').textContent = quizData.title;
    document.getElementById('preview-question-count').textContent = quizData.questions.length;
    
    const previewContainer = document.getElementById('preview-questions');
    previewContainer.innerHTML = '';
    
    quizData.questions.forEach((question, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'preview-question';
        
        const sourceIndicator = question.source === 'aiken_import' ? 
            '<span style="background: #e3f2fd; color: #1368ce; padding: 2px 6px; border-radius: 8px; font-size: 10px; font-weight: bold; margin-left: 8px;">📁 IMPORTED</span>' : '';
        
        questionDiv.innerHTML = `
            <div class="question-preview">
                <h4>Question ${index + 1}${sourceIndicator}</h4>
                <p class="question-text">${question.question}</p>
                <div class="answers-preview">
                    ${question.answers.map((answer, answerIndex) => `
                        <div class="answer-preview ${answerIndex === question.correct ? 'correct-answer' : ''}">
                            ${answerIndex === question.correct ? '✓ ' : ''}${answer}
                        </div>
                    `).join('')}
                </div>
                <p><small>Time limit: ${question.timeLimit} seconds</small></p>
            </div>
        `;
        previewContainer.appendChild(questionDiv);
    });
    
    hideElement('quiz-editor');
    showElement('quiz-preview');
}

function editQuiz() {
    hideElement('quiz-preview');
    showElement('quiz-editor');
}

function closePreview() {
    hideElement('quiz-preview');
    showElement('quiz-editor');
}

function resetToMainView() {
    console.log('Resetting interface to main view');
    
    hideElement('quiz-editor');
    hideElement('quiz-preview');
    showElement('quiz-list-view');
    
    currentEditingQuiz = null;
    currentQuestions = [];
    importedQuestions = [];
    
    resetImportState();
    
    const titleInput = document.getElementById('quiz-title');
    const questionsContainer = document.getElementById('questions-container');
    const editorTitle = document.getElementById('editor-title');
    
    if (titleInput) titleInput.value = '';
    if (questionsContainer) questionsContainer.innerHTML = '';
    if (editorTitle) editorTitle.textContent = 'Create New Quiz';
    
    switchTab('manual');
    
    const statusEl = document.getElementById('status-message');
    if (statusEl) {
        statusEl.textContent = '';
        statusEl.className = 'status-message';
    }
    
    console.log('Interface reset completed');
}

function cancelEdit() {
    console.log('Canceling edit mode');
    resetToMainView();
}

async function duplicateQuiz(quizId) {
    console.log('Duplicating quiz:', quizId);
    
    try {
        const allQuizzes = await loadAllQuizzes();
        const originalQuiz = allQuizzes.find(q => q.id === quizId);
        
        if (originalQuiz) {
            const duplicatedQuiz = {
                ...originalQuiz,
                id: 'quiz_' + Date.now(),
                title: originalQuiz.title + ' (Copy)',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            
            const saveResult = await saveQuizToSystem(duplicatedQuiz);
            
            if (saveResult.success) {
                let message;
                if (saveResult.location === 'firebase') {
                    message = 'Quiz duplicated and saved to cloud!';
                } else if (saveResult.location === 'local') {
                    message = 'Quiz duplicated locally (cloud sync failed)';
                } else {
                    message = 'Quiz duplicated in session! Login to save to cloud.';
                }
                
                showStatus(message, 'success');
                loadSavedQuizzes();
            } else {
                throw new Error(saveResult.error || 'Failed to duplicate quiz');
            }
        } else {
            showStatus('Original quiz not found', 'error');
        }
    } catch (error) {
        console.error('Error duplicating quiz:', error);
        showStatus('Failed to duplicate quiz', 'error');
    }
}

async function deleteQuiz(quizId) {
    console.log('Deleting quiz:', quizId);
    
    if (confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) {
        try {
            const success = await deleteQuizFromSystem(quizId);
            
            if (success) {
                showStatus('Quiz deleted successfully!', 'success');
                
                if (currentEditingQuiz && currentEditingQuiz.id === quizId) {
                    console.log('Currently editing quiz was deleted, resetting interface');
                    resetToMainView();
                }
                
                loadSavedQuizzes();
            } else {
                throw new Error('Failed to delete quiz');
            }
        } catch (error) {
            console.error('Error deleting quiz:', error);
            showStatus('Failed to delete quiz', 'error');
        }
    }
}

function updateCorrectAnswer(questionIndex, answerIndex) {
    console.log('Updating correct answer for question', questionIndex, 'to answer', answerIndex);
    
    const questionDiv = document.querySelector(`.question-editor[data-index="${questionIndex}"]`);
    if (!questionDiv) return;
    
    const answerGroups = questionDiv.querySelectorAll('.answer-input-group');
    answerGroups.forEach((group, index) => {
        const indicator = group.querySelector('.correct-indicator');
        if (index === answerIndex) {
            group.classList.add('correct-answer');
            group.style.background = '#e8f5e8';
            group.style.borderColor = '#4caf50';
            if (indicator) {
                indicator.style.display = 'inline-block';
            }
        } else {
            group.classList.remove('correct-answer');
            group.style.background = '#f8f8f8';
            group.style.borderColor = 'transparent';
            if (indicator) {
                indicator.style.display = 'none';
            }
        }
    });
    
    if (currentQuestions[questionIndex]) {
        currentQuestions[questionIndex].correct = answerIndex;
    }
}

function hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'none';
}

function showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'block';
}

function showStatus(message, type) {
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

// Make functions globally accessible
window.showCreateQuiz = showCreateQuiz;
window.editQuizById = editQuizById;
window.duplicateQuiz = duplicateQuiz;
window.deleteQuiz = deleteQuiz;
window.exportQuiz = exportQuiz;
window.addQuestion = addQuestion;
window.addQuestionAfter = addQuestionAfter;
window.removeQuestion = removeQuestion;
window.saveQuiz = saveQuiz;
window.previewQuiz = previewQuiz;
window.editQuiz = editQuiz;
window.closePreview = closePreview;
window.cancelEdit = cancelEdit;
window.updateCorrectAnswer = updateCorrectAnswer;
window.switchTab = switchTab;
window.handleFileSelect = handleFileSelect;
window.parseTextImport = parseTextImport;
window.clearTextImport = clearTextImport;
window.confirmImport = confirmImport;
window.cancelImport = cancelImport;

// Auto-initialize when page loads
document.addEventListener('DOMContentLoaded', initializeManage);