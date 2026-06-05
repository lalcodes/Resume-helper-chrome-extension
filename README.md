# AI Cover Letter Generator (Chrome Extension)

An elegant, premium Chrome Extension (Manifest V3) designed to help candidates generate highly-tailored cover letters instantly. By utilizing the `chrome.sidePanel` API, the extension remains accessible on your screen while you browse job listings on popular platforms. It extracts the job description automatically, parses your resume PDF client-side, and streams cover letters directly from either Google's **Gemini API** or your local **Ollama** server.

---

## 🌟 Key Features

*   **Integrated Side Panel:** Uses the modern `chrome.sidePanel` layout, providing a sticky, persistent sidebar that stays open as you navigate between job listings.
*   **Automatic Job Description Scraper:** Runs content scripts on key job platforms—**LinkedIn, Indeed, Greenhouse, Lever, and Workday**—with a robust fallback text-density heuristic to capture descriptions on unsupported websites.
*   **Local PDF Parser:** Drag and drop or upload your resume PDF. The extension parses the text locally using [PDF.js](https://mozilla.github.io/pdf.js/) and saves your profile to Chrome's local storage.
*   **Dual LLM Backends:**
    *   **Gemini Cloud API:** Leverages Google's `gemini-3.5-flash` model for ultra-fast, high-quality generation.
    *   **Local Ollama Server:** Fully offline integration supporting local models (e.g., `gemma`, `llama3`, `mistral`) with custom server URL configuration and automated CORS checking warnings.
*   **Streaming UI/UX:** Word-by-word streaming generation via `ReadableStream` with a clean breathing dot loading indicator and custom scroll-to-bottom mechanics.
*   **Advanced Prompt Engineering Rules:** Generates concise 3-paragraph cover letters matching specific formats (date, target block, and optional hiring manager header) while strictly prohibiting generic/cliché filler sentences and preventing hallucinations (only mentions skills present in your profile).
*   **Easy Export Actions:**
    *   📋 Copy directly to your clipboard.
    *   📄 Export as a Microsoft Word Document (`.doc`).
    *   🖨️ Save as a styled PDF (client-side generation using `jsPDF`).

---

## 📁 File Structure

```text
├── background/
│   ├── logo.png                   # Extension logo / action icon
│   └── service-worker.js          # Background script configured to open the side panel
├── content/
│   └── scraper.js                 # Content script injected into job boards to extract JD text
├── libs/
│   ├── jspdf.umd.min.js           # Client-side PDF generation utility
│   ├── pdf.min.js                 # PDF.js core library
│   └── pdf.worker.min.js          # PDF.js worker logic
├── sidepanel/
│   ├── sidepanel.html             # Sleek dark-themed glassmorphism interface
│   └── sidepanel.js               # Event-handling, file extraction, and stream management
├── utils/
│   ├── gemini.js                  # Stream generator for Google Gemini API
│   ├── ollama.js                  # Stream generator for Local Ollama API
│   └── storage.js                 # Promise-based wrapper for chrome.storage.local
├── manifest.json                  # Manifest V3 configuration file
└── README.md                      # Project documentation
```

---

## 🚀 Installation & Setup

Since this extension uses vanilla JavaScript without compile/build steps, you can load it directly into Google Chrome:

1.  **Clone or Download** this repository to your local machine.
2.  Open Google Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** using the toggle switch in the top-right corner.
4.  Click **Load unpacked** in the top-left corner.
5.  Select the project's root folder (the folder containing `manifest.json`).
6.  The **AI Cover Letter Generator** icon will appear in your extensions list. Pin it for quick access!

---

## ⚙️ Configuration

Click the extension icon to open the side panel, then click the gear icon (**⚙**) to open **Settings**:

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
*   In the extension settings under **Ollama Local LLM**, input your server URL (default: `http://localhost:11434`) and your loaded model name (e.g., `gemma`).
*   **Important CORS Note:** Ollama blocks web extensions by default. You must configure the environment variable `OLLAMA_ORIGINS=*` before starting Ollama:
    *   **macOS / Linux:** `OLLAMA_ORIGINS="*" ollama serve`
    *   **Windows:** Set system environment variable `OLLAMA_ORIGINS` to `*` and relaunch the Ollama app.
*   Click **Test Ollama** to verify the model is active, and click **Save Ollama**.
*   Select **Ollama** in the header toggle.

---

## 📝 How to Use

1.  Navigate to a job listing page on **LinkedIn**, **Indeed**, **Greenhouse**, **Lever**, or **Workday**.
2.  Open the extension side panel by clicking the extension action icon.
3.  Click the **🔄 Scrape** button at the top of the job description card. The script will automatically scrape, clean, and populate the job description textarea.
4.  Provide your profile by pasting text into the **Resume** box or by clicking **📄 Upload PDF** (or drag & drop your resume PDF directly onto the resume card).
5.  Select your desired cover letter **Tone** (Formal, Confident, or Friendly).
6.  Click **Generate** to watch your cover letter stream in real time.
7.  Click **Copy**, **Word**, or **PDF** to export your new cover letter!
