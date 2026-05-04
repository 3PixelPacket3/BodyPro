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
const compRangeSelect = document.getElementById('compRangeSelect');
const bpRangeSelect = document.getElementById('bpRangeSelect');
const liftSelect = document.getElementById('liftSelect');
const volumeRangeSelect = document.getElementById('volumeRangeSelect');
const macroRangeSelect = document.getElementById('macroRangeSelect');

// Weight Stats
const valCurrentWeight = document.getElementById('valCurrentWeight');
const valAvgWeight = document.getElementById('valAvgWeight');
const valNetWeight = document.getElementById('valNetWeight');

// Body Comp Stats
const valBodyFat = document.getElementById('valBodyFat');
const valLeanMass = document.getElementById('valLeanMass');
const valFatMass = document.getElementById('valFatMass');

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
const calendarToggleBtn = document.getElementById('calendarToggleBtn');
const calendarCollapseBody = document.getElementById('calendarCollapseBody');
const calendarChevron = document.getElementById('calendarChevron');
const calendarGrid = document.getElementById('calendarGrid');
const calendarMonthLabel = document.getElementById('calendarMonthLabel');
const btnPrevMonth = document.getElementById('btnPrevMonth');
const btnNextMonth = document.getElementById('btnNextMonth');

// Chart Contexts
const ctxWeight = document.getElementById('weightChart').getContext('2d');
const ctxBodyComp = document.getElementById('bodyCompChart').getContext('2d');
const ctxBP = document.getElementById('bpChart').getContext('2d');
const ctx1RM = document.getElementById('oneRMChart').getContext('2d');
const ctxVolume = document.getElementById('volumeChart').getContext('2d');
const ctxMacro = document.getElementById('macroChart').getContext('2d');
const ctxMacroDist = document.getElementById('macroDistChart').getContext('2d');
const ctxMicro = document.getElementById('microRadarChart').getContext('2d');

// --- STATE MANAGEMENT ---
let userData = null;
let chartWeightInstance = null;
let chartBodyCompInstance = null;
let chartBPInstance = null;
let chart1RMInstance = null;
let chartVolumeInstance = null;
let chartMacroInstance = null;
let chartMacroDistInstance = null;
let chartMicroInstance = null;

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
    updateBodyCompChart();
    updateBPChart();
    update1RMChart();
    updateVolumeChart();
    updateMacroCharts();
    updateMicroChart();
    renderActivityHistory();
    renderCalendar();
}

// --- CALENDAR ENGINE & BANNER LOGIC ---

calendarToggleBtn.addEventListener('click', () => {
    if (calendarCollapseBody.style.display === 'none') {
        calendarCollapseBody.style.display = 'block';
        calendarChevron.style.transform = 'rotate(180deg)';
    } else {
        calendarCollapseBody.style.display = 'none';
        calendarChevron.style.transform = 'rotate(0deg)';
    }
});

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
        const hasComp = (userData.biometrics || []).some(b => b.date === dateStr && (b.weight > 0 || b.bodyFat > 0 || b.systolic > 0));
        
        const el = document.createElement('div');
        el.className = 'cal-day';
        el.onclick = () => window.viewDaySummary(dateStr);
        
        let html = `<div>${d}</div><div class="cal-indicators">`;
        if (hasWorkout) html += `<div class="cal-dot dot-workout"></div>`;
        if (hasFood) html += `<div class="cal-dot dot-food"></div>`;
        if (hasComp) html += `<div class="cal-dot dot-comp"></div>`;
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
        let wHtml = `
            <div class="summary-card">
                <div class="summary-card-header">
                    <h4 class="text-primary"><i class="fa-solid fa-dumbbell"></i> Fitness</h4>
                </div>
        `;
        workouts.forEach(wk => {
            const cals = wk.telemetry?.activeCals || 0;
            const dur = Math.round(((wk.durationLift || 0) + (wk.durationCardio || 0)) / 60);
            wHtml += `
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; margin-bottom:8px;">
                    <div><strong>${wk.title || 'Session'}</strong>: ${dur}m | ${cals} kcal</div>
                    <button class="btn btn-ghost" style="padding:2px 8px; font-size:0.75rem; color:var(--danger); border-color:var(--danger);" onclick="deleteWorkout('${wk.id}', '${dateStr}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
        });
        wHtml += `</div>`;
        dsContent.innerHTML += wHtml;
    }

    // 2. Nutrition Intake
    const foods = (userData.food_diary || []).filter(f => f.date === dateStr);
    if (foods.length > 0) {
        hasAnyData = true;
        let cals=0, p=0, c=0, f=0;
        foods.forEach(food => { cals += Number(food.calories || 0); p += Number(food.protein || 0); c += Number(food.carbs || 0); f += Number(food.fats || 0); });
        
        let nHtml = `
            <div class="summary-card">
                <div class="summary-card-header">
                    <h4 class="text-accent"><i class="fa-solid fa-utensils"></i> Nutrition</h4>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 0.85rem; margin-bottom: 10px;">
                    <div>Calories: <strong>${Math.round(cals)}</strong></div>
                    <div>Protein: <strong>${Math.round(p)}g</strong></div>
                    <div>Carbs: <strong>${Math.round(c)}g</strong></div>
                    <div>Fats: <strong>${Math.round(f)}g</strong></div>
                </div>
                <div style="border-top:1px solid var(--border-color); padding-top:10px;">
        `;
        
        foods.forEach(food => {
            nHtml += `
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; margin-bottom:6px;">
                    <div>${food.name} <span class="text-muted">(${food.calories} kcal)</span></div>
                    <button class="btn btn-ghost" style="padding:2px 6px; font-size:0.7rem; color:var(--danger); border:none;" onclick="deleteFood('${food.id}', '${dateStr}')"><i class="fa-solid fa-xmark"></i></button>
                </div>
            `;
        });
        
        nHtml += `</div></div>`;
        dsContent.innerHTML += nHtml;
    }

    // 3. Body Metrics & Vitals
    const biometrics = (userData.biometrics || []).find(b => b.date === dateStr);
    if (biometrics && (biometrics.weight || biometrics.bodyFat || biometrics.systolic || biometrics.diastolic)) {
        hasAnyData = true;
        
        let weightData = biometrics.weight ? `${biometrics.weight} lbs` : '--';
        let bfData = biometrics.bodyFat ? `${biometrics.bodyFat} %` : '--';
        let bpData = (biometrics.systolic && biometrics.diastolic) ? `${biometrics.systolic} / ${biometrics.diastolic}` : '--';

        dsContent.innerHTML += `
            <div class="summary-card">
                <div class="summary-card-header">
                    <h4 class="text-warning"><i class="fa-solid fa-child-reaching"></i> Body Data</h4>
                    <button class="btn btn-ghost" style="padding:2px 8px; font-size:0.75rem; color:var(--danger); border-color:var(--danger);" onclick="deleteBiometrics('${dateStr}')"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 0.85rem;">
                    <div>Weight: <strong>${weightData}</strong></div>
                    <div>Body Fat: <strong>${bfData}</strong></div>
                    <div>Blood Pressure: <strong>${bpData}</strong></div>
                </div>
            </div>
        `;
    }

    if (!hasAnyData) {
        dsContent.innerHTML = `<div class="text-muted" style="text-align:center; padding: 20px; font-style: italic;">No telemetry recorded on this date.</div>`;
    }

    document.getElementById('daySummaryModal').classList.add('active');
};

// --- DATA MANIPULATION HANDLERS ---

window.deleteWorkout = async function(id, dateStr) {
    if(!confirm("Permanently delete this workout session?")) return;
    userData.workouts = userData.workouts.filter(w => w.id !== id);
    await window.BodyProDataStore.saveData(userData);
    renderAnalytics();
    window.viewDaySummary(dateStr);
};

window.deleteFood = async function(id, dateStr) {
    if(!confirm("Remove this food from your diary?")) return;
    userData.food_diary = userData.food_diary.filter(f => f.id !== id);
    await window.BodyProDataStore.saveData(userData);
    renderAnalytics();
    window.viewDaySummary(dateStr);
};

window.deleteBiometrics = async function(dateStr) {
    if(!confirm("Remove recorded body metrics for this date?")) return;
    userData.biometrics = userData.biometrics.filter(b => b.date !== dateStr);
    await window.BodyProDataStore.saveData(userData);
    renderAnalytics();
    window.viewDaySummary(dateStr);
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

// 2. Body Composition Chart
function updateBodyCompChart() {
    const days = parseInt(compRangeSelect.value) || 90;
    const dateLabels = getPastDates(days);
    
    const bfData = [];
    let latestWeight = 0;
    let latestBF = 0;

    dateLabels.forEach(date => {
        const entry = (userData.biometrics || []).find(b => b.date === date && b.bodyFat);
        const bf = entry ? parseFloat(entry.bodyFat) : null;
        bfData.push(bf);
        
        if (entry && entry.weight && entry.bodyFat) {
            latestWeight = parseFloat(entry.weight);
            latestBF = parseFloat(entry.bodyFat);
        }
    });

    if (latestWeight > 0 && latestBF > 0) {
        const fatMass = latestWeight * (latestBF / 100);
        const leanMass = latestWeight - fatMass;
        valBodyFat.innerText = `${latestBF.toFixed(1)} %`;
        valFatMass.innerText = `${fatMass.toFixed(1)} lbs`;
        valLeanMass.innerText = `${leanMass.toFixed(1)} lbs`;
    }

    if (chartBodyCompInstance) chartBodyCompInstance.destroy();

    chartBodyCompInstance = new Chart(ctxBodyComp, {
        type: 'line',
        data: {
            labels: dateLabels.map(d => d.substring(5)),
            datasets: [{
                label: 'Body Fat %',
                data: bfData,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
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
            plugins: { legend: { position: 'top' } }
        }
    });
}

// 3. Blood Pressure Chart
function updateBPChart() {
    const days = parseInt(bpRangeSelect.value) || 30;
    const dateLabels = getPastDates(days);
    
    const systolicData = [];
    const diastolicData = [];

    dateLabels.forEach(date => {
        const entry = (userData.biometrics || []).find(b => b.date === date && b.systolic && b.diastolic);
        systolicData.push(entry ? parseFloat(entry.systolic) : null);
        diastolicData.push(entry ? parseFloat(entry.diastolic) : null);
    });

    if (chartBPInstance) chartBPInstance.destroy();

    chartBPInstance = new Chart(ctxBP, {
        type: 'line',
        data: {
            labels: dateLabels.map(d => d.substring(5)),
            datasets: [
                {
                    label: 'Systolic',
                    data: systolicData,
                    borderColor: '#ef4444',
                    borderWidth: 2,
                    pointRadius: 4,
                    spanGaps: true,
                    tension: 0.2
                },
                {
                    label: 'Diastolic',
                    data: diastolicData,
                    borderColor: '#3b82f6',
                    borderWidth: 2,
                    pointRadius: 4,
                    spanGaps: true,
                    tension: 0.2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } }
        }
    });
}

// 4. 1RM Projection Chart
function update1RMChart() {
    const selectedLift = liftSelect.value;
    const days = 30; // Hardcode to 30 days for trending
    const dateLabels = getPastDates(days);
    const ormData = [];

    dateLabels.forEach(date => {
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

// 5. Volume Load (Tonnage)
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

// 6. Macro Adherence & Distribution
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

// 7. Micronutrient Radar
function updateMicroChart() {
    const days = 7;
    const dateLabels = getPastDates(days);
    
    // Default FDA/Standard Goals
    const targets = {
        sugar: 50, sodium: 2300, iron: 18, potassium: 4700, 
        fiber: 30, vitA: 900, vitC: 90, calcium: 1000, satFat: 20
    };
    
    const sums = { sugar: 0, sodium: 0, iron: 0, potassium: 0, fiber: 0, vitA: 0, vitC: 0, calcium: 0, satFat: 0 };

    dateLabels.forEach(date => {
        const daysFoods = (userData.food_diary || []).filter(f => f.date === date);
        daysFoods.forEach(food => {
            sums.sugar += (Number(food.sugar) || 0);
            sums.sodium += (Number(food.sodium) || 0);
            sums.iron += (Number(food.iron) || 0);
            sums.potassium += (Number(food.potassium) || 0);
            sums.fiber += (Number(food.fiber) || 0);
            sums.vitA += (Number(food.vitA) || 0);
            sums.vitC += (Number(food.vitC) || 0);
            sums.calcium += (Number(food.calcium) || 0);
            sums.satFat += (Number(food.satFat) || 0);
        });
    });

    const dataPercents = [
        Math.min((sums.sugar / days / targets.sugar) * 100, 150), // Cap at 150% for visualization
        Math.min((sums.sodium / days / targets.sodium) * 100, 150),
        Math.min((sums.iron / days / targets.iron) * 100, 150),
        Math.min((sums.potassium / days / targets.potassium) * 100, 150),
        Math.min((sums.fiber / days / targets.fiber) * 100, 150),
        Math.min((sums.vitA / days / targets.vitA) * 100, 150),
        Math.min((sums.vitC / days / targets.vitC) * 100, 150),
        Math.min((sums.calcium / days / targets.calcium) * 100, 150),
        Math.min((sums.satFat / days / targets.satFat) * 100, 150)
    ];

    if (chartMicroInstance) chartMicroInstance.destroy();

    chartMicroInstance = new Chart(ctxMicro, {
        type: 'radar',
        data: {
            labels: ['Sugar', 'Sodium', 'Iron', 'Potassium', 'Fiber', 'Vit A', 'Vit C', 'Calcium', 'Sat Fat'],
            datasets: [{
                label: '% of Daily Target',
                data: dataPercents,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderColor: '#3b82f6',
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#3b82f6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    pointLabels: { color: '#a1a1aa', font: { size: 10 } },
                    ticks: { display: false, max: 100, min: 0, stepSize: 25 }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

// 8. Activity History List
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

    document.getElementById('activityDetailModal').classList.add('active');
};

btnDeleteActivity.addEventListener('click', async () => {
    if (!currentViewActivityId) return;
    
    if(confirm("Permanently delete this session? This will recalculate your historical data.")) {
        userData.workouts = userData.workouts.filter(w => w.id !== currentViewActivityId);
        await window.BodyProDataStore.saveData(userData);
        document.getElementById('activityDetailModal').classList.remove('active');
        renderAnalytics();
    }
});

// --- EVENT LISTENERS ---
weightRangeSelect.addEventListener('change', updateWeightChart);
compRangeSelect.addEventListener('change', updateBodyCompChart);
bpRangeSelect.addEventListener('change', updateBPChart);
macroRangeSelect.addEventListener('change', updateMacroCharts);
liftSelect.addEventListener('change', update1RMChart);
volumeRangeSelect.addEventListener('change', updateVolumeChart);
