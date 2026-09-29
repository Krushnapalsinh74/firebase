
import React, { useState } from 'react';
import { CheckCircle2, XCircle, MinusCircle, Target, Clock, RotateCcw, Home, ChevronDown, ChevronUp } from 'lucide-react';
import { QuestionRenderer, QuestionOptions } from '../components/QuestionRenderer';
import { MathText } from '@/lib/math-text';
import type { SessionResults } from './PracticeSession';

interface PracticeResultProps {
  results: SessionResults;
  onPracticeAgain: () => void;
  onHome: () => void;
}

type ReviewFilter = 'all' | 'correct' | 'incorrect' | 'skipped';

export function PracticeResult({ results, onPracticeAgain, onHome }: PracticeResultProps) {
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { questions, answers } = results;

  const getResult = (q: any) => {
    const ans = answers[q.id];
    const answered = ans !== undefined && (Array.isArray(ans) ? ans.length > 0 : ans !== '');
    if (!answered) return 'skipped';
    const sel = Array.isArray(ans) ? [...ans].sort().join(',') : String(ans);
    const correct = q.correctAnswer ? (q.correctAnswer.includes(',')
      ? q.correctAnswer.split(',').map((s: string) => s.trim()).sort().join(',') === sel
      : q.correctAnswer.trim() === sel) : false;
    return correct ? 'correct' : 'incorrect';
  };

  const correct = questions.filter((q) => getResult(q) === 'correct').length;
  const incorrect = questions.filter((q) => getResult(q) === 'incorrect').length;
  const skipped = questions.filter((q) => getResult(q) === 'skipped').length;
  const accuracy = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
  const totalTime = Object.values(results.timeSpentPerQuestion).reduce((a, b) => a + b, 0);

  const filtered = questions.filter((q) => {
    if (filter === 'all') return true;
    return getResult(q) === filter;
  });

  const FILTERS: { key: ReviewFilter; label: string; count: number; color: string }[] = [
    { key: 'all', label: 'All', count: questions.length, color: 'text-foreground' },
    { key: 'correct', label: 'Correct', count: correct, color: 'text-green-600' },
    { key: 'incorrect', label: 'Incorrect', count: incorrect, color: 'text-red-500' },
    { key: 'skipped', label: 'Skipped', count: skipped, color: 'text-muted-foreground' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      {/* Score Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-4 border-primary/30 bg-primary/10 mb-4">
          <span className="text-2xl font-bold text-primary">{accuracy}%</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Practice Complete!</h1>
        <p className="text-muted-foreground mt-1">{results.testTitle ?? 'Practice Session'}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Correct', value: correct, icon: CheckCircle2, color: 'text-green-600 bg-green-50 dark:bg-green-950/30' },
          { label: 'Incorrect', value: incorrect, icon: XCircle, color: 'text-red-500 bg-red-50 dark:bg-red-950/30' },
          { label: 'Skipped', value: skipped, icon: MinusCircle, color: 'text-gray-400 bg-gray-50 dark:bg-gray-950/30' },
          { label: 'Time', value: `${Math.floor(totalTime / 60)}m`, icon: Clock, color: 'text-primary bg-primary/10' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="p-4 rounded-xl border border-border bg-card text-center">
            <Icon className={`w-5 h-5 mx-auto mb-2 ${color.split(' ')[0]}`} />
            <p className="text-xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onHome} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
          <Home className="w-4 h-4" /> Dashboard
        </button>
        <button onClick={onPracticeAgain} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
          <RotateCcw className="w-4 h-4" /> Practice Again
        </button>
      </div>

      {/* Review Section */}
      <div>
        <h2 className="text-base font-bold text-foreground mb-4">Question Review</h2>
        {/* Filters */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${filter === f.key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/30'}`}
            >
              {f.label} <span className={`ml-1 ${f.color}`}>({f.count})</span>
            </button>
          ))}
        </div>

        {/* Question list */}
        <div className="space-y-3">
          {filtered.map((q, idx) => {
            const res = getResult(q);
            const isExpanded = expandedId === q.id;
            const ans = answers[q.id];

            return (
              <div key={q.id} className={`border rounded-xl overflow-hidden transition-colors ${res === 'correct' ? 'border-green-200 dark:border-green-800' : res === 'incorrect' ? 'border-red-200 dark:border-red-800' : 'border-border'}`}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : q.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${res === 'correct' ? 'bg-green-100 text-green-600' : res === 'incorrect' ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-400'}`}>
                    {idx + 1}
                  </div>
                  <p className="text-sm font-medium text-foreground flex-1 line-clamp-2 text-left">{q.question?.replace(/\$[^$]+\$/g, '[math]').slice(0, 120)}...</p>
                  <div className="flex items-center gap-2">
                    {res === 'correct' && <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />}
                    {res === 'incorrect' && <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                    {res === 'skipped' && <MinusCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-5 space-y-4 border-t border-border">
                    <div className="pt-4">
                      <QuestionRenderer question={q} />
                      <div className="mt-4">
                        <QuestionOptions
                          question={q}
                          selectedAnswer={ans}
                          onSelect={() => {}}
                          showResult={true}
                          disabled={true}
                        />
                      </div>
                    </div>

                    {q.explanation && (
                      <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-2">Explanation</p>
                        <div className="text-sm text-foreground">
                          <MathText text={q.explanation} block />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
