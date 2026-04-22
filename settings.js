// social.js - BodyPro Network & Short ID System

import { auth, db } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- DOM ELEMENTS ---
const myShortIdDisplay = document.getElementById('myShortId');
const btnCopyId = document.getElementById('btnCopyId');
const inputFriendId = document.getElementById('inputFriendId');
const btnAddFriend = document.getElementById('btnAddFriend');
const addFriendMsg = document.getElementById('addFriendMsg');
const friendListContainer = document.getElementById('friendListContainer');
const friendCountBadge = document.getElementById('friendCountBadge');
const systemToast = document.getElementById('systemToast');

// --- STATE MANAGEMENT ---
let userData = null;

// --- INITIALIZATION ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }

    userData = await window.BodyProDataStore.getData();
    
    // Safety Net
    if (!userData.friends) userData.friends = [];
    if (!userData.profile) userData.profile = {};

    // Generate Short ID if missing (Fallback, primarily handled in data-store.js)
    if (!userData.profile.shortId) {
        userData.profile.shortId = Math.random().toString(36).substring(2, 8).toUpperCase();
        await window.BodyProDataStore.saveData(userData);
    }

    renderNetworkUI();
});

// --- RENDER UI ---
function renderNetworkUI() {
    // 1. Display Personal ID
    myShortIdDisplay.innerText = userData.profile.shortId || "ERROR";

    // 2. Render Friends List
    friendListContainer.innerHTML = '';
    
    if (userData.friends.length === 0) {
        friendListContainer.innerHTML = `
            <div style="text-align: center; padding: 30px 20px; color: var(--text-muted); font-size: 0.9rem; background: var(--bg-surface-elevated); border-radius: var(--border-radius-sm); border: 1px dashed var(--border-color);">
                <i class="fa-solid fa-ghost" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5;"></i><br>
                Your network is currently empty.<br>Add friends using their 6-character ID.
            </div>
        `;
        friendCountBadge.innerText = "0 Connections";
        return;
    }

    friendCountBadge.innerText = `${userData.friends.length} Connection${userData.friends.length !== 1 ? 's' : ''}`;

    userData.friends.forEach(friend => {
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

// --- GLOBAL ATTACHMENT FOR REMOVE FRIEND ---
// Because it's injected via innerHTML, we need it on the window object
window.removeFriend = async function(shortIdToRemove) {
    if (!confirm(`Are you sure you want to remove connection ${shortIdToRemove} from your network?`)) return;

    userData.friends = userData.friends.filter(f => f.shortId !== shortIdToRemove);
    
    const success = await window.BodyProDataStore.saveData(userData);
    if (success) {
        showToast("Connection removed.", "var(--danger)");
        renderNetworkUI();
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

// --- ADD CONNECTION LOGIC ---
btnAddFriend.addEventListener('click', async () => {
    const targetId = inputFriendId.value.trim().toUpperCase();

    // Validation
    if (targetId.length !== 6) {
        showMsg("Invalid ID format. Must be 6 characters.", "var(--danger)");
        return;
    }
    
    if (targetId === userData.profile.shortId) {
        showMsg("You cannot add yourself to your own network.", "var(--warning)");
        return;
    }

    if (userData.friends.some(f => f.shortId === targetId)) {
        showMsg("This user is already in your network.", "var(--warning)");
        return;
    }

    // UI Feedback
    btnAddFriend.disabled = true;
    btnAddFriend.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    showMsg("Searching cloud registry...", "var(--text-muted)");

    try {
        // Query Firestore for the Target Short ID
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("profile.shortId", "==", targetId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            showMsg(`No account found with ID: ${targetId}`, "var(--danger)");
            btnAddFriend.disabled = false;
            btnAddFriend.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';
            return;
        }

        // Target Found
        let foundUserDoc = null;
        querySnapshot.forEach((doc) => { foundUserDoc = doc; }); // Should only be one
        
        const targetData = foundUserDoc.data();
        const targetName = targetData.profile?.displayName || "BodyPro User";

        // Add to local array
        userData.friends.push({
            uid: foundUserDoc.id,
            shortId: targetId,
            displayName: targetName,
            addedAt: new Date().toISOString()
        });

        // Sync to cloud
        const success = await window.BodyProDataStore.saveData(userData);
        
        if (success) {
            showMsg(`Successfully connected with ${targetName}!`, "var(--accent)");
            inputFriendId.value = '';
            renderNetworkUI();
        } else {
            showMsg("Failed to synchronize network update.", "var(--danger)");
        }

    } catch (error) {
        console.error("Network Search Error:", error);
        showMsg("Cloud query failed. Check connection.", "var(--danger)");
    } finally {
        btnAddFriend.disabled = false;
        btnAddFriend.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';
    }
});

// --- HELPER FUNCTIONS ---
function showMsg(text, color) {
    addFriendMsg.style.display = 'block';
    addFriendMsg.style.color = color;
    addFriendMsg.innerText = text;
    
    // Auto-hide after 4 seconds unless it's a loading state
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
        // Reset color after hide
        setTimeout(() => { systemToast.style.backgroundColor = "var(--accent)"; }, 400);
    }, 3000);
}
