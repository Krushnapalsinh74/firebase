import React from "react";
import type { QuestionState } from "../store/examStore";
import type { Question } from "../api/studentApi";

const STATE_CONFIG: Record<QuestionState, { bg: string; label: string }> = {
  NOT_VISITED: { bg: "bg-[#6b7280] text-white", label: "Not Visited" },
  NOT_ANSWERED: { bg: "bg-[#dc2626] text-white", label: "Not Answered" },
  ANSWERED: { bg: "bg-[#16a34a] text-white", label: "Answered" },
  MARKED_FOR_REVIEW: { bg: "bg-[#d97706] text-white", label: "Marked for Review" },
  ANSWERED_AND_MARKED: { bg: "bg-[#7c3aed] text-white", label: "Answered + Marked" },
};

interface QuestionPaletteProps {
  questions: Question[];
  currentIndex: number;
  getState: (qId: number) => QuestionState;
  onNavigate: (index: number) => void;
  answeredCount: number;
  notAnsweredCount: number;
  markedCount: number;
  notVisitedCount: number;
  onSubmit?: () => void;
  sessionType?: "practice" | "mock";
}

export function QuestionPalette({
  questions,
  currentIndex,
  getState,
  onNavigate,
  answeredCount,
  notAnsweredCount,
  markedCount,
  notVisitedCount,
  onSubmit,
  sessionType = "mock",
}: QuestionPaletteProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Legend */}
      <div className="p-4 border-b border-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Question Status</p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(STATE_CONFIG) as [QuestionState, { bg: string; label: string }][]).map(([state, cfg]) => (
            <div key={state} className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${cfg.bg}`}>
                {state === "ANSWERED" ? answeredCount :
                 state === "NOT_ANSWERED" ? notAnsweredCount :
                 state === "MARKED_FOR_REVIEW" ? markedCount :
                 state === "NOT_VISITED" ? notVisitedCount : ""}
              </div>
              <span className="text-xs text-muted-foreground leading-tight">{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Question numbers grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-5 gap-2">
          {questions.map((q, idx) => {
            const state = getState(q.id);
            const cfg = STATE_CONFIG[state];
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={q.id}
                onClick={() => onNavigate(idx)}
                className={`
                  w-full aspect-square rounded-md text-xs font-semibold
                  flex items-center justify-center transition-all
                  ${cfg.bg}
                  ${isCurrent ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:opacity-80"}
                `}
                title={`Question ${idx + 1}: ${cfg.label}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit button */}
      {onSubmit && (
        <div className="p-4 border-t border-border">
          <button
            onClick={onSubmit}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            {sessionType === "mock" ? "Submit Test" : "Finish Practice"}
          </button>
        </div>
      )}
    </div>
  );
}
