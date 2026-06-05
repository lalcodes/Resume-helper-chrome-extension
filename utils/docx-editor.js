/**
 * Utility for parsing and editing Microsoft Word (.docx) files in the browser using JSZip.
 */

/**
 * Dynamically loads JSZip from CDN if not already loaded.
 * @returns {Promise<Object>} The JSZip library instance.
 */
export async function loadJSZip() {
  if (window.JSZip) {
    return window.JSZip;
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "../libs/jszip.min.js";
    script.onload = () => {
      console.log("[docx-editor] JSZip loaded successfully from CDN.");
      resolve(window.JSZip);
    };
    script.onerror = () => {
      reject(new Error("Failed to load JSZip library from CDN."));
    };
    document.head.appendChild(script);
  });
}

/**
 * Extracts paragraphs from a .docx File object.
 * 
 * @param {File} file - The uploaded DOCX file.
 * @returns {Promise<{paragraphs: Array<{id: string, text: string}>, zip: Object}>} The paragraphs list and JSZip instance.
 */
export async function extractDocxText(file) {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(file);
  
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    throw new Error("Invalid .docx format: word/document.xml is missing.");
  }
  
  const xmlContent = await docFile.async("text");
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, "application/xml");
  
  const pElements = xmlDoc.getElementsByTagName("w:p");
  const paragraphs = [];
  
  for (let i = 0; i < pElements.length; i++) {
    const pNode = pElements[i];
    const tElements = pNode.getElementsByTagName("w:t");
    let text = "";
    
    for (let j = 0; j < tElements.length; j++) {
      text += tElements[j].textContent;
    }
    
    // We keep all paragraphs, including empty ones, to preserve indices during inject mapping.
    paragraphs.push({
      id: `p${i}`,
      text: text
    });
  }
  
  return { paragraphs, zip };
}

/**
 * Maps original paragraphs to rewritten text using Gemini, updates document.xml, and repacks.
 * 
 * @param {Object} zip - The raw JSZip instance of the loaded DOCX.
 * @param {Array<{id: string, text: string}>} originalParagraphs - Original paragraphs list.
 * @param {string} rewrittenText - The fully rewritten resume text.
 * @param {string} apiKey - The Gemini API key.
 * @returns {Promise<Blob>} A Blob representing the updated .docx file.
 */
export async function injectRewrittenText(zip, originalParagraphs, rewrittenText, apiKey) {
  if (!zip) throw new Error("Zip object is missing.");
  if (!originalParagraphs || !originalParagraphs.length) throw new Error("Original paragraphs are missing.");
  if (!rewrittenText) throw new Error("Rewritten text is missing.");
  if (!apiKey) throw new Error("API key is required for paragraph semantic mapping.");

  const rewrittenLines = rewrittenText
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  let mappings = [];
  try {
    const prompt = `You are a paragraph mapping utility. You are given a list of original paragraphs from a resume (with IDs), and a list of rewritten lines of a resume.
Map each original paragraph to its corresponding rewritten line by semantic similarity.
Return ONLY valid JSON, a flat array of objects, with no markdown formatting, no explanations:
[
  { "id": "original_paragraph_id", "newText": "matching_rewritten_line" }
]

ORIGINAL PARAGRAPHS:
${JSON.stringify(originalParagraphs.map(p => ({ id: p.id, text: p.text })))}

REWRITTEN LINES:
${JSON.stringify(rewrittenLines)}

JSON:`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const resJson = await response.json();
    let textResult = resJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
    // Clean potential markdown fencing
    textResult = textResult.replace(/```json/g, "").replace(/```/g, "").trim();
    mappings = JSON.parse(textResult);
  } catch (error) {
    console.error("[docx-editor] Gemini semantic mapping failed, falling back to position-based mapping:", error);
    // Position-based mapping fallback
    mappings = originalParagraphs.map((p, idx) => ({
      id: p.id,
      newText: rewrittenLines[idx] !== undefined ? rewrittenLines[idx] : p.text
    }));
  }

  // Reload word/document.xml from the zip
  const docFile = zip.file("word/document.xml");
  const xmlContent = await docFile.async("text");
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, "application/xml");
  const pElements = xmlDoc.getElementsByTagName("w:p");

  // Apply new text to matching paragraphs
  for (const item of mappings) {
    const pIdx = parseInt(item.id.replace("p", ""), 10);
    if (isNaN(pIdx) || pIdx < 0 || pIdx >= pElements.length) {
      continue;
    }
    
    const pNode = pElements[pIdx];
    const tElements = pNode.getElementsByTagName("w:t");
    if (tElements.length > 0) {
      // Replace only the first w:t element's text content, and clear out subsequent ones.
      // This preserves the styling tags (<w:rPr>, <w:pPr>) associated with each run.
      tElements[0].textContent = item.newText;
      for (let k = 1; k < tElements.length; k++) {
        tElements[k].textContent = "";
      }
    }
  }

  // Serialize and write back to zip
  const serializer = new XMLSerializer();
  const updatedXmlContent = serializer.serializeToString(xmlDoc);
  zip.file("word/document.xml", updatedXmlContent);

  // Package zip into Blob
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });

  return blob;
}

// Console sanity check hook
window.docxEditorTest = async (file) => {
  console.log("[docx-editor] Starting console sanity check...");
  try {
    const { paragraphs, zip } = await extractDocxText(file);
    console.log("[docx-editor] Success! Extracted", paragraphs.length, "paragraphs.");
    console.log("[docx-editor] Paragraph preview:", paragraphs.slice(0, 5));
    console.log("[docx-editor] JSZip reference:", zip);
    return { paragraphs, zip };
  } catch (err) {
    console.error("[docx-editor] Sanity check error:", err);
  }
};
