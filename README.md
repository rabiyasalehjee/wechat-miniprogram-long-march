# Long March Steps - Uni-App WeChat Mini Program

---

## Run Checklist (do these every time)

### Step 1 — Start the local backend
```bash
cd local-backend
node server.js
```
Keep this terminal open. Server runs on `http://localhost:3000`.

### Step 2 — Copy cloud functions into dist
```bash
# From project root (trail-1/)
bash deploy-cloud.sh
```
This makes the `cloudfunctions/` folder appear in WeChat DevTools.

### Step 3 — Deploy the cloud function in WeChat DevTools
1. In the DevTools file tree, find `cloudfunctions/getSteps`
2. Right-click `getSteps` → **Upload and Deploy: Cloud Install Dependencies**
3. Wait for upload to finish

### Step 4 — Run the frontend
Open in HBuilderX or WeChat DevTools and run to WeChat Mini Program.

> If the cloud folder disappears in DevTools, just re-run `bash deploy-cloud.sh`.

---

This project, "Trail-1," is a Uni-App designed as a WeChat Mini Program to track and visualize a user's steps in the context of the "Long March" theme. It combines a Vue.js front-end with WeChat's server-side capabilities (simulated locally) to provide a themed step-tracking experience.

## Features

*   **Themed Interface:** "Long March Steps" with a subtitle "Retrace the 25,000-li Long March Road."
*   **Today's Steps:** Displays the user's step count for the current day.
*   **Total Distance Tracking:** Calculates and shows the accumulated total mileage in kilometers, based on an average stride of 0.7 meters.
*   **Long March Progress:** Visualizes progress towards a 12,500-kilometer target with a progress bar, showing completion percentage and remaining distance.
*   **Animated Live Map:** A simple map visualization with key waypoints (Ruijin, Zunyi, Yan'an) and an animated walker emoji representing the user's progress.
*   **WeChat Integration:** Syncs step data directly from WeChat WeRun.

## Architecture

The project consists of three main parts:

1.  **Uni-App Front-end:** A Vue.js application that runs as a WeChat Mini Program.
2.  **WeChat Cloud Function (`getSteps`):** A serverless function responsible for processing WeChat WeRun data.
3.  **Local Backend (`local-backend`):** An Express.js server for local development and testing, mimicking the WeChat decryption process.

### Front-end (`pages/index/index.vue`, `App.vue`, `main.js`, `pages.json`)

*   Developed using Uni-App and Vue.js.
*   `App.vue`: The root component, handling application lifecycle events (launch, show, hide).
*   `main.js`: Initializes the Vue SSR application.
*   `pages.json`: Configures the application's pages and global styles. The main page is `pages/index/index`.
*   `pages/index/index.vue`: The primary user interface.
    *   Displays step data, calculated distance, and Long March progress.
    *   Initiates WeChat login (`uni.login`) and retrieves encrypted WeRun data (`uni.getWeRunData`).
    *   Sends the encrypted data to a backend endpoint (`/decrypt-steps`) for decryption and step extraction.
    *   Stores `totalStepsHistory` in local storage (`uni.getStorageSync`, `uni.setStorageSync`) to maintain accumulated steps across sessions.

### WeChat Cloud Function (`cloudfunctions/getSteps/index.js`)

*   Utilizes `wx-server-sdk`.
*   The `main` function receives an `event` object. **Crucially, WeChat's cloud environment automatically decrypts `cloudID` data (like WeRun data) if passed correctly.**
*   It extracts the `stepInfoList` (an array of `{ step, timestamp }` for the last 31 days) from the already-decrypted `event.weRunData.data` and returns it.
*   This function is intended for deployment in the WeChat Cloud environment.

### Local Backend (`local-backend/server.js`)

*   An Express.js server for local development purposes.
*   Handles the `/decrypt-steps` POST endpoint.
*   **WeChat API Interaction:**
    *   Takes `code` (from `uni.login`), `encryptedData`, and `iv` (from `uni.getWeRunData`) as input.
    *   Uses provided `APP_ID` and `APP_SECRET` (which must be set from a WeChat Developer Sandbox account) to call WeChat's `jscode2session` API. This exchanges the `code` for a `session_key`.
    *   Employs Node.js's `crypto` module to perform AES-128-CBC decryption on `encryptedData` using the `session_key` and `iv`.
    *   Validates the decrypted data's `watermark.appid` to ensure data integrity.
    *   Extracts today's step count from the `stepInfoList` (specifically the last entry) and returns it.
*   Runs on `http://localhost:3000`, allowing the Uni-App front-end to interact with a local mock backend during development.

### Core Logic Tests (`logic.test.js`)

*   Contains basic unit tests for the mathematical functions: `calculateDistanceKm`, `calculateProgress`, and `calculateRemaining`.
*   Uses Node.js's built-in `assert` module.
*   These tests ensure the accuracy of step-to-distance conversion, progress calculation (including capping at 100%), and remaining distance calculation (including flooring at 0).

## Setup and Running (Local Development)

### Prerequisites

*   Node.js (LTS recommended)
*   npm or yarn
*   WeChat Developer Tools (for Uni-App development and testing)

### 1. Uni-App Front-end Setup

Navigate to the `trail-1` directory:
```bash
cd /Users/rabiyasalehjee/i-am-sensational/trail-1
```
Install dependencies:
```bash
npm install
# or
yarn install
```
Run the Uni-App in development mode for WeChat Mini Program:
```bash
npm run dev:mp-weixin
# or
yarn dev:mp-weixin
```
This will compile the Uni-App and open it in the WeChat Developer Tools.

### 2. Local Backend Setup

Open a new terminal and navigate to the `local-backend` directory:
```bash
cd /Users/rabiyasalehjee/i-am-sensational/trail-1/local-backend
```
Install dependencies:
```bash
npm install
# or
yarn install
```
**Important:** Open `server.js` and replace `APP_ID` and `APP_SECRET` with your credentials from the [WeChat Developer Sandbox (Test Account)](https://mp.weixin.qq.com/debug/cgi-bin/sandbox?t=sandbox/login) page.

Start the local backend server:
```bash
node server.js
```
The server will start on `http://localhost:3000`.

### 3. Cloud Function Development (Optional, for Deployment)

Navigate to the `cloudfunctions/getSteps` directory:
```bash
cd /Users/rabiyasalehjee/i-am-sensational/trail-1/cloudfunctions/getSteps
```
Install dependencies:
```bash
npm install
# or
yarn install
```
This cloud function is designed to be deployed to the WeChat Cloud environment. For local testing, the `local-backend` handles the decryption logic.

### 4. Running Tests

Navigate to the `trail-1` directory:
```bash
cd /Users/rabiyasalehjee/i-am-sensational/trail-1
```
Run the logic tests:
```bash
node logic.test.js
```

## How to Use the Mini Program (User Flow)

1.  Open the Uni-App in WeChat Developer Tools.
2.  On the main page, you will see your "Today's Steps," "Total Accumulated Mileage," and "Long March Progress."
3.  Click the "更新我的步数" (Update my steps) button.
4.  The Mini Program will prompt for WeChat authorization to access your WeRun data. Grant permission.
5.  The program will then fetch your latest step data, decrypt it via the local backend (or deployed cloud function), and update the display.
6.  Your total steps will be saved locally and accumulate across sessions.

## Project Structure

```
trail-1/
├── App.vue               # Uni-App root component
├── cloudfunctions/       # WeChat Cloud Functions
│   └── getSteps/         # Decrypts WeRun data (WeChat Cloud)
│       ├── index.js      # Main logic for the cloud function
│       ├── package.json  # Dependencies for the cloud function (wx-server-sdk)
│       └── ...node_modules/
├── local-backend/        # Local Express.js server for development
│   ├── server.js         # Handles WeChat decryption for local testing
│   ├── package.json      # Dependencies for the local backend (express, axios, cors)
│   └── ...node_modules/
├── logic.test.js         # Unit tests for core calculation logic
├── main.js               # Uni-App entry point (Vue SSR)
├── manifest.json         # Uni-App manifest file
├── package.json          # Main project dependencies (Uni-App, Vue)
├── pages/                # Application pages
│   └── index/            # Main index page
│       └── index.vue     # Vue component for the main dashboard
├── pages.json            # Uni-App page configuration
├── static/               # Static assets
├── uni.scss              # Global SASS styles
└── unpackage/            # Build output directory
```
