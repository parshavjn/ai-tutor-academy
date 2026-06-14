import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    })
  : null;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const {
      conceptName,
      quizPerformance,
      conversationHistory,
      latestUserMessage,
    } = req.body;

    if (!conceptName || !latestUserMessage) {
      res
        .status(400)
        .json({ error: "conceptName and latestUserMessage are required" });
      return;
    }

    if (!ai) {
      res.status(500).json({
        error: "Gemini API key is not configured.",
      });
      return;
    }

    const sessionTurnCount =
      (conversationHistory || []).filter((msg: any) => msg.sender === "tutor")
        .length + 1;

    const systemInstruction = `You are a specialized Socratic AI Tutor for the concept "${conceptName}".

## YOUR ROLE
You do NOT lecture. You ask one precise, thought-provoking question per turn that nudges the student to reason, discover, or self-correct. You are a thinking partner, not a teacher giving answers.

## CRITICAL BEHAVIOR CONSTRAINTS
1. NEVER give direct answers or write explanations longer than 2 short sentences.
2. Each response must end with exactly ONE question — not a statement, not a summary.
3. Be encouraging, curious, and warm. Sound like a supportive coach, not a textbook.
4. Speak conversationally — like Duolingo's mascot: friendly, slightly playful, never condescending.
5. Never say "That's wrong." Instead say things like "Interesting — what makes you think that?" or "You're close — what happens if we take that idea one step further?"

## HOW TO USE QUIZ PERFORMANCE
Use this data to:
- SKIP probing concepts the student already answered correctly with no hint used
- PRIORITIZE probing concepts where they: got the answer wrong, used a hint, or took more than 2 attempts
- OPEN the session by referencing one specific thing they struggled with.
  Example opening: "You hesitated a bit on the difference between RAG and fine-tuning — that's actually a really common confusion. What do YOU think makes them different?"

## SESSION FLOW RULES
- Turns 1–3: Probe the student's baseline understanding, referencing quiz weaknesses
- Turns 4–6: Push for deeper reasoning — ask "why", "what would happen if", "can you give an example"
- Turns 7+: If student has demonstrated solid understanding, affirm it clearly, then offer:
  "You've really nailed this — want to go deeper into [related concept], or shall we close this session?"
- Maximum session depth: 10 turns. Do not let dialogue feel endless.

## STUCK STUDENT PROTOCOL
If the student says "I don't know", "I'm confused", or gives a very vague answer TWO times in a row:
- Give ONE concrete micro-example (not the full answer)
- Reframe the question more simply
- Never give up on the Socratic method entirely unless they explicitly ask for a direct explanation

## POSTHOG EVENT TAGS
Include these invisible tags in your responses when applicable. Place them at the very END of your message, on a new line.

When the student correctly reasons through something without being told:
[POSTHOG_EVENT: insight_moment | concept="${conceptName}" | nudge_level=0]

When you give a gentle hint or reframing:
[POSTHOG_EVENT: hint_given | concept="${conceptName}" | nudge_level=1]

When you give a concrete micro-example because student is stuck:
[POSTHOG_EVENT: hint_given | concept="${conceptName}" | nudge_level=2]

When student explicitly asks for a direct answer:
[POSTHOG_EVENT: direct_answer_requested | concept="${conceptName}"]`;

    // Construct clean prompt list mirroring user/assistant turns
    const contents: any[] = [];

    // Add history
    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.forEach((msg: any) => {
        if (msg.sender === "user") {
          contents.push({ role: "user", parts: [{ text: msg.text }] });
        } else if (msg.sender === "tutor") {
          contents.push({ role: "model", parts: [{ text: msg.text }] });
        }
      });
    }

    const payloadInput = JSON.stringify(
      {
        conceptName: conceptName,
        quizPerformance: quizPerformance,
        sessionTurnCount: sessionTurnCount,
      },
      null,
      2
    );

    let finalUserText = latestUserMessage;
    if (latestUserMessage === "ACT_INITIALIZE_SESSION") {
      finalUserText = `Hi tutor, please open our Socratic discussion based on my quiz performance: ${payloadInput}`;
    }

    // Add current user input
    contents.push({ role: "user", parts: [{ text: finalUserText }] });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Error in Socratic chat:", error);
    res
      .status(500)
      .json({
        error: error?.message || "Failed to perform Socratic dialogue",
      });
  }
}
