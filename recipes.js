// recipes.js - BodyPro Culinary Builder & Meal Management

import { auth } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- DOM Elements: Meal Copier ---
const copySourceDate = document.getElementById('copySourceDate');
const copySourceMeal = document.getElementById('copySourceMeal');
const btnExecuteCopy = document.getElementById('btnExecuteCopy');

// --- DOM Elements: Recipe Builder ---
const recipeName = document.getElementById('recipeName');
const recipeServings = document.getElementById('recipeServings');
const activeIngredientList = document.getElementById('activeIngredientList');
const emptyIngredientMsg = document.getElementById('emptyIngredientMsg');
const btnClearRecipe = document.getElementById('btnClearRecipe');
const btnSaveRecipe = document.getElementById('btnSaveRecipe');

// Macros
const recCals = document.getElementById('recCals');
const recProt = document.getElementById('recProt');
const recCarb = document.getElementById('recCarb');
const recFat = document.getElementById('recFat');

// Modals
const ingName = document.getElementById('ingName');
const ingCals = document.getElementById('ingCals');
const ingProt = document.getElementById('ingProt');
const ingCarb = document.getElementById('ingCarb');
const ingFat = document.getElementById('ingFat');
const btnAddIngredientToRecipe = document.getElementById('btnAddIngredientToRecipe');

// Vault
const savedRecipesList = document.getElementById('savedRecipesList');

// --- STATE MANAGEMENT ---
let userData = null;
let currentBatch = [];
let html5QrCode = null;

// --- THE SECURITY GUARD ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }
    userData = await window.BodyProDataStore.getData();
    renderSavedRecipes();
});

// --- HELPER: Formatting Dates ---
function getLocalISODate(dateObj) {
    const offset = dateObj.getTimezoneOffset() * 60000;
    return (new Date(dateObj - offset)).toISOString().split('T')[0];
}

// --- MODULE 1: MEAL COPIER ---
btnExecuteCopy.addEventListener('click', async () => {
    const sourceDate = copySourceDate.value;
    const sourceMeal = copySourceMeal.value;
    const todayStr = getLocalISODate(new Date());

    if (!sourceDate) return alert("Please select a valid source date.");

    const sourceFoods = (userData.food_diary || []).filter(f => f.date === sourceDate && f.meal === sourceMeal);

    if (sourceFoods.length === 0) {
        alert(`No foods found for ${sourceMeal} on ${sourceDate}.`);
        return;
    }

    btnExecuteCopy.disabled = true;
    btnExecuteCopy.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Duplicating...';

    sourceFoods.forEach(food => {
        userData.food_diary.push({
            id: 'food_' + Date.now() + Math.random().toString(36).substr(2, 5),
            date: todayStr,
            meal: sourceMeal,
            name: food.name,
            calories: Number(food.calories),
            protein: Number(food.protein),
            carbs: Number(food.carbs),
            fats: Number(food.fats),
            timestamp: new Date().toISOString()
        });
    });

    const success = await window.BodyProDataStore.saveData(userData);
    
    if (success) {
        btnExecuteCopy.innerHTML = '<i class="fa-solid fa-check"></i> Meal Duplicated';
        setTimeout(() => {
            btnExecuteCopy.disabled = false;
            btnExecuteCopy.innerHTML = '<i class="fa-solid fa-clone"></i> Duplicate to Today';
        }, 2000);
    } else {
        alert("System Error: Failed to synchronize copied meal.");
        btnExecuteCopy.disabled = false;
    }
});

// --- MODULE 2: OPTICAL SCANNER FOR INGREDIENTS ---
window.openScannerFromRecipe = function() {
    document.getElementById('scannerModal').classList.add('active');
    
    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }
    
    const config = { fps: 10, qrbox: { width: 250, height: 200 } };
    
    html5QrCode.start({ facingMode: "environment" }, config, onRecipeScanSuccess)
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

async function onRecipeScanSuccess(decodedText, decodedResult) {
    if (html5QrCode && html5QrCode.isScanning) {
        await html5QrCode.stop();
    }
    document.getElementById('scannerModal').classList.remove('active');
    
    // Set loading state in ingredient modal
    ingName.value = "Querying Database...";
    
    try {
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${decodedText}.json`);
        const data = await response.json();
        
        if (data.status === 1 && data.product) {
            const p = data.product;
            const nut = p.nutriments || {};
            
            const cals = nut['energy-kcal_serving'] || nut['energy-kcal_100g'] || nut['energy-kcal'] || 0;
            const prot = nut['proteins_serving'] || nut['proteins_100g'] || nut['proteins'] || 0;
            const carb = nut['carbohydrates_serving'] || nut['carbohydrates_100g'] || nut['carbohydrates'] || 0;
            const fat = nut['fat_serving'] || nut['fat_100g'] || nut['fat'] || 0;
            
            ingName.value = p.product_name || "Unknown Product";
            ingCals.value = Math.round(cals);
            ingProt.value = Math.round(prot);
            ingCarb.value = Math.round(carb);
            ingFat.value = Math.round(fat);
        } else {
            alert("Telemetry negative. Product not found in OpenFoodFacts database. Manual entry required.");
            ingName.value = "";
        }
    } catch (err) {
        console.error("API Error:", err);
        alert("Network failure. Unable to retrieve nutritional telemetry.");
        ingName.value = "";
    }
}


// --- MODULE 3: RECIPE BUILDER ---
function updateBatchUI() {
    activeIngredientList.innerHTML = '';
    let totalCals = 0, totalProt = 0, totalCarb = 0, totalFat = 0;

    if (currentBatch.length === 0) {
        activeIngredientList.appendChild(emptyIngredientMsg);
        emptyIngredientMsg.style.display = 'block';
    } else {
        emptyIngredientMsg.style.display = 'none';
        
        currentBatch.forEach((ing, index) => {
            totalCals += Number(ing.calories);
            totalProt += Number(ing.protein);
            totalCarb += Number(ing.carbs);
            totalFat += Number(ing.fats);

            const item = document.createElement('div');
            item.className = 'ingredient-item';
            item.innerHTML = `
                <div class="ingredient-details">
                    <h4>${ing.name}</h4>
                    <div class="ingredient-macros">
                        <span>${ing.calories} kcal</span>
                        <span class="text-primary">${ing.protein}g P</span>
                        <span class="text-warning">${ing.carbs}g C</span>
                        <span class="text-danger">${ing.fats}g F</span>
                    </div>
                </div>
                <button class="btn btn-ghost" style="padding: 5px 10px; border: none; color: var(--danger);" onclick="removeIngredient(${index})">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            `;
            activeIngredientList.appendChild(item);
        });
    }

    // Calculate Per-Serving Macros
    const servings = Math.max(Number(recipeServings.value) || 1, 1);
    recCals.innerText = Math.round(totalCals / servings);
    recProt.innerText = `${Math.round(totalProt / servings)}g`;
    recCarb.innerText = `${Math.round(totalCarb / servings)}g`;
    recFat.innerText = `${Math.round(totalFat / servings)}g`;
}

// Attach globally for inline onclick execution
window.removeIngredient = function(index) {
    currentBatch.splice(index, 1);
    updateBatchUI();
};

recipeServings.addEventListener('input', updateBatchUI);

btnAddIngredientToRecipe.addEventListener('click', () => {
    const name = ingName.value.trim() || "Unnamed Ingredient";
    
    currentBatch.push({
        name: name,
        calories: Number(ingCals.value) || 0,
        protein: Number(ingProt.value) || 0,
        carbs: Number(ingCarb.value) || 0,
        fats: Number(ingFat.value) || 0
    });

    updateBatchUI();
    document.getElementById('ingredientModal').classList.remove('active');
    
    // Clear modal fields
    ingName.value = '';
    ingCals.value = 0;
    ingProt.value = 0;
    ingCarb.value = 0;
    ingFat.value = 0;
});

btnClearRecipe.addEventListener('click', () => {
    if(confirm("Clear current recipe build?")) {
        currentBatch = [];
        recipeName.value = '';
        recipeServings.value = 1;
        updateBatchUI();
    }
});

btnSaveRecipe.addEventListener('click', async () => {
    if (currentBatch.length === 0) return alert("Please add ingredients to save a recipe.");
    const name = recipeName.value.trim() || "Custom Recipe";
    const servings = Math.max(Number(recipeServings.value) || 1, 1);

    btnSaveRecipe.disabled = true;
    btnSaveRecipe.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    let totalCals = 0, totalProt = 0, totalCarb = 0, totalFat = 0;
    currentBatch.forEach(ing => {
        totalCals += Number(ing.calories);
        totalProt += Number(ing.protein);
        totalCarb += Number(ing.carbs);
        totalFat += Number(ing.fats);
    });

    const newRecipe = {
        id: 'rec_' + Date.now(),
        name: name,
        servings: servings,
        macrosPerServing: {
            calories: Math.round(totalCals / servings),
            protein: Math.round(totalProt / servings),
            carbs: Math.round(totalCarb / servings),
            fats: Math.round(totalFat / servings)
        },
        ingredients: currentBatch,
        authorId: auth.currentUser.uid,
        timestamp: new Date().toISOString()
    };

    userData.custom_recipes = userData.custom_recipes || [];
    userData.custom_recipes.push(newRecipe);
    const success = await window.BodyProDataStore.saveData(userData);

    if (success) {
        currentBatch = [];
        recipeName.value = '';
        recipeServings.value = 1;
        updateBatchUI();
        renderSavedRecipes();
        btnSaveRecipe.innerHTML = '<i class="fa-solid fa-check"></i> Saved';
        setTimeout(() => {
            btnSaveRecipe.disabled = false;
            btnSaveRecipe.innerHTML = '<i class="fa-solid fa-save"></i> Save Recipe';
        }, 2000);
    } else {
        alert("System Error: Failed to save recipe to vault.");
        btnSaveRecipe.disabled = false;
        btnSaveRecipe.innerHTML = '<i class="fa-solid fa-save"></i> Save Recipe';
    }
});

// --- MODULE 4: SAVED RECIPES VAULT ---
function renderSavedRecipes() {
    savedRecipesList.innerHTML = '';
    const recipes = userData.custom_recipes || [];

    if (recipes.length === 0) {
        savedRecipesList.innerHTML = '<p class="text-muted" style="text-align: center; font-size: 0.9rem;">Your vault is empty. Build a recipe above.</p>';
        return;
    }

    recipes.forEach(rec => {
        const item = document.createElement('div');
        item.className = 'saved-recipe-item';
        item.innerHTML = `
            <div>
                <h4 style="margin: 0 0 5px 0;">${rec.name}</h4>
                <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted);">
                    ${rec.macrosPerServing.calories} kcal | 
                    <span class="text-primary">${rec.macrosPerServing.protein}g P</span> | 
                    <span class="text-warning">${rec.macrosPerServing.carbs}g C</span> | 
                    <span class="text-danger">${rec.macrosPerServing.fats}g F</span>
                    (per serving)
                </p>
            </div>
            <button class="btn btn-ghost" style="padding: 8px 12px; border-color: transparent; color: var(--danger);" onclick="deleteRecipe('${rec.id}')">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
        savedRecipesList.appendChild(item);
    });
}

// Make deletion accessible
window.deleteRecipe = async function(id) {
    if(confirm("Permanently delete this recipe?")) {
        userData.custom_recipes = userData.custom_recipes.filter(r => r.id !== id);
        renderSavedRecipes(); 
        await window.BodyProDataStore.saveData(userData);
    }
};
