import React, { useState } from "react";
import { DEFAULT_CONCEPTS } from "../data/concepts";
import { AIConcept } from "../types";
import { Sparkles, ArrowRight, History, BookOpen, Star, Lock } from "lucide-react";

interface ConceptSelectorProps {
  onSelectConcept: (
    conceptName: string,
    difficulty: "Beginner" | "Intermediate" | "Advanced",
    previousMistakes?: string[],
    source?: "curriculum_map" | "search" | "recommendation"
  ) => void;
  completedConcepts: string[];
  sessionLogs: any[];
  isLoading: boolean;
}

export function ConceptSelector({ onSelectConcept, completedConcepts, sessionLogs, isLoading }: ConceptSelectorProps) {
  const [customConcept, setCustomConcept] = useState("");
  const [difficulty, setDifficulty] = useState<"Beginner" | "Intermediate" | "Advanced">("Beginner");
  const [previousMistakesInput, setPreviousMistakesInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const handleSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customConcept.trim()) return;
    
    const mistakes = previousMistakesInput
       .split(",")
       .map((item) => item.trim())
       .filter((item) => item.length > 0);
       
    onSelectConcept(customConcept.trim(), difficulty, mistakes, "recommendation");
  };

  const handleApplyPresetMistake = (text: string) => {
    setPreviousMistakesInput((prev) => {
      const current = prev.trim();
      if (!current) return text;
      if (current.toLowerCase().includes(text.toLowerCase())) return prev;
      return `${prev}, ${text}`;
    });
  };

  const filteredConcepts = DEFAULT_CONCEPTS.filter((concept) =>
    concept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    concept.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Intro Greetings Hero */}
      <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-3xl p-8 text-white shadow-md relative overflow-hidden">
        {/* Decorative ambient blobs */}
        <div className="absolute top-0 right-0 h-40 w-40 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 h-32 w-32 bg-indigo-400/20 rounded-full blur-2xl" />

        <div className="relative z-10 max-w-2xl">
          <span className="bg-white/20 text-white font-semibold text-xs px-3 py-1 rounded-full border border-white/10 tracking-widest uppercase">
            AI Duolingo Edition
          </span>
          <h1 className="text-3xl font-black tracking-tight mt-3 mb-2">
            Build Deeper AI Foundations
          </h1>
          <p className="text-indigo-100 text-sm leading-relaxed max-w-lg">
            Pick a core concept, study a focused micro-lesson, solve adaptive quiz challenges, and reinforce your knowledge through a direct Socratic dialogue.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Main Concept Selection and Custom input */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <BookOpen className="text-indigo-500 h-5 w-5" />
              Select Learning Pathway
            </h2>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search tracks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-xl px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-100 w-40"
              />
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">
                {filteredConcepts.length} Tracks
              </span>
            </div>
          </div>

          {/* Preset topics grid */}
          {searchTerm.trim() ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
              {filteredConcepts.map((concept) => {
                const isCompleted = completedConcepts.includes(concept.id);
                const isLocked = (concept.prereqs || []).some(id => !completedConcepts.includes(id));
                const missingPrereqs = (concept.prereqs || []).filter(id => !completedConcepts.includes(id));
                const missingPrereqNames = missingPrereqs.map(id => DEFAULT_CONCEPTS.find(c => c.id === id)?.name || id);

                return (
                  <button
                    key={concept.id}
                    disabled={isLoading}
                    onClick={() => onSelectConcept(concept.name, concept.difficulty, [], "search")}
                    className={`group text-left border rounded-2xl p-5 hover:shadow-md transition-all duration-300 relative overflow-hidden ${
                      isCompleted
                        ? "bg-emerald-50/45 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-800/40 hover:bg-emerald-50/60"
                        : isLocked
                        ? "bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 opacity-90"
                        : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/80 hover:border-indigo-100 hover:bg-slate-50/20"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <span className="text-3xl bg-slate-50 dark:bg-slate-800 p-2.5 rounded-2xl group-hover:scale-110 transition-transform">
                        {concept.emoji}
                      </span>
                      <div className="flex gap-1.5 flex-col items-end">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            concept.difficulty === "Beginner"
                              ? "bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400"
                              : concept.difficulty === "Intermediate"
                              ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400"
                              : "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400"
                          }`}
                        >
                          {concept.difficulty}
                        </span>
                        {isCompleted && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full">
                            Completed ✓
                          </span>
                        )}
                        {!isCompleted && isLocked && (
                          <span className="text-[10px] bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            🔐 Locked
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm group-hover:text-indigo-600 transition-colors mb-1.5">
                      {concept.name}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs line-clamp-2 leading-relaxed mb-3">
                      {concept.description}
                    </p>

                    {isLocked && missingPrereqNames.length > 0 && (
                      <div className="text-[9px] text-slate-400 mb-3 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800/50 leading-tight">
                        <strong>Prerequisites:</strong> {missingPrereqNames.join(", ")}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mt-2 border-t border-slate-50 dark:border-slate-800/50 pt-3">
                      <span>{concept.estimatedTime}</span>
                      <span className="text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                        Start Lesson <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-12">
              {[
                { level: 1, title: "Level 1 — Foundations", desc: "No prerequisites needed. Grasp prompt engineering, system roles, chunking, and generative probability." },
                { level: 2, title: "Level 2 — Semantic Foundations", desc: "Unlock semantic indexing with high-dimensional embeddings, external context, and vector DB stores." },
                { level: 3, title: "Level 3 — Autonomy & Agency", desc: "Progress into action-oriented systems with function calling and multi-agent loops." },
                { level: 4, title: "Level 4 — Production Evals & Metrics", desc: "Optimize your systems with programmatic diagnostics, speculative latency, and strategy roadmaps." }
              ].map((levelGroup) => {
                const levelConcepts = DEFAULT_CONCEPTS.filter(c => c.level === levelGroup.level);
                return (
                  <div key={levelGroup.level} className="space-y-4">
                    {/* Level Header banner */}
                    <div className="border-l-4 border-indigo-500 pl-4 py-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-lg">
                          Level {levelGroup.level}
                        </span>
                        <h3 className="text-md font-extrabold text-slate-800 dark:text-slate-100">
                          {levelGroup.title}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                        {levelGroup.desc}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {levelConcepts.map((concept) => {
                        const isCompleted = completedConcepts.includes(concept.id);
                        const isLocked = (concept.prereqs || []).some(id => !completedConcepts.includes(id));
                        const missingPrereqs = (concept.prereqs || []).filter(id => !completedConcepts.includes(id));
                        const missingPrereqNames = missingPrereqs.map(id => DEFAULT_CONCEPTS.find(c => c.id === id)?.name || id);

                        return (
                          <button
                            key={concept.id}
                            disabled={isLoading}
                            onClick={() => {
                              if (isLocked) {
                                const confirmStart = window.confirm(`Heads up! You haven't completed the recommended prerequisites for this topic: ${missingPrereqNames.join(", ")}.\n\nWould you like to start anyway?`);
                                if (!confirmStart) return;
                              }
                              onSelectConcept(concept.name, concept.difficulty, [], "curriculum_map");
                            }}
                            className={`group text-left border rounded-2xl p-5 hover:indigo-50 hover:shadow-md transition-all duration-300 relative overflow-hidden ${
                              isCompleted
                                ? "bg-emerald-50/45 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-800/40 hover:bg-emerald-50/60"
                                : isLocked
                                ? "bg-slate-50/30 dark:bg-slate-900/10 border-slate-100/50 dark:border-slate-800/45 hover:border-indigo-100/40"
                                : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/80 hover:border-indigo-100 hover:bg-slate-50/20"
                            }`}
                          >
                            <div className="flex items-start justify-between mb-4">
                              <span className={`text-3xl bg-slate-50 dark:bg-slate-800 p-2.5 rounded-2xl group-hover:scale-110 transition-transform ${isLocked ? "grayscale opacity-80" : ""}`}>
                                {concept.emoji}
                              </span>
                              <div className="flex gap-1.5 flex-col items-end">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    concept.difficulty === "Beginner"
                                      ? "bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400"
                                      : concept.difficulty === "Intermediate"
                                      ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400"
                                      : "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400"
                                  }`}
                                >
                                  {concept.difficulty}
                                </span>
                                {isCompleted && (
                                  <span className="text-[10px] bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full">
                                    Completed ✓
                                  </span>
                                )}
                                {!isCompleted && isLocked && (
                                  <span className="text-[10px] bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                    🔐 Locked
                                  </span>
                                )}
                              </div>
                            </div>

                            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm group-hover:text-indigo-600 transition-colors mb-1.5 flex items-center gap-1.5">
                              {concept.name}
                              {!isCompleted && isLocked && <span className="text-slate-400"><Lock className="h-3 w-3 inline" /></span>}
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 text-xs line-clamp-2 leading-relaxed mb-3">
                              {concept.description}
                            </p>

                            {isLocked && missingPrereqNames.length > 0 && (
                              <div className="text-[9px] text-slate-400 dark:text-slate-500 mb-3 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800/50 leading-tight">
                                <strong>Requires:</strong> {missingPrereqNames.join(", ")}
                              </div>
                            )}

                            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mt-2 border-t border-slate-50 dark:border-slate-800/50 pt-3">
                              <span>{concept.estimatedTime}</span>
                              <span className="text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                Start Lesson <ArrowRight className="h-3 w-3" />
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Dynamic AI Custom Prompt input */}
          <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="text-indigo-500 h-4 w-4 animate-slow-spin" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Study an Custom AI Concept On-Demand
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Enter any precise sub-concept (e.g. "DPO Alignment", "Residual Connections", "Precision vs Recall") and the AI Tutor will assemble a personalized deck of lessons and quizzes for you.
            </p>

            <form onSubmit={handleSubmitCustom} className="space-y-4">
              <div className="flex flex-col md:flex-row gap-3">
                <input
                  type="text"
                  disabled={isLoading}
                  value={customConcept}
                  onChange={(e) => setCustomConcept(e.target.value)}
                  placeholder="e.g. Retrieval-Augmented Generation (RAG), Diffusion Models..."
                  className="flex-1 rounded-xl px-4 py-2.5 text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-100"
                />

                {/* Difficulty selector */}
                <select
                  disabled={isLoading}
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  className="rounded-xl px-3 py-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none text-slate-800 dark:text-slate-100 font-medium"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>

              {/* Target Previous mistakes / Pre-existing Misconceptions */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  ⚡ Target Previous Mistakes & Weak Areas (Optional)
                </label>
                <input
                  type="text"
                  disabled={isLoading}
                  value={previousMistakesInput}
                  onChange={(e) => setPreviousMistakesInput(e.target.value)}
                  placeholder="e.g. confused RAG with fine-tuning, thought embeddings are only for images"
                  className="w-full rounded-xl px-4 py-2.5 text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-100"
                />
                
                {/* Dynamic mistake suggest chips */}
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  <span className="text-[9px] text-slate-400 font-semibold self-center mr-1">Tap to insert:</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!customConcept) {
                        setCustomConcept("Retrieval-Augmented Generation (RAG)");
                        setDifficulty("Intermediate");
                      }
                      handleApplyPresetMistake("confused RAG with fine-tuning");
                    }}
                    className="text-[9px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 px-2 py-1 rounded-full text-slate-600 font-medium transition-colors"
                  >
                    + confused RAG with fine-tuning
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!customConcept) {
                        setCustomConcept("Retrieval-Augmented Generation (RAG)");
                        setDifficulty("Intermediate");
                      }
                      handleApplyPresetMistake("thought embeddings are only for images");
                    }}
                    className="text-[9px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 px-2 py-1 rounded-full text-slate-600 font-medium transition-colors"
                  >
                    + thought embeddings are only for images
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetMistake("confused training vs inference")}
                    className="text-[9px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 px-2 py-1 rounded-full text-slate-600 font-medium transition-colors"
                  >
                    + training vs inference
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isLoading || !customConcept.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-bold text-xs px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow w-full sm:w-auto"
                >
                  {isLoading ? "Assembling Core..." : "Generate Custom Deck"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right 1 Col: Session Logs / History */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <History className="text-slate-500 h-5 w-5" />
            Socratic Mastery Records
          </h2>

          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm max-h-[500px] overflow-y-auto">
            {sessionLogs.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Star className="h-8 w-8 text-slate-200 dark:text-slate-800 mx-auto mb-2.5" />
                <p className="text-xs font-semibold">No finished credentials yet</p>
                <p className="text-[10px] text-slate-400 mt-1">Conclude your first Socratic evaluation to receive a certified score badge.</p>
              </div>
            ) : (
              sessionLogs.map((log, idx) => {
                let ratingColor = "bg-slate-100 text-slate-700";
                if (log.rating?.includes("Diamond")) {
                  ratingColor = "bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30 font-bold animate-shimmer";
                } else if (log.rating?.includes("Gold")) {
                  ratingColor = "bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30 font-bold";
                } else if (log.rating?.includes("Silver")) {
                  ratingColor = "bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30";
                }

                return (
                  <div
                    key={idx}
                    className="border-b border-slate-50 dark:border-slate-800 pb-4 last:border-0 last:pb-0 text-left"
                  >
                    <div className="flex items-start justify-between gap-1 mb-1.5">
                      <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs max-w-[70%]">
                        {log.concept_name || log.conceptName}
                      </h4>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full ${ratingColor}`}>
                        {log.rating}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-slate-400 mb-2">
                      <span>Quiz Score: <strong className="text-slate-600 dark:text-slate-300 font-semibold">{log.quiz_score || log.quizScore}/3</strong></span>
                      <span>Dialogue Grade: <strong className="text-slate-600 dark:text-slate-300 font-semibold">{log.feedback ? "Graded" : "Incomplete"}</strong></span>
                    </div>

                    {log.feedback && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 p-2 rounded-lg bg-slate-50 dark:bg-slate-950 leading-relaxed border border-slate-100 dark:border-slate-800/80 line-clamp-3">
                        {log.feedback}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
