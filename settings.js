<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>BodyPro | Profile Configuration</title>
  <link rel="manifest" href="manifest.json">
  <meta name="theme-color" content="#09090b">
  <link rel="apple-touch-icon" href="icon-192.png">
  <link rel="stylesheet" href="style.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

  <style>
    /* Settings & Profile Specific Styles */
    
    /* Global Mobile Scroll Fixes */
    html, body {
      overflow-x: hidden; /* Prevent horizontal scroll lock on Samsung/Large devices */
      width: 100%;
      position: relative;
    }

    .main-content {
      padding-bottom: 100px; /* Ensure space for the bottom nav bar */
      overflow-y: auto;
      -webkit-overflow-scrolling: touch; /* Smooth scrolling for iOS/Android */
    }

    .settings-section {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-md);
      padding: 20px;
      margin-bottom: 20px;
    }

    .settings-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--border-color);
    }

    .settings-header h3 {
      margin: 0;
      font-size: 1.1rem;
      color: var(--text-main);
    }

    .settings-header i {
      font-size: 1.2rem;
    }

    .settings-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }

    .settings-grid-full {
      grid-column: span 2;
    }

    /* Danger Zone */
    .danger-zone {
      border: 1px solid var(--danger);
      background: rgba(239, 68, 68, 0.05);
    }

    .danger-zone .settings-header h3, 
    .danger-zone .settings-header i {
      color: var(--danger);
    }

    .btn-danger-outline {
      background: transparent;
      border: 1px solid var(--danger);
      color: var(--danger);
      width: 100%;
      padding: 10px;
      border-radius: var(--border-radius-sm);
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-danger-outline:hover {
      background: var(--danger);
      color: white;
    }

    .btn-warning-outline {
      background: transparent;
      border: 1px solid var(--warning);
      color: var(--warning);
      width: 100%;
      padding: 10px;
      border-radius: var(--border-radius-sm);
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-warning-outline:hover {
      background: var(--warning);
      color: white;
    }

    .action-row {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }

    /* File Input Styling */
    input[type="file"] {
      display: none;
    }

    .custom-file-upload {
      border: 1px dashed var(--border-color);
      display: inline-block;
      padding: 10px;
      cursor: pointer;
      width: 100%;
      text-align: center;
      border-radius: var(--border-radius-sm);
      color: var(--primary);
      font-weight: 600;
      transition: background 0.2s;
    }

    .custom-file-upload:hover {
      background: var(--bg-surface-elevated);
    }

    @media (max-width: 480px) {
      .settings-grid {
        grid-template-columns: 1fr;
      }
      .settings-grid-full {
        grid-column: span 1;
      }
    }
  </style>
</head>
<body>

  <div class="app-container">
    
    <nav class="app-nav">
      <a href="dashboard.html" class="nav-item">
        <i class="fa-solid fa-house"></i>
        <span>Home</span>
      </a>
      <a href="nutrition.html" class="nav-item">
        <i class="fa-solid fa-utensils"></i>
        <span>Nutrition</span>
      </a>
      <a href="recipes.html" class="nav-item">
        <i class="fa-solid fa-book-open"></i>
        <span>Recipes</span>
      </a>
      <a href="fitness.html" class="nav-item">
        <i class="fa-solid fa-dumbbell"></i>
        <span>Fitness</span>
      </a>
      <a href="analytics.html" class="nav-item">
        <i class="fa-solid fa-chart-line"></i>
        <span>Analytics</span>
      </a>
      <a href="social.html" class="nav-item">
        <i class="fa-solid fa-users"></i>
        <span>Social</span>
      </a>
      <a href="settings.html" class="nav-item active">
        <i class="fa-solid fa-user"></i>
        <span>Profile</span>
      </a>
    </nav>

    <main class="main-content">
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div>
          <h2 style="margin-bottom: 5px;">Configuration</h2>
          <p class="text-muted" style="font-weight: 600; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 1px;">Profile & System Preferences</p>
        </div>
        <button class="btn btn-ghost" id="btnSignOut" style="padding: 8px 15px; font-size: 0.85rem; color: var(--danger); border-color: transparent;">
          <i class="fa-solid fa-arrow-right-from-bracket"></i> Logout
        </button>
      </div>

      <div class="settings-section" style="border-top: 4px solid var(--primary);">
        <div class="settings-header">
          <i class="fa-solid fa-id-card text-primary"></i>
          <h3>Biometric Identity</h3>
        </div>
        
        <div class="settings-grid">
          <div class="form-group settings-grid-full">
            <label>Display Name</label>
            <input type="text" id="profName" placeholder="Joshua">
          </div>
          
          <div class="form-group">
            <label>Age</label>
            <input type="number" id="profAge" placeholder="26">
          </div>
          
          <div class="form-group">
            <label>Sex</label>
            <select id="profSex">
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <div class="form-group">
            <label>Height (in)</label>
            <input type="number" id="profHeight" placeholder="69">
          </div>

          <div class="form-group">
            <label>Goal Weight (lbs)</label>
            <input type="number" id="profGoalWeight" placeholder="185">
          </div>

          <div class="form-group settings-grid-full">
            <label>Activity Level</label>
            <select id="profActivity">
              <option value="1.2">Sedentary (office job)</option>
              <option value="1.375">Light (1-3 days/week)</option>
              <option value="1.55">Moderate (3-5 days/week)</option>
              <option value="1.725">Active (6-7 days/week)</option>
              <option value="1.9">Very Active (physical job)</option>
            </select>
          </div>

          <div class="form-group settings-grid-full">
            <label>Current Objective</label>
            <select id="profObjective">
              <option value="cut">Cut (Fat Loss)</option>
              <option value="maintain">Maintain</option>
              <option value="bulk">Bulk (Muscle Gain)</option>
            </select>
          </div>
        </div>
        <button class="btn" id="btnSaveIdentity" style="width: 100%; margin-top: 10px;">Update Identity</button>
      </div>

      <div class="settings-section" style="border-top: 4px solid var(--accent);">
        <div class="settings-header">
          <i class="fa-solid fa-bullseye text-accent"></i>
          <h3>Daily Targets</h3>
        </div>
        
        <div class="settings-grid">
          
          <div class="form-group settings-grid-full" style="margin-bottom: 5px;">
            <label style="color: var(--text-muted);">Nutritional Targets</label>
          </div>
          <div class="form-group">
            <label>Calorie Goal (kcal)</label>
            <input type="number" id="goalCals" placeholder="2200">
          </div>
          <div class="form-group">
            <label>Protein (g)</label>
            <input type="number" id="goalProt" placeholder="200">
          </div>
          <div class="form-group">
            <label>Carbs (g)</label>
            <input type="number" id="goalCarb" placeholder="150">
          </div>
          <div class="form-group">
            <label>Fats (g)</label>
            <input type="number" id="goalFat" placeholder="88">
          </div>

          <div class="form-group settings-grid-full" style="margin-top: 10px; border-top: 1px dashed var(--border-color); padding-top: 15px;">
            <label style="color: var(--text-muted);">Biometric & Activity Targets</label>
          </div>

          <div class="form-group">
            <label>Sleep Goal (hrs)</label>
            <input type="number" step="0.5" id="goalSleep" placeholder="7.5">
          </div>
          
          <div class="form-group">
            <label>Step Goal</label>
            <input type="number" id="goalSteps" placeholder="10000">
          </div>

          <div class="form-group">
            <label>Floor Goal</label>
            <input type="number" id="goalFloors" placeholder="10">
          </div>

          <div class="form-group">
            <label>Hydration (fl oz)</label>
            <input type="number" id="goalWater" placeholder="120">
          </div>

          <div class="form-group settings-grid-full" style="margin-top: 10px; border-top: 1px dashed var(--border-color); padding-top: 15px;">
            <label style="color: var(--text-muted);">Weekly Training Protocol</label>
          </div>

          <div class="form-group">
            <label>Days / Week</label>
            <input type="number" id="goalWorkoutDays" placeholder="6">
          </div>

          <div class="form-group">
            <label>Lift Mins / Day</label>
            <input type="number" id="goalLiftMins" placeholder="90">
          </div>

          <div class="form-group">
            <label>Cardio Mins / Day</label>
            <input type="number" id="goalCardioMins" placeholder="20">
          </div>
        </div>
        <button class="btn" id="btnSaveTargets" style="width: 100%; margin-top: 10px;">Save Targets</button>
      </div>

      <div class="settings-section" style="border-top: 4px solid var(--text-main);">
        <div class="settings-header">
          <i class="fa-solid fa-sliders"></i>
          <h3>System Preferences</h3>
        </div>
        
        <div class="settings-grid">
          <div class="form-group">
            <label>Theme</label>
            <select id="prefTheme">
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System Default</option>
            </select>
          </div>

          <div class="form-group">
            <label>Weight Unit</label>
            <select id="prefWeight">
              <option value="lbs">Pounds (lbs)</option>
              <option value="kg">Kilograms (kg)</option>
            </select>
          </div>

          <div class="form-group">
            <label>Fluid Unit</label>
            <select id="prefFluid">
              <option value="oz">Fluid Ounces (fl oz)</option>
              <option value="ml">Milliliters (mL)</option>
            </select>
          </div>

          <div class="form-group">
            <label>Time Format</label>
            <select id="prefTime">
              <option value="12">12-Hour (AM/PM)</option>
              <option value="24">24-Hour</option>
            </select>
          </div>

          <div class="form-group settings-grid-full">
            <label>Default Quick-Add Meal</label>
            <select id="prefMeal">
              <option value="Breakfast">Breakfast</option>
              <option value="Lunch">Lunch</option>
              <option value="Dinner">Dinner</option>
              <option value="Snacks">Snacks</option>
            </select>
          </div>
        </div>
        <button class="btn btn-ghost" id="btnSavePrefs" style="width: 100%; margin-top: 10px; background: var(--bg-base);">Apply Preferences</button>
      </div>

      <div class="settings-section danger-zone">
        <div class="settings-header">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <h3>Data Management</h3>
        </div>
        
        <p class="text-muted" style="font-size: 0.85rem; margin-bottom: 15px;">Backup your telemetry locally or reset your database. These actions are irreversible once executed.</p>

        <div class="action-row">
          <button class="btn btn-ghost" id="btnExportData" style="flex: 1;"><i class="fa-solid fa-download"></i> Export JSON</button>
          
          <label class="custom-file-upload" style="flex: 1;">
            <input type="file" id="inputImportData" accept=".json">
            <i class="fa-solid fa-upload"></i> Import Backup
          </label>
        </div>

        <div style="margin-top: 25px; border-top: 1px dashed var(--danger); padding-top: 20px;">
          <button class="btn-warning-outline" id="btnResetWeek" style="margin-bottom: 10px;"><i class="fa-solid fa-clock-rotate-left"></i> Rollback 7 Days</button>
          <button class="btn-danger-outline" id="btnWipeAccount"><i class="fa-solid fa-skull"></i> Execute Complete Wipe</button>
        </div>
      </div>

    </main>
  </div>

  <script type="module" src="data-store.js"></script>
  <script type="module" src="settings.js"></script>
</body>
  
<footer style="text-align: center; padding: 20px; font-size: 0.75rem; color: var(--text-muted); border-top: 1px solid var(--border-color); margin-top: 20px;">
  &copy; 2026 Joshua Michael Smolak. All Rights Reserved. <br>
  BodyPro System v2.0.0
</footer>
</html>
