// dashboard.js - BodyPro Command Center Logic

import { auth } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- DOM ELEMENTS ---

// Hero & Greeting
const userGreeting = document.getElementById('userGreeting');
const heroBanner = document.getElementById('heroBanner');

// Today's Protocol Elements
const protocolSelect = document.getElementById('protocolSelect');
const todayProtocolContainer = document.getElementById('todayProtocolContainer');
const btnTimeCrunch = document.getElementById('btnTimeCrunch');

// Nutrition Elements
const calsRemaining = document.getElementById('calsRemaining');
const calsEaten = document.getElementById('calsEaten');
const protVal = document.getElementById('protVal');
const protTarget = document.getElementById('protTarget');
const carbVal = document.getElementById('carbVal');
const carbTarget = document.getElementById('carbTarget');
const fatVal = document.getElementById('fatVal');
const fatTarget = document.getElementById('fatTarget');
const calorieRing = document.getElementById('calorieRing');

// Sleep Elements
const sleepDuration = document.getElementById('sleepDuration');
const sleepTarget = document.getElementById('sleepTarget');
const sleepDeep = document.getElementById('sleepDeep');
const sleepRem = document.getElementById('sleepRem');
const sleepRestfulness = document.getElementById('sleepRestfulness');
const sleepLatency = document.getElementById('sleepLatency');

// Sleep Modal Inputs
const inputBedTime = document.getElementById('inputBedTime');
const inputWakeTime = document.getElementById('inputWakeTime');
const inputDeepSleep = document.getElementById('inputDeepSleep');
const inputRemSleep = document.getElementById('inputRemSleep');
const inputRestfulness = document.getElementById('inputRestfulness');
const inputLatency = document.getElementById('inputLatency');
const btnSaveSleep = document.getElementById('btnSaveSleep');
const uploadSleepScreenshot = document.getElementById('uploadSleepScreenshot');

// Vitals & Activity Elements
const stepCount = document.getElementById('stepCount');
const stepTarget = document.getElementById('stepTarget');
const floorCount = document.getElementById('floorCount');
const floorTarget = document.getElementById('floorTarget');
const restingHR = document.getElementById('restingHR');
const activeCals = document.getElementById('activeCals');

// Vitals Modal Inputs
const inputSteps = document.getElementById('inputSteps');
const inputFloors = document.getElementById('inputFloors');
const inputRestingHR = document.getElementById('inputRestingHR');
const inputActiveCals = document.getElementById('inputActiveCals');
const btnSaveVitals = document.getElementById('btnSaveVitals');
const uploadVitalsScreenshot = document.getElementById('uploadVitalsScreenshot');

// Hydration Elements
const waterCount = document.getElementById('waterCount');
const waterTargetLabel = document.getElementById('waterTargetLabel');
const btnAddWater = document.getElementById('btnAddWater');
const btnSubWater = document.getElementById('btnSubWater');
const customWaterInput = document.getElementById('customWaterInput');

// --- STATE MANAGEMENT ---
let userData = null;

// Ensure accurate local timing to prevent midnight rollover caching bugs
function getLocalISODate() {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return (new Date(d - offset)).toISOString().split('T')[0];
}

// --- INITIALIZATION ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }

    userData = await window.BodyProDataStore.getData();
    
    if (!userData.settings) userData.settings = { macroTargets: {}, goals: {} };
    if (!userData.food_diary) userData.food_diary = [];
    if (!userData.biometrics) userData.biometrics = [];
    if (!userData.sleep_data) userData.sleep_data = [];
    if (!userData.workout_templates) userData.workout_templates = []; // Correctly sync to fitness.js vault

    renderDashboard();
    loadHeroImage();
});

// --- HERO IMAGE MODULE ---
function loadHeroImage() {
    if (!heroBanner) return;

    const fitnessImages = [
        'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80', 
        'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80', 
        'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=1200&q=80', 
        'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1558611848-73f7eb4001a1?auto=format&fit=crop&w=1200&q=80'
    ];
    
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
    const selectedImage = fitnessImages[dayOfYear % fitnessImages.length];
    
    heroBanner.style.backgroundImage = `url('${selectedImage}')`;
}

// --- CORE RENDER ENGINE ---
function renderDashboard() {
    const todayStr = getLocalISODate(); // Compute dynamically on every render
    const name = userData.profile?.displayName || "Commander";
    const hour = new Date().getHours();
    let timeGreeting = "Good Evening";
    if (hour < 12) timeGreeting = "Good Morning";
    else if (hour < 17) timeGreeting = "Good Afternoon";
    userGreeting.innerText = `${timeGreeting}, ${name}.`;

    // Today's Protocol Setup (Fixed Database Pathway)
    protocolSelect.innerHTML = '<option value="">-- Select Protocol --</option>';
    if (userData.workout_templates && userData.workout_templates.length > 0) {
        protocolSelect.style.display = 'block';
        userData.workout_templates.forEach(workout => {
            const opt = document.createElement('option');
            opt.value = workout.id;
            opt.textContent = workout.title; 
            protocolSelect.appendChild(opt);
        });
        todayProtocolContainer.innerHTML = ''; 
    } else {
        protocolSelect.style.display = 'none';
        todayProtocolContainer.innerHTML = '<p class="text-muted" style="font-size: 0.85rem; text-align: center; padding: 10px;">No custom protocols found. Create one in the Fitness tab.</p>';
    }

    const todayWater = userData.biometrics.find(b => b.date === todayStr);
    const currentWater = todayWater?.waterOz || 0;
    const waterGoal = userData.settings.goals?.waterOz || 120;
    waterCount.innerHTML = `${currentWater} <span style="font-size: 0.9rem; color: var(--text-muted);">fl oz</span>`;
    waterTargetLabel.innerText = `Goal: ${waterGoal} fl oz`;

    const targets = userData.settings.macroTargets || { calories: 2200, protein: 200, carbs: 150, fats: 88 };
    
    protTarget.innerText = `/ ${targets.protein}g`;
    carbTarget.innerText = `/ ${targets.carbs}g`;
    fatTarget.innerText = `/ ${targets.fats}g`;

    const todaysFood = userData.food_diary.filter(f => f.date === todayStr);
    let eatenCals = 0, eatenProt = 0, eatenCarb = 0, eatenFat = 0;
    
    todaysFood.forEach(item => {
        eatenCals += (item.calories || 0);
        eatenProt += (item.protein || 0);
        eatenCarb += (item.carbs || 0);
        eatenFat += (item.fats || 0);
    });

    calsEaten.innerText = Math.round(eatenCals);
    protVal.innerText = `${Math.round(eatenProt)}g`;
    carbVal.innerText = `${Math.round(eatenCarb)}g`;
    fatVal.innerText = `${Math.round(eatenFat)}g`;

    const calsLeft = Math.max(0, targets.calories - eatenCals);
    calsRemaining.innerText = Math.round(calsLeft);

    const progressPerc = Math.min(100, (eatenCals / targets.calories) * 100);
    let ringColor = 'var(--accent)';
    if (eatenCals > targets.calories) ringColor = 'var(--danger)'; 
    calorieRing.style.background = `conic-gradient(${ringColor} ${progressPerc}%, var(--bg-surface-elevated) 0)`;

    const sleepGoal = userData.settings.goals?.sleepHrs || 7.5;
    sleepTarget.innerText = `/ ${sleepGoal}h`;

    const todaysSleep = userData.sleep_data.find(s => s.date === todayStr);
    if (todaysSleep) {
        sleepDuration.innerText = todaysSleep.durationHrs ? `${todaysSleep.durationHrs}h` : '--';
        sleepDeep.innerText = todaysSleep.deepHrs ? `${todaysSleep.deepHrs}h` : '--';
        sleepRem.innerText = todaysSleep.remHrs ? `${todaysSleep.remHrs}h` : '--';
        sleepRestfulness.innerText = todaysSleep.score || '--';
        sleepLatency.innerText = todaysSleep.latencyMins ? `${todaysSleep.latencyMins}m` : '--';
    } else {
        sleepDuration.innerText = '--';
        sleepDeep.innerText = '--';
        sleepRem.innerText = '--';
        sleepRestfulness.innerText = '--';
        sleepLatency.innerText = '--';
    }

    const goals = userData.settings.goals || {};
    stepTarget.innerText = `/ ${goals.steps?.toLocaleString() || '10,000'}`;
    floorTarget.innerText = `/ ${goals.floors || 10}`;

    const todaysVitals = userData.biometrics.find(b => b.date === todayStr);
    if (todaysVitals) {
        stepCount.innerText = todaysVitals.steps?.toLocaleString() || '0';
        floorCount.innerText = todaysVitals.floors || '0';
        restingHR.innerText = todaysVitals.restingHR || '--';
        activeCals.innerText = todaysVitals.activeCals || '0';
    } else {
        stepCount.innerText = '0';
        floorCount.innerText = '0';
        restingHR.innerText = '--';
        activeCals.innerText = '0';
    }
}

// --- PROTOCOL RENDERING & TIME-CRUNCH ENGINE ---
function renderSelectedProtocol(workoutId, isTimeCrunch = false) {
    if (!workoutId) {
        todayProtocolContainer.innerHTML = '';
        return;
    }

    const workout = userData.workout_templates.find(w => w.id === workoutId);
    if (workout && workout.exercises) {
        let html = `<ul style="list-style: none; padding: 0; margin: 0;">`;
        workout.exercises.forEach(ex => {
            const exName = ex.exercise || ex.name || 'Unknown Movement';
            let setsCount = (ex.sets && Array.isArray(ex.sets)) ? ex.sets.length : 1;
            
            // Time-Crunch Injection: Cut volume in half if toggled
            if (isTimeCrunch && setsCount > 1) {
                setsCount = Math.ceil(setsCount / 2);
            }
            
            let repsText = "Var Reps";
            if (ex.sets && ex.sets.length > 0 && ex.sets[0].reps) {
                repsText = ex.sets[0].reps + " Reps";
            }

            html += `
            <li style="padding: 10px 0; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; transition: opacity 0.2s;">
                <div>
                    <div style="font-weight: 600; font-size: 0.95rem;">${exName} ${isTimeCrunch ? '<span style="color:var(--warning); font-size:0.75rem; margin-left: 5px;"><i class="fa-solid fa-bolt"></i></span>' : ''}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${setsCount} Sets x ${repsText}</div>
                </div>
                <button class="btn btn-ghost check-btn" style="padding: 5px 10px; font-size: 1rem; color: var(--text-muted);"><i class="fa-regular fa-circle"></i></button>
            </li>`;
        });
        html += `</ul>`;
        todayProtocolContainer.innerHTML = html;

        // Wire up interactive checkboxes
        setTimeout(() => {
            todayProtocolContainer.querySelectorAll('.check-btn').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const icon = this.querySelector('i');
                    if (icon.classList.contains('fa-circle')) {
                        icon.classList.replace('fa-regular', 'fa-solid');
                        icon.classList.replace('fa-circle', 'fa-circle-check');
                        icon.style.color = 'var(--primary)';
                        this.closest('li').style.opacity = '0.4';
                    } else {
                        icon.classList.replace('fa-solid', 'fa-regular');
                        icon.classList.replace('fa-circle-check', 'fa-circle');
                        icon.style.color = 'var(--text-muted)';
                        this.closest('li').style.opacity = '1';
                    }
                });
            });
        }, 50);
    }
}

protocolSelect.addEventListener('change', (e) => {
    renderSelectedProtocol(e.target.value, false);
});

if (btnTimeCrunch) {
    btnTimeCrunch.addEventListener('click', (e) => {
        e.preventDefault();
        const currentWorkoutId = protocolSelect.value;
        if (!currentWorkoutId) {
            alert("Please select a protocol from the dropdown first to enable Time-Crunch mode.");
            return;
        }
        // Force the protocol to re-render with sets cut in half
        renderSelectedProtocol(currentWorkoutId, true);
    });
}

// --- HYDRATION MODULE ---
async function updateWater(amount) {
    if (!userData) return;
    
    const todayStr = getLocalISODate(); // Compute dynamically
    let todayBio = userData.biometrics.find(b => b.date === todayStr);
    if (!todayBio) {
        todayBio = { id: `bio_${Date.now()}`, date: todayStr, waterOz: 0 };
        userData.biometrics.push(todayBio);
    }
    
    todayBio.waterOz = Math.max(0, (todayBio.waterOz || 0) + amount);
    
    renderDashboard();
    await window.BodyProDataStore.saveData(userData);
}

// CRITICAL FIX: Pointerdown Event Binding. This bypasses mobile keyboard focus trapping entirely 
// by reading the screen touch milliseconds before the OS closes the virtual keyboard.
let isWaterProcessing = false;

async function handleWaterTap(isAdd, e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    if (isWaterProcessing) return;
    isWaterProcessing = true;

    // Defocus to forcefully dismiss the keyboard on mobile
    if (document.activeElement) document.activeElement.blur();

    let val = parseInt(customWaterInput.value);
    if (isNaN(val)) val = 8;
    
    await updateWater(isAdd ? val : -val);
    
    // Debouncer
    setTimeout(() => { isWaterProcessing = false; }, 300);
}

btnAddWater.addEventListener('pointerdown', (e) => handleWaterTap(true, e));
btnSubWater.addEventListener('pointerdown', (e) => handleWaterTap(false, e));

// --- SLEEP TELEMETRY MODULE ---
btnSaveSleep.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const todayStr = getLocalISODate(); // Compute dynamically
    const duration = calculateDuration(inputBedTime.value, inputWakeTime.value);
    
    const sleepEntry = {
        id: `slp_${Date.now()}`,
        date: todayStr,
        bedTime: inputBedTime.value,
        wakeTime: inputWakeTime.value,
        durationHrs: duration,
        deepHrs: parseFloat(inputDeepSleep.value) || null,
        remHrs: parseFloat(inputRemSleep.value) || null,
        score: parseInt(inputRestfulness.value) || null,
        latencyMins: parseInt(inputLatency.value) || null
    };

    userData.sleep_data = userData.sleep_data.filter(s => s.date !== todayStr);
    userData.sleep_data.push(sleepEntry);

    inputBedTime.value = '';
    inputWakeTime.value = '';
    inputDeepSleep.value = '';
    inputRemSleep.value = '';
    inputRestfulness.value = '';
    inputLatency.value = '';

    btnSaveSleep.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    await window.BodyProDataStore.saveData(userData);
    
    btnSaveSleep.innerText = 'Save Sleep Log';
    document.getElementById('sleepModal').classList.remove('active');
    renderDashboard();
    return false;
});

function calculateDuration(start, end) {
    if (!start || !end) return null;
    const d1 = new Date(`2000-01-01T${start}`);
    let d2 = new Date(`2000-01-01T${end}`);
    if (d2 < d1) d2.setDate(d2.getDate() + 1); 
    return parseFloat(((d2 - d1) / (1000 * 60 * 60)).toFixed(1));
}

// --- VITALS TELEMETRY MODULE ---
btnSaveVitals.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const todayStr = getLocalISODate(); // Compute dynamically
    let todayBio = userData.biometrics.find(b => b.date === todayStr);
    if (!todayBio) {
        todayBio = { id: `bio_${Date.now()}`, date: todayStr, waterOz: 0 };
        userData.biometrics.push(todayBio);
    }

    if (inputSteps.value) todayBio.steps = parseInt(inputSteps.value);
    if (inputFloors.value) todayBio.floors = parseInt(inputFloors.value);
    if (inputRestingHR.value) todayBio.restingHR = parseInt(inputRestingHR.value);
    if (inputActiveCals.value) todayBio.activeCals = parseInt(inputActiveCals.value);

    inputSteps.value = '';
    inputFloors.value = '';
    inputRestingHR.value = '';
    inputActiveCals.value = '';

    btnSaveVitals.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    await window.BodyProDataStore.saveData(userData);
    
    btnSaveVitals.innerText = 'Save Vitals';
    document.getElementById('vitalsModal').classList.remove('active');
    renderDashboard();
    return false;
});

// --- OPTICAL CHARACTER RECOGNITION (OCR) MODULE ---

uploadSleepScreenshot.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const textSpan = document.getElementById('sleepOcrText');
    const originalText = textSpan.innerHTML;
    textSpan.innerHTML = '<i class="fa-solid fa-cog fa-spin"></i> Scanning Telemetry...';

    try {
        const textData = await window.BodyProOCR.scanImage(file);
        console.log("Extracted Sleep OCR Data:", textData);

        const scoreMatch = textData.match(/(?:score|restfulness)[\s:]*(\d{1,3})/i);
        const deepMatch = textData.match(/(?:deep|deep sleep)[\s\n]*(\d+)h\s*(\d+)m/i);
        const remMatch = textData.match(/(?:rem)[\s\n]*(\d+)h\s*(\d+)m/i);

        if (scoreMatch) inputRestfulness.value = scoreMatch[1];
        if (deepMatch) {
            const hrs = parseInt(deepMatch[1]) + (parseInt(deepMatch[2]) / 60);
            inputDeepSleep.value = hrs.toFixed(1);
        }
        if (remMatch) {
            const hrs = parseInt(remMatch[1]) + (parseInt(remMatch[2]) / 60);
            inputRemSleep.value = hrs.toFixed(1);
        }
        
        alert("OCR Scan Complete. Please verify auto-filled metrics.");
    } catch (err) {
        console.error("OCR Engine Failure:", err);
        alert("Failed to analyze image. Please enter metrics manually.");
    } finally {
        textSpan.innerHTML = originalText;
        e.target.value = ''; 
    }
});

uploadVitalsScreenshot.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const textSpan = document.getElementById('vitalsOcrText');
    const originalText = textSpan.innerHTML;
    textSpan.innerHTML = '<i class="fa-solid fa-cog fa-spin"></i> Scanning Telemetry...';

    try {
        const textData = await window.BodyProOCR.scanImage(file);
        console.log("Extracted Vitals OCR Data:", textData);

        const stepsMatch = textData.match(/([\d,]+)\s*(?:steps)/i);
        const hrMatch = textData.match(/(?:resting\s*hr|resting\s*heart\s*rate)[\s:]*(\d{2,3})/i);
        const calMatch = textData.match(/([\d,]+)\s*(?:kcal|active)/i);

        if (stepsMatch) inputSteps.value = parseInt(stepsMatch[1].replace(/,/g, ''));
        if (hrMatch) inputRestingHR.value = hrMatch[1];
        if (calMatch) inputActiveCals.value = parseInt(calMatch[1].replace(/,/g, ''));

        alert("OCR Scan Complete. Please verify auto-filled metrics.");
    } catch (err) {
        console.error("OCR Engine Failure:", err);
        alert("Failed to analyze image. Please enter metrics manually.");
    } finally {
        textSpan.innerHTML = originalText;
        e.target.value = ''; 
    }
});
