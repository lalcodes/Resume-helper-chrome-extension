/**
 * Service worker for the AI Cover Letter Generator.
 * Configures extension action to open the side panel.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log("ResuMate AI installed.");
});

// Configure side panel behavior
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Error setting side panel behavior:", error));
