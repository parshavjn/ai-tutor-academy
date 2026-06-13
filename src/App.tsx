import { useState, useEffect } from "react";
import { AuthScreen } from "./components/AuthScreen";
import { MetricCard } from "./components/MetricCard";
import { ConceptSelector } from "./components/ConceptSelector";
import { ActiveLessonFlow } from "./components/ActiveLessonFlow";
import { PosthogConsole } from "./components/PosthogConsole";
import { authService, progressService, isSupabaseConfigured } from "./lib/supabase";
import { posthogTracker } from "./lib/posthog";
import { UserProgressData } from "./types";
import { LogOut, BookOpen, GraduationCap, Sparkles, Terminal, Activity, HelpCircle } from "lucide-react";

export default function App() {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isSandbox, setIsSandbox] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // User metrics state
  const [progress, setProgress] = useState<UserProgressData>({
    xp: 0,
    streak: 0,
    lastActive: null,
    completedLessons: [],
  });
  const [sessionLogs, setSessionLogs] = useState<any[]>([]);

  // Selected Active Lesson Tracker
  const [activeConcept, setActiveConcept] = useState<string | null>(null);
  const [activeDifficulty, setActiveDifficulty] = useState<"Beginner" | "Intermediate" | "Advanced">("Beginner");
  const [activePreviousMistakes, setActivePreviousMistakes] = useState<string[]>([]);

  // Visual success alert state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showLogsPane, setShowLogsPane] = useState(false);

  // Initial session loader
  useEffect(() => {
    async function loadSession() {
      try {
        setIsLoading(true);
        const user = await authService.getCurrentUser();
        if (user) {
          setCurrentUser(user);
          // If supabase client exists, isSandbox matches the config status
          setIsSandbox(!isSupabaseConfigured);
          
          // Identify user in telemetry funnel
          posthogTracker.identifyUser(user.id, user.email);
          
          // Load progress stats
          const userProgress = await progressService.getProgress(user.id);
          setProgress(userProgress);

          // Build history list
          const logs = await progressService.getSessionLogs(user.id);
          setSessionLogs(logs);
        }
      } catch (err) {
        console.error("Session load error:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadSession();
  }, []);

  const handleLoginSuccess = async (email: string, sandboxActive: boolean) => {
    setIsLoading(true);
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        setIsSandbox(sandboxActive);

        // Identify user in posthog
        posthogTracker.identifyUser(user.id, user.email);

        // Fetch their metrics
        const userProgress = await progressService.getProgress(user.id);
        setProgress(userProgress);

        // Fetch logs
        const logs = await progressService.getSessionLogs(user.id);
        setSessionLogs(logs);

        showToast("Welcome back, Socratic Scholar! 🦉 Let's master AI.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await authService.signOut();
    setCurrentUser(null);
    setProgress({ xp: 0, streak: 0, lastActive: null, completedLessons: [] });
    setSessionLogs([]);
    setActiveConcept(null);
    showToast("Signed out. Keep learning!");
  };

  const handleSelectConcept = (
    conceptName: string,
    difficultyStr: "Beginner" | "Intermediate" | "Advanced",
    previousMistakes: string[] = [],
    source: "curriculum_map" | "search" | "recommendation" = "curriculum_map"
  ) => {
    setActiveConcept(conceptName);
    setActiveDifficulty(difficultyStr);
    setActivePreviousMistakes(previousMistakes);
    posthogTracker.trackEvent("concept_selected", { concept: conceptName, source });
  };

  // Callback immediately triggered when Socratic active session completes
  const handleFinishLesson = async (xpAwarded: number, updatedCompleted: boolean) => {
    if (!currentUser) return;

    setActiveConcept(null);

    // Calculate updated metrics structure
    let newStreak = progress.streak;
    const todayStr = new Date().toISOString().split("T")[0];
    const lastActiveStr = progress.lastActive ? progress.lastActive.split("T")[0] : null;

    if (!lastActiveStr) {
      newStreak = 1; // First active day
    } else if (lastActiveStr !== todayStr) {
      // Completed on separate day
      newStreak = progress.streak + 1;
    }

    const currentConceptId = activeConcept ? activeConcept.toLowerCase().replace(/\s+/g, "-") : "custom";
    const completedList = [...progress.completedLessons];
    if (!completedList.includes(currentConceptId)) {
      completedList.push(currentConceptId);
    }

    const nextProgress: UserProgressData = {
      xp: progress.xp + xpAwarded,
      streak: newStreak,
      lastActive: new Date().toISOString(),
      completedLessons: completedList,
    };

    setProgress(nextProgress);

    // Persist to DB adapter
    await progressService.saveProgress(currentUser.id, nextProgress);

    // Reload list of logs
    const logs = await progressService.getSessionLogs(currentUser.id);
    setSessionLogs(logs);

    // Track completed telemetry funnel in Posthog
    posthogTracker.trackLessonCompleted(currentConceptId, activeConcept || "Custom Concept", xpAwarded);
    posthogTracker.trackStreakSaved(currentUser.id, newStreak, progress.streak);
    if (newStreak > progress.streak) {
      posthogTracker.trackEvent("streak_extended", { newStreakCount: newStreak });
    }

    showToast(`🌟 Splendid! You earned +${xpAwarded} XP!`);
  };

  // Helper utility to fire small toasts
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // PostHog log panel triggering
  const triggerTelemetryInspection = () => {
    setShowLogsPane(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center font-sans">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Synchronizing Socratic records...</h3>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans transition-all flex flex-col justify-between">
      {/* Top Navigation Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800/80 sticky top-0 z-30 transition-all shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-3xl filter drop-shadow">🦉</span>
            <div>
              <h1 className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 leading-none">
                MY Personalized AI Tutor
              </h1>
              <span className="text-[9px] uppercase font-bold tracking-widest text-indigo-600 dark:text-indigo-400">
                Socratic Adaptive Learning
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Direct Telemetry Inspector display trigger */}
            <button
              onClick={() => setShowLogsPane(!showLogsPane)}
              className="px-3.5 py-1.5 hidden md:flex items-center gap-1.5 rounded-full text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50/60 dark:bg-indigo-950/20 dark:text-indigo-400 hover:bg-indigo-100/50 transition-colors cursor-pointer"
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Telemetry Panel</span>
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-rose-500 bg-slate-50 dark:bg-slate-800/60 hover:bg-rose-50 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {/* Animated toast notify */}
        {toastMessage && (
          <div className="fixed top-20 right-4 z-50 bg-slate-900 dark:bg-indigo-950 text-white border border-indigo-500/20 px-5  py-3.5 rounded-2xl shadow-xl text-xs font-bold animate-fade-in flex items-center gap-2.5 max-w-sm">
            <Sparkles className="h-4.5 w-4.5 text-amber-500 animate-pulse" />
            <p>{toastMessage}</p>
          </div>
        )}

        {/* Selected Screen Layout Router */}
        {activeConcept ? (
          /* Active Lesson Workspace Drawer */
          <ActiveLessonFlow
            conceptName={activeConcept}
            difficulty={activeDifficulty}
            userId={currentUser.id}
            previousMistakes={activePreviousMistakes}
            onQuit={() => {
              setActiveConcept(null);
              showToast("Lesson ended. Your active progress remains saved.");
            }}
            onFinishLesson={handleFinishLesson}
            posthogLogsTrigger={triggerTelemetryInspection}
          />
        ) : (
          /* Main Dashboard Explorer Home screen */
          <div className="space-y-6 animate-fade-in">
            {/* Student statistics summary banner */}
            <MetricCard progress={progress} isSandbox={isSandbox} email={currentUser.email} />

            {/* List and Grid Selector */}
            <ConceptSelector
              onSelectConcept={handleSelectConcept}
              completedConcepts={progress.completedLessons}
              sessionLogs={sessionLogs}
              isLoading={isLoading}
            />
          </div>
        )}
      </main>

      {/* Persistent Inline real-time PostHog console stream for funnel debugging */}
      {showLogsPane && (
        <div className="fixed bottom-4 right-4 z-40 max-w-md w-full p-2">
          <PosthogConsole />
        </div>
      )}

      {/* Minimal Footer */}
      <footer className="border-t border-slate-100 dark:border-slate-900 bg-white/40 dark:bg-slate-950/20 py-6 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© 2026 MY Personalized AI Tutor (Duolingo for AI). Easy to deploy on Vercel.</p>
          <div className="flex gap-4 items-center flex-wrap justify-center">
            <span className="flex items-center gap-1 font-semibold text-indigo-500">
              <GraduationCap className="h-3.5 w-3.5" /> Socratic Methodology
            </span>
            <span>•</span>
            <button
              onClick={() => setShowLogsPane(!showLogsPane)}
              className="hover:text-indigo-500 transition-colors cursor-pointer"
            >
              PostHog Funnel Logs
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
