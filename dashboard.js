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
const dashBodyFat = document.getElementById('dashBodyFat');
const dashLBM = document.getElementById('dashLBM');

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
    if (!userData.workout_templates) userData.workout_templates = []; 

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
    const todayStr = getLocalISODate(); 
    const name = userData.profile?.displayName || "Commander";
    const hour = new Date().getHours();
    let timeGreeting = "Good Evening";
    if (hour < 12) timeGreeting = "Good Morning";
    else if (hour < 17) timeGreeting = "Good Afternoon";
    if (userGreeting) userGreeting.innerText = `${timeGreeting}, ${name}.`;

    if (protocolSelect && todayProtocolContainer) {
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
    }

    if (waterCount && waterTargetLabel) {
        const todayWater = userData.biometrics.find(b => b.date === todayStr);
        const currentWater = todayWater?.waterOz || todayWater?.water || 0;
        const waterGoal = userData.settings.goals?.waterOz || 120;
        waterCount.innerHTML = `${currentWater} <span style="font-size: 0.9rem; color: var(--text-muted);">fl oz</span>`;
        waterTargetLabel.innerText = `Goal: ${waterGoal} fl oz`;
    }

    const targets = userData.settings.macroTargets || { calories: 2200, protein: 200, carbs: 150, fats: 88 };
    
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
        const calsLeft = Math.max(0, targets.calories - eatenCals);
        calsRemaining.innerText = Math.round(calsLeft);
    }

    if (calorieRing) {
        const progressPerc = Math.min(100, (eatenCals / targets.calories) * 100);
        let ringColor = 'var(--accent)';
        if (eatenCals > targets.calories) ringColor = 'var(--danger)'; 
        calorieRing.style.background = `conic-gradient(${ringColor} ${progressPerc}%, var(--bg-surface-elevated) 0)`;
    }

    // Body Metrics Snapshot Update
    if (dashWeight && dashBodyFat && dashLBM) {
        const sortedBio = [...(userData.biometrics || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
        const latestWeightEntry = sortedBio.find(b => b.weight);
        const latestCompEntry = sortedBio.find(b => b.bodyFat);

        let weight = latestWeightEntry ? parseFloat(latestWeightEntry.weight) : null;
        let bf = latestCompEntry ? parseFloat(latestCompEntry.bodyFat) : null;

        dashWeight.innerText = weight ? weight.toFixed(1) : '--';
        dashBodyFat.innerText = bf ? bf.toFixed(1) : '--';
        
        if (weight && bf) {
            const fatMass = weight * (bf / 100);
            const lbm = weight - fatMass;
            dashLBM.innerText = lbm.toFixed(1);
        } else {
            dashLBM.innerText = '--';
        }
    }

    // Weekly Consistency Streak Update
    const dayCircles = document.querySelectorAll('.day-circle');
    if (dayCircles.length === 7) {
        const today = new Date();
        const dayMap = [6, 0, 1, 2, 3, 4, 5]; // Sunday=0 maps to index 6, Monday=1 maps to index 0.
        
        dayCircles.forEach(c => c.classList.remove('active'));
        
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const offset = d.getTimezoneOffset() * 60000;
            const dateStr = (new Date(d - offset)).toISOString().split('T')[0];
            
            const hasWorkout = (userData.workouts || []).some(w => w.date === dateStr || (w.timestamp && w.timestamp.startsWith(dateStr)));
            
            if (hasWorkout) {
                const dayIndex = dayMap[d.getDay()];
                if (dayCircles[dayIndex]) {
                    dayCircles[dayIndex].classList.add('active');
                }
            }
        }
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

if (protocolSelect) {
    protocolSelect.addEventListener('change', (e) => {
        renderSelectedProtocol(e.target.value, false);
    });
}

if (btnTimeCrunch) {
    btnTimeCrunch.addEventListener('click', (e) => {
        e.preventDefault();
        if (!protocolSelect) return;
        const currentWorkoutId = protocolSelect.value;
        if (!currentWorkoutId) {
            alert("Please select a protocol from the dropdown first to enable Time-Crunch mode.");
            return;
        }
        renderSelectedProtocol(currentWorkoutId, true);
    });
}

// --- HYDRATION MODULE ---
async function updateWater(amount) {
    if (!userData) return;
    
    const todayStr = getLocalISODate(); 
    let todayBio = userData.biometrics.find(b => b.date === todayStr);
    if (!todayBio) {
        todayBio = { id: `bio_${Date.now()}`, date: todayStr, waterOz: 0 };
        userData.biometrics.push(todayBio);
    }
    
    const currentWater = todayBio.waterOz || todayBio.water || 0;
    todayBio.waterOz = Math.max(0, currentWater + amount);
    todayBio.water = todayBio.waterOz; // Backwards compatibility 
    
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

    let val = 8;
    if (customWaterInput) {
        val = parseInt(customWaterInput.value);
        if (isNaN(val)) val = 8;
    }
    
    await updateWater(isAdd ? val : -val);
    
    setTimeout(() => { isWaterProcessing = false; }, 300);
}

if (btnAddWater) btnAddWater.addEventListener('pointerdown', (e) => handleWaterTap(true, e));
if (btnSubWater) btnSubWater.addEventListener('pointerdown', (e) => handleWaterTap(false, e));
