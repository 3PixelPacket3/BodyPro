import { auth } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- DOM Elements ---
const displayLift = document.getElementById('displayLift');
const btnToggleLift = document.getElementById('btnToggleLift');
const btnResetLift = document.getElementById('btnResetLift');
const displayCardio = document.getElementById('displayCardio');
const btnToggleCardio = document.getElementById('btnToggleCardio');
const btnResetCardio = document.getElementById('btnResetCardio');

const displayRest = document.getElementById('displayRest');
const customRestInput = document.getElementById('customRestInput');
const chkAutoRest = document.getElementById('chkAutoRest');

const workoutTitle = document.getElementById('workoutTitle');
const inputAvgHR = document.getElementById('inputAvgHR');
const inputWorkoutCals = document.getElementById('inputWorkoutCals');
const workoutLogArea = document.getElementById('workoutLogArea');
const btnFinishWorkout = document.getElementById('btnFinishWorkout');

const templateSelect = document.getElementById('templateSelect');
const btnSaveAsTemplate = document.getElementById('btnSaveAsTemplate');
const btnLoadTemplate = document.getElementById('btnLoadTemplate');
const btnFitnessTimeCrunch = document.getElementById('btnFitnessTimeCrunch');
const templatesListContainer = document.getElementById('templatesListContainer');
const weeklySplitSchedulerContainer = document.getElementById('weeklySplitSchedulerContainer');
const btnSaveWeeklySplit = document.getElementById('btnSaveWeeklySplit');

const historyListContainer = document.getElementById('historyListContainer');
const viewSessionModal = document.getElementById('viewSessionModal');

// Plate Calculator DOM
const plateTargetWeight = document.getElementById('plateTargetWeight');
const plateBarWeight = document.getElementById('plateBarWeight');
const plateVisualContainer = document.getElementById('plateVisualContainer');
const plateTextSummary = document.getElementById('plateTextSummary');
const warmupRampPreview = document.getElementById('warmupRampPreview');
const btnInjectWarmupSets = document.getElementById('btnInjectWarmupSets');

// --- STATE MANAGEMENT ---
const DRAFT_KEY = 'bodypro_active_workout_draft_v3';
let userData = null;

// Background-Safe Timestamp Delta Timers
let liftTimer = null;
let liftSeconds = 0;
let liftStartEpoch = null;
let isLiftRunning = false;

let cardioTimer = null;
let cardioSeconds = 0;
let cardioStartEpoch = null;
let isCardioRunning = false;

let restTimer = null;
let restSecondsRemaining = 0;
let restEndEpoch = null;

let currentViewSessionId = null;

// --- INITIALIZATION ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }
    userData = await window.BodyProDataStore.getData();
    userData.workout_templates = userData.workout_templates || [];
    
    updateTemplateDropdown();

    // Check if Dashboard launched a specific protocol
    const launchTplId = sessionStorage.getItem('bodypro_launch_template_id');
    const launchTimeCrunch = sessionStorage.getItem('bodypro_launch_time_crunch') === '1';
    if (launchTplId) {
        sessionStorage.removeItem('bodypro_launch_template_id');
        sessionStorage.removeItem('bodypro_launch_time_crunch');
        templateSelect.value = launchTplId;
        loadTemplateById(launchTplId, launchTimeCrunch);
    } else if (!restoreWorkoutDraft()) {
        handleAddMovement();
    }
    
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
});

// --- LIVE WORKOUT DRAFT PERSISTENCE ---
function saveWorkoutDraft() {
    if (btnFinishWorkout.dataset.editModeId) return; // Don't overwrite draft when editing historical
    const movements = [];
    workoutLogArea.querySelectorAll('.movement-group').forEach(group => {
        const name = group.querySelector('.ex-name')?.value || '';
        const sets = [];
        group.querySelectorAll('.set-row').forEach(row => {
            sets.push({
                type: row.querySelector('.set-type-badge')?.dataset.type || 'N',
                weight: row.querySelector('.ex-weight')?.value || '',
                reps: row.querySelector('.ex-reps')?.value || '',
                rpe: row.querySelector('.ex-rpe')?.value || '',
                done: row.querySelector('.btn-complete-set')?.classList.contains('completed') || false
            });
        });
        movements.push({ name, sets });
    });

    const draft = {
        title: workoutTitle.value,
        avgHR: inputAvgHR.value,
        activeCals: inputWorkoutCals.value,
        liftSeconds,
        isLiftRunning,
        liftStartEpoch,
        cardioSeconds,
        isCardioRunning,
        cardioStartEpoch,
        movements,
        savedAt: Date.now()
    };
    try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {}
}

function clearWorkoutDraft() {
    try {
        localStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
}

function restoreWorkoutDraft() {
    try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return false;
        const draft = JSON.parse(raw);
        if (!draft || (Date.now() - draft.savedAt) > 1000 * 60 * 60 * 18) {
            clearWorkoutDraft();
            return false;
        }
        const hasContent = draft.title || draft.liftSeconds > 0 || draft.cardioSeconds > 0 ||
            (draft.movements && draft.movements.some(m => m.name || m.sets.some(s => s.weight || s.reps)));
        if (!hasContent) return false;

        workoutTitle.value = draft.title || '';
        inputAvgHR.value = draft.avgHR || '';
        inputWorkoutCals.value = draft.activeCals || '';

        liftSeconds = draft.liftSeconds || 0;
        if (draft.isLiftRunning && draft.liftStartEpoch) {
            liftSeconds = Math.floor((Date.now() - draft.liftStartEpoch) / 1000);
            startLiftInterval(draft.liftStartEpoch);
        } else {
            displayLift.innerText = formatTime(liftSeconds);
        }

        cardioSeconds = draft.cardioSeconds || 0;
        if (draft.isCardioRunning && draft.cardioStartEpoch) {
            cardioSeconds = Math.floor((Date.now() - draft.cardioStartEpoch) / 1000);
            startCardioInterval(draft.cardioStartEpoch);
        } else {
            displayCardio.innerText = formatTime(cardioSeconds);
        }

        workoutLogArea.innerHTML = '';
        (draft.movements || []).forEach(m => {
            const uid = createMovementCard(m.name);
            const prevData = getLastPerformance(m.name);
            (m.sets || []).forEach((s, idx) => {
                const pW = prevData && prevData[idx] ? prevData[idx].weight : '';
                const pR = prevData && prevData[idx] ? prevData[idx].reps : '';
                window.addSetToMovement(uid, s.weight, s.reps, s.rpe, pW, pR, s.type || 'N', s.done || false);
            });
        });
        window.updateHeatmap();
        return true;
    } catch (e) {
        return false;
    }
}

workoutTitle.addEventListener('input', saveWorkoutDraft);
inputAvgHR.addEventListener('input', saveWorkoutDraft);
inputWorkoutCals.addEventListener('input', saveWorkoutDraft);

// --- CHRONOGRAPH LOGIC (BACKGROUND-SAFE TIMESTAMP DELTAS) ---
function formatTime(totalSeconds) {
    const secs = Math.max(0, Math.floor(totalSeconds));
    const h = String(Math.floor(secs / 3600)).padStart(2, '0');
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    if (h === "00") return `${m}:${s}`;
    return `${h}:${m}:${s}`;
}

window.editTimer = function(type) {
    const input = prompt("Manual Entry: Enter total minutes (e.g., 45):");
    if (input !== null && !isNaN(input) && input.trim() !== "") {
        const totalSecs = Math.floor(parseFloat(input) * 60);
        if (type === 'lift') {
            liftSeconds = totalSecs;
            if (isLiftRunning) liftStartEpoch = Date.now() - (liftSeconds * 1000);
            displayLift.innerText = formatTime(liftSeconds);
        } else if (type === 'cardio') {
            cardioSeconds = totalSecs;
            if (isCardioRunning) cardioStartEpoch = Date.now() - (cardioSeconds * 1000);
            displayCardio.innerText = formatTime(cardioSeconds);
        }
        saveWorkoutDraft();
    }
};

function startLiftInterval(customStartEpoch = null) {
    clearInterval(liftTimer);
    isLiftRunning = true;
    liftStartEpoch = customStartEpoch || (Date.now() - (liftSeconds * 1000));
    window.BodyProHardware.requestWakeLock();
    liftTimer = setInterval(() => {
        liftSeconds = Math.floor((Date.now() - liftStartEpoch) / 1000);
        displayLift.innerText = formatTime(liftSeconds);
    }, 1000);
    btnToggleLift.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
    btnToggleLift.style.background = 'var(--primary)';
    btnToggleLift.style.color = '#fff';
    saveWorkoutDraft();
}

btnToggleLift.addEventListener('click', () => {
    if (isLiftRunning) {
        clearInterval(liftTimer);
        isLiftRunning = false;
        liftStartEpoch = null;
        btnToggleLift.innerHTML = '<i class="fa-solid fa-play"></i> Resume';
        btnToggleLift.style.background = 'var(--bg-surface-elevated)';
        btnToggleLift.style.color = 'var(--text-main)';
        saveWorkoutDraft();
    } else {
        startLiftInterval();
    }
});

btnResetLift.addEventListener('click', () => {
    clearInterval(liftTimer);
    liftSeconds = 0;
    liftStartEpoch = null;
    isLiftRunning = false;
    displayLift.innerText = "00:00:00";
    btnToggleLift.innerHTML = '<i class="fa-solid fa-play"></i> Start';
    btnToggleLift.style.background = 'var(--bg-surface-elevated)';
    btnToggleLift.style.color = 'var(--text-main)';
    saveWorkoutDraft();
});

function startCardioInterval(customStartEpoch = null) {
    clearInterval(cardioTimer);
    isCardioRunning = true;
    cardioStartEpoch = customStartEpoch || (Date.now() - (cardioSeconds * 1000));
    window.BodyProHardware.requestWakeLock();
    cardioTimer = setInterval(() => {
        cardioSeconds = Math.floor((Date.now() - cardioStartEpoch) / 1000);
        displayCardio.innerText = formatTime(cardioSeconds);
    }, 1000);
    btnToggleCardio.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
    btnToggleCardio.style.background = 'var(--accent)';
    btnToggleCardio.style.color = '#fff';
    saveWorkoutDraft();
}

btnToggleCardio.addEventListener('click', () => {
    if (isCardioRunning) {
        clearInterval(cardioTimer);
        isCardioRunning = false;
        cardioStartEpoch = null;
        btnToggleCardio.innerHTML = '<i class="fa-solid fa-play"></i> Resume';
        btnToggleCardio.style.background = 'var(--bg-surface-elevated)';
        btnToggleCardio.style.color = 'var(--text-main)';
        saveWorkoutDraft();
    } else {
        startCardioInterval();
    }
});

btnResetCardio.addEventListener('click', () => {
    clearInterval(cardioTimer);
    cardioSeconds = 0;
    cardioStartEpoch = null;
    isCardioRunning = false;
    displayCardio.innerText = "00:00:00";
    btnToggleCardio.innerHTML = '<i class="fa-solid fa-play"></i> Start';
    btnToggleCardio.style.background = 'var(--bg-surface-elevated)';
    btnToggleCardio.style.color = 'var(--text-main)';
    saveWorkoutDraft();
});

// Rest Timer Engine (Delta-Based + Web Audio Chime + Vibration + Notification)
window.startRestTimer = function(seconds) {
    clearInterval(restTimer);
    restSecondsRemaining = seconds;
    restEndEpoch = Date.now() + (seconds * 1000);
    displayRest.innerText = formatTime(restSecondsRemaining);
    displayRest.style.color = 'var(--warning)';

    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }

    restTimer = setInterval(() => {
        restSecondsRemaining = Math.ceil((restEndEpoch - Date.now()) / 1000);
        if (restSecondsRemaining <= 0) {
            clearInterval(restTimer);
            restSecondsRemaining = 0;
            displayRest.innerText = "00:00";
            displayRest.style.color = 'var(--danger)';
            
            if (userData?.settings?.preferences?.enableHapticsAudio !== false) {
                window.BodyProHardware.playRestCompleteAlarm();
            }
            
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification("Rest Interval Complete", {
                    body: "Time to attack your next working set!",
                    icon: "icon-192.png"
                });
            }
        } else {
            displayRest.innerText = formatTime(restSecondsRemaining);
        }
    }, 500);
};

window.startCustomRest = function() {
    const secs = parseInt(customRestInput.value);
    if (secs > 0) window.startRestTimer(secs);
};

window.stopRestTimer = function() {
    clearInterval(restTimer);
    restEndEpoch = null;
    displayRest.innerText = "00:00";
    displayRest.style.color = 'var(--warning)';
};

// --- BARBELL PLATE CALCULATOR & WARM-UP RAMP GENERATOR ---
window.updatePlateCalculator = function() {
    if (!plateVisualContainer) return;
    const target = parseFloat(plateTargetWeight.value) || 0;
    const bar = parseFloat(plateBarWeight.value) || 45;
    const isMetric = bar === 20 || bar === 15;
    const unit = isMetric ? 'kg' : 'lbs';

    const availablePlates = isMetric
        ? [
            { w: 25, color: '#ef4444', h: 86 },
            { w: 20, color: '#3b82f6', h: 82 },
            { w: 15, color: '#eab308', h: 72 },
            { w: 10, color: '#10b981', h: 64 },
            { w: 5,  color: '#f8fafc', h: 52, textColor: '#09090b' },
            { w: 2.5, color: '#64748b', h: 44 },
            { w: 1.25, color: '#94a3b8', h: 38 }
          ]
        : [
            { w: 45, color: '#3b82f6', h: 86 },
            { w: 35, color: '#eab308', h: 76 },
            { w: 25, color: '#10b981', h: 68 },
            { w: 10, color: '#f8fafc', h: 56, textColor: '#09090b' },
            { w: 5,  color: '#ef4444', h: 46 },
            { w: 2.5, color: '#64748b', h: 38 }
          ];

    let perSide = Math.max(0, (target - bar) / 2);
    const chosen = [];

    availablePlates.forEach(p => {
        while (perSide >= p.w - 0.001) {
            chosen.push(p);
            perSide -= p.w;
        }
    });

    // Build visual barbell
    let leftHtml = '';
    [...chosen].reverse().forEach(p => {
        leftHtml += `<div class="plate-disc" style="height:${p.h}px; background:${p.color}; color:${p.textColor || '#fff'};">${p.w}</div>`;
    });
    let rightHtml = '';
    chosen.forEach(p => {
        rightHtml += `<div class="plate-disc" style="height:${p.h}px; background:${p.color}; color:${p.textColor || '#fff'};">${p.w}</div>`;
    });

    plateVisualContainer.innerHTML = `
        <div class="barbell-collar"></div>
        ${leftHtml}
        <div class="barbell-shaft"></div>
        ${rightHtml}
        <div class="barbell-collar"></div>
    `;

    if (chosen.length === 0) {
        plateTextSummary.innerText = `Empty Bar (${bar} ${unit})`;
    } else {
        const counts = {};
        chosen.forEach(p => counts[p.w] = (counts[p.w] || 0) + 1);
        const breakdown = Object.entries(counts).map(([w, c]) => `${c}×${w}`).join(' + ');
        plateTextSummary.innerText = `Per Side: ${breakdown} ${unit}`;
    }

    // Warm-up Ramp Preview
    const roundStep = isMetric ? 2.5 : 5;
    const roundTo = (v) => Math.max(bar, Math.round(v / roundStep) * roundStep);
    const w1 = roundTo(target * 0.45);
    const w2 = roundTo(target * 0.65);
    const w3 = roundTo(target * 0.82);

    if (warmupRampPreview) {
        warmupRampPreview.innerHTML = `
            <div style="display:flex; justify-content:space-between; padding:4px 0;"><span>Warm-up Set 1 (45%):</span><strong>${w1} ${unit} &times; 8 reps (RPE 5)</strong></div>
            <div style="display:flex; justify-content:space-between; padding:4px 0;"><span>Warm-up Set 2 (65%):</span><strong>${w2} ${unit} &times; 5 reps (RPE 6)</strong></div>
            <div style="display:flex; justify-content:space-between; padding:4px 0;"><span>Warm-up Set 3 (82%):</span><strong>${w3} ${unit} &times; 3 reps (RPE 7)</strong></div>
        `;
    }
};

if (plateTargetWeight) plateTargetWeight.addEventListener('input', window.updatePlateCalculator);
if (plateBarWeight) plateBarWeight.addEventListener('change', window.updatePlateCalculator);

if (btnInjectWarmupSets) {
    btnInjectWarmupSets.addEventListener('click', () => {
        const groups = workoutLogArea.querySelectorAll('.movement-group');
        if (groups.length === 0) {
            window.handleAddMovement();
        }
        const targetGroup = workoutLogArea.querySelector('.movement-group:last-child');
        if (!targetGroup) return;

        const target = parseFloat(plateTargetWeight.value) || 225;
        const bar = parseFloat(plateBarWeight.value) || 45;
        const roundStep = (bar === 20 || bar === 15) ? 2.5 : 5;
        const roundTo = (v) => Math.max(bar, Math.round(v / roundStep) * roundStep);

        const uid = targetGroup.id;
        window.addSetToMovement(uid, roundTo(target * 0.45), 8, 5, '', '', 'W', false);
        window.addSetToMovement(uid, roundTo(target * 0.65), 5, 6, '', '', 'W', false);
        window.addSetToMovement(uid, roundTo(target * 0.82), 3, 7, '', '', 'W', false);

        window.BodyProHardware.playCheckSound();
        document.getElementById('plateCalcModal').classList.remove('active');
    });
}

// --- DYNAMIC INPUT MODE CONTROLLER ---
window.updateGroupMode = function(uid) {
    const group = document.getElementById(uid);
    if(!group) return;
    const nameInput = group.querySelector('.ex-name');
    if(!nameInput) return;
    
    const val = nameInput.value || '';
    const isCardio = val.includes('[Cardio]');
    const isFlex = val.includes('[Yoga]') || val.includes('[Stretching]');
    const wUnit = window.BodyProUnits.getWeightUnit(userData).toUpperCase();
    
    const header = group.querySelector('.set-grid-header');
    if(isCardio) {
        header.innerHTML = '<div>Set</div><div>Mins</div><div>Dist/Cal</div><div>Lvl</div><div>✓</div><div></div>';
    } else if(isFlex) {
        header.innerHTML = '<div>Set</div><div>Mins</div><div>Hold(s)</div><div>Lvl</div><div>✓</div><div></div>';
    } else {
        header.innerHTML = `<div>Set</div><div>${wUnit}</div><div>Reps</div><div>RPE</div><div>✓</div><div></div>`;
    }
    
    group.querySelectorAll('.set-row').forEach(row => {
        const wInp = row.querySelector('.ex-weight');
        const rInp = row.querySelector('.ex-reps');
        const rpeInp = row.querySelector('.ex-rpe');
        
        if(isCardio) {
            if (wInp.placeholder === "Lbs" || wInp.placeholder === "Kg" || wInp.placeholder.includes('Last:')) wInp.placeholder = "Mins";
            if (rInp.placeholder === "Reps" || rInp.placeholder.includes('Last:')) rInp.placeholder = "Dist/Cals";
            rpeInp.placeholder = "Lvl";
        } else if(isFlex) {
            if (wInp.placeholder === "Lbs" || wInp.placeholder === "Kg" || wInp.placeholder.includes('Last:')) wInp.placeholder = "Mins";
            if (rInp.placeholder === "Reps" || rInp.placeholder.includes('Last:')) rInp.placeholder = "Secs";
            rpeInp.placeholder = "Lvl";
        } else {
            if (wInp.placeholder === "Mins") wInp.placeholder = wUnit;
            if (rInp.placeholder === "Dist/Cals" || rInp.placeholder === "Secs") rInp.placeholder = "Reps";
            rpeInp.placeholder = "7";
        }
    });
};

// --- CUSTOM AUTOCOMPLETE LOGIC ---
const PRESET_EXERCISES = [
    // Chest
    "Bench Press (Barbell) [Chest]", "Bench Press (Dumbbell) [Chest]", "Incline Bench Press [Chest]", 
    "Decline Bench Press [Chest]", "Chest Fly (Cable) [Chest]", "Chest Fly (Dumbbell) [Chest]", 
    "Push-Up [Chest]", "Pec Deck Machine [Chest]", "Cable Crossover [Chest]",
    // Back
    "Deadlift (Barbell) [Back/Hamstrings]", "Pull-Up [Back]", "Chin-Up [Back/Biceps]", 
    "Lat Pulldown (Cable) [Back]", "Bent Over Row (Barbell) [Back]", "Dumbbell Row [Back]", 
    "Seated Cable Row [Back]", "T-Bar Row [Back]", "Shrugs (Dumbbell/Barbell) [Traps]",
    // Shoulders
    "Overhead Press (Barbell) [Shoulders]", "Overhead Press (Dumbbell) [Shoulders]", "Arnold Press [Shoulders]", 
    "Lateral Raise (Dumbbell) [Shoulders]", "Front Raise (Dumbbell) [Shoulders]", "Reverse Pec Deck [Shoulders]", 
    "Face Pull (Cable) [Shoulders]", 
    // Legs
    "Squat (Barbell) [Quads/Glutes]", "Front Squat [Quads]", "Hack Squat [Quads]",
    "Leg Press [Quads/Glutes]", "Lunge (Dumbbell) [Quads/Glutes]", "Bulgarian Split Squat [Quads/Glutes]", 
    "Leg Extension (Machine) [Quads]", "Leg Curl (Machine) [Hamstrings]", "Leg Curl (Seated) [Hamstrings]",
    "Romanian Deadlift [Hamstrings/LowerBack]", "Good Mornings [Hamstrings/LowerBack]", "Hip Thrust (Barbell) [Glutes]",
    "Calf Raise (Standing) [Calves]", "Calf Raise (Seated) [Calves]", 
    // Arms
    "Bicep Curl (Barbell) [Biceps]", "Bicep Curl (Dumbbell) [Biceps]", "Hammer Curl [Biceps]", "Preacher Curl [Biceps]", 
    "Tricep Extension (Cable) [Triceps]", "Skullcrusher [Triceps]", "Tricep Kickback [Triceps]", 
    "Dips [Triceps/Chest]", 
    // Core
    "Crunch [Core]", "Plank [Core]", "Russian Twist [Core]", "Hanging Leg Raise [Core]", 
    "Cable Woodchopper [Core]", "Ab Wheel Rollout [Core]",
    // Cardio
    "Treadmill [Cardio]", "Elliptical [Cardio]", "Stairmaster [Cardio]", "Cycling [Cardio]", 
    "Rowing [Cardio]", "Jump Rope [Cardio]", "Swimming [Cardio]", "Running [Cardio]",
    // Yoga
    "Vinyasa Flow [Yoga]", "Hatha Yoga [Yoga]", "Ashtanga [Yoga]", "Restorative Yoga [Yoga]", "Downward Dog [Yoga]",
    "Sun Salutation [Yoga]", "Warrior Pose [Yoga]",
    // Stretching
    "Dynamic Stretching [Stretching]", "Static Stretching [Stretching]", "Foam Rolling [Stretching]", 
    "Mobility Routine [Stretching]", "Hamstring Stretch [Stretching]", "Shoulder Dislocates [Stretching]", "Cat-Cow [Stretching]"
].sort();

window.attachAutocomplete = function(inputEl, listEl, uid) {
    inputEl.addEventListener('input', function() {
        const val = this.value.toLowerCase();
        listEl.innerHTML = '';
        if (!val) {
            listEl.style.display = 'none';
            window.updateHeatmap(); 
            window.updateGroupMode(uid);
            saveWorkoutDraft();
            return;
        }
        
        const matches = PRESET_EXERCISES.filter(ex => ex.toLowerCase().includes(val));
        if (matches.length > 0) {
            matches.forEach(match => {
                const div = document.createElement('div');
                div.className = 'autocomplete-item';
                div.innerText = match;
                div.onmousedown = function(e) { 
                    e.preventDefault(); 
                    inputEl.value = match;
                    listEl.style.display = 'none';
                    window.updateHeatmap(); 
                    window.updateGroupMode(uid);
                    populateHistoricalPlaceholdersForGroup(uid, match);
                    saveWorkoutDraft();
                };
                listEl.appendChild(div);
            });
            listEl.style.display = 'block';
        } else {
            listEl.style.display = 'none';
        }
        window.updateHeatmap(); 
        window.updateGroupMode(uid);
        saveWorkoutDraft();
    });

    inputEl.addEventListener('focus', function() {
        if (!this.value) {
            listEl.innerHTML = '';
            PRESET_EXERCISES.slice(0, 10).forEach(match => {
                const div = document.createElement('div');
                div.className = 'autocomplete-item';
                div.innerText = match;
                div.onmousedown = function(e) { 
                    e.preventDefault();
                    inputEl.value = match;
                    listEl.style.display = 'none';
                    window.updateHeatmap();
                    window.updateGroupMode(uid);
                    populateHistoricalPlaceholdersForGroup(uid, match);
                    saveWorkoutDraft();
                };
                listEl.appendChild(div);
            });
            listEl.style.display = 'block';
        }
    });

    inputEl.addEventListener('blur', function() {
        setTimeout(() => listEl.style.display = 'none', 150);
        window.updateHeatmap();
        window.updateGroupMode(uid);
    });
};

function populateHistoricalPlaceholdersForGroup(uid, exName) {
    const group = document.getElementById(uid);
    if (!group) return;
    const prevSets = getLastPerformance(exName);
    if (!prevSets) return;
    group.querySelectorAll('.set-row').forEach((row, idx) => {
        if (prevSets[idx]) {
            const wInp = row.querySelector('.ex-weight');
            const rInp = row.querySelector('.ex-reps');
            if (wInp && !wInp.value) wInp.placeholder = `Last: ${prevSets[idx].weight}`;
            if (rInp && !rInp.value) rInp.placeholder = `Last: ${prevSets[idx].reps}`;
        }
    });
}

// --- MUSCLE ACTIVATION HEATMAP LOGIC ---
window.updateHeatmap = function() {
    document.querySelectorAll('.muscle-path, .ancillary-tag').forEach(el => el.dataset.level = 0);
    
    let heatMapCount = {};

    document.querySelectorAll('.movement-group').forEach(group => {
        const exName = group.querySelector('.ex-name').value;
        const match = exName.match(/\[(.*?)\]/);
        if(match) {
            const muscles = match[1].split('/');
            let sets = group.querySelectorAll('.set-row').length;
            if(sets === 0) sets = 1;

            muscles.forEach(m => {
                const mKey = m.toLowerCase().replace(/[^a-z0-9]/g, '');
                heatMapCount[mKey] = (heatMapCount[mKey] || 0) + sets;
            });
        }
    });

    for(const [muscle, sets] of Object.entries(heatMapCount)) {
        document.querySelectorAll(`.muscle-path[data-muscle="${muscle}"]`).forEach(el => {
            if(sets >= 6) el.dataset.level = 3;
            else if(sets >= 3) el.dataset.level = 2;
            else if(sets >= 1) el.dataset.level = 1;
        });
        
        const tag = document.getElementById('mg-' + muscle);
        if(tag) {
            if(sets >= 6) tag.dataset.level = 3;       
            else if(sets >= 3) tag.dataset.level = 2;  
            else if(sets >= 1) tag.dataset.level = 1; 
        }
    }
};

// --- HISTORICAL PERFORMANCE & ALL-TIME PR ENGINE ---
function getLastPerformance(exName) {
    if(!userData || !userData.workouts || !exName) return null;
    const workouts = [...userData.workouts].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    for(let w of workouts) {
        const exSets = (w.sets || []).filter(s => s.exercise === exName);
        if(exSets.length > 0) return exSets; 
    }
    return null;
}

function getAllTimeBest(exName) {
    if (!userData || !userData.workouts || !exName) return { maxWeight: 0, max1RM: 0 };
    let maxWeight = 0;
    let max1RM = 0;
    userData.workouts.forEach(w => {
        (w.sets || []).forEach(s => {
            if (s.exercise === exName && s.setType !== 'W') {
                if ((Number(s.weight) || 0) > maxWeight) maxWeight = Number(s.weight);
                if ((Number(s.est1RM) || 0) > max1RM) max1RM = Number(s.est1RM);
            }
        });
    });
    return { maxWeight, max1RM };
}

// --- NESTED SESSION LOGGER (LIVE GRID) ---
function createMovementCard(initialName = '', supersetLabel = '') {
    const uid = 'mov_' + Date.now() + Math.random().toString(36).substr(2, 5);
    const div = document.createElement('div');
    div.className = 'movement-group';
    div.id = uid;
    div.style.marginBottom = '20px';
    div.style.background = 'var(--bg-base)';
    div.style.border = '1px solid var(--border-color)';
    div.style.borderRadius = 'var(--border-radius-sm)';
    div.style.padding = '12px';
    
    div.innerHTML = `
        <div class="movement-header-row">
            <div class="autocomplete-wrapper">
                <input type="text" name="ex_name_${uid}" class="exercise-input ex-name" placeholder="Movement Name (e.g. Bench Press)" value="${initialName}" autocomplete="off">
                <div class="autocomplete-list"></div>
            </div>
            <span class="pr-badge-slot">${supersetLabel ? `<span class="pr-badge" style="background:var(--warning);">${supersetLabel}</span>` : ''}</span>
            <button class="btn btn-ghost" style="width:auto; min-width:0; color:var(--warning); border:none; padding:5px 8px;" title="Plate Calculator for Movement" onclick="openPlateCalcForGroup('${uid}')"><i class="fa-solid fa-circle-dot"></i></button>
            <button class="btn btn-ghost" style="width:auto; min-width:0; color:var(--danger); border:none; padding:5px 8px;" onclick="this.closest('.movement-group').remove(); window.updateHeatmap();"><i class="fa-solid fa-trash"></i></button>
        </div>
        <div class="movement-sets" style="margin-bottom:10px;">
            <div class="set-grid-header">
                <div>Set</div><div>Lbs</div><div>Reps</div><div>RPE</div><div>✓</div><div></div>
            </div>
        </div>
        <button class="btn btn-ghost" style="width:100%; font-size:0.8rem; padding:8px;" onclick="addSetToMovement('${uid}')"><i class="fa-solid fa-plus"></i> Add Set</button>
    `;
    workoutLogArea.appendChild(div);
    
    const inputEl = div.querySelector('.ex-name');
    const listEl = div.querySelector('.autocomplete-list');
    window.attachAutocomplete(inputEl, listEl, uid);
    return uid;
}

window.openPlateCalcForGroup = function(uid) {
    const group = document.getElementById(uid);
    if (!group) return window.openPlateCalcModal();
    const firstW = group.querySelector('.ex-weight')?.value;
    window.openPlateCalcModal(firstW ? parseFloat(firstW) : 225);
};

window.handleAddMovement = function() {
    const uid = createMovementCard();
    window.addSetToMovement(uid); 
    window.updateHeatmap();
    saveWorkoutDraft();
};

window.addSetToMovement = function(uid, weight='', reps='', rpe='', prevWeight='', prevReps='', setType='N', isDone=false) {
    const group = document.getElementById(uid);
    if (!group) return;
    const setsContainer = group.querySelector('.movement-sets');
    const setNumber = setsContainer.querySelectorAll('.set-row').length + 1;
    const setUid = 'set_' + Date.now() + Math.random().toString(36).substr(2, 5);
    
    const wUnit = window.BodyProUnits.getWeightUnit(userData) === 'kg' ? 'Kg' : 'Lbs';
    const weightPlaceholder = prevWeight ? `Last: ${prevWeight}` : wUnit;
    const repsPlaceholder = prevReps ? `Last: ${prevReps}` : `Reps`;
    
    const row = document.createElement('div');
    row.className = `set-row ${isDone ? 'set-done' : ''}`;
    
    const badgeLabel = setType === 'N' ? setNumber : setType;

    row.innerHTML = `
        <div class="set-type-badge set-index" data-type="${setType}" onclick="cycleSetType(this)" title="Tap to cycle: Working (#), Warm-up (W), Drop Set (D), Failure (F)">${badgeLabel}</div>
        <input type="number" name="weight_${setUid}" class="exercise-input ex-weight" placeholder="${weightPlaceholder}" value="${weight}">
        <input type="number" name="reps_${setUid}" class="exercise-input ex-reps" placeholder="${repsPlaceholder}" value="${reps}">
        <input type="number" name="rpe_${setUid}" class="exercise-input ex-rpe" placeholder="7" max="10" value="${rpe}">
        <button type="button" class="btn-complete-set ${isDone ? 'completed' : ''}" onclick="toggleCompleteSet(this)" title="Complete Set & Start Rest Timer"><i class="fa-solid fa-check"></i></button>
        <button type="button" class="btn-remove-set" onclick="removeSetRow(this)"><i class="fa-solid fa-xmark"></i></button>
    `;
    
    row.querySelectorAll('input').forEach(inp => inp.addEventListener('input', () => {
        window.updateHeatmap();
        saveWorkoutDraft();
    }));
    
    setsContainer.appendChild(row);
    updateSetNumbers(uid);
    window.updateGroupMode(uid); 
    window.updateHeatmap();
    saveWorkoutDraft();
};

window.cycleSetType = function(badgeEl) {
    const order = ['N', 'W', 'D', 'F'];
    const current = badgeEl.dataset.type || 'N';
    const next = order[(order.indexOf(current) + 1) % order.length];
    badgeEl.dataset.type = next;
    const group = badgeEl.closest('.movement-group');
    updateSetNumbers(group.id);
    window.BodyProHardware.playCheckSound();
    saveWorkoutDraft();
};

window.toggleCompleteSet = function(btnEl) {
    const row = btnEl.closest('.set-row');
    const group = btnEl.closest('.movement-group');
    const isCompleted = btnEl.classList.toggle('completed');
    row.classList.toggle('set-done', isCompleted);

    if (isCompleted) {
        // Auto-start Resistance Timer if not running yet
        if (!isLiftRunning && liftSeconds === 0) {
            startLiftInterval();
        }

        // Check for All-Time PR!
        const exName = group.querySelector('.ex-name')?.value.trim() || '';
        const setType = row.querySelector('.set-type-badge')?.dataset.type || 'N';
        const w = parseFloat(row.querySelector('.ex-weight')?.value) || 0;
        const r = parseInt(row.querySelector('.ex-reps')?.value) || 0;
        const isStrength = !exName.includes('[Cardio]') && !exName.includes('[Yoga]') && !exName.includes('[Stretching]');

        let hitPR = false;
        if (isStrength && setType !== 'W' && w > 0 && r > 0) {
            const est1RM = Math.round(r > 1 ? w * (1 + (r / 30)) : w);
            const best = getAllTimeBest(exName);
            if ((best.max1RM > 0 && est1RM > best.max1RM) || (best.maxWeight > 0 && w > best.maxWeight)) {
                hitPR = true;
                const slot = group.querySelector('.pr-badge-slot');
                if (slot) slot.innerHTML = `<span class="pr-badge"><i class="fa-solid fa-trophy"></i> PR! (${est1RM} 1RM)</span>`;
            }
        }

        if (hitPR && userData?.settings?.preferences?.enableHapticsAudio !== false) {
            window.BodyProHardware.playPRCelebration();
        } else if (userData?.settings?.preferences?.enableHapticsAudio !== false) {
            window.BodyProHardware.playCheckSound();
        }

        // Auto-Trigger Rest Timer if enabled
        if (chkAutoRest && chkAutoRest.checked) {
            const customSecs = parseInt(customRestInput.value) || 90;
            window.startRestTimer(customSecs);
        }
    }
    saveWorkoutDraft();
};

window.removeSetRow = function(btn) {
    const group = btn.closest('.movement-group');
    const row = btn.closest('.set-row');
    row.remove();
    updateSetNumbers(group.id);
    window.updateHeatmap();
    saveWorkoutDraft();
};

function updateSetNumbers(uid) {
    const group = document.getElementById(uid);
    if(!group) return;
    let workingCounter = 1;
    group.querySelectorAll('.set-row .set-type-badge').forEach((el) => {
        if (!el.dataset.type || el.dataset.type === 'N') {
            el.innerText = workingCounter++;
        } else {
            el.innerText = el.dataset.type;
        }
    });
}

// --- TEMPLATE MANAGEMENT, TIME-CRUNCH & WEEKLY SPLIT ---
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
    const groups = workoutLogArea.querySelectorAll('.movement-group');
    
    groups.forEach(group => {
        const name = group.querySelector('.ex-name').value.trim();
        if (name) {
            const setsArr = [];
            group.querySelectorAll('.set-row').forEach(row => {
                setsArr.push({
                    type: row.querySelector('.set-type-badge')?.dataset.type || 'N',
                    weight: row.querySelector('.ex-weight').value || '',
                    reps: row.querySelector('.ex-reps').value || '',
                    rpe: row.querySelector('.ex-rpe').value || ''
                });
            });
            exercises.push({ exercise: name, sets: setsArr });
        }
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

function loadTemplateById(tplId, useTimeCrunch = false) {
    const tpl = (userData.workout_templates || []).find(t => t.id === tplId);
    if (!tpl) return;

    workoutTitle.value = useTimeCrunch ? `${tpl.title} [Time-Crunch]` : tpl.title;
    workoutLogArea.innerHTML = '';

    tpl.exercises.forEach((ex, exIdx) => {
        const exNameFull = ex.exercise || ex.name || '';
        const supersetTag = useTimeCrunch ? `SS-${String.fromCharCode(65 + Math.floor(exIdx / 2))}${(exIdx % 2) + 1}` : '';
        const uid = createMovementCard(exNameFull, supersetTag);
        const prevData = getLastPerformance(exNameFull);

        let setsToRender = (ex.sets && Array.isArray(ex.sets)) ? [...ex.sets] : [{}];
        if (useTimeCrunch && setsToRender.length > 1) {
            setsToRender = setsToRender.slice(0, Math.ceil(setsToRender.length / 2));
        }

        setsToRender.forEach((s, idx) => {
            let pWeight = '', pReps = '';
            if (prevData && prevData[idx]) {
                pWeight = prevData[idx].weight;
                pReps = prevData[idx].reps;
            }
            window.addSetToMovement(uid, s.weight || '', s.reps || '', s.rpe || '', pWeight, pReps, s.type || 'N', false);
        });
    });

    if (useTimeCrunch && customRestInput) {
        customRestInput.value = 45; // Condense rest intervals in Time-Crunch
    }

    window.updateHeatmap();
    saveWorkoutDraft();
}

btnLoadTemplate.addEventListener('click', () => {
    const tplId = templateSelect.value;
    if (!tplId) return;
    loadTemplateById(tplId, false);
});

if (btnFitnessTimeCrunch) {
    btnFitnessTimeCrunch.addEventListener('click', () => {
        const tplId = templateSelect.value;
        if (tplId) {
            loadTemplateById(tplId, true);
            window.BodyProHardware.playCheckSound();
            return;
        }
        // Condense currently active movements on the fly
        const groups = workoutLogArea.querySelectorAll('.movement-group');
        groups.forEach((g, idx) => {
            const rows = g.querySelectorAll('.set-row');
            const keepCount = Math.max(1, Math.ceil(rows.length / 2));
            rows.forEach((r, rIdx) => {
                if (rIdx >= keepCount) r.remove();
            });
            updateSetNumbers(g.id);
            const slot = g.querySelector('.pr-badge-slot');
            if (slot) slot.innerHTML = `<span class="pr-badge" style="background:var(--warning);">SS-${String.fromCharCode(65 + Math.floor(idx / 2))}${(idx % 2) + 1}</span>`;
        });
        if (workoutTitle.value && !workoutTitle.value.includes('[Time-Crunch]')) {
            workoutTitle.value += ' [Time-Crunch]';
        }
        if (customRestInput) customRestInput.value = 45;
        window.updateHeatmap();
        window.BodyProHardware.playCheckSound();
        saveWorkoutDraft();
    });
}

window.renderTemplatesManager = function() {
    templatesListContainer.innerHTML = '';
    const templates = userData.workout_templates || [];

    if (templates.length === 0) {
        templatesListContainer.innerHTML = '<p class="text-muted" style="text-align: center; font-size: 0.9rem;">No templates saved.</p>';
    } else {
        templates.forEach(t => {
            const el = document.createElement('div');
            el.className = 'history-list-item';
            el.innerHTML = `
                <div>
                    <h4 style="margin: 0 0 4px 0; font-size: 1rem;">${t.title}</h4>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${t.exercises.length} Movements</div>
                </div>
                <button class="btn btn-ghost" style="width:auto; min-width:0; padding: 6px 12px; border-color: transparent; color: var(--danger);" onclick="deleteTemplate('${t.id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;
            templatesListContainer.appendChild(el);
        });
    }

    // Populate Weekly Split Scheduler
    if (weeklySplitSchedulerContainer) {
        weeklySplitSchedulerContainer.innerHTML = '';
        const days = [
            { idx: 1, name: 'Monday' },
            { idx: 2, name: 'Tuesday' },
            { idx: 3, name: 'Wednesday' },
            { idx: 4, name: 'Thursday' },
            { idx: 5, name: 'Friday' },
            { idx: 6, name: 'Saturday' },
            { idx: 0, name: 'Sunday' }
        ];
        const currentSplit = userData.settings?.weeklySplit || {};

        days.forEach(d => {
            const lbl = document.createElement('div');
            lbl.style.fontSize = '0.85rem';
            lbl.style.fontWeight = '700';
            lbl.innerText = d.name;

            const sel = document.createElement('select');
            sel.dataset.dayIdx = d.idx;
            sel.style.padding = '8px 10px';
            sel.style.fontSize = '0.85rem';
            sel.innerHTML = `<option value="">Rest / Unassigned</option>`;
            templates.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.innerText = t.title;
                if (currentSplit[d.idx] === t.id) opt.selected = true;
                sel.appendChild(opt);
            });

            weeklySplitSchedulerContainer.appendChild(lbl);
            weeklySplitSchedulerContainer.appendChild(sel);
        });
    }
};

if (btnSaveWeeklySplit) {
    btnSaveWeeklySplit.addEventListener('click', async () => {
        if (!userData.settings) userData.settings = {};
        if (!userData.settings.weeklySplit) userData.settings.weeklySplit = {};
        weeklySplitSchedulerContainer.querySelectorAll('select').forEach(sel => {
            userData.settings.weeklySplit[sel.dataset.dayIdx] = sel.value;
        });
        await window.BodyProDataStore.saveData(userData);
        btnSaveWeeklySplit.innerHTML = '<i class="fa-solid fa-check"></i> Weekly Split Saved';
        setTimeout(() => btnSaveWeeklySplit.innerText = 'Save Weekly Split', 2000);
    });
}

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
        const prTag = wk.prCount && wk.prCount > 0 ? `<span class="pr-badge" style="margin-left:6px;"><i class="fa-solid fa-trophy"></i> ${wk.prCount} PR</span>` : '';
        
        el.innerHTML = `
            <div style="flex: 1;" onclick="viewSession('${wk.id}')">
                <h4 style="margin: 0 0 4px 0; font-size: 1rem; color: var(--primary);">${wk.title || 'Untitled Session'} ${prTag}</h4>
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
    
    const totalDuration = Math.round(((wk.durationLift || 0) + (wk.durationCardio || 0)) / 60);
    document.getElementById('viewSessionDuration').innerText = `${totalDuration} mins`;
    document.getElementById('viewSessionCals').innerText = wk.telemetry?.activeCals || 0;

    const setsContainer = document.getElementById('viewSessionSets');
    setsContainer.innerHTML = '';

    if (wk.sets && wk.sets.length > 0) {
        wk.sets.forEach((s, idx) => {
            const typePrefix = s.setType && s.setType !== 'N' ? `[${s.setType}] ` : '';
            let setFormatHtml = `<div class="text-muted">${s.weight} lbs</div><div class="text-muted">${s.reps} reps</div>`;
            if(s.exercise.includes('[Cardio]')) {
                setFormatHtml = `<div class="text-muted">${s.weight} Mins</div><div class="text-muted">${s.reps} Dist/Cal</div>`;
            } else if(s.exercise.includes('[Yoga]') || s.exercise.includes('[Stretching]')) {
                setFormatHtml = `<div class="text-muted">${s.weight} Mins</div><div class="text-muted">${s.reps} Secs</div>`;
            }
            
            setsContainer.innerHTML += `
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; ${idx === wk.sets.length - 1 ? 'border:none;' : ''}">
                    <div style="font-weight: 600;">${typePrefix}${s.exercise}</div>
                    ${setFormatHtml}
                    <div class="text-muted">1RM: ${s.est1RM || 0}</div>
                </div>
            `;
        });
    } else {
        setsContainer.innerHTML = '<div class="text-muted" style="font-size: 0.85rem; padding: 10px 0;">No set data recorded. Time/Cardio only.</div>';
    }

    viewSessionModal.classList.add('active');
};

document.getElementById('btnEditSession').addEventListener('click', () => {
    const wk = userData.workouts.find(w => w.id === currentViewSessionId);
    if (!wk) return;
    
    document.getElementById('viewSessionModal').classList.remove('active');
    document.getElementById('historyModal').classList.remove('active');
    
    workoutTitle.value = wk.title || '';
    inputAvgHR.value = wk.telemetry?.avgHR || '';
    inputWorkoutCals.value = wk.telemetry?.activeCals || '';
    
    liftSeconds = wk.durationLift || 0;
    displayLift.innerText = formatTime(liftSeconds);
    clearInterval(liftTimer);
    isLiftRunning = false;
    btnToggleLift.innerHTML = '<i class="fa-solid fa-play"></i> Start';
    btnToggleLift.style.background = 'var(--bg-surface-elevated)';

    cardioSeconds = wk.durationCardio || 0;
    displayCardio.innerText = formatTime(cardioSeconds);
    clearInterval(cardioTimer);
    isCardioRunning = false;
    btnToggleCardio.innerHTML = '<i class="fa-solid fa-play"></i> Start';
    btnToggleCardio.style.background = 'var(--bg-surface-elevated)';
    
    workoutLogArea.innerHTML = '';
    
    const movements = {};
    (wk.sets || []).forEach(s => {
        if(!movements[s.exercise]) movements[s.exercise] = [];
        movements[s.exercise].push(s);
    });
    
    for(const [exName, exSets] of Object.entries(movements)) {
        const uid = createMovementCard(exName);
        exSets.forEach(s => window.addSetToMovement(uid, s.weight, s.reps, s.rpe, '', '', s.setType || 'N', true));
    }
    
    window.updateHeatmap();
    
    btnFinishWorkout.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Historical Session';
    btnFinishWorkout.dataset.editModeId = wk.id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('btnDeleteSession').addEventListener('click', async () => {
    if (!currentViewSessionId) return;
    
    if(confirm("Permanently delete this session from your history? This will affect your analytics.")) {
        userData.workouts = userData.workouts.filter(w => w.id !== currentViewSessionId);
        await window.BodyProDataStore.saveData(userData);
        document.getElementById('viewSessionModal').classList.remove('active');
        window.renderHistoryVault();
    }
});

// --- SESSION COMPLETION, 1RM & PR CALCULATION & SAVING ---
btnFinishWorkout.addEventListener('click', async () => {
    const title = workoutTitle.value.trim() || "Uncategorized Session";
    const avgHR = parseInt(inputAvgHR.value) || 0;
    let activeCals = parseInt(inputWorkoutCals.value) || 0;
    
    const sets = [];
    let prCount = 0;
    const prMovements = [];
    const groups = workoutLogArea.querySelectorAll('.movement-group');
    
    groups.forEach(group => {
        const name = group.querySelector('.ex-name').value.trim();
        if (name) {
            const bestBefore = getAllTimeBest(name);
            let groupBrokePR = false;

            group.querySelectorAll('.set-row').forEach(row => {
                const setType = row.querySelector('.set-type-badge')?.dataset.type || 'N';
                const rawWeight = parseFloat(row.querySelector('.ex-weight').value) || 0;
                const isCardioOrFlex = name.includes('[Cardio]') || name.includes('[Yoga]') || name.includes('[Stretching]');
                // Convert weight to internal lbs if strength movement and user is in kg mode
                const weight = isCardioOrFlex ? rawWeight : window.BodyProUnits.toInternalLbs(rawWeight, userData);
                const reps = parseInt(row.querySelector('.ex-reps').value) || 0;
                const rpe = parseInt(row.querySelector('.ex-rpe').value) || 0;
                
                if (weight > 0 || reps > 0) { 
                    let est1RM = weight;
                    let volume = weight * reps;
                    
                    if(isCardioOrFlex || setType === 'W') {
                        est1RM = 0;
                        if (isCardioOrFlex) volume = 0;
                    } else if (reps > 1) {
                        est1RM = weight * (1 + (reps / 30));
                    }

                    const rounded1RM = Math.round(est1RM);
                    if (!isCardioOrFlex && setType !== 'W' && bestBefore.max1RM > 0 && rounded1RM > bestBefore.max1RM) {
                        groupBrokePR = true;
                    }
                    
                    sets.push({ 
                        exercise: name,
                        setType: setType,
                        weight: weight, 
                        reps: reps, 
                        rpe: rpe,
                        volume: Math.round(volume),
                        est1RM: rounded1RM
                    });
                }
            });

            if (groupBrokePR) {
                prCount++;
                prMovements.push(name.split('[')[0].trim());
            }
        }
    });

    if (sets.length === 0 && liftSeconds === 0 && cardioSeconds === 0) {
        alert("Cannot save an empty session. Please log time or sets.");
        return;
    }

    // Auto-estimate active calories if user didn't enter them manually
    if (activeCals === 0) {
        const liftMins = liftSeconds / 60;
        const cardioMins = cardioSeconds / 60;
        activeCals = Math.round((liftMins * 5.5) + (cardioMins * 9.5) + (sets.length * 11));
    }

    btnFinishWorkout.disabled = true;
    btnFinishWorkout.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Encrypting & Saving...';

    const workoutPayload = {
        date: window.BodyProTelemetry.getLocalISODate(),
        timestamp: new Date().toISOString(),
        title: title,
        durationLift: liftSeconds,
        durationCardio: cardioSeconds,
        prCount: prCount,
        telemetry: {
            avgHR: avgHR,
            activeCals: activeCals
        },
        sets: sets
    };

    const editId = btnFinishWorkout.dataset.editModeId;
    userData.workouts = userData.workouts || [];
    
    if (editId) {
        workoutPayload.id = editId;
        const idx = userData.workouts.findIndex(w => w.id === editId);
        if (idx !== -1) {
            workoutPayload.timestamp = userData.workouts[idx].timestamp;
            workoutPayload.date = userData.workouts[idx].date || workoutPayload.date;
            userData.workouts[idx] = workoutPayload;
        }
    } else {
        workoutPayload.id = 'wkout_' + Date.now();
        userData.workouts.push(workoutPayload);

        // Auto-post PR celebration to Social Stream if PRs were broken!
        if (prCount > 0) {
            userData.social_posts = userData.social_posts || [];
            userData.social_posts.push({
                id: 'post_pr_' + Date.now(),
                text: `🏆 NEW PERSONAL RECORD! Hit ${prCount} new PR(s) during "${title}" on ${prMovements.join(', ')}!`,
                authorName: userData.profile?.displayName || "BodyPro Athlete",
                timestamp: new Date().toISOString()
            });
        }
    }
    
    const success = await window.BodyProDataStore.saveData(userData);
    await window.BodyProHardware.releaseWakeLock();

    if (success) {
        clearWorkoutDraft();
        btnResetLift.click();
        btnResetCardio.click();
        window.stopRestTimer();
        workoutTitle.value = '';
        inputAvgHR.value = '';
        inputWorkoutCals.value = '';
        workoutLogArea.innerHTML = '';
        window.handleAddMovement(); 
        window.updateHeatmap();
        
        delete btnFinishWorkout.dataset.editModeId;
        
        btnFinishWorkout.innerHTML = prCount > 0
            ? `<i class="fa-solid fa-trophy"></i> Session & ${prCount} PR(s) Saved!`
            : '<i class="fa-solid fa-check"></i> Session Saved';
        setTimeout(() => {
            btnFinishWorkout.disabled = false;
            btnFinishWorkout.innerHTML = '<i class="fa-solid fa-check-double"></i> Complete & Save Session';
        }, 3000);
    } else {
        alert("System Error: Failed to synchronize session.");
        btnFinishWorkout.disabled = false;
        btnFinishWorkout.innerHTML = editId ? '<i class="fa-solid fa-floppy-disk"></i> Update Session' : '<i class="fa-solid fa-check-double"></i> Complete & Save Session';
    }
});
