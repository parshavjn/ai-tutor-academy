import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize Gemini Client
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

// Endpoint: Generate lesson and adaptive quiz based on an AI Concept
app.post("/api/generate-lesson-and-quiz", async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { conceptName, difficulty = "Beginner", previousMistakes = [] } = req.body;

    if (!conceptName) {
       res.status(400).json({ error: "conceptName is required" });
       return;
    }

    if (!ai) {
       res.status(500).json({
        error: "Gemini API key is not configured. Please add GEMINI_API_KEY to your Secrets panel.",
      });
      return;
    }

    const payloadInput = JSON.stringify({
      conceptName: conceptName,
      learnerLevel: difficulty.toLowerCase(),
      previousMistakes: previousMistakes
    }, null, 2);

    const prompt = `You are an expert tutor. Please generate the requested lesson plan for this input:
${payloadInput}`;

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
                  items: { type: Type.STRING }
                }
              }
            },
            quiz: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["id", "difficulty", "question", "options", "correct", "explanation", "hint"],
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
                      D: { type: Type.STRING }
                    }
                  },
                  correct: { type: Type.STRING },
                  explanation: {
                    type: Type.OBJECT,
                    required: ["correct_reason", "A_why", "B_why", "C_why", "D_why"],
                    properties: {
                      correct_reason: { type: Type.STRING },
                      A_why: { type: Type.STRING },
                      B_why: { type: Type.STRING },
                      C_why: { type: Type.STRING },
                      D_why: { type: Type.STRING }
                    }
                  },
                  hint: { type: Type.STRING }
                }
              }
            },
            analytics: {
              type: Type.OBJECT,
              required: ["event", "concept", "learnerLevel", "questionCount", "probed_weakness"],
              properties: {
                event: { type: Type.STRING },
                concept: { type: Type.STRING },
                learnerLevel: { type: Type.STRING },
                questionCount: { type: Type.INTEGER },
                probed_weakness: { type: Type.STRING, nullable: true }
              }
            }
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response from AI generation");
    }

    res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Error generating lesson and quiz:", error);
    res.status(500).json({ error: error?.message || "Failed to generate lesson and quiz" });
  }
});

// Endpoint: Socratic Chat turn
app.post("/api/socratic-chat", async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { conceptName, quizPerformance, conversationHistory, latestUserMessage } = req.body;

    if (!conceptName || !latestUserMessage) {
       res.status(400).json({ error: "conceptName and latestUserMessage are required" });
       return;
    }

    if (!ai) {
       res.status(500).json({
        error: "Gemini API key is not configured.",
      });
      return;
    }

    const sessionTurnCount = (conversationHistory || []).filter((msg: any) => msg.sender === "tutor").length + 1;

    // Build chat structure as a Socratic tutor
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
          // Re-append any posthog events in historical strings so the model sees past context as generated
          contents.push({ role: "model", parts: [{ text: msg.text }] });
        }
      });
    }

    const payloadInput = JSON.stringify({
      conceptName: conceptName,
      quizPerformance: quizPerformance,
      sessionTurnCount: sessionTurnCount
    }, null, 2);

    let finalUserText = latestUserMessage;
    if (latestUserMessage === "ACT_INITIALIZE_SESSION") {
      finalUserText = `Hi tutor, please open our Socratic discussion based on my quiz performance: ${payloadInput}`;
    }

    // Add current user input
    contents.push({ role: "user", parts: [{ text: finalUserText }] });

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Error in Socratic chat:", error);
    res.status(500).json({ error: error?.message || "Failed to perform Socratic dialogue" });
  }
});

// Endpoint: Evaluate session (Two-step Socratic Analysis)
app.post("/api/evaluate", async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { conceptName, quizPerformance, conversationHistory, chatHistory: incomingChatHistory } = req.body;

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
          content: m.text
        }));
    } else if (!chatHistory) {
      chatHistory = [];
    }

    // Standard requested input format payload
    const evaluationPayload = {
      conceptName: conceptName,
      quizPerformance: quizPerformance,
      chatHistory: chatHistory
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
      model: GEMINI_MODEL,
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
            "analytics"
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
                "badge"
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
                badge: { type: Type.STRING }
              }
            }
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response from AI evaluation");
    }

    const parsedResult = JSON.parse(resultText);

    // Backward-compatibility field mappings for existing components
    parsedResult.verboseAnalysis = parsedResult.summary || "Evaluation completed successfully.";
    parsedResult.growthAreas = parsedResult.growth_areas || [];

    res.json(parsedResult);
  } catch (error: any) {
    console.error("Error evaluating interaction:", error);
    res.status(500).json({ error: error?.message || "Failed to evaluate Socratic dialogue duration" });
  }
});

// Start dev or production configuration
const startServer = async () => {
  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

startServer().catch((err) => {
  console.error("Error starting server:", err);
});
