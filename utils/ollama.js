/**
 * Ollama API streaming client wrapper.
 */

/**
 * Calls the local Ollama API with streaming output and yields text chunks as they arrive.
 * 
 * @param {Object} params - The parameter object.
 * @param {string} params.jdText - The job description text.
 * @param {string} params.resumeText - The candidate's resume/profile text.
 * @param {string} params.tone - The desired tone (e.g. "Formal", "Friendly", "Confident").
 * @param {string} params.modelName - The Ollama model name (e.g. "gemma").
 * @param {string} params.ollamaUrl - The local Ollama server URL (e.g. "http://localhost:11434").
 * @yields {string} Text chunks of the generated cover letter.
 * @throws {Error} User-friendly error message on failure.
 */
export async function* generateOllamaCoverLetter({ jdText, resumeText, tone, modelName, ollamaUrl }) {
  if (!ollamaUrl) {
    throw new Error("Ollama URL is missing. Please save it in settings.");
  }
  if (!modelName) {
    throw new Error("Ollama model name is missing. Please save it in settings.");
  }

  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  // Exact prompt template from rules
  const prompt = `You are a professional cover letter writer. Write a concise, compelling cover letter in exactly 3 paragraphs.

TONE: ${tone}

---

FORMATTING RULES

Header 
1. Candidate name — all caps, on its own line at the top
2. Contact details: include email, phone, and any social/portfolio handles present in the candidate profile
--
Leave some space 
--
3. Date (${date})
4. Hiring manager block — only if the name and/or title appear in the job description:
   [Hiring Manager Name and Title]
   [Company Name]
   [Company Address or City]
   If this information is not in the job description, omit the block entirely.

Target role block (below the header, left-aligned):
[Job Title applied for]
[Company Name]
[Company City or Address]

---

WRITING RULES

- Open with a professional salutation. If the hiring manager's name is available, address them directly (e.g. "Dear Ms. Sharma,"). If not, use "Dear Hiring Team,"
- End the letter with a formal closing and regards (e.g. "Sincerely," or "Best regards,") with name
- Only mention skills, tools, and experiences that are explicitly present in the candidate profile — do not invent or assume any
- Do not use generic filler phrases. Examples to avoid:
  "I am a passionate…"
  "I am deeply committed to…"
  "With a proven track record of…"
  "I am excited about the opportunity to…"
  "I would be a great fit for…"

---

INPUTS

<job_description>
${jdText}
</job_description>

<candidate_profile>
${resumeText}
</candidate_profile>

---

Cover letter:`

  const url = `${ollamaUrl.replace(/\/$/, "")}/api/generate`;
  const requestOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelName,
      prompt: prompt,
      stream: true
    })
  };

  let response;
  try {
    response = await fetch(url, requestOptions);
  } catch (error) {
    console.error("[Ollama] Fetch failed:", error.message);
    throw new Error(`Connection failed. Make sure Ollama is running on your PC at ${ollamaUrl}`);
  }

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
    try {
      const errorJson = await response.json();
      errorMsg = errorJson.error || errorMsg;
    } catch (e) {
      // Ignore if body is not JSON
    }
    throw new Error(`Ollama Error: ${errorMsg}`);
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

      const lines = buffer.split("\n");
      // Keep last incomplete segment in buffer
      buffer = lines.pop();

      for (const line of lines) {
        if (line.trim() === "") continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            yield parsed.response;
          }
        } catch (e) {
          console.debug("[Ollama] Ignored parsing chunk line error:", e);
        }
      }
    }

    // Process remainder
    if (buffer.trim() !== "") {
      try {
        const parsed = JSON.parse(buffer);
        if (parsed.response) {
          yield parsed.response;
        }
      } catch (e) {
        // Ignore
      }
    }
  } catch (readError) {
    console.error("[Ollama] Stream reading failed:", readError.message);
    throw new Error("Ollama connection interrupted during stream generation.");
  } finally {
    reader.releaseLock();
  }
}

/**
 * Scores the match between a job description and resume using Ollama.
 * 
 * @param {Object} params - Parameter object.
 * @param {string} params.jdText - The job description text.
 * @param {string} params.resumeText - The candidate's resume/profile text.
 * @param {string} params.modelName - The Ollama model name.
 * @param {string} params.ollamaUrl - The local Ollama URL.
 * @returns {Promise<Object>} The match report containing score, skills, and recommendation.
 */
export async function scoreMatchOllama({ jdText, resumeText, modelName, ollamaUrl }) {
  const fallback = {
    score: 0,
    matchedSkills: [],
    missingSkills: [],
    seniorityMatch: "unknown",
    recommendation: "skip",
    reason: "Could not analyze — please try again."
  };

  if (!ollamaUrl || !modelName || !jdText || !resumeText) {
    return fallback;
  }

  const prompt = `Analyze the match between this job description and resume. Return ONLY valid JSON, matching this schema exactly:
{
  "score": 0-100,
  "matchedSkills": ["skill1", "skill2"],
  "missingSkills": ["skill3", "skill4"],
  "seniorityMatch": "good" | "overqualified" | "underqualified",
  "recommendation": "proceed" | "partial" | "skip",
  "reason": "one sentence explanation string"
}

JOB DESCRIPTION:
${jdText}

RESUME:
${resumeText}`;

  const url = `${ollamaUrl.replace(/\/$/, "")}/api/generate`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        prompt: prompt,
        stream: false,
        format: "json",
        options: {
          temperature: 0.1
        }
      })
    });

    if (!response.ok) {
      console.error("[Ollama Matcher] API request failed with status:", response.status);
      return fallback;
    }

    const data = await response.json();
    let text = data.response || "";
    // Strip markdown formatting if any
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(text);

    return {
      score: typeof parsed.score === "number" ? parsed.score : 0,
      matchedSkills: Array.isArray(parsed.matchedSkills) ? parsed.matchedSkills : [],
      missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills : [],
      seniorityMatch: typeof parsed.seniorityMatch === "string" ? parsed.seniorityMatch : "unknown",
      recommendation: typeof parsed.recommendation === "string" ? parsed.recommendation : "skip",
      reason: typeof parsed.reason === "string" ? parsed.reason : ""
    };
  } catch (error) {
    console.error("[Ollama Matcher] Error matching resume/JD:", error);
    return fallback;
  }
}

/**
 * Streams the ATS-optimized resume using Ollama API.
 * 
 * @param {Object} params - Parameter object.
 * @param {string} params.jdText - Job description text.
 * @param {string} params.resumeText - Candidate resume text.
 * @param {Array<string>} params.matchedSkills - High value skills found in both.
 * @param {string} params.modelName - Ollama model name.
 * @param {string} params.ollamaUrl - Ollama URL.
 * @yields {string} Text chunks of the rewritten resume.
 * @throws {Error} User-friendly error message on failure.
 */
export async function* rewriteForATSOllama({ jdText, resumeText, matchedSkills, modelName, ollamaUrl }) {
  if (!ollamaUrl) {
    throw new Error("Ollama URL is missing. Please save it in settings.");
  }
  if (!modelName) {
    throw new Error("Ollama model name is missing. Please save it in settings.");
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

  const url = `${ollamaUrl.replace(/\/$/, "")}/api/generate`;
  const requestOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelName,
      prompt: prompt,
      stream: true
    })
  };

  let response;
  try {
    response = await fetch(url, requestOptions);
  } catch (error) {
    console.error("[Ollama ATS] Fetch failed:", error.message);
    throw new Error(`Connection failed. Make sure Ollama is running on your PC at ${ollamaUrl}`);
  }

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
    try {
      const errorJson = await response.json();
      errorMsg = errorJson.error || errorMsg;
    } catch (e) {
      // Ignore
    }
    throw new Error(`Ollama Error: ${errorMsg}`);
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

      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (line.trim() === "") continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            yield parsed.response;
          }
        } catch (e) {
          console.debug("[Ollama ATS] Ignored parsing chunk line error:", e);
        }
      }
    }

    if (buffer.trim() !== "") {
      try {
        const parsed = JSON.parse(buffer);
        if (parsed.response) {
          yield parsed.response;
        }
      } catch (e) {
        // Ignore
      }
    }
  } catch (readError) {
    console.error("[Ollama ATS] Stream reading failed:", readError.message);
    throw new Error("Ollama connection interrupted during stream generation.");
  } finally {
    reader.releaseLock();
  }
}

