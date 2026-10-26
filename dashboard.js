import { auth } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- DOM ELEMENTS ---
const userGreeting = document.getElementById('userGreeting');
const heroBanner = document.getElementById('heroBanner');
const readinessScoreCircle = document.getElementById('readinessScoreCircle');
const readinessStatusText = document.getElementById('readinessStatusText');
const readinessAdviceBanner = document.getElementById('readinessAdviceBanner');
const streakCountBadge = document.getElementById('streakCountBadge');

// Today's Protocol Elements
const protocolSelect = document.getElementById('protocolSelect');
const todayProtocolContainer = document.getElementById('todayProtocolContainer');
const btnTimeCrunch = document.getElementById('btnTimeCrunch');
const btnLaunchProtocol = document.getElementById('btnLaunchProtocol');
const scheduledSplitHint = document.getElementById('scheduledSplitHint');

// Recovery & Activity Elements
const dashSleepHrs = document.getElementById('dashSleepHrs');
const dashSleepGoalLbl = document.getElementById('dashSleepGoalLbl');
const dashStepsVal = document.getElementById('dashStepsVal');
const dashStepsGoalLbl = document.getElementById('dashStepsGoalLbl');
const dashActiveBurn = document.getElementById('dashActiveBurn');
const btnToggleQuickRecovery = document.getElementById('btnToggleQuickRecovery');
const quickRecoveryDrawer = document.getElementById('quickRecoveryDrawer');
const quickSleepHrs = document.getElementById('quickSleepHrs');
const quickSleepQuality = document.getElementById('quickSleepQuality');
const quickStepsInput = document.getElementById('quickStepsInput');
const btnAdd1kSteps = document.getElementById('btnAdd1kSteps');
const btnSaveQuickRecovery = document.getElementById('btnSaveQuickRecovery');

// Nutrition Elements
const calsRemaining = document.getElementById('calsRemaining');
const calsEaten = document.getElementById('calsEaten');
const calsTargetSub = document.getElementById('calsTargetSub');
const netCalorieModeHint = document.getElementById('netCalorieModeHint');
const protVal = document.getElementById('protVal');
const protTarget = document.getElementById('protTarget');
const carbVal = document.getElementById('carbVal');
const carbTarget = document.getElementById('carbTarget');
const fatVal = document.getElementById('fatVal');
const fatTarget = document.getElementById('fatTarget');
const calorieRing = document.getElementById('calorieRing');

// Micro Grid Elements
const sugarVal = document.getElementById('sugarVal');
const sodiumVal = document.getElementById('sodiumVal');
const ironVal = document.getElementById('ironVal');
const potassiumVal = document.getElementById('potassiumVal');
const fiberVal = document.getElementById('fiberVal');
const vitAVal = document.getElementById('vitAVal');
const vitCVal = document.getElementById('vitCVal');
const calciumVal = document.getElementById('calciumVal');
const satFatVal = document.getElementById('satFatVal');

// Body Metrics Elements
const dashWeight = document.getElementById('dashWeight');
const dashWeightUnitLbl = document.getElementById('dashWeightUnitLbl');
const dashBodyFat = document.getElementById('dashBodyFat');
const dashLBM = document.getElementById('dashLBM');
const dashLBMUnitLbl = document.getElementById('dashLBMUnitLbl');

// Hydration Elements
const waterCount = document.getElementById('waterCount');
const waterTargetLabel = document.getElementById('waterTargetLabel');
const btnAddWater = document.getElementById('btnAddWater');
const btnSubWater = document.getElementById('btnSubWater');
const customWaterInput = document.getElementById('customWaterInput');
const btnQuickWater8 = document.getElementById('btnQuickWater8');
const btnQuickWater16 = document.getElementById('btnQuickWater16');

// --- STATE MANAGEMENT ---
let userData = null;
let isTimeCrunchActive = false;

function getLocalISODate() {
    return window.BodyProTelemetry.getLocalISODate();
}

// --- INITIALIZATION ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }

    userData = await window.BodyProDataStore.getData();
    
    if (!userData.settings) userData.settings = { macroTargets: {}, goals: {}, preferences: {} };
    if (!userData.food_diary) userData.food_diary = [];
    if (!userData.biometrics) userData.biometrics = [];
    if (!userData.sleep_data) userData.sleep_data = [];
    if (!userData.workout_templates) userData.workout_templates = [];

    populateProtocolDropdown();
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

function populateProtocolDropdown() {
    if (!protocolSelect || !todayProtocolContainer) return;

    protocolSelect.innerHTML = '<option value="">-- Select Training Protocol --</option>';
    const templates = userData.workout_templates || [];

    if (templates.length > 0) {
        protocolSelect.style.display = 'block';
        templates.forEach(workout => {
            const opt = document.createElement('option');
            opt.value = workout.id;
            opt.textContent = workout.title;
            protocolSelect.appendChild(opt);
        });

        // Check if today has a scheduled split template
        const todayDayIdx = new Date().getDay();
        const scheduledId = userData.settings?.weeklySplit?.[todayDayIdx];
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        if (scheduledId && templates.some(t => t.id === scheduledId)) {
            protocolSelect.value = scheduledId;
            if (scheduledSplitHint) scheduledSplitHint.innerText = `Auto-queued for ${dayNames[todayDayIdx]} Split`;
            renderSelectedProtocol(scheduledId, isTimeCrunchActive);
        } else {
            protocolSelect.value = templates[0].id;
            if (scheduledSplitHint) scheduledSplitHint.innerText = `${templates.length} saved protocol(s) ready`;
            renderSelectedProtocol(templates[0].id, isTimeCrunchActive);
        }
    } else {
        protocolSelect.style.display = 'none';
        if (scheduledSplitHint) scheduledSplitHint.innerText = 'No templates saved yet';
        todayProtocolContainer.innerHTML = '<p class="text-muted" style="font-size: 0.85rem; text-align: center; padding: 10px;">No custom protocols found. Build or load one in the Fitness tab.</p>';
    }
}

// --- CORE RENDER ENGINE ---
function renderDashboard() {
    const todayStr = getLocalISODate(); 
    const name = userData.profile?.displayName || "Commander";
    const hour = new Date().getHours();
    let timeGreeting = "Good Evening";
    if (hour < 12) timeGreeting = "Good Morning";
    else if (hour < 17) timeGreeting = "Good Afternoon";
    if (userGreeting) userGreeting.innerText = `${timeGreeting}, ${name}.`;

    const weightUnit = window.BodyProUnits.getWeightUnit(userData);
    const fluidUnit = window.BodyProUnits.getFluidUnit(userData);

    // 1. Readiness Score & CNS Status
    const readiness = window.BodyProTelemetry.calculateReadiness(userData);
    if (readinessScoreCircle) {
        readinessScoreCircle.innerText = `${readiness.score}%`;
        readinessScoreCircle.style.borderColor = readiness.color;
    }
    if (readinessStatusText) {
        readinessStatusText.innerText = readiness.status;
        readinessStatusText.style.color = readiness.color;
    }
    if (readinessAdviceBanner) {
        readinessAdviceBanner.innerHTML = `<i class="fa-solid fa-microchip text-primary"></i> <strong>Telemetry Coach:</strong> ${readiness.advice}`;
    }

    // 2. Recovery, Sleep, Steps & Active Burn
    const todayBio = (userData.biometrics || []).find(b => b.date === todayStr) || {};
    const todaySleepEntry = (userData.sleep_data || []).find(s => s.date === todayStr);
    const sleepHrs = todaySleepEntry?.hours || todayBio.sleepHrs || null;
    const sleepGoal = userData.settings?.goals?.sleepHrs || 7.5;
    const stepsCount = todayBio.steps || 0;
    const stepsGoal = userData.settings?.goals?.steps || 10000;

    // Sum today's active workout calories
    const todaysWorkouts = (userData.workouts || []).filter(w => w.date === todayStr || (w.timestamp && w.timestamp.startsWith(todayStr)));
    let activeBurnCals = 0;
    todaysWorkouts.forEach(w => {
        activeBurnCals += (Number(w.telemetry?.activeCals) || 0);
    });

    if (dashSleepHrs) dashSleepHrs.innerText = sleepHrs ? `${sleepHrs}h` : '--';
    if (dashSleepGoalLbl) dashSleepGoalLbl.innerText = `Sleep / ${sleepGoal}h`;
    if (dashStepsVal) dashStepsVal.innerText = stepsCount.toLocaleString();
    if (dashStepsGoalLbl) dashStepsGoalLbl.innerText = `Steps / ${(stepsGoal/1000).toFixed(0)}k`;
    if (dashActiveBurn) dashActiveBurn.innerText = activeBurnCals;

    if (quickSleepHrs && !quickSleepHrs.value && sleepHrs) quickSleepHrs.value = sleepHrs;
    if (quickSleepQuality && !quickSleepQuality.value && (todaySleepEntry?.quality || todayBio.sleepQuality)) {
        quickSleepQuality.value = todaySleepEntry?.quality || todayBio.sleepQuality;
    }
    if (quickStepsInput && !quickStepsInput.value && stepsCount) quickStepsInput.value = stepsCount;

    // 3. Hydration Module (Unit-Aware)
    if (waterCount && waterTargetLabel) {
        const currentWaterOz = todayBio.waterOz || todayBio.water || 0;
        const waterGoalOz = userData.settings.goals?.waterOz || 120;
        const unitLabel = fluidUnit === 'ml' ? 'mL' : 'fl oz';
        waterCount.innerHTML = `${window.BodyProUnits.formatFluid(currentWaterOz, userData)} <span style="font-size: 0.9rem; color: var(--text-muted);">${unitLabel}</span>`;
        waterTargetLabel.innerText = `Goal: ${window.BodyProUnits.formatFluid(waterGoalOz, userData)} ${unitLabel}`;

        if (btnQuickWater8 && btnQuickWater16 && customWaterInput) {
            if (fluidUnit === 'ml') {
                btnQuickWater8.innerText = '+250 mL';
                btnQuickWater16.innerText = '+500 mL';
                if (customWaterInput.value === '8') customWaterInput.value = '250';
            } else {
                btnQuickWater8.innerText = '+8 oz';
                btnQuickWater16.innerText = '+16 oz';
                if (customWaterInput.value === '250') customWaterInput.value = '8';
            }
        }
    }

    // 4. Daily Nutrition & Dynamic Net Calorie Budget
    const targets = userData.settings.macroTargets || { calories: 2200, protein: 200, carbs: 150, fats: 88 };
    const includeBurn = userData.settings?.preferences?.includeActiveBurnInBudget !== false;
    const effectiveCalorieBudget = targets.calories + (includeBurn ? activeBurnCals : 0);

    if (netCalorieModeHint) {
        netCalorieModeHint.innerText = includeBurn && activeBurnCals > 0
            ? `Budget: ${targets.calories} + ${activeBurnCals} Active Burn = ${effectiveCalorieBudget} kcal`
            : `Base Target: ${targets.calories} kcal`;
    }
    if (calsTargetSub) calsTargetSub.innerText = `/ ${effectiveCalorieBudget} kcal`;
    if (protTarget) protTarget.innerText = `/ ${targets.protein}g`;
    if (carbTarget) carbTarget.innerText = `/ ${targets.carbs}g`;
    if (fatTarget) fatTarget.innerText = `/ ${targets.fats}g`;

    const todaysFood = userData.food_diary.filter(f => f.date === todayStr);
    let eatenCals = 0, eatenProt = 0, eatenCarb = 0, eatenFat = 0;
    let eatenSugar = 0, eatenSodium = 0, eatenIron = 0, eatenPotassium = 0;
    let eatenFiber = 0, eatenVitA = 0, eatenVitC = 0, eatenCalcium = 0, eatenSatFat = 0;
    
    todaysFood.forEach(item => {
        eatenCals += (Number(item.calories) || 0);
        eatenProt += (Number(item.protein) || 0);
        eatenCarb += (Number(item.carbs) || 0);
        eatenFat += (Number(item.fats) || 0);
        eatenSugar += (Number(item.sugar) || 0);
        eatenSodium += (Number(item.sodium) || 0);
        eatenIron += (Number(item.iron) || 0);
        eatenPotassium += (Number(item.potassium) || 0);
        eatenFiber += (Number(item.fiber) || 0);
        eatenVitA += (Number(item.vitA) || 0);
        eatenVitC += (Number(item.vitC) || 0);
        eatenCalcium += (Number(item.calcium) || 0);
        eatenSatFat += (Number(item.satFat) || 0);
    });

    if (calsEaten) calsEaten.innerText = Math.round(eatenCals);
    if (protVal) protVal.innerText = `${Math.round(eatenProt)}g`;
    if (carbVal) carbVal.innerText = `${Math.round(eatenCarb)}g`;
    if (fatVal) fatVal.innerText = `${Math.round(eatenFat)}g`;
    
    if (sugarVal) sugarVal.innerText = `${Math.round(eatenSugar)}g`;
    if (sodiumVal) sodiumVal.innerText = `${Math.round(eatenSodium)}mg`;
    if (ironVal) ironVal.innerText = `${Math.round(eatenIron)}mg`;
    if (potassiumVal) potassiumVal.innerText = `${Math.round(eatenPotassium)}mg`;
    if (fiberVal) fiberVal.innerText = `${Math.round(eatenFiber)}g`;
    if (vitAVal) vitAVal.innerText = `${Math.round(eatenVitA)}mcg`;
    if (vitCVal) vitCVal.innerText = `${Math.round(eatenVitC)}mg`;
    if (calciumVal) calciumVal.innerText = `${Math.round(eatenCalcium)}mg`;
    if (satFatVal) satFatVal.innerText = `${Math.round(eatenSatFat)}g`;

    if (calsRemaining) {
        const calsLeft = Math.max(0, effectiveCalorieBudget - eatenCals);
        calsRemaining.innerText = Math.round(calsLeft);
    }

    if (calorieRing) {
        const progressPerc = Math.min(100, (eatenCals / Math.max(1, effectiveCalorieBudget)) * 100);
        let ringColor = 'var(--accent)';
        if (eatenCals > effectiveCalorieBudget) ringColor = 'var(--danger)'; 
        calorieRing.style.background = `conic-gradient(${ringColor} ${progressPerc}%, var(--bg-surface-elevated) 0)`;
    }

    // 5. Body Metrics Snapshot Update (Unit-Aware)
    if (dashWeight && dashBodyFat && dashLBM) {
        const sortedBio = [...(userData.biometrics || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
        const latestWeightEntry = sortedBio.find(b => b.weight);
        const latestCompEntry = sortedBio.find(b => b.bodyFat);

        let weightLbs = latestWeightEntry ? parseFloat(latestWeightEntry.weight) : null;
        let bf = latestCompEntry ? parseFloat(latestCompEntry.bodyFat) : null;

        dashWeight.innerText = weightLbs ? window.BodyProUnits.formatWeight(weightLbs, userData, 1) : '--';
        if (dashWeightUnitLbl) dashWeightUnitLbl.innerText = `Current (${weightUnit})`;
        dashBodyFat.innerText = bf ? bf.toFixed(1) : '--';
        
        if (weightLbs && bf) {
            const fatMass = weightLbs * (bf / 100);
            const lbm = weightLbs - fatMass;
            dashLBM.innerText = window.BodyProUnits.formatWeight(lbm, userData, 1);
            if (dashLBMUnitLbl) dashLBMUnitLbl.innerText = `Lean Mass (${weightUnit})`;
        } else {
            dashLBM.innerText = '--';
        }
    }

    // 6. Weekly Consistency Streak Update
    const dayCircles = document.querySelectorAll('.day-circle');
    if (dayCircles.length === 7) {
        const today = new Date();
        const dayMap = [6, 0, 1, 2, 3, 4, 5]; // Sunday=0 maps to index 6, Monday=1 maps to index 0
        
        dayCircles.forEach(c => c.classList.remove('active'));
        let activeDaysThisWeek = 0;
        
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = window.BodyProTelemetry.getLocalISODate(d);
            
            const hasWorkout = (userData.workouts || []).some(w => w.date === dateStr || (w.timestamp && w.timestamp.startsWith(dateStr)));
            
            if (hasWorkout) {
                const dayIndex = dayMap[d.getDay()];
                if (dayCircles[dayIndex] && !dayCircles[dayIndex].classList.contains('active')) {
                    dayCircles[dayIndex].classList.add('active');
                    activeDaysThisWeek++;
                }
            }
        }
        const targetDays = userData.settings?.goals?.workoutDaysPerWeek || 6;
        if (streakCountBadge) streakCountBadge.innerText = `${activeDaysThisWeek} / ${targetDays} Days`;
    }
}

// --- PROTOCOL RENDERING & TIME-CRUNCH ENGINE ---
function renderSelectedProtocol(workoutId, isTimeCrunch = false) {
    if (!todayProtocolContainer) return;
    if (!workoutId) {
        todayProtocolContainer.innerHTML = '';
        return;
    }

    const workout = (userData.workout_templates || []).find(w => w.id === workoutId);
    if (workout && workout.exercises) {
        let html = `<ul style="list-style: none; padding: 0; margin: 0;">`;
        workout.exercises.forEach((ex, idx) => {
            const exName = ex.exercise || ex.name || 'Unknown Movement';
            let setsCount = (ex.sets && Array.isArray(ex.sets)) ? ex.sets.length : 1;
            
            if (isTimeCrunch && setsCount > 1) {
                setsCount = Math.ceil(setsCount / 2);
            }
            
            let repsText = "Var Reps";
            if (ex.sets && ex.sets.length > 0 && ex.sets[0].reps) {
                repsText = ex.sets[0].reps + " Reps";
            }

            const supersetTag = isTimeCrunch
                ? `<span style="color:var(--warning); font-size:0.7rem; margin-left: 6px; background: rgba(245,158,11,0.15); padding: 2px 6px; border-radius: 99px; font-weight: 800;"><i class="fa-solid fa-bolt"></i> Superset ${String.fromCharCode(65 + Math.floor(idx / 2))}${(idx % 2) + 1}</span>`
                : '';

            html += `
            <li style="padding: 10px 0; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; transition: opacity 0.2s;">
                <div>
                    <div style="font-weight: 700; font-size: 0.92rem;">${exName} ${supersetTag}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${setsCount} Working Sets &times; ${repsText}</div>
                </div>
                <button class="btn btn-ghost check-btn" style="width: auto; min-width: 0; padding: 5px 10px; font-size: 1rem; color: var(--text-muted); border: none;"><i class="fa-regular fa-circle"></i></button>
            </li>`;
        });
        html += `</ul>`;
        todayProtocolContainer.innerHTML = html;

        todayProtocolContainer.querySelectorAll('.check-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                window.BodyProHardware.playCheckSound();
                const icon = this.querySelector('i');
                if (icon.classList.contains('fa-circle')) {
                    icon.classList.replace('fa-regular', 'fa-solid');
                    icon.classList.replace('fa-circle', 'fa-circle-check');
                    icon.style.color = 'var(--accent)';
                    this.closest('li').style.opacity = '0.45';
                } else {
                    icon.classList.replace('fa-solid', 'fa-regular');
                    icon.classList.replace('fa-circle-check', 'fa-circle');
                    icon.style.color = 'var(--text-muted)';
                    this.closest('li').style.opacity = '1';
                }
            });
        });
    }
}

if (protocolSelect) {
    protocolSelect.addEventListener('change', (e) => {
        renderSelectedProtocol(e.target.value, isTimeCrunchActive);
    });
}

if (btnTimeCrunch) {
    btnTimeCrunch.addEventListener('click', (e) => {
        e.preventDefault();
        if (!protocolSelect || !protocolSelect.value) {
            alert("Please select a protocol from the dropdown first to toggle Time-Crunch mode.");
            return;
        }
        isTimeCrunchActive = !isTimeCrunchActive;
        btnTimeCrunch.style.background = isTimeCrunchActive ? 'var(--warning)' : 'transparent';
        btnTimeCrunch.style.color = isTimeCrunchActive ? '#09090b' : 'var(--warning)';
        window.BodyProHardware.playCheckSound();
        renderSelectedProtocol(protocolSelect.value, isTimeCrunchActive);
    });
}

if (btnLaunchProtocol) {
    btnLaunchProtocol.addEventListener('click', () => {
        if (protocolSelect && protocolSelect.value) {
            sessionStorage.setItem('bodypro_launch_template_id', protocolSelect.value);
            sessionStorage.setItem('bodypro_launch_time_crunch', isTimeCrunchActive ? '1' : '0');
        }
        window.location.href = 'fitness.html';
    });
}

// --- RECOVERY & STEPS QUICK LOGGER ---
if (btnToggleQuickRecovery) {
    btnToggleQuickRecovery.addEventListener('click', () => {
        const isHidden = quickRecoveryDrawer.style.display === 'none';
        quickRecoveryDrawer.style.display = isHidden ? 'block' : 'none';
    });
}

async function saveRecoveryTelemetry(addStepsDelta = 0) {
    if (!userData) return;
    const todayStr = getLocalISODate();
    let todayBio = userData.biometrics.find(b => b.date === todayStr);
    if (!todayBio) {
        todayBio = { id: `bio_${Date.now()}`, date: todayStr, waterOz: 0 };
        userData.biometrics.push(todayBio);
    }

    if (addStepsDelta > 0) {
        todayBio.steps = (Number(todayBio.steps) || 0) + addStepsDelta;
        if (quickStepsInput) quickStepsInput.value = todayBio.steps;
    } else {
        const sHrs = parseFloat(quickSleepHrs.value);
        const sQual = parseInt(quickSleepQuality.value);
        const steps = parseInt(quickStepsInput.value);

        if (!isNaN(steps) && steps >= 0) todayBio.steps = steps;
        if (!isNaN(sHrs) && sHrs > 0) {
            todayBio.sleepHrs = sHrs;
            todayBio.sleepQuality = !isNaN(sQual) ? Math.min(10, Math.max(1, sQual)) : 8;

            let sleepRec = userData.sleep_data.find(s => s.date === todayStr);
            if (!sleepRec) {
                sleepRec = { id: `slp_${Date.now()}`, date: todayStr };
                userData.sleep_data.push(sleepRec);
            }
            sleepRec.hours = sHrs;
            sleepRec.quality = todayBio.sleepQuality;
        }
    }

    window.BodyProHardware.playCheckSound();
    renderDashboard();
    await window.BodyProDataStore.saveData(userData);
}

if (btnAdd1kSteps) {
    btnAdd1kSteps.addEventListener('click', () => saveRecoveryTelemetry(1000));
}

if (btnSaveQuickRecovery) {
    btnSaveQuickRecovery.addEventListener('click', async () => {
        await saveRecoveryTelemetry(0);
        if (quickRecoveryDrawer) quickRecoveryDrawer.style.display = 'none';
    });
}

// --- HYDRATION MODULE ---
async function updateWaterOz(amountOz) {
    if (!userData) return;
    
    const todayStr = getLocalISODate(); 
    let todayBio = userData.biometrics.find(b => b.date === todayStr);
    if (!todayBio) {
        todayBio = { id: `bio_${Date.now()}`, date: todayStr, waterOz: 0 };
        userData.biometrics.push(todayBio);
    }
    
    const currentWater = todayBio.waterOz || todayBio.water || 0;
    todayBio.waterOz = Math.max(0, +(currentWater + amountOz).toFixed(1));
    todayBio.water = todayBio.waterOz;
    
    window.BodyProHardware.playCheckSound();
    renderDashboard();
    await window.BodyProDataStore.saveData(userData);
}

let isWaterProcessing = false;

async function handleWaterTap(isAdd, e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    if (isWaterProcessing) return;
    isWaterProcessing = true;

    if (document.activeElement) document.activeElement.blur();

    let rawVal = 8;
    if (customWaterInput) {
        rawVal = parseFloat(customWaterInput.value);
        if (isNaN(rawVal)) rawVal = 8;
    }
    const deltaOz = window.BodyProUnits.toInternalOz(rawVal, userData);
    
    await updateWaterOz(isAdd ? deltaOz : -deltaOz);
    
    setTimeout(() => { isWaterProcessing = false; }, 250);
}

if (btnAddWater) btnAddWater.addEventListener('pointerdown', (e) => handleWaterTap(true, e));
if (btnSubWater) btnSubWater.addEventListener('pointerdown', (e) => handleWaterTap(false, e));

if (btnQuickWater8) {
    btnQuickWater8.addEventListener('click', () => {
        const isMl = window.BodyProUnits.getFluidUnit(userData) === 'ml';
        updateWaterOz(isMl ? (250 / 29.5735) : 8);
    });
}
if (btnQuickWater16) {
    btnQuickWater16.addEventListener('click', () => {
        const isMl = window.BodyProUnits.getFluidUnit(userData) === 'ml';
        updateWaterOz(isMl ? (500 / 29.5735) : 16);
    });
}
