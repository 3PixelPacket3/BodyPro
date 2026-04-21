// fitness.js - BodyPro Training Hub Logic

import { auth } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- PROGRESSIVE WEB APP REGISTRATION ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => console.log('[BodyPro System] Service Worker Registered', reg))
            .catch(err => console.error('[BodyPro System] SW Registration Failed', err));
    });
}

// --- DOM Elements ---
// Timers: Resistance & Cardio
const displayLift = document.getElementById('displayLift');
const btnToggleLift = document.getElementById('btnToggleLift');
const btnResetLift = document.getElementById('btnResetLift');
const displayCardio = document.getElementById('displayCardio');
const btnToggleCardio = document.getElementById('btnToggleCardio');
const btnResetCardio = document.getElementById('btnResetCardio');

// Timers: Rest Engine
const displayRest = document.getElementById('displayRest');
const customRestInput = document.getElementById('customRestInput');

// Session Logger
const workoutTitle = document.getElementById('workoutTitle');
const inputAvgHR = document.getElementById('inputAvgHR');
const inputWorkoutCals = document.getElementById('inputWorkoutCals');
const setList = document.getElementById('setList');
const btnAddSet = document.getElementById('btnAddSet');
const btnFinishWorkout = document.getElementById('btnFinishWorkout');

// Templates
const templateSelect = document.getElementById('templateSelect');
const btnSaveAsTemplate = document.getElementById('btnSaveAsTemplate');
const btnLoadTemplate = document.getElementById('btnLoadTemplate');
const templatesListContainer = document.getElementById('templatesListContainer');

// History
const historyListContainer = document.getElementById('historyListContainer');
const viewSessionModal = document.getElementById('viewSessionModal');

// --- STATE MANAGEMENT ---
let userData = null;

let liftTimer = null;
let liftSeconds = 0;
let isLiftRunning = false;

let cardioTimer = null;
let cardioSeconds = 0;
let isCardioRunning = false;

let restTimer = null;
let restSecondsRemaining = 0;

let currentViewSessionId = null;

// --- THE SECURITY GUARD ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }
    userData = await window.BodyProDataStore.getData();
    
    // Ensure data structures exist
    userData.workout_templates = userData.workout_templates || [];
    
    populateExerciseDatalist();
    updateTemplateDropdown();
    btnAddSet.click(); // Add initial blank row
    
    // Request Notification Permissions for Rest Engine
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
});

// --- CHRONOGRAPH LOGIC ---
function formatTime(totalSeconds) {
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    if (h === "00") return `${m}:${s}`;
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
        btnToggleLift.style.background = 'var(--primary)';
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
        btnToggleCardio.style.background = 'var(--accent)';
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

// Rest Timer Engine with Background Notifications
window.startRestTimer = function(seconds) {
    clearInterval(restTimer);
    restSecondsRemaining = seconds;
    displayRest.innerText = formatTime(restSecondsRemaining);
    displayRest.style.color = 'var(--warning)';

    // Ask for permission if not already granted, just in case
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }

    restTimer = setInterval(() => {
        restSecondsRemaining--;
        if (restSecondsRemaining <= 0) {
            clearInterval(restTimer);
            displayRest.innerText = "00:00";
            displayRest.style.color = 'var(--danger)';
            
            // Trigger Native Notification
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification("Rest Interval Complete", {
                    body: "Time to get back to the bar. Prepare for your next set.",
                    icon: "icon-192.png"
                });
            }
        } else {
            displayRest.innerText = formatTime(restSecondsRemaining);
        }
    }, 1000);
};

window.startCustomRest = function() {
    const secs = parseInt(customRestInput.value);
    if (secs > 0) {
        window.startRestTimer(secs);
    }
};

window.stopRestTimer = function() {
    clearInterval(restTimer);
    displayRest.innerText = "00:00";
    displayRest.style.color = 'var(--warning)';
};

// --- PRESET MOVEMENT LIBRARY ---
function populateExerciseDatalist() {
    const datalist = document.getElementById('presetExercises');
    const exercises = [
        // Chest
        "Bench Press (Barbell) [Chest]", "Bench Press (Dumbbell) [Chest]", "Incline Bench Press [Chest]", 
        "Decline Bench Press [Chest]", "Chest Fly (Cable) [Chest]", "Chest Fly (Dumbbell) [Chest]", 
        "Push-Up [Chest]", "Pec Deck Machine [Chest]",
        // Back
        "Deadlift (Barbell) [Back/Legs]", "Pull-Up [Back]", "Chin-Up [Back]", "Lat Pulldown (Cable) [Back]", 
        "Bent Over Row (Barbell) [Back]", "Dumbbell Row [Back]", "Seated Cable Row [Back]", "T-Bar Row [Back]",
        // Shoulders
        "Overhead Press (Barbell) [Shoulders]", "Overhead Press (Dumbbell) [Shoulders]", "Arnold Press [Shoulders]", 
        "Lateral Raise (Dumbbell) [Shoulders]", "Front Raise (Dumbbell) [Shoulders]", "Reverse Pec Deck [Shoulders]", 
        "Face Pull (Cable) [Shoulders]", "Shrugs (Dumbbell/Barbell) [Traps]",
        // Legs
        "Squat (Barbell) [Quads/Glutes]", "Front Squat [Quads]", "Leg Press [Quads/Glutes]", "Lunge (Dumbbell) [Legs]", 
        "Bulgarian Split Squat [Legs]", "Leg Extension (Machine) [Quads]", "Leg Curl (Machine) [Hamstrings]", 
        "Romanian Deadlift [Hamstrings]", "Calf Raise (Standing) [Calves]", "Calf Raise (Seated) [Calves]",
        // Arms
        "Bicep Curl (Barbell) [Biceps]", "Bicep Curl (Dumbbell) [Biceps]", "Hammer Curl [Biceps]", 
        "Preacher Curl [Biceps]", "Tricep Extension (Cable) [Triceps]", "Skullcrusher [Triceps]", 
        "Tricep Kickback [Triceps]", "Dips [Triceps/Chest]",
        // Core
        "Crunch [Core]", "Plank [Core]", "Russian Twist [Core]", "Hanging Leg Raise [Core]", 
        "Cable Woodchopper [Core]", "Ab Wheel Rollout [Core]"
    ];

    exercises.sort().forEach(ex => {
        const option = document.createElement('option');
        option.value = ex;
        datalist.appendChild(option);
    });
}

// --- SESSION LOGGER (LIVE GRID) ---
btnAddSet.addEventListener('click', () => {
    const row = document.createElement('div');
    row.className = 'exercise-row';
    row.innerHTML = `
        <input type="text" class="exercise-input ex-name" placeholder="Movement" list="presetExercises">
        <input type="number" class="exercise-input ex-weight" placeholder="0">
        <input type="number" class="exercise-input ex-reps" placeholder="0">
        <input type="number" class="exercise-input ex-rpe" placeholder="7" max="10">
        <button class="btn-remove-set" onclick="removeSetRow(this)"><i class="fa-solid fa-trash-can"></i></button>
    `;
    setList.appendChild(row);
    row.querySelector('.ex-name').focus();
});

window.removeSetRow = function(btnElement) {
    const row = btnElement.closest('.exercise-row');
    if (row && setList.children.length > 1) {
        row.remove();
    } else if (setList.children.length === 1) {
        row.querySelector('.ex-name').value = '';
        row.querySelector('.ex-weight').value = '';
        row.querySelector('.ex-reps').value = '';
        row.querySelector('.ex-rpe').value = '';
    }
};

// --- TEMPLATE MANAGEMENT ---
function updateTemplateDropdown() {
    templateSelect.innerHTML = '<option value="">-- Select Template to Load --</option>';
    (userData.workout_templates || []).forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.innerText = t.title;
        templateSelect.appendChild(opt);
    });
}

btnSaveAsTemplate.addEventListener('click', async () => {
    const title = workoutTitle.value.trim();
    if (!title) return alert("Please enter a Workout Title to save as a template.");

    const exercises = [];
    const rows = setList.querySelectorAll('.exercise-row');
    rows.forEach(row => {
        const name = row.querySelector('.ex-name').value.trim();
        if (name) exercises.push({ exercise: name });
    });

    if (exercises.length === 0) return alert("Cannot save an empty template.");

    const newTemplate = {
        id: 'tpl_' + Date.now(),
        title: title,
        exercises: exercises,
        timestamp: new Date().toISOString()
    };

    userData.workout_templates.push(newTemplate);
    const success = await window.BodyProDataStore.saveData(userData);

    if (success) {
        updateTemplateDropdown();
        btnSaveAsTemplate.innerHTML = '<i class="fa-solid fa-check"></i> Saved';
        setTimeout(() => btnSaveAsTemplate.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save as Template', 2000);
    }
});

btnLoadTemplate.addEventListener('click', () => {
    const tplId = templateSelect.value;
    if (!tplId) return;

    const tpl = userData.workout_templates.find(t => t.id === tplId);
    if (!tpl) return;

    workoutTitle.value = tpl.title;
    setList.innerHTML = '';

    tpl.exercises.forEach(ex => {
        const row = document.createElement('div');
        row.className = 'exercise-row';
        row.innerHTML = `
            <input type="text" class="exercise-input ex-name" value="${ex.exercise}" list="presetExercises">
            <input type="number" class="exercise-input ex-weight" placeholder="0">
            <input type="number" class="exercise-input ex-reps" placeholder="0">
            <input type="number" class="exercise-input ex-rpe" placeholder="7" max="10">
            <button class="btn-remove-set" onclick="removeSetRow(this)"><i class="fa-solid fa-trash-can"></i></button>
        `;
        setList.appendChild(row);
    });
});

window.renderTemplatesManager = function() {
    templatesListContainer.innerHTML = '';
    const templates = userData.workout_templates || [];

    if (templates.length === 0) {
        templatesListContainer.innerHTML = '<p class="text-muted" style="text-align: center; font-size: 0.9rem;">No templates saved.</p>';
        return;
    }

    templates.forEach(t => {
        const el = document.createElement('div');
        el.className = 'history-list-item';
        el.innerHTML = `
            <div>
                <h4 style="margin: 0 0 4px 0; font-size: 1rem;">${t.title}</h4>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${t.exercises.length} Movements</div>
            </div>
            <button class="btn btn-ghost" style="padding: 6px 12px; border-color: transparent; color: var(--danger);" onclick="deleteTemplate('${t.id}')">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
        templatesListContainer.appendChild(el);
    });
};

window.deleteTemplate = async function(id) {
    if(confirm("Permanently delete this template?")) {
        userData.workout_templates = userData.workout_templates.filter(t => t.id !== id);
        window.renderTemplatesManager();
        updateTemplateDropdown();
        await window.BodyProDataStore.saveData(userData);
    }
};

// --- HISTORY & VAULT MANAGEMENT ---
window.renderHistoryVault = function() {
    historyListContainer.innerHTML = '';
    const workouts = [...(userData.workouts || [])].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (workouts.length === 0) {
        historyListContainer.innerHTML = '<p class="text-muted" style="text-align: center; font-size: 0.9rem;">No sessions logged.</p>';
        return;
    }

    workouts.forEach(wk => {
        const el = document.createElement('div');
        el.className = 'history-list-item';
        el.style.cursor = 'pointer';
        
        const dateStr = new Date(wk.timestamp).toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
        
        el.innerHTML = `
            <div style="flex: 1;" onclick="viewSession('${wk.id}')">
                <h4 style="margin: 0 0 4px 0; font-size: 1rem; color: var(--primary);">${wk.title || 'Untitled Session'}</h4>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${dateStr} | ${(wk.sets || []).length} Sets</div>
            </div>
            <i class="fa-solid fa-chevron-right text-muted" style="margin-left: 10px;" onclick="viewSession('${wk.id}')"></i>
        `;
        historyListContainer.appendChild(el);
    });
};

window.viewSession = function(id) {
    const wk = userData.workouts.find(w => w.id === id);
    if (!wk) return;

    currentViewSessionId = id;
    
    document.getElementById('viewSessionTitle').innerText = wk.title || 'Untitled Session';
    document.getElementById('viewSessionDate').innerText = new Date(wk.timestamp).toLocaleDateString('en-US', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
    
    const totalDuration = Math.round((wk.durationLift + wk.durationCardio) / 60);
    document.getElementById('viewSessionDuration').innerText = `${totalDuration} mins`;
    document.getElementById('viewSessionCals').innerText = wk.telemetry?.activeCals || 0;

    const setsContainer = document.getElementById('viewSessionSets');
    setsContainer.innerHTML = '';

    if (wk.sets && wk.sets.length > 0) {
        wk.sets.forEach((s, idx) => {
            setsContainer.innerHTML += `
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; ${idx === wk.sets.length - 1 ? 'border:none;' : ''}">
                    <div style="font-weight: 600;">${s.exercise}</div>
                    <div class="text-muted">${s.weight} lbs</div>
                    <div class="text-muted">${s.reps} reps</div>
                    <div class="text-muted">1RM: ${s.est1RM || 0}</div>
                </div>
            `;
        });
    } else {
        setsContainer.innerHTML = '<div class="text-muted" style="font-size: 0.85rem; padding: 10px 0;">No set data recorded. Time/Cardio only.</div>';
    }

    viewSessionModal.classList.add('active');
};

document.getElementById('btnDeleteSession').addEventListener('click', async () => {
    if (!currentViewSessionId) return;
    
    if(confirm("Permanently delete this session from your history? This will affect your analytics.")) {
        userData.workouts = userData.workouts.filter(w => w.id !== currentViewSessionId);
        await window.BodyProDataStore.saveData(userData);
        viewSessionModal.classList.remove('active');
        window.renderHistoryVault();
    }
});

// --- SESSION COMPLETION, 1RM CALCULATION & SAVING ---
btnFinishWorkout.addEventListener('click', async () => {
    const title = workoutTitle.value.trim() || "Uncategorized Session";
    const avgHR = parseInt(inputAvgHR.value) || 0;
    const activeCals = parseInt(inputWorkoutCals.value) || 0;
    
    // Harvest the sets and calculate progression telemetry
    const sets = [];
    const rows = setList.querySelectorAll('.exercise-row');
    
    rows.forEach(row => {
        const name = row.querySelector('.ex-name').value.trim();
        const weight = parseFloat(row.querySelector('.ex-weight').value) || 0;
        const reps = parseInt(row.querySelector('.ex-reps').value) || 0;
        const rpe = parseInt(row.querySelector('.ex-rpe').value) || 0;
        
        if (name) {
            // Volume Load Calculation
            const volume = weight * reps;
            
            // Epley 1RM Formula
            let est1RM = weight;
            if (reps > 1) {
                est1RM = weight * (1 + (reps / 30));
            }
            
            sets.push({ 
                exercise: name, 
                weight: weight, 
                reps: reps, 
                rpe: rpe,
                volume: volume,
                est1RM: Math.round(est1RM)
            });
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

    userData.workouts = userData.workouts || [];
    userData.workouts.push(workoutPayload);
    
    // Save to the cloud
    const success = await window.BodyProDataStore.saveData(userData);

    if (success) {
        // Reset the UI for the next session
        btnResetLift.click();
        btnResetCardio.click();
        window.stopRestTimer();
        workoutTitle.value = '';
        inputAvgHR.value = '';
        inputWorkoutCals.value = '';
        setList.innerHTML = '';
        btnAddSet.click(); // Add one blank row back
        
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
