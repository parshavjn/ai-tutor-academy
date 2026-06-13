import React, { useState, useRef, useEffect } from "react";
import { Mail, Sparkles, BookOpen, KeyRound, Eye, Database, HelpCircle, ArrowLeft, ShieldCheck } from "lucide-react";
import { isSupabaseConfigured } from "../lib/supabase";

interface AuthScreenProps {
  onLoginSuccess: (email: string, isSandbox: boolean) => void;
}

export function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showConfigHint, setShowConfigHint] = useState(false);

  // OTP verification state
  const [otpStep, setOtpStep] = useState(false); // true = show OTP input
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend cooldown
  const [resendCooldown, setResendCooldown] = useState(0);
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { authService } = await import("../lib/supabase");
      const result = await authService.signIn(email.trim());

      if (result.error) {
        setErrorMsg(result.error);
      } else if (result.otpSent) {
        // Supabase sent OTP — switch to code entry step
        setOtpStep(true);
        setResendCooldown(60);
        setSuccessMsg(`We sent a 6-digit code to ${email.trim()}`);
      } else if (result.user) {
        // Sandbox mode — instant login, no OTP needed
        onLoginSuccess(email.trim(), result.isSandbox);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An authentication error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newOtp = [...otpCode];
    newOtp[index] = value.slice(-1); // Take only last char
    setOtpCode(newOtp);

    // Auto-advance to next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 0) return;

    const newOtp = [...otpCode];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pasted[i] || "";
    }
    setOtpCode(newOtp);

    // Focus the last filled input or the next empty one
    const nextEmpty = newOtp.findIndex((d) => !d);
    const focusIdx = nextEmpty === -1 ? 5 : nextEmpty;
    otpInputRefs.current[focusIdx]?.focus();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpCode.join("");
    if (code.length !== 6) {
      setErrorMsg("Please enter all 6 digits of the verification code.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { authService } = await import("../lib/supabase");
      const result = await authService.verifyOtp(email.trim(), code);

      if (result.error) {
        setErrorMsg(result.error);
        setOtpCode(["", "", "", "", "", ""]);
        otpInputRefs.current[0]?.focus();
      } else if (result.user) {
        onLoginSuccess(email.trim(), result.isSandbox);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Verification failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { authService } = await import("../lib/supabase");
      const result = await authService.signIn(email.trim());

      if (result.error) {
        setErrorMsg(result.error);
      } else {
        setResendCooldown(60);
        setSuccessMsg("New code sent! Check your inbox.");
        setOtpCode(["", "", "", "", "", ""]);
        otpInputRefs.current[0]?.focus();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to resend code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setOtpStep(false);
    setOtpCode(["", "", "", "", "", ""]);
    setErrorMsg(null);
    setSuccessMsg(null);
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
          {!otpStep && (
            <form className="space-y-6" onSubmit={handleEmailSubmit}>
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
                  No password required! We'll send a 6-digit code to your email for secure, passwordless login.
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
                    Sending Code...
                  </span>
                ) : (
                  "Get Started & Learn"
                )}
              </button>
            </form>
          )}

          {/* ── Step 2: OTP Verification ── */}
          {otpStep && (
            <form className="space-y-6" onSubmit={handleVerifyOtp}>
              {/* Back button */}
              <button
                type="button"
                onClick={handleBackToEmail}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Use different email
              </button>

              {successMsg && (
                <div className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 p-3.5 rounded-xl text-xs border border-emerald-100 dark:border-emerald-900/10 font-medium flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div className="bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 p-3.5 rounded-xl text-xs border border-rose-100 dark:border-rose-900/10 font-medium">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Enter Verification Code
                </label>
                <p className="text-[11px] text-slate-400 mb-4">
                  Check your inbox for <span className="font-semibold text-slate-600 dark:text-slate-300">{email}</span>
                </p>

                {/* 6-digit OTP inputs */}
                <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                  {otpCode.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { otpInputRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      disabled={isLoading}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      autoFocus={idx === 0}
                      className="w-12 h-14 text-center text-xl font-bold rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || otpCode.join("").length !== 6}
                className="w-full flex justify-center py-3.5 px-4 rounded-xl shadow-md text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all duration-200 transform active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Verifying...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    Verify & Login
                  </span>
                )}
              </button>

              {/* Resend code */}
              <div className="text-center">
                {resendCooldown > 0 ? (
                  <p className="text-[11px] text-slate-400">
                    Resend code in <span className="font-bold text-indigo-500">{resendCooldown}s</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={isLoading}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:underline cursor-pointer transition-colors"
                  >
                    Didn't receive a code? Resend
                  </button>
                )}
              </div>
            </form>
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
