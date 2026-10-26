import { auth } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- DOM Elements ---
const recipeNameInput = document.getElementById('recipeName');
const recipeServingsInput = document.getElementById('recipeServings');
const activeIngredientList = document.getElementById('activeIngredientList');
const emptyIngredientMsg = document.getElementById('emptyIngredientMsg');
const btnClearRecipe = document.getElementById('btnClearRecipe');
const btnSaveRecipe = document.getElementById('btnSaveRecipe');
const savedRecipesList = document.getElementById('savedRecipesList');
const recipeOcrFileInput = document.getElementById('recipeOcrFileInput');

// Macro Summaries
const recCals = document.getElementById('recCals');
const recProt = document.getElementById('recProt');
const recCarb = document.getElementById('recCarb');
const recFat = document.getElementById('recFat');
const recSugar = document.getElementById('recSugar');
const recSodium = document.getElementById('recSodium');
const recIron = document.getElementById('recIron');
const recPotassium = document.getElementById('recPotassium');
const recFiber = document.getElementById('recFiber');
const recVitA = document.getElementById('recVitA');
const recVitC = document.getElementById('recVitC');
const recCalcium = document.getElementById('recCalcium');
const recSatFat = document.getElementById('recSatFat');

// Ingredient Modal Elements
const ingName = document.getElementById('ingName');
const ingCals = document.getElementById('ingCals');
const ingProt = document.getElementById('ingProt');
const ingCarb = document.getElementById('ingCarb');
const ingFat = document.getElementById('ingFat');
const ingSugar = document.getElementById('ingSugar');
const ingSodium = document.getElementById('ingSodium');
const ingIron = document.getElementById('ingIron');
const ingPotassium = document.getElementById('ingPotassium');
const ingFiber = document.getElementById('ingFiber');
const ingVitA = document.getElementById('ingVitA');
const ingVitC = document.getElementById('ingVitC');
const ingCalcium = document.getElementById('ingCalcium');
const ingSatFat = document.getElementById('ingSatFat');
const btnAddIngredientToRecipe = document.getElementById('btnAddIngredientToRecipe');

// Text API Search Elements
const recipeApiSearchInput = document.getElementById('recipeApiSearchInput');
const btnRecipeApiSearch = document.getElementById('btnRecipeApiSearch');
const recipeApiSearchResults = document.getElementById('recipeApiSearchResults');

// Copy Feature
const copySourceDate = document.getElementById('copySourceDate');
const copySourceMeal = document.getElementById('copySourceMeal');
const btnExecuteCopy = document.getElementById('btnExecuteCopy');

// --- STATE MANAGEMENT ---
let userData = null;
let currentIngredients = [];
let editingRecipeId = null;
let recipeQrScanner = null;

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

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }
    userData = await window.BodyProDataStore.getData();
    if (!userData.custom_recipes) userData.custom_recipes = [];
    renderSavedRecipes();
});

// --- OPENFOODFACTS TEXT API SEARCH (RECIPE MODAL) ---
let searchDebounceTimer;

recipeApiSearchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        if(recipeApiSearchInput.value.trim().length >= 3) {
            btnRecipeApiSearch.click();
        } else if (recipeApiSearchInput.value.trim().length === 0) {
             recipeApiSearchResults.innerHTML = '';
        }
    }, 800);
});

btnRecipeApiSearch.addEventListener('click', async () => {
    const query = recipeApiSearchInput.value.trim();
    if (!query) return;

    recipeApiSearchResults.innerHTML = '<div style="text-align:center; padding: 10px; color: var(--text-muted); font-size: 0.85rem;"><i class="fa-solid fa-spinner fa-spin"></i> Querying global registry...</div>';
    
    try {
        const data = await fetchWithRetry(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10`, 3, 1000);
        recipeApiSearchResults.innerHTML = '';

        if (!data || !data.products || data.products.length === 0) {
            recipeApiSearchResults.innerHTML = '<p class="text-muted" style="text-align:center; padding: 10px; font-size: 0.85rem;">No matching items found.</p>';
            return;
        }

        data.products.forEach(p => {
            const parsed = parseOpenFoodFactsProduct(p);
            if(parsed.name === "Unknown Product") return;
            
            const div = document.createElement('div');
            div.style.padding = '10px';
            div.style.borderBottom = '1px solid var(--border-color)';
            div.style.cursor = 'pointer';
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            
            div.innerHTML = `
                <div>
                    <div style="font-weight: 600; font-size: 0.9rem;">${parsed.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${parsed.cals} kcal | ${parsed.prot}P / ${parsed.carb}C / ${parsed.fat}F</div>
                </div>
                <i class="fa-solid fa-download text-primary"></i>
            `;
            
            div.addEventListener('click', () => {
                populateIngredientInputs(parsed);
                recipeApiSearchResults.innerHTML = '';
                recipeApiSearchInput.value = '';
            });
            
            recipeApiSearchResults.appendChild(div);
        });

    } catch (err) {
        console.error(err);
        recipeApiSearchResults.innerHTML = '<p class="text-danger" style="text-align:center; padding: 10px; font-size: 0.85rem;">Network timeout. API offline.</p>';
    }
});

function populateIngredientInputs(parsed) {
    ingName.value = parsed.name || '';
    ingCals.value = parsed.cals || 0;
    ingProt.value = parsed.prot || 0;
    ingCarb.value = parsed.carb || 0;
    ingFat.value = parsed.fat || 0;
    ingSugar.value = parsed.sugar || 0;
    ingSodium.value = parsed.sodium || 0;
    ingIron.value = parsed.iron || 0;
    ingPotassium.value = parsed.potassium || 0;
    ingFiber.value = parsed.fiber || 0;
    ingVitA.value = parsed.vitA || 0;
    ingVitC.value = parsed.vitC || 0;
    ingCalcium.value = parsed.calcium || 0;
    ingSatFat.value = parsed.satFat || 0;
}

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

// --- OPTICAL BARCODE & OCR SCANNING FOR RECIPE INGREDIENTS ---
window.openScannerFromRecipe = function() {
    document.getElementById('scannerModal').classList.add('active');
    if (!recipeQrScanner) recipeQrScanner = new Html5Qrcode("reader");
    recipeQrScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 200 } },
        async (decodedText) => {
            if (recipeQrScanner && recipeQrScanner.isScanning) await recipeQrScanner.stop();
            document.getElementById('scannerModal').classList.remove('active');
            window.BodyProHardware.playCheckSound();
            try {
                const data = await fetchWithRetry(`https://world.openfoodfacts.org/api/v0/product/${decodedText}.json`, 2, 800);
                if (data && data.status === 1 && data.product) {
                    populateIngredientInputs(parseOpenFoodFactsProduct(data.product));
                } else {
                    alert("Barcode not found in registry. Try OCR Label Scan or enter values manually.");
                }
            } catch (e) {
                alert("Network error querying barcode.");
            }
        }
    ).catch(() => {
        document.getElementById('reader').innerHTML = '<p style="color:var(--warning); padding:15px; text-align:center;">Camera stream unavailable. Use OCR button or text search.</p>';
    });
};

window.closeScannerModal = function() {
    document.getElementById('scannerModal').classList.remove('active');
    if (recipeQrScanner && recipeQrScanner.isScanning) recipeQrScanner.stop().catch(() => {});
};

window.triggerRecipeOCR = function() {
    if (recipeOcrFileInput) recipeOcrFileInput.click();
};

if (recipeOcrFileInput) {
    recipeOcrFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        ingName.value = "Scanning Nutrition Label via OCR...";
        try {
            const text = await window.BodyProOCR.scanImage(file);
            const parsed = window.BodyProOCR.parseNutritionText(text);
            populateIngredientInputs(parsed);
            window.BodyProHardware.playCheckSound();
        } catch (err) {
            ingName.value = "";
            alert("OCR scan failed. Please enter values manually.");
        } finally {
            recipeOcrFileInput.value = '';
        }
    });
}

// --- RECIPE BUILDER LOGIC ---
btnAddIngredientToRecipe.addEventListener('click', () => {
    const name = ingName.value.trim();
    if (!name) return alert("Ingredient name required.");

    const newIng = {
        id: 'ing_' + Date.now(),
        name: name,
        calories: Number(ingCals.value) || 0,
        protein: Number(ingProt.value) || 0,
        carbs: Number(ingCarb.value) || 0,
        fats: Number(ingFat.value) || 0,
        sugar: Number(ingSugar.value) || 0,
        sodium: Number(ingSodium.value) || 0,
        iron: Number(ingIron.value) || 0,
        potassium: Number(ingPotassium.value) || 0,
        fiber: Number(ingFiber.value) || 0,
        vitA: Number(ingVitA.value) || 0,
        vitC: Number(ingVitC.value) || 0,
        calcium: Number(ingCalcium.value) || 0,
        satFat: Number(ingSatFat.value) || 0
    };

    currentIngredients.push(newIng);
    updateIngredientList();
    window.closeIngredientModal();
});

function updateIngredientList() {
    if (currentIngredients.length === 0) {
        activeIngredientList.innerHTML = '';
        activeIngredientList.appendChild(emptyIngredientMsg);
        emptyIngredientMsg.style.display = 'block';
    } else {
        emptyIngredientMsg.style.display = 'none';
        activeIngredientList.innerHTML = '';
        currentIngredients.forEach(ing => {
            const div = document.createElement('div');
            div.className = 'ingredient-item';
            div.innerHTML = `
                <div class="ingredient-details">
                    <h4>${ing.name}</h4>
                    <div class="ingredient-macros">
                        <span>${ing.calories} kcal</span>
                        <span class="text-primary">${ing.protein}g P</span>
                        <span class="text-warning">${ing.carbs}g C</span>
                        <span class="text-danger">${ing.fats}g F</span>
                    </div>
                </div>
                <button class="btn btn-ghost" style="width:auto; min-width:0; padding: 5px; color: var(--danger); border: none;" onclick="removeIngredient('${ing.id}')"><i class="fa-solid fa-xmark"></i></button>
            `;
            activeIngredientList.appendChild(div);
        });
    }
    calculateRecipeMacros();
}

window.removeIngredient = function(id) {
    currentIngredients = currentIngredients.filter(i => i.id !== id);
    updateIngredientList();
};

function calculateRecipeMacros() {
    const servings = Math.max(1, Number(recipeServingsInput.value) || 1);
    
    let tCals = 0, tProt = 0, tCarb = 0, tFat = 0;
    let tSug = 0, tSod = 0, tIr = 0, tPot = 0, tFib = 0, tVA = 0, tVC = 0, tCal = 0, tSF = 0;

    currentIngredients.forEach(ing => {
        tCals += ing.calories; tProt += ing.protein; tCarb += ing.carbs; tFat += ing.fats;
        tSug += ing.sugar; tSod += ing.sodium; tIr += ing.iron; tPot += ing.potassium;
        tFib += ing.fiber; tVA += ing.vitA; tVC += ing.vitC; tCal += ing.calcium; tSF += ing.satFat;
    });

    recCals.innerText = Math.round(tCals / servings);
    recProt.innerText = Math.round(tProt / servings) + 'g';
    recCarb.innerText = Math.round(tCarb / servings) + 'g';
    recFat.innerText = Math.round(tFat / servings) + 'g';
    
    recSugar.innerText = Math.round(tSug / servings) + 'g';
    recSodium.innerText = Math.round(tSod / servings) + 'mg';
    recIron.innerText = Math.round(tIr / servings) + 'mg';
    recPotassium.innerText = Math.round(tPot / servings) + 'mg';
    recFiber.innerText = Math.round(tFib / servings) + 'g';
    recVitA.innerText = Math.round(tVA / servings) + 'mcg';
    recVitC.innerText = Math.round(tVC / servings) + 'mg';
    recCalcium.innerText = Math.round(tCal / servings) + 'mg';
    recSatFat.innerText = Math.round(tSF / servings) + 'g';
}

recipeServingsInput.addEventListener('input', calculateRecipeMacros);

btnClearRecipe.addEventListener('click', () => {
    if(confirm("Clear current recipe build?")) {
        currentIngredients = [];
        editingRecipeId = null;
        recipeNameInput.value = '';
        recipeServingsInput.value = 1;
        btnSaveRecipe.innerHTML = '<i class="fa-solid fa-save"></i> Save Recipe';
        updateIngredientList();
    }
});

btnSaveRecipe.addEventListener('click', async () => {
    const name = recipeNameInput.value.trim();
    if (!name) return alert("Recipe requires a name.");
    if (currentIngredients.length === 0) return alert("Recipe requires ingredients.");

    btnSaveRecipe.disabled = true;
    btnSaveRecipe.innerText = "Saving...";

    const servings = Math.max(1, Number(recipeServingsInput.value) || 1);

    const recipeObj = {
        id: editingRecipeId || ('rec_' + Date.now()),
        name: name,
        servings: servings,
        ingredients: currentIngredients,
        macrosPerServing: {
            calories: parseInt(recCals.innerText),
            protein: parseInt(recProt.innerText),
            carbs: parseInt(recCarb.innerText),
            fats: parseInt(recFat.innerText),
            sugar: parseInt(recSugar.innerText),
            sodium: parseInt(recSodium.innerText),
            iron: parseInt(recIron.innerText),
            potassium: parseInt(recPotassium.innerText),
            fiber: parseInt(recFiber.innerText),
            vitA: parseInt(recVitA.innerText),
            vitC: parseInt(recVitC.innerText),
            calcium: parseInt(recCalcium.innerText),
            satFat: parseInt(recSatFat.innerText)
        },
        timestamp: new Date().toISOString()
    };

    if (editingRecipeId) {
        const idx = userData.custom_recipes.findIndex(r => r.id === editingRecipeId);
        if (idx !== -1) userData.custom_recipes[idx] = recipeObj;
        else userData.custom_recipes.push(recipeObj);
        editingRecipeId = null;
    } else {
        userData.custom_recipes.push(recipeObj);
    }
    await window.BodyProDataStore.saveData(userData);

    currentIngredients = [];
    recipeNameInput.value = '';
    recipeServingsInput.value = 1;
    updateIngredientList();
    renderSavedRecipes();

    btnSaveRecipe.disabled = false;
    btnSaveRecipe.innerHTML = '<i class="fa-solid fa-save"></i> Save Recipe';
});

function renderSavedRecipes() {
    savedRecipesList.innerHTML = '';
    const recipes = userData.custom_recipes || [];
    
    if (recipes.length === 0) {
        savedRecipesList.innerHTML = '<p class="text-muted" style="text-align: center; font-size: 0.9rem;">No custom recipes saved in Vault.</p>';
        return;
    }

    recipes.forEach(rec => {
        const div = document.createElement('div');
        div.className = 'saved-recipe-item';
        div.innerHTML = `
            <div>
                <h4 style="margin: 0 0 5px 0; font-size: 1rem;">${rec.name} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">(${rec.servings} Servings)</span></h4>
                <div style="font-size: 0.8rem; font-weight: 600; display: flex; gap: 10px;">
                    <span>${rec.macrosPerServing.calories} kcal</span>
                    <span class="text-primary">${rec.macrosPerServing.protein}g P</span>
                    <span class="text-warning">${rec.macrosPerServing.carbs}g C</span>
                    <span class="text-danger">${rec.macrosPerServing.fats}g F</span>
                </div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
                <button class="btn btn-ghost" style="width: auto; min-width: 0; padding: 6px 10px; font-size: 0.75rem; border-color: var(--accent); color: var(--accent);" onclick="logRecipeServing('${rec.id}')"><i class="fa-solid fa-utensils"></i> Log 1x</button>
                <button class="btn btn-ghost" style="width: auto; min-width: 0; padding: 6px 10px; font-size: 0.75rem; border: none;" onclick="editSavedRecipe('${rec.id}')" title="Edit Recipe"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-ghost" style="width: auto; min-width: 0; padding: 6px 10px; color: var(--danger); border: none;" onclick="deleteRecipe('${rec.id}')" title="Delete Recipe"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        savedRecipesList.appendChild(div);
    });
}

window.logRecipeServing = async function(id) {
    const rec = (userData.custom_recipes || []).find(r => r.id === id);
    if (!rec) return;
    const meal = userData.settings?.preferences?.defaultMeal || 'Dinner';
    const m = rec.macrosPerServing || {};
    userData.food_diary = userData.food_diary || [];
    userData.food_diary.push({
        id: 'food_' + Date.now(),
        date: getLocalISODate(new Date()),
        meal: meal,
        name: `${rec.name} (1 serving)`,
        calories: m.calories || 0,
        protein: m.protein || 0,
        carbs: m.carbs || 0,
        fats: m.fats || 0,
        sugar: m.sugar || 0,
        sodium: m.sodium || 0,
        iron: m.iron || 0,
        potassium: m.potassium || 0,
        fiber: m.fiber || 0,
        vitA: m.vitA || 0,
        vitC: m.vitC || 0,
        calcium: m.calcium || 0,
        satFat: m.satFat || 0,
        timestamp: new Date().toISOString()
    });
    window.BodyProHardware.playCheckSound();
    await window.BodyProDataStore.saveData(userData);
    alert(`Logged 1 serving of "${rec.name}" to today's ${meal}!`);
};

window.editSavedRecipe = function(id) {
    const rec = (userData.custom_recipes || []).find(r => r.id === id);
    if (!rec) return;
    editingRecipeId = rec.id;
    recipeNameInput.value = rec.name;
    recipeServingsInput.value = rec.servings || 1;
    currentIngredients = JSON.parse(JSON.stringify(rec.ingredients || []));
    btnSaveRecipe.innerHTML = '<i class="fa-solid fa-save"></i> Update Recipe';
    updateIngredientList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteRecipe = async function(id) {
    if (confirm("Delete this recipe from your Vault?")) {
        userData.custom_recipes = userData.custom_recipes.filter(r => r.id !== id);
        await window.BodyProDataStore.saveData(userData);
        renderSavedRecipes();
    }
};

// --- MEAL COPIER LOGIC ---
btnExecuteCopy.addEventListener('click', async () => {
    const sourceDate = copySourceDate.value;
    const sourceMeal = copySourceMeal.value;
    
    if(!sourceDate) return alert("Select a valid source date.");
    
    const foodsToCopy = (userData.food_diary || []).filter(f => f.date === sourceDate && f.meal === sourceMeal);
    
    if(foodsToCopy.length === 0) {
        return alert(`No items found logged under ${sourceMeal} on ${sourceDate}.`);
    }

    const todayStr = getLocalISODate(new Date());
    
    foodsToCopy.forEach((food, index) => {
        const newEntry = { ...food };
        newEntry.id = 'food_' + Date.now() + '_' + index;
        newEntry.date = todayStr;
        newEntry.timestamp = new Date().toISOString();
        userData.food_diary.push(newEntry);
    });
    
    await window.BodyProDataStore.saveData(userData);
    alert(`Successfully duplicated ${foodsToCopy.length} items to today's ${sourceMeal}.`);
});

function getLocalISODate(dateObj) {
    return window.BodyProTelemetry.getLocalISODate(dateObj);
}
