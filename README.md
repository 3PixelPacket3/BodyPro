# BodyPro 

**Advanced Personal Health, Fitness, and Biometric Telemetry System**

BodyPro is a comprehensive, offline-capable Progressive Web Application (PWA) engineered to track, analyze, and optimize human performance. Moving beyond standard tracking shells, BodyPro integrates real-time optical scanning, complex progression mathematics (1RM and Volume Load), and robust data sovereignty tools into a single, cohesive platform.

![BodyPro Command Center](https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1000&auto=format&fit=crop) *(Example UI Preview)*

## 🚀 Core Features

### 📡 Progressive Web App (PWA) & Offline Architecture
* **Installable:** Operates natively on mobile devices via `manifest.json`.
* **Service Worker Caching:** Core assets load instantly, bypassing network latency.
* **IndexedDB Food Cache:** The optical scanner logs previously scanned OpenFoodFacts barcode telemetry to local storage, allowing for instantaneous, offline food logging.

### 🏋️‍♂️ Dynamic Training Engine
* **Progression Mathematics:** Automatically calculates weekly Volume Load (Tonnage) and projects your Estimated One-Rep Max (1RM) using the Epley formula.
* **Rest Chronograph:** Integrated Web Notifications API pings your device when your rest interval concludes, even if the application is running in the background.
* **Time-Crunch Protocol:** A rapid-deployment toggle that instantly condenses your daily workout into a high-intensity superset routine when time is limited.
* **Template Vault:** Build, save, and load custom workout structures on the fly.

### 🥩 Nutritional & Biometric Telemetry
* **Optical Barcode Scanner:** Uses device cameras to fetch macro-nutritional data via the OpenFoodFacts API.
* **Mifflin-St Jeor Calculator:** An integrated engine that recalculates your Base Metabolic Rate (BMR) and Total Daily Energy Expenditure (TDEE) based on real-time body mass updates.
* **Advanced Charting:** Visualizes caloric adherence, macro distribution (Doughnut charts), sleep restfulness, and hydration consistency via Chart.js.

### 🌐 Localized Social Network
* **Identity & Connectivity:** Share your unique Network ID to build a private roster of connections.
* **Automated Timelines:** The system automatically decrypts completed training sessions and injects them into your timeline as social achievements.
* **Manual Broadcasting:** Share status updates with granular visibility controls (Public, Friends Only, Private).

### 🔐 Data Sovereignty & Management
* **Total Control:** Export your entire database as a JSON backup, or restore from a previous payload.
* **7-Day Rollback:** A built-in contingency to permanently erase the last week of data to correct mass logging errors.
* **Nuclear Option:** Execute a complete account wipe to factory reset your telemetry.

## 🛠️ Technical Stack
* **Frontend:** HTML5, CSS3 (Custom properties, CSS Grid/Flexbox), Vanilla ES6 JavaScript.
* **Libraries:** Chart.js (Analytics), Html5-Qrcode (Optical Scanning).
* **Backend/Storage:** Firebase Authentication & Cloud Firestore (handled via `data-store.js`), IndexedDB (Local Caching).

## 📥 Installation & Deployment

1. **Clone the Repository:**
   ```bash
   git clone [https://github.com/yourusername/bodypro.git](https://github.com/yourusername/bodypro.git)
