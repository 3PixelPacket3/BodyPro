// data-store.js

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, doc, getDoc, setDoc, collection, getDocs, 
    writeBatch, onSnapshot, query, where, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- FIREBASE CLOUD CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyAzypNcFKXffht__mmpQdPOMJEzr4mhWgs",
  authDomain: "bodypro-dbe6d.firebaseapp.com",
  projectId: "bodypro-dbe6d",
  storageBucket: "bodypro-dbe6d.firebasestorage.app",
  messagingSenderId: "349697173130",
  appId: "1:349697173130:web:c6a1912672aa89fa2b2f73",
  measurementId: "G-CGWF3TCQL8"
};

// CRITICAL FIX: Singleton Check to prevent duplicate-app console errors across pages
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

// --- GLOBAL OCR ENGINE ---
window.BodyProOCR = {
    async scanImage(imageFile) {
        if (!window.Tesseract) {
            console.log("[BodyPro System] Injecting Tesseract.js for Optical Character Recognition...");
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        console.log("[BodyPro System] Analyzing optical telemetry...");
        const worker = await window.Tesseract.createWorker('eng');
        const ret = await worker.recognize(imageFile);
        await worker.terminate();
        return ret.data.text;
    }
};

window.BodyProDataStore = {
  DB_NAME: 'BodyProDatabase',
  STORE_NAME: 'bodypro_store',
  MASTER_KEY: 'bodypro_master_db',
  
  isSyncing: false,
  _syncFallbackTimer: null,

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  },

  async getIndexedData(key) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async setIndexedData(key, value) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put(value, key);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  async getData() {
    const user = auth.currentUser;
    if (!user) {
      return await this.getIndexedData(this.MASTER_KEY) || this.getEmptyDB();
    }

    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      
      let userData;
      let forceCloudInit = false;

      // CRITICAL FIX: The Phantom Profile Resolution
      if (userSnap.exists()) {
          userData = userSnap.data();
      } else {
          // The user authenticated, but no database document exists yet.
          // Recover from local storage if possible to prevent wiping data, otherwise build from scratch.
          const localData = await this.getIndexedData(this.MASTER_KEY);
          userData = localData || this.getEmptyDB();
          forceCloudInit = true; // We MUST push this to the cloud instantly so they become searchable
      }

      userData.settings = userData.settings || this.getEmptyDB().settings;
      userData.friends = userData.friends || [];
      userData.profile = userData.profile || {};
      
      // Sync templates
      userData.workout_templates = userData.workout_templates || [];
      userData.custom_workouts = userData.custom_workouts || [];
      
      // Secondary safety check: Document exists but somehow lacks an ID
      if (!userData.profile.shortId) {
         userData.profile.shortId = Math.random().toString(36).substring(2, 8).toUpperCase();
         forceCloudInit = true;
      }

      // Execute the immediate cloud stamp if necessary
      if (forceCloudInit) {
          console.log("[BodyPro System] Initializing core profile in cloud registry...");
          await setDoc(userRef, { 
              profile: userData.profile,
              settings: userData.settings,
              friends: userData.friends,
              shortId: userData.profile.shortId, // Lifted to root for robust social queries
              workout_templates: userData.workout_templates,
              custom_workouts: userData.custom_workouts
          }, { merge: true });
      }

      if (userData.settings.preferences && userData.settings.preferences.theme) {
          const theme = userData.settings.preferences.theme;
          if (theme === 'system') {
              const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
              document.documentElement.setAttribute('data-theme', prefersLight ? 'light' : 'dark');
          } else {
              document.documentElement.setAttribute('data-theme', theme);
          }
      }
      
      // Included favorite_foods collection
      const subCollections = ['food_diary', 'workouts', 'biometrics', 'sleep_data', 'custom_recipes', 'favorite_foods'];
      const userColPromises = subCollections.map(async (colName) => {
          const colRef = collection(db, "users", user.uid, colName);
          const snap = await getDocs(colRef);
          userData[colName] = [];
          snap.forEach(doc => userData[colName].push({ id: doc.id, ...doc.data() }));
      });

      await Promise.all(userColPromises);

      await this.setIndexedData(this.MASTER_KEY, userData);
      return userData;

    } catch (error) {
      console.error("Cloud Sync failed. Falling back to local encrypted store.", error);
      return await this.getIndexedData(this.MASTER_KEY) || this.getEmptyDB();
    }
  },

  async saveData(dataObj) {
    const user = auth.currentUser;
    if (!user) return false;

    try {
      const oldDataObj = await this.getIndexedData(this.MASTER_KEY) || this.getEmptyDB();
      const cleanData = JSON.parse(JSON.stringify(dataObj));
      
      await this.setIndexedData(this.MASTER_KEY, cleanData);

      this.isSyncing = true;
      clearTimeout(this._syncFallbackTimer);
      this._syncFallbackTimer = setTimeout(() => {
          this.isSyncing = false;
      }, 2500);

      window.dispatchEvent(new CustomEvent('bodypro-sync-start'));

      this._executeCloudSync(user, cleanData, oldDataObj)
        .then(() => {
          this.isSyncing = false;
          window.dispatchEvent(new CustomEvent('bodypro-sync-complete'));
        })
        .catch(err => {
          console.error("Background Sync Error:", err);
          this.isSyncing = false;
          window.dispatchEvent(new CustomEvent('bodypro-sync-error'));
        });

      return true;

    } catch (error) {
      console.error("Critical save failure.", error);
      return false;
    }
  },

  async _executeCloudSync(user, cleanData, oldData) {
      const userRef = doc(db, "users", user.uid);
      
      const topLevelPromise = setDoc(userRef, { 
          settings: cleanData.settings || {},
          friends: cleanData.friends || [],
          profile: cleanData.profile || {},
          shortId: cleanData.profile?.shortId || "", 
          workout_templates: cleanData.workout_templates || [], 
          custom_workouts: cleanData.custom_workouts || []     
      }, { merge: true }); 

      const syncCollection = async (colName, newItems, oldItems, basePath = ["users", user.uid]) => {
          const batch = writeBatch(db);
          let operations = 0;

          const oldMap = new Map();
          (oldItems || []).forEach(d => oldMap.set(d.id, d));

          newItems.forEach(item => {
              if(!item.id) item.id = 'bp_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
              const docRef = doc(db, ...basePath, colName, item.id);
              
              const existingData = oldMap.get(item.id);
              if (!existingData || JSON.stringify(existingData) !== JSON.stringify(item)) {
                  batch.set(docRef, item);
                  operations++;
              }
              oldMap.delete(item.id);
          });

          oldMap.forEach((_, id) => {
              const docRef = doc(db, ...basePath, colName, id);
              batch.delete(docRef);
              operations++;
          });

          if (operations > 0) {
              return batch.commit();
          }
          return Promise.resolve();
      };

      const syncTasks = [
          topLevelPromise,
          syncCollection('food_diary', cleanData.food_diary || [], oldData.food_diary || []),
          syncCollection('workouts', cleanData.workouts || [], oldData.workouts || []),
          syncCollection('biometrics', cleanData.biometrics || [], oldData.biometrics || []),
          syncCollection('sleep_data', cleanData.sleep_data || [], oldData.sleep_data || []),
          syncCollection('custom_recipes', cleanData.custom_recipes || [], oldData.custom_recipes || []),
          syncCollection('favorite_foods', cleanData.favorite_foods || [], oldData.favorite_foods || [])
      ];

      await Promise.all(syncTasks);
  },

  // --- NEW: CROSS-USER CLOUD SYNC FOR SOCIAL REQUESTS ---
  async pushCrossUserFriendUpdate(targetUid, newTargetFriendsArray) {
      try {
          const targetRef = doc(db, "users", targetUid);
          await setDoc(targetRef, { friends: newTargetFriendsArray }, { merge: true });
          return true;
      } catch(err) {
          console.error("Cross-user sync failed. Ensure Firestore Security Rules allow social updates.", err);
          return false;
      }
  },

  // --- NEW: FETCH SPECIFIC FRIEND TELEMETRY (Avoids pulling whole DB) ---
  async fetchFriendTelemetry(friendUid) {
      try {
          const userRef = doc(db, "users", friendUid);
          const userSnap = await getDoc(userRef);
          if(!userSnap.exists()) return null;

          const friendData = userSnap.data();
          friendData.uid = friendUid;

          // Only fetch today's data to keep queries light and preserve privacy
          const today = new Date().toISOString().split('T')[0];

          const workoutsRef = collection(db, "users", friendUid, "workouts");
          const wSnap = await getDocs(workoutsRef);
          friendData.workouts = [];
          wSnap.forEach(d => friendData.workouts.push(d.data()));

          const foodRef = collection(db, "users", friendUid, "food_diary");
          const qFood = query(foodRef, where("date", "==", today));
          const fSnap = await getDocs(qFood);
          friendData.food_diary = [];
          fSnap.forEach(d => friendData.food_diary.push(d.data()));

          const bioRef = collection(db, "users", friendUid, "biometrics");
          const qBio = query(bioRef, where("date", "==", today));
          const bSnap = await getDocs(qBio);
          friendData.biometrics = [];
          bSnap.forEach(d => friendData.biometrics.push(d.data()));

          return friendData;
      } catch(err) {
          console.error("Failed to fetch friend telemetry", err);
          return null;
      }
  },

  getEmptyDB() {
    return { 
        profile: {
            shortId: Math.random().toString(36).substring(2, 8).toUpperCase(),
            displayName: "",
            age: null,
            sex: "male",
            heightInches: null,
            goalWeight: null,
            activityLevel: 1.2,
            objective: "maintain"
        },
        settings: {
            preferences: {
                theme: 'dark',
                weightUnit: 'lbs',
                fluidUnit: 'oz',
                timeFormat: '12',
                defaultMeal: 'Snacks'
            },
            macroTargets: {
                calories: 2200,
                protein: 200,
                carbs: 150,
                fats: 88
            },
            goals: {
                weeklyWeightLoss: 1.5,
                workoutDaysPerWeek: 6,
                targetLiftingMinutes: 90,
                targetCardioMinutes: 20,
                sleepHrs: 7.5,
                steps: 10000,
                floors: 10,
                waterOz: 120
            },
            dailySupplements: [
                { name: "Creatine", logged: false },
                { name: "Protein Powder", logged: false },
                { name: "Pre-workout (C4 Original)", logged: false },
                { name: "Essential Amino Energy (ON)", logged: false },
                { name: "Multivitamin", logged: false }
            ]
        },
        friends: [],
        food_diary: [], 
        workouts: [], 
        biometrics: [], 
        sleep_data: [], 
        custom_recipes: [],
        favorite_foods: [],
        workout_templates: [],
        custom_workouts: []
    };
  }
};

window.addEventListener('beforeunload', (e) => {
  if (window.BodyProDataStore && window.BodyProDataStore.isSyncing) {
    e.preventDefault();
    e.returnValue = 'Data synchronization in progress. Leaving now may result in lost telemetry. Please hold.';
    return e.returnValue;
  }
});
