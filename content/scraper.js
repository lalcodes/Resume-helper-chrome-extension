/**
 * Content script to scrape job descriptions from job listing pages.
 */

// Site-specific selectors map
const SELECTORS = {
  "linkedin.com": ".jobs-description__content",
  "indeed.com": "#jobDescriptionText",
  "greenhouse.io": "#content",
  "lever.co": ".section-wrapper",
  "workday.com": '[data-automation-id="jobPostingDescription"]'
};

// Boilerplate patterns to clean up
const BOILERPLATE_PATTERNS = [
  /apply\s+now/i,
  /share\s+job/i,
  /cookie\s+settings/i,
  /privacy\s+policy/i,
  /all\s+rights\s+reserved/i
];

/**
 * Cleans the scraped text by removing extra whitespaces, common boilerplate lines, and HTML residues.
 * @param {string} rawText - The raw text extracted from the page.
 * @returns {string} The cleaned text.
 */
function cleanText(rawText) {
  if (!rawText) return "";
  
  // Split into lines to clean line by line
  let lines = rawText.split(/\r?\n/);
  
  // Clean each line and filter out boilerplate/empty lines
  let cleanedLines = lines
    .map(line => line.trim())
    .filter(line => {
      if (line.length === 0) return false;
      
      // Check if line matches any boilerplate pattern
      for (const pattern of BOILERPLATE_PATTERNS) {
        if (pattern.test(line) && line.length < 50) {
          return false;
        }
      }
      return true;
    });

  // Re-join and clean extra whitespace
  return cleanedLines.join("\n").replace(/[ \t]+/g, " ").trim();
}

/**
 * Generic heuristic to find the largest text block on the page that could be the job description.
 * Looks for tags containing substantial text blocks.
 * @returns {string|null} The raw text of the largest content block found, or null.
 */
function findLargestTextBlock() {
  console.log("[Scraper] Running fallback generic heuristic...");
  // Query common structural or content containers
  const elements = document.querySelectorAll("div, section, article, main");
  let maxWordCount = 0;
  let bestText = null;

  for (const element of elements) {
    // Only check elements with direct text content or children that have text
    // Ignore script, style, header, footer, nav
    if (element.tagName === "SCRIPT" || element.tagName === "STYLE" || 
        element.tagName === "HEADER" || element.tagName === "FOOTER" || 
        element.tagName === "NAV") {
      continue;
    }

    const text = element.innerText || element.textContent || "";
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    
    if (words.length > 200 && words.length > maxWordCount) {
      // Ensure we don't just pick document.body or a parent wrapper that contains everything
      // Verify children word density or select the leaf-most candidate
      maxWordCount = words.length;
      bestText = text;
    }
  }

  return bestText;
}

/**
 * Main scraping routine.
 */
function scrapeJobDescription() {
  const hostname = window.location.hostname;
  console.log(`[Scraper] Starting scrape attempt on ${hostname}`);
  
  let targetElement = null;
  let selectorUsed = null;

  // 1. Try site-specific selectors
  for (const [domain, selector] of Object.entries(SELECTORS)) {
    if (hostname.includes(domain)) {
      console.log(`[Scraper] Matching site domain: ${domain}, selector: ${selector}`);
      targetElement = document.querySelector(selector);
      selectorUsed = selector;
      break;
    }
  }

  let rawText = "";

  if (targetElement) {
    console.log(`[Scraper] Found element matching selector: ${selectorUsed}`);
    rawText = targetElement.innerText || targetElement.textContent || "";
  } else {
    console.log("[Scraper] No site-specific selector matched or element not found.");
    // 2. Try generic heuristic
    rawText = findLargestTextBlock() || "";
  }

  const cleanedText = cleanText(rawText);

  if (cleanedText && cleanedText.split(/\s+/).length > 20) {
    console.log(`[Scraper] Successfully extracted ${cleanedText.split(/\s+/).length} words of JD text.`);
    chrome.runtime.sendMessage({ type: "JD_SCRAPED", text: cleanedText })
      .catch(err => console.error("[Scraper] Error sending message:", err));
  } else {
    console.log("[Scraper] Job description not found or too short.");
    chrome.runtime.sendMessage({ type: "JD_NOT_FOUND" })
      .catch(err => console.error("[Scraper] Error sending message:", err));
  }
}

// Scrape on initial script load
try {
  // Give the page a moment to load elements dynamically if needed
  setTimeout(scrapeJobDescription, 1500);
} catch (e) {
  console.error("[Scraper] Error on initial load scrape:", e);
}

// Also listen for explicit scrape requests from the side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "SCRAPE_JD") {
    console.log("[Scraper] Scrape request received from side panel");
    try {
      scrapeJobDescription();
      sendResponse({ status: "scraping" });
    } catch (e) {
      console.error("[Scraper] Error during onMessage scrape:", e);
      sendResponse({ status: "error", error: e.message });
    }
  }
  return true; // Keep the message channel open for async response
});
