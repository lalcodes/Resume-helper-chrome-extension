/**
 * Controller script for the Cover Letter Generator side panel.
 */

import { getStorageItem, setStorageItem } from "../utils/storage.js";
import { generateCoverLetter } from "../utils/gemini.js";
import { generateOllamaCoverLetter } from "../utils/ollama.js";
import { extractDocxText, injectRewrittenText, loadJSZip } from "../utils/docx-editor.js";
import { scoreMatch } from "../utils/matcher.js";
import { rewriteForATS } from "../utils/ats-rewriter.js";

// Configure PDF.js worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = "../libs/pdf.worker.min.js";

// DOM Elements
const generatorView = document.getElementById("generator-view");
const settingsView = document.getElementById("settings-view");
const gearBtn = document.getElementById("gear-btn");
const backBtn = document.getElementById("back-btn");

// Tab Navigation Elements
const tabNavCover = document.getElementById("tab-nav-cover");
const tabNavAts = document.getElementById("tab-nav-ats");
const tabContentCover = document.getElementById("tab-content-cover");
const tabContentAts = document.getElementById("tab-content-ats");

// ATS SECTION 1 Elements
const atsUploadBtn = document.getElementById("ats-upload-btn");
const atsFileBadge = document.getElementById("ats-file-badge");
const atsFileInput = document.getElementById("ats-file-input");
const atsFileInfo = document.getElementById("ats-file-info");
const atsResumeText = document.getElementById("ats-resume-text");
const atsClearBtn = document.getElementById("ats-clear-btn");

// ATS SECTION 2 Elements
const atsAnalyzeBtn = document.getElementById("ats-analyze-btn");
const atsSpinner = document.getElementById("ats-spinner");
const atsMatchResult = document.getElementById("ats-match-result");
const atsScoreBadge = document.getElementById("ats-score-badge");
const atsMatchedSkills = document.getElementById("ats-matched-skills");
const atsMissingSkills = document.getElementById("ats-missing-skills");
const atsReasonText = document.getElementById("ats-reason-text");
const atsMatchStatusBanner = document.getElementById("ats-match-status-banner");
const atsScoreSlider = document.getElementById("ats-score-slider");

// Threshold Range Elements
const thresholdMinInput = document.getElementById("threshold-min-input");
const thresholdMaxInput = document.getElementById("threshold-max-input");
const sliderActiveTrack = document.getElementById("slider-active-track");
const thresholdMinVal = document.getElementById("threshold-min-val");
const thresholdMinRange = document.getElementById("threshold-min-range");
const thresholdMaxRange = document.getElementById("threshold-max-range");
const thresholdMaxVal = document.getElementById("threshold-max-val");

// ATS SECTION 3 Elements
const atsGenerateBtn = document.getElementById("ats-generate-btn");
const atsGenSpinner = document.getElementById("ats-gen-spinner");
const atsOutputContainer = document.getElementById("ats-output-container");
const diffOriginal = document.getElementById("diff-original");
const diffRewritten = document.getElementById("diff-rewritten");
const atsCopyBtn = document.getElementById("ats-copy-btn");
const atsDownloadDocxBtn = document.getElementById("ats-download-docx-btn");
const atsDownloadPdfBtn = document.getElementById("ats-download-pdf-btn");

// Generator inputs & outputs
const jdTextarea = document.getElementById("jd-text");
const resumeTextarea = document.getElementById("resume-text");
const resumeCard = document.getElementById("resume-card");
const uploadTriggerBtn = document.getElementById("upload-trigger-btn");
const resumeFileInput = document.getElementById("resume-file");
const fileStatusBanner = document.getElementById("file-status-banner");
const fileStatusText = document.getElementById("file-status-text");
const clearFileBtn = document.getElementById("clear-file-btn");
const toneSelect = document.getElementById("tone-select");
const generateBtn = document.getElementById("generate-btn");
const outputContent = document.getElementById("output-content");
const copyBtn = document.getElementById("copy-btn");
const reScrapeBtn = document.getElementById("re-scrape-btn");
const clearJdBtn = document.getElementById("clear-jd-btn");
const clearResumeBtn = document.getElementById("clear-resume-btn");
const downloadDocxBtn = document.getElementById("download-docx-btn");
const downloadPdfBtn = document.getElementById("download-pdf-btn");

// Scraper status banner elements
const scraperStatusText = document.getElementById("scraper-status-text");
const scraperBadge = document.getElementById("scraper-badge");

// Settings elements
const apiKeyInput = document.getElementById("api-key-input");
const togglePwdBtn = document.getElementById("toggle-pwd-btn");
const testKeyBtn = document.getElementById("test-key-btn");
const saveKeyBtn = document.getElementById("save-key-btn");
const settingsStatus = document.getElementById("settings-status");

// LLM Toggle elements
const toggleGeminiBtn = document.getElementById("toggle-gemini-btn");
const toggleOllamaBtn = document.getElementById("toggle-ollama-btn");

// Ollama settings elements
const ollamaUrlInput = document.getElementById("ollama-url-input");
const ollamaModelInput = document.getElementById("ollama-model-input");
const ollamaStatus = document.getElementById("ollama-status");
const testOllamaBtn = document.getElementById("test-ollama-btn");
const saveOllamaBtn = document.getElementById("save-ollama-btn");

// State
let currentApiKey = "";
let activeLlm = "gemini"; // "gemini" or "ollama"
let ollamaUrl = "http://localhost:11434";
let ollamaModel = "gemma";

// ATS State
let atsFile = null;
let atsFileType = ""; // "docx" or "pdf"
let atsResumeContent = "";
let atsOriginalParagraphs = []; // For docx repacking
let atsDocxZip = null; // For docx repacking
let atsMatchAnalysis = null;
let atsOptimizedResume = "";
let atsUserConfirmedPartial = false;
let atsDownloadBlob = null;
let atsDownloadFilename = "";

/**
 * Shows the settings view and configures the back button.
 * @param {boolean} force - If true, forces settings view and hides the back button (used when no key exists).
 */
function showSettings(force = false) {
  generatorView.classList.add("hidden");
  settingsView.classList.remove("hidden");
  
  if (force) {
    backBtn.classList.add("hidden");
    showStatusMessage("Please configure your Gemini API key to start.", "error");
  } else {
    backBtn.classList.remove("hidden");
    clearStatusMessage();
  }
}

/**
 * Shows the generator view and hides the settings view.
 */
function showGenerator() {
  settingsView.classList.add("hidden");
  generatorView.classList.remove("hidden");
  clearStatusMessage();
}

/**
 * Displays a message in the settings status container.
 * @param {string} text - Message text.
 * @param {'success'|'error'} type - Style type.
 */
function showStatusMessage(text, type) {
  settingsStatus.textContent = text;
  settingsStatus.className = "status-message"; // Reset
  if (type === "success") {
    settingsStatus.classList.add("status-success");
  } else {
    settingsStatus.classList.add("status-error");
  }
}

/**
 * Clears the message in the settings status container.
 */
function clearStatusMessage() {
  settingsStatus.textContent = "";
  settingsStatus.className = "status-message";
}

/**
 * Makes a minimal Gemini API call ("Reply with just the word OK") to verify connection.
 * Never logs API keys to the console.
 * 
 * @param {string} apiKey - The API key to test.
 * @returns {Promise<boolean>} True if connection succeeded, false otherwise.
 */
async function testApiConnection(apiKey) {
  if (!apiKey) {
    showStatusMessage("API Key field is empty.", "error");
    return false;
  }

  showStatusMessage("Testing connection...", "success");
  testKeyBtn.disabled = true;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Reply with just the word OK"
              }
            ]
          }
        ]
      })
    });

    if (response.ok) {
      showStatusMessage("Connected ✓", "success");
      return true;
    } else {
      let errMsg = `HTTP Error ${response.status}`;
      try {
        const errorJson = await response.json();
        errMsg = errorJson.error?.message || errMsg;
        console.error("[Gemini Connection Test] Error response payload:", errorJson);
      } catch (e) {
        console.error("[Gemini Connection Test] Failed to parse error response as JSON. Status:", response.status);
      }
      showStatusMessage(`Connection failed: ${errMsg}`, "error");
      return false;
    }
  } catch (error) {
    showStatusMessage("Connection failed: Network error.", "error");
    return false;
  } finally {
    testKeyBtn.disabled = false;
  }
}

/**
 * Verifies local Ollama server connection and checks if the specified model is loaded.
 * 
 * @param {string} url - Ollama server endpoint.
 * @param {string} modelName - Targeted model name.
 * @returns {Promise<boolean>} True if connected and model is found, false otherwise.
 */
async function testOllamaConnection(url, modelName) {
  if (!url) {
    showOllamaStatus("Ollama URL is required.", "error");
    return false;
  }
  if (!modelName) {
    showOllamaStatus("Model name is required.", "error");
    return false;
  }

  showOllamaStatus("Testing connection...", "success");
  testOllamaBtn.disabled = true;

  try {
    const cleanUrl = url.replace(/\/$/, "");
    const response = await fetch(`${cleanUrl}/api/tags`);
    
    if (!response.ok) {
      if (response.status === 403) {
        showOllamaStatus("HTTP 403 Forbidden: CORS block. Set OLLAMA_ORIGINS=* environment variable and restart Ollama.", "error");
      } else {
        showOllamaStatus(`Connection failed. Server status: ${response.status}`, "error");
      }
      return false;
    }
    
    const data = await response.json();
    const models = data.models || [];
    
    // Check if the targeted model exists (ignoring case and matching model prefix)
    const normalizedTarget = modelName.toLowerCase();
    const modelFound = models.some(m => {
      const name = m.name.toLowerCase();
      return name === normalizedTarget || name.startsWith(normalizedTarget + ":");
    });
    
    if (modelFound) {
      showOllamaStatus("Local LLM Connected ✓", "success");
      return true;
    } else {
      const availableModels = models.map(m => m.name).join(", ") || "None";
      showOllamaStatus(`Connected, but model "${modelName}" not found. Available: ${availableModels}`, "error");
      return false;
    }
  } catch (error) {
    console.error("[Ollama Test] Network error:", error);
    const msg = error.message || "";
    if (msg.toLowerCase().includes("forbidden") || msg.includes("403")) {
      showOllamaStatus("HTTP 403 Forbidden: CORS block. Set OLLAMA_ORIGINS=* environment variable and restart Ollama.", "error");
    } else {
      showOllamaStatus(`Connection failed. Make sure Ollama is running at ${url}. (If this is a CORS error, set OLLAMA_ORIGINS=* and restart Ollama)`, "error");
    }
    return false;
  } finally {
    testOllamaBtn.disabled = false;
  }
}

/**
 * Displays status message for Ollama card.
 * @param {string} text - Message text.
 * @param {'success'|'error'} type - Message type.
 */
function showOllamaStatus(text, type) {
  ollamaStatus.textContent = text;
  ollamaStatus.className = "status-message";
  if (type === "success") {
    ollamaStatus.classList.add("status-success");
  } else {
    ollamaStatus.classList.add("status-error");
  }
}

/**
 * Updates LLM segmented toggle active styles based on current state.
 */
function updateLlmToggleUi() {
  if (activeLlm === "gemini") {
    toggleGeminiBtn.classList.add("active");
    toggleOllamaBtn.classList.remove("active");
  } else {
    toggleOllamaBtn.classList.add("active");
    toggleGeminiBtn.classList.remove("active");
  }
}

/**
 * Sends a message to the active tab to trigger scraping.
 */
async function triggerTabScrape() {
  scraperStatusText.textContent = "Attempting to scrape job description...";
  scraperBadge.textContent = "Scraping";
  scraperBadge.className = "scraper-badge";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      scraperStatusText.textContent = "No active browser tab found.";
      scraperBadge.textContent = "Error";
      return;
    }

    // Attempt to message content script
    chrome.tabs.sendMessage(tab.id, { action: "SCRAPE_JD" }, (response) => {
      if (chrome.runtime.lastError) {
        console.log("[SidePanel] Scraper content script not yet loaded, injecting it...");
        // Programmatic injection fallback if script is not running yet
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content/scraper.js"]
        }).catch(err => {
          console.error("[SidePanel] Failed to inject scraper script:", err);
          scraperStatusText.textContent = "Job sites only: Navigate to a supported job board.";
          scraperBadge.textContent = "Unavailable";
          scraperBadge.classList.add("not-found");
        });
      }
    });
  } catch (error) {
    console.error("[SidePanel] Error triggering scrape:", error);
    scraperStatusText.textContent = "Failed to initiate scraper.";
    scraperBadge.textContent = "Error";
  }
}

// Initialize Panel
async function initialize() {
  // Load API key
  currentApiKey = await getStorageItem("gemini_api_key", "");
  if (currentApiKey) {
    apiKeyInput.value = currentApiKey;
  }
  
  // Load Ollama state
  ollamaUrl = await getStorageItem("ollama_url", "http://localhost:11434");
  ollamaUrlInput.value = ollamaUrl;
  
  ollamaModel = await getStorageItem("ollama_model", "gemma");
  ollamaModelInput.value = ollamaModel;

  // Load active LLM backend
  activeLlm = await getStorageItem("active_llm", "gemini");
  updateLlmToggleUi();

  // Decide which view to show
  if (activeLlm === "gemini" && !currentApiKey) {
    showSettings(true);
  } else {
    showGenerator();
  }

  // Clear job description and status on load
  jdTextarea.value = "";
  scraperStatusText.textContent = "No active job description scraped.";
  scraperBadge.textContent = "Empty";
  scraperBadge.className = "scraper-badge not-found";
  
  // Load saved Resume
  const savedResume = await getStorageItem("resume_text", "");
  resumeTextarea.value = savedResume;

  // Load saved Resume Filename
  const savedFilename = await getStorageItem("resume_filename", "");
  if (savedFilename) {
    fileStatusText.textContent = savedFilename;
    fileStatusBanner.style.display = "flex";
  }

  // Hook up JD changes to update ATS Analyze button status
  jdTextarea.addEventListener("input", () => {
    if (typeof updateAtsAnalyzeBtnState === "function") {
      updateAtsAnalyzeBtnState();
    }
  });

  // No auto-scrape on load: JD is scraped only when the button is clicked.
}

// Event Listeners

// View toggles
gearBtn.addEventListener("click", () => {
  if (settingsView.classList.contains("hidden")) {
    showSettings(false);
  } else {
    if (activeLlm === "gemini" && !currentApiKey) {
      showSettings(true);
    } else {
      showGenerator();
    }
  }
});

backBtn.addEventListener("click", () => {
  if (activeLlm === "gemini" && !currentApiKey) {
    showStatusMessage("Please configure and save your Gemini API key.", "error");
  } else {
    showGenerator();
  }
});

// Segmented toggle clicks
toggleGeminiBtn.addEventListener("click", async () => {
  activeLlm = "gemini";
  updateLlmToggleUi();
  await setStorageItem("active_llm", "gemini");
  if (!currentApiKey) {
    showSettings(true);
  } else {
    showGenerator();
  }
});

toggleOllamaBtn.addEventListener("click", async () => {
  activeLlm = "ollama";
  updateLlmToggleUi();
  await setStorageItem("active_llm", "ollama");
  showGenerator();
});

// Password visibility toggle
togglePwdBtn.addEventListener("click", () => {
  if (apiKeyInput.type === "password") {
    apiKeyInput.type = "text";
    togglePwdBtn.textContent = "🙈";
  } else {
    apiKeyInput.type = "password";
    togglePwdBtn.textContent = "👁️";
  }
});

// Settings operations
saveKeyBtn.addEventListener("click", async () => {
  const newKey = apiKeyInput.value.trim();
  if (!newKey) {
    showStatusMessage("API Key cannot be empty.", "error");
    return;
  }

  saveKeyBtn.disabled = true;
  const success = await setStorageItem("gemini_api_key", newKey);
  saveKeyBtn.disabled = false;

  if (success) {
    currentApiKey = newKey;
    showStatusMessage("Settings saved successfully!", "success");
    setTimeout(() => {
      showGenerator();
    }, 1000);
  } else {
    showStatusMessage("Failed to save settings. Local storage error.", "error");
  }
});

testKeyBtn.addEventListener("click", async () => {
  const testKey = apiKeyInput.value.trim();
  await testApiConnection(testKey);
});

// Ollama Settings operations
saveOllamaBtn.addEventListener("click", async () => {
  const url = ollamaUrlInput.value.trim();
  const model = ollamaModelInput.value.trim();
  
  if (!url) {
    showOllamaStatus("Ollama URL cannot be empty.", "error");
    return;
  }
  if (!model) {
    showOllamaStatus("Model Name cannot be empty.", "error");
    return;
  }
  
  saveOllamaBtn.disabled = true;
  const successUrl = await setStorageItem("ollama_url", url);
  const successModel = await setStorageItem("ollama_model", model);
  saveOllamaBtn.disabled = false;
  
  if (successUrl && successModel) {
    ollamaUrl = url;
    ollamaModel = model;
    showOllamaStatus("Ollama settings saved!", "success");
    setTimeout(() => {
      showGenerator();
    }, 1000);
  } else {
    showOllamaStatus("Failed to save Ollama settings.", "error");
  }
});

testOllamaBtn.addEventListener("click", async () => {
  const url = ollamaUrlInput.value.trim();
  const model = ollamaModelInput.value.trim();
  await testOllamaConnection(url, model);
});

// Resume text autosave
resumeTextarea.addEventListener("input", () => {
  setStorageItem("resume_text", resumeTextarea.value);
  // Clear file banner if user edits manually
  if (fileStatusBanner.style.display !== "none") {
    fileStatusBanner.style.display = "none";
    fileStatusText.textContent = "";
    setStorageItem("resume_filename", "");
  }
});

// Resume file upload listeners
uploadTriggerBtn.addEventListener("click", () => {
  resumeFileInput.click();
});

resumeFileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (file) {
    await handleResumeFile(file);
  }
});

clearFileBtn.addEventListener("click", async () => {
  resumeTextarea.value = "";
  fileStatusBanner.style.display = "none";
  fileStatusText.textContent = "";
  resumeFileInput.value = "";
  await setStorageItem("resume_text", "");
  await setStorageItem("resume_filename", "");
});

// Clear input actions
clearJdBtn.addEventListener("click", () => {
  jdTextarea.value = "";
  scraperStatusText.textContent = "No active job description scraped.";
  scraperBadge.textContent = "Empty";
  scraperBadge.className = "scraper-badge not-found";
  if (typeof updateAtsAnalyzeBtnState === "function") {
    updateAtsAnalyzeBtnState();
  }
});

clearResumeBtn.addEventListener("click", async () => {
  resumeTextarea.value = "";
  fileStatusBanner.style.display = "none";
  fileStatusText.textContent = "";
  resumeFileInput.value = "";
  await setStorageItem("resume_text", "");
  await setStorageItem("resume_filename", "");
});

// Drag and drop listeners on resume card
resumeCard.addEventListener("dragover", (e) => {
  e.preventDefault();
  resumeCard.classList.add("drag-over");
});

resumeCard.addEventListener("dragenter", (e) => {
  e.preventDefault();
  resumeCard.classList.add("drag-over");
});

resumeCard.addEventListener("dragleave", (e) => {
  e.preventDefault();
  resumeCard.classList.remove("drag-over");
});

resumeCard.addEventListener("dragend", (e) => {
  e.preventDefault();
  resumeCard.classList.remove("drag-over");
});

resumeCard.addEventListener("drop", async (e) => {
  e.preventDefault();
  resumeCard.classList.remove("drag-over");
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const file = files[0];
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      await handleResumeFile(file);
    } else {
      alert("Please upload a PDF file.");
    }
  }
});

// Manual scrape trigger
reScrapeBtn.addEventListener("click", async () => {
  await triggerTabScrape();
});

// Copy output to clipboard
copyBtn.addEventListener("click", async () => {
  const text = outputContent.innerText;
  if (!text || text === "Cover letter will appear here...") return;

  try {
    await navigator.clipboard.writeText(text);
    const originalText = copyBtn.innerText;
    copyBtn.innerText = "✓ Copied";
    setTimeout(() => {
      copyBtn.innerText = originalText;
    }, 2000);
  } catch (err) {
    console.error("Clipboard copy failed:", err);
  }
});

// Download cover letter as Word Document (.doc)
downloadDocxBtn.addEventListener("click", () => {
  const text = outputContent.innerText;
  if (!text || text === "Cover letter will appear here...") return;

  // Convert newlines to standard Word paragraphs
  const paragraphs = text.split("\n\n").map(para => `<p class="MsoNormal">${para.replace(/\n/g, "<br>")}</p>`).join("");

  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>Cover Letter</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        body {
          font-family: 'Calibri', 'Arial', sans-serif;
          font-size: 11pt;
          line-height: 1.5;
        }
        p.MsoNormal {
          margin: 0in 0in 10pt;
        }
      </style>
    </head>
    <body>
      ${paragraphs}
    </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cover_letter.doc";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// Download cover letter as PDF file (directly using jsPDF)
downloadPdfBtn.addEventListener("click", () => {
  const text = outputContent.innerText;
  if (!text || text === "Cover letter will appear here...") return;

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    // Set styling and margins
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(11);

    const margin = 20; // 20mm margin on all sides
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxLineWidth = pageWidth - (margin * 2);
    
    // Split the text into lines matching the page margins
    const splitText = doc.splitTextToSize(text, maxLineWidth);
    
    let y = margin;
    const lineHeight = 6; // spacing between lines in mm

    for (let i = 0; i < splitText.length; i++) {
      // Check if we need a new page
      if (y + lineHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(splitText[i], margin, y);
      y += lineHeight;
    }

    // Trigger direct download
    doc.save("cover_letter.pdf");
  } catch (error) {
    console.error("PDF generation failed:", error);
    alert(`Failed to generate PDF: ${error.message}`);
  }
});

// Message listener for scraper
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "JD_SCRAPED") {
    console.log("[SidePanel] Scraped job description received.");
    jdTextarea.value = message.text;
    
    // Attempt to extract job site name
    let siteName = "Job Board";
    if (sender.tab && sender.tab.url) {
      try {
        const urlObj = new URL(sender.tab.url);
        siteName = urlObj.hostname.replace("www.", "");
      } catch (e) {
        // URL parse issue
      }
    }
    
    scraperStatusText.textContent = `Job description scraped from ${siteName}`;
    scraperBadge.textContent = "Scraped";
    scraperBadge.className = "scraper-badge";
    if (typeof updateAtsAnalyzeBtnState === "function") {
      updateAtsAnalyzeBtnState();
    }
  } else if (message.type === "JD_NOT_FOUND") {
    console.log("[SidePanel] Scraper did not detect job description.");
    scraperStatusText.textContent = "Could not detect job description contents.";
    scraperBadge.textContent = "Empty";
    scraperBadge.className = "scraper-badge not-found";
    if (typeof updateAtsAnalyzeBtnState === "function") {
      updateAtsAnalyzeBtnState();
    }
  }
});

// Generate letter
generateBtn.addEventListener("click", async () => {
  const jdText = jdTextarea.value.trim();
  const resumeText = resumeTextarea.value.trim();
  const tone = toneSelect.value;
  
  if (activeLlm === "gemini" && !currentApiKey) {
    showSettings(true);
    return;
  }
  if (activeLlm === "ollama" && (!ollamaUrl || !ollamaModel)) {
    showSettings(false);
    return;
  }
  if (!jdText) {
    alert("Please paste or scrape a job description first.");
    return;
  }
  if (!resumeText) {
    alert("Please enter your resume profile details.");
    return;
  }

  // Clear output and show pulsating circular loader
  outputContent.innerHTML = `
    <div class="loader-container">
      <div class="pulsating-circle"></div>
      <span style="font-size: 12px; color: var(--text-secondary);">AI is composing your cover letter...</span>
    </div>
  `;
  outputContent.classList.remove("placeholder-text");
  copyBtn.style.display = "none";
  downloadDocxBtn.style.display = "none";
  downloadPdfBtn.style.display = "none";
  generateBtn.disabled = true;
  generateBtn.innerText = "Generating...";

  try {
    let generator;
    if (activeLlm === "gemini") {
      generator = generateCoverLetter({
        jdText,
        resumeText,
        tone,
        apiKey: currentApiKey
      });
    } else {
      generator = generateOllamaCoverLetter({
        jdText,
        resumeText,
        tone,
        modelName: ollamaModel,
        ollamaUrl: ollamaUrl
      });
    }

    let isFirstChunk = true;
    let textSpan = null;
    let dotSpan = null;

    for await (const chunk of generator) {
      if (isFirstChunk) {
        // Clear loader and set up structural text/dot nodes
        outputContent.innerHTML = '<span id="generated-text"></span><span class="streaming-dot" id="stream-dot"></span>';
        textSpan = document.getElementById("generated-text");
        dotSpan = document.getElementById("stream-dot");
        isFirstChunk = false;
      }

      textSpan.innerText += chunk;
      // Scroll to bottom as streaming happens
      outputContent.scrollTop = outputContent.scrollHeight;
    }
    
    // Remove active streaming dot indicator when finished
    if (dotSpan) {
      dotSpan.remove();
    }
    
    copyBtn.style.display = "block";
    downloadDocxBtn.style.display = "block";
    downloadPdfBtn.style.display = "block";
  } catch (error) {
    let msg = error.message;
    if (msg.includes("403") || msg.toLowerCase().includes("forbidden")) {
      msg = "HTTP 403 Forbidden: CORS block. Set OLLAMA_ORIGINS=* environment variable and restart Ollama.";
    } else if (msg.toLowerCase().includes("failed to fetch")) {
      msg = `${error.message}. Make sure Ollama is running, and if CORS is blocked, set OLLAMA_ORIGINS=* and restart Ollama.`;
    }
    outputContent.innerHTML = `<span style="color: var(--danger); font-weight: 500;">Generation Failed:</span>\n${msg}`;
    outputContent.classList.add("placeholder-text");
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerText = "Generate";
  }
});

/**
 * Reads and parses the selected resume PDF file, extracts text, and saves it.
 * @param {File} file - The uploaded PDF file.
 */
async function handleResumeFile(file) {
  if (!file) return;

  fileStatusText.textContent = "Parsing PDF...";
  fileStatusBanner.style.display = "flex";
  uploadTriggerBtn.disabled = true;

  try {
    const text = await extractTextFromPdf(file);
    if (!text.trim()) {
      throw new Error("No text content could be extracted from this PDF.");
    }

    resumeTextarea.value = text;
    await setStorageItem("resume_text", text);
    
    const fileSizeStr = `${(file.size / 1024).toFixed(1)} KB`;
    const fileLabel = `${file.name} (${fileSizeStr})`;
    fileStatusText.textContent = fileLabel;
    await setStorageItem("resume_filename", fileLabel);
  } catch (error) {
    console.error("[SidePanel] PDF parse error:", error);
    alert(`Failed to extract text from PDF: ${error.message}`);
    fileStatusBanner.style.display = "none";
    fileStatusText.textContent = "";
    await setStorageItem("resume_filename", "");
  } finally {
    uploadTriggerBtn.disabled = false;
  }
}

/**
 * Extracts text contents from a PDF File object.
 * @param {File} file - The file object.
 * @returns {Promise<string>} The parsed text.
 */
async function extractTextFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  // Load the PDF document
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map(item => item.str)
      .join(" ");
    fullText += pageText + "\n";
  }
  return fullText;
}

// Clear job description when side panel unloads/closes
window.addEventListener("pagehide", () => {
  jdTextarea.value = "";
});

// Run init
initialize();

// ATS Upload Clear button handler
atsClearBtn.addEventListener("click", () => {
  atsFile = null;
  atsFileType = "";
  atsResumeContent = "";
  atsOriginalParagraphs = [];
  atsDocxZip = null;
  atsMatchAnalysis = null;
  atsOptimizedResume = "";
  atsUserConfirmedPartial = false;
  atsDownloadBlob = null;
  atsDownloadFilename = "";
  
  atsFileInput.value = "";
  atsFileBadge.classList.add("hidden");
  atsFileInfo.textContent = "";
  atsResumeText.value = "";
  atsMatchResult.classList.add("hidden");
  atsMatchStatusBanner.innerHTML = "";
  atsOutputContainer.classList.add("hidden");
  atsGenerateBtn.disabled = true;
  atsClearBtn.style.display = "none";
  atsScoreSlider.style.width = "0%";
  atsScoreSlider.style.backgroundColor = "var(--text-muted)";
  
  thresholdMinInput.value = 40;
  thresholdMaxInput.value = 65;
  updateThresholdSlider();
  
  updateAtsAnalyzeBtnState();
});

// --- ATS RESUME CORE IMPLEMENTATION ---

/**
 * Escapes HTML characters to prevent rendering bugs and injection.
 * @param {string} text - The raw text to escape.
 * @returns {string} The HTML-safe escaped text.
 */
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Updates the disabled state of the ATS Analyze Match button.
 */
function updateAtsAnalyzeBtnState() {
  const jdText = jdTextarea.value.trim();
  const resumeText = atsResumeContent.trim();
  if (jdText && resumeText) {
    atsAnalyzeBtn.disabled = false;
  } else {
    atsAnalyzeBtn.disabled = true;
  }
}

// Tab navigation switching handlers
tabNavCover.addEventListener("click", () => {
  tabNavCover.classList.add("active");
  tabNavAts.classList.remove("active");
  tabContentCover.classList.remove("hidden");
  tabContentAts.classList.add("hidden");
});

tabNavAts.addEventListener("click", () => {
  tabNavAts.classList.add("active");
  tabNavCover.classList.remove("active");
  tabContentCover.classList.add("hidden");
  tabContentAts.classList.remove("hidden");
  updateAtsAnalyzeBtnState();
});

// SECTION 1: Select and upload file
atsUploadBtn.addEventListener("click", () => {
  atsFileInput.click();
});

atsFileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // Reset output states when a new file is uploaded
  atsFile = file;
  atsFileType = "";
  atsResumeContent = "";
  atsOriginalParagraphs = [];
  atsDocxZip = null;
  atsMatchAnalysis = null;
  atsOptimizedResume = "";
  atsUserConfirmedPartial = false;
  atsDownloadBlob = null;
  atsDownloadFilename = "";
  
  atsFileBadge.classList.add("hidden");
  atsFileInfo.textContent = "";
  atsResumeText.value = "";
  atsMatchResult.classList.add("hidden");
  atsMatchStatusBanner.innerHTML = "";
  atsOutputContainer.classList.add("hidden");
  atsGenerateBtn.disabled = true;
  atsClearBtn.style.display = "inline-block";
  atsScoreSlider.style.width = "0%";
  atsScoreSlider.style.backgroundColor = "var(--text-muted)";

  if (file.name.toLowerCase().endsWith(".docx")) {
    atsFileType = "docx";
    atsFileBadge.textContent = "Structure preserved ✓";
    atsFileBadge.className = "scraper-badge badge-success";
    atsFileBadge.classList.remove("hidden");
    atsFileInfo.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    
    atsUploadBtn.disabled = true;
    atsFileInfo.textContent = "Parsing DOCX...";
    try {
      const { paragraphs, zip } = await extractDocxText(file);
      atsOriginalParagraphs = paragraphs;
      atsDocxZip = zip;
      
      const text = paragraphs.map(p => p.text).filter(t => t.trim() !== "").join("\n");
      atsResumeContent = text;
      atsResumeText.value = text;
      atsFileInfo.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    } catch (err) {
      console.error("DOCX extraction error:", err);
      alert(`Failed to extract text from Word document: ${err.message}`);
      atsFileInfo.textContent = "Extraction failed.";
      atsFile = null;
      atsFileType = "";
    } finally {
      atsUploadBtn.disabled = false;
    }
  } else if (file.name.toLowerCase().endsWith(".pdf")) {
    atsFileType = "pdf";
    atsFileBadge.textContent = "Content only — layout will be rebuilt";
    atsFileBadge.className = "scraper-badge badge-warning";
    atsFileBadge.classList.remove("hidden");
    atsFileInfo.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    
    atsUploadBtn.disabled = true;
    atsFileInfo.textContent = "Parsing PDF...";
    try {
      const text = await extractTextFromPdf(file);
      atsResumeContent = text;
      atsResumeText.value = text;
      atsFileInfo.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    } catch (err) {
      console.error("PDF extraction error:", err);
      alert(`Failed to extract text from PDF: ${err.message}`);
      atsFileInfo.textContent = "Extraction failed.";
      atsFile = null;
      atsFileType = "";
    } finally {
      atsUploadBtn.disabled = false;
    }
  } else {
    alert("Unsupported file format. Please upload a .docx or .pdf file.");
  }
  
  updateAtsAnalyzeBtnState();
});

// SECTION 2: Analyze Match
atsAnalyzeBtn.addEventListener("click", async () => {
  const jdText = jdTextarea.value.trim();
  const resumeText = atsResumeContent.trim();
  
  if (!jdText) {
    alert("Please provide a job description first.");
    return;
  }
  if (!resumeText) {
    alert("Please upload a resume first.");
    return;
  }
  if (!currentApiKey) {
    alert("Please configure your Gemini API key in Settings first.");
    showSettings(true);
    return;
  }

  atsSpinner.classList.remove("hidden");
  atsMatchResult.classList.add("hidden");
  atsMatchStatusBanner.innerHTML = "";
  atsGenerateBtn.disabled = true;
  atsAnalyzeBtn.disabled = true;

  try {
    const result = await scoreMatch({ jdText, resumeText, apiKey: currentApiKey });
    atsMatchAnalysis = result;

    const score = result.score;
    renderRecommendation(score);

    // Set pills
    atsMatchedSkills.innerHTML = result.matchedSkills.map(s => `<span class="pill pill-green">${escapeHtml(s)}</span>`).join("") || `<span style="font-size: 11px; color: var(--text-muted);">None</span>`;
    atsMissingSkills.innerHTML = result.missingSkills.map(s => `<span class="pill pill-red">${escapeHtml(s)}</span>`).join("") || `<span style="font-size: 11px; color: var(--text-muted);">None</span>`;

    // Reason Text
    atsReasonText.textContent = result.reason;

    atsMatchResult.classList.remove("hidden");
  } catch (error) {
    console.error("Match analysis error:", error);
    alert(`Failed to perform match analysis: ${error.message}`);
  } finally {
    atsSpinner.classList.add("hidden");
    atsAnalyzeBtn.disabled = false;
  }
});

// Diff comparison helper rendering
function updateDiffView(originalText, rewrittenText) {
  const originalLines = originalText.split("\n");
  const rewrittenLines = rewrittenText.split("\n");

  diffOriginal.innerHTML = originalLines.map(line => {
    return `<div class="diff-line">${escapeHtml(line) || "&nbsp;"}</div>`;
  }).join("");

  diffRewritten.innerHTML = rewrittenLines.map(line => {
    const trimmed = line.trim();
    // A line is considered modified if it's not empty and doesn't exist in originalLines.
    const isChanged = trimmed !== "" && !originalLines.some(ol => ol.trim() === trimmed);
    const lineClass = isChanged ? "diff-line changed" : "diff-line";
    return `<div class="${lineClass}">${escapeHtml(line) || "&nbsp;"}</div>`;
  }).join("");
}

// SECTION 3: Generate optimized resume
atsGenerateBtn.addEventListener("click", async () => {
  const jdText = jdTextarea.value.trim();
  const resumeText = atsResumeContent.trim();
  const matchedSkills = atsMatchAnalysis?.matchedSkills || [];

  if (!jdText || !resumeText) {
    alert("Job description or resume content is missing.");
    return;
  }
  if (!currentApiKey) {
    alert("Gemini API key is required.");
    return;
  }

  atsGenerateBtn.disabled = true;
  atsGenSpinner.classList.remove("hidden");
  atsOutputContainer.classList.add("hidden");
  atsOptimizedResume = "";
  atsDownloadBlob = null;

  try {
    const generator = rewriteForATS({
      jdText,
      resumeText,
      matchedSkills,
      apiKey: currentApiKey
    });

    let isFirstChunk = true;

    for await (const chunk of generator) {
      if (isFirstChunk) {
        atsOutputContainer.classList.remove("hidden");
        isFirstChunk = false;
      }
      atsOptimizedResume += chunk;
      updateDiffView(resumeText, atsOptimizedResume);
      // scroll the output div into view if it was hidden
      atsOutputContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    // Generator finished, update file info text
    if (atsFile) {
      atsFileInfo.textContent = `${atsFile.name} (Optimized ✓)`;
    }

  } catch (error) {
    console.error("Optimization failed:", error);
    alert(`Resume optimization failed: ${error.message}`);
  } finally {
    atsGenSpinner.classList.add("hidden");
    atsGenerateBtn.disabled = false;
  }
});

// Copy button
atsCopyBtn.addEventListener("click", async () => {
  if (!atsOptimizedResume) return;
  try {
    await navigator.clipboard.writeText(atsOptimizedResume);
    const originalText = atsCopyBtn.textContent;
    atsCopyBtn.textContent = "✓ Copied";
    setTimeout(() => {
      atsCopyBtn.textContent = originalText;
    }, 2000);
  } catch (err) {
    console.error("Copy to clipboard failed:", err);
  }
});

// Download DOCX button
atsDownloadDocxBtn.addEventListener("click", async () => {
  if (!atsOptimizedResume) {
    alert("Please generate optimized resume text first.");
    return;
  }
  
  atsDownloadDocxBtn.disabled = true;
  const originalLabel = atsDownloadDocxBtn.textContent;
  atsDownloadDocxBtn.textContent = "⌛ Packaging...";
  
  try {
    let blob;
    let filename = atsFile ? `optimized_${atsFile.name.replace(/\.[a-zA-Z0-9]+$/, "")}.docx` : "optimized_resume.docx";
    
    if (atsFileType === "docx" && atsDocxZip) {
      // Structure preserved docx flow using docx-editor
      blob = await injectRewrittenText(atsDocxZip, atsOriginalParagraphs, atsOptimizedResume, currentApiKey);
    } else {
      // Generate a standard DOCX from scratch using JSZip
      const JSZip = await loadJSZip();
      const zip = new JSZip();
      
      zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
      </Types>`);
      
      zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
      </Relationships>`);
      
      const lines = atsOptimizedResume.split("\n");
      let paragraphsXml = "";
      for (const line of lines) {
        const escapedLine = line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&apos;");
        paragraphsXml += `<w:p><w:r><w:t>${escapedLine}</w:t></w:r></w:p>`;
      }
      
      zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          ${paragraphsXml}
          <w:sectPr>
            <w:pgSz w:w="12240" w:h="15840"/>
            <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
          </w:sectPr>
        </w:body>
      </w:document>`);
      
      blob = await zip.generateAsync({ type: "blob" });
    }
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("DOCX export failed:", error);
    alert(`Failed to export DOCX: ${error.message}`);
  } finally {
    atsDownloadDocxBtn.disabled = false;
    atsDownloadDocxBtn.textContent = originalLabel;
  }
});

// Download PDF button
atsDownloadPdfBtn.addEventListener("click", () => {
  if (!atsOptimizedResume) {
    alert("Please generate optimized resume text first.");
    return;
  }
  
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxLineWidth = pageWidth - (margin * 2);
    
    const splitText = doc.splitTextToSize(atsOptimizedResume, maxLineWidth);
    let y = margin;
    const lineHeight = 5;
    
    for (let i = 0; i < splitText.length; i++) {
      if (y + lineHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(splitText[i], margin, y);
      y += lineHeight;
    }
    
    let filename = atsFile ? `optimized_${atsFile.name.replace(/\.[a-zA-Z0-9]+$/, "")}.pdf` : "optimized_resume.pdf";
    doc.save(filename);
  } catch (error) {
    console.error("PDF export failed:", error);
    alert(`Failed to export PDF: ${error.message}`);
  }
});

/**
 * Dynamically renders the match rating badge, slider visual color, and recommendation alerts
 * based on the computed match score and custom thresholds.
 * 
 * @param {number} score - The match score percentage (0-100).
 */
function renderRecommendation(score) {
  const minThresh = parseInt(thresholdMinInput.value, 10);
  const maxThresh = parseInt(thresholdMaxInput.value, 10);

  // 1. Set Score Badge and Slider track color
  atsScoreBadge.textContent = `${score}%`;
  atsScoreBadge.className = "score-badge"; // reset class
  
  atsScoreSlider.style.width = `${score}%`;
  
  if (score < minThresh) {
    atsScoreBadge.classList.add("score-red");
    atsScoreSlider.style.backgroundColor = "var(--danger)";
  } else if (score < maxThresh) {
    atsScoreBadge.classList.add("score-amber");
    atsScoreSlider.style.backgroundColor = "#f59e0b"; // amber
  } else {
    atsScoreBadge.classList.add("score-green");
    atsScoreSlider.style.backgroundColor = "var(--success)";
  }

  // 2. Set recommendation banner and button states
  let rec = "skip";
  if (score >= maxThresh) {
    rec = "proceed";
  } else if (score >= minThresh) {
    rec = "partial";
  }

  if (rec === "skip") {
    atsMatchStatusBanner.innerHTML = `
      <div class="banner-danger">
        This role isn't a strong match — your resume has been kept unchanged.
      </div>
    `;
    atsGenerateBtn.disabled = true;
  } else if (rec === "partial") {
    atsMatchStatusBanner.innerHTML = `
      <div class="banner-warning">
        <span>Partial match detected. Some key skills are missing. Generate optimized version anyway?</span>
        <div class="banner-btn-group">
          <button id="banner-btn-yes" class="banner-btn banner-btn-yes" type="button">Yes</button>
          <button id="banner-btn-no" class="banner-btn banner-btn-no" type="button">No</button>
        </div>
      </div>
    `;
    
    // Wire up dynamic partial confirm buttons
    document.getElementById("banner-btn-yes").addEventListener("click", () => {
      atsUserConfirmedPartial = true;
      atsGenerateBtn.disabled = false;
      atsMatchStatusBanner.innerHTML = `
        <div class="banner-success">
          Partial match accepted. Ready to optimize.
        </div>
      `;
    });

    document.getElementById("banner-btn-no").addEventListener("click", () => {
      atsUserConfirmedPartial = false;
      atsGenerateBtn.disabled = true;
      atsMatchStatusBanner.innerHTML = `
        <div class="banner-danger">
          Generation cancelled. Resume kept unchanged.
        </div>
      `;
    });

    if (atsUserConfirmedPartial) {
      atsGenerateBtn.disabled = false;
      atsMatchStatusBanner.innerHTML = `
        <div class="banner-success">
          Partial match accepted. Ready to optimize.
        </div>
      `;
    } else {
      atsGenerateBtn.disabled = true;
    }
  } else {
    // proceed
    atsMatchStatusBanner.innerHTML = `
      <div class="banner-success">
        Strong match — ready to optimize.
      </div>
    `;
    atsGenerateBtn.disabled = false;
  }
}

/**
 * Handles sliding constraints, tracks boundaries, and re-renders recommendation states.
 */
function updateThresholdSlider() {
  let minVal = parseInt(thresholdMinInput.value, 10);
  let maxVal = parseInt(thresholdMaxInput.value, 10);

  // Enforce minVal <= maxVal
  if (minVal > maxVal) {
    minVal = maxVal;
    thresholdMinInput.value = minVal;
  }

  // Update track boundaries
  sliderActiveTrack.style.left = `${minVal}%`;
  sliderActiveTrack.style.right = `${100 - maxVal}%`;

  // Update slider label numbers
  thresholdMinVal.textContent = minVal;
  thresholdMinRange.textContent = minVal;
  thresholdMaxRange.textContent = maxVal;
  thresholdMaxVal.textContent = maxVal;

  // Real-time re-render recommendation if score analysis already exists
  if (atsMatchAnalysis && typeof atsMatchAnalysis.score === "number") {
    renderRecommendation(atsMatchAnalysis.score);
  }
}

// Bind sliders to handlers
thresholdMinInput.addEventListener("input", updateThresholdSlider);
thresholdMaxInput.addEventListener("input", () => {
  let minVal = parseInt(thresholdMinInput.value, 10);
  let maxVal = parseInt(thresholdMaxInput.value, 10);

  if (maxVal < minVal) {
    maxVal = minVal;
    thresholdMaxInput.value = maxVal;
  }
  updateThresholdSlider();
});

// Run slider init
updateThresholdSlider();
