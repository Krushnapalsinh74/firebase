import React, { useState } from "react";
import { MathText } from "@/lib/math-text";
import type { Question } from "../api/studentApi";

interface QuestionRendererProps {
  question: Question;
  className?: string;
}

export function QuestionRenderer({ question, className = "" }: QuestionRendererProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Question text */}
      <div className="text-base leading-relaxed text-foreground font-medium">
        <MathText text={question.question} block />
      </div>

      {/* Question image */}
      {question.imageUrl && !imgError && (
        <div className="flex justify-center">
          {!imgLoaded && (
            <div className="w-full max-w-md h-40 rounded-lg bg-muted animate-pulse" />
          )}
          <img
            src={question.imageUrl}
            alt="Question diagram"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={`max-w-full max-h-64 object-contain rounded-lg border border-border ${imgLoaded ? "block" : "hidden"}`}
          />
        </div>
      )}
    </div>
  );
}

interface OptionsProps {
  question: Question;
  selectedAnswer: string | string[] | undefined;
  onSelect: (answer: string | string[]) => void;
  showResult?: boolean;
  disabled?: boolean;
}

export function QuestionOptions({ question, selectedAnswer, onSelect, showResult = false, disabled = false }: OptionsProps) {
  const { questionType, options, correctAnswer } = question;

  const isSelected = (opt: string): boolean => {
    if (!selectedAnswer) return false;
    if (Array.isArray(selectedAnswer)) return selectedAnswer.includes(opt);
    return selectedAnswer === opt;
  };

  const isCorrect = (opt: string): boolean => {
    if (!correctAnswer) return false;
    if (correctAnswer.includes(",")) return correctAnswer.split(",").map((s) => s.trim()).includes(opt);
    return correctAnswer.trim() === opt;
  };

  if (questionType === "NUMERICAL") {
    const val = Array.isArray(selectedAnswer) ? selectedAnswer[0] ?? "" : selectedAnswer ?? "";
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Enter numerical answer:</label>
        <input
          type="number"
          value={val}
          disabled={disabled}
          onChange={(e) => !disabled && onSelect(e.target.value)}
          className="w-full max-w-xs px-4 py-3 rounded-lg border border-border bg-background text-foreground text-lg font-mono focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Type your answer"
        />
        {showResult && correctAnswer && (
          <p className="text-sm text-muted-foreground">
            Correct answer: <span className="font-semibold text-green-600">{correctAnswer}</span>
          </p>
        )}
      </div>
    );
  }

  const opts =
    questionType === "TRUE_FALSE"
      ? ["True", "False"]
      : options ?? [];

  return (
    <div className="space-y-3">
      {opts.map((opt, idx) => {
        const sel = isSelected(opt);
        const corr = showResult && isCorrect(opt);
        const wrong = showResult && sel && !corr;

        let base =
          "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all duration-150 select-none";
        if (disabled) base += " cursor-default";
        if (corr) base += " border-green-500 bg-green-50 dark:bg-green-950/30";
        else if (wrong) base += " border-red-400 bg-red-50 dark:bg-red-950/30";
        else if (sel) base += " border-primary bg-primary/8";
        else base += " border-border hover:border-primary/40 hover:bg-muted/60";

        const handleClick = () => {
          if (disabled) return;
          if (questionType === "MULTIPLE_CHOICE") {
            const current = Array.isArray(selectedAnswer) ? [...selectedAnswer] : [];
            const idx2 = current.indexOf(opt);
            if (idx2 >= 0) current.splice(idx2, 1);
            else current.push(opt);
            onSelect(current);
          } else {
            onSelect(opt);
          }
        };

        return (
          <div key={idx} className={base} onClick={handleClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && handleClick()}>
            <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold mt-0.5 ${sel || corr ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 text-muted-foreground"} ${corr && !sel ? "border-green-500 bg-green-500 text-white" : ""}`}>
              {String.fromCharCode(65 + idx)}
            </div>
            <div className="flex-1 text-sm leading-relaxed">
              <MathText text={opt} />
            </div>
            {corr && (
              <span className="text-green-600 text-xs font-semibold mt-0.5">✓ Correct</span>
            )}
            {wrong && (
              <span className="text-red-500 text-xs font-semibold mt-0.5">✗ Wrong</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
