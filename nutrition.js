import { auth } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- PROGRESSIVE WEB APP REGISTRATION ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
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
const qaFavoriteBtn = document.getElementById('qaFavoriteBtn'); 
const qaSugar = document.getElementById('qaSugar');
const qaSodium = document.getElementById('qaSodium');
const qaIron = document.getElementById('qaIron');
const qaPotassium = document.getElementById('qaPotassium');
const qaFiber = document.getElementById('qaFiber');
const qaVitA = document.getElementById('qaVitA');
const qaVitC = document.getElementById('qaVitC');
const qaCalcium = document.getElementById('qaCalcium');
const qaSatFat = document.getElementById('qaSatFat');

// Macro Calc Elements
const btnRunMacroCalc = document.getElementById('btnRunMacroCalc');

// Interactive Nutrition Label Elements
const nutritionLabelModal = document.getElementById('nutritionLabelModal');
const labelProductName = document.getElementById('labelProductName');
const labelServingMultiplier = document.getElementById('labelServingMultiplier');
const labelCalories = document.getElementById('labelCalories');
const labelFat = document.getElementById('labelFat');
const labelCarb = document.getElementById('labelCarb');
const labelProtein = document.getElementById('labelProtein');
const labelSatFat = document.getElementById('labelSatFat');
const labelSodium = document.getElementById('labelSodium');
const labelFiber = document.getElementById('labelFiber');
const labelSugar = document.getElementById('labelSugar');
const labelVitA = document.getElementById('labelVitA');
const labelVitC = document.getElementById('labelVitC');
const labelCalcium = document.getElementById('labelCalcium');
const labelIron = document.getElementById('labelIron');
const labelPotassium = document.getElementById('labelPotassium');
const btnLogScannedFood = document.getElementById('btnLogScannedFood');
const labelMealSelect = document.getElementById('labelMealSelect');
const nlFavoriteBtn = document.getElementById('nlFavoriteBtn'); 

// API Search & Favorites Elements 
const apiSearchInput = document.getElementById('apiSearchInput');
const btnApiSearch = document.getElementById('btnApiSearch');
const apiSearchResults = document.getElementById('apiSearchResults');
const favoritesList = document.getElementById('favoritesList');

// --- STATE MANAGEMENT ---
let userData = null;
let currentViewDate = new Date(); 
let html5QrCode = null;
let currentScannedFood = null; 

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
    if (!userData.favorite_foods) userData.favorite_foods = [];
}

function renderView() {
    updateDateDisplay();
    renderSupplements();
    renderDiary();
    renderFavorites();
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
        item.className = `supp-item ${isChecked ? 'completed' : ''}`;
        item.innerHTML = `
            <input type="checkbox" id="supp_${index}" ${isChecked ? 'checked' : ''}>
            <label for="supp_${index}">${supp.name}</label>
        `;

        const checkbox = item.querySelector('input');
        checkbox.addEventListener('change', async (e) => {
            const checked = e.target.checked;
            if (checked) item.classList.add('completed');
            else item.classList.remove('completed');
            await toggleSupplement(supp.name, checked);
        });

        supplementContainer.appendChild(item);
    });
}

async function toggleSupplement(suppName, isCompleted) {
    const viewDateStr = getLocalISODate(currentViewDate);
    let bioIndex = userData.biometrics.findIndex(b => b.date === viewDateStr);
    
    if (bioIndex === -1) {
        userData.biometrics.push({ id: 'bio_' + Date.now(), date: viewDateStr, water: 0, supplements: [] });
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
    if (dailyCals > targetCals) calProgressBar.classList.add('overage');
    else calProgressBar.classList.remove('overage');
}

// --- API FETCH ENGINE WITH RETRY LOGIC ---
async function fetchWithRetry(url, retries = 3, delayMs = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (err) {
            console.warn(`[BodyPro Network] API attempt ${i + 1} failed. Re-engaging...`, err);
            if (i === retries - 1) throw err; // If last attempt, fail out
            await new Promise(resolve => setTimeout(resolve, delayMs)); // Wait before retry
        }
    }
}

// --- OPTICAL SCANNER ---
window.openScannerModal = function() {
    document.getElementById('scannerModal').classList.add('active');
    if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");
    
    const config = { fps: 10, qrbox: { width: 250, height: 200 } };
    html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
    .catch(err => {
        document.getElementById('reader').innerHTML = '<p style="color:var(--danger); padding:20px; text-align:center;">Optical hardware unavailable. Please verify permissions or utilize manual entry.</p>';
    });
};

window.closeScannerModal = function() {
    document.getElementById('scannerModal').classList.remove('active');
    if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().catch(console.error);
};

async function onScanSuccess(decodedText, decodedResult) {
    if (html5QrCode && html5QrCode.isScanning) await html5QrCode.stop();
    document.getElementById('scannerModal').classList.remove('active');
    
    labelProductName.innerText = "Querying Database...";
    labelServingMultiplier.value = 1; 
    nutritionLabelModal.classList.add('active');
    
    const defaultMeal = userData?.settings?.preferences?.defaultMeal || 'Snacks';
    labelMealSelect.value = defaultMeal;
    
    const cachedProduct = await FoodCache.get(decodedText);
    
    if (cachedProduct) {
        currentScannedFood = cachedProduct;
        updateNutritionLabelDisplay();
        checkIfFavorite(currentScannedFood.name, nlFavoriteBtn);
        return; 
    }

    try {
        // Implemented aggressive retry logic (3 attempts, 1s delay)
        const data = await fetchWithRetry(`https://world.openfoodfacts.org/api/v0/product/${decodedText}.json`, 3, 1000);
        
        if (data && data.status === 1 && data.product) {
            currentScannedFood = parseOpenFoodFactsProduct(data.product);
            updateNutritionLabelDisplay();
            checkIfFavorite(currentScannedFood.name, nlFavoriteBtn);
            await FoodCache.set(decodedText, currentScannedFood);
        } else {
            alert("Telemetry negative. Product not found in OpenFoodFacts database.");
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
            window.openQuickAddModal('Snacks');
        }
    } catch (err) {
        alert("Network failure. Unable to retrieve nutritional telemetry after multiple attempts.");
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        window.openQuickAddModal('Snacks');
    }
}

// --- OPENFOODFACTS TEXT API SEARCH ---
btnApiSearch.addEventListener('click', async () => {
    const query = apiSearchInput.value.trim();
    if (!query) return;

    apiSearchResults.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Querying global registry...</div>';
    
    try {
        // Implemented aggressive retry logic (3 attempts, 1s delay)
        const data = await fetchWithRetry(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=15`, 3, 1000);

        apiSearchResults.innerHTML = '';

        if (!data || !data.products || data.products.length === 0) {
            apiSearchResults.innerHTML = '<p class="text-muted" style="text-align:center; padding: 20px;">No matching items found.</p>';
            return;
        }

        data.products.forEach(p => {
            const parsed = parseOpenFoodFactsProduct(p);
            if(parsed.name === "Unknown Product") return; // Skip junk data
            
            const div = document.createElement('div');
            div.className = 'db-item';
            div.innerHTML = `
                <div>
                    <h4 style="margin: 0; font-size: 1rem;">${parsed.name}</h4>
                    <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted);">${parsed.cals} kcal | ${parsed.prot}P / ${parsed.carb}C / ${parsed.fat}F</p>
                </div>
                <div class="db-item-actions">
                    <button class="btn btn-ghost" style="color: var(--accent); border: 1px solid var(--accent); font-size: 0.8rem; padding: 4px 10px; border-radius: 4px;">Log</button>
                </div>
            `;
            
            div.querySelector('button').addEventListener('click', () => {
                currentScannedFood = parsed;
                labelServingMultiplier.value = 1;
                updateNutritionLabelDisplay();
                checkIfFavorite(parsed.name, nlFavoriteBtn);
                nutritionLabelModal.classList.add('active');
            });
            
            apiSearchResults.appendChild(div);
        });

    } catch (err) {
        console.error(err);
        apiSearchResults.innerHTML = '<p class="text-danger" style="text-align:center; padding: 20px;">Connection failed after multiple attempts. API may be temporarily down.</p>';
    }
});

function parseOpenFoodFactsProduct(p) {
    const nut = p.nutriments || {};
    return {
        name: p.product_name || p.generic_name || "Unknown Product",
        cals: Math.round(nut['energy-kcal_serving'] || nut['energy-kcal_100g'] || 0),
        prot: Math.round(nut['proteins_serving'] || nut['proteins_100g'] || 0),
        carb: Math.round(nut['carbohydrates_serving'] || nut['carbohydrates_100g'] || 0),
        fat: Math.round(nut['fat_serving'] || nut['fat_100g'] || 0),
        sugar: Math.round(nut['sugars_serving'] || nut['sugars_100g'] || 0),
        fiber: Math.round(nut['fiber_serving'] || nut['fiber_100g'] || 0),
        satFat: Math.round(nut['saturated-fat_serving'] || nut['saturated-fat_100g'] || 0),
        sodium: Math.round((nut['sodium_serving'] || nut['sodium_100g'] || 0) * 1000),
        iron: Math.round((nut['iron_serving'] || nut['iron_100g'] || 0) * 1000),
        potassium: Math.round((nut['potassium_serving'] || nut['potassium_100g'] || 0) * 1000),
        vitC: Math.round((nut['vitamin-c_serving'] || nut['vitamin-c_100g'] || 0) * 1000),
        calcium: Math.round((nut['calcium_serving'] || nut['calcium_100g'] || 0) * 1000),
        vitA: Math.round((nut['vitamin-a_serving'] || nut['vitamin-a_100g'] || 0) * 1000000)
    };
}

// --- INTERACTIVE NUTRITION LABEL LOGIC ---
function updateNutritionLabelDisplay() {
    if (!currentScannedFood) return;
    const multiplier = parseFloat(labelServingMultiplier.value) || 0;
    
    labelProductName.innerText = currentScannedFood.name;
    labelCalories.innerText = Math.round(currentScannedFood.cals * multiplier);
    labelFat.innerText = Math.round(currentScannedFood.fat * multiplier);
    labelCarb.innerText = Math.round(currentScannedFood.carb * multiplier);
    labelProtein.innerText = Math.round(currentScannedFood.prot * multiplier);
    
    labelSatFat.innerText = Math.round((currentScannedFood.satFat || 0) * multiplier);
    labelSodium.innerText = Math.round((currentScannedFood.sodium || 0) * multiplier);
    labelFiber.innerText = Math.round((currentScannedFood.fiber || 0) * multiplier);
    labelSugar.innerText = Math.round((currentScannedFood.sugar || 0) * multiplier);
    labelVitA.innerText = Math.round((currentScannedFood.vitA || 0) * multiplier);
    labelVitC.innerText = Math.round((currentScannedFood.vitC || 0) * multiplier);
    labelCalcium.innerText = Math.round((currentScannedFood.calcium || 0) * multiplier);
    labelIron.innerText = Math.round((currentScannedFood.iron || 0) * multiplier);
    labelPotassium.innerText = Math.round((currentScannedFood.potassium || 0) * multiplier);
}

labelServingMultiplier.addEventListener('input', updateNutritionLabelDisplay);

btnLogScannedFood.addEventListener('click', async () => {
    if (!currentScannedFood) return;
    btnLogScannedFood.disabled = true;
    btnLogScannedFood.innerText = "Saving...";

    const multiplier = parseFloat(labelServingMultiplier.value) || 0;
    const meal = labelMealSelect.value;
    
    const newEntry = {
        id: 'food_' + Date.now(),
        date: getLocalISODate(currentViewDate),
        meal: meal,
        name: `${currentScannedFood.name} (${multiplier}x)`,
        calories: Math.round(currentScannedFood.cals * multiplier),
        protein: Math.round(currentScannedFood.prot * multiplier),
        carbs: Math.round(currentScannedFood.carb * multiplier),
        fats: Math.round(currentScannedFood.fat * multiplier),
        sugar: Math.round((currentScannedFood.sugar || 0) * multiplier),
        sodium: Math.round((currentScannedFood.sodium || 0) * multiplier),
        iron: Math.round((currentScannedFood.iron || 0) * multiplier),
        potassium: Math.round((currentScannedFood.potassium || 0) * multiplier),
        fiber: Math.round((currentScannedFood.fiber || 0) * multiplier),
        vitA: Math.round((currentScannedFood.vitA || 0) * multiplier),
        vitC: Math.round((currentScannedFood.vitC || 0) * multiplier),
        calcium: Math.round((currentScannedFood.calcium || 0) * multiplier),
        satFat: Math.round((currentScannedFood.satFat || 0) * multiplier),
        timestamp: new Date().toISOString()
    };

    userData.food_diary.push(newEntry);
    await window.BodyProDataStore.saveData(userData);
    
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    currentScannedFood = null;
    
    renderView();
    btnLogScannedFood.disabled = false;
    btnLogScannedFood.innerText = "Save to Diary";
});


// --- FAVORITES SYSTEM ---
function checkIfFavorite(foodName, btnElement) {
    const isFav = userData.favorite_foods.some(f => f.name.toLowerCase() === foodName.toLowerCase());
    if (isFav) {
        btnElement.classList.add('active');
        btnElement.innerHTML = '<i class="fa-solid fa-heart"></i>';
    } else {
        btnElement.classList.remove('active');
        btnElement.innerHTML = '<i class="fa-regular fa-heart"></i>';
    }
}

async function toggleFavoriteStatus(foodObj, btnElement) {
    const index = userData.favorite_foods.findIndex(f => f.name.toLowerCase() === foodObj.name.toLowerCase());
    if (index > -1) {
        // Remove
        userData.favorite_foods.splice(index, 1);
        btnElement.classList.remove('active');
        btnElement.innerHTML = '<i class="fa-regular fa-heart"></i>';
    } else {
        // Add
        userData.favorite_foods.push({
            id: 'fav_' + Date.now(),
            name: foodObj.name,
            cals: foodObj.cals,
            prot: foodObj.prot,
            carb: foodObj.carb,
            fat: foodObj.fat,
            sugar: foodObj.sugar || 0,
            sodium: foodObj.sodium || 0,
            iron: foodObj.iron || 0,
            potassium: foodObj.potassium || 0,
            fiber: foodObj.fiber || 0,
            vitA: foodObj.vitA || 0,
            vitC: foodObj.vitC || 0,
            calcium: foodObj.calcium || 0,
            satFat: foodObj.satFat || 0
        });
        btnElement.classList.add('active');
        btnElement.innerHTML = '<i class="fa-solid fa-heart"></i>';
    }
    renderFavorites();
    await window.BodyProDataStore.saveData(userData);
}

// Hook up Label Modal Heart
nlFavoriteBtn.addEventListener('click', () => {
    if (currentScannedFood) toggleFavoriteStatus(currentScannedFood, nlFavoriteBtn);
});

// Hook up Quick Add Modal Heart
qaFavoriteBtn.addEventListener('click', () => {
    const name = document.getElementById('qaName').value || "Custom Entry";
    const cals = Number(document.getElementById('qaCals').value) || 0;
    const prot = Number(document.getElementById('qaProt').value) || 0;
    const carb = Number(document.getElementById('qaCarb').value) || 0;
    const fat = Number(document.getElementById('qaFat').value) || 0;
    const sugar = Number(qaSugar.value) || 0;
    const sodium = Number(qaSodium.value) || 0;
    const iron = Number(qaIron.value) || 0;
    const potassium = Number(qaPotassium.value) || 0;
    const fiber = Number(qaFiber.value) || 0;
    const vitA = Number(qaVitA.value) || 0;
    const vitC = Number(qaVitC.value) || 0;
    const calcium = Number(qaCalcium.value) || 0;
    const satFat = Number(qaSatFat.value) || 0;
    
    if(!name || name === "Custom Entry") return alert("Please provide a name to save as a favorite.");
    toggleFavoriteStatus({ name, cals, prot, carb, fat, sugar, sodium, iron, potassium, fiber, vitA, vitC, calcium, satFat }, qaFavoriteBtn);
});

function renderFavorites() {
    favoritesList.innerHTML = '';
    const favs = userData.favorite_foods || [];
    
    if(favs.length === 0) {
        favoritesList.innerHTML = '<p class="text-muted" style="text-align:center; padding: 20px;">No favorites saved. Click the heart icon on any food to save it here.</p>';
        return;
    }

    favs.forEach(fav => {
        const div = document.createElement('div');
        div.className = 'fav-item';
        div.innerHTML = `
            <div>
                <h4 style="margin: 0; font-size: 1rem;">${fav.name}</h4>
                <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted);">${fav.cals} kcal | ${fav.prot}P / ${fav.carb}C / ${fav.fat}F</p>
            </div>
            <div class="fav-item-actions" style="display: flex; gap: 10px; align-items: center;">
                <button class="btn btn-ghost" style="color: var(--accent); border: 1px solid var(--accent); font-size: 0.8rem; padding: 4px 10px; border-radius: 4px;" title="Quick Log">Log</button>
                <button title="Remove Favorite" style="color: var(--danger);"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        
        // Log Button
        div.querySelector('.btn-ghost').addEventListener('click', () => {
            currentScannedFood = fav;
            labelServingMultiplier.value = 1;
            updateNutritionLabelDisplay();
            checkIfFavorite(fav.name, nlFavoriteBtn);
            nutritionLabelModal.classList.add('active');
        });
        
        // Delete Button
        div.querySelector('.fa-trash').parentElement.addEventListener('click', async () => {
            userData.favorite_foods = userData.favorite_foods.filter(f => f.id !== fav.id);
            renderFavorites();
            await window.BodyProDataStore.saveData(userData);
        });
        
        favoritesList.appendChild(div);
    });
}

// --- RECIPE LOADING (QUICK ADD) ---
qaRecipeSelect.addEventListener('change', (e) => {
    const recipeId = e.target.value;
    if (!recipeId) return;

    const recipe = (userData.custom_recipes || []).find(r => r.id === recipeId);
    if (recipe) {
        document.getElementById('qaName').value = recipe.name;
        document.getElementById('qaCals').value = recipe.macrosPerServing.calories || 0;
        document.getElementById('qaProt').value = recipe.macrosPerServing.protein || 0;
        document.getElementById('qaCarb').value = recipe.macrosPerServing.carbs || 0;
        document.getElementById('qaFat').value = recipe.macrosPerServing.fats || 0;
        
        qaSugar.value = recipe.macrosPerServing.sugar || 0;
        qaSodium.value = recipe.macrosPerServing.sodium || 0;
        qaIron.value = recipe.macrosPerServing.iron || 0;
        qaPotassium.value = recipe.macrosPerServing.potassium || 0;
        qaFiber.value = recipe.macrosPerServing.fiber || 0;
        qaVitA.value = recipe.macrosPerServing.vitA || 0;
        qaVitC.value = recipe.macrosPerServing.vitC || 0;
        qaCalcium.value = recipe.macrosPerServing.calcium || 0;
        qaSatFat.value = recipe.macrosPerServing.satFat || 0;

        checkIfFavorite(recipe.name, qaFavoriteBtn);
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
    const defaultMeal = userData?.settings?.preferences?.defaultMeal || meal;
    document.getElementById('qaMeal').value = defaultMeal;
    populateRecipeDropdown();
    
    // Reset inputs
    document.getElementById('qaName').value = '';
    document.getElementById('qaCals').value = 0;
    document.getElementById('qaProt').value = 0;
    document.getElementById('qaCarb').value = 0;
    document.getElementById('qaFat').value = 0;
    qaSugar.value = 0;
    qaSodium.value = 0;
    qaIron.value = 0;
    qaPotassium.value = 0;
    qaFiber.value = 0;
    qaVitA.value = 0;
    qaVitC.value = 0;
    qaCalcium.value = 0;
    qaSatFat.value = 0;
    
    qaFavoriteBtn.classList.remove('active');
    qaFavoriteBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
    
    document.getElementById('quickAddModal').classList.add('active');
};

btnSaveQuickAdd.addEventListener('click', async () => {
    const meal = document.getElementById('qaMeal').value;
    const name = document.getElementById('qaName').value || "Quick Add Entry";
    const cals = Number(document.getElementById('qaCals').value) || 0;
    const prot = Number(document.getElementById('qaProt').value) || 0;
    const carb = Number(document.getElementById('qaCarb').value) || 0;
    const fat = Number(document.getElementById('qaFat').value) || 0;
    const sugar = Number(qaSugar.value) || 0;
    const sodium = Number(qaSodium.value) || 0;
    const iron = Number(qaIron.value) || 0;
    const potassium = Number(qaPotassium.value) || 0;
    const fiber = Number(qaFiber.value) || 0;
    const vitA = Number(qaVitA.value) || 0;
    const vitC = Number(qaVitC.value) || 0;
    const calcium = Number(qaCalcium.value) || 0;
    const satFat = Number(qaSatFat.value) || 0;

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
        sugar: sugar,
        sodium: sodium,
        iron: iron,
        potassium: potassium,
        fiber: fiber,
        vitA: vitA,
        vitC: vitC,
        calcium: calcium,
        satFat: satFat,
        timestamp: new Date().toISOString()
    };

    userData.food_diary.push(newEntry);
    await window.BodyProDataStore.saveData(userData);
    
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
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
    
    if(!age || !weightLbs || !heightInches) return alert("Please provide Age, Weight, and Height.");
    
    const weightKg = weightLbs / 2.20462;
    const heightCm = heightInches * 2.54;
    
    let bmr = sex === 'male' ? (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5 : (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
    
    const tdee = bmr * activity;
    const targetCals = Math.round(tdee + goal);
    
    let targetProt = Math.round(weightLbs);
    let targetFat = Math.round((targetCals * 0.25) / 9);
    let targetCarb = Math.round((targetCals - (targetProt * 4) - (targetFat * 9)) / 4);
    if(targetCarb < 0) {
        targetCarb = 0;
        targetProt = Math.round((targetCals - (targetFat * 9)) / 4); 
    }
    
    document.getElementById('calcResultCals').innerText = `${targetCals} kcal`;
    document.getElementById('calcResultProt').innerText = targetProt;
    document.getElementById('calcResultCarb').innerText = targetCarb;
    document.getElementById('calcResultFat').innerText = targetFat;
});

// --- NAVIGATION LISTENERS ---
btnPrevDay.addEventListener('click', () => { currentViewDate.setDate(currentViewDate.getDate() - 1); renderView(); });
btnNextDay.addEventListener('click', () => { currentViewDate.setDate(currentViewDate.getDate() + 1); renderView(); });
