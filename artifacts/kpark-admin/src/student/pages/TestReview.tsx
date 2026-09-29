
import React, { useState } from 'react';
import { CheckCircle2, XCircle, MinusCircle, Bookmark, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { QuestionRenderer, QuestionOptions } from '../components/QuestionRenderer';
import { MathText } from '@/lib/math-text';
import type { SessionResults } from './PracticeSession';

interface TestReviewProps {
  results: SessionResults;
  onBack: () => void;
}

type ReviewFilter = 'all' | 'correct' | 'incorrect' | 'skipped' | 'marked';

export function TestReview({ results, onBack }: TestReviewProps) {
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { questions, answers, markedForReview } = results;

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
  const marked = questions.filter((q) => markedForReview[q.id]).length;

  const FILTERS: { key: ReviewFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: questions.length },
    { key: 'correct', label: 'Correct', count: correct },
    { key: 'incorrect', label: 'Incorrect', count: incorrect },
    { key: 'skipped', label: 'Skipped', count: skipped },
    { key: 'marked', label: 'Marked', count: marked },
  ];

  const filtered = questions.filter((q) => {
    if (filter === 'marked') return markedForReview[q.id];
    if (filter === 'all') return true;
    return getResult(q) === filter;
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Answer Review</h1>
          <p className="text-xs text-muted-foreground">{results.testTitle}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${filter === f.key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/30'}`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Questions */}
      <div className="space-y-3">
        {filtered.map((q, idx) => {
          const res = getResult(q);
          const isExpanded = expandedId === q.id;
          const ans = answers[q.id];
          const isMarked = markedForReview[q.id];

          let borderColor = 'border-border';
          if (res === 'correct') borderColor = 'border-green-200 dark:border-green-800';
          if (res === 'incorrect') borderColor = 'border-red-200 dark:border-red-800';

          return (
            <div key={q.id} className={`border rounded-xl overflow-hidden ${borderColor}`}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : q.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/20 transition-colors"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${res === 'correct' ? 'bg-green-100 text-green-600' : res === 'incorrect' ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-400'}`}>
                  {questions.indexOf(q) + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground line-clamp-2">{q.question?.replace(/\$[^$]+\$/g, '[eq]').slice(0, 100)}...</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isMarked && <Bookmark className="w-3.5 h-3.5 text-amber-500" />}
                  {res === 'correct' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                  {res === 'incorrect' && <XCircle className="w-4 h-4 text-red-500" />}
                  {res === 'skipped' && <MinusCircle className="w-4 h-4 text-gray-400" />}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-5 border-t border-border space-y-4">
                  <div className="pt-4">
                    <QuestionRenderer question={q} />
                    <div className="mt-4">
                      <QuestionOptions question={q} selectedAnswer={ans} onSelect={() => {}} showResult disabled />
                    </div>
                  </div>
                  {q.explanation && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">Explanation</p>
                      <div className="text-sm text-foreground"><MathText text={q.explanation} block /></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">No questions in this category.</div>
        )}
      </div>
    </div>
  );
}
