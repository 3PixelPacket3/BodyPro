// nutrition.js - BodyPro Dietary Tracking & Optical Scanner Logic

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
let html5QrCode = null;

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
    return (new Date(dateObj - offset)).toISOString().split('T')[0];
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
    
    let dayBio = (userData.biometrics || []).find(b => b.date === viewDateStr);
    let completedSupps = dayBio && dayBio.supplements ? dayBio.supplements : [];

    const suppTemplate = userData.settings.dailySupplements || [];

    supplementContainer.innerHTML = '';

    if (suppTemplate.length === 0) {
        supplementContainer.innerHTML = '<p class="text-muted" style="text-align:center; font-size:0.9rem;">No daily supplements configured in System Calibration.</p>';
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

    const targetCals = userData.settings.macroTargets.calories;
    sumCalsEl.innerText = Math.round(dailyCals);
    tarCalsEl.innerText = targetCals;
    sumProtEl.innerText = Math.round(dailyProt);
    sumCarbEl.innerText = Math.round(dailyCarb);
    sumFatEl.innerText = Math.round(dailyFat);

    const pct = Math.min((dailyCals / targetCals) * 100, 100);
    calProgressBar.style.width = `${pct}%`;
    calProgressBar.style.background = dailyCals > targetCals ? 'var(--danger)' : 'var(--primary)';
}

// --- OPTICAL SCANNER & OPENFOODFACTS INTEGRATION ---
window.openScannerModal = function() {
    document.getElementById('scannerModal').classList.add('active');
    
    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }
    
    const config = { fps: 10, qrbox: { width: 250, height: 200 } };
    
    html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
    .catch(err => {
        console.error("Camera access error:", err);
        document.getElementById('reader').innerHTML = '<p style="color:var(--danger); padding:20px; text-align:center;">Optical hardware unavailable. Please verify permissions or utilize manual entry.</p>';
    });
};

window.closeScannerModal = function() {
    document.getElementById('scannerModal').classList.remove('active');
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
    }
};

async function onScanSuccess(decodedText, decodedResult) {
    // 1. Halt optical array to prevent duplicate API hits
    if (html5QrCode && html5QrCode.isScanning) {
        await html5QrCode.stop();
    }
    document.getElementById('scannerModal').classList.remove('active');
    
    // 2. Open manual entry interface and show loading state
    openQuickAddModal('Snacks');
    document.getElementById('qaName').value = "Querying Database...";
    
    // 3. Execute OpenFoodFacts API Request
    try {
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${decodedText}.json`);
        const data = await response.json();
        
        if (data.status === 1 && data.product) {
            const p = data.product;
            const nut = p.nutriments || {};
            
            // Prioritize serving metrics, fallback to 100g base if unavailable
            const cals = nut['energy-kcal_serving'] || nut['energy-kcal_100g'] || nut['energy-kcal'] || 0;
            const prot = nut['proteins_serving'] || nut['proteins_100g'] || nut['proteins'] || 0;
            const carb = nut['carbohydrates_serving'] || nut['carbohydrates_100g'] || nut['carbohydrates'] || 0;
            const fat = nut['fat_serving'] || nut['fat_100g'] || nut['fat'] || 0;
            
            document.getElementById('qaName').value = p.product_name || "Unknown Product";
            document.getElementById('qaCals').value = Math.round(cals);
            document.getElementById('qaProt').value = Math.round(prot);
            document.getElementById('qaCarb').value = Math.round(carb);
            document.getElementById('qaFat').value = Math.round(fat);
        } else {
            alert("Telemetry negative. Product not found in OpenFoodFacts database. Manual entry required.");
            document.getElementById('qaName').value = "";
        }
    } catch (err) {
        console.error("API Error:", err);
        alert("Network failure. Unable to retrieve nutritional telemetry.");
        document.getElementById('qaName').value = "";
    }
}

// --- CRUD OPERATIONS ---
window.openQuickAddModal = function(meal = 'Snacks') {
    document.getElementById('qaMeal').value = meal;
    document.getElementById('quickAddModal').classList.add('active');
};

window.closeModals = function() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    window.closeScannerModal();
};

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
    
    // Reset Modal Fields
    document.getElementById('qaName').value = '';
    document.getElementById('qaCals').value = 0;
    document.getElementById('qaProt').value = 0;
    document.getElementById('qaCarb').value = 0;
    document.getElementById('qaFat').value = 0;
    
    window.closeModals();
    renderView();
    
    btnSaveQuickAdd.disabled = false;
    btnSaveQuickAdd.innerText = "Save Entry";
});

window.deleteFoodEntry = async function(id) {
    if(confirm("Delete this food entry?")) {
        userData.food_diary = userData.food_diary.filter(f => f.id !== id);
        renderView(); 
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
