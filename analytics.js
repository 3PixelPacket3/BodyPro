// analytics.js - BodyPro Analytics & Visualization Logic

import { auth } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- DOM Elements ---
const weightRangeSelect = document.getElementById('weightRangeSelect');
const valCurrentWeight = document.getElementById('valCurrentWeight');
const valAvgWeight = document.getElementById('valAvgWeight');
const valNetWeight = document.getElementById('valNetWeight');
const macroRangeSelect = document.getElementById('macroRangeSelect');
const activityHistoryList = document.getElementById('activityHistoryList');

// Chart Contexts
const ctxWeight = document.getElementById('weightChart').getContext('2d');
const ctxMacro = document.getElementById('macroChart').getContext('2d');
const ctxSleep = document.getElementById('sleepChart').getContext('2d');

// --- STATE MANAGEMENT ---
let userData = null;
let chartWeightInstance = null;
let chartMacroInstance = null;
let chartSleepInstance = null;

// --- THE SECURITY GUARD ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }
    userData = await window.BodyProDataStore.getData();
    renderAnalytics();
});

// --- HELPER FUNCTIONS ---
function getPastDates(days) {
    const dates = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toLocaleDateString('en-CA')); // YYYY-MM-DD
    }
    return dates;
}

function calculateMovingAverage(data, windowSize) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        if (i < windowSize - 1) {
            result.push(null); // Not enough data for average
            continue;
        }
        let sum = 0;
        let count = 0;
        for (let j = 0; j < windowSize; j++) {
            if (data[i - j] !== null) {
                sum += data[i - j];
                count++;
            }
        }
        result.push(count > 0 ? (sum / count).toFixed(1) : null);
    }
    return result;
}

// --- VISUALIZATION PROTOCOLS ---

function renderAnalytics() {
    updateWeightChart();
    updateMacroChart();
    updateSleepChart();
    renderActivityHistory();
}

// 1. Body Mass Tracking (Weight)
function updateWeightChart() {
    const days = parseInt(weightRangeSelect.value) || 30;
    const dateLabels = getPastDates(days);
    const weightData = [];
    
    // Extract weights for the date range
    dateLabels.forEach(date => {
        const entry = (userData.biometrics || []).find(b => b.date === date && b.weight);
        weightData.push(entry ? parseFloat(entry.weight) : null);
    });

    // Backfill nulls for continuous lines (simplified linear interpolation for charting)
    let lastValid = weightData.find(w => w !== null) || 0;
    const filledWeightData = weightData.map(w => {
        if (w !== null) {
            lastValid = w;
            return w;
        }
        return lastValid === 0 ? null : lastValid;
    });

    const movingAvg = calculateMovingAverage(filledWeightData, 7);

    // Update Summary Stats
    const currentWeight = filledWeightData[filledWeightData.length - 1];
    const firstWeight = filledWeightData.find(w => w !== null);
    const recentAvg = movingAvg[movingAvg.length - 1];
    
    valCurrentWeight.innerText = currentWeight ? `${currentWeight} lbs` : '-- lbs';
    valAvgWeight.innerText = recentAvg ? `${recentAvg} lbs` : '-- lbs';
    
    if (currentWeight && firstWeight) {
        const net = (currentWeight - firstWeight).toFixed(1);
        valNetWeight.innerText = `${net > 0 ? '+' : ''}${net} lbs`;
        valNetWeight.style.color = net > 0 ? 'var(--danger)' : 'var(--accent)';
    }

    if (chartWeightInstance) chartWeightInstance.destroy();

    Chart.defaults.color = '#a1a1aa'; // var(--text-muted)
    Chart.defaults.font.family = '"Inter", sans-serif';

    chartWeightInstance = new Chart(ctxWeight, {
        type: 'line',
        data: {
            labels: dateLabels.map(d => d.substring(5)), // MM-DD
            datasets: [
                {
                    label: 'Daily Weight (lbs)',
                    data: filledWeightData,
                    borderColor: '#3b82f6', // primary
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    pointRadius: 3,
                    fill: true,
                    tension: 0.2
                },
                {
                    label: '7-Day Trend',
                    data: movingAvg,
                    borderColor: '#10b981', // accent
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'top' } },
            scales: {
                y: { min: Math.min(...filledWeightData.filter(w => w)) - 5 }
            }
        }
    });
}

// 2. Macro Adherence
function updateMacroChart() {
    const days = parseInt(macroRangeSelect.value) || 7;
    const dateLabels = getPastDates(days);
    
    const targetCals = userData.settings.macroTargets.calories || 2200;
    const dailyCalsData = [];
    
    dateLabels.forEach(date => {
        const daysFoods = (userData.food_diary || []).filter(f => f.date === date);
        const totalCals = daysFoods.reduce((sum, food) => sum + (Number(food.calories) || 0), 0);
        dailyCalsData.push(totalCals);
    });

    if (chartMacroInstance) chartMacroInstance.destroy();

    chartMacroInstance = new Chart(ctxMacro, {
        type: 'bar',
        data: {
            labels: dateLabels.map(d => d.substring(5)),
            datasets: [
                {
                    label: 'Calories Consumed',
                    data: dailyCalsData,
                    backgroundColor: dailyCalsData.map(c => c > targetCals ? '#ef4444' : '#10b981'), // danger vs accent
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                annotation: {
                    annotations: {
                        line1: {
                            type: 'line',
                            yMin: targetCals,
                            yMax: targetCals,
                            borderColor: '#f59e0b',
                            borderWidth: 2,
                            borderDash: [4, 4],
                            label: { content: 'Target', display: true, position: 'end' }
                        }
                    }
                }
            }
        }
    });
}

// 3. Sleep Statistics (Simulated smartwatch sync)
function updateSleepChart() {
    const dateLabels = getPastDates(7);
    const sleepScores = [];

    dateLabels.forEach(date => {
        const sleepData = (userData.sleep_data || []).find(s => s.date === date);
        sleepScores.push(sleepData ? sleepData.score : Math.floor(Math.random() * (95 - 70) + 70)); // Random fallback for display if no data
    });

    if (chartSleepInstance) chartSleepInstance.destroy();

    chartSleepInstance = new Chart(ctxSleep, {
        type: 'line',
        data: {
            labels: dateLabels.map(d => d.substring(5)),
            datasets: [{
                label: 'Sleep Score',
                data: sleepScores,
                borderColor: '#f59e0b', // warning
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                borderWidth: 3,
                pointRadius: 4,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { min: 50, max: 100 } }
        }
    });
}

// 4. Activity History List
function renderActivityHistory() {
    activityHistoryList.innerHTML = '';
    const workouts = [...(userData.workouts || [])].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);

    if (workouts.length === 0) {
        activityHistoryList.innerHTML = '<p class="text-muted" style="text-align: center; padding: 20px; font-size: 0.9rem;">No recent activities logged.</p>';
        return;
    }

    workouts.forEach(wk => {
        const item = document.createElement('div');
        item.className = 'history-item';
        
        const totalDuration = Math.round((wk.durationLift + wk.durationCardio) / 60);
        
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <div class="history-icon">
                    <i class="fa-solid fa-dumbbell text-primary"></i>
                </div>
                <div class="history-details">
                    <h4>${wk.title}</h4>
                    <p>${new Date(wk.timestamp).toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'})}</p>
                </div>
            </div>
            <div class="history-meta text-muted">
                ${totalDuration} mins<br>
                <span class="text-accent"><i class="fa-solid fa-bolt"></i> ${wk.telemetry?.activeCals || 0} kcal</span>
            </div>
        `;
        activityHistoryList.appendChild(item);
    });
}

// --- EVENT LISTENERS ---
weightRangeSelect.addEventListener('change', updateWeightChart);
macroRangeSelect.addEventListener('change', updateMacroChart);
