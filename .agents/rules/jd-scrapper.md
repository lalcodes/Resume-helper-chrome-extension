---
trigger: always_on
---

Build content/scraper.js — the content script that extracts job description text from job listing pages.

Requirements:
- Try site-specific CSS selectors first (LinkedIn: .jobs-description__content, Indeed: #jobDescriptionText, Greenhouse: #content, Lever: .section-wrapper, Workday: [data-automation-id="jobPostingDescription"])
- Fall back to a generic heuristic: find the largest text block on the page (>200 words) using document.querySelectorAll
- Clean the extracted text: remove extra whitespace, HTML tags, and irrelevant boilerplate ("Apply now", "Share job", cookie banners)
- Send the cleaned text to the side panel via chrome.runtime.sendMessage({ type: "JD_SCRAPED", text: cleanedText })
- If no JD is found, send { type: "JD_NOT_FOUND" }
- Log each site+selector attempt to the console for debugging

After writing the file, open the built-in browser, navigate to a live LinkedIn job post, and verify the script extracts text correctly.