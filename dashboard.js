// dashboard.js - BodyPro Command Center Logic

import { auth } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- DOM Elements ---
const userGreeting = document.getElementById('userGreeting');
const calsRemainingEl = document.getElementById('calsRemaining');
const calsEatenEl = document.getElementById('calsEaten');

// Macros
const protVal = document.getElementById('protVal');
const carbVal = document.getElementById('carbVal');
const fatVal = document.getElementById('fatVal');
const protTarget = document.getElementById('protTarget');
const carbTarget = document.getElementById('carbTarget');
const fatTarget = document.getElementById('fatTarget');

// Water & Telemetry
const waterCountEl = document.getElementById('waterCount');
const btnAddWater = document.getElementById('btnAddWater');
const btnSubWater = document.getElementById('btnSubWater');
const sleepScoreEl = document.getElementById('sleepScore');
const restingHREl = document.getElementById('restingHR');
const activeCalsEl = document.getElementById('activeCals');

let currentWater = 0;
let userData = null;

// --- THE SECURITY GUARD ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }
    
    // Set a personalized, welcoming command center environment
    const displayName = user.displayName || "Joshua"; 
    userGreeting.innerText = `Welcome back, ${displayName}`;
    
    await initializeDashboard();
});

// --- CORE DATA INITIALIZATION ---
async function initializeDashboard() {
    userData = await window.BodyProDataStore.getData();
    const settings = userData.settings;

    // 1. Establish Targets
    protTarget.innerText = `/ ${settings.macroTargets.protein}g`;
    carbTarget.innerText = `/ ${settings.macroTargets.carbs}g`;
    fatTarget.innerText = `/ ${settings.macroTargets.fats}g`;

    // 2. Calculate Today's Ingestion 
    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local format
    let todayCals = 0, todayProt = 0, todayCarb = 0, todayFat = 0;

    const todaysFoods = (userData.food_diary || []).filter(f => f.date === todayStr);
    todaysFoods.forEach(food => {
        todayCals += Number(food.calories || 0);
        todayProt += Number(food.protein || 0);
        todayCarb += Number(food.carbs || 0);
        todayFat += Number(food.fats || 0);
    });

    // 3. Render Nutritional Telemetry
    calsEatenEl.innerText = Math.round(todayCals);
    const remaining = settings.macroTargets.calories - todayCals;
    calsRemainingEl.innerText = remaining < 0 ? 0 : Math.round(remaining);
    
    protVal.innerText = `${Math.round(todayProt)}g`;
    carbVal.innerText = `${Math.round(todayCarb)}g`;
    fatVal.innerText = `${Math.round(todayFat)}g`;

    // 4. Dynamic Ring Update
    const ringColor = remaining < 0 ? 'var(--danger)' : 'var(--accent)';
    const targetCals = settings.macroTargets.calories;
    const pct = Math.min((todayCals / targetCals) * 100, 100);
    document.getElementById('calorieRing').style.background = `conic-gradient(${ringColor} ${pct}%, var(--bg-surface-elevated) 0)`;

    // 5. Hydration Initialization
    const todayBio = (userData.biometrics || []).find(b => b.date === todayStr);
    if (todayBio && todayBio.water) {
        currentWater = todayBio.water;
    }
    updateWaterUI();

    // 6. Smartwatch Sync Simulation (Pulls most recent cloud data)
    if (userData.sleep_data && userData.sleep_data.length > 0) {
        sleepScoreEl.innerText = userData.sleep_data[0].score || "--";
    }
}

// --- HYDRATION PROTOCOLS ---
function updateWaterUI() {
    waterCountEl.innerHTML = `${currentWater} <span style="font-size: 0.9rem; color: var(--text-muted);">fl oz</span>`;
}

// Optimized debounced save to prevent excessive cloud writes if tapped rapidly
let waterSaveTimeout;
function queueWaterSave() {
    updateWaterUI();
    clearTimeout(waterSaveTimeout);
    waterSaveTimeout = setTimeout(async () => {
        const todayStr = new Date().toLocaleDateString('en-CA');
        let bioIndex = userData.biometrics.findIndex(b => b.date === todayStr);
        
        if (bioIndex >= 0) {
            userData.biometrics[bioIndex].water = currentWater;
        } else {
            userData.biometrics.push({
                id: 'bio_' + Date.now(),
                date: todayStr,
                water: currentWater,
                weight: null
            });
        }
        await window.BodyProDataStore.saveData(userData);
    }, 1000);
}

btnAddWater.addEventListener('click', () => {
    currentWater += 8; // Standard 8oz glass increment
    queueWaterSave();
});

btnSubWater.addEventListener('click', () => {
    if (currentWater >= 8) {
        currentWater -= 8;
        queueWaterSave();
    }
});
