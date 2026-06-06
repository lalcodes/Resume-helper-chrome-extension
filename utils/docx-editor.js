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
export async function injectRewrittenText(zip, originalParagraphs, rewrittenText, apiKeyOrOptions) {
  if (!zip) throw new Error("Zip object is missing.");
  if (!originalParagraphs || !originalParagraphs.length) throw new Error("Original paragraphs are missing.");
  if (!rewrittenText) throw new Error("Rewritten text is missing.");

  let activeLlm = "gemini";
  let apiKey = "";
  let ollamaUrl = "";
  let ollamaModel = "";

  if (typeof apiKeyOrOptions === "object" && apiKeyOrOptions !== null) {
    activeLlm = apiKeyOrOptions.activeLlm || "gemini";
    apiKey = apiKeyOrOptions.apiKey || "";
    ollamaUrl = apiKeyOrOptions.ollamaUrl || "";
    ollamaModel = apiKeyOrOptions.ollamaModel || "";
  } else {
    apiKey = apiKeyOrOptions || "";
  }

  if (activeLlm === "gemini" && !apiKey) {
    throw new Error("Gemini API key is required for paragraph semantic mapping.");
  }
  if (activeLlm === "ollama" && (!ollamaUrl || !ollamaModel)) {
    throw new Error("Ollama URL and model name are required for paragraph semantic mapping.");
  }

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

    let textResult = "";
    if (activeLlm === "gemini") {
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
      textResult = resJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else {
      const url = `${ollamaUrl.replace(/\/$/, "")}/api/generate`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollamaModel,
          prompt: prompt,
          stream: false,
          format: "json"
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const resJson = await response.json();
      textResult = resJson.response || "";
    }

    // Clean potential markdown fencing
    textResult = textResult.replace(/```json/g, "").replace(/```/g, "").trim();
    mappings = JSON.parse(textResult);
  } catch (error) {
    console.error(`[docx-editor] ${activeLlm} semantic mapping failed, falling back to position-based mapping:`, error);
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

  // Apply new text to matching paragraphs using Anchor-Based Distribution to preserve styling and hyperlinks
  for (const item of mappings) {
    const pIdx = parseInt(item.id.replace("p", ""), 10);
    if (isNaN(pIdx) || pIdx < 0 || pIdx >= pElements.length) {
      continue;
    }
    
    const pNode = pElements[pIdx];
    const tElements = Array.from(pNode.getElementsByTagName("w:t"));
    if (tElements.length === 0) {
      continue;
    }

    if (tElements.length === 1) {
      tElements[0].textContent = item.newText;
      continue;
    }

    // Determine which tElements are part of a hyperlink
    const runsInfo = tElements.map(tNode => {
      let isHyperlink = false;
      let parent = tNode.parentNode;
      while (parent && parent !== pNode) {
        if (parent.nodeName === "w:hyperlink" || parent.nodeName.endsWith("hyperlink")) {
          isHyperlink = true;
          break;
        }
        parent = parent.parentNode;
      }
      return {
        node: tNode,
        originalText: tNode.textContent || "",
        isHyperlink: isHyperlink
      };
    });

    const newText = item.newText;
    const distributedTexts = distributeTextToRuns(runsInfo, newText);

    // Apply the distributed text
    for (let k = 0; k < runsInfo.length; k++) {
      runsInfo[k].node.textContent = distributedTexts[k];
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

/**
 * Distributes the rewritten text across multiple runs to preserve formatting and hyperlinks.
 * 
 * @param {Array<{node: Object, originalText: string, isHyperlink: boolean}>} runsInfo 
 * @param {string} newText 
 * @returns {Array<string>} An array of texts to assign to each run.
 */
function distributeTextToRuns(runsInfo, newText) {
  const n = runsInfo.length;
  const result = new Array(n).fill("");
  
  // Helper to determine if a run text is a valid anchor
  const isValidAnchor = (text, isHyperlink) => {
    if (isHyperlink) return true;
    if (!text) return false;
    const trimmed = text.trim();
    if (trimmed.length < 3) return false;
    if (/^[.,:\-\s()\[\]{}]+$/.test(trimmed)) return false;
    return true;
  };

  // Step 1: Find exact matches (anchors) in newText, respecting order.
  const matches = new Array(n).fill(null); // { start, end }
  let currentIdx = 0;
  
  for (let i = 0; i < n; i++) {
    const orig = runsInfo[i].originalText;
    if (orig === "") {
      matches[i] = { start: currentIdx, end: currentIdx };
      continue;
    }
    
    if (isValidAnchor(orig, runsInfo[i].isHyperlink)) {
      const idx = newText.indexOf(orig, currentIdx);
      if (idx !== -1) {
        matches[i] = { start: idx, end: idx + orig.length };
        currentIdx = idx + orig.length;
      }
    }
  }

  // Step 2: Group unmatched runs and distribute the remaining text segments between matched anchors.
  let lastEnd = 0;
  let i = 0;
  
  while (i < n) {
    if (matches[i] !== null) {
      result[i] = newText.substring(matches[i].start, matches[i].end);
      lastEnd = matches[i].end;
      i++;
      continue;
    }
    
    // Find the range of unmatched runs [i, j]
    let j = i;
    while (j < n && matches[j] === null) {
      j++;
    }
    
    // The segment text in newText for this unmatched group is between lastEnd and the start of the next matched anchor (or end of newText)
    const nextStart = (j < n) ? matches[j].start : newText.length;
    let segmentText = newText.substring(lastEnd, nextStart);
    
    // Distribute segmentText among runsInfo[i...j-1]
    const unmatchedCount = j - i;
    const groupRuns = runsInfo.slice(i, j);
    const groupResults = distributeSegmentToUnmatched(groupRuns, segmentText);
    
    for (let k = 0; k < unmatchedCount; k++) {
      result[i + k] = groupResults[k];
    }
    
    lastEnd = nextStart;
    i = j;
  }
  
  return result;
}

/**
 * Distributes a specific segment of rewritten text to a group of unmatched runs.
 * Handles hyperlink extraction and proportional splitting for styling boundaries.
 * 
 * @param {Array<{originalText: string, isHyperlink: boolean}>} groupRuns 
 * @param {string} segmentText 
 * @returns {Array<string>} Texts for each run in the group.
 */
function distributeSegmentToUnmatched(groupRuns, segmentText) {
  const m = groupRuns.length;
  const result = new Array(m).fill("");
  
  if (m === 0) return result;
  if (segmentText.length === 0) return result;
  if (m === 1) {
    result[0] = segmentText;
    return result;
  }

  // Refinement Step 1: Match prefixes from left
  let start = 0;
  let end = segmentText.length;
  
  for (let k = 0; k < m; k++) {
    const orig = groupRuns[k].originalText;
    if (orig === "") continue;
    if (segmentText.startsWith(orig, start)) {
      result[k] = orig;
      start += orig.length;
    } else {
      break;
    }
  }

  // Refinement Step 2: Match suffixes from right
  for (let k = m - 1; k >= 0; k--) {
    if (result[k] !== "") continue;
    const orig = groupRuns[k].originalText;
    if (orig === "") continue;
    if (segmentText.endsWith(orig, end)) {
      result[k] = orig;
      end -= orig.length;
    } else {
      break;
    }
  }

  let remainingText = segmentText.substring(start, end);
  if (remainingText.length === 0) return result;

  // Identify remaining unassigned runs
  const unassignedIndices = [];
  for (let k = 0; k < m; k++) {
    if (result[k] === "") {
      unassignedIndices.push(k);
    }
  }

  if (unassignedIndices.length === 0) return result;
  if (unassignedIndices.length === 1) {
    result[unassignedIndices[0]] = remainingText;
    return result;
  }

  // Refinement Step 3: Handle hyperlinks in unassigned runs
  // Extract URLs/emails and align them with hyperlink runs
  const hyperlinkIndices = unassignedIndices.filter(idx => groupRuns[idx].isHyperlink);
  if (hyperlinkIndices.length > 0) {
    // Regex for URLs or emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/[^\s]*)/g;
    
    // Find all matches
    const matches = [];
    let match;
    
    // Search for emails
    while ((match = emailRegex.exec(remainingText)) !== null) {
      matches.push({ text: match[0], start: match.index, end: emailRegex.lastIndex });
    }
    // Search for URLs
    while ((match = urlRegex.exec(remainingText)) !== null) {
      matches.push({ text: match[0], start: match.index, end: urlRegex.lastIndex });
    }
    
    // Sort matches by start index
    matches.sort((a, b) => a.start - b.start);

    // Filter out overlapping matches
    const nonOverlappingMatches = [];
    let lastMatchEnd = 0;
    for (const m of matches) {
      if (m.start >= lastMatchEnd) {
        nonOverlappingMatches.push(m);
        lastMatchEnd = m.end;
      }
    }

    if (nonOverlappingMatches.length > 0 && hyperlinkIndices.length > 0) {
      // Map matches to hyperlink runs
      let matchIdx = 0;
      let textPos = 0;
      
      for (let hIdx = 0; hIdx < hyperlinkIndices.length; hIdx++) {
        if (matchIdx >= nonOverlappingMatches.length) break;
        
        const hRunIdx = hyperlinkIndices[hIdx];
        const currentMatch = nonOverlappingMatches[matchIdx];
        
        // Find if there are unassigned normal runs before this hyperlink run
        const precedingUnassigned = unassignedIndices.filter(idx => idx < hRunIdx && result[idx] === "");
        if (precedingUnassigned.length > 0) {
          const prefixText = remainingText.substring(textPos, currentMatch.start);
          const splitPrefix = splitTextProportionally(prefixText, precedingUnassigned.map(idx => groupRuns[idx].originalText.length || 1));
          for (let p = 0; p < precedingUnassigned.length; p++) {
            result[precedingUnassigned[p]] = splitPrefix[p];
          }
        }
        
        result[hRunIdx] = currentMatch.text;
        textPos = currentMatch.end;
        matchIdx++;
      }
      
      // Handle remaining text after the last mapped hyperlink match
      const remainingUnassigned = unassignedIndices.filter(idx => result[idx] === "");
      if (remainingUnassigned.length > 0) {
        const suffixText = remainingText.substring(textPos);
        const splitSuffix = splitTextProportionally(suffixText, remainingUnassigned.map(idx => groupRuns[idx].originalText.length || 1));
        for (let p = 0; p < remainingUnassigned.length; p++) {
          result[remainingUnassigned[p]] = splitSuffix[p];
        }
      }
      return result;
    }
  }

  // Refinement Step 4: Proportional distribution for any remaining unassigned runs
  const remainingUnassigned = unassignedIndices.filter(idx => result[idx] === "");
  if (remainingUnassigned.length > 0) {
    const proportions = remainingUnassigned.map(idx => groupRuns[idx].originalText.length || 1);
    const split = splitTextProportionally(remainingText, proportions);
    for (let p = 0; p < remainingUnassigned.length; p++) {
      result[remainingUnassigned[p]] = split[p];
    }
  }

  return result;
}

/**
 * Splits text proportionally based on target lengths, aligning to word boundaries.
 */
function splitTextProportionally(text, targetProportions) {
  const n = targetProportions.length;
  const result = new Array(n).fill("");
  if (text.length === 0) return result;
  
  const totalProp = targetProportions.reduce((a, b) => a + b, 0);
  if (totalProp === 0) {
    const charsPerRun = Math.ceil(text.length / n);
    for (let i = 0; i < n; i++) {
      result[i] = text.substr(i * charsPerRun, charsPerRun);
    }
    return result;
  }
  
  let currentPos = 0;
  for (let i = 0; i < n - 1; i++) {
    const prop = targetProportions[i] / totalProp;
    let targetLen = Math.round(text.length * prop);
    let splitPos = currentPos + targetLen;
    
    // Find closest word boundary (space) near splitPos to avoid splitting words
    let bestSplit = splitPos;
    let minDiff = Infinity;
    for (let offset = -5; offset <= 5; offset++) {
      const pos = splitPos + offset;
      if (pos > currentPos && pos < text.length) {
        if (text[pos] === ' ' || text[pos - 1] === ' ') {
          const diff = Math.abs(offset);
          if (diff < minDiff) {
            minDiff = diff;
            bestSplit = pos;
          }
        }
      }
    }
    splitPos = bestSplit;
    result[i] = text.substring(currentPos, splitPos);
    currentPos = splitPos;
  }
  result[n - 1] = text.substring(currentPos);
  return result;
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
