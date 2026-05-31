---
description: Add support for a new job listing site to the extension.
---

Add support for a new job listing site to the extension.

Steps:
1. Ask me: "What is the site URL and the CSS selector for the job description container?"
2. Add the site domain to host_permissions in manifest.json
3. Add the CSS selector to the site-specific selector map in content/scraper.js
4. Test by opening the built-in browser and navigating to a real job post on that site
5. Confirm the extracted text looks clean and complete
6. Update the README with the new supported site