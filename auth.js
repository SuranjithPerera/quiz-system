// Authentication JavaScript
let isSignUpMode = false;
let auth;

// Initialize Firebase Auth
document.addEventListener('DOMContentLoaded', function() {
    auth = firebase.auth();
    
    // Check if user is already logged in
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log('User is signed in:', user.email);
            // Redirect to main app
            window.location.href = 'index.html';
        } else {
            console.log('User is signed out');
        }
    });
    
    initializeAuthForm();
});

function initializeAuthForm() {
    const form = document.getElementById('auth-form');
    const toggleBtn = document.getElementById('toggle-auth');
    const googleBtn = document.getElementById('google-sign-in');
    
    // Form submission
    form.addEventListener('submit', handleFormSubmit);
    
    // Toggle between sign in and sign up - remove existing listener first
    toggleBtn.removeEventListener('click', toggleAuthMode);
    toggleBtn.addEventListener('click', toggleAuthMode);
    
    // Also add onclick as backup
    window.toggleAuthMode = toggleAuthMode;
    
    // Google sign in
    googleBtn.addEventListener('click', signInWithGoogle);
    
    // Real-time form validation
    document.getElementById('email').addEventListener('input', validateEmail);
    document.getElementById('password').addEventListener('input', validatePassword);
    document.getElementById('confirmPassword').addEventListener('input', validateConfirmPassword);
    
    console.log('Auth form initialized, toggle button:', toggleBtn);
}

function handleFormSubmit(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const fullName = document.getElementById('fullName').value.trim();
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validation
    if (!validateForm(email, password, fullName, confirmPassword)) {
        return;
    }
    
    if (isSignUpMode) {
        signUp(email, password, fullName);
    } else {
        signIn(email, password);
    }
}

function validateForm(email, password, fullName, confirmPassword) {
    clearMessages();
    
    if (!email || !password) {
        showMessage('Please fill in all required fields', 'error');
        return false;
    }
    
    if (!validateEmailFormat(email)) {
        showMessage('Please enter a valid email address', 'error');
        return false;
    }
    
    if (password.length < 6) {
        showMessage('Password must be at least 6 characters long', 'error');
        return false;
    }
    
    if (isSignUpMode) {
        if (!fullName) {
            showMessage('Please enter your full name', 'error');
            return false;
        }
        
        if (password !== confirmPassword) {
            showMessage('Passwords do not match', 'error');
            return false;
        }
    }
    
    return true;
}

async function signUp(email, password, fullName) {
    const submitBtn = document.getElementById('auth-submit-btn');
    setLoading(submitBtn, true);
    
    try {
        // Create user account
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Update user profile with display name
        await user.updateProfile({
            displayName: fullName
        });
        
        // Save additional user data to Firebase Database
        await saveUserData(user.uid, {
            email: email,
            displayName: fullName,
            createdAt: Date.now(),
            lastLogin: Date.now(),
            quizCount: 0,
            totalPlays: 0
        });
        
        showMessage('Account created successfully! Redirecting...', 'success');
        
        // Redirect after short delay
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        
    } catch (error) {
        console.error('Sign up error:', error);
        showMessage(getErrorMessage(error.code), 'error');
    } finally {
        setLoading(submitBtn, false);
    }
}

async function signIn(email, password) {
    const submitBtn = document.getElementById('auth-submit-btn');
    setLoading(submitBtn, true);
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Update last login time
        await updateUserData(user.uid, {
            lastLogin: Date.now()
        });
        
        showMessage('Signed in successfully! Redirecting...', 'success');
        
        // Redirect after short delay
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
        
    } catch (error) {
        console.error('Sign in error:', error);
        showMessage(getErrorMessage(error.code), 'error');
    } finally {
        setLoading(submitBtn, false);
    }
}

async function signInWithGoogle() {
    const googleBtn = document.getElementById('google-sign-in');
    setLoading(googleBtn, true);
    
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        
        // Check if this is a new user
        const isNewUser = result.additionalUserInfo?.isNewUser;
        
        if (isNewUser) {
            // Save new user data
            await saveUserData(user.uid, {
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                createdAt: Date.now(),
                lastLogin: Date.now(),
                quizCount: 0,
                totalPlays: 0,
                provider: 'google'
            });
        } else {
            // Update existing user's last login
            await updateUserData(user.uid, {
                lastLogin: Date.now()
            });
        }
        
        showMessage('Signed in with Google successfully! Redirecting...', 'success');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
        
    } catch (error) {
        console.error('Google sign in error:', error);
        if (error.code !== 'auth/popup-closed-by-user') {
            showMessage('Failed to sign in with Google. Please try again.', 'error');
        }
    } finally {
        setLoading(googleBtn, false);
    }
}

async function resetPassword() {
    const email = document.getElementById('email').value.trim();
    
    if (!email) {
        showMessage('Please enter your email address first', 'error');
        return;
    }
    
    if (!validateEmailFormat(email)) {
        showMessage('Please enter a valid email address', 'error');
        return;
    }
    
    try {
        await auth.sendPasswordResetEmail(email);
        showMessage('Password reset email sent! Check your inbox.', 'success');
    } catch (error) {
        console.error('Password reset error:', error);
        showMessage(getErrorMessage(error.code), 'error');
    }
}

function toggleAuthMode() {
    console.log('Toggle auth mode called, current mode:', isSignUpMode);
    
    isSignUpMode = !isSignUpMode;
    
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const submitBtn = document.getElementById('auth-submit-btn');
    const toggleText = document.getElementById('toggle-text');
    const toggleBtn = document.getElementById('toggle-auth');
    const nameGroup = document.getElementById('name-group');
    const confirmPasswordGroup = document.getElementById('confirm-password-group');
    const forgotPassword = document.getElementById('forgot-password');
    
    console.log('Elements found:', {
        title: !!title,
        subtitle: !!subtitle,
        submitBtn: !!submitBtn,
        toggleText: !!toggleText,
        toggleBtn: !!toggleBtn,
        nameGroup: !!nameGroup,
        confirmPasswordGroup: !!confirmPasswordGroup,
        forgotPassword: !!forgotPassword
    });
    
    if (isSignUpMode) {
        // Switch to Sign Up mode
        title.textContent = 'Create Account';
        subtitle.textContent = 'Join QuizMaster to start creating amazing quizzes';
        submitBtn.textContent = 'Sign Up';
        toggleText.textContent = 'Already have an account?';
        toggleBtn.textContent = 'Sign In';
        nameGroup.style.display = 'block';
        confirmPasswordGroup.style.display = 'block';
        forgotPassword.style.display = 'none';
        
        console.log('Switched to Sign Up mode');
    } else {
        // Switch to Sign In mode
        title.textContent = 'Welcome Back';
        subtitle.textContent = 'Sign in to continue to QuizMaster';
        submitBtn.textContent = 'Sign In';
        toggleText.textContent = "Don't have an account?";
        toggleBtn.textContent = 'Sign Up';
        nameGroup.style.display = 'none';
        confirmPasswordGroup.style.display = 'none';
        forgotPassword.style.display = 'block';
        
        console.log('Switched to Sign In mode');
    }
    
    clearMessages();
    clearForm();
    
    console.log('Toggle completed, new mode:', isSignUpMode);
}

// Helper functions
async function saveUserData(uid, userData) {
    return database.ref(`users/${uid}`).set(userData);
}

async function updateUserData(uid, updates) {
    return database.ref(`users/${uid}`).update(updates);
}

function validateEmail() {
    const email = document.getElementById('email').value.trim();
    const emailInput = document.getElementById('email');
    
    if (email && !validateEmailFormat(email)) {
        emailInput.style.borderColor = '#f44336';
    } else {
        emailInput.style.borderColor = '#ddd';
    }
}

function validatePassword() {
    const password = document.getElementById('password').value;
    const passwordInput = document.getElementById('password');
    
    if (password && password.length < 6) {
        passwordInput.style.borderColor = '#f44336';
    } else {
        passwordInput.style.borderColor = '#ddd';
    }
}

function validateConfirmPassword() {
    if (!isSignUpMode) return;
    
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const confirmPasswordInput = document.getElementById('confirmPassword');
    
    if (confirmPassword && password !== confirmPassword) {
        confirmPasswordInput.style.borderColor = '#f44336';
    } else {
        confirmPasswordInput.style.borderColor = '#ddd';
    }
}

function validateEmailFormat(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showMessage(message, type) {
    const container = document.getElementById('message-container');
    container.innerHTML = `
        <div class="${type}-message">
            ${message}
        </div>
    `;
}

function clearMessages() {
    document.getElementById('message-container').innerHTML = '';
}

function clearForm() {
    document.getElementById('auth-form').reset();
    // Reset input border colors
    const inputs = document.querySelectorAll('.form-group input');
    inputs.forEach(input => {
        input.style.borderColor = '#ddd';
    });
}

function setLoading(button, loading) {
    if (loading) {
        button.disabled = true;
        const originalText = button.textContent;
        button.innerHTML = `
            <span class="loading"></span>
            ${originalText}
        `;
    } else {
        button.disabled = false;
        button.innerHTML = button.textContent.replace(/^.*?(\w+)$/, '$1');
    }
}

function getErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/user-not-found':
            return 'No account found with this email address.';
        case 'auth/wrong-password':
            return 'Incorrect password. Please try again.';
        case 'auth/email-already-in-use':
            return 'An account with this email already exists.';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters long.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please try again later.';
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection.';
        default:
            return 'An error occurred. Please try again.';
    }
}