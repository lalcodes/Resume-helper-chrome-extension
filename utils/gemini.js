/**
 * Gemini API streaming client wrapper.
 */

/**
 * Calls the Gemini API with streaming output and yields text chunks as they arrive.
 * Never logs the API key or resume text to the console.
 * 
 * @param {Object} params - The parameter object.
 * @param {string} params.jdText - The job description text.
 * @param {string} params.resumeText - The candidate's resume/profile text.
 * @param {string} params.tone - The desired tone (e.g. "Formal", "Friendly", "Confident").
 * @param {string} params.apiKey - The Gemini API key.
 * @yields {string} Text chunks of the generated cover letter.
 * @throws {Error} User-friendly error message on failure.
 */
export async function* generateCoverLetter({ jdText, resumeText, tone, apiKey }) {
  if (!apiKey) {
    throw new Error("API key is missing. Please save your Gemini API key in Settings.");
  }
  if (!jdText) {
    throw new Error("Job description is empty. Please scrape or paste a job description.");
  }
  if (!resumeText) {
    throw new Error("Resume profile is empty. Please enter your resume/profile details.");
  }

  // Exact prompt template from rules
  const prompt = `You are a professional cover letter writer. Write a concise, compelling cover letter (3 paragraphs) for the following job. Tone: ${tone}. Always start with generic greetings (DO NOT INCLUDE COMPANY NAMES NOR PERSONS NAMES) and end the letter with regards(Include contact info and social handles if available). Only mention skills present in the candidate profile. Do not use generic filler phrases like 'I am a passionate...'.\n\nJOB DESCRIPTION:\n${jdText}\n\nCANDIDATE PROFILE:\n${resumeText}\n\nCover letter:`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:streamGenerateContent?key=${apiKey}`;
  const requestOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ]
    })
  };

  let response;
  try {
    response = await fetch(url, requestOptions);
  } catch (error) {
    // Network errors or blocked requests
    console.error("[Gemini] Fetch failed:", error.message);
    throw new Error("Network connection failure. Please check your internet connection and try again.");
  }

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
    try {
      const errorJson = await response.json();
      errorMsg = errorJson.error?.message || errorMsg;
      console.error("[Gemini Generate] Error response payload:", errorJson);
    } catch (e) {
      console.error("[Gemini Generate] Failed to parse error response as JSON. Status:", response.status);
    }

    if (response.status === 401) {
      throw new Error("Invalid API key. Please check your Gemini API key in Settings.");
    } else if (response.status === 429) {
      throw new Error("Gemini API rate limit exceeded. Please try again later.");
    } else {
      throw new Error(`Gemini API Error: ${errorMsg}`);
    }
  }

  if (!response.body) {
    throw new Error("Response body is not readable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Robustly extract JSON objects from the streaming array format
      let braceCount = 0;
      let startIdx = -1;
      let inString = false;
      let escape = false;

      for (let i = 0; i < buffer.length; i++) {
        const char = buffer[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (char === "\\") {
          escape = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (char === "{") {
            if (braceCount === 0) {
              startIdx = i;
            }
            braceCount++;
          } else if (char === "}") {
            braceCount--;
            if (braceCount === 0 && startIdx !== -1) {
              const jsonStr = buffer.slice(startIdx, i + 1);
              try {
                const obj = JSON.parse(jsonStr);
                const textChunk = obj.candidates?.[0]?.content?.parts?.[0]?.text;
                if (textChunk) {
                  yield textChunk;
                }
              } catch (e) {
                console.debug("[Gemini] Ignored parsing chunk segment error:", e);
              }
              // Truncate processed chunk
              buffer = buffer.slice(i + 1);
              i = -1; // restart search
              startIdx = -1;
              inString = false;
              escape = false;
            }
          }
        }
      }
    }
  } catch (readError) {
    console.error("[Gemini] Stream reading failed:", readError.message);
    throw new Error("Stream read error. Connection interrupted during generation.");
  } finally {
    reader.releaseLock();
  }
}
