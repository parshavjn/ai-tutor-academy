import { Award, Zap, ShieldAlert, CheckCircle, Database, Target, Lock, Unlock } from "lucide-react";
import { UserProgressData } from "../types";

interface MetricCardProps {
  progress: UserProgressData;
  isSandbox: boolean;
  email: string;
}

export function MetricCard({ progress, isSandbox, email }: MetricCardProps) {
  // Simple calculation for levels
  const currentLevel = Math.floor(progress.xp / 100) + 1;
  const xpInCurrentLevel = progress.xp % 100;
  const xpNeededForNext = 100 - xpInCurrentLevel;

  // Daily Goal (50 XP goal threshold)
  const dailyGoalXP = 50;
  const currentDailyXP = progress.xp % dailyGoalXP; // Simulated daily XP progress based on modern bucket
  const dailyPercent = Math.min(100, Math.round((currentDailyXP / dailyGoalXP) * 100));

  // Level Unlock mappings
  const unlocksList = [
    { level: 1, label: "Beginner: Prompts & Hallucinations", unlocked: currentLevel >= 1 },
    { level: 2, label: "Intermediate: Embeddings & RAG", unlocked: currentLevel >= 2 },
    { level: 3, label: "Advanced: Fine-Tuning & Agents", unlocked: currentLevel >= 3 },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6 transition-all space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-50 dark:border-slate-800/60 pb-6">
        {/* User identification */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-xl font-bold text-indigo-600 dark:text-indigo-400">
            {email ? email.substring(0, 2).toUpperCase() : "U"}
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-base">{email}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              {isSandbox ? (
                <span className="inline-flex items-center gap-1 text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 font-medium px-2 py-0.5 rounded-full">
                  <ShieldAlert className="h-3 w-3" />
                  Sandbox (Local Storage)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 font-medium px-2 py-0.5 rounded-full">
                  <Database className="h-3 w-3" />
                  Supabase Cloud Active
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats columns */}
        <div className="flex flex-wrap items-center gap-6 md:gap-8 w-full md:w-auto">
          {/* Level Info */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center text-violet-600 dark:text-violet-400">
              <Award className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">Level</p>
              <p className="text-lg font-black text-slate-800 dark:text-slate-100">{currentLevel}</p>
            </div>
          </div>

          {/* XP Info */}
          <div className="flex items-center gap-3 flex-1 min-w-[124px]">
            <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-500 dark:text-amber-400">
              <Zap className="h-5 w-5 fill-amber-500" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-baseline mb-0.5">
                <p className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">XP Progress</p>
                <span className="text-xs font-semibold text-slate-500">{progress.xp} XP</span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${xpInCurrentLevel}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{xpNeededForNext} XP to Level {currentLevel + 1}</p>
            </div>
          </div>

          {/* Streak Info */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center text-orange-500 text-orange-400">
              <Zap className="h-5 w-5 fill-orange-500 animate-bounce" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">Streak</p>
              <p className="text-lg font-black text-slate-800 dark:text-slate-100">
                {progress.streak} {progress.streak === 1 ? "day" : "days"} 🔥
              </p>
            </div>
          </div>

          {/* Lessons completed */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">Completed</p>
              <p className="text-lg font-black text-slate-800 dark:text-slate-100">
                {progress.completedLessons?.length || 0} topics
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Goal & Level Unlocks Container Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Daily Goal card item */}
        <div className="bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800/70 rounded-xl p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-rose-50 dark:bg-rose-950/20 flex items-center justify-center text-rose-500">
            <Target className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between font-mono">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Daily Goal: 50 XP</span>
              <span className="text-xs font-black text-rose-500">{dailyPercent}%</span>
            </div>
            <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-1.5">
              <div 
                className="h-full bg-rose-500 rounded-full transition-all duration-300" 
                style={{ width: `${dailyPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {progress.xp >= dailyGoalXP ? "🎉 Daily Goal Complete! You're crushing it." : `Earn ${dailyGoalXP - currentDailyXP} more XP to reach your daily benchmark.`}
            </p>
          </div>
        </div>

        {/* Level Unlocks card item */}
        <div className="bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800/70 rounded-xl p-4 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1">
            <Unlock className="h-3 w-3 text-indigo-500" /> Socratic Pathway Unlocks (Level-Up)
          </span>
          <div className="grid grid-cols-1 gap-1.5 pt-0.5">
            {unlocksList.map((unlock) => (
              <div 
                key={unlock.level} 
                className={`flex items-center justify-between text-[11px] px-2 py-1 rounded-md border ${
                  unlock.unlocked 
                    ? "bg-indigo-50/20 text-indigo-700 border-indigo-100/30 dark:bg-indigo-950/10 dark:text-indigo-400 dark:border-indigo-900/10 font-medium" 
                    : "bg-slate-200/20 text-slate-400 dark:bg-slate-900/10 border-slate-200/20"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {unlock.unlocked ? (
                    <Unlock className="h-3 w-3 text-indigo-500" />
                  ) : (
                    <Lock className="h-3 w-3 text-slate-400" />
                  )}
                  <span>{unlock.label}</span>
                </span>
                <span className="font-bold text-[9px] uppercase">
                  {unlock.unlocked ? "Unlocked" : `Level ${unlock.level}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
