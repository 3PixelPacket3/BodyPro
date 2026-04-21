// settings.js - BodyPro System Calibration & Profile Logic

import { auth } from './data-store.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- DOM Elements ---
// Goals
const setWeightGoal = document.getElementById('setWeightGoal');
const setWorkoutDays = document.getElementById('setWorkoutDays');
const setLiftMins = document.getElementById('setLiftMins');
const setCardioMins = document.getElementById('setCardioMins');

// Macros
const setCals = document.getElementById('setCals');
const setProt = document.getElementById('setProt');
const setCarb = document.getElementById('setCarb');
const setFat = document.getElementById('setFat');

// Supplements
const suppListContainer = document.getElementById('suppListContainer');
const newSuppName = document.getElementById('newSuppName');
const btnAddSupp = document.getElementById('btnAddSupp');

// Actions
const btnSaveSettings = document.getElementById('btnSaveSettings');
const btnLogout = document.getElementById('btnLogout');

// --- STATE MANAGEMENT ---
let userData = null;

// --- THE SECURITY GUARD ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }
    userData = await window.BodyProDataStore.getData();
    populateCalibrationMatrix();
});

// --- UI INITIALIZATION ---
function populateCalibrationMatrix() {
    const settings = userData.settings || {};
    const goals = settings.goals || {};
    const macros = settings.macroTargets || {};

    // Populate Goals
    setWeightGoal.value = goals.weeklyWeightLoss || -1.5;
    setWorkoutDays.value = goals.workoutDaysPerWeek || 6;
    setLiftMins.value = goals.targetLiftingMinutes || 90;
    setCardioMins.value = goals.targetCardioMinutes || 20;

    // Populate Macros
    setCals.value = macros.calories || 2200;
    setProt.value = macros.protein || 200;
    setCarb.value = macros.carbs || 150;
    setFat.value = macros.fats || 88;

    renderSupplements();
}

// --- SUPPLEMENT MANAGEMENT ---
function renderSupplements() {
    suppListContainer.innerHTML = '';
    const supps = userData.settings.dailySupplements || [];

    if (supps.length === 0) {
        suppListContainer.innerHTML = '<p class="text-muted" style="margin:0; font-size: 0.85rem;">No active supplements.</p>';
        return;
    }

    supps.forEach((supp, index) => {
        const item = document.createElement('div');
        item.className = 'supp-manager-item';
        item.innerHTML = `
            <span>${supp.name}</span>
            <button class="btn btn-ghost" style="padding: 5px 10px; border: none; color: var(--danger);" onclick="removeSupplement(${index})">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
        suppListContainer.appendChild(item);
    });
}

btnAddSupp.addEventListener('click', () => {
    const name = newSuppName.value.trim();
    if (!name) return;

    userData.settings.dailySupplements = userData.settings.dailySupplements || [];
    
    // Prevent duplicates
    if (userData.settings.dailySupplements.some(s => s.name.toLowerCase() === name.toLowerCase())) {
        alert("This supplement is already in your matrix.");
        return;
    }

    userData.settings.dailySupplements.push({ name: name, logged: false });
    newSuppName.value = '';
    renderSupplements();
});

// Attach globally for inline onclick execution
window.removeSupplement = function(index) {
    userData.settings.dailySupplements.splice(index, 1);
    renderSupplements();
};

// --- SAVE PROTOCOLS ---
btnSaveSettings.addEventListener('click', async () => {
    btnSaveSettings.disabled = true;
    btnSaveSettings.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Encrypting & Saving...';

    // Harvest Goal Values
    userData.settings.goals = {
        weeklyWeightLoss: parseFloat(setWeightGoal.value) || -1.5,
        workoutDaysPerWeek: parseInt(setWorkoutDays.value) || 6,
        targetLiftingMinutes: parseInt(setLiftMins.value) || 90,
        targetCardioMinutes: parseInt(setCardioMins.value) || 20
    };

    // Harvest Macro Values
    userData.settings.macroTargets = {
        calories: parseInt(setCals.value) || 2200,
        protein: parseInt(setProt.value) || 200,
        carbs: parseInt(setCarb.value) || 150,
        fats: parseInt(setFat.value) || 88
    };

    const success = await window.BodyProDataStore.saveData(userData);

    if (success) {
        btnSaveSettings.innerHTML = '<i class="fa-solid fa-check"></i> Calibration Saved';
        setTimeout(() => {
            btnSaveSettings.disabled = false;
            btnSaveSettings.innerHTML = '<i class="fa-solid fa-hard-drive"></i> Save Calibration';
        }, 2000);
    } else {
        alert("System Error: Failed to synchronize calibration to the cloud.");
        btnSaveSettings.disabled = false;
        btnSaveSettings.innerHTML = '<i class="fa-solid fa-hard-drive"></i> Save Calibration';
    }
});

// --- SECURITY PROTOCOLS ---
btnLogout.addEventListener('click', async () => {
    if (confirm("Are you sure you wish to terminate the secure session?")) {
        try {
            await signOut(auth);
            // The auth state listener at the top will automatically redirect to login.html
        } catch (error) {
            console.error("Logout Error:", error);
            alert("System Error: Failed to securely terminate session.");
        }
    }
});
