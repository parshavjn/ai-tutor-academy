import posthog from "posthog-js";

const posthogKey = ((import.meta as any).env.VITE_POSTHOG_API_KEY as string) || "";
const posthogHost = ((import.meta as any).env.VITE_POSTHOG_HOST as string) || "https://app.posthog.com";

export const isPostHogConfigured = !!posthogKey;

// Stream logs of captured events so they show up interactively inside the app for educational tracking
export interface LoggedEvent {
  id: string;
  eventName: string;
  properties: any;
  timestamp: string;
}

let inAppLogs: LoggedEvent[] = [];
type LogListener = (logs: LoggedEvent[]) => void;
const listeners = new Set<LogListener>();

export function getPostHogLogs(): LoggedEvent[] {
  return inAppLogs;
}

export function subscribeToPostHogLogs(listener: LogListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function broadcastLogs() {
  listeners.forEach((l) => l([...inAppLogs]));
}

// Initializing real PostHog or failing back gracefully
if (isPostHogConfigured) {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    autocapture: true,
    persistence: "localStorage",
    capture_exceptions: true,
    enable_recording_console_log: true,
    before_send: (event) => {
      // Filter out low-value generic browser network/load failures
      const exception = event.properties?.['$exception_message'] || event.properties?.['$exception']?.message;
      if (exception) {
        const message = String(exception).toLowerCase();
        if (
          message.includes("load failed") ||
          message.includes("failed to fetch") ||
          message.includes("networkerror")
        ) {
          return null; // Do not send generic network exceptions to PostHog
        }
      }
      return event;
    },
  });
}

export const posthogTracker = {
  identifyUser(userId: string, email: string) {
    if (isPostHogConfigured) {
      posthog.identify(userId, { email });
    }
    this.trackEvent("user_identified", { userId, email });
  },

  trackEvent(eventName: string, properties: any = {}) {
    // Add default properties
    const enrichedProperties = {
      ...properties,
      product: "MY Personalized AI Tutor",
      timestamp: new Date().toISOString(),
      agentic_tutor_version: "3.5",
    };

    if (isPostHogConfigured) {
      posthog.capture(eventName, enrichedProperties);
    }

    // Add to interactive simulation console inside the client UI
    const newLog: LoggedEvent = {
      id: Math.random().toString(36).substring(7),
      eventName,
      properties: enrichedProperties,
      timestamp: new Date().toLocaleTimeString(),
    };

    inAppLogs = [newLog, ...inAppLogs].slice(0, 30); // Keep last 30
    broadcastLogs();

    // Elegant console logs for developer inspection
    console.log(
      `%c[PostHog Capture: ${eventName}]`,
      "background: #111; color: #ffbc00; padding: 3px 6px; border-radius: 4px; font-weight: bold;",
      enrichedProperties
    );
  },

  // Specialized helper tracking the Duolingo funnels
  trackLessonStart(conceptId: string, conceptName: string, difficulty: string) {
    this.trackEvent("lesson_started", {
      concept_id: conceptId,
      concept_name: conceptName,
      difficulty,
    });
  },

  trackLessonCompleted(conceptId: string, conceptName: string, xpEarned: number) {
    this.trackEvent("lesson_completed", {
      concept_id: conceptId,
      concept_name: conceptName,
      xp_earned: xpEarned,
    });
  },

  trackQuizQuestionAnswered(conceptId: string, conceptName: string, questionIndex: number, isCorrect: boolean, chosenAnswer: string) {
    // Fire user's specified analytics layer name 'question_answered'
    this.trackEvent("question_answered", {
      concept_id: conceptId,
      concept_name: conceptName,
      question_index: questionIndex,
      is_correct: isCorrect,
      chosen_answer: chosenAnswer,
    });
  },

  trackHintUsed(conceptId: string, conceptName: string, questionIndex: number, context: "quiz" | "socratic") {
    this.trackEvent("hint_used", {
      concept_id: conceptId,
      concept_name: conceptName,
      question_index: questionIndex,
      hint_context: context,
    });
  },

  trackStreakSaved(userId: string, newStreak: number, previousStreak: number) {
    this.trackEvent("streak_saved", {
      user_id: userId,
      new_streak: newStreak,
      previous_streak: previousStreak,
    });
  },

  trackQuizCompleted(conceptId: string, conceptName: string, correctCount: number, totalQuestions: number, scorePercentage: number) {
    this.trackEvent("quiz_completed", {
      concept_id: conceptId,
      concept_name: conceptName,
      correct_count: correctCount,
      total_questions: totalQuestions,
      score_percentage: scorePercentage,
    });
  },

  trackSocraticChatTurn(conceptId: string, conceptName: string, messageLengthUser: number, totalTurns: number) {
    this.trackEvent("socratic_chat_message_sent", {
      concept_id: conceptId,
      concept_name: conceptName,
      message_length_user: messageLengthUser,
      total_turns: totalTurns,
    });
  },

  trackGraduation(conceptId: string, conceptName: string, finalScore: number, finalRating: string) {
    this.trackEvent("socratic_session_graduated", {
      concept_id: conceptId,
      concept_name: conceptName,
      evaluation_score: finalScore,
      evaluation_rating: finalRating,
    });
  },

  trackException(error: Error | any, context: string = "") {
    const message = error?.message || String(error);
    const isNetworkError =
      message.toLowerCase().includes("load failed") ||
      message.toLowerCase().includes("failed to fetch") ||
      message.toLowerCase().includes("networkerror");

    if (isPostHogConfigured && !isNetworkError) {
      try {
        posthog.captureException(error, { context });
      } catch (e) {
        console.error("Failed to capture exception in PostHog:", e);
      }
    }
    this.trackEvent("exception_captured", {
      error_message: message,
      context,
      is_network_error: isNetworkError,
    });
  },
};
