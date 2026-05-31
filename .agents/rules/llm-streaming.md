---
trigger: always_on
---

Implement utils/gemini.js — the module that calls Gemini API with streaming output.

The module should export one async generator function: generateCoverLetter({ jdText, resumeText, tone, apiKey })

It must:
1. Build a prompt using this template exactly:
   "You are a professional cover letter writer. Write a concise, compelling cover letter (3 paragraphs) for the following job. Tone: [tone]. Only mention skills present in the candidate profile. Do not use generic filler phrases like 'I am a passionate...'.\n\nJOB DESCRIPTION:\n[jdText]\n\nCANDIDATE PROFILE:\n[resumeText]\n\nCover letter:"
2. Call https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent with the prompt
3. Use ReadableStream to yield text chunks as they arrive
4. Handle errors: invalid API key (401), quota exceeded (429), network failure — surface clear messages to the UI for each case
5. Never log the API key or resume text to the console

Then update sidepanel/sidepanel.js to import and call this generator, updating the output textarea word-by-word as chunks arrive.