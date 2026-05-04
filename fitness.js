import { auth } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- PROGRESSIVE WEB APP REGISTRATION ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('[BodyPro System] Service Worker Registered', reg))
            .catch(err => console.error('[BodyPro System] SW Registration Failed', err));
    });
}

// --- DOM Elements ---
const displayLift = document.getElementById('displayLift');
const btnToggleLift = document.getElementById('btnToggleLift');
const btnResetLift = document.getElementById('btnResetLift');
const displayCardio = document.getElementById('displayCardio');
const btnToggleCardio = document.getElementById('btnToggleCardio');
const btnResetCardio = document.getElementById('btnResetCardio');

const displayRest = document.getElementById('displayRest');
const customRestInput = document.getElementById('customRestInput');

const workoutTitle = document.getElementById('workoutTitle');
const inputAvgHR = document.getElementById('inputAvgHR');
const inputWorkoutCals = document.getElementById('inputWorkoutCals');
const workoutLogArea = document.getElementById('workoutLogArea');
const btnFinishWorkout = document.getElementById('btnFinishWorkout');

const templateSelect = document.getElementById('templateSelect');
const btnSaveAsTemplate = document.getElementById('btnSaveAsTemplate');
const btnLoadTemplate = document.getElementById('btnLoadTemplate');
const templatesListContainer = document.getElementById('templatesListContainer');

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
    
    userData.workout_templates = userData.workout_templates || [];
    
    updateTemplateDropdown();
    handleAddMovement(); // Add initial blank movement group
    
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

window.editTimer = function(type) {
    const input = prompt("Manual Entry: Enter total minutes (e.g., 45):");
    if (input !== null && !isNaN(input) && input.trim() !== "") {
        const totalSecs = Math.floor(parseFloat(input) * 60);
        if (type === 'lift') {
            liftSeconds = totalSecs;
            displayLift.innerText = formatTime(liftSeconds);
        } else if (type === 'cardio') {
            cardioSeconds = totalSecs;
            displayCardio.innerText = formatTime(cardioSeconds);
        }
    }
};

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

// Rest Timer Engine
window.startRestTimer = function(seconds) {
    clearInterval(restTimer);
    restSecondsRemaining = seconds;
    displayRest.innerText = formatTime(restSecondsRemaining);
    displayRest.style.color = 'var(--warning)';

    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }

    restTimer = setInterval(() => {
        restSecondsRemaining--;
        if (restSecondsRemaining <= 0) {
            clearInterval(restTimer);
            displayRest.innerText = "00:00";
            displayRest.style.color = 'var(--danger)';
            
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification("Rest Interval Complete", {
                    body: "Time to get back to the activity. Prepare for your next set.",
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
    if (secs > 0) window.startRestTimer(secs);
};

window.stopRestTimer = function() {
    clearInterval(restTimer);
    displayRest.innerText = "00:00";
    displayRest.style.color = 'var(--warning)';
};

// --- DYNAMIC INPUT MODE CONTROLLER ---
window.updateGroupMode = function(uid) {
    const group = document.getElementById(uid);
    if(!group) return;
    const nameInput = group.querySelector('.ex-name');
    if(!nameInput) return;
    
    const val = nameInput.value || '';
    const isCardio = val.includes('[Cardio]');
    const isFlex = val.includes('[Yoga]') || val.includes('[Stretching]');
    
    const header = group.querySelector('.set-grid-header');
    if(isCardio) {
        header.innerHTML = '<div>Set</div><div>Mins</div><div>Dist/Cal</div><div>Lvl</div><div></div>';
    } else if(isFlex) {
        header.innerHTML = '<div>Set</div><div>Mins</div><div>Hold(s)</div><div>Lvl</div><div></div>';
    } else {
        header.innerHTML = '<div>Set</div><div>Lbs</div><div>Reps</div><div>RPE</div><div></div>';
    }
    
    group.querySelectorAll('.set-row').forEach(row => {
        const wInp = row.querySelector('.ex-weight');
        const rInp = row.querySelector('.ex-reps');
        const rpeInp = row.querySelector('.ex-rpe');
        
        if(isCardio) {
            if (wInp.placeholder === "Lbs" || wInp.placeholder.includes('Last:')) wInp.placeholder = "Mins";
            if (rInp.placeholder === "Reps" || rInp.placeholder.includes('Last:')) rInp.placeholder = "Dist/Cals";
            rpeInp.placeholder = "Lvl";
        } else if(isFlex) {
            if (wInp.placeholder === "Lbs" || wInp.placeholder.includes('Last:')) wInp.placeholder = "Mins";
            if (rInp.placeholder === "Reps" || rInp.placeholder.includes('Last:')) rInp.placeholder = "Secs";
            rpeInp.placeholder = "Lvl";
        } else {
            if (wInp.placeholder === "Mins") wInp.placeholder = "Lbs";
            if (rInp.placeholder === "Dist/Cals" || rInp.placeholder === "Secs") rInp.placeholder = "Reps";
            rpeInp.placeholder = "7";
        }
    });
};

// --- CUSTOM AUTOCOMPLETE LOGIC (Expanded for new categories) ---
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
                };
                listEl.appendChild(div);
            });
            listEl.style.display = 'block';
        } else {
            listEl.style.display = 'none';
        }
        window.updateHeatmap(); 
        window.updateGroupMode(uid);
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

// --- MUSCLE ACTIVATION HEATMAP LOGIC (SVG UPGRADE) ---
window.updateHeatmap = function() {
    // Reset all map regions
    document.querySelectorAll('.muscle-path, .ancillary-tag').forEach(el => el.dataset.level = 0);
    
    let heatMapCount = {};

    document.querySelectorAll('.movement-group').forEach(group => {
        const exName = group.querySelector('.ex-name').value;
        const match = exName.match(/\[(.*?)\]/);
        if(match) {
            const muscles = match[1].split('/'); // splits e.g. "Quads/Glutes"
            
            // Count sets. If it's cardio/yoga, we might just have 1 set row but it counts as activity.
            let sets = group.querySelectorAll('.set-row').length;
            if(sets === 0) sets = 1; // Give credit just for having the category active

            muscles.forEach(m => {
                const mKey = m.toLowerCase().replace(/[^a-z0-9]/g, ''); // strip spaces/symbols e.g., "lowerback"
                heatMapCount[mKey] = (heatMapCount[mKey] || 0) + sets;
            });
        }
    });

    // Apply colors based on volume thresholds
    for(const [muscle, sets] of Object.entries(heatMapCount)) {
        // Apply to SVG paths
        document.querySelectorAll(`.muscle-path[data-muscle="${muscle}"]`).forEach(el => {
            if(sets >= 6) el.dataset.level = 3;       // Red
            else if(sets >= 3) el.dataset.level = 2;  // Orange
            else if(sets >= 1) el.dataset.level = 1;  // Yellow
        });
        
        // Apply to ancillary tags (Cardio/Yoga/Stretch)
        const tag = document.getElementById('mg-' + muscle);
        if(tag) {
            if(sets >= 6) tag.dataset.level = 3;       
            else if(sets >= 3) tag.dataset.level = 2;  
            else if(sets >= 1) tag.dataset.level = 1; 
        }
    }
};

// --- HISTORICAL PERFORMANCE LOOKUP ---
function getLastPerformance(exName) {
    if(!userData || !userData.workouts) return null;
    
    // Sort workouts newest to oldest
    const workouts = [...userData.workouts].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    for(let w of workouts) {
        const exSets = (w.sets || []).filter(s => s.exercise === exName);
        if(exSets.length > 0) return exSets; 
    }
    return null;
}

// --- NESTED SESSION LOGGER (LIVE GRID) ---
window.handleAddMovement = function() {
    const uid = 'mov_' + Date.now() + Math.random().toString(36).substr(2, 5);
    const div = document.createElement('div');
    div.className = 'movement-group';
    div.id = uid;
    div.style.marginBottom = '20px';
    div.style.background = 'var(--bg-base)';
    div.style.border = '1px solid var(--border-color)';
    div.style.borderRadius = 'var(--border-radius-sm)';
    div.style.padding = '10px';
    
    div.innerHTML = `
        <div class="movement-header-row">
            <div class="autocomplete-wrapper">
                <input type="text" name="ex_name_${uid}" class="exercise-input ex-name" placeholder="Movement Name" autocomplete="off">
                <div class="autocomplete-list"></div>
            </div>
            <button class="btn btn-ghost" style="color:var(--danger); border:none; padding:5px 10px;" onclick="this.closest('.movement-group').remove(); window.updateHeatmap();"><i class="fa-solid fa-trash"></i></button>
        </div>
        <div class="movement-sets" style="margin-bottom:10px;">
            <div class="set-grid-header">
                <div>Set</div><div>Lbs</div><div>Reps</div><div>RPE</div><div></div>
            </div>
        </div>
        <button class="btn btn-ghost" style="width:100%; font-size:0.8rem; padding:8px;" onclick="addSetToMovement('${uid}')"><i class="fa-solid fa-plus"></i> Add Set</button>
    `;
    workoutLogArea.appendChild(div);
    
    const inputEl = div.querySelector('.ex-name');
    const listEl = div.querySelector('.autocomplete-list');
    window.attachAutocomplete(inputEl, listEl, uid);

    window.addSetToMovement(uid); 
    window.updateHeatmap();
};

window.addSetToMovement = function(uid, weight='', reps='', rpe='', prevWeight='', prevReps='') {
    const group = document.getElementById(uid);
    if (!group) return;
    const setsContainer = group.querySelector('.movement-sets');
    const setNumber = setsContainer.querySelectorAll('.set-row').length + 1;
    const setUid = 'set_' + Date.now() + Math.random().toString(36).substr(2, 5);
    
    // Set dynamic placeholders to guide progression based on last session
    const weightPlaceholder = prevWeight ? `Last: ${prevWeight}` : `Lbs`;
    const repsPlaceholder = prevReps ? `Last: ${prevReps}` : `Reps`;
    
    const row = document.createElement('div');
    row.className = 'set-row';
    
    row.innerHTML = `
        <div style="text-align:center; font-weight:bold; color:var(--text-muted);" class="set-index">${setNumber}</div>
        <input type="number" name="weight_${setUid}" class="exercise-input ex-weight" placeholder="${weightPlaceholder}" value="${weight}">
        <input type="number" name="reps_${setUid}" class="exercise-input ex-reps" placeholder="${repsPlaceholder}" value="${reps}">
        <input type="number" name="rpe_${setUid}" class="exercise-input ex-rpe" placeholder="7" max="10" value="${rpe}">
        <button class="btn-remove-set" onclick="removeSetRow(this)"><i class="fa-solid fa-xmark"></i></button>
    `;
    
    // Attach heatmap update listener to input fields
    row.querySelectorAll('input').forEach(inp => inp.addEventListener('input', window.updateHeatmap));
    
    setsContainer.appendChild(row);
    updateSetNumbers(uid);
    window.updateGroupMode(uid); 
    window.updateHeatmap();
};

window.removeSetRow = function(btn) {
    const group = btn.closest('.movement-group');
    const row = btn.closest('.set-row');
    row.remove();
    updateSetNumbers(group.id);
    window.updateHeatmap();
};

function updateSetNumbers(uid) {
    const group = document.getElementById(uid);
    if(!group) return;
    const rows = group.querySelectorAll('.set-row .set-index');
    rows.forEach((el, idx) => {
        el.innerText = idx + 1;
    });
}

// --- TEMPLATE MANAGEMENT & LOADING ---
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

btnLoadTemplate.addEventListener('click', () => {
    const tplId = templateSelect.value;
    if (!tplId) return;

    const tpl = userData.workout_templates.find(t => t.id === tplId);
    if (!tpl) return;

    workoutTitle.value = tpl.title;
    workoutLogArea.innerHTML = '';

    tpl.exercises.forEach(ex => {
        const uid = 'mov_' + Date.now() + Math.random().toString(36).substr(2, 5);
        const div = document.createElement('div');
        div.className = 'movement-group';
        div.id = uid;
        div.style.marginBottom = '20px';
        div.style.background = 'var(--bg-base)';
        div.style.border = '1px solid var(--border-color)';
        div.style.borderRadius = 'var(--border-radius-sm)';
        div.style.padding = '10px';
        
        const exNameFull = ex.exercise || ex.name || '';
        
        div.innerHTML = `
            <div class="movement-header-row">
                <div class="autocomplete-wrapper">
                    <input type="text" name="ex_name_${uid}" class="exercise-input ex-name" value="${exNameFull}" autocomplete="off">
                    <div class="autocomplete-list"></div>
                </div>
                <button class="btn btn-ghost" style="color:var(--danger); border:none; padding:5px 10px;" onclick="this.closest('.movement-group').remove(); window.updateHeatmap();"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="movement-sets" style="margin-bottom:10px;">
                <div class="set-grid-header">
                    <div>Set</div><div>Lbs</div><div>Reps</div><div>RPE</div><div></div>
                </div>
            </div>
            <button class="btn btn-ghost" style="width:100%; font-size:0.8rem; padding:8px;" onclick="addSetToMovement('${uid}')"><i class="fa-solid fa-plus"></i> Add Set</button>
        `;
        workoutLogArea.appendChild(div);

        const inputEl = div.querySelector('.ex-name');
        const listEl = div.querySelector('.autocomplete-list');
        window.attachAutocomplete(inputEl, listEl, uid);
        
        // Grab Historical Data to populate placeholders
        const prevData = getLastPerformance(exNameFull);

        if (ex.sets && Array.isArray(ex.sets)) {
            ex.sets.forEach((s, idx) => {
                let pWeight = '', pReps = '';
                if(prevData && prevData[idx]) {
                    pWeight = prevData[idx].weight;
                    pReps = prevData[idx].reps;
                }
                window.addSetToMovement(uid, s.weight, s.reps, s.rpe, pWeight, pReps);
            });
        } else {
            let pWeight = '', pReps = '';
            if(prevData && prevData[0]) {
                pWeight = prevData[0].weight;
                pReps = prevData[0].reps;
            }
            window.addSetToMovement(uid, '', '', '', pWeight, pReps);
        }
    });
    
    window.updateHeatmap();
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
            
            // Re-format historical data if it was cardio so it displays cleanly in history view
            let setFormatHtml = `<div class="text-muted">${s.weight} lbs</div><div class="text-muted">${s.reps} reps</div>`;
            if(s.exercise.includes('[Cardio]')) {
                setFormatHtml = `<div class="text-muted">${s.weight} Mins</div><div class="text-muted">${s.reps} Dist/Cal</div>`;
            } else if(s.exercise.includes('[Yoga]') || s.exercise.includes('[Stretching]')) {
                setFormatHtml = `<div class="text-muted">${s.weight} Mins</div><div class="text-muted">${s.reps} Secs</div>`;
            }
            
            setsContainer.innerHTML += `
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; ${idx === wk.sets.length - 1 ? 'border:none;' : ''}">
                    <div style="font-weight: 600;">${s.exercise}</div>
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
    
    // Group flat historical sets back into nested HTML structure
    const movements = {};
    (wk.sets || []).forEach(s => {
        if(!movements[s.exercise]) movements[s.exercise] = [];
        movements[s.exercise].push(s);
    });
    
    for(const [exName, exSets] of Object.entries(movements)) {
        const uid = 'mov_' + Date.now() + Math.random().toString(36).substr(2, 5);
        const div = document.createElement('div');
        div.className = 'movement-group';
        div.id = uid;
        div.style.marginBottom = '20px';
        div.style.background = 'var(--bg-base)';
        div.style.border = '1px solid var(--border-color)';
        div.style.borderRadius = 'var(--border-radius-sm)';
        div.style.padding = '10px';
        
        div.innerHTML = `
            <div class="movement-header-row">
                <div class="autocomplete-wrapper">
                    <input type="text" name="ex_name_${uid}" class="exercise-input ex-name" value="${exName}" autocomplete="off">
                    <div class="autocomplete-list"></div>
                </div>
                <button class="btn btn-ghost" style="color:var(--danger); border:none; padding:5px 10px;" onclick="this.closest('.movement-group').remove(); window.updateHeatmap();"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="movement-sets" style="margin-bottom:10px;">
                <div class="set-grid-header">
                    <div>Set</div><div>Lbs</div><div>Reps</div><div>RPE</div><div></div>
                </div>
            </div>
            <button class="btn btn-ghost" style="width:100%; font-size:0.8rem; padding:8px;" onclick="addSetToMovement('${uid}')"><i class="fa-solid fa-plus"></i> Add Set</button>
        `;
        workoutLogArea.appendChild(div);
        
        const inputEl = div.querySelector('.ex-name');
        const listEl = div.querySelector('.autocomplete-list');
        window.attachAutocomplete(inputEl, listEl, uid);

        exSets.forEach(s => window.addSetToMovement(uid, s.weight, s.reps, s.rpe));
    }
    
    window.updateHeatmap();
    
    // Switch the complete button into "Update" mode
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

// --- SESSION COMPLETION, 1RM CALCULATION & SAVING ---
btnFinishWorkout.addEventListener('click', async () => {
    const title = workoutTitle.value.trim() || "Uncategorized Session";
    const avgHR = parseInt(inputAvgHR.value) || 0;
    const activeCals = parseInt(inputWorkoutCals.value) || 0;
    
    const sets = [];
    const groups = workoutLogArea.querySelectorAll('.movement-group');
    
    groups.forEach(group => {
        const name = group.querySelector('.ex-name').value.trim();
        if (name) {
            group.querySelectorAll('.set-row').forEach(row => {
                const weight = parseFloat(row.querySelector('.ex-weight').value) || 0; // Or Mins
                const reps = parseInt(row.querySelector('.ex-reps').value) || 0; // Or Distance
                const rpe = parseInt(row.querySelector('.ex-rpe').value) || 0; // Or Lvl
                
                if (weight > 0 || reps > 0) { 
                    let est1RM = weight;
                    let volume = weight * reps;
                    
                    // Do not compute 1RM/Volume for Cardio/Flexibility
                    if(name.includes('[Cardio]') || name.includes('[Yoga]') || name.includes('[Stretching]')) {
                        est1RM = 0;
                        volume = 0;
                    } else if (reps > 1) {
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
        }
    });

    if (sets.length === 0 && liftSeconds === 0 && cardioSeconds === 0) {
        alert("Cannot save an empty session. Please log time or sets.");
        return;
    }

    btnFinishWorkout.disabled = true;
    btnFinishWorkout.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Encrypting & Saving...';

    const workoutPayload = {
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

    const editId = btnFinishWorkout.dataset.editModeId;
    userData.workouts = userData.workouts || [];
    
    if (editId) {
        workoutPayload.id = editId;
        const idx = userData.workouts.findIndex(w => w.id === editId);
        if (idx !== -1) {
            workoutPayload.timestamp = userData.workouts[idx].timestamp; // Preserve original date
            userData.workouts[idx] = workoutPayload;
        }
    } else {
        workoutPayload.id = 'wkout_' + Date.now();
        userData.workouts.push(workoutPayload);
    }
    
    const success = await window.BodyProDataStore.saveData(userData);

    if (success) {
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
        
        btnFinishWorkout.innerHTML = '<i class="fa-solid fa-check"></i> Session Saved';
        setTimeout(() => {
            btnFinishWorkout.disabled = false;
            btnFinishWorkout.innerHTML = '<i class="fa-solid fa-check-double"></i> Complete & Save Session';
        }, 3000);
    } else {
        alert("System Error: Failed to synchronize session to the cloud.");
        btnFinishWorkout.disabled = false;
        btnFinishWorkout.innerHTML = editId ? '<i class="fa-solid fa-floppy-disk"></i> Update Session' : '<i class="fa-solid fa-check-double"></i> Complete & Save Session';
    }
});
