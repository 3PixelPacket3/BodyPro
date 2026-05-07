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

// --- API FETCH ENGINE WITH RETRY LOGIC ---
async function fetchWithRetry(url, retries = 3, delayMs = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (err) {
            console.warn(`[BodyPro Network] API attempt ${i + 1} failed. Re-engaging...`, err);
            if (i === retries - 1) throw err; 
            await new Promise(resolve => setTimeout(resolve, delayMs)); 
        }
    }
}

// --- THE SECURITY GUARD ---
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
                ingName.value = parsed.name;
                ingCals.value = parsed.cals;
                ingProt.value = parsed.prot;
                ingCarb.value = parsed.carb;
                ingFat.value = parsed.fat;
                ingSugar.value = parsed.sugar;
                ingSodium.value = parsed.sodium;
                ingIron.value = parsed.iron;
                ingPotassium.value = parsed.potassium;
                ingFiber.value = parsed.fiber;
                ingVitA.value = parsed.vitA;
                ingVitC.value = parsed.vitC;
                ingCalcium.value = parsed.calcium;
                ingSatFat.value = parsed.satFat;
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

// Override scanner logic to disable it per user instruction for the recipe tab
window.openScannerFromRecipe = function() {
    alert("Barcode scanning is disabled in the Recipe Builder. Please utilize the text registry search.");
};

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
    closeIngredientModal();
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
                <button class="btn btn-ghost" style="padding: 5px; color: var(--danger); border: none;" onclick="removeIngredient('${ing.id}')"><i class="fa-solid fa-xmark"></i></button>
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
        recipeNameInput.value = '';
        recipeServingsInput.value = 1;
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
        id: 'rec_' + Date.now(),
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

    userData.custom_recipes.push(recipeObj);
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
            <button class="btn btn-ghost" style="color: var(--danger); border: none;" onclick="deleteRecipe('${rec.id}')"><i class="fa-solid fa-trash"></i></button>
        `;
        savedRecipesList.appendChild(div);
    });
}

window.deleteRecipe = async function(id) {
    if (confirm("Delete this recipe from your Vault?")) {
        userData.custom_recipes = userData.custom_recipes.filter(r => r.id !== id);
        await window.BodyProDataStore.saveData(userData);
        renderSavedRecipes();
    }
};

// --- MEAL COPIER LOGIC ---
btnExecuteCopy.addEventListener('click', async () => {
    const sourceDate = copySourceDate.value; // YYYY-MM-DD
    const sourceMeal = copySourceMeal.value;
    
    if(!sourceDate) return alert("Select a valid source date.");
    
    const foodsToCopy = (userData.food_diary || []).filter(f => f.date === sourceDate && f.meal === sourceMeal);
    
    if(foodsToCopy.length === 0) {
        return alert(`No items found logged under ${sourceMeal} on ${sourceDate}.`);
    }

    const todayStr = getLocalISODate(new Date());
    
    foodsToCopy.forEach((food, index) => {
        const newEntry = { ...food };
        newEntry.id = 'food_' + Date.now() + '_' + index; // Ensure unique ID
        newEntry.date = todayStr;
        newEntry.timestamp = new Date().toISOString();
        userData.food_diary.push(newEntry);
    });
    
    await window.BodyProDataStore.saveData(userData);
    alert(`Successfully duplicated ${foodsToCopy.length} items to today's ${sourceMeal}.`);
});

function getLocalISODate(dateObj) {
    const offset = dateObj.getTimezoneOffset() * 60000;
    return (new Date(dateObj - offset)).toISOString().split('T')[0];
}
