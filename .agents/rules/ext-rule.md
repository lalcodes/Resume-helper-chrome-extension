---
trigger: always_on
---

Scaffold a complete Chrome Extension (MV3) project for a cover letter generator.

Create all files in the structure defined in rules.md. The extension should:
1. Use chrome.sidePanel (not a popup) for the main UI
2. Have a manifest.json with host_permissions for linkedin.com, indeed.com, greenhouse.io, lever.co, workday.com and the Gemini API domain
3. Register the content script to run on all those job sites
4. Create placeholder HTML for the side panel with: a textarea showing the scraped JD, a resume input area, a tone selector (Formal / Friendly / Confident), and a Generate button
5. Wire up chrome.storage.local to persist the resume across sessions

Do NOT implement Gemini API calls yet — use a stub function returning "Cover letter will appear here..." after a 1s delay.

Create one file at a time and wait for my approval before proceeding to the next.