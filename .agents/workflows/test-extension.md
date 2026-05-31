---
description: Run a full end-to-end test of the extension.
---

Run a full end-to-end test of the extension.

Steps:
1. Check manifest.json for MV3 validity (required fields, correct permissions format)
2. Lint all JS files for common MV3 issues: no document.write, no eval, no XMLHttpRequest in service workers
3. Open the built-in browser, load a LinkedIn job post, and verify the JD is scraped
4. Simulate a Gemini API call with a mock response and verify streaming text appears in the side panel
5. Check chrome.storage.local read/write for the resume field
6. Report any issues found with file + line number