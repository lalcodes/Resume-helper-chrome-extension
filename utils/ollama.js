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

  // Exact prompt template matching our Gemini prompt
  const prompt = `You are a professional cover letter writer. Write a concise, compelling cover letter (3 paragraphs) for the following job. Tone: ${tone}. Always start with generic greetings (DO NOT INCLUDE COMPANY NAMES NOR PERSONS NAMES) and end the letter with regards(Include contact info and social handles if available). Only mention skills present in the candidate profile. Do not use generic filler phrases like 'I am a passionate...'.\n\nJOB DESCRIPTION:\n${jdText}\n\nCANDIDATE PROFILE:\n${resumeText}\n\nCover letter:`;

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
