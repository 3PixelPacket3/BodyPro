// data-store.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
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

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// --- GLOBAL OCR ENGINE ---
// Instantiates Tesseract.js dynamically to extract text from user screenshots
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
      let userData = userSnap.exists() ? userSnap.data() : this.getEmptyDB();

      // Ensure all arrays and objects exist to prevent null reference errors
      userData.settings = userData.settings || this.getEmptyDB().settings;
      userData.friends = userData.friends || [];
      userData.profile = userData.profile || {};
      
      // Generate Short ID for Social Connectivity if missing
      if (!userData.profile.shortId) {
         // Secure 6-character alphanumeric identifier
         userData.profile.shortId = Math.random().toString(36).substring(2, 8).toUpperCase();
         // Quietly update the database so the ID is immediately permanent
         setDoc(userRef, { profile: userData.profile }, { merge: true });
      }

      // Apply Theme Engine globally upon data fetch
      if (userData.settings.preferences && userData.settings.preferences.theme) {
          const theme = userData.settings.preferences.theme;
          if (theme === 'system') {
              const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
              document.documentElement.setAttribute('data-theme', prefersLight ? 'light' : 'dark');
          } else {
              document.documentElement.setAttribute('data-theme', theme);
          }
      }
      
      // Fetch subcollections
      const subCollections = ['food_diary', 'workouts', 'biometrics', 'sleep_data', 'custom_recipes'];
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
      
      // Save locally (Instant)
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
          profile: cleanData.profile || {}
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
          syncCollection('custom_recipes', cleanData.custom_recipes || [], oldData.custom_recipes || [])
      ];

      await Promise.all(syncTasks);
  },

  getEmptyDB() {
    return { 
        profile: {
            shortId: null,
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
        custom_recipes: []
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
