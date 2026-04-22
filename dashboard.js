// dashboard.js - BodyPro Command Center Logic

import { auth } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- DOM ELEMENTS ---

// Hero & Greeting
const userGreeting = document.getElementById('userGreeting');

// Today's Protocol Elements
const protocolSelect = document.getElementById('protocolSelect');
const todayProtocolContainer = document.getElementById('todayProtocolContainer');

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
const todayStr = new Date().toISOString().split('T')[0];

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
    if (!userData.custom_workouts) userData.custom_workouts = [];

    renderDashboard();
});

// --- CORE RENDER ENGINE ---
function renderDashboard() {
    const name = userData.profile?.displayName || "Commander";
    const hour = new Date().getHours();
    let timeGreeting = "Good Evening";
    if (hour < 12) timeGreeting = "Good Morning";
    else if (hour < 17) timeGreeting = "Good Afternoon";
    userGreeting.innerText = `${timeGreeting}, ${name}.`;

    // Today's Protocol Setup
    protocolSelect.innerHTML = '<option value="">-- Select Protocol --</option>';
    if (userData.custom_workouts && userData.custom_workouts.length > 0) {
        protocolSelect.style.display = 'block';
        userData.custom_workouts.forEach(workout => {
            const opt = document.createElement('option');
            opt.value = workout.id;
            opt.textContent = workout.name;
            protocolSelect.appendChild(opt);
        });
        todayProtocolContainer.innerHTML = ''; // Clear container until selected
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
    }
}

// --- TODAY'S PROTOCOL HANDLER ---
protocolSelect.addEventListener('change', (e) => {
    const workoutId = e.target.value;
    if (!workoutId) {
        todayProtocolContainer.innerHTML = '';
        return;
    }

    const workout = userData.custom_workouts.find(w => w.id === workoutId);
    if (workout && workout.exercises) {
        let html = `<ul style="list-style: none; padding: 0; margin: 0;">`;
        workout.exercises.forEach(ex => {
            html += `
            <li style="padding: 10px 0; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-weight: 600; font-size: 0.95rem;">${ex.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${ex.sets} Sets x ${ex.reps} Reps</div>
                </div>
                <button class="btn btn-ghost" style="padding: 5px 10px; font-size: 0.8rem;"><i class="fa-regular fa-circle"></i></button>
            </li>`;
        });
        html += `</ul>`;
        todayProtocolContainer.innerHTML = html;
    }
});

// --- HYDRATION MODULE ---
async function updateWater(amount) {
    if (!userData) return;
    
    let todayBio = userData.biometrics.find(b => b.date === todayStr);
    if (!todayBio) {
        todayBio = { id: `bio_${Date.now()}`, date: todayStr, waterOz: 0 };
        userData.biometrics.push(todayBio);
    }
    
    todayBio.waterOz = Math.max(0, (todayBio.waterOz || 0) + amount);
    
    renderDashboard();
    await window.BodyProDataStore.saveData(userData);
}

btnAddWater.addEventListener('click', () => updateWater(parseInt(customWaterInput.value) || 8));
btnSubWater.addEventListener('click', () => updateWater(-(parseInt(customWaterInput.value) || 8)));

// --- SLEEP TELEMETRY MODULE ---
btnSaveSleep.addEventListener('click', async () => {
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

    btnSaveSleep.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    await window.BodyProDataStore.saveData(userData);
    
    btnSaveSleep.innerText = 'Save Sleep Log';
    document.getElementById('sleepModal').classList.remove('active');
    renderDashboard();
});

function calculateDuration(start, end) {
    if (!start || !end) return null;
    const d1 = new Date(`2000-01-01T${start}`);
    let d2 = new Date(`2000-01-01T${end}`);
    if (d2 < d1) d2.setDate(d2.getDate() + 1); 
    return parseFloat(((d2 - d1) / (1000 * 60 * 60)).toFixed(1));
}

// --- VITALS TELEMETRY MODULE ---
btnSaveVitals.addEventListener('click', async () => {
    let todayBio = userData.biometrics.find(b => b.date === todayStr);
    if (!todayBio) {
        todayBio = { id: `bio_${Date.now()}`, date: todayStr, waterOz: 0 };
        userData.biometrics.push(todayBio);
    }

    if (inputSteps.value) todayBio.steps = parseInt(inputSteps.value);
    if (inputFloors.value) todayBio.floors = parseInt(inputFloors.value);
    if (inputRestingHR.value) todayBio.restingHR = parseInt(inputRestingHR.value);
    if (inputActiveCals.value) todayBio.activeCals = parseInt(inputActiveCals.value);

    btnSaveVitals.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    await window.BodyProDataStore.saveData(userData);
    
    btnSaveVitals.innerText = 'Save Vitals';
    document.getElementById('vitalsModal').classList.remove('active');
    renderDashboard();
});

// --- OPTICAL CHARACTER RECOGNITION (OCR) MODULE ---

uploadSleepScreenshot.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Fix: Target the span instead of destroying the input
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

    // Fix: Target the span instead of destroying the input
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
