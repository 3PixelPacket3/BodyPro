// social.js - BodyPro Community & Social Integration

import { auth } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- DOM Elements ---
const inputFriendId = document.getElementById('inputFriendId');
const btnAddFriend = document.getElementById('btnAddFriend');
const friendsListContainer = document.getElementById('friendsListContainer');
const activityFeed = document.getElementById('activityFeed');

// --- STATE MANAGEMENT ---
let userData = null;

// --- THE SECURITY GUARD ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }
    userData = await window.BodyProDataStore.getData();
    initializeSocialHub();
});

// --- CORE SOCIAL OPERATIONS ---
function initializeSocialHub() {
    renderFriendsList();
    renderActivityFeed();
}

// 1. Friend Management
function renderFriendsList() {
    friendsListContainer.innerHTML = '';
    const friends = userData.friends || [];

    if (friends.length === 0) {
        friendsListContainer.innerHTML = '<p class="text-muted" style="font-size: 0.9rem; grid-column: 1 / -1;">No active connections. Add a friend using their ID above.</p>';
        return;
    }

    friends.forEach(friend => {
        const item = document.createElement('div');
        item.className = 'friend-card';
        item.innerHTML = `
            <div class="feed-avatar"><i class="fa-solid fa-user"></i></div>
            <div class="friend-name">${friend.name || friend.id}</div>
            <button class="btn btn-ghost" style="margin-left: auto; padding: 5px 10px; border: none; color: var(--danger);" onclick="removeFriend('${friend.id}')">
                <i class="fa-solid fa-user-minus"></i>
            </button>
        `;
        friendsListContainer.appendChild(item);
    });
}

btnAddFriend.addEventListener('click', async () => {
    const newFriendId = inputFriendId.value.trim();
    if (!newFriendId) return alert("Please enter a valid connection ID.");

    // Prevent adding self or duplicates
    if (newFriendId === auth.currentUser.uid) return alert("You cannot add yourself.");
    
    userData.friends = userData.friends || [];
    if (userData.friends.some(f => f.id === newFriendId)) {
        return alert("This user is already in your network.");
    }

    btnAddFriend.disabled = true;
    btnAddFriend.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    // In a full production environment, this would verify the ID exists in the 'users' collection first.
    // For local cloud sync continuity, we simulate a successful push.
    userData.friends.push({
        id: newFriendId,
        name: `User_${newFriendId.substring(0, 5)}`,
        addedAt: new Date().toISOString()
    });

    const success = await window.BodyProDataStore.saveData(userData);

    if (success) {
        inputFriendId.value = '';
        renderFriendsList();
    } else {
        alert("System Error: Failed to update network.");
    }

    btnAddFriend.disabled = false;
    btnAddFriend.innerHTML = '<i class="fa-solid fa-user-plus"></i> Connect';
});

window.removeFriend = async function(friendId) {
    if (confirm("Remove this connection from your network?")) {
        userData.friends = userData.friends.filter(f => f.id !== friendId);
        renderFriendsList();
        await window.BodyProDataStore.saveData(userData);
    }
};

// 2. Activity Feed Rendering
function renderActivityFeed() {
    activityFeed.innerHTML = '';
    
    // Harvest local personal data for the feed to simulate activity 
    // (In production, this queries the public feed collection based on friend IDs)
    const personalRecipes = (userData.custom_recipes || []).map(r => ({
        type: 'recipe',
        timestamp: r.timestamp,
        author: 'You',
        title: r.name,
        details: `${r.macrosPerServing.calories} kcal | ${r.macrosPerServing.protein}g P per serving.`,
        icon: 'fa-mortar-pestle'
    }));

    const personalWorkouts = (userData.workouts || []).map(w => ({
        type: 'workout',
        timestamp: w.timestamp,
        author: 'You',
        title: w.title,
        details: `Completed session in ${Math.round((w.durationLift + w.durationCardio) / 60)} mins. Burned ${w.telemetry?.activeCals || 0} kcal.`,
        icon: 'fa-dumbbell'
    }));

    const combinedFeed = [...personalRecipes, ...personalWorkouts]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 15); // Show latest 15

    if (combinedFeed.length === 0) {
        activityFeed.innerHTML = '<p class="text-muted" style="text-align: center; padding: 20px; font-size: 0.9rem;">The network is quiet. Share a recipe or log a workout to populate the feed.</p>';
        return;
    }

    combinedFeed.forEach(item => {
        const feedEl = document.createElement('div');
        feedEl.className = `feed-item type-${item.type}`;
        
        const timeAgo = Math.round((new Date() - new Date(item.timestamp)) / 60000);
        const timeDisplay = timeAgo < 60 ? `${timeAgo}m ago` : 
                            timeAgo < 1440 ? `${Math.round(timeAgo/60)}h ago` : 
                            `${Math.round(timeAgo/1440)}d ago`;

        feedEl.innerHTML = `
            <div class="feed-header">
                <div class="feed-user-info">
                    <div class="feed-avatar"><i class="fa-solid fa-user"></i></div>
                    <span style="font-weight: 600; font-size: 0.95rem;">${item.author}</span>
                </div>
                <div class="feed-timestamp">${timeDisplay}</div>
            </div>
            <div class="feed-content">
                <h4><i class="fa-solid ${item.icon}" style="margin-right: 8px;"></i>${item.title}</h4>
                <p>${item.details}</p>
            </div>
            <div class="feed-actions">
                <button><i class="fa-regular fa-thumbs-up"></i> Commend</button>
                ${item.type === 'recipe' ? `<button><i class="fa-solid fa-clone"></i> Save to Vault</button>` : ''}
            </div>
        `;
        activityFeed.appendChild(feedEl);
    });
}
