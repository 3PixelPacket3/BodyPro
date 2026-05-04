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

// Section 1.1: Supplements
const profSupplements = document.getElementById('profSupplements');
const btnSaveSupplements = document.getElementById('btnSaveSupplements');

// Section 1.2: Log Health Metrics
const logWeight = document.getElementById('logWeight');
const logSys = document.getElementById('logSys');
const logDia = document.getElementById('logDia');
const logPinch1 = document.getElementById('logPinch1');
const logPinch2 = document.getElementById('logPinch2');
const logPinch3 = document.getElementById('logPinch3');
const logBodyFat = document.getElementById('logBodyFat');
const btnLogMetrics = document.getElementById('btnLogMetrics');
const lblPinch1 = document.getElementById('lblPinch1');
const lblPinch2 = document.getElementById('lblPinch2');
const lblPinch3 = document.getElementById('lblPinch3');

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

const goalSugar = document.getElementById('goalSugar');
const goalSodium = document.getElementById('goalSodium');
const goalIron = document.getElementById('goalIron');
const goalPotassium = document.getElementById('goalPotassium');
const goalFiber = document.getElementById('goalFiber');
const goalVitA = document.getElementById('goalVitA');
const goalVitC = document.getElementById('goalVitC');
const goalCalcium = document.getElementById('goalCalcium');
const goalSatFat = document.getElementById('goalSatFat');

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
    if (!userData.settings) userData.settings = { macroTargets: {}, microTargets: {}, goals: {}, preferences: {} };
    if (!userData.settings.macroTargets) userData.settings.macroTargets = {};
    if (!userData.settings.microTargets) userData.settings.microTargets = {};
    if (!userData.settings.goals) userData.settings.goals = {};
    if (!userData.settings.preferences) userData.settings.preferences = {};
    if (!userData.biometrics) userData.biometrics = [];

    populateUI(user);
    updatePinchLabels();
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

    // Supplements
    profSupplements.value = userData.profile?.supplements || '';

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

    // Micronutrient Targets (Load defaults if missing)
    goalSugar.value = userData.settings?.microTargets?.sugar || 50;
    goalSodium.value = userData.settings?.microTargets?.sodium || 2300;
    goalIron.value = userData.settings?.microTargets?.iron || 18;
    goalPotassium.value = userData.settings?.microTargets?.potassium || 4700;
    goalFiber.value = userData.settings?.microTargets?.fiber || 30;
    goalVitA.value = userData.settings?.microTargets?.vitA || 900;
    goalVitC.value = userData.settings?.microTargets?.vitC || 90;
    goalCalcium.value = userData.settings?.microTargets?.calcium || 1000;
    goalSatFat.value = userData.settings?.microTargets?.satFat || 20;

    // 3. Biometric & Activity Goals
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

// --- MODULE 1: IDENTITY & HEALTH METRICS ---
profSex.addEventListener('change', updatePinchLabels);

function updatePinchLabels() {
    if(profSex.value === 'male') {
        lblPinch1.innerText = 'Chest (mm)';
        lblPinch2.innerText = 'Abdomen (mm)';
        lblPinch3.innerText = 'Thigh (mm)';
    } else {
        lblPinch1.innerText = 'Triceps (mm)';
        lblPinch2.innerText = 'Suprailiac (mm)';
        lblPinch3.innerText = 'Thigh (mm)';
    }
    calculateBodyFat();
}

function calculateBodyFat() {
    const p1 = parseFloat(logPinch1.value) || 0;
    const p2 = parseFloat(logPinch2.value) || 0;
    const p3 = parseFloat(logPinch3.value) || 0;
    const age = parseInt(profAge.value) || 25;
    const sex = profSex.value || 'male';

    if(p1 > 0 && p2 > 0 && p3 > 0) {
        const sum = p1 + p2 + p3;
        let bd = 0;
        // Jackson-Pollock 3-Site Algorithm
        if(sex === 'male') {
            bd = 1.10938 - (0.0008267 * sum) + (0.0000016 * sum * sum) - (0.0002574 * age);
        } else {
            bd = 1.0994921 - (0.0009929 * sum) + (0.0000023 * sum * sum) - (0.0001392 * age);
        }
        const bf = (495 / bd) - 450;
        logBodyFat.value = Math.max(2, Math.min(60, bf)).toFixed(1); // Cap between 2% and 60%
    } else if (p1 === 0 && p2 === 0 && p3 === 0) {
        // Only clear if all are empty so user can manually type BF%
    }
}

logPinch1.addEventListener('input', calculateBodyFat);
logPinch2.addEventListener('input', calculateBodyFat);
logPinch3.addEventListener('input', calculateBodyFat);

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
        supplements: userData.profile?.supplements || '', // Preserve supplements
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

btnSaveSupplements.addEventListener('click', async () => {
    btnSaveSupplements.disabled = true;
    btnSaveSupplements.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

    userData.profile.supplements = profSupplements.value;

    const success = await window.BodyProDataStore.saveData(userData);
    
    if (success) {
        btnSaveSupplements.innerHTML = '<i class="fa-solid fa-check"></i> Stack Saved';
        setTimeout(() => {
            btnSaveSupplements.disabled = false;
            btnSaveSupplements.innerText = 'Update Stack';
        }, 2000);
    }
});

btnLogMetrics.addEventListener('click', async () => {
    const w = parseFloat(logWeight.value);
    const bf = parseFloat(logBodyFat.value);
    const sys = parseInt(logSys.value);
    const dia = parseInt(logDia.value);

    if(!w && !bf && !sys && !dia) {
        alert("Please enter at least one metric to log.");
        return;
    }

    btnLogMetrics.disabled = true;
    btnLogMetrics.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    const todayStr = (new Date(d - offset)).toISOString().split('T')[0];

    let bio = userData.biometrics.find(b => b.date === todayStr);
    if (!bio) {
        bio = { id: `bio_${Date.now()}`, date: todayStr };
        userData.biometrics.push(bio);
    }

    if(w) bio.weight = w;
    if(bf) bio.bodyFat = bf;
    if(sys) bio.systolic = sys;
    if(dia) bio.diastolic = dia;

    const success = await window.BodyProDataStore.saveData(userData);
    
    if (success) {
        btnLogMetrics.innerHTML = '<i class="fa-solid fa-check"></i> Metrics Saved';
        logWeight.value = '';
        logBodyFat.value = '';
        logSys.value = '';
        logDia.value = '';
        logPinch1.value = '';
        logPinch2.value = '';
        logPinch3.value = '';
        setTimeout(() => {
            btnLogMetrics.disabled = false;
            btnLogMetrics.innerText = "Save Today's Metrics";
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
    
    userData.settings.microTargets = {
        sugar: parseInt(goalSugar.value) || 50,
        sodium: parseInt(goalSodium.value) || 2300,
        iron: parseInt(goalIron.value) || 18,
        potassium: parseInt(goalPotassium.value) || 4700,
        fiber: parseInt(goalFiber.value) || 30,
        vitA: parseInt(goalVitA.value) || 900,
        vitC: parseInt(goalVitC.value) || 90,
        calcium: parseInt(goalCalcium.value) || 1000,
        satFat: parseInt(goalSatFat.value) || 20
    };

    userData.settings.goals = {
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
            microTargets: { sugar: 50, sodium: 2300, iron: 18, potassium: 4700, fiber: 30, vitA: 900, vitC: 90, calcium: 1000, satFat: 20 },
            goals: {
                waterOz: 120,
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
