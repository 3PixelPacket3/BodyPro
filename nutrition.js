import { auth } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- DOM Elements ---
const currentLogDateEl = document.getElementById('currentLogDate');
const btnPrevDay = document.getElementById('btnPrevDay');
const btnNextDay = document.getElementById('btnNextDay');
const supplementContainer = document.getElementById('supplementContainer');

// Date Hydration Elements
const nutrWaterDisplay = document.getElementById('nutrWaterDisplay');
const btnNutrWaterAdd = document.getElementById('btnNutrWaterAdd');
const btnNutrWaterSub = document.getElementById('btnNutrWaterSub');

// OCR Input
const ocrLabelFileInput = document.getElementById('ocrLabelFileInput');

// Macro Summary Elements
const sumCalsEl = document.getElementById('sumCals');
const tarCalsEl = document.getElementById('tarCals');
const sumProtEl = document.getElementById('sumProt');
const sumCarbEl = document.getElementById('sumCarb');
const sumFatEl = document.getElementById('sumFat');
const calProgressBar = document.getElementById('calProgressBar');

// Micro Summary Elements
const nSugarVal = document.getElementById('nSugarVal');
const nSodiumVal = document.getElementById('nSodiumVal');
const nIronVal = document.getElementById('nIronVal');
const nPotassiumVal = document.getElementById('nPotassiumVal');
const nFiberVal = document.getElementById('nFiberVal');
const nVitAVal = document.getElementById('nVitAVal');
const nVitCVal = document.getElementById('nVitCVal');
const nCalciumVal = document.getElementById('nCalciumVal');
const nSatFatVal = document.getElementById('nSatFatVal');

// Quick Add / Edit Elements
const qaModalTitle = document.getElementById('qaModalTitle');
const qaEditId = document.getElementById('qaEditId');
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
const qaBarcode = document.getElementById('qaBarcode');

// Macro Calc Elements
const btnRunMacroCalc = document.getElementById('btnRunMacroCalc');
const btnApplyMacroCalcNutr = document.getElementById('btnApplyMacroCalcNutr');

// Interactive Nutrition Label Elements
const nutritionLabelModal = document.getElementById('nutritionLabelModal');
const labelProductName = document.getElementById('labelProductName');
const labelServingMultiplier = document.getElementById('labelServingMultiplier');
const labelUnitMode = document.getElementById('labelUnitMode');
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
                resolve();
            };
            request.onerror = (e) => reject(e.target.error);
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

// --- INITIALIZATION ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }
    
    await FoodCache.init();
    await loadDatabase();
    renderView();
});

function getLocalISODate(dateObj) {
    return window.BodyProTelemetry.getLocalISODate(dateObj);
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

async function loadDatabase() {
    userData = await window.BodyProDataStore.getData();
    if (!userData.favorite_foods) userData.favorite_foods = [];
    if (!userData.biometrics) userData.biometrics = [];
}

function renderView() {
    updateDateDisplay();
    renderDateHydration();
    renderSupplements();
    renderDiary();
    renderFavorites();
}

// --- DATE-AWARE HYDRATION ---
function renderDateHydration() {
    if (!nutrWaterDisplay) return;
    const viewDateStr = getLocalISODate(currentViewDate);
    const dayBio = (userData.biometrics || []).find(b => b.date === viewDateStr) || {};
    const waterOz = dayBio.waterOz || dayBio.water || 0;
    const goalOz = userData.settings?.goals?.waterOz || 120;
    const unit = window.BodyProUnits.getFluidUnit(userData) === 'ml' ? 'mL' : 'fl oz';
    nutrWaterDisplay.innerText = `${window.BodyProUnits.formatFluid(waterOz, userData)} / ${window.BodyProUnits.formatFluid(goalOz, userData)} ${unit}`;
}

async function adjustDateWater(isAdd) {
    const viewDateStr = getLocalISODate(currentViewDate);
    let bio = userData.biometrics.find(b => b.date === viewDateStr);
    if (!bio) {
        bio = { id: 'bio_' + Date.now(), date: viewDateStr, waterOz: 0, supplements: [] };
        userData.biometrics.push(bio);
    }
    const isMl = window.BodyProUnits.getFluidUnit(userData) === 'ml';
    const stepOz = isMl ? (250 / 29.5735) : 8;
    const cur = bio.waterOz || bio.water || 0;
    bio.waterOz = Math.max(0, +(cur + (isAdd ? stepOz : -stepOz)).toFixed(1));
    bio.water = bio.waterOz;
    window.BodyProHardware.playCheckSound();
    renderDateHydration();
    await window.BodyProDataStore.saveData(userData);
}

if (btnNutrWaterAdd) btnNutrWaterAdd.addEventListener('click', () => adjustDateWater(true));
if (btnNutrWaterSub) btnNutrWaterSub.addEventListener('click', () => adjustDateWater(false));

// --- SUPPLEMENT PROTOCOLS ---
function renderSupplements() {
    const viewDateStr = getLocalISODate(currentViewDate);
    
    let dayBio = (userData.biometrics || []).find(b => b.date === viewDateStr);
    let completedSupps = dayBio && dayBio.supplements ? dayBio.supplements : [];

    const rawSupps = userData.profile?.supplements || '';
    const suppTemplate = rawSupps.split(/,|\n/).map(s => s.trim()).filter(s => s);

    supplementContainer.innerHTML = '';

    if (suppTemplate.length === 0) {
        supplementContainer.innerHTML = '<p class="text-muted" style="text-align:center; font-size:0.9rem;">No daily supplements configured in Profile Configuration.</p>';
        return;
    }

    suppTemplate.forEach((suppName, index) => {
        const isChecked = completedSupps.includes(suppName);
        
        const item = document.createElement('div');
        item.className = `supp-item ${isChecked ? 'completed' : ''}`;
        item.innerHTML = `
            <input type="checkbox" id="supp_${index}" ${isChecked ? 'checked' : ''}>
            <label for="supp_${index}">${suppName}</label>
        `;

        const checkbox = item.querySelector('input');
        checkbox.addEventListener('change', async (e) => {
            const checked = e.target.checked;
            window.BodyProHardware.playCheckSound();
            if (checked) item.classList.add('completed');
            else item.classList.remove('completed');
            await toggleSupplement(suppName, checked);
        });

        supplementContainer.appendChild(item);
    });
}

async function toggleSupplement(suppName, isCompleted) {
    const viewDateStr = getLocalISODate(currentViewDate);
    let bioIndex = userData.biometrics.findIndex(b => b.date === viewDateStr);
    
    if (bioIndex === -1) {
        userData.biometrics.push({ id: 'bio_' + Date.now(), date: viewDateStr, waterOz: 0, water: 0, supplements: [] });
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

// --- DIARY & MACRO RENDERING (WITH EDIT & DELETE) ---
function renderDiary() {
    const viewDateStr = getLocalISODate(currentViewDate);
    const daysFoods = (userData.food_diary || []).filter(f => f.date === viewDateStr);
    
    const meals = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
    let dailyCals = 0, dailyProt = 0, dailyCarb = 0, dailyFat = 0;
    let dailySugar = 0, dailySodium = 0, dailyIron = 0, dailyPotassium = 0;
    let dailyFiber = 0, dailyVitA = 0, dailyVitC = 0, dailyCalcium = 0, dailySatFat = 0;

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
                
                dailySugar += Number(food.sugar || 0);
                dailySodium += Number(food.sodium || 0);
                dailyIron += Number(food.iron || 0);
                dailyPotassium += Number(food.potassium || 0);
                dailyFiber += Number(food.fiber || 0);
                dailyVitA += Number(food.vitA || 0);
                dailyVitC += Number(food.vitC || 0);
                dailyCalcium += Number(food.calcium || 0);
                dailySatFat += Number(food.satFat || 0);

                const item = document.createElement('div');
                item.className = 'food-item';
                item.innerHTML = `
                    <div class="food-details" style="cursor: pointer; flex: 1;" onclick="editFoodEntry('${food.id}')" title="Tap to edit portion or meal">
                        <h4>${food.name}</h4>
                        <div class="food-macros">
                            <span>${food.calories} kcal</span>
                            <span class="m-prot">${food.protein}g P</span>
                            <span class="m-carb">${food.carbs}g C</span>
                            <span class="m-fat">${food.fats}g F</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 4px;">
                        <button class="btn btn-ghost" style="width: auto; min-width: 0; padding: 5px 10px; border-color: transparent; color: var(--text-muted);" onclick="editFoodEntry('${food.id}')" title="Edit Entry">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn btn-ghost" style="width: auto; min-width: 0; padding: 5px 10px; border-color: transparent; color: var(--danger);" onclick="deleteFoodEntry('${food.id}')" title="Delete Entry">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                `;
                mealContainer.appendChild(item);
            });
        }
        
        mealCalsEl.innerText = `${Math.round(mealCals)} kcal`;
    });

    const targetCals = userData.settings.macroTargets.calories || 2200;
    sumCalsEl.innerText = Math.round(dailyCals);
    tarCalsEl.innerText = targetCals;
    sumProtEl.innerText = Math.round(dailyProt);
    sumCarbEl.innerText = Math.round(dailyCarb);
    sumFatEl.innerText = Math.round(dailyFat);
    
    if (nSugarVal) nSugarVal.innerText = `${Math.round(dailySugar)}g`;
    if (nSodiumVal) nSodiumVal.innerText = `${Math.round(dailySodium)}mg`;
    if (nIronVal) nIronVal.innerText = `${Math.round(dailyIron)}mg`;
    if (nPotassiumVal) nPotassiumVal.innerText = `${Math.round(dailyPotassium)}mg`;
    if (nFiberVal) nFiberVal.innerText = `${Math.round(dailyFiber)}g`;
    if (nVitAVal) nVitAVal.innerText = `${Math.round(dailyVitA)}mcg`;
    if (nVitCVal) nVitCVal.innerText = `${Math.round(dailyVitC)}mg`;
    if (nCalciumVal) nCalciumVal.innerText = `${Math.round(dailyCalcium)}mg`;
    if (nSatFatVal) nSatFatVal.innerText = `${Math.round(dailySatFat)}g`;

    const pct = Math.min((dailyCals / targetCals) * 100, 100);
    calProgressBar.style.width = `${pct}%`;
    if (dailyCals > targetCals) calProgressBar.classList.add('overage');
    else calProgressBar.classList.remove('overage');
}

// --- OCR PHYSICAL NUTRITION FACTS SCANNER ---
window.triggerOCRLabelScan = function() {
    if (ocrLabelFileInput) ocrLabelFileInput.click();
};

if (ocrLabelFileInput) {
    ocrLabelFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const defaultMeal = userData?.settings?.preferences?.defaultMeal || 'Snacks';
        window.openQuickAddModal(defaultMeal);
        document.getElementById('qaName').value = "Analyzing Label via Optical OCR...";

        try {
            const rawText = await window.BodyProOCR.scanImage(file);
            const parsed = window.BodyProOCR.parseNutritionText(rawText);

            document.getElementById('qaName').value = parsed.name;
            document.getElementById('qaCals').value = parsed.cals;
            document.getElementById('qaProt').value = parsed.prot;
            document.getElementById('qaCarb').value = parsed.carb;
            document.getElementById('qaFat').value = parsed.fat;
            qaSatFat.value = parsed.satFat;
            qaSodium.value = parsed.sodium;
            qaFiber.value = parsed.fiber;
            qaSugar.value = parsed.sugar;
            qaCalcium.value = parsed.calcium;
            qaIron.value = parsed.iron;
            qaPotassium.value = parsed.potassium;
            window.BodyProHardware.playCheckSound();
        } catch (err) {
            console.error("OCR Scan Error:", err);
            document.getElementById('qaName').value = "Manual Label Entry";
            alert("Could not automatically read label text. Please enter values manually.");
        } finally {
            ocrLabelFileInput.value = '';
        }
    });
}

// --- API FETCH ENGINE WITH RETRY LOGIC ---
async function fetchWithRetry(url, retries = 3, delayMs = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}

// --- OPTICAL BARCODE SCANNER ---
window.openScannerModal = function() {
    const fabContainer = document.getElementById('fabContainer');
    if (fabContainer && !fabContainer.classList.contains('active')) {
        fabContainer.classList.add('active');
    }
    document.getElementById('scannerModal').classList.add('active');
    if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");
    
    const config = { fps: 10, qrbox: { width: 250, height: 200 } };
    html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
    .catch(err => {
        document.getElementById('reader').innerHTML = '<p style="color:var(--warning); padding:20px; text-align:center;">Camera stream unavailable or permission denied. Use "Scan Label OCR" below to upload a photo, or use Quick Add.</p>';
    });
};

window.closeScannerModal = function() {
    document.getElementById('scannerModal').classList.remove('active');
    if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().catch(console.error);
};

async function onScanSuccess(decodedText) {
    if (html5QrCode && html5QrCode.isScanning) await html5QrCode.stop();
    document.getElementById('scannerModal').classList.remove('active');
    window.BodyProHardware.playCheckSound();
    
    labelProductName.innerText = "Querying Database...";
    labelServingMultiplier.value = 1;
    if (labelUnitMode) labelUnitMode.value = 'serving';
    
    const defaultMeal = userData?.settings?.preferences?.defaultMeal || 'Snacks';
    labelMealSelect.value = defaultMeal;
    
    const cachedProduct = await FoodCache.get(decodedText);
    
    if (cachedProduct) {
        nutritionLabelModal.classList.add('active');
        currentScannedFood = cachedProduct;
        updateNutritionLabelDisplay();
        checkIfFavorite(currentScannedFood.name, nlFavoriteBtn);
        return; 
    }

    try {
        nutritionLabelModal.classList.add('active');
        const data = await fetchWithRetry(`https://world.openfoodfacts.org/api/v0/product/${decodedText}.json`, 3, 1000);
        
        if (data && data.status === 1 && data.product) {
            currentScannedFood = parseOpenFoodFactsProduct(data.product);
            updateNutritionLabelDisplay();
            checkIfFavorite(currentScannedFood.name, nlFavoriteBtn);
            await FoodCache.set(decodedText, currentScannedFood);
        } else {
            alert("Barcode not found in OpenFoodFacts. You can snap a photo of the Nutrition Label with OCR or enter macros manually—this barcode will be cached for future offline scans!");
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
            qaBarcode.value = decodedText;
            window.openQuickAddModal(defaultMeal);
        }
    } catch (err) {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        qaBarcode.value = decodedText;
        window.openQuickAddModal(defaultMeal);
    }
}

// --- OPENFOODFACTS TEXT API SEARCH ---
let searchDebounceTimer;

apiSearchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        if(apiSearchInput.value.trim().length >= 3) {
            btnApiSearch.click();
        } else if (apiSearchInput.value.trim().length === 0) {
             apiSearchResults.innerHTML = '<p class="text-muted" style="text-align:center; font-size:0.9rem; padding: 20px;">Enter a food name to search the global registry. Auto-search enabled.</p>';
        }
    }, 800);
});

btnApiSearch.addEventListener('click', async () => {
    const query = apiSearchInput.value.trim();
    if (!query) return;

    apiSearchResults.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Querying global registry...</div>';
    
    try {
        const data = await fetchWithRetry(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=15`, 3, 1000);

        apiSearchResults.innerHTML = '';

        if (!data || !data.products || data.products.length === 0) {
            apiSearchResults.innerHTML = '<p class="text-muted" style="text-align:center; padding: 20px;">No matching items found.</p>';
            return;
        }

        data.products.forEach(p => {
            const parsed = parseOpenFoodFactsProduct(p);
            if(parsed.name === "Unknown Product") return;
            
            const div = document.createElement('div');
            div.className = 'db-item';
            div.innerHTML = `
                <div>
                    <h4 style="margin: 0; font-size: 1rem;">${parsed.name}</h4>
                    <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted);">${parsed.cals} kcal | ${parsed.prot}P / ${parsed.carb}C / ${parsed.fat}F</p>
                </div>
                <div class="db-item-actions">
                    <button class="btn btn-ghost" style="width: auto; min-width: 0; color: var(--accent); border: 1px solid var(--accent); font-size: 0.8rem; padding: 4px 10px; border-radius: 4px;">Log</button>
                </div>
            `;
            
            div.querySelector('button').addEventListener('click', () => {
                currentScannedFood = parsed;
                labelServingMultiplier.value = 1;
                if (labelUnitMode) labelUnitMode.value = 'serving';
                updateNutritionLabelDisplay();
                checkIfFavorite(parsed.name, nlFavoriteBtn);
                nutritionLabelModal.classList.add('active');
            });
            
            apiSearchResults.appendChild(div);
        });

    } catch (err) {
        console.error(err);
        apiSearchResults.innerHTML = '<p class="text-danger" style="text-align:center; padding: 20px;">Connection failed. Check network or use offline Favorites.</p>';
    }
});

function parseOpenFoodFactsProduct(p) {
    const nut = p.nutriments || {};
    const servingGrams = parseFloat(p.serving_quantity) || 100;
    return {
        name: p.product_name || p.generic_name || "Unknown Product",
        servingGrams: servingGrams,
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
        vitA: Math.round((nut['vitamin-a_serving'] || nut['vitamin-a_100g'] || 0) * 1000000),
        cals100g: Math.round(nut['energy-kcal_100g'] || nut['energy-kcal_serving'] || 0),
        prot100g: Math.round(nut['proteins_100g'] || nut['proteins_serving'] || 0),
        carb100g: Math.round(nut['carbohydrates_100g'] || nut['carbohydrates_serving'] || 0),
        fat100g: Math.round(nut['fat_100g'] || nut['fat_serving'] || 0)
    };
}

// --- INTERACTIVE NUTRITION LABEL LOGIC (SERVINGS / GRAMS / OUNCES) ---
function getLabelScaleFactor() {
    const rawAmount = parseFloat(labelServingMultiplier.value) || 0;
    const mode = labelUnitMode ? labelUnitMode.value : 'serving';
    const baseGrams = currentScannedFood?.servingGrams || 100;

    if (mode === 'grams') {
        return rawAmount / baseGrams;
    } else if (mode === 'oz') {
        return (rawAmount * 28.3495) / baseGrams;
    }
    return rawAmount;
}

function updateNutritionLabelDisplay() {
    if (!currentScannedFood) return;
    const multiplier = getLabelScaleFactor();
    
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
if (labelUnitMode) {
    labelUnitMode.addEventListener('change', () => {
        if (labelUnitMode.value === 'grams') labelServingMultiplier.value = currentScannedFood?.servingGrams || 100;
        else if (labelUnitMode.value === 'oz') labelServingMultiplier.value = 3.5;
        else labelServingMultiplier.value = 1;
        updateNutritionLabelDisplay();
    });
}

btnLogScannedFood.addEventListener('click', async () => {
    if (!currentScannedFood) return;
    btnLogScannedFood.disabled = true;
    btnLogScannedFood.innerText = "Saving...";

    const multiplier = getLabelScaleFactor();
    const rawAmount = parseFloat(labelServingMultiplier.value) || 1;
    const mode = labelUnitMode ? labelUnitMode.value : 'serving';
    const unitSuffix = mode === 'grams' ? `${rawAmount}g` : (mode === 'oz' ? `${rawAmount}oz` : `${rawAmount}x`);
    const meal = labelMealSelect.value;
    
    const newEntry = {
        id: 'food_' + Date.now(),
        date: getLocalISODate(currentViewDate),
        meal: meal,
        name: `${currentScannedFood.name} (${unitSuffix})`,
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
        userData.favorite_foods.splice(index, 1);
        btnElement.classList.remove('active');
        btnElement.innerHTML = '<i class="fa-regular fa-heart"></i>';
    } else {
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

nlFavoriteBtn.addEventListener('click', () => {
    if (currentScannedFood) toggleFavoriteStatus(currentScannedFood, nlFavoriteBtn);
});

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
                <button class="btn btn-ghost" style="width: auto; min-width: 0; color: var(--accent); border: 1px solid var(--accent); font-size: 0.8rem; padding: 4px 10px; border-radius: 4px;" title="Quick Log">Log</button>
                <button title="Remove Favorite" style="color: var(--danger);"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        
        div.querySelector('.btn-ghost').addEventListener('click', () => {
            currentScannedFood = fav;
            labelServingMultiplier.value = 1;
            if (labelUnitMode) labelUnitMode.value = 'serving';
            updateNutritionLabelDisplay();
            checkIfFavorite(fav.name, nlFavoriteBtn);
            nutritionLabelModal.classList.add('active');
        });
        
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

// --- CRUD OPERATIONS (ADD & EDIT FOOD ENTRY) ---
window.openQuickAddModal = function(meal = 'Snacks') {
    const defaultMeal = meal || userData?.settings?.preferences?.defaultMeal || 'Snacks';
    document.getElementById('qaMeal').value = defaultMeal;
    populateRecipeDropdown();
    
    if (qaModalTitle) qaModalTitle.innerHTML = '<i class="fa-solid fa-bolt text-warning"></i> Add to Diary';
    if (qaEditId) qaEditId.value = '';
    btnSaveQuickAdd.innerText = "Save Entry";

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
    
    if (!qaBarcode.value || document.getElementById('scannerModal').classList.contains('active')) {
        qaBarcode.value = '';
    }
    
    qaFavoriteBtn.classList.remove('active');
    qaFavoriteBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
    
    document.getElementById('quickAddModal').classList.add('active');
};

window.editFoodEntry = function(id) {
    const entry = (userData.food_diary || []).find(f => f.id === id);
    if (!entry) return;

    populateRecipeDropdown();
    if (qaModalTitle) qaModalTitle.innerHTML = '<i class="fa-solid fa-pen text-primary"></i> Edit Diary Entry';
    if (qaEditId) qaEditId.value = entry.id;
    btnSaveQuickAdd.innerText = "Update Entry";

    document.getElementById('qaMeal').value = entry.meal || 'Snacks';
    document.getElementById('qaName').value = entry.name || '';
    document.getElementById('qaCals').value = entry.calories || 0;
    document.getElementById('qaProt').value = entry.protein || 0;
    document.getElementById('qaCarb').value = entry.carbs || 0;
    document.getElementById('qaFat').value = entry.fats || 0;
    qaSugar.value = entry.sugar || 0;
    qaSodium.value = entry.sodium || 0;
    qaIron.value = entry.iron || 0;
    qaPotassium.value = entry.potassium || 0;
    qaFiber.value = entry.fiber || 0;
    qaVitA.value = entry.vitA || 0;
    qaVitC.value = entry.vitC || 0;
    qaCalcium.value = entry.calcium || 0;
    qaSatFat.value = entry.satFat || 0;

    checkIfFavorite(entry.name || '', qaFavoriteBtn);
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

    const customFoodPayload = {
        name, cals, prot, carb, fat, sugar, sodium, iron, potassium, fiber, vitA, vitC, calcium, satFat
    };

    const existingEditId = qaEditId ? qaEditId.value : '';
    if (existingEditId) {
        const idx = userData.food_diary.findIndex(f => f.id === existingEditId);
        if (idx !== -1) {
            userData.food_diary[idx] = {
                ...userData.food_diary[idx],
                meal,
                ...customFoodPayload,
                calories: cals,
                protein: prot,
                carbs: carb,
                fats: fat
            };
        }
        qaEditId.value = '';
    } else {
        const newEntry = {
            id: 'food_' + Date.now(),
            date: getLocalISODate(currentViewDate),
            meal: meal,
            ...customFoodPayload,
            calories: cals,
            protein: prot,
            carbs: carb,
            fats: fat,
            timestamp: new Date().toISOString()
        };
        userData.food_diary.push(newEntry);
    }
    
    const pendingBarcode = qaBarcode.value;
    if (pendingBarcode) {
        await FoodCache.set(pendingBarcode, customFoodPayload);
        qaBarcode.value = '';
    }

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
    const targetCals = Math.max(1200, Math.round(tdee + goal));
    
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

    if (btnApplyMacroCalcNutr) {
        btnApplyMacroCalcNutr.style.display = 'inline-flex';
        btnApplyMacroCalcNutr.dataset.cals = targetCals;
        btnApplyMacroCalcNutr.dataset.prot = targetProt;
        btnApplyMacroCalcNutr.dataset.carb = targetCarb;
        btnApplyMacroCalcNutr.dataset.fat = targetFat;
    }
});

if (btnApplyMacroCalcNutr) {
    btnApplyMacroCalcNutr.addEventListener('click', async () => {
        userData.settings.macroTargets = {
            calories: parseInt(btnApplyMacroCalcNutr.dataset.cals) || 2200,
            protein: parseInt(btnApplyMacroCalcNutr.dataset.prot) || 200,
            carbs: parseInt(btnApplyMacroCalcNutr.dataset.carb) || 150,
            fats: parseInt(btnApplyMacroCalcNutr.dataset.fat) || 88
        };
        await window.BodyProDataStore.saveData(userData);
        renderView();
        document.getElementById('macroCalcModal').classList.remove('active');
    });
}

// --- NAVIGATION LISTENERS ---
btnPrevDay.addEventListener('click', () => { currentViewDate.setDate(currentViewDate.getDate() - 1); renderView(); });
btnNextDay.addEventListener('click', () => { currentViewDate.setDate(currentViewDate.getDate() + 1); renderView(); });
