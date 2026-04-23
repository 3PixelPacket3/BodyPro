// analytics.js - BodyPro Analytics & Visualization Logic

import { auth } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- PROGRESSIVE WEB APP REGISTRATION ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('[BodyPro System] SW Analytics Handshake Successful'))
            .catch(err => console.error('[BodyPro System] SW Analytics Registration Failed', err));
    });
}

// --- DOM Elements ---
// Selectors
const weightRangeSelect = document.getElementById('weightRangeSelect');
const macroRangeSelect = document.getElementById('macroRangeSelect');
const sleepRangeSelect = document.getElementById('sleepRangeSelect');
const liftSelect = document.getElementById('liftSelect');
const volumeRangeSelect = document.getElementById('volumeRangeSelect');

// Weight Stats
const valCurrentWeight = document.getElementById('valCurrentWeight');
const valAvgWeight = document.getElementById('valAvgWeight');
const valNetWeight = document.getElementById('valNetWeight');

// History & Modals
const activityHistoryList = document.getElementById('activityHistoryList');
const activityDetailModal = document.getElementById('activityDetailModal');
const actDetailTitle = document.getElementById('actDetailTitle');
const actDetailDate = document.getElementById('actDetailDate');
const actDetailDuration = document.getElementById('actDetailDuration');
const actDetailCals = document.getElementById('actDetailCals');
const actDetailSets = document.getElementById('actDetailSets');
const btnDeleteActivity = document.getElementById('btnDeleteActivity');

// Calendar DOM
const calendarGrid = document.getElementById('calendarGrid');
const calendarMonthLabel = document.getElementById('calendarMonthLabel');
const btnPrevMonth = document.getElementById('btnPrevMonth');
const btnNextMonth = document.getElementById('btnNextMonth');

// Chart Contexts
const ctxWeight = document.getElementById('weightChart').getContext('2d');
const ctx1RM = document.getElementById('oneRMChart').getContext('2d');
const ctxVolume = document.getElementById('volumeChart').getContext('2d');
const ctxMacro = document.getElementById('macroChart').getContext('2d');
const ctxMacroDist = document.getElementById('macroDistChart').getContext('2d');
const ctxSleep = document.getElementById('sleepChart').getContext('2d');
const ctxHydration = document.getElementById('hydrationChart').getContext('2d');

// --- STATE MANAGEMENT ---
let userData = null;
let chartWeightInstance = null;
let chart1RMInstance = null;
let chartVolumeInstance = null;
let chartMacroInstance = null;
let chartMacroDistInstance = null;
let chartSleepInstance = null;
let chartHydrationInstance = null;

let currentViewActivityId = null;

let currentCalendarDate = new Date();
currentCalendarDate.setDate(1); // Lock to 1st of month to avoid overflow

// --- THE SECURITY GUARD ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }
    userData = await window.BodyProDataStore.getData();
    
    // Set global chart defaults to match our dark theme
    Chart.defaults.color = '#a1a1aa'; // var(--text-muted)
    Chart.defaults.font.family = '"Inter", system-ui, -apple-system, sans-serif';
    
    renderAnalytics();
});

// --- HELPER FUNCTIONS ---
function getPastDates(days) {
    const dates = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const offset = d.getTimezoneOffset() * 60000;
        dates.push((new Date(d - offset)).toISOString().split('T')[0]);
    }
    return dates;
}

function calculateMovingAverage(data, windowSize) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        if (i < windowSize - 1) {
            result.push(null);
            continue;
        }
        let sum = 0;
        let count = 0;
        for (let j = 0; j < windowSize; j++) {
            if (data[i - j] !== null && data[i - j] !== undefined) {
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
    update1RMChart();
    updateVolumeChart();
    updateMacroCharts();
    updateSleepChart();
    updateHydrationChart();
    renderActivityHistory();
    renderCalendar();
}

// --- CALENDAR ENGINE ---

btnPrevMonth.addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    renderCalendar();
});

btnNextMonth.addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    renderCalendar();
});

function renderCalendar() {
    if (!calendarGrid) return;
    
    calendarGrid.innerHTML = '';
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    calendarMonthLabel.innerText = `${monthNames[month]} ${year}`;
    
    const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    days.forEach(d => {
        const el = document.createElement('div');
        el.className = 'cal-header';
        el.innerText = d;
        calendarGrid.appendChild(el);
    });
    
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Empty prefix cells
    for (let i = 0; i < firstDayIndex; i++) {
        const el = document.createElement('div');
        el.className = 'cal-day empty';
        calendarGrid.appendChild(el);
    }
    
    // Populate Days
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        
        const hasWorkout = (userData.workouts || []).some(w => w.date === dateStr || (w.timestamp && w.timestamp.startsWith(dateStr)));
        const hasFood = (userData.food_diary || []).some(f => f.date === dateStr);
        const hasSleep = (userData.sleep_data || []).some(s => s.date === dateStr);
        const hasVitals = (userData.biometrics || []).some(b => b.date === dateStr && (b.steps > 0 || (b.waterOz || b.water) > 0 || b.restingHR > 0));
        
        const el = document.createElement('div');
        el.className = 'cal-day';
        el.onclick = () => window.viewDaySummary(dateStr);
        
        let html = `<div>${d}</div><div class="cal-indicators">`;
        if (hasWorkout) html += `<div class="cal-dot dot-workout"></div>`;
        if (hasFood) html += `<div class="cal-dot dot-food"></div>`;
        if (hasSleep) html += `<div class="cal-dot dot-sleep"></div>`;
        if (hasVitals) html += `<div class="cal-dot dot-vitals"></div>`;
        html += `</div>`;
        
        el.innerHTML = html;
        calendarGrid.appendChild(el);
    }
}

// Master Record Compiler
window.viewDaySummary = function(dateStr) {
    const dsDateLabel = document.getElementById('dsDateLabel');
    const dsContent = document.getElementById('dsContent');
    
    const dObj = new Date(dateStr + "T12:00:00");
    dsDateLabel.innerText = dObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    dsContent.innerHTML = '';
    let hasAnyData = false;

    // 1. Fitness Telemetry
    const workouts = (userData.workouts || []).filter(w => w.date === dateStr || (w.timestamp && w.timestamp.startsWith(dateStr)));
    if (workouts.length > 0) {
        hasAnyData = true;
        let wHtml = `<div class="summary-card"><h4 class="text-primary"><i class="fa-solid fa-dumbbell"></i> Fitness & Training</h4>`;
        workouts.forEach(wk => {
            const cals = wk.telemetry?.activeCals || 0;
            const dur = Math.round(((wk.durationLift || 0) + (wk.durationCardio || 0)) / 60);
            wHtml += `<div style="margin-bottom: 5px;"><strong>${wk.title || 'Session'}</strong>: ${dur} mins | ${cals} kcal | ${(wk.sets || []).length} sets</div>`;
        });
        wHtml += `</div>`;
        dsContent.innerHTML += wHtml;
    }

    // 2. Nutrition Intake
    const foods = (userData.food_diary || []).filter(f => f.date === dateStr);
    if (foods.length > 0) {
        hasAnyData = true;
        let cals=0, p=0, c=0, f=0;
        foods.forEach(food => {
            cals += Number(food.calories || 0); p += Number(food.protein || 0); c += Number(food.carbs || 0); f += Number(food.fats || 0);
        });
        dsContent.innerHTML += `
            <div class="summary-card">
                <h4 class="text-accent"><i class="fa-solid fa-utensils"></i> Nutrition Intake</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 0.85rem;">
                    <div>Calories: <strong>${Math.round(cals)}</strong></div>
                    <div>Protein: <strong>${Math.round(p)}g</strong></div>
                    <div>Carbs: <strong>${Math.round(c)}g</strong></div>
                    <div>Fats: <strong>${Math.round(f)}g</strong></div>
                </div>
            </div>
        `;
    }

    // 3. Sleep Telemetry
    const sleepData = (userData.sleep_data || []).find(s => s.date === dateStr);
    if (sleepData) {
        hasAnyData = true;
        dsContent.innerHTML += `
            <div class="summary-card">
                <h4 class="text-warning"><i class="fa-solid fa-bed"></i> Sleep Telemetry</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 0.85rem;">
                    <div>Duration: <strong>${sleepData.durationHrs || 0}h</strong></div>
                    <div>Score: <strong>${sleepData.score || '--'} / 100</strong></div>
                    <div>Deep: <strong>${sleepData.deepHrs || '--'}h</strong></div>
                    <div>REM: <strong>${sleepData.remHrs || '--'}h</strong></div>
                </div>
            </div>
        `;
    }

    // 4. Daily Vitals
    const vitals = (userData.biometrics || []).find(b => b.date === dateStr);
    if (vitals && (vitals.steps || vitals.restingHR || vitals.water || vitals.waterOz)) {
        hasAnyData = true;
        const water = vitals.waterOz || vitals.water || 0;
        dsContent.innerHTML += `
            <div class="summary-card">
                <h4 class="text-danger"><i class="fa-solid fa-heart-pulse"></i> Vitals & Activity</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 0.85rem;">
                    <div>Steps: <strong>${(vitals.steps || 0).toLocaleString()}</strong></div>
                    <div>Water: <strong>${water} fl oz</strong></div>
                    <div>Resting HR: <strong>${vitals.restingHR || '--'} bpm</strong></div>
                    <div>Floors: <strong>${vitals.floors || 0}</strong></div>
                </div>
            </div>
        `;
    }

    if (!hasAnyData) {
        dsContent.innerHTML = `<div class="text-muted" style="text-align:center; padding: 20px; font-style: italic;">No telemetry recorded on this date.</div>`;
    }

    document.getElementById('daySummaryModal').classList.add('active');
};

// 1. Body Mass Tracking
function updateWeightChart() {
    const days = parseInt(weightRangeSelect.value) || 30;
    const dateLabels = getPastDates(days);
    const weightData = [];
    
    dateLabels.forEach(date => {
        const entry = (userData.biometrics || []).find(b => b.date === date && b.weight);
        weightData.push(entry ? parseFloat(entry.weight) : null);
    });

    let lastValid = weightData.find(w => w !== null) || 0;
    const filledWeightData = weightData.map(w => {
        if (w !== null) {
            lastValid = w;
            return w;
        }
        return lastValid === 0 ? null : lastValid;
    });

    const movingAvg = calculateMovingAverage(filledWeightData, 7);

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

    chartWeightInstance = new Chart(ctxWeight, {
        type: 'line',
        data: {
            labels: dateLabels.map(d => d.substring(5)),
            datasets: [
                {
                    label: 'Daily Weight (lbs)',
                    data: filledWeightData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    pointRadius: 3,
                    fill: true,
                    tension: 0.2
                },
                {
                    label: '7-Day Trend',
                    data: movingAvg,
                    borderColor: '#10b981',
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

// 2. 1RM Projection Chart (Epley Formula Data)
function update1RMChart() {
    const selectedLift = liftSelect.value;
    const days = 30; // Hardcode to 30 days for trending
    const dateLabels = getPastDates(days);
    const ormData = [];

    dateLabels.forEach(date => {
        // Find workouts on this local date
        const dayWorkouts = (userData.workouts || []).filter(w => {
            const localD = new Date(w.timestamp);
            const offset = localD.getTimezoneOffset() * 60000;
            return (new Date(localD - offset)).toISOString().split('T')[0] === date;
        });

        let max1RM = null;
        dayWorkouts.forEach(wk => {
            (wk.sets || []).forEach(set => {
                if (set.exercise === selectedLift && set.est1RM) {
                    if (max1RM === null || set.est1RM > max1RM) {
                        max1RM = set.est1RM;
                    }
                }
            });
        });

        ormData.push(max1RM);
    });

    if (chart1RMInstance) chart1RMInstance.destroy();

    chart1RMInstance = new Chart(ctx1RM, {
        type: 'line',
        data: {
            labels: dateLabels.map(d => d.substring(5)),
            datasets: [{
                label: `Estimated 1RM (lbs)`,
                data: ormData,
                borderColor: '#ef4444', 
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderWidth: 3,
                pointRadius: 5,
                pointBackgroundColor: '#ef4444',
                spanGaps: true,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } }
        }
    });
}

// 3. Volume Load (Tonnage)
function updateVolumeChart() {
    const days = parseInt(volumeRangeSelect.value) || 14;
    const dateLabels = getPastDates(days);
    const volumeData = [];

    dateLabels.forEach(date => {
        let dailyVolume = 0;
        const dayWorkouts = (userData.workouts || []).filter(w => {
            const localD = new Date(w.timestamp);
            const offset = localD.getTimezoneOffset() * 60000;
            return (new Date(localD - offset)).toISOString().split('T')[0] === date;
        });

        dayWorkouts.forEach(wk => {
            (wk.sets || []).forEach(set => {
                if (set.volume) dailyVolume += set.volume;
            });
        });

        volumeData.push(dailyVolume);
    });

    if (chartVolumeInstance) chartVolumeInstance.destroy();

    chartVolumeInstance = new Chart(ctxVolume, {
        type: 'bar',
        data: {
            labels: dateLabels.map(d => d.substring(5)),
            datasets: [{
                label: 'Total Tonnage (lbs)',
                data: volumeData,
                backgroundColor: '#10b981', 
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// 4. Macro Adherence & Distribution
function updateMacroCharts() {
    const days = parseInt(macroRangeSelect.value) || 7;
    const dateLabels = getPastDates(days);
    
    const targetCals = userData.settings?.macroTargets?.calories || 2200;
    const dailyCalsData = [];
    
    let totalProt = 0, totalCarb = 0, totalFat = 0;
    
    dateLabels.forEach(date => {
        const daysFoods = (userData.food_diary || []).filter(f => f.date === date);
        let dayCals = 0;
        daysFoods.forEach(food => {
            dayCals += (Number(food.calories) || 0);
            totalProt += (Number(food.protein) || 0);
            totalCarb += (Number(food.carbs) || 0);
            totalFat += (Number(food.fats) || 0);
        });
        dailyCalsData.push(dayCals);
    });

    if (chartMacroInstance) chartMacroInstance.destroy();
    chartMacroInstance = new Chart(ctxMacro, {
        type: 'bar',
        data: {
            labels: dateLabels.map(d => d.substring(5)),
            datasets: [{
                label: 'Calories Consumed',
                data: dailyCalsData,
                backgroundColor: dailyCalsData.map(c => c > targetCals ? '#ef4444' : '#10b981'),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });

    if (chartMacroDistInstance) chartMacroDistInstance.destroy();
    if (totalProt === 0 && totalCarb === 0 && totalFat === 0) {
        totalProt = 1; totalCarb = 1; totalFat = 1;
    }

    chartMacroDistInstance = new Chart(ctxMacroDist, {
        type: 'doughnut',
        data: {
            labels: ['Protein', 'Carbs', 'Fats'],
            datasets: [{
                data: [totalProt, totalCarb, totalFat],
                backgroundColor: ['#3b82f6', '#f59e0b', '#ef4444'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'right' }
            }
        }
    });
}

// 5. Sleep Statistics
function updateSleepChart() {
    const days = parseInt(sleepRangeSelect.value) || 7;
    const dateLabels = getPastDates(days);
    const sleepScores = [];

    dateLabels.forEach(date => {
        const sleepData = (userData.sleep_data || []).find(s => s.date === date);
        sleepScores.push(sleepData && sleepData.score ? sleepData.score : null);
    });

    if (chartSleepInstance) chartSleepInstance.destroy();

    chartSleepInstance = new Chart(ctxSleep, {
        type: 'line',
        data: {
            labels: dateLabels.map(d => d.substring(5)),
            datasets: [{
                label: 'Restfulness Score',
                data: sleepScores,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                borderWidth: 3,
                pointRadius: 4,
                spanGaps: true,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { min: 0, max: 100 } }
        }
    });
}

// 6. Hydration Consistency
function updateHydrationChart() {
    const dateLabels = getPastDates(7);
    const hydrationData = [];

    dateLabels.forEach(date => {
        const bio = (userData.biometrics || []).find(b => b.date === date);
        hydrationData.push(bio && (bio.waterOz || bio.water) ? (bio.waterOz || bio.water) : 0);
    });

    if (chartHydrationInstance) chartHydrationInstance.destroy();

    chartHydrationInstance = new Chart(ctxHydration, {
        type: 'bar',
        data: {
            labels: dateLabels.map(d => d.substring(5)),
            datasets: [{
                label: 'Water (fl oz)',
                data: hydrationData,
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// 7. Activity History List
function renderActivityHistory() {
    activityHistoryList.innerHTML = '';
    const workouts = [...(userData.workouts || [])].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 15);

    if (workouts.length === 0) {
        activityHistoryList.innerHTML = '<p class="text-muted" style="text-align: center; padding: 20px; font-size: 0.9rem;">No recent activities logged.</p>';
        return;
    }

    workouts.forEach(wk => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.onclick = () => window.viewActivity(wk.id);
        
        const totalDuration = Math.round((wk.durationLift + wk.durationCardio) / 60);
        const dateStr = new Date(wk.timestamp).toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
        
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <div class="history-icon">
                    <i class="fa-solid fa-dumbbell text-primary"></i>
                </div>
                <div class="history-details">
                    <h4>${wk.title || 'Untitled Session'}</h4>
                    <p>${dateStr}</p>
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

window.viewActivity = function(id) {
    const wk = userData.workouts.find(w => w.id === id);
    if (!wk) return;

    currentViewActivityId = id;
    
    actDetailTitle.innerText = wk.title || 'Untitled Session';
    actDetailDate.innerText = new Date(wk.timestamp).toLocaleDateString('en-US', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
    
    const totalDuration = Math.round((wk.durationLift + wk.durationCardio) / 60);
    actDetailDuration.innerText = `${totalDuration} mins`;
    actDetailCals.innerText = wk.telemetry?.activeCals || 0;

    actDetailSets.innerHTML = '';

    if (wk.sets && wk.sets.length > 0) {
        wk.sets.forEach((s, idx) => {
            actDetailSets.innerHTML += `
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; ${idx === wk.sets.length - 1 ? 'border:none;' : ''}">
                    <div style="font-weight: 600;">${s.exercise}</div>
                    <div class="text-muted">${s.weight} lbs</div>
                    <div class="text-muted">${s.reps} reps</div>
                    <div class="text-muted">1RM: ${s.est1RM || 0}</div>
                </div>
            `;
        });
    } else {
        actDetailSets.innerHTML = '<div class="text-muted" style="font-size: 0.85rem; padding: 10px 0; text-align:center;">No movement data recorded. Telemetry only.</div>';
    }

    activityDetailModal.classList.add('active');
};

btnDeleteActivity.addEventListener('click', async () => {
    if (!currentViewActivityId) return;
    
    if(confirm("Permanently delete this session? This will recalculate your historical data.")) {
        userData.workouts = userData.workouts.filter(w => w.id !== currentViewActivityId);
        await window.BodyProDataStore.saveData(userData);
        activityDetailModal.classList.remove('active');
        renderAnalytics();
    }
});

// --- EVENT LISTENERS ---
weightRangeSelect.addEventListener('change', updateWeightChart);
macroRangeSelect.addEventListener('change', updateMacroCharts);
if(sleepRangeSelect) sleepRangeSelect.addEventListener('change', updateSleepChart);
liftSelect.addEventListener('change', update1RMChart);
volumeRangeSelect.addEventListener('change', updateVolumeChart);
