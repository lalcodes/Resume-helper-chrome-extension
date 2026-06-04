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
