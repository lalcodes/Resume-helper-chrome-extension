/**
 * ATS Resume Optimizer streaming client wrapper.
 */

/**
 * Streams the ATS-optimized resume using Gemini API.
 * Never logs the API key or resume text to the console.
 * 
 * @param {Object} params - Parameter object.
 * @param {string} params.jdText - Job description text.
 * @param {string} params.resumeText - Candidate resume text.
 * @param {Array<string>} params.matchedSkills - High value skills found in both.
 * @param {string} params.apiKey - Gemini API key.
 * @yields {string} Text chunks of the rewritten resume.
 * @throws {Error} User-friendly error message on failure.
 */
export async function* rewriteForATS({ jdText, resumeText, matchedSkills, apiKey }) {
  if (!apiKey) {
    throw new Error("API key is missing. Please save your Gemini API key in Settings.");
  }
  if (!jdText) {
    throw new Error("Job description is empty. Please scrape or paste a job description.");
  }
  if (!resumeText) {
    throw new Error("Resume profile is empty. Please upload or paste your resume.");
  }

  const skillsList = Array.isArray(matchedSkills) ? matchedSkills.join(", ") : (matchedSkills || "None");

  const prompt = `You are an ATS resume optimizer. Rewrite the resume below to better match the job description.

STRICT RULES — violations will be flagged:
- NEVER invent skills, projects, or achievements not already in the resume
- NEVER change job titles, company names, employment dates, or education
- ALWAYS keep all work experiences in their original chronological order (latest job at the top), even if the latest job is not correlated with the job description (do not reorder the jobs/roles themselves, only the bullet points within them)
- DO reword bullet points to use exact keyword phrases from the JD naturally
- DO reorder bullets within each role so the most JD-relevant ones come first
- DO rewrite the professional summary to mirror the JD language
- DO use strong action verbs: led, built, delivered, optimized, scaled — not: helped, assisted, worked on
- Output the full rewritten resume as plain text preserving the original sections in order

SKILLS TO EMPHASIZE (already in resume, high value for this JD):
${skillsList}

JOB DESCRIPTION:
${jdText}

ORIGINAL RESUME:
${resumeText}

REWRITTEN RESUME:`;

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
    console.error("[ATS Rewriter] Fetch failed:", error.message);
    throw new Error("Network connection failure. Please check your internet connection and try again.");
  }

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
    try {
      const errorJson = await response.json();
      errorMsg = errorJson.error?.message || errorMsg;
      console.error("[ATS Rewriter] Error response payload:", errorJson);
    } catch (e) {
      console.error("[ATS Rewriter] Failed to parse error response. Status:", response.status);
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
                console.debug("[ATS Rewriter] Ignored parsing chunk segment error:", e);
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
    console.error("[ATS Rewriter] Stream reading failed:", readError.message);
    throw new Error("Stream read error. Connection interrupted during generation.");
  } finally {
    reader.releaseLock();
  }
}
