// social.js - BodyPro Network & Cross-User Telemetry

import { auth, db } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- DOM ELEMENTS ---
const myShortIdDisplay = document.getElementById('myShortId');
const btnCopyId = document.getElementById('btnCopyId');
const inputFriendId = document.getElementById('inputFriendId');
const btnAddFriend = document.getElementById('btnAddFriend');
const addFriendMsg = document.getElementById('addFriendMsg');
const friendListContainer = document.getElementById('friendListContainer');
const friendCountBadge = document.getElementById('friendCountBadge');
const systemToast = document.getElementById('systemToast');

// New DOM Elements for Tabs
const requestsListContainer = document.getElementById('requestsListContainer');
const sentRequestsContainer = document.getElementById('sentRequestsContainer');
const requestBadge = document.getElementById('requestBadge');
const analyticsFeedContainer = document.getElementById('analyticsFeedContainer');
const btnRefreshSocial = document.getElementById('btnRefreshSocial');

// --- STATE MANAGEMENT ---
let userData = null;
let feedLoaded = false;

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

    renderNetworkUI();
    renderRequestsUI();
    
    // Bind Feed Rendering to Tab Click to save read operations
    document.querySelectorAll('.social-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const targetPane = e.target.closest('.social-tab').dataset.tab;
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
        
        renderNetworkUI();
        renderRequestsUI();
        
        if (feedLoaded) {
            await renderFeedUI();
        }
        
        btnRefreshSocial.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Refresh';
        showToast("Network synchronized.", "var(--accent)");
    });
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
                Your network is currently empty.<br>Add friends using their 6-character ID.
            </div>
        `;
        friendCountBadge.innerText = "0 Connections";
        return;
    }

    friendCountBadge.innerText = `${activeFriends.length} Connection${activeFriends.length !== 1 ? 's' : ''}`;

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
                    <h4>${name}</h4>
                    <p>ID: ${sId}</p>
                </div>
            </div>
            <div class="friend-actions">
                <button title="Remove Connection" onclick="removeFriend('${sId}')">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
        friendListContainer.appendChild(card);
    });
}

// --- RENDER UI: PENDING REQUESTS ---
function renderRequestsUI() {
    const inbound = userData.friends.filter(f => f.status === 'pending' && f.direction === 'inbound');
    const outbound = userData.friends.filter(f => f.status === 'pending' && f.direction === 'outbound');

    // Update Badge
    if (inbound.length > 0) {
        requestBadge.innerText = inbound.length;
        requestBadge.style.display = 'block';
    } else {
        requestBadge.style.display = 'none';
    }

    // Render Inbound
    requestsListContainer.innerHTML = '';
    if (inbound.length === 0) {
        requestsListContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.9rem;">No pending requests.</div>';
    } else {
        inbound.forEach(req => {
            const initial = req.displayName ? req.displayName.charAt(0).toUpperCase() : '?';
            const card = document.createElement('div');
            card.className = 'friend-card';
            card.innerHTML = `
                <div class="friend-info">
                    <div class="friend-avatar" style="background: var(--warning);">${initial}</div>
                    <div class="friend-details">
                        <h4>${req.displayName || 'Unknown User'}</h4>
                        <p>ID: ${req.shortId}</p>
                    </div>
                </div>
                <div class="friend-actions">
                    <button class="btn-accept" title="Accept" onclick="handleRequest('${req.uid}', true)" style="color: var(--accent); border-color: var(--accent);">
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <button title="Decline" onclick="handleRequest('${req.uid}', false)">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
            requestsListContainer.appendChild(card);
        });
    }

    // Render Outbound
    sentRequestsContainer.innerHTML = '';
    if (outbound.length === 0) {
        sentRequestsContainer.innerHTML = '<div style="padding: 10px; color: var(--text-muted); font-size: 0.85rem; text-align: center;">No outbound requests.</div>';
    } else {
        outbound.forEach(req => {
            const card = document.createElement('div');
            card.className = 'friend-card';
            card.style.padding = '10px';
            card.innerHTML = `
                <div class="friend-info">
                    <div class="friend-details">
                        <h4 style="font-size: 0.9rem;">${req.displayName || 'Unknown User'} (ID: ${req.shortId})</h4>
                        <p style="color: var(--warning); font-size: 0.75rem;">Awaiting their approval...</p>
                    </div>
                </div>
                <div class="friend-actions">
                    <button title="Cancel Request" onclick="removeFriend('${req.shortId}')" style="width: 25px; height: 25px; font-size: 0.7rem;">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
            sentRequestsContainer.appendChild(card);
        });
    }
}

// --- RENDER UI: COMPARATIVE FEED ---
async function renderFeedUI() {
    feedLoaded = true;
    const activeFriends = userData.friends.filter(f => !f.status || f.status === 'accepted');

    if (activeFriends.length === 0) {
        analyticsFeedContainer.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                <i class="fa-solid fa-user-group" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.3;"></i><br>
                Your feed is empty. Connect with other athletes to view comparative telemetry.
            </div>`;
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    
    // Extract My Telemetry
    const myBio = (userData.biometrics || []).find(b => b.date === todayStr) || {};
    const mySteps = myBio.steps || 0;
    const myFloors = myBio.floors || 0;
    
    const myFoods = (userData.food_diary || []).filter(f => f.date === todayStr);
    let myCals = 0, myPro = 0;
    myFoods.forEach(f => { myCals += Number(f.calories || 0); myPro += Number(f.protein || 0); });
    
    const myWorkouts = (userData.workouts || []).filter(w => w.date === todayStr || (w.timestamp && w.timestamp.startsWith(todayStr)));
    let myActiveCals = 0;
    myWorkouts.forEach(w => myActiveCals += Number(w.telemetry?.activeCals || 0));

    analyticsFeedContainer.innerHTML = ''; // Clear loader

    for (const friend of activeFriends) {
        const fData = await window.BodyProDataStore.fetchFriendTelemetry(friend.uid);
        if (!fData) continue; // Skip if failed to fetch

        // Also explicitly fetch their custom recipes for the Vault block
        const recipesRef = collection(db, "users", friend.uid, "custom_recipes");
        const recSnap = await getDocs(recipesRef);
        const friendRecipes = [];
        recSnap.forEach(d => friendRecipes.push(d.data()));

        // Extract Friend Telemetry
        const fBio = (fData.biometrics || []).find(b => b.date === todayStr) || {};
        const fSteps = fBio.steps || 0;
        const fFloors = fBio.floors || 0;

        const fFoods = fData.food_diary || [];
        let fCals = 0, fPro = 0;
        fFoods.forEach(f => { fCals += Number(f.calories || 0); fPro += Number(f.protein || 0); });

        const fWorkouts = fData.workouts || [];
        let fActiveCals = 0;
        fWorkouts.forEach(w => fActiveCals += Number(w.telemetry?.activeCals || 0));

        // Math for Visual Bars (Normalize to 100%)
        const maxSteps = Math.max(mySteps, fSteps, 1000);
        const maxCals = Math.max(myCals, fCals, 2000);
        const maxActiveCals = Math.max(myActiveCals, fActiveCals, 500);

        const card = document.createElement('div');
        card.className = 'feed-card';
        card.innerHTML = `
            <div class="feed-header">
                <div class="friend-avatar" style="width: 35px; height: 35px; font-size: 1rem;">${(friend.displayName || '?').charAt(0).toUpperCase()}</div>
                <div>
                    <h4 style="margin: 0; font-size: 1rem;">${friend.displayName}</h4>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">Today's Telemetry</div>
                </div>
            </div>

            <div class="feed-section-title">Activity Comparison</div>
            
            <div class="compare-row">
                <div style="text-align:right;">Me<br><span style="color:var(--accent); font-weight:bold;">${mySteps}</span></div>
                <div style="text-align:center;">
                    <div style="font-size:0.7rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:4px;">Steps</div>
                    <div class="compare-bar-container">
                        <div class="compare-bar-self" style="width: ${(mySteps/maxSteps)*100}%"></div>
                        <div class="compare-bar-friend" style="width: ${(fSteps/maxSteps)*100}%"></div>
                    </div>
                </div>
                <div>Them<br><span style="color:var(--primary); font-weight:bold;">${fSteps}</span></div>
            </div>

            <div class="compare-row">
                <div style="text-align:right;">Me<br><span style="color:var(--accent); font-weight:bold;">${myActiveCals}</span></div>
                <div style="text-align:center;">
                    <div style="font-size:0.7rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:4px;">Active Kcal</div>
                    <div class="compare-bar-container">
                        <div class="compare-bar-self" style="width: ${(myActiveCals/maxActiveCals)*100}%"></div>
                        <div class="compare-bar-friend" style="width: ${(fActiveCals/maxActiveCals)*100}%"></div>
                    </div>
                </div>
                <div>Them<br><span style="color:var(--primary); font-weight:bold;">${fActiveCals}</span></div>
            </div>

            <div class="feed-section-title" style="margin-top: 20px;">Nutrition Status</div>
            
            <div class="compare-row">
                <div style="text-align:right;">Me<br><span style="color:var(--accent); font-weight:bold;">${myCals}</span></div>
                <div style="text-align:center;">
                    <div style="font-size:0.7rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:4px;">Intake Kcal</div>
                    <div class="compare-bar-container">
                        <div class="compare-bar-self" style="width: ${(myCals/maxCals)*100}%"></div>
                        <div class="compare-bar-friend" style="width: ${(fCals/maxCals)*100}%"></div>
                    </div>
                </div>
                <div>Them<br><span style="color:var(--primary); font-weight:bold;">${fCals}</span></div>
            </div>

            <div style="margin-top: 20px; background: var(--bg-base); padding: 10px; border-radius: var(--border-radius-sm); font-size: 0.85rem;">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border-color); padding-bottom: 5px; margin-bottom: 5px;">
                    <span><i class="fa-solid fa-dumbbell text-muted"></i> Sessions Today</span>
                    <span style="font-weight: bold; color: var(--primary);">${fWorkouts.length}</span>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border-color); padding-bottom: 5px; margin-bottom: 5px;">
                    <span><i class="fa-solid fa-book text-muted"></i> Custom Templates</span>
                    <span style="font-weight: bold; color: var(--primary);">${(fData.workout_templates || []).length}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span><i class="fa-solid fa-utensils text-muted"></i> Saved Recipes</span>
                    <span style="font-weight: bold; color: var(--primary);">${friendRecipes.length}</span>
                </div>
            </div>
        `;
        analyticsFeedContainer.appendChild(card);
    }
}

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
    if (!confirm(`Remove connection ${shortIdToRemove}? This will delete the link for both users.`)) return;

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
        
        // Root-level query bypasses nested map errors
        const q = query(usersRef, where("shortId", "==", targetId));
        const querySnapshot = await getDocs(q);

        let foundUserDoc = null;
        
        if (!querySnapshot.empty) {
            foundUserDoc = querySnapshot.docs[0];
        } else {
            // Fallback scan
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

        // 1. Create Outbound Pending Request (Local)
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
            // 2. Push Inbound Pending Request to Target User (Remote)
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
                showMsg(`Request sent to ${targetName}!`, "var(--accent)");
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
