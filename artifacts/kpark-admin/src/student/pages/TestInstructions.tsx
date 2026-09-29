
import React from 'react';
import { Clock, BookOpen, AlertTriangle, CheckCircle2, ArrowLeft } from 'lucide-react';
import type { MockTest } from '../api/studentApi';

interface TestInstructionsProps {
  test: MockTest;
  onStart: () => void;
  onBack: () => void;
}

export function TestInstructions({ test, onStart, onBack }: TestInstructionsProps) {
  const title = test.title ?? test.name ?? `Test #${test.id}`;
  const qCount = test.questionCount ?? test.questions?.length ?? 0;
  const marks = test.totalMarks ?? (qCount * 4);
  const duration = test.durationMinutes ?? Math.ceil(qCount * 1.5);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Tests
      </button>

      {/* Test header */}
      <div className="border border-border rounded-xl p-6 bg-card space-y-4">
        <h1 className="text-xl font-bold text-foreground">{title}</h1>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Questions', value: qCount || '—', icon: BookOpen },
            { label: 'Total Marks', value: marks || '—', icon: CheckCircle2 },
            { label: 'Duration', value: duration ? `${duration} min` : '—', icon: Clock },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="text-center p-3 rounded-lg bg-muted/40 border border-border">
              <Icon className="w-4 h-4 mx-auto mb-1 text-primary" />
              <p className="text-lg font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="border border-border rounded-xl p-6 bg-card space-y-4">
        <h2 className="font-bold text-foreground">General Instructions</h2>
        <ul className="space-y-3 text-sm text-muted-foreground">
          {[
            'The test will begin immediately after you click the Start Test button.',
            'The timer starts when you click Start Test and cannot be paused.',
            'You can navigate between questions using the Question Palette on the right.',
            'Click Save & Next to save your answer and proceed to the next question.',
            'Click Mark for Review to flag a question for later review.',
            'Click Clear Response to undo your selected answer.',
            'Clicking a question number in the palette navigates directly to that question.',
            'Your answers are auto-saved. Refreshing the page will restore your session.',
            'The test will auto-submit when the timer reaches zero.',
          ].map((inst, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
              {inst}
            </li>
          ))}
        </ul>
      </div>

      {/* Marking scheme */}
      <div className="border border-amber-200 dark:border-amber-800 rounded-xl p-5 bg-amber-50 dark:bg-amber-950/20">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <h2 className="font-semibold text-amber-800 dark:text-amber-400 text-sm">Marking Scheme</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Correct Answer</span>
            <span className="font-semibold text-green-600">+4</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Wrong Answer</span>
            <span className="font-semibold text-red-500">-1</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Unanswered</span>
            <span className="font-semibold text-muted-foreground">0</span>
          </div>
        </div>
      </div>

      {/* Question state legend */}
      <div className="border border-border rounded-xl p-5 bg-card">
        <h2 className="font-semibold text-foreground mb-4 text-sm">Question Palette Legend</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { color: 'bg-[#16a34a]', label: 'Answered' },
            { color: 'bg-[#dc2626]', label: 'Not Answered' },
            { color: 'bg-[#6b7280]', label: 'Not Visited' },
            { color: 'bg-[#d97706]', label: 'Marked for Review' },
            { color: 'bg-[#7c3aed]', label: 'Answered + Marked' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded text-white text-xs font-bold flex items-center justify-center ${item.color}`}>1</div>
              <span className="text-muted-foreground text-xs">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onStart}
        className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:bg-primary/90 transition-colors"
      >
        Start Test →
      </button>
    </div>
  );
}
