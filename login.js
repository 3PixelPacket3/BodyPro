// login.js - BodyPro Authentication Logic

import { auth } from './data-store.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendPasswordResetEmail, 
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- DOM Elements ---
const btnLogin = document.getElementById('btnLogin');
const btnRegister = document.getElementById('btnRegister');
const btnReset = document.getElementById('btnReset');
const btnGoogleLogin = document.getElementById('btnGoogleLogin');
const authMessage = document.getElementById('authMessage');

// --- THE SECURITY GUARD ---
// Automatically redirect users if they are already logged in
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.replace('dashboard.html');
    }
});

// --- HELPER: Display Messages ---
function showMessage(msg, isError = false) {
    if (!authMessage) return;
    authMessage.innerText = msg;
    authMessage.style.color = isError ? 'var(--danger)' : 'var(--accent)';
}

// --- HELPER: Error Translator ---
function getFriendlyErrorMessage(error) {
    switch (error.code) {
        case 'auth/api-key-not-valid': return "System Error: Invalid connection key. Please check the database configuration.";
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found': return "Incorrect email or password. Please try again.";
        case 'auth/email-already-in-use': return "An account is already registered to this email address.";
        case 'auth/weak-password': return "Your password is too weak. Please use at least 6 characters.";
        case 'auth/invalid-email': return "Please enter a valid email address.";
        case 'auth/network-request-failed': return "Network connection failed. Please check your internet.";
        case 'auth/popup-closed-by-user': return "Google Sign-In was cancelled.";
        default: return `System Error (${error.code}): ${error.message}`;
    }
}

// --- GOOGLE AUTHENTICATION LOGIC ---
if (btnGoogleLogin) {
    btnGoogleLogin.addEventListener('click', async () => {
        btnGoogleLogin.disabled = true;
        showMessage("Initiating Google Secure Sign-In...");
        
        const provider = new GoogleAuthProvider();
        
        try {
            await signInWithPopup(auth, provider);
            // On success, the security guard at the top will automatically redirect the user
        } catch (error) {
            showMessage(getFriendlyErrorMessage(error), true);
            btnGoogleLogin.disabled = false;
        }
    });
}

// --- EMAIL LOGIN LOGIC ---
if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
        const email = document.getElementById('authEmail').value.trim();
        const pass = document.getElementById('authPassword').value;
        
        if (!email || !pass) {
            return showMessage("Please enter an email and password.", true);
        }
        
        btnLogin.disabled = true;
        showMessage("Establishing secure connection...");
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (error) {
            showMessage(getFriendlyErrorMessage(error), true);
            btnLogin.disabled = false;
        }
    });
}

// --- REGISTRATION LOGIC ---
if (btnRegister) {
    btnRegister.addEventListener('click', async () => {
        const email = document.getElementById('authEmail').value.trim();
        const pass = document.getElementById('authPassword').value;
        
        if (!email || !pass) {
            return showMessage("Please enter an email and password.", true);
        }

        btnRegister.disabled = true;
        showMessage("Forging new credentials...");
        try {
            await createUserWithEmailAndPassword(auth, email, pass);
        } catch (error) {
            showMessage(getFriendlyErrorMessage(error), true);
            btnRegister.disabled = false;
        }
    });
}

// --- PASSWORD RESET LOGIC ---
if (btnReset) {
    btnReset.addEventListener('click', async () => {
        const email = document.getElementById('authEmail').value.trim();
        
        if (!email) {
            return showMessage("Please enter your email address to reset your password.", true);
        }

        showMessage("Transmitting reset protocols...");
        try {
            await sendPasswordResetEmail(auth, email);
            showMessage("Reset link dispatched. Please check your inbox.");
        } catch (error) {
            showMessage(getFriendlyErrorMessage(error), true);
        }
    });
}
