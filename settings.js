import { auth } from './data-store.js';
import { onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- DOM Elements ---

// Section 1: Identity
const profName = document.getElementById('profName');
const profAge = document.getElementById('profAge');
const profSex = document.getElementById('profSex');
const profHeight = document.getElementById('profHeight');
const profGoalWeight = document.getElementById('profGoalWeight');
const lblGoalWeight = document.getElementById('lblGoalWeight');
const profActivity = document.getElementById('profActivity');
const profObjective = document.getElementById('profObjective');
const btnSaveIdentity = document.getElementById('btnSaveIdentity');

// Section 1.1: Supplements
const profSupplements = document.getElementById('profSupplements');
const btnSaveSupplements = document.getElementById('btnSaveSupplements');

// Section 1.2: Log Health Metrics & Physique
const lblLogWeight = document.getElementById('lblLogWeight');
const logWeight = document.getElementById('logWeight');
const logSys = document.getElementById('logSys');
const logDia = document.getElementById('logDia');
const logHR = document.getElementById('logHR');
const logSleepHrs = document.getElementById('logSleepHrs');
const logSleepQual = document.getElementById('logSleepQual');
const logSteps = document.getElementById('logSteps');
const logWaist = document.getElementById('logWaist');
const logNeck = document.getElementById('logNeck');
const logHips = document.getElementById('logHips');
const logChest = document.getElementById('logChest');
const logBiceps = document.getElementById('logBiceps');
const logThighs = document.getElementById('logThighs');
const btnCalcNavyBF = document.getElementById('btnCalcNavyBF');
const logPinch1 = document.getElementById('logPinch1');
const logPinch2 = document.getElementById('logPinch2');
const logPinch3 = document.getElementById('logPinch3');
const logBodyFat = document.getElementById('logBodyFat');
const inputProgressPhoto = document.getElementById('inputProgressPhoto');
const photoUploadStatus = document.getElementById('photoUploadStatus');
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
const goalSleepHrs = document.getElementById('goalSleepHrs');
const goalSteps = document.getElementById('goalSteps');
const btnSaveTargets = document.getElementById('btnSaveTargets');

// Section 3: Preferences
const prefTheme = document.getElementById('prefTheme');
const prefWeight = document.getElementById('prefWeight');
const prefFluid = document.getElementById('prefFluid');
const prefTime = document.getElementById('prefTime');
const prefMeal = document.getElementById('prefMeal');
const prefActiveBurn = document.getElementById('prefActiveBurn');
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
let pendingProgressPhotoDataUrl = null;

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
    if (!userData.sleep_data) userData.sleep_data = [];
    if (!userData.progress_photos) userData.progress_photos = [];

    populateUI(user);
    updatePinchLabels();
});

// --- UI POPULATION ---
function populateUI(user) {
    const wUnit = window.BodyProUnits?.getWeightUnit(userData) || 'lbs';
    if (lblLogWeight) lblLogWeight.innerText = `Weight (${wUnit})`;
    if (lblGoalWeight) lblGoalWeight.innerText = `Goal Weight (${wUnit})`;

    // 1. Identity
    profName.value = user.displayName || userData.profile?.displayName || '';
    profAge.value = userData.profile?.age || '';
    if (userData.profile?.sex) {
        profSex.value = userData.profile.sex;
        calcSex.value = userData.profile.sex;
    }
    profHeight.value = userData.profile?.heightInches || '';
    profGoalWeight.value = userData.profile?.goalWeight ? window.BodyProUnits.formatWeight(userData.profile.goalWeight, userData, 1) : '';
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
        const latestBio = userData.biometrics[userData.biometrics.length - 1];
        calcWeight.value = latestBio.weight || '';
    }

    // Pre-fill today's logged metrics if already entered today
    const todayStr = window.BodyProTelemetry ? window.BodyProTelemetry.getLocalISODate() : new Date().toISOString().split('T')[0];
    const todayBio = (userData.biometrics || []).find(b => b.date === todayStr);
    if (todayBio) {
        if (todayBio.weight) logWeight.value = window.BodyProUnits.formatWeight(todayBio.weight, userData, 1);
        if (todayBio.systolic) logSys.value = todayBio.systolic;
        if (todayBio.diastolic) logDia.value = todayBio.diastolic;
        if (todayBio.hr) logHR.value = todayBio.hr;
        if (todayBio.sleepHrs) logSleepHrs.value = todayBio.sleepHrs;
        if (todayBio.sleepQuality) logSleepQual.value = todayBio.sleepQuality;
        if (todayBio.steps) logSteps.value = todayBio.steps;
        if (todayBio.waist) logWaist.value = todayBio.waist;
        if (todayBio.neck) logNeck.value = todayBio.neck;
        if (todayBio.hips) logHips.value = todayBio.hips;
        if (todayBio.chest) logChest.value = todayBio.chest;
        if (todayBio.biceps) logBiceps.value = todayBio.biceps;
        if (todayBio.thighs) logThighs.value = todayBio.thighs;
        if (todayBio.bodyFat) logBodyFat.value = todayBio.bodyFat;
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
    if (goalSleepHrs) goalSleepHrs.value = userData.settings?.goals?.sleepHrs || 7.5;
    if (goalSteps) goalSteps.value = userData.settings?.goals?.dailySteps || 10000;

    // 4. Preferences
    if (userData.settings?.preferences?.theme) prefTheme.value = userData.settings.preferences.theme;
    if (userData.settings?.preferences?.weightUnit) prefWeight.value = userData.settings.preferences.weightUnit;
    if (userData.settings?.preferences?.fluidUnit) prefFluid.value = userData.settings.preferences.fluidUnit;
    if (userData.settings?.preferences?.timeFormat) prefTime.value = userData.settings.preferences.timeFormat;
    if (userData.settings?.preferences?.defaultMeal) prefMeal.value = userData.settings.preferences.defaultMeal;
    if (prefActiveBurn && userData.settings?.preferences?.includeActiveBurn !== undefined) {
        prefActiveBurn.value = String(userData.settings.preferences.includeActiveBurn);
    }
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
        logBodyFat.value = Math.max(2, Math.min(60, bf)).toFixed(1);
    }
}

logPinch1.addEventListener('input', calculateBodyFat);
logPinch2.addEventListener('input', calculateBodyFat);
logPinch3.addEventListener('input', calculateBodyFat);

// U.S. Navy Body Fat % Calculator from Tape Circumference
if (btnCalcNavyBF) {
    btnCalcNavyBF.addEventListener('click', () => {
        const waist = parseFloat(logWaist?.value);
        const neck = parseFloat(logNeck?.value);
        const hips = parseFloat(logHips?.value);
        const height = parseFloat(profHeight.value) || 69;
        const sex = profSex.value || 'male';

        if (!waist || !neck || waist <= neck) {
            alert("Please enter valid Waist and Neck circumference measurements (in inches) to calculate U.S. Navy Body Fat %.");
            return;
        }

        let bf = 0;
        if (sex === 'male') {
            bf = 86.010 * Math.log10(waist - neck) - 70.041 * Math.log10(height) + 36.76;
        } else {
            if (!hips) {
                alert("Female U.S. Navy formula requires Waist, Neck, and Hips measurements.");
                return;
            }
            bf = 163.205 * Math.log10(waist + hips - neck) - 97.684 * Math.log10(height) - 78.387;
        }

        const clamped = Math.max(3, Math.min(60, bf)).toFixed(1);
        logBodyFat.value = clamped;
        window.BodyProHardware?.vibrate(15);
    });
}

// Progress Photo Compression Handler
if (inputProgressPhoto) {
    inputProgressPhoto.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        photoUploadStatus.style.display = 'block';
        photoUploadStatus.innerText = 'Compressing snapshot for encrypted vault...';

        try {
            pendingProgressPhotoDataUrl = await window.BodyProHardware.compressImage(file, 720, 0.72);
            photoUploadStatus.innerHTML = `<i class="fa-solid fa-circle-check"></i> Snapshot ready! Click "Save Today's Metrics" to commit.`;
        } catch (err) {
            console.error('[BodyPro Photo Error]', err);
            photoUploadStatus.innerText = 'Failed to process image.';
        }
    });
}

btnSaveIdentity.addEventListener('click', async () => {
    btnSaveIdentity.disabled = true;
    btnSaveIdentity.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

    // Update Firebase Auth Profile if name changed
    if (profName.value.trim() && profName.value.trim() !== auth.currentUser.displayName) {
        await updateProfile(auth.currentUser, { displayName: profName.value.trim() });
    }

    const rawGoalW = parseFloat(profGoalWeight.value);
    const internalGoalLbs = rawGoalW ? window.BodyProUnits.toInternalLbs(rawGoalW, userData) : null;

    userData.profile = {
        displayName: profName.value.trim(),
        age: parseInt(profAge.value) || null,
        sex: profSex.value,
        heightInches: parseInt(profHeight.value) || null,
        goalWeight: internalGoalLbs,
        activityLevel: parseFloat(profActivity.value),
        objective: profObjective.value,
        supplements: userData.profile?.supplements || '',
        shortId: userData.profile.shortId
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
    const rawW = parseFloat(logWeight.value);
    const w = rawW ? window.BodyProUnits.toInternalLbs(rawW, userData) : null;
    const bf = parseFloat(logBodyFat.value);
    const sys = parseInt(logSys.value);
    const dia = parseInt(logDia.value);
    const hr = parseInt(logHR?.value);
    const sleepHrs = parseFloat(logSleepHrs?.value);
    const sleepQual = parseInt(logSleepQual?.value);
    const steps = parseInt(logSteps?.value);
    const waist = parseFloat(logWaist?.value);
    const neck = parseFloat(logNeck?.value);
    const hips = parseFloat(logHips?.value);
    const chest = parseFloat(logChest?.value);
    const biceps = parseFloat(logBiceps?.value);
    const thighs = parseFloat(logThighs?.value);

    if(!w && !bf && !sys && !dia && !hr && !sleepHrs && !steps && !waist && !chest && !biceps && !thighs && !pendingProgressPhotoDataUrl) {
        alert("Please enter at least one metric, tape measurement, or photo to log.");
        return;
    }

    btnLogMetrics.disabled = true;
    btnLogMetrics.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    const todayStr = window.BodyProTelemetry ? window.BodyProTelemetry.getLocalISODate() : new Date().toISOString().split('T')[0];

    let bio = userData.biometrics.find(b => b.date === todayStr);
    if (!bio) {
        bio = { id: `bio_${Date.now()}`, date: todayStr };
        userData.biometrics.push(bio);
    }

    if(w) bio.weight = w;
    if(bf) bio.bodyFat = bf;
    if(sys) bio.systolic = sys;
    if(dia) bio.diastolic = dia;
    if(hr) bio.hr = hr;
    if(sleepHrs) {
        bio.sleepHrs = sleepHrs;
        if(sleepQual) bio.sleepQuality = sleepQual;

        // Also sync to dedicated sleep_data array
        let sleepEntry = (userData.sleep_data || []).find(s => s.date === todayStr);
        if (!sleepEntry) {
            sleepEntry = { id: `slp_${Date.now()}`, date: todayStr };
            userData.sleep_data.push(sleepEntry);
        }
        sleepEntry.hours = sleepHrs;
        sleepEntry.quality = sleepQual || 8;
    }
    if(steps) bio.steps = steps;
    if(waist) bio.waist = waist;
    if(neck) bio.neck = neck;
    if(hips) bio.hips = hips;
    if(chest) bio.chest = chest;
    if(biceps) bio.biceps = biceps;
    if(thighs) bio.thighs = thighs;

    if (pendingProgressPhotoDataUrl) {
        if (!userData.progress_photos) userData.progress_photos = [];
        // Replace existing photo for today or push new
        userData.progress_photos = userData.progress_photos.filter(p => p.date !== todayStr);
        userData.progress_photos.push({
            id: `photo_${Date.now()}`,
            date: todayStr,
            weight: w || bio.weight || null,
            bodyFat: bf || bio.bodyFat || null,
            dataUrl: pendingProgressPhotoDataUrl
        });
        pendingProgressPhotoDataUrl = null;
        if (photoUploadStatus) photoUploadStatus.style.display = 'none';
    }

    const success = await window.BodyProDataStore.saveData(userData);
    
    if (success) {
        window.BodyProHardware?.vibrate([15, 30, 15]);
        btnLogMetrics.innerHTML = '<i class="fa-solid fa-check"></i> Metrics Saved';
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

    // Open & highlight the Target Section
    const targetSection = document.getElementById('secTargets') || goalCals.closest('.accordion-section');
    if (targetSection) {
        targetSection.classList.add('active');
        targetSection.style.transition = 'box-shadow 0.3s';
        targetSection.style.boxShadow = '0 0 15px var(--accent)';
    }
    
    setTimeout(() => {
        if (targetSection) targetSection.style.boxShadow = 'none';
        btnSaveTargets.click(); // Automatically trigger the save routine
    }, 600);
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
        ...userData.settings.goals,
        waterOz: parseInt(goalWater.value) || 120,
        workoutDaysPerWeek: parseInt(goalWorkoutDays.value) || 6,
        targetLiftingMinutes: parseInt(goalLiftMins.value) || 90,
        targetCardioMinutes: parseInt(goalCardioMins.value) || 20,
        sleepHrs: parseFloat(goalSleepHrs?.value) || 7.5,
        dailySteps: parseInt(goalSteps?.value) || 10000
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
        ...userData.settings.preferences,
        theme: prefTheme.value,
        weightUnit: prefWeight.value,
        fluidUnit: prefFluid.value,
        timeFormat: prefTime.value,
        defaultMeal: prefMeal.value,
        includeActiveBurn: prefActiveBurn ? prefActiveBurn.value === 'true' : true
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
        populateUI(auth.currentUser);
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
        inputImportData.value = '';
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
        inputImportData.value = '';
    };
    reader.readAsText(file);
});

// 7-Day Rollback
btnResetWeek.addEventListener('click', async () => {
    if (!confirm("WARNING: This will permanently delete all diary entries, workouts, and biometrics logged in the last 7 days. This action cannot be undone. Execute?")) return;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    const cutoffISO = cutoffDate.toISOString().split('T')[0];

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

    userData = {
        profile: userData.profile,
        settings: {
            macroTargets: { calories: 2200, protein: 200, carbs: 150, fats: 88 },
            microTargets: { sugar: 50, sodium: 2300, iron: 18, potassium: 4700, fiber: 30, vitA: 900, vitC: 90, calcium: 1000, satFat: 20 },
            goals: {
                waterOz: 120,
                workoutDaysPerWeek: 6, targetLiftingMinutes: 90, targetCardioMinutes: 20,
                sleepHrs: 7.5, dailySteps: 10000
            },
            preferences: { theme: 'dark', weightUnit: 'lbs', fluidUnit: 'oz', timeFormat: '12', defaultMeal: 'Snacks', includeActiveBurn: true }
        },
        friends: [],
        food_diary: [],
        biometrics: [],
        sleep_data: [],
        progress_photos: [],
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
    e.preventDefault();
    deferredPrompt = e;
});

if (btnInstallApp) {
    btnInstallApp.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            deferredPrompt = null;
        } else {
            alert("To install BodyPro as an app:\n\n📱 iOS (Safari): Tap the 'Share' icon at the bottom, scroll down, and select 'Add to Home Screen'.\n\n📱 Android (Chrome): Tap the menu (three dots) and select 'Install app' or 'Add to Home Screen'.");
        }
    });
}

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    console.log('PWA was installed successfully');
});
