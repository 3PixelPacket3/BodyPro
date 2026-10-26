# BodyPro v3.0

**Advanced Personal Health, Fitness, and Biometric Telemetry System (Web, iOS & Android)**

BodyPro is a comprehensive, offline-first Progressive Web Application (PWA) and Capacitor-ready native mobile app engineered to track, analyze, and optimize human performance. Moving beyond standard tracking shells, BodyPro integrates optical barcode & FDA Nutrition Facts OCR scanning, empirical metabolic coaching, real-time progression mathematics (1RM, PR detection, and Weekly Muscle Volume Landmarks), and full data sovereignty into a single, cohesive platform.

<img width="967" height="967" alt="icon-192" src="https://github.com/user-attachments/assets/58a3b3e8-0e65-4b02-a312-77e3b4471f30" />

---

## 🚀 v3.0 Complete Architecture & Feature Highlights

### 🧠 Adaptive Metabolic Coach & Readiness Engine
* **Empirical Adaptive TDEE:** Analyses rolling 14-day caloric intake and body weight deltas (`3500 kcal/lb` energy balance) blended with Mifflin-St Jeor BMR to compute your true maintenance expenditure, weekly weight velocity, and projected goal date.
* **1-Click Macro Target Sync:** Automatically ports your empirical TDEE into optimal Cut, Lean Gain, or Maintenance macro splits.
* **Daily CNS Readiness Score (0–100%):** Evaluates sleep duration, sleep quality, trailing 3-day training strain, hydration, and resting heart rate (RHR) to deliver daily training guidance.

### 🏋️‍♂️ Pro-Grade Training Engine (`fitness.html` / `fitness.js`)
* **Background-Safe Timestamp Chronographs:** Lifting, Cardio, and Rest timers compute elapsed time via wall-clock timestamp deltas (`Date.now()`) so locking your phone or switching apps on iOS/Android never drifts or freezes your timers.
* **Live Crash-Proof Draft Persistence:** Every logged set and active timer is auto-saved to `localStorage` and restored automatically if the app is closed mid-workout.
* **Set Types & Auto-Rest Trigger:** Cycle set badges between **N** (Normal), **W** (Warm-up, excluded from working tonnage/1RM), **D** (Drop Set), and **F** (Failure). Tapping the `✓` checkmark completes a set with haptic feedback and automatically launches the Rest Countdown.
* **Web Audio Synthesizer, Haptics & Screen Wake Lock:** Keeps the screen awake during active workouts (`navigator.wakeLock`) and fires synthesized Web Audio chimes + vibration patterns when rest intervals conclude.
* **Real-Time All-Time PR Detection:** Automatically compares working sets against historical Epley 1RM and weight records, crowning new records with a 🏆 PR badge and celebratory toast.
* **Barbell Plate Calculator & Warm-up Ramp Generator:** Visualizes exact per-side plate loading (`45/35/25/10/5/2.5 lbs` or `25/20/15/10/5/2.5/1.25 kg`) and generates 4-step progressive warm-up ramps (`45% × 8`, `65% × 5`, `80% × 3`, `90% × 1`).
* **Weekly Split Scheduler & Time-Crunch Protocol:** Assign workout templates to specific weekdays (`Mon–Sun`) and launch them from the Dashboard with an optional **Time-Crunch** 45-second rest superset override.

### 🥩 Optical Nutrition & Recipe Studio (`nutrition.html` / `recipes.html`)
* **Optical Barcode & FDA Nutrition Facts OCR Scanner:** Scan barcodes via `html5-qrcode` (cached in IndexedDB for instant offline recall) or photograph physical **Nutrition Facts labels** parsed via `Tesseract.js` (`window.BodyProOCR`).
* **Multi-Unit Portion Scaling:** Log foods by **Servings**, **Grams (`g`)**, or **Ounces (`oz`)** with live FDA Nutrition Facts scaling, plus click-to-edit support on any logged diary item.
* **Unlocked Recipe Studio:** Scan ingredient barcodes or OCR labels directly into custom multi-serving recipes, edit existing recipes, and log `1x` serving to today's diary with a single tap.

### 📊 Deep Biometric Telemetry (`analytics.html` / `settings.html`)
* **Physique & Tape Vault:** Track body circumference measurements (`Waist`, `Neck`, `Hips`, `Chest`, `Arms`, `Thighs`), auto-calculate **U.S. Navy Body Fat %** alongside **3-Site Jackson-Pollock Caliper** pinches, and compare client-side compressed **Before vs. After Progress Photos** side-by-side.
* **Comprehensive Chart Suite:** Body Mass with 7-day moving average, Body Composition (Lean vs. Fat Mass), Sleep & Hydration Recovery Consistency, Cardiovascular Vitals (Systolic, Diastolic, and Resting HR), Strength 1RM Projections (`30d`/`90d`/`6m`), Weekly Muscle Group Volume Landmarks (`10–20 sets/wk`), Daily Tonnage, Macro Distribution, and Custom Micronutrient Radar.
* **Global Unit Conversion:** Switch seamlessly between `lbs` / `kg` and `fl oz` / `mL` across all views while preserving normalized internal telemetry.

### 🌐 Offline-First Sync Queue & Social Wire (`data-store.js` / `social.html`)
* **Offline Dirty-Sync Queue:** Any workout, meal, or biometric logged offline is queued in IndexedDB (`DIRTY_KEY`) with a live status indicator (`Synced` / `Offline Vault` / `Syncing...`) and automatically flushed to Firebase Cloud Firestore upon reconnection.
* **Native Web Share API:** Share workout summaries, PRs, and Athlete Link IDs directly to iOS/Android native share sheets (`navigator.share`).

---

## 📱 Building & Releasing for iOS (App Store) & Android (Google Play)

BodyPro v3.0 includes full **Capacitor 6** configuration ([`package.json`](file:///c:/Users/lilly_4q20tf9/Desktop/BodyPro-main/package.json) and [`capacitor.config.json`](file:///c:/Users/lilly_4q20tf9/Desktop/BodyPro-main/capacitor.config.json)) and native viewport safe-area insets (`viewport-fit=cover`, `env(safe-area-inset-*)`).

### 1. Install Dependencies & Sync Web Assets
```bash
npm install
npm run sync
```
*(The `npm run sync` script stages all HTML/CSS/JS/PWA assets into `./www` and syncs them with Capacitor native projects).*

### 2. Android Release (Google Play Store)
```bash
npx cap add android
npm run sync
npx cap open android
```
1. In **Android Studio**, verify `AndroidManifest.xml` includes `<uses-permission android:name="android.permission.CAMERA" />` and `<uses-permission android:name="android.permission.VIBRATE" />`.
2. Navigate to **Build → Generate Signed Bundle / APK → Android App Bundle (.aab)** to sign your release for Google Play Console.

### 3. iOS Release (Apple App Store)
```bash
npx cap add ios
npm run sync
npx cap open ios
```
1. In **Xcode** (macOS), select the `App` target → **Signing & Capabilities** and select your Apple Developer Team.
2. In `Info.plist`, add:
   * `NSCameraUsageDescription`: *"BodyPro uses the camera to scan food barcodes, read Nutrition Facts labels, and capture optional physique progress photos."*
   * `NSPhotoLibraryUsageDescription`: *"BodyPro allows you to attach nutrition labels and progress snapshots from your photo library."*
3. Select **Product → Archive** to upload your build to **App Store Connect / TestFlight**.
