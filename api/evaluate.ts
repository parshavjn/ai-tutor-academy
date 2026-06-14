import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";

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
      chatHistory: incomingChatHistory,
    } = req.body;

    if (!conceptName) {
      res.status(400).json({ error: "conceptName is required" });
      return;
    }

    if (!ai) {
      res.status(500).json({
        error: "Gemini API token is not configured.",
      });
      return;
    }

    // Modern structured Socratic dialogue chat transcript
    let chatHistory = incomingChatHistory;
    if (!chatHistory && conversationHistory) {
      chatHistory = (conversationHistory || [])
        .filter((m: any) => m.sender === "user" || m.sender === "tutor")
        .map((m: any) => ({
          role: m.sender === "user" ? "student" : "tutor",
          content: m.text,
        }));
    } else if (!chatHistory) {
      chatHistory = [];
    }

    // Standard requested input format payload
    const evaluationPayload = {
      conceptName: conceptName,
      quizPerformance: quizPerformance,
      chatHistory: chatHistory,
    };

    const prompt = JSON.stringify(evaluationPayload, null, 2);

    const systemInstruction = `You are an expert educational evaluator and learning scientist who scores Socratic dialogue sessions.

## YOUR ROLE
You receive a full chat transcript and quiz results. You evaluate the QUALITY of the student's thinking process — not just whether they arrived at the right answer, but HOW they reasoned, how they responded to prompts, and what they understood by the end.

## EVALUATION CRITERIA
Analyze the conversation and ask yourself:
1. Did the student engage genuinely and reason through the concept, or just guess?
2. How did they respond to Socratic nudges — did hints help them progress or did they stay stuck?
3. What key conceptual errors did they clear up during the session vs. retain?
4. Did they show any unprompted insight moments (reasoning beyond what they were asked)?
5. Was their final mental model of the concept correct, partially correct, or still confused?

## RATING TIERS
Choose exactly ONE:
- "Diamond Socratic Master" — Excellent engagement, demonstrated deep clarity, had 2+ unprompted insight moments, ended with a correct mental model
- "Gold Thinker" — Great effort and strong progress, found answers with a few hints, mostly correct mental model by the end
- "Silver Explorer" — Good attempt, relied on simple definitions or gave up on deeper reasoning, partial mental model retained
- "Needs Refinement" — Low engagement, skipped dialogue, misunderstood core concept even after hints

## XP CALCULATION
Map score to XP and badge:
- Score 0–40 → 10 XP, badge: "no badge" or null
- Score 41–70 → 25 XP, badge: "no badge" or null
- Score 71–90 → 40 XP, badge: "Concept Cleared"
- Score 91–100 → 60 XP, badge: "Mastery Unlocked 🏆"

## CONCEPT MASTERY STATUS
- Score >= 75 → "mastered" — ready for next concept
- Score 41–74 → "in_progress" — recommend revisiting in 2 days
- Score <= 40 → "needs_retry" — recommend immediate replay

## OUTPUT FORMAT
Return ONLY valid JSON. No markdown code fences. No prose outside the JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: [
            "concept",
            "rating",
            "score",
            "summary",
            "strengths",
            "growth_areas",
            "concept_clarity",
            "final_mental_model",
            "xp_earned",
            "badge",
            "mastery_status",
            "analytics",
          ],
          properties: {
            concept: { type: Type.STRING },
            rating: { type: Type.STRING },
            score: { type: Type.INTEGER },
            summary: { type: Type.STRING },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            growth_areas: { type: Type.ARRAY, items: { type: Type.STRING } },
            concept_clarity: { type: Type.STRING },
            final_mental_model: { type: Type.STRING },
            xp_earned: { type: Type.INTEGER },
            badge: { type: Type.STRING },
            mastery_status: { type: Type.STRING },
            analytics: {
              type: Type.OBJECT,
              required: [
                "event",
                "concept",
                "score",
                "rating",
                "hint_count",
                "insight_moments",
                "xp_earned",
                "mastery_status",
                "badge",
              ],
              properties: {
                event: { type: Type.STRING },
                concept: { type: Type.STRING },
                score: { type: Type.INTEGER },
                rating: { type: Type.STRING },
                hint_count: { type: Type.INTEGER },
                insight_moments: { type: Type.INTEGER },
                xp_earned: { type: Type.INTEGER },
                mastery_status: { type: Type.STRING },
                badge: { type: Type.STRING },
              },
            },
          },
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response from AI evaluation");
    }

    const parsedResult = JSON.parse(resultText);

    // Backward-compatibility field mappings for existing components
    parsedResult.verboseAnalysis =
      parsedResult.summary || "Evaluation completed successfully.";
    parsedResult.growthAreas = parsedResult.growth_areas || [];

    res.json(parsedResult);
  } catch (error: any) {
    console.error("Error evaluating interaction:", error);
    res.status(500).json({
      error:
        error?.message || "Failed to evaluate Socratic dialogue duration",
    });
  }
}
