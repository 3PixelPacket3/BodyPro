// social.js - BodyPro Identity & Social Network Logic

import { auth } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- DOM Elements ---
const myNetworkId = document.getElementById('myNetworkId');
const btnCopyId = document.getElementById('btnCopyId');

const inputFriendId = document.getElementById('inputFriendId');
const btnSendRequest = document.getElementById('btnSendRequest');
const friendListContainer = document.getElementById('friendListContainer');

const postContentInput = document.getElementById('postContentInput');
const postVisibility = document.getElementById('postVisibility');
const btnSubmitPost = document.getElementById('btnSubmitPost');
const socialFeedContainer = document.getElementById('socialFeedContainer');

// --- STATE MANAGEMENT ---
let userData = null;
let currentTab = 'active'; // 'active', 'pending', 'blocked'

// --- THE SECURITY GUARD ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }
    
    // Display Network Identity (Using Firebase UID as the basis)
    myNetworkId.innerText = user.uid;
    
    userData = await window.BodyProDataStore.getData();
    
    // Ensure Social Architecture Exists
    if (!userData.social) {
        userData.social = {
            friends: [],
            pending: [{ id: 'SYS-8675309', name: 'BodyPro System', type: 'inbound' }], // Mock pending for UI demonstration
            blocked: [],
            posts: []
        };
    }

    renderFriendsList(currentTab);
    renderFeed();
});

// --- IDENTITY PROTOCOLS ---
btnCopyId.addEventListener('click', () => {
    navigator.clipboard.writeText(myNetworkId.innerText).then(() => {
        const originalText = btnCopyId.innerHTML;
        btnCopyId.innerHTML = '<i class="fa-solid fa-check"></i> Copied to Clipboard';
        btnCopyId.style.color = 'var(--primary)';
        
        setTimeout(() => {
            btnCopyId.innerHTML = originalText;
            btnCopyId.style.color = '';
        }, 2000);
    }).catch(err => {
        console.error("Clipboard sequence failed: ", err);
    });
});

// --- CONNECTION MANAGEMENT ---
window.renderFriendsList = function(tabName) {
    currentTab = tabName;
    friendListContainer.innerHTML = '';
    
    let listToRender = [];
    if (tabName === 'active') listToRender = userData.social.friends || [];
    if (tabName === 'pending') listToRender = userData.social.pending || [];
    if (tabName === 'blocked') listToRender = userData.social.blocked || [];

    if (listToRender.length === 0) {
        friendListContainer.innerHTML = `<p class="text-muted" style="text-align: center; padding: 20px; font-size: 0.9rem;">No entries found in ${tabName} directory.</p>`;
        return;
    }

    listToRender.forEach(person => {
        const item = document.createElement('div');
        item.className = 'friend-item';
        
        let actionsHtml = '';
        if (tabName === 'active') {
            actionsHtml = `<button class="btn-block" onclick="blockUser('${person.id}')" title="Block"><i class="fa-solid fa-ban"></i></button>`;
        } else if (tabName === 'pending') {
            actionsHtml = `
                <button class="btn-accept" onclick="acceptRequest('${person.id}')" title="Accept"><i class="fa-solid fa-check"></i></button>
                <button class="btn-reject" onclick="rejectRequest('${person.id}')" title="Reject"><i class="fa-solid fa-xmark"></i></button>
            `;
        } else if (tabName === 'blocked') {
            actionsHtml = `<button class="btn-accept" onclick="unblockUser('${person.id}')" title="Unblock"><i class="fa-solid fa-unlock"></i></button>`;
        }

        item.innerHTML = `
            <div class="friend-info">
                <div class="friend-avatar">${(person.name || '?').charAt(0).toUpperCase()}</div>
                <div>
                    <div style="font-weight: 700; font-size: 0.95rem;">${person.name || 'Unknown User'}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">ID: ${person.id.substring(0, 8)}...</div>
                </div>
            </div>
            <div class="friend-actions">
                ${actionsHtml}
            </div>
        `;
        friendListContainer.appendChild(item);
    });
};

// Simulated Connection Logic (Local State Updating)
btnSendRequest.addEventListener('click', async () => {
    const targetId = inputFriendId.value.trim();
    if (!targetId) return alert("Please specify a Network ID.");
    if (targetId === myNetworkId.innerText) return alert("You cannot initiate a connection with yourself.");
    
    btnSendRequest.disabled = true;
    btnSendRequest.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    // Simulate Network Delay
    setTimeout(async () => {
        alert(`Connection request transmitted to ID: ${targetId}`);
        inputFriendId.value = '';
        btnSendRequest.disabled = false;
        btnSendRequest.innerHTML = '<i class="fa-solid fa-user-plus"></i>';
    }, 800);
});

window.acceptRequest = async function(id) {
    const person = userData.social.pending.find(p => p.id === id);
    if (person) {
        userData.social.pending = userData.social.pending.filter(p => p.id !== id);
        userData.social.friends.push(person);
        await window.BodyProDataStore.saveData(userData);
        renderFriendsList(currentTab);
    }
};

window.rejectRequest = async function(id) {
    userData.social.pending = userData.social.pending.filter(p => p.id !== id);
    await window.BodyProDataStore.saveData(userData);
    renderFriendsList(currentTab);
};

window.blockUser = async function(id) {
    if(confirm("Are you sure you want to block this connection?")) {
        const person = userData.social.friends.find(p => p.id === id);
        if (person) {
            userData.social.friends = userData.social.friends.filter(p => p.id !== id);
            userData.social.blocked.push(person);
            await window.BodyProDataStore.saveData(userData);
            renderFriendsList(currentTab);
        }
    }
};

window.unblockUser = async function(id) {
    const person = userData.social.blocked.find(p => p.id === id);
    if (person) {
        userData.social.blocked = userData.social.blocked.filter(p => p.id !== id);
        // Returns to neutral space, not automatically back to friends
        await window.BodyProDataStore.saveData(userData);
        renderFriendsList(currentTab);
    }
};

// --- FEED & BROADCAST PROTOCOLS ---
btnSubmitPost.addEventListener('click', async () => {
    const content = postContentInput.value.trim();
    const visibility = postVisibility.value;

    if (!content) return;

    btnSubmitPost.disabled = true;
    btnSubmitPost.innerText = 'Broadcasting...';

    const newPost = {
        id: 'post_' + Date.now(),
        authorName: auth.currentUser.displayName || "Joshua",
        content: content,
        visibility: visibility,
        timestamp: new Date().toISOString(),
        likes: 0,
        likedByMe: false,
        comments: []
    };

    userData.social.posts.unshift(newPost);
    await window.BodyProDataStore.saveData(userData);

    postContentInput.value = '';
    btnSubmitPost.disabled = false;
    btnSubmitPost.innerText = 'Post';
    
    renderFeed();
});

function compileTimeline() {
    let timeline = [...(userData.social.posts || [])];

    // Inject automated system posts from Workouts
    if (userData.workouts) {
        userData.workouts.forEach(wk => {
            timeline.push({
                id: 'sys_' + wk.id,
                isSystem: true,
                authorName: auth.currentUser.displayName || "Joshua",
                content: `Completed a training session: <strong>${wk.title || 'Untitled Session'}</strong>. <br>Duration: ${Math.round((wk.durationLift + wk.durationCardio)/60)} mins | Cals: ${wk.telemetry?.activeCals || 0}`,
                timestamp: wk.timestamp,
                likes: 0,
                likedByMe: false,
                comments: []
            });
        });
    }

    // Sort by chronological recency
    timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return timeline;
}

function renderFeed() {
    socialFeedContainer.innerHTML = '';
    const timeline = compileTimeline();

    if (timeline.length === 0) {
        socialFeedContainer.innerHTML = '<p class="text-muted" style="text-align: center; padding: 20px; font-size: 0.9rem;">Timeline is empty. Be the first to broadcast.</p>';
        return;
    }

    timeline.forEach(post => {
        const postDate = new Date(post.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const el = document.createElement('div');
        el.className = 'feed-post';
        
        let commentsHtml = '';
        if (post.comments && post.comments.length > 0) {
            commentsHtml = post.comments.map(c => `
                <div class="comment-item">
                    <strong>${c.authorName}:</strong> ${c.text}
                </div>
            `).join('');
        } else {
            commentsHtml = '<div class="text-muted" style="font-size: 0.8rem; margin-bottom: 10px;">No comments yet.</div>';
        }

        let visibilityIcon = 'fa-earth-americas';
        if (post.visibility === 'friends') visibilityIcon = 'fa-user-group';
        if (post.visibility === 'private') visibilityIcon = 'fa-lock';
        if (post.isSystem) visibilityIcon = 'fa-robot text-accent';

        el.innerHTML = `
            <div class="feed-header">
                <div class="feed-author">
                    <div class="friend-avatar" style="width: 32px; height: 32px; font-size: 0.8rem;">${post.authorName.charAt(0)}</div>
                    ${post.authorName}
                </div>
                <div class="feed-meta">
                    ${postDate} <i class="fa-solid ${visibilityIcon}" style="margin-left: 5px;" title="${post.visibility || 'System'}"></i>
                </div>
            </div>
            <div class="feed-content">
                ${post.content}
            </div>
            <div class="feed-actions">
                <button class="feed-action-btn ${post.likedByMe ? 'active' : ''}" onclick="toggleLike('${post.id}')">
                    <i class="${post.likedByMe ? 'fa-solid' : 'fa-regular'} fa-heart"></i> ${post.likes || 0}
                </button>
                <button class="feed-action-btn" onclick="toggleCommentSection('${post.id}')">
                    <i class="fa-regular fa-comment"></i> ${(post.comments || []).length}
                </button>
            </div>
            
            <div class="comments-section" id="comments_${post.id}">
                ${commentsHtml}
                <div class="comment-input-group">
                    <input type="text" id="input_comment_${post.id}" placeholder="Write a comment..." onkeypress="handleCommentKeypress(event, '${post.id}')">
                    <button class="btn btn-ghost" onclick="submitComment('${post.id}')" style="padding: 0 12px;"><i class="fa-solid fa-paper-plane"></i></button>
                </div>
            </div>
        `;
        socialFeedContainer.appendChild(el);
    });
}

// Interaction Methods
window.toggleLike = async function(postId) {
    // Only manual posts can be liked in this local simulation
    if (postId.startsWith('sys_')) return alert("System achievements cannot be modified.");

    let post = userData.social.posts.find(p => p.id === postId);
    if (post) {
        post.likedByMe = !post.likedByMe;
        post.likes = post.likedByMe ? (post.likes + 1) : Math.max(0, post.likes - 1);
        await window.BodyProDataStore.saveData(userData);
        renderFeed();
    }
};

window.toggleCommentSection = function(postId) {
    const section = document.getElementById(`comments_${postId}`);
    if (section) section.classList.toggle('open');
};

window.handleCommentKeypress = function(e, postId) {
    if (e.key === 'Enter') {
        submitComment(postId);
    }
};

window.submitComment = async function(postId) {
    if (postId.startsWith('sys_')) return alert("System achievements cannot accept comments locally.");

    const input = document.getElementById(`input_comment_${postId}`);
    const text = input.value.trim();
    if (!text) return;

    let post = userData.social.posts.find(p => p.id === postId);
    if (post) {
        post.comments = post.comments || [];
        post.comments.push({
            authorName: auth.currentUser.displayName || "Joshua",
            text: text,
            timestamp: new Date().toISOString()
        });
        
        await window.BodyProDataStore.saveData(userData);
        renderFeed();
        
        // Re-open the comments section to view the new post
        setTimeout(() => document.getElementById(`comments_${postId}`).classList.add('open'), 50);
    }
};
