// nutrition.js - BodyPro Dietary Tracking Logic

import { auth } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- DOM Elements ---
const currentLogDateEl = document.getElementById('currentLogDate');
const btnPrevDay = document.getElementById('btnPrevDay');
const btnNextDay = document.getElementById('btnNextDay');
const supplementContainer = document.getElementById('supplementContainer');

// Macro Summary Elements
const sumCalsEl = document.getElementById('sumCals');
const tarCalsEl = document.getElementById('tarCals');
const sumProtEl = document.getElementById('sumProt');
const sumCarbEl = document.getElementById('sumCarb');
const sumFatEl = document.getElementById('sumFat');
const calProgressBar = document.getElementById('calProgressBar');

// Quick Add Elements
const btnSaveQuickAdd = document.getElementById('btnSaveQuickAdd');

// --- STATE MANAGEMENT ---
let userData = null;
let currentViewDate = new Date(); // Defaults to today

// --- THE SECURITY GUARD ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }
    await loadDatabase();
    renderView();
});

// --- HELPER: Formatting Dates ---
function getLocalISODate(dateObj) {
    const offset = dateObj.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(dateObj - offset)).toISOString().split('T')[0];
    return localISOTime;
}

function updateDateDisplay() {
    const today = getLocalISODate(new Date());
    const viewDateStr = getLocalISODate(currentViewDate);
    
    if (viewDateStr === today) {
        currentLogDateEl.innerText = "Today";
    } else {
        const options = { weekday: 'short', month: 'short', day: 'numeric' };
        currentLogDateEl.innerText = currentViewDate.toLocaleDateString('en-US', options);
    }
}

// --- CORE DATA OPERATIONS ---
async function loadDatabase() {
    userData = await window.BodyProDataStore.getData();
}

function renderView() {
    updateDateDisplay();
    renderSupplements();
    renderDiary();
}

// --- SUPPLEMENT PROTOCOLS ---
function renderSupplements() {
    const viewDateStr = getLocalISODate(currentViewDate);
    
    // Find biometric entry for the current day to store supplement states
    let dayBio = (userData.biometrics || []).find(b => b.date === viewDateStr);
    let completedSupps = dayBio && dayBio.supplements ? dayBio.supplements : [];

    // Pull the master template from settings
    const suppTemplate = userData.settings.dailySupplements || [];

    supplementContainer.innerHTML = '';

    if (suppTemplate.length === 0) {
        supplementContainer.innerHTML = '<p class="text-muted" style="text-align:center; font-size:0.9rem;">No daily supplements configured.</p>';
        return;
    }

    suppTemplate.forEach((supp, index) => {
        const isChecked = completedSupps.includes(supp.name);
        
        const item = document.createElement('div');
        item.className = 'supp-item';
        item.innerHTML = `
            <input type="checkbox" id="supp_${index}" ${isChecked ? 'checked' : ''}>
            <label for="supp_${index}">${supp.name}</label>
        `;

        const checkbox = item.querySelector('input');
        checkbox.addEventListener('change', async (e) => {
            await toggleSupplement(supp.name, e.target.checked);
        });

        supplementContainer.appendChild(item);
    });
}

async function toggleSupplement(suppName, isCompleted) {
    const viewDateStr = getLocalISODate(currentViewDate);
    let bioIndex = userData.biometrics.findIndex(b => b.date === viewDateStr);
    
    if (bioIndex === -1) {
        // Create new daily biometric record if it doesn't exist
        userData.biometrics.push({
            id: 'bio_' + Date.now(),
            date: viewDateStr,
            water: 0,
            supplements: []
        });
        bioIndex = userData.biometrics.length - 1;
    }

    let currentSupps = userData.biometrics[bioIndex].supplements || [];
    
    if (isCompleted) {
        if (!currentSupps.includes(suppName)) currentSupps.push(suppName);
    } else {
        currentSupps = currentSupps.filter(name => name !== suppName);
    }
    
    userData.biometrics[bioIndex].supplements = currentSupps;
    await window.BodyProDataStore.saveData(userData);
}

// --- DIARY & MACRO RENDERING ---
function renderDiary() {
    const viewDateStr = getLocalISODate(currentViewDate);
    const daysFoods = (userData.food_diary || []).filter(f => f.date === viewDateStr);
    
    const meals = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
    let dailyCals = 0, dailyProt = 0, dailyCarb = 0, dailyFat = 0;

    meals.forEach(meal => {
        const mealContainer = document.getElementById(`list-${meal}`);
        const mealSection = document.querySelector(`.meal-section[data-meal="${meal}"]`);
        const mealCalsEl = mealSection.querySelector('.meal-cals');
        
        mealContainer.innerHTML = '';
        let mealCals = 0;

        const mealFoods = daysFoods.filter(f => f.meal === meal);
        
        if (mealFoods.length === 0) {
            mealContainer.innerHTML = '<div style="padding: 15px 20px; color: var(--text-muted); font-size: 0.9rem; font-style: italic;">No items logged yet.</div>';
        } else {
            mealFoods.forEach(food => {
                mealCals += Number(food.calories || 0);
                dailyCals += Number(food.calories || 0);
                dailyProt += Number(food.protein || 0);
                dailyCarb += Number(food.carbs || 0);
                dailyFat += Number(food.fats || 0);

                const item = document.createElement('div');
                item.className = 'food-item';
                item.innerHTML = `
                    <div class="food-details">
                        <h4>${food.name}</h4>
                        <div class="food-macros">
                            <span>${food.calories} kcal</span>
                            <span class="m-prot">${food.protein}g P</span>
                            <span class="m-carb">${food.carbs}g C</span>
                            <span class="m-fat">${food.fats}g F</span>
                        </div>
                    </div>
                    <button class="btn btn-ghost" style="padding: 5px 10px; border-color: transparent; color: var(--danger);" onclick="deleteFoodEntry('${food.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                `;
                mealContainer.appendChild(item);
            });
        }
        
        mealCalsEl.innerText = `${Math.round(mealCals)} kcal`;
    });

    // Update Top Summary Panel
    const targetCals = userData.settings.macroTargets.calories;
    sumCalsEl.innerText = Math.round(dailyCals);
    tarCalsEl.innerText = targetCals;
    sumProtEl.innerText = Math.round(dailyProt);
    sumCarbEl.innerText = Math.round(dailyCarb);
    sumFatEl.innerText = Math.round(dailyFat);

    // Progress Bar
    const pct = Math.min((dailyCals / targetCals) * 100, 100);
    calProgressBar.style.width = `${pct}%`;
    if (dailyCals > targetCals) {
        calProgressBar.style.background = 'var(--danger)';
    } else {
        calProgressBar.style.background = 'var(--primary)';
    }
}

// --- CRUD OPERATIONS ---
btnSaveQuickAdd.addEventListener('click', async () => {
    const meal = document.getElementById('qaMeal').value;
    const name = document.getElementById('qaName').value || "Quick Add Entry";
    const cals = Number(document.getElementById('qaCals').value) || 0;
    const prot = Number(document.getElementById('qaProt').value) || 0;
    const carb = Number(document.getElementById('qaCarb').value) || 0;
    const fat = Number(document.getElementById('qaFat').value) || 0;

    btnSaveQuickAdd.disabled = true;
    btnSaveQuickAdd.innerText = "Saving...";

    const newEntry = {
        id: 'food_' + Date.now(),
        date: getLocalISODate(currentViewDate),
        meal: meal,
        name: name,
        calories: cals,
        protein: prot,
        carbs: carb,
        fats: fat,
        timestamp: new Date().toISOString()
    };

    userData.food_diary.push(newEntry);
    
    await window.BodyProDataStore.saveData(userData);
    
    // Reset Modal
    document.getElementById('qaName').value = '';
    document.getElementById('qaCals').value = 0;
    document.getElementById('qaProt').value = 0;
    document.getElementById('qaCarb').value = 0;
    document.getElementById('qaFat').value = 0;
    
    // Close Modal and Re-render
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    renderView();
    
    btnSaveQuickAdd.disabled = false;
    btnSaveQuickAdd.innerText = "Save Entry";
});

// Make deletion globally accessible for inline onclick handlers
window.deleteFoodEntry = async function(id) {
    if(confirm("Delete this food entry?")) {
        userData.food_diary = userData.food_diary.filter(f => f.id !== id);
        renderView(); // Optimistic UI update
        await window.BodyProDataStore.saveData(userData);
    }
};

// --- NAVIGATION LISTENERS ---
btnPrevDay.addEventListener('click', () => {
    currentViewDate.setDate(currentViewDate.getDate() - 1);
    renderView();
});

btnNextDay.addEventListener('click', () => {
    currentViewDate.setDate(currentViewDate.getDate() + 1);
    renderView();
});
