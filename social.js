import { auth, db } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, query, where, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- DOM ELEMENTS ---
const myShortIdDisplay = document.getElementById('myShortId');
const btnCopyId = document.getElementById('btnCopyId');
const inputFriendId = document.getElementById('inputFriendId');
const btnAddFriend = document.getElementById('btnAddFriend');
const addFriendMsg = document.getElementById('addFriendMsg');
const friendListContainer = document.getElementById('friendListContainer');
const friendCountBadge = document.getElementById('friendCountBadge');
const systemToast = document.getElementById('systemToast');

// Tabs
const requestsListContainer = document.getElementById('requestsListContainer');
const sentRequestsContainer = document.getElementById('sentRequestsContainer');
const requestBadge = document.getElementById('requestBadge');
const analyticsFeedContainer = document.getElementById('analyticsFeedContainer');
const btnRefreshSocial = document.getElementById('btnRefreshSocial');

// --- STATE MANAGEMENT ---
let userData = null;
let feedLoaded = false;

// Safe global cache to prevent stringify parsing crashes when rendering HTML
let currentFriendVaultData = { workouts: [], recipes: [] }; 

function getLocalISODate() {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return (new Date(d - offset)).toISOString().split('T')[0];
}

// Calculate relative time for feed
function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return `Yesterday`;
    return `${diffInDays}d ago`;
}

// --- INITIALIZATION ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }

    userData = await window.BodyProDataStore.getData();
    
    if (!userData.friends) userData.friends = [];
    if (!userData.profile) userData.profile = {};

    // Generate Short ID if missing
    if (!userData.profile.shortId) {
        userData.profile.shortId = Math.random().toString(36).substring(2, 8).toUpperCase();
        await window.BodyProDataStore.saveData(userData);
    }

    // Fix Profile Name Desync Bug
    await syncFriendProfiles();

    renderNetworkUI();
    renderRequestsUI();
    
    // Auto-load feed on default tab
    if(document.querySelector('.social-tab[data-tab="pane-feed"]').classList.contains('active')) {
        renderFeedUI();
    }
    
    // Bind Tab Clicks
    document.querySelectorAll('.social-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const targetPane = e.target.closest('.social-tab').dataset.tab;
            
            // Handle Active Tab State
            document.querySelectorAll('.social-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            e.target.closest('.social-tab').classList.add('active');
            document.getElementById(targetPane).classList.add('active');

            if(targetPane === 'pane-feed' && !feedLoaded) {
                renderFeedUI();
            }
        });
    });
});

// --- REFRESH LOGIC ---
if (btnRefreshSocial) {
    btnRefreshSocial.addEventListener('click', async () => {
        btnRefreshSocial.innerHTML = '<i class="fa-solid fa-rotate-right fa-spin"></i>';
        
        // Force pull from cloud
        userData = await window.BodyProDataStore.getData(); 
        await syncFriendProfiles(); // Ensure names are fresh
        
        renderNetworkUI();
        renderRequestsUI();
        
        if (document.getElementById('pane-feed').classList.contains('active')) {
            await renderFeedUI();
        } else {
            feedLoaded = false; // Force reload next time tab is clicked
        }
        
        btnRefreshSocial.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Refresh';
        showToast("Network synchronized.", "var(--accent)");
    });
}

// --- BUG FIX: SYNC FRIEND PROFILE NAMES ---
async function syncFriendProfiles() {
    let updated = false;
    for (let f of userData.friends) {
        if (!f.status || f.status === 'accepted') {
            try {
                const targetRef = doc(db, "users", f.uid);
                const targetSnap = await getDoc(targetRef);
                if (targetSnap.exists()) {
                    const latestName = targetSnap.data().profile?.displayName;
                    if (latestName && latestName !== f.displayName) {
                        f.displayName = latestName;
                        updated = true;
                    }
                }
            } catch (e) { console.warn("Failed to sync friend:", f.uid); }
        }
    }
    if (updated) {
        await window.BodyProDataStore.saveData(userData);
    }
}

// --- RENDER UI: NETWORK CIRCLE ---
function renderNetworkUI() {
    myShortIdDisplay.innerText = userData.profile.shortId || "ERROR";
    friendListContainer.innerHTML = '';
    
    // Filter for accepted friends (or legacy friends who don't have a status field yet)
    const activeFriends = userData.friends.filter(f => !f.status || f.status === 'accepted');

    if (activeFriends.length === 0) {
        friendListContainer.innerHTML = `
            <div style="text-align: center; padding: 30px 20px; color: var(--text-muted); font-size: 0.9rem; background: var(--bg-surface-elevated); border-radius: var(--border-radius-sm); border: 1px dashed var(--border-color);">
                <i class="fa-solid fa-ghost" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5;"></i><br>
                Your roster is empty.<br>Add friends using their 6-character ID.
            </div>
        `;
        friendCountBadge.innerText = "0";
        return;
    }

    friendCountBadge.innerText = activeFriends.length;

    activeFriends.forEach(friend => {
        const initial = friend.displayName ? friend.displayName.charAt(0).toUpperCase() : '?';
        const name = friend.displayName || 'Unknown User';
        const sId = friend.shortId || '------';

        const card = document.createElement('div');
        card.className = 'friend-card';
        card.innerHTML = `
            <div class="friend-info">
                <div class="friend-avatar">${initial}</div>
                <div class="friend-details">
                    <h4 style="font-size: 1.1rem;">${name}</h4>
                    <p>Link ID: ${sId}</p>
                </div>
            </div>
            <div class="friend-actions">
                <button title="Open Vault" onclick="window.triggerVaultFromList('${friend.uid}', '${name.replace(/'/g, "\\'")}')" style="color: var(--accent); border-color: var(--accent);">
                    <i class="fa-solid fa-box-open"></i> Vault
                </button>
                <button class="btn-danger" title="Remove Connection" onclick="removeFriend('${sId}')">
                    <i class="fa-solid fa-trash-can"></i> Sever
                </button>
            </div>
        `;
        friendListContainer.appendChild(card);
    });
}

// Wrapper to safely pass strings to the vault function
window.triggerVaultFromList = function(uid, name) {
    window.openFriendVault(uid, name);
};

// --- RENDER UI: PENDING REQUESTS ---
function renderRequestsUI() {
    const inbound = userData.friends.filter(f => f.status === 'pending' && f.direction === 'inbound');
    const outbound = userData.friends.filter(f => f.status === 'pending' && f.direction === 'outbound');

    if (inbound.length > 0) {
        requestBadge.innerText = inbound.length;
        requestBadge.style.display = 'inline-block';
    } else {
        requestBadge.style.display = 'none';
    }

    requestsListContainer.innerHTML = '';
    if (inbound.length === 0) {
        requestsListContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.9rem; background: var(--bg-surface); border-radius: var(--border-radius-sm); border: 1px solid var(--border-color);">No pending inbound clearances.</div>';
    } else {
        inbound.forEach(req => {
            const initial = req.displayName ? req.displayName.charAt(0).toUpperCase() : '?';
            const card = document.createElement('div');
            card.className = 'friend-card';
            card.innerHTML = `
                <div class="friend-info">
                    <div class="friend-avatar" style="background: linear-gradient(135deg, var(--warning), #d97706);">${initial}</div>
                    <div class="friend-details">
                        <h4>${req.displayName || 'Unknown User'}</h4>
                        <p>ID: ${req.shortId}</p>
                    </div>
                </div>
                <div class="friend-actions">
                    <button class="btn-accept" title="Accept" onclick="handleRequest('${req.uid}', true)" style="color: var(--accent); border-color: var(--accent); background: rgba(16, 185, 129, 0.1);">
                        <i class="fa-solid fa-check"></i> Accept
                    </button>
                    <button class="btn-danger" title="Decline" onclick="handleRequest('${req.uid}', false)">
                        <i class="fa-solid fa-xmark"></i> Decline
                    </button>
                </div>
            `;
            requestsListContainer.appendChild(card);
        });
    }

    sentRequestsContainer.innerHTML = '';
    if (outbound.length === 0) {
        sentRequestsContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.9rem; background: var(--bg-surface); border-radius: var(--border-radius-sm); border: 1px solid var(--border-color);">No outbound pings active.</div>';
    } else {
        outbound.forEach(req => {
            const card = document.createElement('div');
            card.className = 'friend-card';
            card.style.padding = '10px 15px';
            card.innerHTML = `
                <div class="friend-info" style="justify-content: space-between; width: 100%;">
                    <div class="friend-details">
                        <h4 style="font-size: 0.95rem; margin-bottom: 2px;">${req.displayName || 'Unknown User'} (ID: ${req.shortId})</h4>
                        <p style="color: var(--warning); font-size: 0.75rem;">Awaiting clearance...</p>
                    </div>
                    <button class="btn-ghost" title="Cancel Request" onclick="removeFriend('${req.shortId}')" style="font-size: 0.8rem; padding: 6px 10px; border: 1px solid var(--danger); color: var(--danger); border-radius: var(--border-radius-sm); background: transparent; cursor: pointer;">
                        Cancel
                    </button>
                </div>
            `;
            sentRequestsContainer.appendChild(card);
        });
    }
}

// --- RENDER UI: MODERN ACTIVITY FEED & HEAD-TO-HEAD ---
async function renderFeedUI() {
    feedLoaded = true;
    const activeFriends = userData.friends.filter(f => !f.status || f.status === 'accepted');

    if (activeFriends.length === 0) {
        analyticsFeedContainer.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                <i class="fa-solid fa-bolt" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.3;"></i><br>
                The Wire is silent. Connect with other athletes to populate the stream.
            </div>`;
        return;
    }

    analyticsFeedContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Building Stream...</div>';

    const todayStr = getLocalISODate();
    
    // 1. Extract My Telemetry for Head-to-Head
    const myBio = (userData.biometrics || []).find(b => b.date === todayStr) || {};
    const mySteps = myBio.steps || 0;
    
    const myFoods = (userData.food_diary || []).filter(f => f.date === todayStr);
    let myCals = 0;
    myFoods.forEach(f => { myCals += Number(f.calories || 0); });
    
    const myWorkouts = (userData.workouts || []).filter(w => w.date === todayStr || (w.timestamp && w.timestamp.startsWith(todayStr)));
    let myActiveCals = 0;
    myWorkouts.forEach(w => myActiveCals += Number(w.telemetry?.activeCals || 0));

    // 2. Fetch Friend Data and Build Event Stream
    let htmlContent = '';
    let feedEvents = []; // Array to hold chronologically sorted activities

    for (const friend of activeFriends) {
        const fData = await window.BodyProDataStore.fetchFriendTelemetry(friend.uid);
        if (!fData) continue;

        const fName = friend.displayName || 'Unknown';
        const fInitial = fName.charAt(0).toUpperCase();

        // --- Build Head to Head Block ---
        const fBio = (fData.biometrics || []).find(b => b.date === todayStr) || {};
        const fSteps = fBio.steps || 0;

        const fFoods = fData.food_diary || [];
        let fCals = 0;
        fFoods.forEach(f => { fCals += Number(f.calories || 0); });

        const fWorkouts = fData.workouts || [];
        let fActiveCals = 0;
        fWorkouts.forEach(w => fActiveCals += Number(w.telemetry?.activeCals || 0));

        const maxSteps = Math.max(mySteps, fSteps, 1000);
        const maxCals = Math.max(myCals, fCals, 2000);
        const maxActiveCals = Math.max(myActiveCals, fActiveCals, 500);

        htmlContent += `
            <div class="h2h-card">
                <div class="h2h-header">
                    <i class="fa-solid fa-satellite-dish text-primary" style="margin-right: 8px;"></i>
                    Sync: You vs. ${fName}
                </div>
                
                <div class="compare-row">
                    <div style="text-align:right;"><span style="color:var(--text-muted); font-size:0.75rem; text-transform:uppercase;">Me</span><br><span style="color:var(--accent); font-weight:800; font-size: 1.1rem;">${myActiveCals}</span></div>
                    <div style="text-align:center;">
                        <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-main); font-weight: bold; margin-bottom:6px;">Active Kcal</div>
                        <div class="compare-bar-container">
                            <div class="compare-bar-self" style="width: ${(myActiveCals/maxActiveCals)*100}%"></div>
                            <div class="compare-bar-friend" style="width: ${(fActiveCals/maxActiveCals)*100}%"></div>
                        </div>
                    </div>
                    <div style="text-align:left;"><span style="color:var(--text-muted); font-size:0.75rem; text-transform:uppercase;">Them</span><br><span style="color:var(--primary); font-weight:800; font-size: 1.1rem;">${fActiveCals}</span></div>
                </div>

                <div class="compare-row">
                    <div style="text-align:right;"><span style="color:var(--accent); font-weight:800; font-size: 1.1rem;">${myCals}</span></div>
                    <div style="text-align:center;">
                        <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-main); font-weight: bold; margin-bottom:6px;">Intake Kcal</div>
                        <div class="compare-bar-container">
                            <div class="compare-bar-self" style="width: ${(myCals/maxCals)*100}%"></div>
                            <div class="compare-bar-friend" style="width: ${(fCals/maxCals)*100}%"></div>
                        </div>
                    </div>
                    <div style="text-align:left;"><span style="color:var(--primary); font-weight:800; font-size: 1.1rem;">${fCals}</span></div>
                </div>
            </div>
        `;

        // --- Harvest Feed Events (Last 3 days) ---
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 3);

        // Harvest Workouts
        (fData.workouts || []).forEach(w => {
            if (new Date(w.timestamp) >= cutoffDate) {
                const totalDur = Math.round(((w.durationLift || 0) + (w.durationCardio || 0)) / 60);
                const exCount = w.sets ? new Set(w.sets.map(s => s.exercise)).size : 0;
                let primaryFocus = "";
                if(exCount > 0) {
                    primaryFocus = `Executed ${exCount} distinct movements including ${w.sets[0].exercise.split(' ')[0]}.`;
                }

                feedEvents.push({
                    type: 'workout',
                    timestamp: w.timestamp,
                    html: `
                        <div class="feed-event">
                            <div class="feed-event-header">
                                <div class="friend-avatar" style="width: 35px; height: 35px; font-size: 1rem;">${fInitial}</div>
                                <div>
                                    <div style="font-size: 0.9rem; font-weight: bold; color: var(--text-main);">${fName}</div>
                                    <div style="font-size: 0.75rem; color: var(--accent);">Completed a Session</div>
                                </div>
                                <div class="time-ago">${timeAgo(w.timestamp)}</div>
                            </div>
                            <div class="feed-event-body">
                                <h4 class="feed-event-title">${w.title || 'Untitled Session'}</h4>
                                <div class="feed-event-metrics">
                                    <div class="metric-pill"><i class="fa-regular fa-clock text-muted"></i> ${totalDur} mins</div>
                                    <div class="metric-pill"><i class="fa-solid fa-fire text-accent"></i> ${w.telemetry?.activeCals || 0} kcal</div>
                                </div>
                                ${primaryFocus ? `<div class="feed-event-details">${primaryFocus}</div>` : ''}
                            </div>
                            <div class="feed-action-bar">
                                <button class="feed-btn" onclick="this.classList.toggle('active'); this.innerHTML = this.classList.contains('active') ? '<i class=\\'fa-solid fa-hand-fist\\'></i> Props Given!' : '<i class=\\'fa-regular fa-hand-fist\\'></i> Give Props';"><i class="fa-regular fa-hand-fist"></i> Give Props</button>
                            </div>
                        </div>
                    `
                });
            }
        });

        // Harvest Recipes (Requires subcollection fetch)
        const recipesRef = collection(db, "users", friend.uid, "custom_recipes");
        const recSnap = await getDocs(recipesRef);
        recSnap.forEach(d => {
            const r = d.data();
            if (r.timestamp && new Date(r.timestamp) >= cutoffDate) {
                feedEvents.push({
                    type: 'recipe',
                    timestamp: r.timestamp,
                    html: `
                        <div class="feed-event">
                            <div class="feed-event-header">
                                <div class="friend-avatar" style="width: 35px; height: 35px; font-size: 1rem; background: linear-gradient(135deg, var(--warning), #d97706);">${fInitial}</div>
                                <div>
                                    <div style="font-size: 0.9rem; font-weight: bold; color: var(--text-main);">${fName}</div>
                                    <div style="font-size: 0.75rem; color: var(--warning);">Added a New Recipe</div>
                                </div>
                                <div class="time-ago">${timeAgo(r.timestamp)}</div>
                            </div>
                            <div class="feed-event-body">
                                <h4 class="feed-event-title">${r.name || 'Untitled Recipe'}</h4>
                                <div class="feed-event-metrics">
                                    <div class="metric-pill"><i class="fa-solid fa-fire text-muted"></i> ${r.macrosPerServing?.calories || 0} kcal</div>
                                    <div class="metric-pill"><i class="fa-solid fa-drumstick-bite text-primary"></i> ${r.macrosPerServing?.protein || 0}g P</div>
                                </div>
                            </div>
                            <div class="feed-action-bar">
                                <button class="feed-btn" onclick="window.triggerVaultFromList('${friend.uid}', '${fName.replace(/'/g, "\\'")}')"><i class="fa-solid fa-download"></i> Get Recipe</button>
                            </div>
                        </div>
                    `
                });
            }
        });
    }

    // Sort events by timestamp descending
    feedEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Append sorted events to UI
    if (feedEvents.length > 0) {
        htmlContent += `<div style="font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; font-weight: bold; margin: 25px 0 15px 0; letter-spacing: 1px;">Activity Stream</div>`;
        feedEvents.forEach(ev => htmlContent += ev.html);
    } else {
        htmlContent += `
            <div style="text-align: center; padding: 30px; margin-top: 20px; border-radius: var(--border-radius-md); background: var(--bg-surface); border: 1px dashed var(--border-color);">
                <p class="text-muted" style="margin: 0; font-size: 0.9rem;">No recent activities from your squad in the last 72 hours.</p>
            </div>
        `;
    }

    analyticsFeedContainer.innerHTML = htmlContent;
}

// --- NEW: CROSS-USER VAULT IMPORT PROTOCOL ---

// Vault Modal Tab Logic
const vaultTabs = document.querySelectorAll('.vault-tab');
vaultTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        vaultTabs.forEach(t => {
            t.classList.remove('active');
            t.style.color = 'var(--text-muted)';
            t.style.borderBottomColor = 'transparent';
        });
        tab.classList.add('active');
        tab.style.color = 'var(--accent)';
        tab.style.borderBottomColor = 'var(--accent)';
        
        document.getElementById('pane-vault-workouts').style.display = 'none';
        document.getElementById('pane-vault-recipes').style.display = 'none';
        
        document.getElementById('pane-vault-' + tab.dataset.vault).style.display = 'block';
    });
});

window.openFriendVault = async function(uid, displayName) {
    const fvTitle = document.getElementById('fvTitle');
    const fvWorkoutsList = document.getElementById('fvWorkoutsList');
    const fvRecipesList = document.getElementById('fvRecipesList');

    fvTitle.innerHTML = `<i class="fa-solid fa-box-open text-primary"></i> ${displayName}'s Vault`;
    fvWorkoutsList.innerHTML = '<div style="text-align:center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Initializing Secure Link...</div>';
    fvRecipesList.innerHTML = '<div style="text-align:center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Initializing Secure Link...</div>';

    document.getElementById('friendVaultModal').classList.add('active');

    try {
        const fData = await window.BodyProDataStore.fetchFriendTelemetry(uid);
        
        const recipesRef = collection(db, "users", uid, "custom_recipes");
        const recSnap = await getDocs(recipesRef);
        const friendRecipes = [];
        recSnap.forEach(d => friendRecipes.push(d.data()));

        const templates = fData.workout_templates || [];

        // Store into safe global variable to prevent JSON attribute parsing crashes
        currentFriendVaultData = {
            workouts: templates,
            recipes: friendRecipes
        };

        // Render Workouts
        fvWorkoutsList.innerHTML = '';
        if (templates.length === 0) {
            fvWorkoutsList.innerHTML = '<div class="text-muted" style="text-align:center; padding: 20px; background: var(--bg-base); border-radius: var(--border-radius-sm); border: 1px solid var(--border-color);">No workout templates found.</div>';
        } else {
            templates.forEach((t, index) => {
                const div = document.createElement('div');
                div.className = 'friend-card';
                div.style.marginBottom = '10px';
                div.style.padding = '15px';
                div.innerHTML = `
                    <div class="friend-info" style="align-items: flex-start;">
                        <div class="friend-details">
                            <h4 style="font-size: 1rem; margin:0 0 5px 0; color: var(--text-main);">${t.title || 'Workout'}</h4>
                            <p style="font-size: 0.8rem; margin:0; color: var(--text-muted);"><i class="fa-solid fa-list-check"></i> ${(t.exercises || []).length} Movements mapped.</p>
                        </div>
                    </div>
                    <div class="friend-actions" style="margin-top: 15px;">
                        <button class="btn btn-ghost" style="color:var(--accent); border-color:var(--accent); font-size: 0.85rem; padding: 8px; width: 100%;" onclick="window.importWorkout(${index})"><i class="fa-solid fa-download"></i> Import Protocol</button>
                    </div>
                `;
                fvWorkoutsList.appendChild(div);
            });
        }

        // Render Recipes
        fvRecipesList.innerHTML = '';
        if (friendRecipes.length === 0) {
            fvRecipesList.innerHTML = '<div class="text-muted" style="text-align:center; padding: 20px; background: var(--bg-base); border-radius: var(--border-radius-sm); border: 1px solid var(--border-color);">No recipes found.</div>';
        } else {
            friendRecipes.forEach((r, index) => {
                const div = document.createElement('div');
                div.className = 'friend-card';
                div.style.marginBottom = '10px';
                div.style.padding = '15px';
                div.innerHTML = `
                    <div class="friend-info" style="align-items: flex-start;">
                        <div class="friend-details">
                            <h4 style="font-size: 1rem; margin:0 0 5px 0; color: var(--text-main);">${r.name || 'Recipe'}</h4>
                            <p style="font-size: 0.8rem; margin:0; color: var(--text-muted);">
                                ${r.macrosPerServing?.calories || 0} kcal | 
                                <span class="text-primary">${r.macrosPerServing?.protein || 0}g P</span> | 
                                <span class="text-warning">${r.macrosPerServing?.carbs || 0}g C</span> | 
                                <span class="text-danger">${r.macrosPerServing?.fats || 0}g F</span>
                            </p>
                        </div>
                    </div>
                    <div class="friend-actions" style="margin-top: 15px;">
                        <button class="btn btn-ghost" style="color:var(--accent); border-color:var(--accent); font-size: 0.85rem; padding: 8px; width: 100%;" onclick="window.importRecipe(${index})"><i class="fa-solid fa-download"></i> Import Recipe</button>
                    </div>
                `;
                fvRecipesList.appendChild(div);
            });
        }

    } catch (err) {
        console.error(err);
        fvWorkoutsList.innerHTML = '<div class="text-danger" style="text-align:center;">Failed to load cross-user data.</div>';
        fvRecipesList.innerHTML = '<div class="text-danger" style="text-align:center;">Failed to load cross-user data.</div>';
    }
};

window.importWorkout = async function(index) {
    const workout = currentFriendVaultData.workouts[index];
    if (!workout) return;
    
    if (!userData.workout_templates) userData.workout_templates = [];
    
    // Deep clone and assign new ID to prevent cross-user mutations
    const newWorkout = JSON.parse(JSON.stringify(workout));
    newWorkout.id = 'wt_' + Date.now();
    newWorkout.title = workout.title + ' (Imported)';
    
    userData.workout_templates.push(newWorkout);
    await window.BodyProDataStore.saveData(userData);
    
    showToast("Workout protocol imported!", "var(--accent)");
};

window.importRecipe = async function(index) {
    const recipe = currentFriendVaultData.recipes[index];
    if (!recipe) return;
    
    if (!userData.custom_recipes) userData.custom_recipes = [];
    
    const newId = 'rec_' + Date.now();
    const newRecipe = JSON.parse(JSON.stringify(recipe));
    newRecipe.id = newId;
    newRecipe.name = recipe.name + ' (Imported)';
    
    try {
        // Push recipe to the separate custom_recipes subcollection to keep it synced with recipes.js architecture
        const recipeRef = doc(db, "users", auth.currentUser.uid, "custom_recipes", newId);
        await setDoc(recipeRef, newRecipe);
        
        userData.custom_recipes.push(newRecipe);
        showToast("Recipe data imported!", "var(--accent)");
    } catch (e) {
        console.error("DB Import Error", e);
        showToast("Failed to synchronize recipe.", "var(--danger)");
    }
};

// --- REQUEST HANDLING LOGIC (ACCEPT / DECLINE) ---
window.handleRequest = async function(targetUid, isAccepted) {
    // 1. Update Local
    const localFriend = userData.friends.find(f => f.uid === targetUid);
    if (!localFriend) return;

    if (isAccepted) {
        localFriend.status = 'accepted';
        showToast("Connection established.", "var(--accent)");
    } else {
        userData.friends = userData.friends.filter(f => f.uid !== targetUid);
        showToast("Request declined.", "var(--text-muted)");
    }

    renderRequestsUI();
    renderNetworkUI();
    await window.BodyProDataStore.saveData(userData);

    // 2. Update Target's Document (Cross-User Sync)
    try {
        const targetRef = doc(db, "users", targetUid);
        const targetSnap = await getDoc(targetRef);
        
        if (targetSnap.exists()) {
            const targetData = targetSnap.data();
            let targetFriends = targetData.friends || [];
            
            if (isAccepted) {
                const meInTarget = targetFriends.find(f => f.uid === auth.currentUser.uid);
                if (meInTarget) meInTarget.status = 'accepted';
            } else {
                targetFriends = targetFriends.filter(f => f.uid !== auth.currentUser.uid);
            }
            
            await window.BodyProDataStore.pushCrossUserFriendUpdate(targetUid, targetFriends);
        }
    } catch (e) {
        console.warn("[BodyPro Sync] Target remote update failed. Will resolve on their next sync.", e);
    }
};

// --- REMOVE CONNECTION LOGIC (BI-DIRECTIONAL) ---
window.removeFriend = async function(shortIdToRemove) {
    if (!confirm(`Sever connection ${shortIdToRemove}? This will delete the link for both athletes.`)) return;

    const friendToRemove = userData.friends.find(f => f.shortId === shortIdToRemove);
    if(!friendToRemove) return;

    const targetUid = friendToRemove.uid;

    // Remove Local
    userData.friends = userData.friends.filter(f => f.shortId !== shortIdToRemove);
    renderNetworkUI();
    renderRequestsUI();
    await window.BodyProDataStore.saveData(userData);
    showToast("Connection severed.", "var(--danger)");

    // Remove Remote
    try {
        const targetRef = doc(db, "users", targetUid);
        const targetSnap = await getDoc(targetRef);
        if (targetSnap.exists()) {
            const targetData = targetSnap.data();
            const targetFriends = (targetData.friends || []).filter(f => f.uid !== auth.currentUser.uid);
            await window.BodyProDataStore.pushCrossUserFriendUpdate(targetUid, targetFriends);
        }
    } catch (e) {
        console.warn("[BodyPro Sync] Remote sever failed.", e);
    }
};

// --- COPY TO CLIPBOARD ---
btnCopyId.addEventListener('click', () => {
    const idToCopy = myShortIdDisplay.innerText;
    navigator.clipboard.writeText(idToCopy).then(() => {
        const originalText = btnCopyId.innerHTML;
        btnCopyId.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        btnCopyId.style.color = "var(--accent)";
        
        setTimeout(() => {
            btnCopyId.innerHTML = originalText;
            btnCopyId.style.color = "";
        }, 2000);
    }).catch(err => {
        console.error("Failed to copy ID: ", err);
        showToast("Clipboard access denied.", "var(--danger)");
    });
});

// --- OUTBOUND REQUEST LOGIC ---
btnAddFriend.addEventListener('click', async () => {
    const targetId = inputFriendId.value.replace(/[^A-Z0-9]/gi, '').toUpperCase();

    if (targetId.length !== 6) {
        showMsg("Invalid ID format. Must be exactly 6 alphanumeric characters.", "var(--danger)");
        return;
    }
    
    if (targetId === userData.profile.shortId) {
        showMsg("You cannot connect with your own ID.", "var(--warning)");
        return;
    }

    if (userData.friends.some(f => f.shortId === targetId)) {
        showMsg("Connection or pending request already exists.", "var(--warning)");
        return;
    }

    btnAddFriend.disabled = true;
    btnAddFriend.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    showMsg("Pinging cloud registry...", "var(--text-muted)");

    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("shortId", "==", targetId));
        const querySnapshot = await getDocs(q);

        let foundUserDoc = null;
        
        if (!querySnapshot.empty) {
            foundUserDoc = querySnapshot.docs[0];
        } else {
            const fallbackSnapshot = await getDocs(usersRef);
            fallbackSnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.shortId === targetId || (data.profile && data.profile.shortId === targetId)) {
                    foundUserDoc = doc;
                }
            });
        }

        if (!foundUserDoc) {
            showMsg(`No account found with ID: ${targetId}`, "var(--danger)");
            btnAddFriend.disabled = false;
            btnAddFriend.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
            return;
        }

        const targetData = foundUserDoc.data();
        const targetName = targetData.profile?.displayName || "BodyPro User";
        const targetUid = foundUserDoc.id;

        userData.friends.push({
            uid: targetUid,
            shortId: targetId,
            displayName: targetName,
            status: 'pending',
            direction: 'outbound',
            addedAt: new Date().toISOString()
        });

        const success = await window.BodyProDataStore.saveData(userData);

        if (success) {
            const targetFriends = targetData.friends || [];
            targetFriends.push({
                uid: auth.currentUser.uid,
                shortId: userData.profile.shortId,
                displayName: userData.profile.displayName || "BodyPro User",
                status: 'pending',
                direction: 'inbound',
                addedAt: new Date().toISOString()
            });

            const remoteSuccess = await window.BodyProDataStore.pushCrossUserFriendUpdate(targetUid, targetFriends);

            if (remoteSuccess) {
                showMsg(`Clearance request sent to ${targetName}!`, "var(--accent)");
            } else {
                showMsg(`Local link saved, but target ping failed.`, "var(--warning)");
            }

            inputFriendId.value = '';
            renderRequestsUI();
        } else {
            showMsg("Failed to synchronize network update.", "var(--danger)");
        }

    } catch (error) {
        console.error("Network Search Error:", error);
        showMsg("Cloud query failed. Check connection.", "var(--danger)");
    } finally {
        btnAddFriend.disabled = false;
        btnAddFriend.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
    }
});

// --- HELPER FUNCTIONS ---
function showMsg(text, color) {
    addFriendMsg.style.display = 'block';
    addFriendMsg.style.color = color;
    addFriendMsg.innerText = text;
    
    if (color !== "var(--text-muted)") {
        setTimeout(() => {
            addFriendMsg.style.display = 'none';
        }, 4000);
    }
}

function showToast(message, bgColor) {
    systemToast.innerText = message;
    if (bgColor) systemToast.style.backgroundColor = bgColor;
    
    systemToast.classList.add('show');
    setTimeout(() => {
        systemToast.classList.remove('show');
        setTimeout(() => { systemToast.style.backgroundColor = "var(--accent)"; }, 400);
    }, 3000);
}
