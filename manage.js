// Enhanced Quiz Management JavaScript with Aiken Import Support - CLEAN FIXED VERSION
let currentEditingQuiz = null;
let currentQuestions = [];
let importedQuestions = [];
let currentTab = 'manual';
let hasValidationErrors = false;

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
    const tabButton = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
    if (tabButton) tabButton.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    const tabContent = document.getElementById(`${tabName}-tab`);
    if (tabContent) tabContent.classList.add('active');
    
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

// Enhanced File Selection Handler with Validation
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('File selected:', file.name, file.type);
    
    // Reset validation state
    hasValidationErrors = false;
    resetImportState();
    
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.txt')) {
        showValidationError('Invalid file type. Please select a .txt file in Aiken format.');
        return;
    }
    
    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
        showValidationError('File too large. Please select a file smaller than 10MB.');
        return;
    }
    
    // Check if file is empty
    if (file.size === 0) {
        showValidationError('File is empty. Please select a file with quiz questions.');
        return;
    }
    
    showStatus('Reading file...', 'info');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        
        // Validate content exists
        if (!content || content.trim().length === 0) {
            showValidationError('File is empty or contains no readable content.');
            return;
        }
        
        console.log('Content length:', content.length);
        parseAikenContentWithValidation(content, file.name);
    };
    
    reader.onerror = function() {
        showValidationError('Error reading file. Please try again with a different file.');
    };
    
    reader.readAsText(file);
}

// Enhanced Text Import Handler with Validation
function parseTextImport() {
    const textContent = document.getElementById('text-import').value.trim();
    
    // Reset validation state
    hasValidationErrors = false;
    resetImportState();
    
    if (!textContent) {
        showValidationError('Please enter some text to import.');
        return;
    }
    
    // Check minimum content length
    if (textContent.length < 20) {
        showValidationError('Content too short. Please enter valid quiz questions.');
        return;
    }
    
    console.log('Text content length:', textContent.length);
    parseAikenContentWithValidation(textContent, 'Text Input');
}

function clearTextImport() {
    document.getElementById('text-import').value = '';
    resetImportState();
    hasValidationErrors = false;
}

// Enhanced Aiken Format Parser with Comprehensive Validation
function parseAikenContentWithValidation(content, source) {
    console.log('Starting comprehensive Aiken validation for:', source);
    
    try {
        // Pre-validation checks
        const preValidationResult = preValidateContent(content);
        if (!preValidationResult.isValid) {
            showValidationError(preValidationResult.error, preValidationResult.details);
            return;
        }
        
        // Parse content
        const parseResult = parseAikenFormat(content);
        
        // Post-validation checks
        const postValidationResult = postValidateQuestions(parseResult.questions, parseResult.errors);
        if (!postValidationResult.isValid) {
            showValidationError(postValidationResult.error, postValidationResult.details);
            return;
        }
        
        console.log('All checks passed - proceeding with import');
        
        importedQuestions = parseResult.questions;
        showImportPreview(parseResult.questions, source, parseResult.errors);
        
    } catch (error) {
        console.error('Critical error during parsing:', error);
        showValidationError('Critical parsing error: ' + error.message);
    }
}

// Pre-validation of content before parsing
function preValidateContent(content) {
    console.log('Checking content structure...');
    
    // Check for basic Aiken format indicators
    const hasQuestionMarks = content.includes('?') || content.includes(':');
    const hasAnswerOptions = /[A-Z][\)\.]/.test(content);
    const hasAnswerLine = /ANSWER\s*:\s*[A-Z]/i.test(content);
    
    if (!hasQuestionMarks) {
        return {
            isValid: false,
            error: 'Invalid format: No questions found.',
            details: 'Content must contain questions ending with ? or :'
        };
    }
    
    if (!hasAnswerOptions) {
        return {
            isValid: false,
            error: 'Invalid format: No answer options found.',
            details: 'Questions must have answer options like A) or A.'
        };
    }
    
    if (!hasAnswerLine) {
        return {
            isValid: false,
            error: 'Invalid format: No ANSWER lines found.',
            details: 'Each question must have an ANSWER: line (e.g., ANSWER: B)'
        };
    }
    
    // Check for reasonable content length
    if (content.length > 100000) {
        return {
            isValid: false,
            error: 'Content too large.',
            details: 'Please limit content to under 100KB for better performance.'
        };
    }
    
    console.log('Basic format checks passed');
    return { isValid: true };
}

// Post-validation of parsed questions
function postValidateQuestions(questions, errors) {
    console.log('Checking parsed questions...');
    
    // Check if any questions were successfully parsed
    if (!questions || questions.length === 0) {
        return {
            isValid: false,
            error: 'No valid questions found.',
            details: errors.length > 0 ? 
                `Found ${errors.length} formatting errors. Please check the Aiken format example.` :
                'Content does not match Aiken format. Please check the example format.'
        };
    }
    
    // Check error ratio
    const totalAttempts = questions.length + errors.length;
    const errorRatio = errors.length / totalAttempts;
    
    if (errorRatio > 0.5) {
        return {
            isValid: false,
            error: 'Too many formatting errors.',
            details: `${errors.length} out of ${totalAttempts} questions have errors. Please fix the format and try again.`
        };
    }
    
    // Validate individual questions more strictly
    const invalidQuestions = [];
    questions.forEach((question, index) => {
        const validation = strictValidateQuestion(question, index + 1);
        if (!validation.isValid) {
            invalidQuestions.push(`Question ${index + 1}: ${validation.error}`);
        }
    });
    
    if (invalidQuestions.length > 0) {
        return {
            isValid: false,
            error: 'Invalid question data found.',
            details: invalidQuestions.slice(0, 3).join('\n') + 
                (invalidQuestions.length > 3 ? `\n... and ${invalidQuestions.length - 3} more errors` : '')
        };
    }
    
    console.log('All questions validated successfully');
    return { isValid: true };
}

// Strict validation for individual questions
function strictValidateQuestion(question, questionNumber) {
    if (!question.question || question.question.trim().length < 5) {
        return {
            isValid: false,
            error: 'Question text too short or missing'
        };
    }
    
    if (!question.answers || question.answers.length < 2) {
        return {
            isValid: false,
            error: 'Must have at least 2 answer options'
        };
    }
    
    if (question.answers.length > 6) {
        return {
            isValid: false,
            error: 'Too many answer options (maximum 6)'
        };
    }
    
    // Check for empty answers
    const emptyAnswers = question.answers.filter(answer => !answer || answer.trim().length === 0);
    if (emptyAnswers.length > 0) {
        return {
            isValid: false,
            error: 'Contains empty answer options'
        };
    }
    
    // Check correct answer index
    if (typeof question.correct !== 'number' || question.correct < 0 || question.correct >= question.answers.length) {
        return {
            isValid: false,
            error: 'Invalid correct answer index'
        };
    }
    
    return { isValid: true };
}

// Enhanced error display function
function showValidationError(primaryError, details = null) {
    console.error('VALIDATION ERROR:', primaryError, details);
    hasValidationErrors = true;
    
    const errorDiv = document.getElementById('import-errors');
    const errorDetailsDiv = document.getElementById('error-details');
    
    if (errorDiv && errorDetailsDiv) {
        errorDetailsDiv.innerHTML = `
            <div style="margin-bottom: 15px; padding: 15px; background: rgba(244, 67, 54, 0.1); border-radius: 8px; border-left: 4px solid #f44336;">
                <h4 style="color: #d32f2f; margin-bottom: 10px;">❌ Import Failed</h4>
                <p style="color: #c62828; font-weight: bold; margin-bottom: 8px;">${primaryError}</p>
                ${details ? `<p style="color: #666; font-size: 0.9rem; line-height: 1.4;">${details.replace(/\n/g, '<br>')}</p>` : ''}
            </div>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 15px;">
                <h5 style="color: #495057; margin-bottom: 10px;">📝 Correct Aiken Format:</h5>
                <div style="background: #fff; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 0.85rem; color: #333;">
What is the capital of France?<br>
A) London<br>
B) Berlin<br>
C) Paris<br>
D) Madrid<br>
ANSWER: C<br><br>
Which planet is red?<br>
A) Earth<br>
B) Mars<br>
C) Venus<br>
ANSWER: B
                </div>
            </div>
        `;
        errorDiv.style.display = 'block';
    }
    
    // Hide preview section
    const previewDiv = document.getElementById('import-preview');
    if (previewDiv) {
        previewDiv.style.display = 'none';
    }
    
    // Show error message in status
    showStatus(primaryError, 'error');
    
    // Clear file input
    const fileInput = document.getElementById('file-input');
    if (fileInput) fileInput.value = '';
}

// Enhanced parseAikenFormat function with better error tracking
function parseAikenFormat(content) {
    console.log('Starting Aiken format parsing...');
    const questions = [];
    const errors = [];
    
    // Split content into individual questions
    const questionBlocks = content.split(/\n\s*\n/).filter(block => block.trim());
    
    console.log('Found', questionBlocks.length, 'question blocks');
    
    questionBlocks.forEach((block, blockIndex) => {
        console.log(`Processing block ${blockIndex + 1}`);
        
        try {
            const question = parseAikenQuestion(block.trim(), blockIndex + 1);
            if (question) {
                console.log(`Successfully parsed question ${blockIndex + 1}`);
                questions.push(question);
            }
        } catch (error) {
            console.error(`Error parsing block ${blockIndex + 1}:`, error.message);
            errors.push({
                block: blockIndex + 1,
                error: error.message,
                content: block.substring(0, 100) + '...'
            });
        }
    });
    
    console.log('Parsing complete -', questions.length, 'valid questions,', errors.length, 'errors');
    
    return { questions, errors };
}

function parseAikenQuestion(block, questionNumber) {
    const lines = block.split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length < 6) {
        throw new Error(`Question ${questionNumber}: Too few lines (minimum 6 required, got ${lines.length})`);
    }
    
    // First line is the question
    const questionText = lines[0];
    if (!questionText) {
        throw new Error(`Question ${questionNumber}: Empty question text`);
    }
    
    // Find the answer line
    const answerLineIndex = lines.findIndex(line => 
        line.toUpperCase().startsWith('ANSWER:') || 
        line.toUpperCase().startsWith('ANS:')
    );
    
    if (answerLineIndex === -1) {
        throw new Error(`Question ${questionNumber}: No ANSWER line found`);
    }
    
    // Extract answer options
    const answerLines = lines.slice(1, answerLineIndex);
    const answers = [];
    const answerPattern = /^([A-Z])[\)\.]\s*(.+)$/;
    
    answerLines.forEach(line => {
        const match = line.match(answerPattern);
        if (match) {
            answers.push({
                letter: match[1],
                text: match[2].trim()
            });
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
    
    if (!correctAnswerMatch) {
        throw new Error(`Question ${questionNumber}: Invalid ANSWER format. Use 'ANSWER: A' format`);
    }
    
    const correctLetter = correctAnswerMatch[1].toUpperCase();
    const correctIndex = answers.findIndex(answer => answer.letter === correctLetter);
    
    if (correctIndex === -1) {
        throw new Error(`Question ${questionNumber}: Correct answer '${correctLetter}' not found in options`);
    }
    
    return {
        question: questionText,
        answers: answers.map(answer => answer.text),
        correct: correctIndex,
        timeLimit: 20,
        source: 'aiken_import',
        originalBlock: block
    };
}

// Enhanced Import Preview with Validation Status and Time Limit Configuration
function showImportPreview(questions, source, errors = []) {
    console.log('Showing import preview for', questions.length, 'questions from', source);
    
    // Check if we have validation errors
    if (hasValidationErrors) {
        console.log('Not showing preview due to validation errors');
        return;
    }
    
    const previewDiv = document.getElementById('import-preview');
    const questionsDiv = document.getElementById('preview-questions');
    const previewCountEl = document.getElementById('preview-count');
    const validCountEl = document.getElementById('valid-count');
    const errorCountEl = document.getElementById('error-count');
    const importBtn = document.getElementById('confirm-import-btn');
    
    if (!previewDiv || !questionsDiv || !importBtn) {
        console.error('Required elements not found!');
        showValidationError('System error: Preview elements not found. Please refresh the page.');
        return;
    }
    
    // Update statistics
    const validQuestions = questions.filter(q => q.question && q.answers && q.answers.length >= 2);
    const errorCount = errors.length;
    
    console.log('Valid questions:', validQuestions.length, 'Errors:', errorCount);
    
    if (previewCountEl) previewCountEl.textContent = questions.length;
    if (validCountEl) validCountEl.textContent = validQuestions.length;
    if (errorCountEl) errorCountEl.textContent = errorCount;
    
    // Show/hide error section
    const errorsDiv = document.getElementById('import-errors');
    if (errorCount > 0 && errorsDiv) {
        showImportErrors(errors);
        errorsDiv.style.display = 'block';
    } else if (errorsDiv) {
        errorsDiv.style.display = 'none';
    }
    
    // Generate preview HTML with time limit controls
    const previewHTML = `
        <div style="background: #e8f5e8; padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 2px solid #4caf50;">
            <h4 style="color: #2e7d32; margin-bottom: 15px;">⏰ Set Time Limits for Imported Questions</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; align-items: center;">
                <div>
                    <label style="display: block; font-weight: bold; color: #2e7d32; margin-bottom: 5px;">Default Time Limit:</label>
                    <select id="default-time-limit" style="width: 100%; padding: 8px; border: 2px solid #4caf50; border-radius: 5px; font-size: 14px;">
                        <option value="10">10 seconds</option>
                        <option value="15">15 seconds</option>
                        <option value="20" selected>20 seconds</option>
                        <option value="30">30 seconds</option>
                        <option value="45">45 seconds</option>
                        <option value="60">60 seconds</option>
                        <option value="90">90 seconds</option>
                        <option value="120">120 seconds</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; font-weight: bold; color: #2e7d32; margin-bottom: 5px;">Apply to:</label>
                    <button onclick="applyTimeToAll()" style="background: #4caf50; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-weight: bold; width: 100%;">Apply to All Questions</button>
                </div>
                <div>
                    <label style="display: block; font-weight: bold; color: #2e7d32; margin-bottom: 5px;">Quick Settings:</label>
                    <div style="display: flex; gap: 5px;">
                        <button onclick="setQuickTime(15)" style="background: #ff9800; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 12px;">Quick (15s)</button>
                        <button onclick="setQuickTime(30)" style="background: #2196f3; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 12px;">Medium (30s)</button>
                        <button onclick="setQuickTime(60)" style="background: #9c27b0; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 12px;">Long (60s)</button>
                    </div>
                </div>
            </div>
            <p style="margin-top: 10px; font-size: 0.9rem; color: #666; font-style: italic;">
                💡 Tip: You can adjust individual question times below, or set them all at once using the controls above.
            </p>
        </div>
        
        ${validQuestions.map((question, index) => `
            <div class="preview-question" style="border-left: 4px solid #4caf50; padding-left: 15px;">
                <div class="question-text" style="font-weight: bold; color: #333; margin-bottom: 10px;">
                    Q${index + 1}: ${question.question}
                </div>
                ${question.answers.map((answer, answerIndex) => `
                    <div class="answer-option ${answerIndex === question.correct ? 'correct' : 'incorrect'}" style="padding: 5px 10px; margin: 3px 0; border-radius: 5px; ${answerIndex === question.correct ? 'background: #d4edda; border: 1px solid #c3e6cb; color: #155724; font-weight: bold;' : 'background: #f8f9fa; border: 1px solid #e9ecef; color: #6c757d;'}">
                        ${String.fromCharCode(65 + answerIndex)}) ${answer}
                        ${answerIndex === question.correct ? ' ✓' : ''}
                    </div>
                `).join('')}
                <div style="margin-top: 15px; display: flex; align-items: center; gap: 10px; background: #f8f9fa; padding: 10px; border-radius: 8px; border: 1px solid #dee2e6;">
                    <label style="font-weight: bold; color: #495057; white-space: nowrap;">⏰ Time Limit:</label>
                    <select class="question-time-limit" data-question-index="${index}" onchange="updateQuestionTimeLimit(${index}, this.value)" style="padding: 5px 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px; min-width: 120px;">
                        <option value="5" ${question.timeLimit === 5 ? 'selected' : ''}>5 seconds</option>
                        <option value="10" ${question.timeLimit === 10 ? 'selected' : ''}>10 seconds</option>
                        <option value="15" ${question.timeLimit === 15 ? 'selected' : ''}>15 seconds</option>
                        <option value="20" ${question.timeLimit === 20 ? 'selected' : ''}>20 seconds</option>
                        <option value="30" ${question.timeLimit === 30 ? 'selected' : ''}>30 seconds</option>
                        <option value="45" ${question.timeLimit === 45 ? 'selected' : ''}>45 seconds</option>
                        <option value="60" ${question.timeLimit === 60 ? 'selected' : ''}>60 seconds</option>
                        <option value="90" ${question.timeLimit === 90 ? 'selected' : ''}>90 seconds</option>
                        <option value="120" ${question.timeLimit === 120 ? 'selected' : ''}>120 seconds</option>
                    </select>
                    <span style="font-size: 0.85rem; color: #6c757d; font-style: italic;">
                        ${question.timeLimit <= 15 ? '⚡ Quick' : question.timeLimit <= 30 ? '🔥 Normal' : question.timeLimit <= 60 ? '🕐 Extended' : '🐌 Slow'}
                    </span>
                </div>
            </div>
        `).join('')}
    `;
    
    questionsDiv.innerHTML = previewHTML;
    
    // Enable/disable import button based on validation
    if (validQuestions.length > 0 && !hasValidationErrors) {
        importBtn.disabled = false;
        importBtn.textContent = `Import ${validQuestions.length} Question${validQuestions.length !== 1 ? 's' : ''} with Time Settings`;
        console.log('Import button enabled for', validQuestions.length, 'questions');
    } else {
        importBtn.disabled = true;
        importBtn.textContent = hasValidationErrors ? 'Fix Errors First' : 'No Valid Questions to Import';
        console.log('Import button disabled');
    }
    
    // Show the preview
    previewDiv.style.display = 'block';
    
    // Scroll into view
    setTimeout(() => {
        previewDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

// Time Limit Management Functions for Import
function applyTimeToAll() {
    const defaultTime = parseInt(document.getElementById('default-time-limit').value);
    console.log('Applying time limit to all questions:', defaultTime);
    
    // Update all time limit dropdowns
    const timeSelects = document.querySelectorAll('.question-time-limit');
    timeSelects.forEach(select => {
        select.value = defaultTime;
        const questionIndex = parseInt(select.getAttribute('data-question-index'));
        updateQuestionTimeLimit(questionIndex, defaultTime);
    });
    
    showStatus(`Applied ${defaultTime} seconds to all questions!`, 'success');
}

function setQuickTime(seconds) {
    document.getElementById('default-time-limit').value = seconds;
    applyTimeToAll();
}

function updateQuestionTimeLimit(questionIndex, timeLimit) {
    const time = parseInt(timeLimit);
    console.log(`Updating question ${questionIndex + 1} time limit to ${time} seconds`);
    
    // Update the imported question data
    if (importedQuestions[questionIndex]) {
        importedQuestions[questionIndex].timeLimit = time;
    }
    
    // Update the visual indicator
    const select = document.querySelector(`.question-time-limit[data-question-index="${questionIndex}"]`);
    if (select) {
        const indicator = select.parentElement.querySelector('span');
        if (indicator) {
            let indicatorText = '';
            if (time <= 15) {
                indicatorText = '⚡ Quick';
            } else if (time <= 30) {
                indicatorText = '🔥 Normal';
            } else if (time <= 60) {
                indicatorText = '🕐 Extended';
            } else {
                indicatorText = '🐌 Slow';
            }
            indicator.textContent = indicatorText;
        }
    }
    
    console.log(`Question ${questionIndex + 1} time limit updated to ${time} seconds`);
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

// Enhanced Confirm Import with Time Limit Application
function confirmImport() {
    console.log('Starting import confirmation with time settings...');
    
    // Final validation check
    if (hasValidationErrors) {
        showValidationError('Cannot import: Validation errors found. Please fix them first.');
        return;
    }
    
    if (!importedQuestions || importedQuestions.length === 0) {
        showValidationError('No questions to import.');
        return;
    }
    
    const validQuestions = importedQuestions.filter(q => q.question && q.answers && q.answers.length >= 2);
    
    if (validQuestions.length === 0) {
        showValidationError('No valid questions found after final validation.');
        return;
    }
    
    console.log('Final validation passed - importing', validQuestions.length, 'questions with time settings');
    
    // Add imported questions to current questions array with time limits
    validQuestions.forEach((question, index) => {
        // Get the time limit from the dropdown or use the question's current time limit
        const timeSelect = document.querySelector(`.question-time-limit[data-question-index="${index}"]`);
        const timeLimit = timeSelect ? parseInt(timeSelect.value) : question.timeLimit || 20;
        
        const questionToAdd = {
            question: question.question,
            answers: [...question.answers],
            correct: question.correct,
            timeLimit: timeLimit, // Use the configured time limit
            source: question.source || 'aiken_import'
        };
        
        console.log('Adding question with time limit:', questionToAdd.question.substring(0, 50) + '...', `(${timeLimit}s)`);
        currentQuestions.push(questionToAdd);
    });
    
    console.log('Total questions now:', currentQuestions.length);
    
    // Switch to manual tab and refresh display
    switchTab('manual');
    loadQuestionsIntoEditor();
    resetImportState();
    
    showStatus(`Successfully imported ${validQuestions.length} question${validQuestions.length !== 1 ? 's' : ''} with custom time settings!`, 'success');
    
    // Scroll to questions container
    const questionsContainer = document.getElementById('questions-container');
    if (questionsContainer) {
        questionsContainer.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }
}

function cancelImport() {
    resetImportState();
    hasValidationErrors = false;
    showStatus('Import cancelled', 'info');
}

function resetImportState() {
    importedQuestions = [];
    hasValidationErrors = false;
    
    // Hide preview and error sections
    const previewDiv = document.getElementById('import-preview');
    const errorsDiv = document.getElementById('import-errors');
    
    if (previewDiv) previewDiv.style.display = 'none';
    if (errorsDiv) errorsDiv.style.display = 'none';
    
    // Clear file input
    const fileInput = document.getElementById('file-input');
    if (fileInput) fileInput.value = '';
    
    // Clear text area if on text tab
    if (currentTab === 'text') {
        const textArea = document.getElementById('text-import');
        if (textArea) textArea.value = '';
    }
}

// Enhanced Save Quiz with Import Validation
async function saveQuiz() {
    console.log('Starting quiz save process...');
    
    // Check if there are any ongoing validation errors
    if (hasValidationErrors) {
        showStatus('Cannot save quiz: Please fix import validation errors first.', 'error');
        return;
    }
    
    const quizData = collectQuizData();
    if (!quizData) {
        console.log('Quiz data validation failed');
        return;
    }
    
    // Additional check - ensure all questions are valid
    const invalidQuestions = quizData.questions.filter(q => {
        return !q.question || !q.answers || q.answers.length < 2 || 
               typeof q.correct !== 'number' || q.correct < 0 || q.correct >= q.answers.length;
    });
    
    if (invalidQuestions.length > 0) {
        showStatus(`Cannot save: ${invalidQuestions.length} question(s) have validation errors.`, 'error');
        return;
    }
    
    console.log('Quiz data validated successfully');
    showStatus('Saving quiz...', 'info');
    
    try {
        let savedQuiz;
        
        if (currentEditingQuiz) {
            console.log('Updating existing quiz:', currentEditingQuiz.id);
            savedQuiz = {
                ...currentEditingQuiz,
                title: quizData.title,
                questions: quizData.questions,
                updatedAt: Date.now()
            };
        } else {
            console.log('Creating new quiz');
            savedQuiz = {
                id: 'quiz_' + Date.now(),
                title: quizData.title,
                questions: quizData.questions,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
        }
        
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
            
            console.log('Quiz saved successfully to:', saveResult.location);
            showStatus(message, 'success');
            
            setTimeout(() => {
                cancelEdit();
                loadSavedQuizzes();
            }, 1500);
        } else {
            throw new Error(saveResult.error || 'Failed to save quiz');
        }
        
    } catch (error) {
        console.error('Error saving quiz:', error);
        showStatus('Failed to save quiz: ' + error.message, 'error');
    }
}

// Quiz Management Functions
async function loadSavedQuizzes() {
    console.log('Loading saved quizzes...');
    const quizzesList = document.getElementById('saved-quizzes-list');
    
    if (!quizzesList) return;
    
    quizzesList.innerHTML = '<div style="text-align: center; padding: 20px;">Loading your quizzes...</div>';
    
    try {
        const allQuizzes = await loadAllQuizzes();
        console.log('Found', allQuizzes.length, 'total quizzes');
        
        if (allQuizzes.length === 0) {
            quizzesList.innerHTML = `
                <div class="empty-state">
                    <p>No quizzes created yet.</p>
                    <p>Click "Create New Quiz" to get started!</p>
                </div>
            `;
            return;
        }
        
        
        allQuizzes.forEach(quiz => {
            // Enhanced validation before processing
            if (!quiz || !quiz.id || !quiz.title) {
                console.warn('Skipping invalid quiz structure:', quiz);
                return;
            }
            
            // Ensure questions array exists and is valid
            if (!quiz.questions || !Array.isArray(quiz.questions)) {
                console.warn('Quiz has invalid questions array, fixing:', quiz.id, quiz.title);
                quiz.questions = [];
            }
            
            // Validate each question in the array
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
            } else if (typeof currentUser !== 'undefined' && currentUser) {
                sourceInfo = '☁️ Cloud • ';
            } else {
                sourceInfo = '💾 Local • ';
            }
            
            const hasImportedQuestions = quiz.questions && quiz.questions.some(q => q && q.source === 'aiken_import');
            if (hasImportedQuestions) {
                sourceInfo += '📁 Imported • ';
            }
            
            // Safe length check
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

function showCreateQuiz() {
    console.log('Creating new quiz...');
    
    currentEditingQuiz = null;
    currentQuestions = [];
    importedQuestions = [];
    hasValidationErrors = false;
    
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
            currentQuestions = (quiz.questions && Array.isArray(quiz.questions)) ? [...quiz.questions] : [];
            importedQuestions = [];
            hasValidationErrors = false;
            
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
    console.log('Loading questions into editor:', currentQuestions.length);
    
    const container = document.getElementById('questions-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    currentQuestions.forEach((question, index) => {
        console.log(`Loading question ${index + 1}`);
        addQuestionToEditor(question, index);
    });
    
    console.log('All questions loaded into editor');
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
    
    if (!container) return;
    
    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-editor';
    questionDiv.setAttribute('data-index', index);
    
    const sourceIndicator = questionData.source === 'aiken_import' ? 
        '<span style="background: #e3f2fd; color: #1368ce; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; margin-left: 10px;">📁 IMPORTED</span>' : '';
    
    questionDiv.innerHTML = `
        <div class="question-header">
            <h4>Question ${index + 1}${sourceIndicator}</h4>
            <div>
                <button onclick="addQuestionAfter(${index})" style="background: #4caf50; color: white; padding: 5px 10px; border: none; border-radius: 5px; cursor: pointer; font-size: 12px; margin-right: 5px;">+ Add Below</button>
                <button onclick="removeQuestion(${index})" style="background: #f44336; color: white; padding: 5px 10px; border: none; border-radius: 5px; cursor: pointer;">Remove</button>
            </div>
        </div>
        
        <div class="input-group">
            <label>Question:</label>
            <input type="text" class="question-input" value="${(questionData.question || '').replace(/"/g, '&quot;')}" placeholder="Enter your question" maxlength="200">
        </div>
        
        <div class="answers-editor">
            <label>Answer Options:</label>
            <div class="answers-grid">
                ${questionData.answers.map((answer, answerIndex) => `
                    <div class="answer-input-group ${questionData.correct === answerIndex ? 'correct-answer' : ''}">
                        <input type="radio" name="correct-${index}" value="${answerIndex}" ${questionData.correct === answerIndex ? 'checked' : ''} onchange="updateCorrectAnswer(${index}, ${answerIndex})">
                        <input type="text" class="answer-input" value="${(answer || '').replace(/"/g, '&quot;')}" placeholder="Answer ${answerIndex + 1}" maxlength="100">
                        <span class="correct-indicator" style="display: ${questionData.correct === answerIndex ? 'inline-block' : 'none'};">✓ CORRECT</span>
                    </div>
                `).join('')}
            </div>
            <small>Select the radio button next to the correct answer (highlighted in green)</small>
        </div>
        
        <div class="input-group">
            <label>Time Limit (seconds):</label>
            <input type="number" class="time-input" value="${questionData.timeLimit || 20}" min="5" max="120">
        </div>
    `;
    
    container.appendChild(questionDiv);
    console.log('Question added to container');
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
    console.log('Starting quiz data collection...');
    const title = document.getElementById('quiz-title').value.trim();
    
    if (!title) {
        showStatus('Please enter a quiz title', 'error');
        return null;
    }
    
    const questionElements = document.querySelectorAll('.question-editor');
    const questions = [];
    
    console.log('Found', questionElements.length, 'question elements');
    
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
        
        // Preserve source information
        if (originalQuestion && originalQuestion.source) {
            questionData.source = originalQuestion.source;
        }
        
        questions.push(questionData);
    }
    
    console.log('Final quiz data collected');
    
    return {
        title: title,
        questions: questions
    };
}

function previewQuiz() {
    const quizData = collectQuizData();
    if (!quizData) return;
    
    document.getElementById('preview-title').textContent = quizData.title;
    document.getElementById('preview-question-count').textContent = quizData.questions.length;
    
    const previewContainer = document.getElementById('preview-questions');
    if (!previewContainer) return;
    
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

function cancelEdit() {
    console.log('Canceling edit mode');
    hasValidationErrors = false;
    
    hideElement('quiz-editor');
    hideElement('quiz-preview');
    showElement('quiz-list-view');
    
    currentEditingQuiz = null;
    currentQuestions = [];
    importedQuestions = [];
    
    resetImportState();
    
    const titleInput = document.getElementById('quiz-title');
    const questionsContainer = document.getElementById('questions-container');
    
    if (titleInput) titleInput.value = '';
    if (questionsContainer) questionsContainer.innerHTML = '';
    
    switchTab('manual');
    
    console.log('Edit mode cancelled');
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
                    cancelEdit();
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

function convertToAikenFormat(quiz) {
    let aikenContent = '';
    
    quiz.questions.forEach((question, index) => {
        if (index > 0) aikenContent += '\n\n';
        
        // Add question
        aikenContent += question.question + '\n';
        
        // Add answers
        question.answers.forEach((answer, answerIndex) => {
            const letter = String.fromCharCode(65 + answerIndex);
            aikenContent += `${letter}) ${answer}\n`;
        });
        
        // Add correct answer
        const correctLetter = String.fromCharCode(65 + question.correct);
        aikenContent += `ANSWER: ${correctLetter}`;
    });
    
    return aikenContent;
}

function downloadAikenFile(quizTitle, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${quizTitle.replace(/[^a-zA-Z0-9]/g, '_')}_aiken.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
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

// Time limit management functions
window.applyTimeToAll = applyTimeToAll;
window.setQuickTime = setQuickTime;
window.updateQuestionTimeLimit = updateQuestionTimeLimit;

// Auto-initialize when page loads
document.addEventListener('DOMContentLoaded', initializeManage);

console.log('Enhanced validation manage.js loaded successfully');