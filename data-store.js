// data-store.js - BodyPro Core Cloud, Offline Sync, OCR, Telemetry & Mobile Hardware Engine

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

// Singleton Check to prevent duplicate-app console errors across pages
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

// --- NATIVE HAPTICS & WEB AUDIO SYNTHESIZER ENGINE (iOS / Android Ready) ---
window.BodyProHardware = {
    audioCtx: null,
    wakeLock: null,

    initAudio() {
        if (!this.audioCtx && (window.AudioContext || window.webkitAudioContext)) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioCtx();
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
    },

    vibrate(pattern = [40]) {
        try {
            if (navigator.vibrate) navigator.vibrate(pattern);
        } catch (e) {}
    },

    playTone(freq = 880, durationMs = 150, type = 'sine', gainVal = 0.15) {
        try {
            this.initAudio();
            if (!this.audioCtx) return;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
            gain.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + durationMs / 1000);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start();
            osc.stop(this.audioCtx.currentTime + durationMs / 1000);
        } catch (e) {}
    },

    playRestCompleteAlarm() {
        this.vibrate([200, 100, 200, 100, 400]);
        this.playTone(587.33, 140, 'triangle', 0.2); // D5
        setTimeout(() => this.playTone(783.99, 140, 'triangle', 0.2), 160); // G5
        setTimeout(() => this.playTone(1174.66, 350, 'triangle', 0.25), 320); // D6
    },

    playPRCelebration() {
        this.vibrate([100, 50, 100, 50, 300]);
        this.playTone(523.25, 120, 'sine', 0.2); // C5
        setTimeout(() => this.playTone(659.25, 120, 'sine', 0.2), 130); // E5
        setTimeout(() => this.playTone(783.99, 120, 'sine', 0.2), 260); // G5
        setTimeout(() => this.playTone(1046.50, 350, 'sine', 0.25), 390); // C6
    },

    playCheckSound() {
        this.vibrate([25]);
        this.playTone(880, 70, 'sine', 0.08);
    },

    async requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
                return true;
            } catch (e) {
                return false;
            }
        }
        return false;
    },

    async releaseWakeLock() {
        if (this.wakeLock) {
            try {
                await this.wakeLock.release();
                this.wakeLock = null;
            } catch (e) {}
        }
    },

    async compressImage(file, maxWidth = 720, quality = 0.72) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let w = img.width;
                    let h = img.height;
                    if (w > maxWidth) {
                        h = Math.round((h * maxWidth) / w);
                        w = maxWidth;
                    }
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
};

// --- UNIT CONVERSION & TELEMETRY INTELLIGENCE ENGINE ---
window.BodyProUnits = {
    getWeightUnit(userData) {
        return userData?.settings?.preferences?.weightUnit || 'lbs';
    },
    getFluidUnit(userData) {
        return userData?.settings?.preferences?.fluidUnit || 'oz';
    },
    formatWeight(lbsVal, userData, decimals = 1) {
        if (lbsVal === null || lbsVal === undefined || isNaN(lbsVal)) return '--';
        const unit = this.getWeightUnit(userData);
        const val = unit === 'kg' ? (parseFloat(lbsVal) * 0.45359237) : parseFloat(lbsVal);
        return Number(val).toFixed(decimals);
    },
    toInternalLbs(inputVal, userData) {
        const val = parseFloat(inputVal);
        if (isNaN(val)) return 0;
        const unit = this.getWeightUnit(userData);
        return unit === 'kg' ? +(val / 0.45359237).toFixed(2) : val;
    },
    formatFluid(ozVal, userData) {
        if (ozVal === null || ozVal === undefined || isNaN(ozVal)) return '0';
        const unit = this.getFluidUnit(userData);
        const val = unit === 'ml' ? Math.round(parseFloat(ozVal) * 29.5735) : Math.round(parseFloat(ozVal));
        return String(val);
    },
    toInternalOz(inputVal, userData) {
        const val = parseFloat(inputVal);
        if (isNaN(val)) return 0;
        const unit = this.getFluidUnit(userData);
        return unit === 'ml' ? +(val / 29.5735).toFixed(1) : val;
    }
};

window.BodyProTelemetry = {
    getLocalISODate(dateObj = new Date()) {
        const offset = dateObj.getTimezoneOffset() * 60000;
        return (new Date(dateObj - offset)).toISOString().split('T')[0];
    },

    calculateReadiness(userData) {
        const todayStr = this.getLocalISODate();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = this.getLocalISODate(yesterday);

        const sleepGoal = userData?.settings?.goals?.sleepHrs || 7.5;
        const waterGoal = userData?.settings?.goals?.waterOz || 120;

        // Check today or yesterday sleep
        const sleepEntries = [...(userData?.sleep_data || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
        const recentSleep = sleepEntries.find(s => s.date === todayStr || s.date === yesterdayStr);
        const todayBio = (userData?.biometrics || []).find(b => b.date === todayStr) || {};
        const sleepHours = recentSleep?.hours || todayBio?.sleepHrs || null;
        const sleepQuality = recentSleep?.quality || todayBio?.sleepQuality || 7; // 1-10

        // Sleep Component (0-45 pts)
        let sleepScore = 34; // Baseline if unlogged
        if (sleepHours !== null && sleepHours > 0) {
            const ratio = Math.min(1.15, sleepHours / sleepGoal);
            sleepScore = Math.min(45, Math.round(ratio * 32 + (sleepQuality / 10) * 13));
        }

        // Recovery / Strain Component (0-30 pts) based on trailing 3 days workout load
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const recentWorkouts = (userData?.workouts || []).filter(w => new Date(w.timestamp) >= threeDaysAgo);
        let strainPts = 28;
        if (recentWorkouts.length >= 4) strainPts = 18; // High cumulative fatigue
        else if (recentWorkouts.length === 3) strainPts = 23;
        else if (recentWorkouts.length >= 1) strainPts = 28;

        // Hydration & RHR Component (0-25 pts)
        let vitalsPts = 20;
        const water = todayBio.waterOz || todayBio.water || 0;
        if (water > 0) {
            vitalsPts = Math.min(25, 15 + Math.round(Math.min(1, water / waterGoal) * 10));
        }
        if (todayBio.hr) {
            const rhr = parseInt(todayBio.hr);
            if (rhr > 0 && rhr <= 65) vitalsPts = Math.min(25, vitalsPts + 3);
            else if (rhr > 85) vitalsPts = Math.max(10, vitalsPts - 5);
        }

        const total = Math.max(25, Math.min(100, sleepScore + strainPts + vitalsPts));
        let status = "Optimal Readiness";
        let color = "var(--accent)";
        let advice = "Central nervous system primed. Push for progressive overload or PRs today.";

        if (total < 60) {
            status = "Recovery Prioritized";
            color = "var(--danger)";
            advice = "Elevated fatigue or sleep debt detected. Consider mobility, zone-2 cardio, or Time-Crunch mode.";
        } else if (total < 80) {
            status = "Moderate Readiness";
            color = "var(--warning)";
            advice = "Solid baseline. Maintain working volume at RPE 7–8 and prioritize hydration.";
        }

        return {
            score: total,
            status,
            color,
            advice,
            sleepHours: sleepHours || '--',
            sleepQuality: sleepHours ? `${sleepQuality}/10` : '--',
            recentWorkoutsCount: recentWorkouts.length
        };
    },

    calculateAdaptiveTDEE(userData) {
        // Uses rolling 14-day nutrition & weight trend to estimate empirical maintenance calories
        const bio = [...(userData?.biometrics || [])].filter(b => b.weight > 0).sort((a, b) => new Date(a.date) - new Date(b.date));
        const foods = userData?.food_diary || [];

        // Fallback formula-based TDEE if insufficient logs
        const p = userData?.profile || {};
        const latestW = bio.length > 0 ? parseFloat(bio[bio.length - 1].weight) : 180;
        const wKg = latestW * 0.453592;
        const hCm = (parseFloat(p.heightInches) || 69) * 2.54;
        const age = parseInt(p.age) || 26;
        const act = parseFloat(p.activityLevel) || 1.375;
        const bmr = p.sex === 'female'
            ? (10 * wKg) + (6.25 * hCm) - (5 * age) - 161
            : (10 * wKg) + (6.25 * hCm) - (5 * age) + 5;
        const formulaTDEE = Math.round(bmr * act);

        // Group daily calories over last 14 days
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 14);
        const cutoffStr = this.getLocalISODate(cutoff);

        const dailyMap = {};
        foods.filter(f => f.date >= cutoffStr).forEach(f => {
            dailyMap[f.date] = (dailyMap[f.date] || 0) + (Number(f.calories) || 0);
        });
        const loggedDays = Object.values(dailyMap).filter(c => c >= 800);
        const recentWeights = bio.filter(b => b.date >= cutoffStr);

        if (loggedDays.length >= 4 && recentWeights.length >= 2) {
            const avgIntake = loggedDays.reduce((a, b) => a + b, 0) / loggedDays.length;
            const firstW = parseFloat(recentWeights[0].weight);
            const lastW = parseFloat(recentWeights[recentWeights.length - 1].weight);
            const daySpan = Math.max(1, (new Date(recentWeights[recentWeights.length - 1].date) - new Date(recentWeights[0].date)) / (1000 * 60 * 60 * 24));
            const weightDeltaPerDay = (lastW - firstW) / daySpan;
            // 1 lb body mass ~ 3500 kcal
            const empiricalTDEE = Math.round(avgIntake - (weightDeltaPerDay * 3500));
            const clampedTDEE = Math.max(1200, Math.min(5000, Math.round((empiricalTDEE * 0.6) + (formulaTDEE * 0.4))));
            return {
                tdee: clampedTDEE,
                avgIntake: Math.round(avgIntake),
                confidence: "High (Empirical Telemetry)",
                weightRateWeekly: +(weightDeltaPerDay * 7).toFixed(2),
                currentWeight: lastW,
                goalWeight: parseFloat(p.goalWeight) || null
            };
        }

        return {
            tdee: formulaTDEE,
            avgIntake: loggedDays.length > 0 ? Math.round(loggedDays.reduce((a, b) => a + b, 0) / loggedDays.length) : (userData?.settings?.macroTargets?.calories || 2200),
            confidence: "Estimated (Mifflin-St Jeor)",
            weightRateWeekly: 0,
            currentWeight: latestW,
            goalWeight: parseFloat(p.goalWeight) || null
        };
    }
};

// --- GLOBAL OCR ENGINE WITH NUTRITION FACTS PARSER ---
window.BodyProOCR = {
    async scanImage(imageFile) {
        if (!window.Tesseract) {
            console.log("[BodyPro System] Injecting Tesseract.js for Optical Character Recognition...");
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/tesseract.min.js';
                script.onerror = () => {
                    const fallback = document.createElement('script');
                    fallback.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
                    fallback.onload = resolve;
                    fallback.onerror = reject;
                    document.head.appendChild(fallback);
                };
                script.onload = resolve;
                document.head.appendChild(script);
            });
        }
        
        console.log("[BodyPro System] Analyzing optical telemetry...");
        const worker = await window.Tesseract.createWorker('eng');
        const ret = await worker.recognize(imageFile);
        await worker.terminate();
        return ret.data.text;
    },

    parseNutritionText(rawText) {
        const text = (rawText || '').replace(/\r/g, ' ').replace(/\n/g, ' ');
        const extract = (regex) => {
            const match = text.match(regex);
            return match && match[1] ? Math.round(parseFloat(match[1])) : 0;
        };

        const cals = extract(/calories[^\d]{0,15}(\d{1,4})/i);
        const fat = extract(/total\s*fat[^\d]{0,15}(\d+(?:\.\d+)?)\s*g/i) || extract(/fat[^\d]{0,10}(\d+(?:\.\d+)?)\s*g/i);
        const satFat = extract(/saturated\s*fat[^\d]{0,15}(\d+(?:\.\d+)?)\s*g/i);
        const sodium = extract(/sodium[^\d]{0,15}(\d+(?:\.\d+)?)\s*mg/i);
        const carb = extract(/(?:total\s*)?carbohydrate[s]?[^\d]{0,15}(\d+(?:\.\d+)?)\s*g/i);
        const fiber = extract(/(?:dietary\s*)?fiber[^\d]{0,15}(\d+(?:\.\d+)?)\s*g/i);
        const sugar = extract(/(?:total\s*)?sugars?[^\d]{0,15}(\d+(?:\.\d+)?)\s*g/i);
        const prot = extract(/protein[^\d]{0,15}(\d+(?:\.\d+)?)\s*g/i);
        const calcium = extract(/calcium[^\d]{0,15}(\d+(?:\.\d+)?)\s*mg/i);
        const iron = extract(/iron[^\d]{0,15}(\d+(?:\.\d+)?)\s*mg/i);
        const potassium = extract(/potassium[^\d]{0,15}(\d+(?:\.\d+)?)\s*mg/i);

        return {
            name: "Scanned Nutrition Label",
            cals: cals || ((prot * 4) + (carb * 4) + (fat * 9)),
            prot,
            carb,
            fat,
            satFat,
            sodium,
            fiber,
            sugar,
            calcium,
            iron,
            potassium,
            vitA: 0,
            vitC: 0
        };
    }
};

// --- CORE DATA STORE WITH OFFLINE DIRTY-SYNC QUEUE ---
window.BodyProDataStore = {
  DB_NAME: 'BodyProDatabase',
  STORE_NAME: 'bodypro_store',
  MASTER_KEY: 'bodypro_master_db',
  DIRTY_KEY: 'bodypro_pending_cloud_sync',
  SNAPSHOT_KEY: 'bodypro_last_synced_snapshot',
  
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

  applyThemeFromData(userData) {
      if (userData?.settings?.preferences?.theme) {
          const theme = userData.settings.preferences.theme;
          if (theme === 'system') {
              const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
              document.documentElement.setAttribute('data-theme', prefersLight ? 'light' : 'dark');
          } else {
              document.documentElement.setAttribute('data-theme', theme);
          }
      }
  },

  async getData() {
    const user = auth.currentUser;
    const localData = await this.getIndexedData(this.MASTER_KEY);
    if (!user) {
      const fallback = localData || this.getEmptyDB();
      this.applyThemeFromData(fallback);
      return fallback;
    }

    // CRITICAL OFFLINE DATA PROTECTION:
    // If local IndexedDB has unsynced offline changes, flush them to cloud FIRST before pulling!
    const hasPendingOfflineSync = await this.getIndexedData(this.DIRTY_KEY);
    if (hasPendingOfflineSync && localData && navigator.onLine) {
        try {
            console.log("[BodyPro Sync] Flushing queued offline telemetry to cloud...");
            const snapshot = await this.getIndexedData(this.SNAPSHOT_KEY) || this.getEmptyDB();
            await this._executeCloudSync(user, localData, snapshot);
            await this.setIndexedData(this.DIRTY_KEY, false);
            await this.setIndexedData(this.SNAPSHOT_KEY, JSON.parse(JSON.stringify(localData)));
            window.dispatchEvent(new CustomEvent('bodypro-sync-complete'));
        } catch (flushErr) {
            console.warn("[BodyPro Sync] Offline flush deferred; continuing with local master store.", flushErr);
            this.applyThemeFromData(localData);
            return localData;
        }
    } else if (hasPendingOfflineSync && localData && !navigator.onLine) {
        this.applyThemeFromData(localData);
        return localData;
    }

    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      
      let userData;
      let forceCloudInit = false;

      if (userSnap.exists()) {
          userData = userSnap.data();
      } else {
          userData = localData || this.getEmptyDB();
          forceCloudInit = true;
      }

      const empty = this.getEmptyDB();
      userData.settings = userData.settings || empty.settings;
      userData.settings.preferences = { ...empty.settings.preferences, ...(userData.settings.preferences || {}) };
      userData.settings.macroTargets = { ...empty.settings.macroTargets, ...(userData.settings.macroTargets || {}) };
      userData.settings.microTargets = { ...empty.settings.microTargets, ...(userData.settings.microTargets || {}) };
      userData.settings.goals = { ...empty.settings.goals, ...(userData.settings.goals || {}) };
      userData.settings.weeklySplit = userData.settings.weeklySplit || empty.settings.weeklySplit;

      userData.friends = userData.friends || [];
      userData.profile = { ...empty.profile, ...(userData.profile || {}) };
      userData.workout_templates = userData.workout_templates || [];
      userData.custom_workouts = userData.custom_workouts || [];
      userData.social_posts = userData.social_posts || [];
      userData.social_interactions = userData.social_interactions || {};
      userData.progress_photos = userData.progress_photos || (localData?.progress_photos || []);
      
      if (!userData.profile.shortId) {
         userData.profile.shortId = Math.random().toString(36).substring(2, 8).toUpperCase();
         forceCloudInit = true;
      }

      if (forceCloudInit) {
          console.log("[BodyPro System] Initializing core profile in cloud registry...");
          await setDoc(userRef, { 
              profile: userData.profile,
              settings: userData.settings,
              friends: userData.friends,
              shortId: userData.profile.shortId,
              workout_templates: userData.workout_templates,
              custom_workouts: userData.custom_workouts,
              social_posts: userData.social_posts,
              social_interactions: userData.social_interactions
          }, { merge: true });
      }

      this.applyThemeFromData(userData);
      
      const subCollections = ['food_diary', 'workouts', 'biometrics', 'sleep_data', 'custom_recipes', 'favorite_foods'];
      const userColPromises = subCollections.map(async (colName) => {
          const colRef = collection(db, "users", user.uid, colName);
          const snap = await getDocs(colRef);
          userData[colName] = [];
          snap.forEach(doc => userData[colName].push({ id: doc.id, ...doc.data() }));
      });

      await Promise.all(userColPromises);

      await this.setIndexedData(this.MASTER_KEY, userData);
      await this.setIndexedData(this.SNAPSHOT_KEY, JSON.parse(JSON.stringify(userData)));
      await this.setIndexedData(this.DIRTY_KEY, false);
      return userData;

    } catch (error) {
      console.error("Cloud Sync failed. Falling back to local encrypted store.", error);
      const fallback = localData || this.getEmptyDB();
      this.applyThemeFromData(fallback);
      return fallback;
    }
  },

  async saveData(dataObj) {
    const user = auth.currentUser;
    try {
      const oldDataObj = await this.getIndexedData(this.SNAPSHOT_KEY) || await this.getIndexedData(this.MASTER_KEY) || this.getEmptyDB();
      const cleanData = JSON.parse(JSON.stringify(dataObj));
      
      await this.setIndexedData(this.MASTER_KEY, cleanData);
      await this.setIndexedData(this.DIRTY_KEY, true);

      if (!user) return true;

      if (!navigator.onLine) {
          window.dispatchEvent(new CustomEvent('bodypro-sync-offline'));
          return true;
      }

      this.isSyncing = true;
      clearTimeout(this._syncFallbackTimer);
      this._syncFallbackTimer = setTimeout(() => {
          this.isSyncing = false;
      }, 2500);

      window.dispatchEvent(new CustomEvent('bodypro-sync-start'));

      this._executeCloudSync(user, cleanData, oldDataObj)
        .then(async () => {
          this.isSyncing = false;
          await this.setIndexedData(this.DIRTY_KEY, false);
          await this.setIndexedData(this.SNAPSHOT_KEY, cleanData);
          window.dispatchEvent(new CustomEvent('bodypro-sync-complete'));
        })
        .catch(err => {
          console.error("Background Sync Error (queued for retry):", err);
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
          custom_workouts: cleanData.custom_workouts || [],
          social_posts: cleanData.social_posts || [],
          social_interactions: cleanData.social_interactions || {}
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

  async fetchFriendTelemetry(friendUid) {
      try {
          const userRef = doc(db, "users", friendUid);
          const userSnap = await getDoc(userRef);
          if(!userSnap.exists()) return null;

          const friendData = userSnap.data();
          friendData.uid = friendUid;

          const today = window.BodyProTelemetry.getLocalISODate();

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
            objective: "maintain",
            supplements: "Creatine 5g, Whey Protein, Multivitamin, Omega-3 Fish Oil"
        },
        settings: {
            preferences: {
                theme: 'dark',
                weightUnit: 'lbs',
                fluidUnit: 'oz',
                timeFormat: '12',
                defaultMeal: 'Snacks',
                includeActiveBurnInBudget: true,
                enableHapticsAudio: true
            },
            macroTargets: {
                calories: 2200,
                protein: 200,
                carbs: 150,
                fats: 88
            },
            microTargets: {
                sugar: 50,
                sodium: 2300,
                iron: 18,
                potassium: 4700,
                fiber: 30,
                vitA: 900,
                vitC: 90,
                calcium: 1000,
                satFat: 20
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
            weeklySplit: {
                1: "", // Monday
                2: "", // Tuesday
                3: "", // Wednesday
                4: "", // Thursday
                5: "", // Friday
                6: "", // Saturday
                0: ""  // Sunday
            },
            pinnedSyncs: [],
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
        custom_workouts: [],
        social_posts: [],
        social_interactions: {},
        progress_photos: []
    };
  }
};

// --- GLOBAL CLOUD / OFFLINE TELEMETRY STATUS BADGE & AUTO-RECONNECT ---
function injectGlobalStatusBadge() {
    if (document.getElementById('bpSyncBadge') || window.location.pathname.includes('login.html')) return;
    const badge = document.createElement('div');
    badge.id = 'bpSyncBadge';
    badge.className = 'bp-sync-badge';
    badge.innerHTML = `<span class="bp-sync-dot"></span><span id="bpSyncText">${navigator.onLine ? 'Encrypted Sync Ready' : 'Offline Vault Active'}</span>`;
    if (!navigator.onLine) badge.classList.add('offline');
    document.body.appendChild(badge);

    const setStatus = (state, text) => {
        badge.className = `bp-sync-badge ${state}`;
        const txtEl = document.getElementById('bpSyncText');
        if (txtEl) txtEl.innerText = text;
    };

    window.addEventListener('bodypro-sync-start', () => setStatus('syncing', 'Syncing Telemetry...'));
    window.addEventListener('bodypro-sync-complete', () => {
        setStatus('synced', 'Cloud Synchronized');
        setTimeout(() => {
            if (navigator.onLine) setStatus('', 'Telemetry Locked');
        }, 2500);
    });
    window.addEventListener('bodypro-sync-offline', () => setStatus('offline', 'Saved to Offline Queue'));
    window.addEventListener('bodypro-sync-error', () => setStatus('offline', 'Queued Locally'));
    window.addEventListener('offline', () => setStatus('offline', 'Offline Vault Active'));
    window.addEventListener('online', async () => {
        setStatus('syncing', 'Reconnecting...');
        if (window.BodyProDataStore) {
            await window.BodyProDataStore.getData();
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectGlobalStatusBadge);
} else {
    injectGlobalStatusBadge();
}

// Register Service Worker Globally Across All Pages
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    });
}

window.addEventListener('beforeunload', (e) => {
  if (window.BodyProDataStore && window.BodyProDataStore.isSyncing) {
    e.preventDefault();
    e.returnValue = 'Data synchronization in progress. Leaving now may result in lost telemetry. Please hold.';
    return e.returnValue;
  }
});
