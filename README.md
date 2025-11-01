# Disclaimer — Important (read first)

**DO NOT run this extension inside the temporary profile that WXT launches.**
This project **must** be run only in **your personal Chrome profile** (the profile you normally use) — the extension is designed to work with your user profile and will **not** function correctly inside the temporary/dev profile that WXT auto-opens. Running inside WXT’s temporary profile may cause unexpected behavior or missing features.

**Important safety note:** loading the extension into your personal profile can modify or persist data (cookies, logins, localStorage). Only proceed if you accept those risks. If you prefer to avoid impacting your main profile, create a dedicated personal profile (via Chrome’s profile UI) and use that instead of the WXT-provided temporary profile.

---

# ManifesTest — README

**TL;DR:** A privacy-first Chrome extension (WXT + React + TypeScript) that converts the page you are viewing (HTML, PDF, or video transcript) into a personalized practice test using Chrome’s built-in Prompt/AI APIs. Fast, private, and configurable (fill-in, multiple choice, true/false).
Source: [https://github.com/ShashwanthN/ManifesTest](https://github.com/ShashwanthN/ManifesTest)

---

## What this project is / goal

Studying for interviews can be dull. ManifesTest extracts the content on the current page (or PDF or video transcript) and generates a customizable test to help you validate your knowledge quickly — without sending page content to third-party servers (uses the browser Prompt/AI APIs for privacy). Built with **WXT**, **React**, and **TypeScript**.

---

## Quick feature list

* Create practice tests from current page content, PDF, or video transcript
* Question types: Fill-in, Multiple Choice, True / False
* Privacy-first: uses browser Prompt API where available
* Dev-friendly: WXT-based toolchain

---

## Prerequisites

* Node.js 16+
* pnpm (recommended) or npm / yarn
* Google Chrome (Chromium) for testing and loading the extension

---

## Quick start (development)

1. Clone the repository:

```bash
git clone https://github.com/ShashwanthN/ManifesTest.git
cd ManifesTest
```

2. Install dependencies:

```bash
pnpm install
```

3. **Important:** For development, WXT normally opens a temporary profile. **Do not** use the WXT-opened temporary profile for running this extension — the extension is only supported in your personal Chrome profile. See the Disclaimer above.

If you want to iterate locally using WXT but want the extension to run inside a persistent profile directory you control, configure WXT to point to a profile directory you created (see "Advanced: running with a specific profile" below). Use that option with caution.

---

## Build / production

1. Build the extension:

```bash
pnpm run build
```

2. The build output will be in `output/` (ps: press command + ~ on your mac and it shows hidden files). Use that folder when loading into Chrome.

---

## How to load into Chrome (step-by-step)

**Option A — Load unpacked into your personal profile (recommended for testing):**

1. Make sure Chrome is running using your personal profile (the profile you normally use, or a dedicated personal dev profile you created in Chrome).
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle at top-right).
4. Click **Load unpacked**.
5. In the file chooser, select the built extension folder (`dist/` or `build/` — the folder that contains `manifest.json`).
6. The extension will load into your personal profile and should appear in the extensions list. Use the extension icon or configured shortcuts to run it.



---

## How to use the extension (end-user flow)

I mean its pretty straight forward but -

1. Load the extension into Chrome (see above).
2. Open any page (article, embedded PDF, or video page with a transcript).
3. Click the extension icon.
4. Choose generate options (question types, number of questions).
5. Do the test — questions are generated from the current page and presented in the popup.



## Troubleshooting & tips

* If the extension does not function when loaded from WXT’s auto-opened browser window, rebuild and load it manually into your personal profile via `chrome://extensions` → **Load unpacked**.
* To inspect background/service worker logs: `chrome://extensions` → find the extension → **Service worker** → **Inspect**.
* Let me know!

---

## Contributing

Fork → feature branch → tests → PR. See repo for issues.
