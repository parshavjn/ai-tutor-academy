import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
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
    const { conceptName, difficulty = "Beginner", previousMistakes = [] } = req.body;

    if (!conceptName) {
      res.status(400).json({ error: "conceptName is required" });
      return;
    }

    if (!ai) {
      res.status(500).json({
        error: "Gemini API key is not configured. Please add GEMINI_API_KEY to your Vercel environment variables.",
      });
      return;
    }

    const payloadInput = JSON.stringify(
      {
        conceptName: conceptName,
        learnerLevel: difficulty.toLowerCase(),
        previousMistakes: previousMistakes,
      },
      null,
      2
    );

    const prompt = `You are an expert tutor. Please generate the requested lesson plan for this input:\n${payloadInput}`;

    const systemInstruction = `You are a world-class AI learning designer who creates short, highly engaging, easy-to-digest lesson plans on AI topics (Duolingo style).

## YOUR ROLE
You receive an AI concept name, a learner level, and optionally a list of previous mistakes. You return a complete structured lesson with 3 quiz questions — formatted as valid JSON only.

## LESSON RULES
- Keep the micro-lesson punchy: brief explanation (2–3 sentences max), one real-world analogy, and exactly 3 clear educational takeaways.
- Calibrate complexity to learner level:
  - beginner/Beginner → use everyday analogies, avoid jargon, define all terms
  - intermediate/Intermediate → use product/business analogies, introduce technical terms with brief context
  - advanced/Advanced → use precise technical framing, focus on tradeoffs and edge cases

## QUIZ RULES
- Generate exactly 3 questions, one per difficulty level:
  - Question 1 (recognition): Can the student name or define it?
  - Question 2 (comprehension): Can the student explain what it does or why it matters?
  - Question 3 (application): Can the student identify it in a real-world product scenario?
- Each question must have exactly 4 options (A, B, C, D).
- Each question must include:
  - A constructive explanation of WHY the correct answer is right
  - WHY each wrong option is misleading (be specific, not generic)
  - A short hint that guides reasoning without directly revealing the answer
- If previousMistakes is provided and non-empty, design Question 3 to specifically probe one of those weak areas.

## OUTPUT FORMAT
Return ONLY valid JSON matching the schema perfectly. No prose outside the JSON.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["concept", "learnerLevel", "lesson", "quiz", "analytics"],
          properties: {
            concept: { type: Type.STRING },
            learnerLevel: { type: Type.STRING },
            lesson: {
              type: Type.OBJECT,
              required: ["summary", "analogy", "takeaways"],
              properties: {
                summary: { type: Type.STRING },
                analogy: { type: Type.STRING },
                takeaways: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
            },
            quiz: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: [
                  "id",
                  "difficulty",
                  "question",
                  "options",
                  "correct",
                  "explanation",
                  "hint",
                ],
                properties: {
                  id: { type: Type.INTEGER },
                  difficulty: { type: Type.STRING },
                  question: { type: Type.STRING },
                  options: {
                    type: Type.OBJECT,
                    required: ["A", "B", "C", "D"],
                    properties: {
                      A: { type: Type.STRING },
                      B: { type: Type.STRING },
                      C: { type: Type.STRING },
                      D: { type: Type.STRING },
                    },
                  },
                  correct: { type: Type.STRING },
                  explanation: {
                    type: Type.OBJECT,
                    required: [
                      "correct_reason",
                      "A_why",
                      "B_why",
                      "C_why",
                      "D_why",
                    ],
                    properties: {
                      correct_reason: { type: Type.STRING },
                      A_why: { type: Type.STRING },
                      B_why: { type: Type.STRING },
                      C_why: { type: Type.STRING },
                      D_why: { type: Type.STRING },
                    },
                  },
                  hint: { type: Type.STRING },
                },
              },
            },
            analytics: {
              type: Type.OBJECT,
              required: [
                "event",
                "concept",
                "learnerLevel",
                "questionCount",
                "probed_weakness",
              ],
              properties: {
                event: { type: Type.STRING },
                concept: { type: Type.STRING },
                learnerLevel: { type: Type.STRING },
                questionCount: { type: Type.INTEGER },
                probed_weakness: { type: Type.STRING, nullable: true },
              },
            },
          },
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response from AI generation");
    }

    res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Error generating lesson and quiz:", error);
    res
      .status(500)
      .json({ error: error?.message || "Failed to generate lesson and quiz" });
  }
}
