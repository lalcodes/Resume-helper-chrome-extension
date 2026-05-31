This is a Chrome Extension (Manifest V3) that scrapes job descriptions from job listing pages and generates tailored cover letters using the Gemini API.

Tech stack: Vanilla JavaScript, Chrome Extension APIs (chrome.storage, chrome.sidePanel, chrome.scripting), Gemini API via fetch with streaming.

File structure:
- manifest.json (MV3)
- background/service-worker.js
- content/scraper.js
- sidepanel/sidepanel.html + sidepanel.js
- utils/gemini.js
- utils/storage.js

Never use npm packages or bundlers. All code must run as plain JS compatible with Chrome extension pages. API keys stored only in chrome.storage.local — never hardcoded or logged.

Always use async/await. Every chrome.* call must be wrapped in try/catch. Use streaming (ReadableStream) for Gemini API — never wait for full response. Add JSDoc above every exported function.