BodyPro: Telemetry & Nutrition Management System
BodyPro is a high-performance, mobile-first web application designed for comprehensive health tracking, nutritional telemetry, and athletic performance monitoring. Built on a cloud-synchronized architecture, it provides real-time data analysis and secure storage for serious health optimization.

🛠 Technical Stack
Frontend: Vanilla JavaScript (ES Modules), HTML5, CSS3 (Mobile-First Responsive Design).

Backend: Firebase (Authentication, Cloud Firestore).

Local Storage: IndexedDB (via Data-Store logic) for offline persistence and rapid UI response.

Optical Engine: Html5-Qrcode for real-world barcode ingestion.

External Telemetry: OpenFoodFacts REST API for nutritional data retrieval.

Visual Analytics: Chart.js for biometric trend analysis and moving averages.

✨ Core Features
📡 Live Telemetry Dashboard
Dynamic Macro Rings: Real-time visualization of calorie and macronutrient ingestion relative to daily targets.

Hydration Tracker: Debounced logging for water intake with persistent local-to-cloud synchronization.

Smartwatch Integration: Placeholders for sleep statistics, heart rate telemetry, and active calorie expenditure.

🍎 Nutritional Command
Optical Barcode Scanner: Live camera integration to query the OpenFoodFacts database for instant macro logging.

Meal Copier: A efficiency-focused tool to duplicate entire meal logs from previous dates into the current diary.

Culinary Builder: Custom recipe creator that automatically calculates per-serving macros based on ingredient batches.

Supplement Matrix: A dedicated tracking interface for daily compound protocols (Creatine, Protein, Pre-workout, etc.).

🏋️‍♂️ Training Hub
Dual Chronograph System: Independent timers for Resistance (90m target) and Conditioning (20m target) sessions.

Live Session Logger: Track movements, weight, reps, and RPE (Rate of Perceived Exertion) in real-time.

Performance Telemetry: Dedicated fields for average heart rate and active calorie logging per session.

📈 Data & Analytics
Body Mass Tracking: Moving average algorithms (7-day smoothing) to identify true weight trends against daily fluctuations.

Macro Adherence: Visual bar charts comparing daily consumption against target baselines.

Activity History: A secure log of recent training sessions and nutritional milestones.

🔐 Security & Architecture
Encrypted Storage: Built with standard cryptographic principles for data at rest and in transit via Firebase’s TLS/SSL protocols.

Zero-Trust Authorization: Firestore Security Rules ensure users possess exclusive read/write access to their personal biometric and dietary data.

Vanilla Module Architecture: A clean, decoupled file structure using data-store.js as the central nervous system for all database interactions.

🚀 Deployment & Installation
Prerequisites
A Firebase Project with Email/Password and Google authentication enabled.

A Firestore Database initialized in Production Mode.

Implementation
Clone the Repository: Upload all files to a GitHub repository.

Configure Credentials: Update the firebaseConfig object in data-store.js with your specific API keys and Project IDs.

Enable GitHub Pages: Set the deployment branch to main.

Initialize index.html: Ensure index.html is present in the root directory to handle the initial redirect to the secure login.html gateway.
