import React, { useState } from "react";
import { Mail, Sparkles, BookOpen, KeyRound, Eye, Database, HelpCircle, ArrowLeft, ShieldCheck, ExternalLink, MailCheck } from "lucide-react";
import { isSupabaseConfigured } from "../lib/supabase";
import { posthogTracker } from "../lib/posthog";

interface AuthScreenProps {
  onLoginSuccess: (email: string, isSandbox: boolean) => void;
}

export function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showConfigHint, setShowConfigHint] = useState(false);

  // Magic link sent state
  const [magicLinkStep, setMagicLinkStep] = useState(false);

  // Resend cooldown
  const [resendCooldown, setResendCooldown] = useState(0);
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSandboxBypass = async () => {
    const targetEmail = email.trim() || "developer@example.com";
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const { authService } = await import("../lib/supabase");
      const result = await authService.signIn(targetEmail, true);

      if (result.error) {
        setErrorMsg(result.error);
      } else if (result.user) {
        onLoginSuccess(targetEmail, true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An authentication error occurred.");
      posthogTracker.trackException(err, "AuthScreen.handleSandboxBypass");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const { authService } = await import("../lib/supabase");
      const result = await authService.signIn(email.trim());

      if (result.error) {
        setErrorMsg(result.error);
      } else if (result.magicLinkSent) {
        // Supabase sent magic link — show confirmation screen
        setMagicLinkStep(true);
        setResendCooldown(60);
      } else if (result.user) {
        // Sandbox mode — instant login, no email needed
        onLoginSuccess(email.trim(), result.isSandbox);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An authentication error occurred.");
      posthogTracker.trackException(err, "AuthScreen.handleEmailSubmit");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendLink = async () => {
    if (resendCooldown > 0) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const { authService } = await import("../lib/supabase");
      const result = await authService.signIn(email.trim());

      if (result.error) {
        setErrorMsg(result.error);
      } else {
        setResendCooldown(60);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to resend link.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setMagicLinkStep(false);
    setErrorMsg(null);
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

          {/* ── Step 1: Email Entry ── */}
          {!magicLinkStep && (
            <form className="space-y-6" onSubmit={handleEmailSubmit}>
              {errorMsg && (
                <div className="bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 p-3.5 rounded-xl text-xs border border-rose-100 dark:border-rose-900/10 font-medium space-y-2">
                  <p>{errorMsg}</p>
                  <button
                    type="button"
                    onClick={handleSandboxBypass}
                    className="mt-2 w-full text-center py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs cursor-pointer transition-colors"
                  >
                    Bypass & Continue in Sandbox Mode
                  </button>
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
                  No password required! We'll send a sign-in link to your email for secure, passwordless login.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-3.5 px-4 rounded-xl shadow-md text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all duration-200 transform active:scale-[0.98] cursor-pointer"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending Link...
                    </span>
                  ) : (
                    "Get Started & Learn"
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSandboxBypass}
                  disabled={isLoading}
                  className="w-full flex justify-center items-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/50 dark:hover:bg-slate-800/80 focus:outline-none transition-all cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>Bypass via Sandbox Mode</span>
                </button>
              </div>
            </form>
          )}

          {/* ── Step 2: Magic Link Sent Confirmation ── */}
          {magicLinkStep && (
            <div className="space-y-6">
              {/* Back button */}
              <button
                type="button"
                onClick={handleBackToEmail}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Use different email
              </button>

              {errorMsg && (
                <div className="bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 p-3.5 rounded-xl text-xs border border-rose-100 dark:border-rose-900/10 font-medium space-y-2">
                  <p>{errorMsg}</p>
                  <button
                    type="button"
                    onClick={handleSandboxBypass}
                    className="mt-2 w-full text-center py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs cursor-pointer transition-colors"
                  >
                    Bypass & Continue in Sandbox Mode
                  </button>
                </div>
              )}

              {/* Success illustration */}
              <div className="text-center space-y-4">
                <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
                  <MailCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Check your email
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    We sent a sign-in link to
                  </p>
                  <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {email}
                  </p>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 space-y-3 border border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-3 text-xs text-slate-600 dark:text-slate-400">
                  <span className="bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0 text-[10px] mt-0.5">1</span>
                  <p>Open your email inbox and find the email from <strong>Supabase Auth</strong></p>
                </div>
                <div className="flex items-start gap-3 text-xs text-slate-600 dark:text-slate-400">
                  <span className="bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0 text-[10px] mt-0.5">2</span>
                  <p>Click the <strong>"Sign in"</strong> link in the email</p>
                </div>
                <div className="flex items-start gap-3 text-xs text-slate-600 dark:text-slate-400">
                  <span className="bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0 text-[10px] mt-0.5">3</span>
                  <p>You'll be redirected back here and automatically signed in!</p>
                </div>
              </div>

              {/* Waiting indicator */}
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <span className="h-3 w-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span>Waiting for you to click the link...</span>
              </div>

              {/* Resend link */}
              <div className="text-center">
                {resendCooldown > 0 ? (
                  <p className="text-[11px] text-slate-400">
                    Resend link in <span className="font-bold text-indigo-500">{resendCooldown}s</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendLink}
                    disabled={isLoading}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:underline cursor-pointer transition-colors"
                  >
                    Didn't receive the email? Resend
                  </button>
                )}
              </div>
            </div>
          )}

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
