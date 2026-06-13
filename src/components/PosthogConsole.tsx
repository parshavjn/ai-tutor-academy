import React, { useEffect, useState } from "react";
import { Terminal, Activity, ChevronDown, ChevronUp, Radio } from "lucide-react";
import { getPostHogLogs, subscribeToPostHogLogs, LoggedEvent } from "../lib/posthog";

export function PosthogConsole() {
  const [logs, setLogs] = useState<LoggedEvent[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    // Sync initial logs
    setLogs(getPostHogLogs());

    // Subscribe to new incoming logs
    const unsubscribe = subscribeToPostHogLogs((newLogs) => {
      setLogs(newLogs);
    });

    return unsubscribe;
  }, []);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden transition-all duration-300">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800 hover:bg-slate-900/60 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <Terminal className="h-4 w-4 text-amber-500 animate-pulse" />
          <span className="font-mono text-xs font-bold text-slate-200 tracking-wide uppercase">
            PostHog Event Stream Panel
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-500/10 text-indigo-400 font-mono px-2 py-0.5 rounded-full border border-indigo-500/20">
            <Radio className="h-2.5 w-2.5 text-indigo-400 animate-pulse" /> Live Funnel Tracking
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {/* Expanded Logs Body */}
      {isOpen && (
        <div className="p-4 bg-slate-950 font-mono text-[11px] h-60 overflow-y-auto space-y-2.5 custom-scrollbar">
          {logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center py-8">
              <Activity className="h-8 w-8 text-slate-700 mb-2 animate-pulse" />
              <p>Waiting for learner events...</p>
              <p className="text-[10px] text-slate-600 mt-1 max-w-[280px]">
                Events capture your study funnel: from lesson selection to quiz solutions and Socratic graduation.
              </p>
            </div>
          ) : (
            logs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              let badgeColor = "bg-sky-500/10 text-sky-400 border-sky-500/20";
              
              if (log.eventName.includes("completed") || log.eventName.includes("graduated")) {
                badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
              } else if (log.eventName.includes("start")) {
                badgeColor = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
              } else if (log.eventName.includes("answered")) {
                badgeColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
              }

              return (
                <div
                  key={log.id}
                  onClick={(e) => toggleExpand(log.id, e)}
                  className="group bg-slate-900 hover:bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${badgeColor}`}>
                        {log.eventName}
                      </span>
                      <span className="text-slate-500 text-[10px]">{log.timestamp}</span>
                    </div>
                    <div className="flex items-center gap-1.5 label text-slate-400 group-hover:text-indigo-400 transition-colors">
                      <span className="text-[10px]">properties</span>
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </div>
                  </div>

                  {/* Summary row */}
                  {!isExpanded && (
                    <p className="text-slate-400 text-[10px] mt-1.5 truncate border-t border-slate-800/30 pt-1">
                      {log.properties.concept_name ? `Topic: ${log.properties.concept_name} | ` : ""}
                      {log.properties.xp_earned ? `Earned: +${log.properties.xp_earned} XP | ` : ""}
                      {log.properties.score_percentage !== undefined ? `Quiz: ${log.properties.score_percentage}% | ` : ""}
                      {log.properties.evaluation_rating ? `Rating: ${log.properties.evaluation_rating} | ` : ""}
                      {JSON.stringify(log.properties)}
                    </p>
                  )}

                  {/* Detailed inspector block */}
                  {isExpanded && (
                    <div className="mt-2.5 border-t border-slate-800 pt-2.5 transition-all">
                      <pre className="text-emerald-400 overflow-x-auto bg-slate-950 p-2 rounded text-[10px] leading-tight max-h-40">
                        {JSON.stringify(log.properties, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
