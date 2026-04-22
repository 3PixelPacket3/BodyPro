// settings.js - BodyPro Profile & Configuration Logic

import { auth } from './data-store.js';
import { onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- DOM Elements ---

// Section 1: Identity
const profName = document.getElementById('profName');
const profAge = document.getElementById('profAge');
const profSex = document.getElementById('profSex');
const profHeight = document.getElementById('profHeight');
const profGoalWeight = document.getElementById('profGoalWeight');
const profActivity = document.getElementById('profActivity');
const profObjective = document.getElementById('profObjective');
const btnSaveIdentity = document.getElementById('btnSaveIdentity');

// Section 1.5: Macro Calculator
const calcSex = document.getElementById('calcSex');
const calcAge = document.getElementById('calcAge');
const calcWeight = document.getElementById('calcWeight');
const calcHeight = document.getElementById('calcHeight');
const calcActivity = document.getElementById('calcActivity');
const calcGoal = document.getElementById('calcGoal');
const calcResultCals = document.getElementById('calcResultCals');
const calcResultProt = document.getElementById('calcResultProt');
const calcResultCarb = document.getElementById('calcResultCarb');
const calcResultFat = document.getElementById('calcResultFat');
const btnRunMacroCalc = document.getElementById('btnRunMacroCalc');
const btnApplyMacros = document.getElementById('btnApplyMacros');

// Section 2: Targets & Goals
const goalCals = document.getElementById('goalCals');
const goalProt = document.getElementById('goalProt');
const goalCarb = document.getElementById('goalCarb');
const goalFat = document.getElementById('goalFat');

const goalSleep = document.getElementById('goalSleep');
const goalSteps = document.getElementById('goalSteps');
const goalFloors = document.getElementById('goalFloors');
const goalWater = document.getElementById('goalWater');
const goalWorkoutDays = document.getElementById('goalWorkoutDays');
const goalLiftMins = document.getElementById('goalLiftMins');
const goalCardioMins = document.getElementById('goalCardioMins');
const btnSaveTargets = document.getElementById('btnSaveTargets');

// Section 3: Preferences
const prefTheme = document.getElementById('prefTheme');
const prefWeight = document.getElementById('prefWeight');
const prefFluid = document.getElementById('prefFluid');
const prefTime = document.getElementById('prefTime');
const prefMeal = document.getElementById('prefMeal');
const btnSavePrefs = document.getElementById('btnSavePrefs');
const btnInstallApp = document.getElementById('btnInstallApp');

// Section 4: Data Management (Danger Zone)
const btnExportData = document.getElementById('btnExportData');
const inputImportData = document.getElementById('inputImportData');
const btnResetWeek = document.getElementById('btnResetWeek');
const btnWipeAccount = document.getElementById('btnWipeAccount');
const btnSignOut = document.getElementById('btnSignOut');

// --- STATE MANAGEMENT ---
let userData = null;

// --- THE SECURITY GUARD ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }
    
    userData = await window.BodyProDataStore.getData();
    
    // Ensure nested objects exist to prevent null reference errors
    if (!userData.profile) userData.profile = {};
    if (!userData.settings) userData.settings = { macroTargets: {}, goals: {}, preferences: {} };
    if (!userData.settings.macroTargets) userData.settings.macroTargets = {};
    if (!userData.settings.goals) userData.settings.goals = {};
    if (!userData.settings.preferences) userData.settings.preferences = {};

    populateUI(user);
});

// --- UI POPULATION ---
function populateUI(user) {
    // 1. Identity
    profName.value = user.displayName || userData.profile?.displayName || '';
    profAge.value = userData.profile?.age || '';
    if (userData.profile?.sex) {
        profSex.value = userData.profile.sex;
        calcSex.value = userData.profile.sex;
    }
    profHeight.value = userData.profile?.heightInches || '';
    profGoalWeight.value = userData.profile?.goalWeight || '';
    if (userData.profile?.activityLevel) {
        profActivity.value = userData.profile.activityLevel;
        calcActivity.value = userData.profile.activityLevel;
    }
    if (userData.profile?.objective) {
        profObjective.value = userData.profile.objective;
    }

    // Pre-fill Macro Calculator based on identity
    calcAge.value = userData.profile?.age || '';
    calcHeight.value = userData.profile?.heightInches || '';
    if (userData.biometrics && userData.biometrics.length > 0) {
        calcWeight.value = userData.biometrics[userData.biometrics.length - 1].weight || '';
    }

    // 2. Nutritional Targets
    goalCals.value = userData.settings?.macroTargets?.calories || 2200;
    goalProt.value = userData.settings?.macroTargets?.protein || 200;
    goalCarb.value = userData.settings?.macroTargets?.carbs || 150;
    goalFat.value = userData.settings?.macroTargets?.fats || 88;

    // 3. Biometric & Activity Goals
    goalSleep.value = userData.settings?.goals?.sleepHrs || 7.5;
    goalSteps.value = userData.settings?.goals?.steps || 10000;
    goalFloors.value = userData.settings?.goals?.floors || 10;
    goalWater.value = userData.settings?.goals?.waterOz || 120;
    goalWorkoutDays.value = userData.settings?.goals?.workoutDaysPerWeek || 6;
    goalLiftMins.value = userData.settings?.goals?.targetLiftingMinutes || 90;
    goalCardioMins.value = userData.settings?.goals?.targetCardioMinutes || 20;

    // 4. Preferences
    if (userData.settings?.preferences?.theme) prefTheme.value = userData.settings.preferences.theme;
    if (userData.settings?.preferences?.weightUnit) prefWeight.value = userData.settings.preferences.weightUnit;
    if (userData.settings?.preferences?.fluidUnit) prefFluid.value = userData.settings.preferences.fluidUnit;
    if (userData.settings?.preferences?.timeFormat) prefTime.value = userData.settings.preferences.timeFormat;
    if (userData.settings?.preferences?.defaultMeal) prefMeal.value = userData.settings.preferences.defaultMeal;
}

// --- MODULE 1: IDENTITY MANAGEMENT ---
btnSaveIdentity.addEventListener('click', async () => {
    btnSaveIdentity.disabled = true;
    btnSaveIdentity.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

    // Update Firebase Auth Profile if name changed
    if (profName.value.trim() && profName.value.trim() !== auth.currentUser.displayName) {
        await updateProfile(auth.currentUser, { displayName: profName.value.trim() });
    }

    userData.profile = {
        displayName: profName.value.trim(),
        age: parseInt(profAge.value) || null,
        sex: profSex.value,
        heightInches: parseInt(profHeight.value) || null,
        goalWeight: parseInt(profGoalWeight.value) || null,
        activityLevel: parseFloat(profActivity.value),
        objective: profObjective.value,
        shortId: userData.profile.shortId // Preserve the Short ID
    };

    const success = await window.BodyProDataStore.saveData(userData);
    
    if (success) {
        btnSaveIdentity.innerHTML = '<i class="fa-solid fa-check"></i> Identity Secured';
        setTimeout(() => {
            btnSaveIdentity.disabled = false;
            btnSaveIdentity.innerText = 'Update Identity';
        }, 2000);
    }
});

// --- MODULE 1.5: MACRO CALCULATOR ---
btnRunMacroCalc.addEventListener('click', () => {
    const sex = calcSex.value;
    const age = parseInt(calcAge.value);
    const weightLbs = parseFloat(calcWeight.value);
    const heightIn = parseFloat(calcHeight.value);
    const activity = parseFloat(calcActivity.value);
    const goal = parseFloat(calcGoal.value);

    if (!age || !weightLbs || !heightIn) {
        alert("Please provide Age, Weight, and Height to calculate your macros.");
        return;
    }

    // Convert to Metric for Mifflin-St Jeor equation
    const weightKg = weightLbs * 0.453592;
    const heightCm = heightIn * 2.54;

    let bmr;
    if (sex === 'male') {
        bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
    } else {
        bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
    }

    // Calculate TDEE and apply goal modifier
    const tdee = bmr * activity;
    let targetCals = Math.round(tdee + goal);
    
    // Safety floor (don't recommend dipping below 1200)
    if (targetCals < 1200) targetCals = 1200;

    // Macro Split (Standard Bodybuilding approach: 1g/lb protein, 25% fats, rest carbs)
    const protGrams = Math.round(weightLbs * 1.0); 
    const fatGrams = Math.round((targetCals * 0.25) / 9); 
    const carbCals = targetCals - (protGrams * 4) - (fatGrams * 9);
    const carbGrams = Math.round(Math.max(0, carbCals / 4));

    // Update UI
    calcResultCals.innerText = `${targetCals} kcal`;
    calcResultProt.innerText = protGrams;
    calcResultFat.innerText = fatGrams;
    calcResultCarb.innerText = carbGrams;

    // Store in dataset for easy application
    btnApplyMacros.dataset.cals = targetCals;
    btnApplyMacros.dataset.prot = protGrams;
    btnApplyMacros.dataset.fat = fatGrams;
    btnApplyMacros.dataset.carb = carbGrams;

    // Reveal the Apply button
    btnApplyMacros.style.display = 'block';
});

btnApplyMacros.addEventListener('click', () => {
    // Port values over to the target inputs
    goalCals.value = btnApplyMacros.dataset.cals;
    goalProt.value = btnApplyMacros.dataset.prot;
    goalFat.value = btnApplyMacros.dataset.fat;
    goalCarb.value = btnApplyMacros.dataset.carb;

    // Flash the Target Section to draw attention
    const targetSection = goalCals.closest('.settings-section');
    targetSection.style.transition = 'box-shadow 0.3s';
    targetSection.style.boxShadow = '0 0 15px var(--accent)';
    
    setTimeout(() => {
        targetSection.style.boxShadow = 'none';
        btnSaveTargets.click(); // Automatically trigger the save routine
    }, 800);
});

// --- MODULE 2: TARGETS & GOALS ---
btnSaveTargets.addEventListener('click', async () => {
    btnSaveTargets.disabled = true;
    btnSaveTargets.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    userData.settings.macroTargets = {
        calories: parseInt(goalCals.value) || 2200,
        protein: parseInt(goalProt.value) || 200,
        carbs: parseInt(goalCarb.value) || 150,
        fats: parseInt(goalFat.value) || 88
    };

    userData.settings.goals = {
        sleepHrs: parseFloat(goalSleep.value) || 7.5,
        steps: parseInt(goalSteps.value) || 10000,
        floors: parseInt(goalFloors.value) || 10,
        waterOz: parseInt(goalWater.value) || 120,
        workoutDaysPerWeek: parseInt(goalWorkoutDays.value) || 6,
        targetLiftingMinutes: parseInt(goalLiftMins.value) || 90,
        targetCardioMinutes: parseInt(goalCardioMins.value) || 20
    };

    const success = await window.BodyProDataStore.saveData(userData);
    
    if (success) {
        btnSaveTargets.innerHTML = '<i class="fa-solid fa-check"></i> Targets Locked';
        setTimeout(() => {
            btnSaveTargets.disabled = false;
            btnSaveTargets.innerText = 'Save Targets';
        }, 2000);
    }
});

// --- MODULE 3: SYSTEM PREFERENCES ---
btnSavePrefs.addEventListener('click', async () => {
    btnSavePrefs.disabled = true;
    btnSavePrefs.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Applying...';

    userData.settings.preferences = {
        theme: prefTheme.value,
        weightUnit: prefWeight.value,
        fluidUnit: prefFluid.value,
        timeFormat: prefTime.value,
        defaultMeal: prefMeal.value
    };

    // Apply theme immediately
    if (prefTheme.value === 'system') {
        const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        document.documentElement.setAttribute('data-theme', prefersLight ? 'light' : 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', prefTheme.value);
    }

    const success = await window.BodyProDataStore.saveData(userData);
    
    if (success) {
        btnSavePrefs.innerHTML = '<i class="fa-solid fa-check"></i> Preferences Applied';
        setTimeout(() => {
            btnSavePrefs.disabled = false;
            btnSavePrefs.innerText = 'Apply Preferences';
        }, 2000);
    }
});

// --- MODULE 4: DATA MANAGEMENT (DANGER ZONE) ---

// Backup/Export
btnExportData.addEventListener('click', () => {
    if (!userData) return alert("System Error: No data available to export.");
    
    const dataStr = JSON.stringify(userData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `BodyPro_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Import/Restore
inputImportData.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm("WARNING: Importing a backup will overwrite your current cloud data. Proceed?")) {
        inputImportData.value = ''; // Reset input
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!importedData.profile) throw new Error("Invalid payload structure.");
            
            const success = await window.BodyProDataStore.saveData(importedData);
            if (success) {
                alert("Backup restored successfully. The system will now reload.");
                window.location.reload();
            } else {
                alert("Error synchronizing imported data to the cloud.");
            }
        } catch (error) {
            alert("File corruption detected. Cannot parse JSON backup.");
            console.error("Import Error:", error);
        }
        inputImportData.value = ''; // Reset input
    };
    reader.readAsText(file);
});

// 7-Day Rollback
btnResetWeek.addEventListener('click', async () => {
    if (!confirm("WARNING: This will permanently delete all diary entries, workouts, and biometrics logged in the last 7 days. This action cannot be undone. Execute?")) return;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    const cutoffISO = cutoffDate.toISOString().split('T')[0];

    // Filter Arrays
    if (userData.food_diary) {
        userData.food_diary = userData.food_diary.filter(f => f.date < cutoffISO);
    }
    if (userData.biometrics) {
        userData.biometrics = userData.biometrics.filter(b => b.date < cutoffISO);
    }
    if (userData.sleep_data) {
        userData.sleep_data = userData.sleep_data.filter(s => s.date < cutoffISO);
    }
    if (userData.workouts) {
        // Workouts use timestamp instead of strict date string
        userData.workouts = userData.workouts.filter(w => new Date(w.timestamp) < cutoffDate);
    }

    const success = await window.BodyProDataStore.saveData(userData);
    if (success) {
        alert("7-Day Rollback executed successfully.");
        window.location.reload();
    }
});

// Complete Account Wipe
btnWipeAccount.addEventListener('click', async () => {
    const confirmationWord = prompt("CRITICAL WARNING: You are about to wipe your entire BodyPro database. Type 'DELETE' to confirm execution.");
    if (confirmationWord !== 'DELETE') {
        alert("Wipe aborted.");
        return;
    }

    // Reset all arrays while maintaining the core structure and identity parameters
    userData = {
        profile: userData.profile, // Keep identity/Short ID intact
        settings: {
            macroTargets: { calories: 2200, protein: 200, carbs: 150, fats: 88 },
            goals: {
                sleepHrs: 7.5, steps: 10000, floors: 10, waterOz: 120,
                workoutDaysPerWeek: 6, targetLiftingMinutes: 90, targetCardioMinutes: 20
            },
            preferences: { theme: 'dark', weightUnit: 'lbs', fluidUnit: 'oz', timeFormat: '12', defaultMeal: 'Snacks' }
        },
        friends: [],
        food_diary: [],
        biometrics: [],
        sleep_data: [],
        workouts: [],
        custom_recipes: [],
        workout_templates: []
    };

    const success = await window.BodyProDataStore.saveData(userData);
    if (success) {
        alert("Database wiped. System has been factory reset.");
        window.location.replace('dashboard.html');
    }
});

// --- AUTHENTICATION ---
btnSignOut.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.replace('login.html');
    }).catch((error) => {
        console.error("Sign Out Error", error);
        alert("Failed to securely disconnect. Please check connection.");
    });
});

// --- PWA INSTALLATION LOGIC ---
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
});

if (btnInstallApp) {
    btnInstallApp.addEventListener('click', async () => {
        if (deferredPrompt) {
            // Show the install prompt
            deferredPrompt.prompt();
            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            deferredPrompt = null;
        } else {
            // Provide explicit instructions for mobile users when prompt API isn't supported (like Safari iOS)
            alert("To install BodyPro as an app:\n\n📱 iOS (Safari): Tap the 'Share' icon at the bottom, scroll down, and select 'Add to Home Screen'.\n\n📱 Android (Chrome): Tap the menu (three dots) and select 'Install app' or 'Add to Home Screen'.");
        }
    });
}

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    console.log('PWA was installed successfully');
});
