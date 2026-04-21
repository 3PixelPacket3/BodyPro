// fitness.js - BodyPro Training Hub Logic

import { auth } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- DOM Elements ---
const displayLift = document.getElementById('displayLift');
const btnToggleLift = document.getElementById('btnToggleLift');
const btnResetLift = document.getElementById('btnResetLift');

const displayCardio = document.getElementById('displayCardio');
const btnToggleCardio = document.getElementById('btnToggleCardio');
const btnResetCardio = document.getElementById('btnResetCardio');

const workoutTitle = document.getElementById('workoutTitle');
const inputAvgHR = document.getElementById('inputAvgHR');
const inputWorkoutCals = document.getElementById('inputWorkoutCals');
const setList = document.getElementById('setList');
const btnFinishWorkout = document.getElementById('btnFinishWorkout');

// --- STATE MANAGEMENT ---
let userData = null;

let liftTimer = null;
let liftSeconds = 0;
let isLiftRunning = false;

let cardioTimer = null;
let cardioSeconds = 0;
let isCardioRunning = false;

// --- THE SECURITY GUARD ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }
    userData = await window.BodyProDataStore.getData();
});

// --- CHRONOGRAPH LOGIC ---
function formatTime(totalSeconds) {
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

// Resistance Timer
btnToggleLift.addEventListener('click', () => {
    if (isLiftRunning) {
        clearInterval(liftTimer);
        btnToggleLift.innerHTML = '<i class="fa-solid fa-play"></i> Resume';
        btnToggleLift.style.background = 'var(--bg-surface-elevated)';
    } else {
        liftTimer = setInterval(() => {
            liftSeconds++;
            displayLift.innerText = formatTime(liftSeconds);
        }, 1000);
        btnToggleLift.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
        btnToggleLift.style.background = 'var(--warning)';
    }
    isLiftRunning = !isLiftRunning;
});

btnResetLift.addEventListener('click', () => {
    clearInterval(liftTimer);
    liftSeconds = 0;
    isLiftRunning = false;
    displayLift.innerText = "00:00:00";
    btnToggleLift.innerHTML = '<i class="fa-solid fa-play"></i> Start';
    btnToggleLift.style.background = 'var(--bg-surface-elevated)';
});

// Conditioning Timer
btnToggleCardio.addEventListener('click', () => {
    if (isCardioRunning) {
        clearInterval(cardioTimer);
        btnToggleCardio.innerHTML = '<i class="fa-solid fa-play"></i> Resume';
        btnToggleCardio.style.background = 'var(--bg-surface-elevated)';
    } else {
        cardioTimer = setInterval(() => {
            cardioSeconds++;
            displayCardio.innerText = formatTime(cardioSeconds);
        }, 1000);
        btnToggleCardio.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
        btnToggleCardio.style.background = 'var(--warning)';
    }
    isCardioRunning = !isCardioRunning;
});

btnResetCardio.addEventListener('click', () => {
    clearInterval(cardioTimer);
    cardioSeconds = 0;
    isCardioRunning = false;
    displayCardio.innerText = "00:00:00";
    btnToggleCardio.innerHTML = '<i class="fa-solid fa-play"></i> Start';
    btnToggleCardio.style.background = 'var(--bg-surface-elevated)';
});

// --- SESSION COMPILATION & SAVING ---
btnFinishWorkout.addEventListener('click', async () => {
    const title = workoutTitle.value.trim() || "Uncategorized Session";
    const avgHR = parseInt(inputAvgHR.value) || 0;
    const activeCals = parseInt(inputWorkoutCals.value) || 0;
    
    // Harvest the sets
    const sets = [];
    const rows = setList.querySelectorAll('.exercise-row');
    
    rows.forEach(row => {
        const name = row.querySelector('.ex-name').value.trim();
        const weight = parseFloat(row.querySelector('.ex-weight').value) || 0;
        const reps = parseInt(row.querySelector('.ex-reps').value) || 0;
        const rpe = parseInt(row.querySelector('.ex-rpe').value) || 0;
        
        if (name) {
            sets.push({ exercise: name, weight, reps, rpe });
        }
    });

    if (sets.length === 0 && liftSeconds === 0 && cardioSeconds === 0) {
        alert("Cannot save an empty session. Please log time or sets.");
        return;
    }

    btnFinishWorkout.disabled = true;
    btnFinishWorkout.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Encrypting & Saving...';

    // Construct the secure payload
    const workoutPayload = {
        id: 'wkout_' + Date.now(),
        date: new Date().toLocaleDateString('en-CA'),
        timestamp: new Date().toISOString(),
        title: title,
        durationLift: liftSeconds,
        durationCardio: cardioSeconds,
        telemetry: {
            avgHR: avgHR,
            activeCals: activeCals
        },
        sets: sets
    };

    userData.workouts.push(workoutPayload);
    
    // Save to the cloud
    const success = await window.BodyProDataStore.saveData(userData);

    if (success) {
        // Reset the UI for the next session
        btnResetLift.click();
        btnResetCardio.click();
        workoutTitle.value = '';
        inputAvgHR.value = '';
        inputWorkoutCals.value = '';
        setList.innerHTML = '';
        document.getElementById('btnAddSet').click(); // Add one blank row back
        
        btnFinishWorkout.innerHTML = '<i class="fa-solid fa-check"></i> Session Saved';
        setTimeout(() => {
            btnFinishWorkout.disabled = false;
            btnFinishWorkout.innerHTML = '<i class="fa-solid fa-check-double"></i> Complete & Save Session';
        }, 3000);
    } else {
        alert("System Error: Failed to synchronize session to the cloud.");
        btnFinishWorkout.disabled = false;
        btnFinishWorkout.innerHTML = '<i class="fa-solid fa-check-double"></i> Complete & Save Session';
    }
});
