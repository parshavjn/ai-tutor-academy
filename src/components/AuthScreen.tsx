import React, { useState } from "react";
import { Mail, Sparkles, BookOpen, KeyRound, Eye, Database, HelpCircle } from "lucide-react";
import { isSupabaseConfigured } from "../lib/supabase";

interface AuthScreenProps {
  onLoginSuccess: (email: string, isSandbox: boolean) => void;
}

export function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); // Optional or simulated pass
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showConfigHint, setShowConfigHint] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      // Import the auth service dynamically to prevent circular depend structure
      const { authService } = await import("../lib/supabase");
      
      // The user wants email login only. We'll simplify this by automatically wrapping signin and auto-signup
      const result = await authService.signIn(email.trim());
      if (result.error) {
        setErrorMsg(result.error);
      } else if (result.user) {
        onLoginSuccess(email.trim(), result.isSandbox);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An authentication error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans transition-all">
      <div className="absolute top-4 right-4 z-40">
        <button
          onClick={() => setShowConfigHint(!showConfigHint)}
          className="flex items-center gap-1.5 text-xs text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-full shadow-sm hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <Database className="h-3 w-3 text-indigo-500" />
          <span>Database Mode</span>
          <HelpCircle className="h-3 w-3" />
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Tutor Logo Icon mock */}
        <div className="mx-auto h-20 w-20 rounded-full bg-indigo-600 flex items-center justify-center text-5xl shadow-md animate-bounce">
          🦉
        </div>
        <h2 className="mt-6 text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          MY Personalized AI Tutor
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Learn cutting-edge AI concepts Socratic-style
        </p>

        {showConfigHint && (
          <div className="mt-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left p-4 rounded-xl text-xs space-y-2 text-slate-600 dark:text-slate-400 max-w-sm mx-auto shadow-sm">
            <p className="font-bold text-slate-800 dark:text-white flex items-center gap-1">
              <Database className="h-3.5 w-3.5 text-indigo-500" /> Status: {isSupabaseConfigured ? "Connected" : "Local Sandbox"}
            </p>
            {isSupabaseConfigured ? (
              <p>The application is actively reading and writing to your live Supabase cloud workspace! Accounts and score profiles are fully unified.</p>
            ) : (
              <p>No active Supabase keys detected in `.env`. The app is running in <strong>Local Storage Sandbox Mode</strong>, which allows instant logins/signups for testing. To sync clouds, put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your environment!</p>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-10 px-6 sm:px-10 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {errorMsg && (
              <div className="bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 p-3.5 rounded-xl text-xs border border-rose-100 dark:border-rose-900/10 font-medium">
                {errorMsg}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Enter Email Address
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  disabled={isLoading}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="block w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                No password required! Email only. We immediately establish or reload your profile dashboard.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3.5 px-4 rounded-xl shadow-md text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all duration-200 transform active:scale-[0.98] cursor-pointer"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating Workspace...
                </span>
              ) : (
                "Get Started & Learn"
              )}
            </button>
          </form>

          {/* Social proof bullet list */}
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-left space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              What you will experience:
            </h4>
            <div className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400">
              <span className="text-indigo-500 font-bold mt-0.5">⚡</span>
              <p>2-minute micro-lessons & adaptive 3-question quizzes.</p>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400">
              <span className="text-indigo-500 font-bold mt-0.5">🧠</span>
              <p>Socratic tutor dialog that probes your thinking rather than giving boring lectures.</p>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400">
              <span className="text-indigo-500 font-bold mt-0.5">🏆</span>
              <p>XP Level Tracking, Streaks, and PostHog capture tunnels.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
