export interface AIConcept {
  id: string;
  name: string;
  description: string;
  emoji: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  estimatedTime: string;
  level?: number;
  prereqs?: string[];
}

export interface LessonContent {
  conceptId: string;
  title: string;
  content: string; // Markdown supported micro-lesson text
  takeaways: string[];
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  hint?: string;
  difficulty?: string;
  rawExplanationObj?: {
    correct_reason: string;
    A_why: string;
    B_why: string;
    C_why: string;
    D_why: string;
  };
}

export interface Quiz {
  conceptId: string;
  questions: QuizQuestion[];
}

export interface SocraticMessage {
  id: string;
  sender: "user" | "tutor" | "system";
  text: string;
  timestamp: string;
}

export interface SocraticSession {
  id: string;
  conceptId: string;
  conceptName: string;
  messages: SocraticMessage[];
  status: "active" | "completed";
}

export interface EvaluationResult {
  concept?: string;
  verboseAnalysis: string; // Detailed natural language feedback
  summary?: string; // Narrative feedback
  rating: "Diamond Socratic Master" | "Gold Thinker" | "Silver Explorer" | "Needs Refinement";
  score: number; // 0-100 rating
  strengths: string[];
  growthAreas: string[];
  growth_areas?: string[];
  concept_clarity?: "yes" | "partial" | "no";
  final_mental_model?: string;
  xp_earned?: number;
  badge?: string | null;
  mastery_status?: "mastered" | "in_progress" | "needs_retry";
  analytics?: {
    event: string;
    concept: string;
    score: number;
    rating: string;
    hint_count?: number;
    insight_moments?: number;
    xp_earned: number;
    mastery_status: string;
    badge: string | null;
  };
}

export interface UserProgressData {
  xp: number;
  streak: number;
  lastActive: string | null; // ISO string
  completedLessons: string[]; // List of concept IDs
}
