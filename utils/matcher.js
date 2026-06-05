/**
 * Matcher utility to analyze and score the match between a resume and a job description.
 */

/**
 * Scores the match between a job description and resume using Gemini.
 * Never logs the API key or resume text to the console.
 * 
 * @param {Object} params - Parameter object.
 * @param {string} params.jdText - The job description text.
 * @param {string} params.resumeText - The candidate's resume/profile text.
 * @param {string} params.apiKey - The Gemini API key.
 * @returns {Promise<Object>} The match report containing score, skills, and recommendation.
 */
export async function scoreMatch({ jdText, resumeText, apiKey }) {
  const fallback = {
    score: 0,
    matchedSkills: [],
    missingSkills: [],
    seniorityMatch: "unknown",
    recommendation: "skip",
    reason: "Could not analyze — please try again."
  };

  if (!apiKey || !jdText || !resumeText) {
    return fallback;
  }

  const prompt = `Analyze the match between this job description and resume. Return ONLY valid JSON, no markdown, no explanation:
{
  "score": <integer 0-100>,
  "matchedSkills": [<skills found in both>],
  "missingSkills": [<key skills in JD not in resume>],
  "seniorityMatch": <"good" | "overqualified" | "underqualified">,
  "recommendation": <"proceed" if score>=65, "partial" if 40-64, "skip" if <40>,
  "reason": <one sentence explanation>
}

JOB DESCRIPTION:
${jdText}

RESUME:
${resumeText}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
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
    });

    if (!response.ok) {
      console.error("[Matcher] API request failed with status:", response.status);
      return fallback;
    }

    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // Strip any markdown fences
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
    console.error("[Matcher] Error matching resume/JD:", error);
    return fallback;
  }
}
