// nutrition.js - BodyPro Dietary Tracking, Optical Scanner & Offline Cache Logic

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
const qaRecipeSelect = document.getElementById('qaRecipeSelect');

// Macro Calc Elements
const btnRunMacroCalc = document.getElementById('btnRunMacroCalc');

// --- STATE MANAGEMENT ---
let userData = null;
let currentViewDate = new Date(); // Defaults to today
let html5QrCode = null;

// --- OFFLINE FOOD CACHE (IndexedDB) ---
const FoodCache = {
    db: null,
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('BodyProFoodCache', 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('products')) {
                    db.createObjectStore('products', { keyPath: 'barcode' });
                }
            };
            request.onsuccess = (e) => {
                this.db = e.target.result;
                console.log('[BodyPro Cache] Offline Food Database Initialized');
                resolve();
            };
            request.onerror = (e) => {
                console.error('[BodyPro Cache] Initialization Error', e.target.error);
                reject(e.target.error);
            };
        });
    },
    async get(barcode) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('products', 'readonly');
            const store = tx.objectStore('products');
            const request = store.get(barcode);
            request.onsuccess = () => resolve(request.result ? request.result.data : null);
            request.onerror = () => reject(request.error);
        });
    },
    async set(barcode, data) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('products', 'readwrite');
            const store = tx.objectStore('products');
            const request = store.put({ barcode, data, timestamp: Date.now() });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
};

// --- THE SECURITY GUARD ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }
    
    // Initialize our offline cache system
    await FoodCache.init();
    
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
        // Apply the 'completed' class if already checked
        item.className = `supp-item ${isChecked ? 'completed' : ''}`;
        item.innerHTML = `
            <input type="checkbox" id="supp_${index}" ${isChecked ? 'checked' : ''}>
            <label for="supp_${index}">${supp.name}</label>
        `;

        const checkbox = item.querySelector('input');
        checkbox.addEventListener('change', async (e) => {
            const checked = e.target.checked;
            
            // Visual toggle
            if (checked) {
                item.classList.add('completed');
            } else {
                item.classList.remove('completed');
            }

            await toggleSupplement(supp.name, checked);
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
    
    // Check if over target
    if (dailyCals > targetCals) {
        calProgressBar.classList.add('overage');
    } else {
        calProgressBar.classList.remove('overage');
    }
}

// --- OPTICAL SCANNER & CACHED API INTEGRATION ---
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
    if (html5QrCode && html5QrCode.isScanning) {
        await html5QrCode.stop();
    }
    document.getElementById('scannerModal').classList.remove('active');
    
    window.openQuickAddModal('Snacks');
    
    // Check Local Cache First
    const cachedProduct = await FoodCache.get(decodedText);
    
    if (cachedProduct) {
        console.log('[BodyPro Cache] Local Hit for barcode:', decodedText);
        document.getElementById('qaName').value = cachedProduct.name;
        document.getElementById('qaCals').value = cachedProduct.cals;
        document.getElementById('qaProt').value = cachedProduct.prot;
        document.getElementById('qaCarb').value = cachedProduct.carb;
        document.getElementById('qaFat').value = cachedProduct.fat;
        return; // Exit early since we used cache
    }

    // Cache Miss: Query External Database
    document.getElementById('qaName').value = "Querying Database...";
    
    try {
        console.log('[BodyPro Cache] Local Miss. Fetching OpenFoodFacts:', decodedText);
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${decodedText}.json`);
        const data = await response.json();
        
        if (data.status === 1 && data.product) {
            const p = data.product;
            const nut = p.nutriments || {};
            
            const cals = Math.round(nut['energy-kcal_serving'] || nut['energy-kcal_100g'] || nut['energy-kcal'] || 0);
            const prot = Math.round(nut['proteins_serving'] || nut['proteins_100g'] || nut['proteins'] || 0);
            const carb = Math.round(nut['carbohydrates_serving'] || nut['carbohydrates_100g'] || nut['carbohydrates'] || 0);
            const fat = Math.round(nut['fat_serving'] || nut['fat_100g'] || nut['fat'] || 0);
            const name = p.product_name || "Unknown Product";
            
            // Update UI
            document.getElementById('qaName').value = name;
            document.getElementById('qaCals').value = cals;
            document.getElementById('qaProt').value = prot;
            document.getElementById('qaCarb').value = carb;
            document.getElementById('qaFat').value = fat;
            
            // Save to Local Cache for next time
            await FoodCache.set(decodedText, { name, cals, prot, carb, fat });
            console.log('[BodyPro Cache] Product cached successfully.');
            
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

// --- RECIPE LOADING (QUICK ADD) ---
qaRecipeSelect.addEventListener('change', (e) => {
    const recipeId = e.target.value;
    if (!recipeId) return;

    const recipe = (userData.custom_recipes || []).find(r => r.id === recipeId);
    if (recipe) {
        document.getElementById('qaName').value = recipe.name;
        document.getElementById('qaCals').value = recipe.macrosPerServing.calories;
        document.getElementById('qaProt').value = recipe.macrosPerServing.protein;
        document.getElementById('qaCarb').value = recipe.macrosPerServing.carbs;
        document.getElementById('qaFat').value = recipe.macrosPerServing.fats;
    }
});

function populateRecipeDropdown() {
    qaRecipeSelect.innerHTML = '<option value="">-- Select from Vault --</option>';
    const recipes = userData.custom_recipes || [];
    
    recipes.forEach(recipe => {
        const opt = document.createElement('option');
        opt.value = recipe.id;
        opt.innerText = recipe.name;
        qaRecipeSelect.appendChild(opt);
    });
}

// --- CRUD OPERATIONS ---
window.openQuickAddModal = function(meal = 'Snacks') {
    // Override default meal if user set a preference
    const defaultMeal = userData?.settings?.preferences?.defaultMeal || meal;
    document.getElementById('qaMeal').value = defaultMeal;
    
    populateRecipeDropdown();
    document.getElementById('quickAddModal').classList.add('active');
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
    qaRecipeSelect.value = '';
    
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

// --- MACRO CALCULATOR (MIFFLIN-ST JEOR) ---
btnRunMacroCalc.addEventListener('click', () => {
    const sex = document.getElementById('calcSex').value;
    const age = parseInt(document.getElementById('calcAge').value);
    const weightLbs = parseFloat(document.getElementById('calcWeight').value);
    const heightInches = parseFloat(document.getElementById('calcHeight').value);
    const activity = parseFloat(document.getElementById('calcActivity').value);
    const goal = parseInt(document.getElementById('calcGoal').value);
    
    if(!age || !weightLbs || !heightInches) {
        alert("Please provide Age, Weight, and Height for an accurate calculation.");
        return;
    }
    
    // Conversions
    const weightKg = weightLbs / 2.20462;
    const heightCm = heightInches * 2.54;
    
    // Mifflin-St Jeor Equation
    let bmr;
    if(sex === 'male') {
        bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
    } else {
        bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
    }
    
    const tdee = bmr * activity;
    const targetCals = Math.round(tdee + goal);
    
    // Precision Macro Split Logic (Fitness/Bodybuilding standard)
    // Protein: ~1g per lb of bodyweight to preserve/build muscle
    // Fat: ~25% of total caloric intake
    // Carbs: Remainder of caloric budget
    
    let targetProt = Math.round(weightLbs);
    let targetFat = Math.round((targetCals * 0.25) / 9);
    let targetCarb = Math.round((targetCals - (targetProt * 4) - (targetFat * 9)) / 4);
    
    // Safety check for extreme deficit states where carbs might hit zero or negative
    if(targetCarb < 0) {
        targetCarb = 0;
        // Re-balance protein slightly if necessary, though extreme deficits are warned against
        targetProt = Math.round((targetCals - (targetFat * 9)) / 4); 
    }
    
    document.getElementById('calcResultCals').innerText = `${targetCals} kcal`;
    document.getElementById('calcResultProt').innerText = targetProt;
    document.getElementById('calcResultCarb').innerText = targetCarb;
    document.getElementById('calcResultFat').innerText = targetFat;
});

// --- NAVIGATION LISTENERS ---
btnPrevDay.addEventListener('click', () => {
    currentViewDate.setDate(currentViewDate.getDate() - 1);
    renderView();
});

btnNextDay.addEventListener('click', () => {
    currentViewDate.setDate(currentViewDate.getDate() + 1);
    renderView();
});
