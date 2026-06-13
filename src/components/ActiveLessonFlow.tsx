import React, { useState, useEffect, useRef } from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Quiz, QuizQuestion, SocraticMessage, EvaluationResult } from "../types";
import { posthogTracker } from "../lib/posthog";
import { Sparkles, ArrowRight, CheckCircle2, AlertCircle, Send, Award, Compass, RefreshCw, BarChart2, Star, Zap } from "lucide-react";

function parseAndStripPosthogEvents(rawAIResponse: string, onEventFound: (name: string, props: any) => void): string {
  const eventRegex = /\[POSTHOG_EVENT:\s*([^\]]+)\]/g;
  let match;
  let cleanResponse = rawAIResponse;

  while ((match = eventRegex.exec(rawAIResponse)) !== null) {
    const parts = match[1].split("|").map((s) => s.trim());
    const eventName = parts[0];
    const props: Record<string, string> = {};
    parts.slice(1).forEach((p) => {
      const idx = p.indexOf("=");
      if (idx !== -1) {
        const k = p.substring(0, idx).trim();
        const v = p.substring(idx + 1).trim();
        props[k] = v.replace(/"/g, "").trim();
      }
    });
    onEventFound(eventName, props);
    cleanResponse = cleanResponse.replace(match[0], "");
  }

  return cleanResponse.trim();
}

interface ActiveLessonFlowProps {
  conceptName: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  userId: string;
  previousMistakes?: string[];
  onFinishLesson: (xpEarned: number, updatedCompletedConcepts: boolean) => void;
  onQuit: () => void;
  posthogLogsTrigger: () => void;
}

type Stage = "lesson" | "quiz" | "socraticCode" | "evaluation";

export function ActiveLessonFlow({
  conceptName,
  difficulty,
  userId,
  previousMistakes = [],
  onFinishLesson,
  onQuit,
  posthogLogsTrigger,
}: ActiveLessonFlowProps) {
  // Lesson Data state
  const [isLoading, setIsLoading] = useState(true);
  const [errorHeader, setErrorHeader] = useState<string | null>(null);
  
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonMarkdown, setLessonMarkdown] = useState("");
  const [lessonSummary, setLessonSummary] = useState("");
  const [lessonAnalogy, setLessonAnalogy] = useState("");
  const [takeaways, setTakeaways] = useState<string[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);

  // Stage indicator
  const [stage, setStage] = useState<Stage>("lesson");

  // Quiz progress state
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [quizAttempts, setQuizAttempts] = useState<any[]>([]); // To track detailed choices
  const [quizPerformanceTable, setQuizPerformanceTable] = useState<Record<string, { correct: boolean; hint_used: boolean; attempts: number }>>({});
  const [hearts, setHearts] = useState(3);
  const [failedDueToNoHearts, setFailedDueToNoHearts] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Socratic conversation state
  const [chatMessages, setChatMessages] = useState<SocraticMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isTutorThinking, setIsTutorThinking] = useState(false);
  const [tutorTurns, setTutorTurns] = useState(0);

  // Evaluation response state
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Initialize Lesson on Mount
  useEffect(() => {
    generateConceptMaterials();
    posthogTracker.trackLessonStart(conceptName.toLowerCase().replace(/\s+/g, "-"), conceptName, difficulty);
    posthogLogsTrigger();
  }, [conceptName]);

  // Handle auto-scroll on new chat bubbles
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isTutorThinking]);

  const generateConceptMaterials = async () => {
    setIsLoading(true);
    setErrorHeader(null);

    // Combine prop-passed mistakes with auto-logged historical mistakes in local storage
    let mergedMistakes: string[] = [...previousMistakes];
    try {
      const key = `ai_tutor_mistakes_${userId}_${conceptName.toLowerCase().replace(/\s+/g, "-")}`;
      const storedMistakesStr = localStorage.getItem(key);
      if (storedMistakesStr) {
        const storedList = JSON.parse(storedMistakesStr);
        if (Array.isArray(storedList)) {
          storedList.forEach((m: string) => {
            if (!mergedMistakes.includes(m)) {
              mergedMistakes.push(m);
            }
          });
        }
      }
    } catch (e) {
      console.error("Failed to read progress for previous mistakes:", e);
    }

    try {
      const res = await fetch("/api/generate-lesson-and-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conceptName, difficulty, previousMistakes: mergedMistakes }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to contact generator backend.");
      }

      const data = await res.json();
      setLessonTitle(data.concept || data.title || conceptName);
      
      if (data.lesson && typeof data.lesson === "object") {
        setLessonSummary(data.lesson.summary || "");
        setLessonAnalogy(data.lesson.analogy || "");
        setTakeaways(data.lesson.takeaways || []);
      } else {
        setLessonMarkdown(data.lessonMarkdown || "");
        setTakeaways(data.takeaways || []);
      }

      // Map structured quiz objects
      const rawQuiz = data.quiz || [];
      const mappedQuestions = rawQuiz.map((q: any) => {
        let opts: string[] = [];
        if (q.options && typeof q.options === "object" && !Array.isArray(q.options)) {
          opts = [q.options.A || "", q.options.B || "", q.options.C || "", q.options.D || ""];
        } else if (Array.isArray(q.options)) {
          opts = q.options;
        }

        let correctIdx = 0;
        if (typeof q.correct === "string") {
          const charCode = q.correct.toUpperCase().charCodeAt(0);
          if (charCode >= 65 && charCode <= 68) {
            correctIdx = charCode - 65; // A -> 0, B -> 1, C -> 2, D -> 3
          }
        } else if (typeof q.correctAnswerIndex === "number") {
          correctIdx = q.correctAnswerIndex;
        }

        let explText = "";
        if (q.explanation && typeof q.explanation === "object") {
          explText = q.explanation.correct_reason || "";
        } else if (typeof q.explanation === "string") {
          explText = q.explanation;
        }

        return {
          id: q.id,
          question: q.question,
          options: opts,
          correctAnswerIndex: correctIdx,
          explanation: explText,
          hint: q.hint,
          rawExplanationObj: q.explanation // preserve fine-grained options keys
        };
      });

      setQuizQuestions(mappedQuestions);
      
      const initialTable: Record<string, { correct: boolean; hint_used: boolean; attempts: number }> = {};
      mappedQuestions.forEach((q: any, idx: number) => {
        initialTable[`q${idx + 1}`] = { correct: false, hint_used: false, attempts: 0 };
      });
      setQuizPerformanceTable(initialTable);

      // Fire lesson_generated event from data.analytics block (fireFromLessonJSON)
      if (data.analytics && data.analytics.event) {
        posthogTracker.trackEvent(data.analytics.event, data.analytics);
      }
    } catch (err: any) {
      console.error(err);
      setErrorHeader(err.message || "An unexpected network block occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  // Stage 1: Lesson reading concluded
  const handleStartQuiz = () => {
    setStage("quiz");
    posthogTracker.trackEvent("proceeded_to_quiz", { concept_name: conceptName });
    posthogTracker.trackEvent("quiz_started", { concept: conceptName, learnerLevel: difficulty });
    posthogLogsTrigger();
  };

  // Stage 2: Adaptive Quiz Answer selected
  const handleSelectOption = (index: number) => {
    if (isAnswerRevealed) return;
    setSelectedOption(index);
  };

  const handleRevealAnswer = () => {
    if (selectedOption === null) return;
    
    const currentQuestion = quizQuestions[currentQuizIndex];
    const isCorrect = selectedOption === currentQuestion.correctAnswerIndex;
    
    if (isCorrect) {
      setCorrectAnswersCount((prev) => prev + 1);
    } else {
      // Lose a heart for mistakes (motivation layer & repeat weak areas flow)
      setHearts((prev) => {
        const nextHearts = prev - 1;
        if (nextHearts <= 0) {
          setFailedDueToNoHearts(true);
        }
        return nextHearts;
      });

      // Save mistake context to persistent local storage for adaptive retraining
      try {
        const key = `ai_tutor_mistakes_${userId}_${conceptName.toLowerCase().replace(/\s+/g, "-")}`;
        const existingStr = localStorage.getItem(key);
        const existingList = existingStr ? JSON.parse(existingStr) : [];
        const labelText = `Previously confused "${currentQuestion.options[selectedOption]}" with "${currentQuestion.options[currentQuestion.correctAnswerIndex]}"`;
        if (Array.isArray(existingList) && !existingList.includes(labelText)) {
          existingList.push(labelText);
          if (existingList.length > 5) existingList.shift(); // keep last 5 mistakes
          localStorage.setItem(key, JSON.stringify(existingList));
        }
      } catch (e) {
        console.error("Failed to store quiz mistake:", e);
      }
    }

    // Save attempts for telemetry and future Socratic context logic
    setQuizAttempts((prev) => [
      ...prev,
      {
        question: currentQuestion.question,
        chosen: currentQuestion.options[selectedOption],
        correct: currentQuestion.options[currentQuestion.correctAnswerIndex],
        isCorrect,
      },
    ]);

    const questionKey = `q${currentQuizIndex + 1}`;
    const prevAttempts = quizPerformanceTable[questionKey]?.attempts || 0;
    const attemptCount = prevAttempts + 1;

    setQuizPerformanceTable((prev) => {
      const currentEntry = prev[questionKey] || { correct: false, hint_used: showHint, attempts: 0 };
      return {
        ...prev,
        [questionKey]: {
          correct: isCorrect,
          hint_used: currentEntry.hint_used || showHint,
          attempts: currentEntry.attempts + 1,
        }
      };
    });

    setIsAnswerRevealed(true);

    // Track answering progress
    posthogTracker.trackQuizQuestionAnswered(
      conceptName.toLowerCase().replace(/\s+/g, "-"),
      conceptName,
      currentQuizIndex,
      isCorrect,
      currentQuestion.options[selectedOption]
    );

    posthogTracker.trackEvent("question_answered", {
      concept: conceptName,
      questionId: currentQuestion.id || questionKey,
      correct: isCorrect,
      hintUsed: showHint || (quizPerformanceTable[questionKey]?.hint_used || false),
      attemptCount: attemptCount
    });
    posthogLogsTrigger();
  };

  const handleNextQuiz = () => {
    setShowHint(false); // Reset hint toggle for next question
    if (currentQuizIndex < quizQuestions.length - 1) {
      setCurrentQuizIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswerRevealed(false);
    } else {
      // Quiz completed completely!
      const totalScorePercent = Math.round((correctAnswersCount / quizQuestions.length) * 100);
      posthogTracker.trackQuizCompleted(
        conceptName.toLowerCase().replace(/\s+/g, "-"),
        conceptName,
        correctAnswersCount,
        quizQuestions.length,
        totalScorePercent
      );
      posthogLogsTrigger();
      
      // Seed first introductory Socratic prompt
      initializeSocraticChat();
      setStage("socraticCode");
      posthogTracker.trackEvent("dialogue_started", { concept: conceptName });
    }
  };

  const handleRepeatWeakArea = () => {
    // Analytics tracking for repetition behavior
    posthogTracker.trackEvent("weak_area_repeated", {
      concept_id: conceptName.toLowerCase().replace(/\s+/g, "-"),
      concept_name: conceptName,
    });
    posthogLogsTrigger();

    // Reset quiz progress metrics completely and loop back to lesson module to study
    setHearts(3);
    setFailedDueToNoHearts(false);
    setCurrentQuizIndex(0);
    setSelectedOption(null);
    setIsAnswerRevealed(false);
    setCorrectAnswersCount(0);
    setQuizAttempts([]);
    setQuizPerformanceTable({});
    setShowHint(false);
    setStage("lesson");
  };

  // Stage 3: Initiate chat
  const initializeSocraticChat = async () => {
    setIsTutorThinking(true);
    setChatMessages([]);
    
    try {
      const res = await fetch("/api/socratic-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptName,
          quizPerformance: quizPerformanceTable,
          conversationHistory: [],
          latestUserMessage: "ACT_INITIALIZE_SESSION",
        }),
      });

      if (!res.ok) {
        throw new Error("Tutor initial alignment failed.");
      }

      const data = await res.json();
      
      const rawText = data.text || "Hello! Let's explore this concept together.";
      const cleaned = parseAndStripPosthogEvents(rawText, (name, props) => {
        posthogTracker.trackEvent(name, props);
      });

      setChatMessages([
        {
          id: "init",
          sender: "tutor",
          text: cleaned,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (err: any) {
      console.error(err);
      setChatMessages([
        {
          id: "init_err",
          sender: "system",
          text: "⚠️ Core alignment service temporarily offline. I am your fallback Socratic tutor. Owl says: what is your understanding of " + conceptName + "?",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setIsTutorThinking(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isTutorThinking) return;

    const userText = userInput.trim();
    setUserInput("");

    // Add user bubble
    const userMsg: SocraticMessage = {
      id: "usr_" + Date.now(),
      sender: "user",
      text: userText,
      timestamp: new Date().toLocaleTimeString(),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setIsTutorThinking(true);

    try {
      const res = await fetch("/api/socratic-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptName,
          quizPerformance: quizPerformanceTable,
          conversationHistory: chatMessages.concat(userMsg),
          latestUserMessage: userText,
        }),
      });

      if (!res.ok) {
        throw new Error("Chat service was temporarily unreachable.");
      }

      const data = await res.json();
      
      // Increment turns
      setTutorTurns((prev) => prev + 1);

      const rawText = data.text || "That's an interesting perspective. Tell me more context.";
      const cleanedText = parseAndStripPosthogEvents(rawText, (name, props) => {
        posthogTracker.trackEvent(name, props);
      });

      // Add tutor bubble
      setChatMessages((prev) => [
        ...prev,
        {
          id: "tut_" + Date.now(),
          sender: "tutor",
          text: cleanedText,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);

      // Track Socratic Message Turn in Posthog
      posthogTracker.trackSocraticChatTurn(
        conceptName.toLowerCase().replace(/\s+/g, "-"),
        conceptName,
        userText.length,
        tutorTurns + 1
      );
      posthogLogsTrigger();
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: "err_" + Date.now(),
          sender: "system",
          text: "⚠️ Core chat offline. " + (err.message || "Failed to reach tutor, please try again."),
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setIsTutorThinking(false);
    }
  };

  // Stage 4: Trigger Two-Step Socratic Evaluation
  const handleTriggerEvaluation = async () => {
    setIsEvaluating(true);
    setStage("evaluation");
    posthogTracker.trackEvent("dialogue_ended", { concept: conceptName, turnCount: tutorTurns });

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptName,
          quizPerformance: {
            correctAnswersCount,
            totalQuizLength: quizQuestions.length,
          },
          conversationHistory: chatMessages,
        }),
      });

      if (!res.ok) {
        throw new Error("Evaluation engine failed. Please try summarizing again.");
      }

      const data: EvaluationResult = await res.json();
      setEvaluation(data);

      // Track graduation event in Posthog
      posthogTracker.trackGraduation(
        conceptName.toLowerCase().replace(/\s+/g, "-"),
        conceptName,
        data.score,
        data.rating
      );

      // Fire session_evaluated event (from Prompt 3 analytics block)
      if (data.analytics && data.analytics.event) {
        posthogTracker.trackEvent(data.analytics.event, data.analytics);
      }
      posthogLogsTrigger();
    } catch (err: any) {
      console.error(err);
      setEvaluation({
        verboseAnalysis: "We experienced a slight interruption rating your session. You demonstrated fantastic critical reasoning by debating directly with the AI mascot!",
        rating: "Gold Thinker",
        score: 85,
        strengths: ["Highly engaged and eager to participate", "Maintained dialog with Socratic tutor"],
        growthAreas: ["Revise the core vocabulary", "Continue practicing technical concepts"]
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  // Finish completely
  const handleSaveAndExit = async () => {
    if (!evaluation) return;

    // Calculate XP earned: prefer evaluation.xp_earned if available
    const xpEarned = evaluation.xp_earned !== undefined && evaluation.xp_earned !== null
      ? evaluation.xp_earned
      : 20 + (correctAnswersCount * 10) + Math.min(40, Math.floor(evaluation.score / 2));

    try {
      const { progressService } = await import("../lib/supabase");
      // Log session in history logs table (saves to Supabase if config is live, or localStorage)
      await progressService.saveSessionLog(
        userId,
        conceptName,
        correctAnswersCount,
        evaluation.rating,
        evaluation.verboseAnalysis
      );
    } catch (err) {
      console.warn("Storage warning logging session", err);
    }

    onFinishLesson(xpEarned, true);
  };

  // Loading indicator Card
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-12 text-center shadow-sm space-y-6 animate-pulse">
        <div className="h-14 w-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center text-3xl mx-auto">
          🦉
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">AI Tutor is composing the deck...</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
            Structuring custom lesson plans, summarizing core analogies, and formatting progressive multiple-choice tests.
          </p>
        </div>
        <div className="flex justify-center gap-1.5">
          <span className="h-2.5 w-2.5 bg-indigo-600 rounded-full animate-bounce delay-75" />
          <span className="h-2.5 w-2.5 bg-indigo-600 rounded-full animate-bounce delay-150" />
          <span className="h-2.5 w-2.5 bg-indigo-600 rounded-full animate-bounce delay-300" />
        </div>
      </div>
    );
  }

  // Error Card
  if (errorHeader) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-10 text-center shadow-lg space-y-5">
        <AlertCircle className="h-12 w-12 text-rose-500 mx-auto animate-bounce" />
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Generation Handshake Interrupted</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {errorHeader}
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onQuit}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl"
          >
            Go Back
          </button>
          <button
            onClick={generateConceptMaterials}
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reconnect
          </button>
        </div>
      </div>
    );
  }

  if (failedDueToNoHearts) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-10 max-w-lg mx-auto text-center space-y-6 animate-fade-in shadow-lg">
        <div className="h-16 w-16 bg-rose-50 dark:bg-rose-950/30 rounded-full flex items-center justify-center text-3xl mx-auto shadow-inner animate-bounce">
          💔
        </div>
        <div className="space-y-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-500 bg-rose-50/50 dark:bg-rose-950/20 px-2.5 py-1 rounded-full border border-rose-500/10">
            Core Weak Area Detected
          </span>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight pt-1">
            Ran out of Hearts!
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            Repetition is the motherboard of learning! Your tutor recommends repeating this topic to strengthen your weak areas before advancing.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={onQuit}
            className="px-5 py-2.5 text-xs font-bold text-slate-400 hover:text-slate-600 bg-slate-50 dark:bg-slate-800/40 rounded-xl transition-colors cursor-pointer"
          >
            Go Back
          </button>
          <button
            onClick={handleRepeatWeakArea}
            className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transform active:scale-95 transition-all shadow"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Repeat & Re-study Topic
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-sm text-left max-w-4xl mx-auto">
      {/* Tiny progress path timeline at top */}
      <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-4 mb-6 text-xs flex-wrap gap-2">
        <div className="flex items-center gap-1.5 font-bold">
          <span className="text-lg">🦉</span>
          <span className="text-slate-800 dark:text-slate-200">{conceptName}</span>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <span className="text-indigo-600 dark:text-indigo-400 capitalize">{stage} stage</span>
        </div>

        <div className="flex items-center gap-4">
          {stage === "quiz" && (
            <div className="flex items-center gap-1 bg-rose-50/50 dark:bg-rose-950/20 px-2.5 py-1 rounded-full border border-rose-500/10 text-rose-500 mr-2 font-mono text-[10px] font-bold">
              <span>HEARTS:</span>
              <div className="flex gap-0.5 ml-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <span key={i} className="text-xs">
                    {i < hearts ? "❤️" : "🤍"}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-1">
            <span className={`h-2 w-8 rounded-full ${stage === "lesson" ? "bg-indigo-600" : "bg-slate-100 dark:bg-slate-800"}`} />
            <span className={`h-2 w-8 rounded-full ${stage === "quiz" ? "bg-indigo-600" : "bg-slate-100 dark:bg-slate-800"}`} />
            <span className={`h-2 w-8 rounded-full ${stage === "socraticCode" ? "bg-indigo-600" : "bg-slate-100 dark:bg-slate-800"}`} />
            <span className={`h-2 w-8 rounded-full ${stage === "evaluation" ? "bg-indigo-600" : "bg-slate-100 dark:bg-slate-800"}`} />
          </div>

          <button
            onClick={onQuit}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
          >
            Quit
          </button>
        </div>
      </div>

      {/* Stage renderer: Lesson */}
      {stage === "lesson" && (
        <div className="space-y-6 animate-fade-in">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {lessonTitle}
            </h2>
            <div className="h-1 w-12 bg-indigo-500 rounded-full mt-2.5" />
          </div>

          {/* Micro-Lesson explanation & analogy block */}
          {lessonSummary ? (
            <div className="space-y-6 animate-fade-in">
              {/* Explanation Block */}
              <div className="space-y-2">
                <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <span>📖</span> Micro-Lesson Summary
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed bg-slate-50/50 dark:bg-slate-950/25 p-5 md:p-6 rounded-2xl border border-slate-100 dark:border-slate-800/40 font-medium">
                  {lessonSummary}
                </p>
              </div>

              {/* Analogy Block */}
              {lessonAnalogy && (
                <div className="space-y-2">
                  <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <span>💡</span> Real-World Analogy
                  </h3>
                  <div className="text-xs text-indigo-950 dark:text-indigo-200 bg-indigo-50/40 dark:bg-indigo-950/20 p-5 rounded-2xl border border-indigo-500/10 dark:border-indigo-500/5 leading-relaxed relative overflow-hidden">
                    <span className="absolute right-3.5 bottom-1 text-7xl select-none opacity-5 dark:opacity-[0.03] font-serif pointer-events-none">“</span>
                    <p className="font-medium italic">"{lessonAnalogy}"</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 text-sm bg-slate-50/50 dark:bg-slate-950/25 p-5 md:p-7 rounded-2xl border border-slate-100 dark:border-slate-800/40 animate-fade-in">
              <MarkdownRenderer content={lessonMarkdown} />
            </div>
          )}

          {/* Takeaways Board */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
              Core Takeaways:
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {takeaways.map((takeaway, idx) => (
                <div
                  key={idx}
                  className="bg-indigo-50/10 dark:bg-indigo-950/10 border border-indigo-500/10 dark:border-indigo-500/5 rounded-xl p-3.5 text-xs text-slate-700 dark:text-slate-300 flex gap-2.5 items-start"
                >
                  <CheckCircle2 className="h-4.5 w-4.5 text-indigo-500 flex-shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{takeaway}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Forward Action Button */}
          <div className="pt-4 border-t border-slate-50 dark:border-slate-800/60 flex justify-end">
            <button
              onClick={handleStartQuiz}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-6 py-3 rounded-xl flex items-center gap-2 transform active:scale-95 transition-all shadow cursor-pointer"
            >
              Test Your Grasp
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Stage renderer: Quiz */}
      {stage === "quiz" && quizQuestions.length > 0 && (
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Question {currentQuizIndex + 1} of {quizQuestions.length}
              </p>
              <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight mt-1">
                {quizQuestions[currentQuizIndex].question}
              </h3>
            </div>
            <div className="text-xs font-bold text-slate-400">
              Accuracy: {correctAnswersCount} correct
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuizIndex + 1) / quizQuestions.length) * 100}%` }}
            />
          </div>

          {/* Options Board */}
          <div className="grid grid-cols-1 gap-3 pt-2">
            {quizQuestions[currentQuizIndex].options.map((option, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrectIndex = idx === quizQuestions[currentQuizIndex].correctAnswerIndex;
              
              let cardStyle = "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300";
              
              if (isSelected && !isAnswerRevealed) {
                cardStyle = "border-indigo-500 bg-indigo-50/10 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500/15";
              }

              if (isAnswerRevealed) {
                if (isCorrectIndex) {
                  // highlight core answer in green
                  cardStyle = "border-emerald-500 bg-emerald-50/20 text-emerald-700 dark:text-emerald-400 font-semibold ring-2 ring-emerald-500/10";
                } else if (isSelected) {
                  // they selected wrong answer
                  cardStyle = "border-rose-500 bg-rose-50/20 text-rose-700 dark:text-rose-400 font-semibold ring-2 ring-rose-500/10";
                } else {
                  cardStyle = "border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 line-through";
                }
              }

              return (
                <button
                  key={idx}
                  disabled={isAnswerRevealed}
                  onClick={() => handleSelectOption(idx)}
                  className={`w-full text-left border rounded-xl p-4 text-xs font-medium cursor-pointer transition-all flex items-center justify-between gap-3 ${cardStyle}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="h-6 w-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-[10px] text-slate-500 flex-shrink-0">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{option}</span>
                  </div>

                  {isAnswerRevealed && isCorrectIndex && (
                    <span className="text-[10px] text-emerald-600 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full">Correct</span>
                  )}
                  {isAnswerRevealed && isSelected && !isCorrectIndex && (
                    <span className="text-[10px] text-rose-600 bg-rose-100 dark:bg-rose-950 dark:text-rose-400 font-bold px-2 py-0.5 rounded-full">Incorrect</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Reveal & Proceed Trays */}
          <div className="pt-4 border-t border-slate-50 dark:border-slate-800/60">
            {!isAnswerRevealed ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/20 p-3.5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800/60">
                <div className="flex-1">
                  {showHint ? (
                    <div className="text-[11px] text-indigo-700 dark:text-indigo-400 font-medium leading-relaxed pl-1 animate-fade-in">
                      💡 Clue: {quizQuestions[currentQuizIndex].hint || "Concentrate on the primary takeaway guidelines we just read."}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setShowHint(true);
                        posthogTracker.trackHintUsed(
                          conceptName.toLowerCase().replace(/\s+/g, "-"),
                          conceptName,
                          currentQuizIndex,
                          "quiz"
                        );
                        posthogLogsTrigger();
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 pl-1 underline cursor-pointer hover:no-underline"
                    >
                      Need a hint? 💡
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-end">
                  <button
                    onClick={handleRevealAnswer}
                    disabled={selectedOption === null}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white font-bold text-xs px-6 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-sm disabled:cursor-not-allowed"
                  >
                    Check Answer
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Explanation block */}
                <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-800 p-4 rounded-xl text-left space-y-3">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-1 mb-1 animate-pulse">
                    <Sparkles className="h-3 w-3" /> Constructive Feedback
                  </span>
                  
                  {selectedOption !== null && quizQuestions[currentQuizIndex].rawExplanationObj ? (
                    <div className="space-y-3 text-xs">
                      <div className="space-y-1">
                        <p className="font-bold text-slate-700 dark:text-slate-200">
                          Your choice ({String.fromCharCode(65 + selectedOption)}):
                        </p>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-lg shadow-sm">
                          {quizQuestions[currentQuizIndex].rawExplanationObj[`${String.fromCharCode(65 + selectedOption) as 'A' | 'B' | 'C' | 'D'}_why` as keyof typeof quizQuestions[number]['rawExplanationObj']]}
                        </p>
                      </div>
                      
                      {selectedOption !== quizQuestions[currentQuizIndex].correctAnswerIndex && quizQuestions[currentQuizIndex].rawExplanationObj.correct_reason && (
                        <div className="space-y-1">
                          <p className="font-bold text-emerald-600 dark:text-emerald-400">
                            Why Option {String.fromCharCode(65 + quizQuestions[currentQuizIndex].correctAnswerIndex)} is Correct:
                          </p>
                          <p className="text-slate-600 dark:text-slate-400 leading-relaxed bg-emerald-50/10 dark:bg-emerald-950/10 border border-emerald-500/10 p-2.5 rounded-lg shadow-sm">
                            {quizQuestions[currentQuizIndex].rawExplanationObj.correct_reason}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {quizQuestions[currentQuizIndex].explanation}
                    </p>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleNextQuiz}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 py-3 rounded-xl flex items-center gap-2 cursor-pointer shadow"
                  >
                    {currentQuizIndex === quizQuestions.length - 1 ? "Start Socratic Dialogue" : "Next Question"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stage renderer: Socratic Chat */}
      {stage === "socraticCode" && (
        <div className="space-y-4 animate-fade-in flex flex-col h-[520px]">
          {/* Tutor Info box */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950/80 p-4 rounded-2xl flex items-center gap-3 border border-slate-800 text-white flex-shrink-0">
            <span className="text-3xl animate-bounce">🦉</span>
            <div className="flex-1 text-left">
              <h4 className="font-extrabold text-xs text-indigo-400 tracking-wider uppercase">Active Socratic Guide</h4>
              <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
                I won't give you straightforward solutions. I'll ask guided questions to let you discover deeper truths about <strong>{conceptName}</strong> on your own.
              </p>
            </div>
            <div className="flex flex-col items-end text-right flex-shrink-0">
              <span className="text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Turns: {tutorTurns}/3
              </span>
              <p className="text-[9px] text-slate-400 mt-0.5">Min turns recommended</p>
            </div>
          </div>

          {/* Bubbles Frame */}
          <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/40 space-y-3.5 custom-scrollbar min-h-0">
            {chatMessages.map((msg) => {
              const isTutor = msg.sender === "tutor";
              const isSystem = msg.sender === "system";

              if (isSystem) {
                return (
                  <div key={msg.id} className="text-center py-2 text-rose-500 font-mono text-[11px]">
                    {msg.text}
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex ${isTutor ? "justify-start" : "justify-end"} animate-fade-in`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs select-text leading-relaxed shadow-sm ${
                      isTutor
                        ? "bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-800/60 rounded-tl-none font-medium"
                        : "bg-indigo-600 text-white rounded-tr-none font-medium"
                    }`}
                  >
                    <p>{msg.text}</p>
                    <span className="block text-[8px] text-slate-400 text-right mt-1 opacity-70">
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              );
            })}

            {isTutorThinking && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-800 text-slate-500 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-1.5 border border-slate-100 dark:border-slate-800/65">
                  <span className="h-1.5 w-1.5 bg-indigo-600 rounded-full animate-bounce" />
                  <span className="h-1.5 w-1.5 bg-indigo-600 rounded-full animate-bounce delay-100" />
                  <span className="h-1.5 w-1.5 bg-indigo-600 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer controls: Input box and Evaluation button */}
          <div className="flex-shrink-0 pt-2 border-t border-slate-50 dark:border-slate-800/60 space-y-2">
            <form onSubmit={handleSendMessage} className="flex gap-2.5">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                disabled={isTutorThinking}
                placeholder="Debate with your owl tutor... explain your reasoning!"
                className="flex-1 rounded-xl px-4 py-3 text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-100 font-medium"
              />
              <button
                type="submit"
                disabled={!userInput.trim() || isTutorThinking}
                className="bg-indigo-600 hover:bg-slate-800 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white px-4 rounded-xl flex items-center justify-center transition-all cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>

            <div className="flex justify-between items-center gap-3">
              <span className="text-[10px] text-slate-400">
                {tutorTurns < 2 ? "💡 Complete 2 dialogue turns to qualify for grading!" : "✓ Socratic dialogue complete. Grade dial!"}
              </span>

              <button
                onClick={handleTriggerEvaluation}
                disabled={tutorTurns < 2 || isTutorThinking}
                className="bg-slate-900 hover:bg-indigo-600 active:indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white font-bold text-[10px] uppercase tracking-wider py-2 px-4 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                Evaluate Dialogue Mastery
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage renderer: Evaluation summary */}
      {stage === "evaluation" && (
        <div className="space-y-6 animate-fade-in py-4 text-center">
          {isEvaluating || !evaluation ? (
            <div className="bg-slate-50/50 dark:bg-slate-950/25 p-10 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-6 max-w-xl mx-auto">
              <ArrowRight className="h-10 w-10 text-indigo-500 mx-auto animate-spin" />
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">AI Socratic Evaluator</h3>
                <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                  A high-performance two-step educator is analyzing your dialogue logs for vocabulary syntax, conceptual synthesis, and critical thinking feedback.
                </p>
              </div>
              <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full animate-shimmer" style={{ width: "70%" }} />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Certificate badge layout */}
              <div className="bg-gradient-to-r from-amber-500/5 via-violet-600/5 to-indigo-500/5 border-2 border-indigo-500/10 dark:border-indigo-500/5 rounded-3xl p-6 md:p-8 text-center max-w-xl mx-auto space-y-4">
                <div className="relative inline-block">
                  <Award className="h-14 w-14 text-amber-500 mx-auto animate-bounce" />
                  <Sparkles className="h-6 w-6 text-indigo-500 absolute -top-1 -right-1 animate-pulse" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs uppercase font-extrabold tracking-widest text-indigo-600 dark:text-indigo-400">
                    Socratic Evaluation Certificate
                  </h3>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                    {evaluation.rating}
                  </h2>
                  <p className="text-xs text-slate-400">Awarded for study on {conceptName}</p>
                </div>

                {/* Socratic micro metrics */}
                <div className="flex flex-wrap items-center justify-center gap-2 pb-1">
                  {evaluation.badge && evaluation.badge !== "no badge" && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 text-xs font-black animate-pulse">
                      🏆 Badge: {evaluation.badge}
                    </span>
                  )}

                  {evaluation.mastery_status && (
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                      evaluation.mastery_status === "mastered"
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                        : evaluation.mastery_status === "in_progress"
                        ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                        : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                    }`}>
                      🎯 Status: {evaluation.mastery_status === "mastered" ? "Mastered" : evaluation.mastery_status === "in_progress" ? "In Progress" : "Needs Retry"}
                    </span>
                  )}

                  {evaluation.concept_clarity && (
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                      evaluation.concept_clarity === "yes"
                        ? "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20"
                        : evaluation.concept_clarity === "partial"
                        ? "bg-slate-500/10 text-slate-600 border border-slate-500/20"
                        : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                    }`}>
                      💡 Clarity: {evaluation.concept_clarity.toUpperCase()}
                    </span>
                  )}

                  {evaluation.xp_earned !== undefined && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-violet-500/10 text-violet-600 border border-violet-500/20 text-xs font-bold animate-pulse">
                      🌟 +{evaluation.xp_earned} XP
                    </span>
                  )}
                </div>

                {/* Score Dial */}
                <div className="flex items-center justify-center gap-6 py-2">
                  <div className="h-20 w-20 rounded-full border-4 border-indigo-600/30 flex items-center justify-center relative">
                    <span className="font-mono text-xl font-black text-indigo-600 dark:text-indigo-400">{evaluation.score}</span>
                    <span className="text-[10px] text-slate-400 absolute bottom-3">/100</span>
                  </div>

                  <div className="text-left space-y-1">
                    <p className="text-xs font-bold text-slate-500">Dialogue Performance</p>
                    <p className="text-[11px] text-slate-400 max-w-[240px]">
                      Your response length, accuracy in answering prompts, and willingness to adapt is compiled here.
                    </p>
                  </div>
                </div>

                {/* Verbose natural language summary */}
                <div className="bg-white/80 dark:bg-slate-950/60 p-4 border border-slate-100 dark:border-slate-800 rounded-2xl text-left shadow-sm">
                  <h4 className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase mb-1.5">
                    Verbose Analysis and Feedback:
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    {evaluation.verboseAnalysis}
                  </p>
                </div>

                {/* Strengths and growths lists */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-left pt-2">
                  <div className="bg-emerald-500/5 dark:bg-emerald-500/5 p-3.5 rounded-xl border border-emerald-500/10">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Key Strengths ✓</span>
                    <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 mt-2">
                      {evaluation.strengths.map((s, idx) => (
                        <li key={idx} className="flex gap-2 items-start text-xs leading-relaxed">
                          <span className="text-emerald-500 font-bold">•</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-sky-500/5 dark:bg-sky-500/5 p-3.5 rounded-xl border border-sky-500/10">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">Growth Areas 📈</span>
                    <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 mt-2">
                      {evaluation.growthAreas.map((g, idx) => (
                        <li key={idx} className="flex gap-2 items-start text-xs leading-relaxed">
                          <span className="text-sky-500 font-bold">•</span>
                          <span>{g}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Conclude Button */}
              <div className="pt-4 border-t border-slate-50 dark:border-slate-800 flex justify-center">
                <button
                  onClick={handleSaveAndExit}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm px-8 py-3.5 rounded-xl text-center shadow-md transform active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                >
                  Conclude Session & Save XP <Zap className="h-4 w-4 fill-amber-400 text-amber-400" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
