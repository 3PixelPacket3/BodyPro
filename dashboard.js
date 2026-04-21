// dashboard.js - BodyPro Command Center Logic

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
const userGreeting = document.getElementById('userGreeting');
const heroBanner = document.getElementById('heroBanner');
const calsRemainingEl = document.getElementById('calsRemaining');
const calsEatenEl = document.getElementById('calsEaten');

// Macros
const protVal = document.getElementById('protVal');
const carbVal = document.getElementById('carbVal');
const fatVal = document.getElementById('fatVal');
const protTarget = document.getElementById('protTarget');
const carbTarget = document.getElementById('carbTarget');
const fatTarget = document.getElementById('fatTarget');

// Telemetry: Sleep
const sleepDurationEl = document.getElementById('sleepDuration');
const sleepDeepEl = document.getElementById('sleepDeep');
const sleepRemEl = document.getElementById('sleepRem');
const sleepRestfulnessEl = document.getElementById('sleepRestfulness');
const sleepLatencyEl = document.getElementById('sleepLatency');

// Telemetry: Vitals
const stepCountEl = document.getElementById('stepCount');
const floorCountEl = document.getElementById('floorCount');
const restingHREl = document.getElementById('restingHR');
const activeCalsEl = document.getElementById('activeCals');

// Protocol & Contingency
const protocolTitle = document.getElementById('protocolTitle');
const protocolDesc = document.getElementById('protocolDesc');
const btnTimeCrunch = document.getElementById('btnTimeCrunch');
const protocolDisplayBox = document.getElementById('protocolDisplayBox');
const protocolIconBox = document.getElementById('protocolIconBox');
const protocolIcon = document.getElementById('protocolIcon');

// Water
const waterCountEl = document.getElementById('waterCount');
const customWaterInput = document.getElementById('customWaterInput');
const btnAddWater = document.getElementById('btnAddWater');
const btnSubWater = document.getElementById('btnSubWater');

// Modal Inputs: Sleep
const inputBedTime = document.getElementById('inputBedTime');
const inputWakeTime = document.getElementById('inputWakeTime');
const inputDeepSleep = document.getElementById('inputDeepSleep');
const inputRemSleep = document.getElementById('inputRemSleep');
const inputRestfulness = document.getElementById('inputRestfulness');
const inputLatency = document.getElementById('inputLatency');
const btnSaveSleep = document.getElementById('btnSaveSleep');

// Modal Inputs: Vitals
const inputSteps = document.getElementById('inputSteps');
const inputFloors = document.getElementById('inputFloors');
const inputRestingHR = document.getElementById('inputRestingHR');
const inputActiveCals = document.getElementById('inputActiveCals');
const btnSaveVitals = document.getElementById('btnSaveVitals');

// --- STATE MANAGEMENT ---
let currentWater = 0;
let userData = null;
let isTimeCrunched = false;

// Array of high-quality, reliable Unsplash images (Bypasses API limits/shutdowns)
const fitnessImages = [
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop", // Heavy lifting
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1470&auto=format&fit=crop", // Gym atmosphere
    "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=1469&auto=format&fit=crop", // Weights rack
    "https://images.unsplash.com/photo-1526506159807-1c6e14996e54?q=80&w=1374&auto=format&fit=crop", // Dumbbells
    "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=1470&auto=format&fit=crop"  // Functional training
];

// --- THE SECURITY GUARD ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }
    
    // Set personalized greeting & UI
    const displayName = user.displayName || "Joshua"; 
    userGreeting.innerText = `Welcome back, ${displayName}`;
    
    // Rotate API Hero Image
    const randomImage = fitnessImages[Math.floor(Math.random() * fitnessImages.length)];
    heroBanner.style.backgroundImage = `url('${randomImage}')`;
    
    await initializeDashboard();
});

// --- HELPER: Formatting Dates ---
function getLocalISODate(dateObj) {
    const offset = dateObj.getTimezoneOffset() * 60000;
    return (new Date(dateObj - offset)).toISOString().split('T')[0];
}

// --- CORE DATA INITIALIZATION ---
async function initializeDashboard() {
    userData = await window.BodyProDataStore.getData();
    const settings = userData.settings;
    const todayStr = getLocalISODate(new Date());

    // 1. Establish Protocol & Goals
    const workoutDays = settings.goals.workoutDaysPerWeek || 6;
    const liftMins = settings.goals.targetLiftingMinutes || 90;
    const cardioMins = settings.goals.targetCardioMinutes || 20;
    
    protocolTitle.innerText = "Resistance & Conditioning";
    protocolDesc.innerText = `Target: ${workoutDays}x / week | Lift: ~${liftMins}m | Cardio: ~${cardioMins}m`;

    // 2. Establish Macro Targets
    protTarget.innerText = `/ ${settings.macroTargets.protein}g`;
    carbTarget.innerText = `/ ${settings.macroTargets.carbs}g`;
    fatTarget.innerText = `/ ${settings.macroTargets.fats}g`;

    // 3. Calculate Today's Ingestion 
    let todayCals = 0, todayProt = 0, todayCarb = 0, todayFat = 0;
    const todaysFoods = (userData.food_diary || []).filter(f => f.date === todayStr);
    todaysFoods.forEach(food => {
        todayCals += Number(food.calories || 0);
        todayProt += Number(food.protein || 0);
        todayCarb += Number(food.carbs || 0);
        todayFat += Number(food.fats || 0);
    });

    // 4. Render Nutritional Telemetry
    calsEatenEl.innerText = Math.round(todayCals);
    const remaining = settings.macroTargets.calories - todayCals;
    calsRemainingEl.innerText = remaining < 0 ? 0 : Math.round(remaining);
    
    protVal.innerText = `${Math.round(todayProt)}g`;
    carbVal.innerText = `${Math.round(todayCarb)}g`;
    fatVal.innerText = `${Math.round(todayFat)}g`;

    const ringColor = remaining < 0 ? 'var(--danger)' : 'var(--accent)';
    const targetCals = settings.macroTargets.calories;
    const pct = Math.min((todayCals / targetCals) * 100, 100);
    document.getElementById('calorieRing').style.background = `conic-gradient(${ringColor} ${pct}%, var(--bg-surface-elevated) 0)`;

    // 5. Biometrics & Hydration Initialization
    const todayBio = (userData.biometrics || []).find(b => b.date === todayStr);
    if (todayBio) {
        currentWater = todayBio.water || 0;
        stepCountEl.innerText = todayBio.steps || 0;
        floorCountEl.innerText = todayBio.floors || 0;
        restingHREl.innerText = todayBio.restingHR || "--";
        activeCalsEl.innerText = todayBio.activeCals || 0;
    }
    updateWaterUI();

    // 6. Sleep Telemetry Initialization
    const todaySleep = (userData.sleep_data || []).find(s => s.date === todayStr);
    if (todaySleep) {
        sleepDurationEl.innerText = todaySleep.durationStr || "--";
        sleepDeepEl.innerText = todaySleep.deep ? `${todaySleep.deep}h` : "--";
        sleepRemEl.innerText = todaySleep.rem ? `${todaySleep.rem}h` : "--";
        sleepRestfulnessEl.innerText = todaySleep.score || "--";
        sleepLatencyEl.innerText = todaySleep.latency ? `${todaySleep.latency}m` : "--";
    }
}

// --- CONTINGENCY GENERATOR (TIME-CRUNCH) ---
btnTimeCrunch.addEventListener('click', () => {
    isTimeCrunched = !isTimeCrunched;
    const settings = userData.settings;

    if (isTimeCrunched) {
        // Activate Contingency
        protocolTitle.innerText = "TIME-CRUNCH: Superset Protocol";
        protocolTitle.style.color = "var(--danger)";
        protocolDesc.innerText = `Lift: 30m (High Intensity) | Cardio: 15m (HIIT)`;
        protocolDesc.style.color = "var(--danger)";
        protocolDisplayBox.style.borderColor = "var(--danger)";
        protocolIconBox.style.background = "rgba(239, 68, 68, 0.1)"; // Danger transparent
        protocolIconBox.style.color = "var(--danger)";
        protocolIcon.className = "fa-solid fa-bolt";
        btnTimeCrunch.innerHTML = "<i class='fa-solid fa-rotate-left'></i> Revert";
    } else {
        // Revert to Standard Baseline
        const liftMins = settings.goals.targetLiftingMinutes || 90;
        const cardioMins = settings.goals.targetCardioMinutes || 20;
        const workoutDays = settings.goals.workoutDaysPerWeek || 6;
        
        protocolTitle.innerText = "Resistance & Conditioning";
        protocolTitle.style.color = "var(--text-main)";
        protocolDesc.innerText = `Target: ${workoutDays}x / week | Lift: ~${liftMins}m | Cardio: ~${cardioMins}m`;
        protocolDesc.style.color = "var(--text-muted)";
        protocolDisplayBox.style.borderColor = "var(--border-color)";
        protocolIconBox.style.background = "var(--bg-surface-elevated)";
        protocolIconBox.style.color = "var(--text-main)";
        protocolIcon.className = "fa-solid fa-dumbbell";
        btnTimeCrunch.innerHTML = "<i class='fa-solid fa-bolt'></i> Time-Crunch";
    }
});

// --- HYDRATION PROTOCOLS ---
function updateWaterUI() {
    waterCountEl.innerHTML = `${currentWater} <span style="font-size: 0.9rem; color: var(--text-muted);">fl oz</span>`;
}

let waterSaveTimeout;
function queueWaterSave() {
    updateWaterUI();
    clearTimeout(waterSaveTimeout);
    waterSaveTimeout = setTimeout(async () => {
        const todayStr = getLocalISODate(new Date());
        let bioIndex = userData.biometrics.findIndex(b => b.date === todayStr);
        
        if (bioIndex >= 0) {
            userData.biometrics[bioIndex].water = currentWater;
        } else {
            userData.biometrics.push({ id: 'bio_' + Date.now(), date: todayStr, water: currentWater });
        }
        await window.BodyProDataStore.saveData(userData);
    }, 1000);
}

btnAddWater.addEventListener('click', () => {
    const increment = parseInt(customWaterInput.value) || 8;
    currentWater += increment;
    queueWaterSave();
});

btnSubWater.addEventListener('click', () => {
    const decrement = parseInt(customWaterInput.value) || 8;
    if (currentWater >= decrement) {
        currentWater -= decrement;
        queueWaterSave();
    } else {
        currentWater = 0;
        queueWaterSave();
    }
});

// --- SLEEP PROTOCOLS ---
function calculateDuration(bedTime, wakeTime) {
    if (!bedTime || !wakeTime) return null;
    let bed = new Date(`2000-01-01T${bedTime}`);
    let wake = new Date(`2000-01-01T${wakeTime}`);
    
    if (wake < bed) wake.setDate(wake.getDate() + 1);
    
    let diffMs = wake - bed;
    let hrs = Math.floor(diffMs / 3600000);
    let mins = Math.floor((diffMs % 3600000) / 60000);
    return `${hrs}h ${mins}m`;
}

btnSaveSleep.addEventListener('click', async () => {
    const todayStr = getLocalISODate(new Date());
    btnSaveSleep.disabled = true;
    btnSaveSleep.innerText = "Encrypting...";

    const durationStr = calculateDuration(inputBedTime.value, inputWakeTime.value) || "--";
    const deep = parseFloat(inputDeepSleep.value) || null;
    const rem = parseFloat(inputRemSleep.value) || null;
    const score = parseInt(inputRestfulness.value) || null;
    const latency = parseInt(inputLatency.value) || null;

    let sleepIndex = userData.sleep_data.findIndex(s => s.date === todayStr);
    const payload = {
        id: sleepIndex >= 0 ? userData.sleep_data[sleepIndex].id : 'slp_' + Date.now(),
        date: todayStr,
        bedTime: inputBedTime.value,
        wakeTime: inputWakeTime.value,
        durationStr: durationStr,
        deep: deep,
        rem: rem,
        score: score,
        latency: latency,
        timestamp: new Date().toISOString()
    };

    if (sleepIndex >= 0) {
        userData.sleep_data[sleepIndex] = payload;
    } else {
        userData.sleep_data.push(payload);
    }

    await window.BodyProDataStore.saveData(userData);
    
    await initializeDashboard();
    document.getElementById('sleepModal').classList.remove('active');
    btnSaveSleep.disabled = false;
    btnSaveSleep.innerText = "Save Sleep Log";
});

// --- VITALS PROTOCOLS ---
btnSaveVitals.addEventListener('click', async () => {
    const todayStr = getLocalISODate(new Date());
    btnSaveVitals.disabled = true;
    btnSaveVitals.innerText = "Encrypting...";

    let bioIndex = userData.biometrics.findIndex(b => b.date === todayStr);
    if (bioIndex < 0) {
        userData.biometrics.push({ id: 'bio_' + Date.now(), date: todayStr, water: currentWater });
        bioIndex = userData.biometrics.length - 1;
    }

    userData.biometrics[bioIndex].steps = parseInt(inputSteps.value) || 0;
    userData.biometrics[bioIndex].floors = parseInt(inputFloors.value) || 0;
    userData.biometrics[bioIndex].restingHR = parseInt(inputRestingHR.value) || null;
    userData.biometrics[bioIndex].activeCals = parseInt(inputActiveCals.value) || 0;

    await window.BodyProDataStore.saveData(userData);

    await initializeDashboard();
    document.getElementById('vitalsModal').classList.remove('active');
    btnSaveVitals.disabled = false;
    btnSaveVitals.innerText = "Save Vitals";
});
