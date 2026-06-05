# ResuMate AI (Chrome Extension)

An elegant, premium Chrome Extension (Manifest V3) designed to optimize resumes for ATS compatibility and generate highly-tailored cover letters instantly. By utilizing the `chrome.sidePanel` API, the extension remains accessible on your screen while you browse job listings on popular platforms. It extracts job descriptions automatically, parses your resume (.docx or .pdf) client-side, runs match analysis against job criteria, rewrites resumes for ATS optimization, and streams cover letters directly from Google's **Gemini API** or your local **Ollama** server.

---

## 🌟 Key Features

### 📋 ATS Resume Optimizer (Primary Tab)
*   **Multi-Format Resume Upload:** Supports drag-and-drop or file upload for both Microsoft Word (`.docx`) and Adobe PDF (`.pdf`) formats.
*   **Structure Badges:** Instantly informs the user of format support:
    *   `Structure preserved ✓` (Green) for `.docx` uploads indicating that structural layout remains intact.
    *   `Content only — layout will be rebuilt` (Amber) for `.pdf` uploads.
*   **Local Processing & Security:** All resume file parsing is executed client-side on the device. Resume details are saved in `chrome.storage.local` and never shared with third-party servers (except directly via the Gemini API/Ollama server).
*   **Dynamic Threshold Match Slider:** Features a double-ended slider to dynamically adjust the minimum and maximum threshold levels for job matching on a single slider bar.
*   **Instant Match Analysis:** Automatically scores the resume (`scoreMatch()`) and renders:
    *   A dynamic color-coded Score Badge (Red `< 40`, Amber `40 - 65`, Green `≥ 65`).
    *   Match pills (Matched Skills in green, Missing Skills in red).
    *   AI-powered recommendation banners ("Proceed", "Partial Match", or "Skip") with reasoning that dynamically update when the threshold sliders are adjusted.
*   **ATS Optimization & Rewrite (`rewriteForATS()`):** Streams optimized text updates via Gemini.
    *   *Rules-enforced alignment:* Rewords bullets to incorporate key JD keywords using strong action verbs (*led*, *built*, *optimized*) and tailors the professional summary.
    *   *Chronology Protection:* Strictly preserves the applicant's chronological ordering of roles (latest at the top) even if the latest job is not correlated with the JD.
    *   *Data Safeguards:* Never invents skills, projects, or achievements not present in the original resume. Never alters job titles, companies, dates, or education.
*   **Side-by-Side Diff Preview:** Displays a comparative highlight box matching the original resume structure alongside the optimized resume for clear visual diff checking.
*   **Lossless Word Export:** Repacks the optimized text back into the uploaded `.docx` zip structure client-side via `jszip.min.js`, updating text nodes (`<w:t>`) while keeping all styling, margins, fonts, and headers intact.
*   **Multi-Format Exports:** Download optimized resumes directly as `.docx`, `.pdf`, or `.txt`.

### ✉️ Cover Letter Generator (Secondary Tab)
*   **Scraped JD & Profile Auto-Population:** Automatically pulls the active job description and current resume text.
*   **Dynamic Tone Selector:** Instantly adapts style (Formal, Confident, or Friendly).
*   **Anti-Hallucination Guardrails:** Restricts letter details exclusively to elements present in the candidate's uploaded resume profile.
*   **Streaming Output:** Streams paragraphs word-by-word with a breathing dot loader.
*   **Exports:** Quick buttons to copy to clipboard, download as Microsoft Word (`.doc`), or export as a styled client-side PDF.

### ⚙️ Extensible LLM Support
*   **Gemini Cloud API:** Leverages Google's `gemini-2.0-flash` model for high-speed, state-of-the-art responses.
*   **Local Ollama Integration:** Enables fully offline runs with custom URLs and CORS checks.

---

## 📁 File Structure

```text
├── background/
│   ├── logo.png                   # Extension logo / action icon
│   └── service-worker.js          # Service worker configured to launch the side panel
├── content/
│   └── scraper.js                 # Content script injected into job boards to extract JD text
├── libs/
│   ├── jspdf.umd.min.js           # Client-side PDF generation utility
│   ├── jszip.min.js               # Local JSZip utility to repack DOCX files under MV3 CSP rules
│   ├── pdf.min.js                 # PDF.js core library
│   └── pdf.worker.min.js          # PDF.js worker logic
├── sidepanel/
│   ├── sidepanel.html             # Dark-themed glassmorphism interface (ATS-focused layout)
│   └── sidepanel.js               # Main panel logic, event handlings, slider hooks, and downloads
├── utils/
│   ├── ats-rewriter.js            # Generator for streaming ATS optimization rewrites
│   ├── docx-editor.js             # Handles local XML text extraction and lossless injection in DOCX files
│   ├── gemini.js                  # Stream generator for Google Gemini API
│   ├── matcher.js                 # Non-streaming Match Scorer via Gemini
│   ├── ollama.js                  # Stream generator for Local Ollama API
│   └── storage.js                 # Promise-based wrapper for chrome.storage.local
├── manifest.json                  # Manifest V3 extension configuration
└── README.md                      # Project documentation
```

---

## 🚀 Installation & Setup

Since this extension uses vanilla JavaScript without compile/build steps, load it directly into Google Chrome:

1.  **Clone or Download** this repository to your local machine.
2.  Open Google Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** using the toggle switch in the top-right corner.
4.  Click **Load unpacked** in the top-left corner.
5.  Select the project's root folder (the folder containing `manifest.json`).
6.  The **ResuMate AI** icon will appear in your extensions list. Pin it for quick access!

---

## ⚙️ Configuration

Open the side panel by clicking the extension action icon, then click the gear icon (**⚙**) to open **Settings**:

### 1. Google Gemini API Setup (Cloud)
*   Obtain a free or paid API key from [Google AI Studio](https://aistudio.google.com/).
*   Paste your key in the **Gemini API Key** field, click **Test Gemini** to verify, and click **Save Gemini**.
*   Select **Gemini** in the header toggle.

### 2. Ollama Setup (Local/Offline)
*   Ensure [Ollama](https://ollama.com/) is installed and running on your machine.
*   Run your preferred model in your command line:
    ```bash
    ollama run gemma
    ```
*   In the settings pane, input your server URL (default: `http://localhost:11434`) and your loaded model name (e.g., `gemma`).
*   **CORS Configuration:** Configure the environment variable `OLLAMA_ORIGINS=*` before starting Ollama:
    *   **macOS / Linux:** `OLLAMA_ORIGINS="*" ollama serve`
    *   **Windows:** Set system environment variable `OLLAMA_ORIGINS` to `*` and relaunch the Ollama application.
*   Click **Test Ollama** to verify the model is active, and click **Save Ollama**.
*   Select **Ollama** in the header toggle.

---

## 📝 How to Use

### Step 1: Get the Job Description
1. Navigate to a job listing page on **LinkedIn**, **Indeed**, **Greenhouse**, **Lever**, or **Workday**.
2. Open the side panel and click **🔄 Scrape**. The content script automatically extracts and cleans the text.

### Step 2: Upload Your Resume
1. In the **ATS Resume** tab under **Resume File**, drag and drop or select your `.docx` or `.pdf` file.
2. The UI will extract the text and show the appropriate badge (`Structure preserved ✓` or `Content only`).
3. Press **❌ Clear** at any time to purge fields and reset.

### Step 3: Match Analysis
1. Adjust the dual-end **Threshold Slider** to set your personal minimum and maximum match score limits.
2. Click **Analyze Match** to run the score generator.
3. Review the color-coded score, matched/missing skills pills, and recommendations. 
4. Slide the thresholds to watch recommendations update in real time based on your limits.

### Step 4: Optimize & Rewrite
1. Scroll down to Section 3 of the ATS Resume tab and click **Optimize Resume**.
2. View the optimization diff layout (Original vs. Rewritten) as it streams.
3. Export your optimized resume by selecting **DOCX**, **PDF**, or **TXT**.

### Step 5: Draft a Cover Letter
1. Click the **Cover Letter** tab.
2. The extracted JD and resume text are automatically loaded.
3. Select a **Tone** (Formal, Confident, Friendly) and click **Generate**.
4. Click **Copy**, **Word**, or **PDF** to save your cover letter!
