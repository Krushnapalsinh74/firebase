
import React from 'react';
import { CheckCircle2, XCircle, MinusCircle, Clock, Home, BookOpen, BarChart3 } from 'lucide-react';
import type { SessionResults } from './PracticeSession';

interface TestResultProps {
  results: SessionResults;
  onReview: () => void;
  onHome: () => void;
}

export function TestResult({ results, onReview, onHome }: TestResultProps) {
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
  const score = correct * 4 - incorrect * 1;
  const maxMarks = questions.length * 4;
  const percentage = maxMarks > 0 ? Math.round((score / maxMarks) * 100) : 0;
  const totalTime = Object.values(results.timeSpentPerQuestion).reduce((a, b) => a + b, 0);
  const mins = Math.floor(totalTime / 60);
  const secs = totalTime % 60;

  const pct = Math.max(0, percentage);
  const scoreColor = pct >= 70 ? 'text-green-600' : pct >= 40 ? 'text-amber-500' : 'text-red-500';

  // Subject-wise breakdown
  const subjectMap: Record<string, { correct: number; total: number; name: string }> = {};
  questions.forEach((q) => {
    const sId = String(q.subjectId ?? 'Other');
    const sName = q.subjectName ?? 'Other';
    if (!subjectMap[sId]) subjectMap[sId] = { correct: 0, total: 0, name: sName };
    subjectMap[sId].total++;
    if (getResult(q) === 'correct') subjectMap[sId].correct++;
  });
  const subjectBreakdown = Object.values(subjectMap).filter((s) => s.total > 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Score hero */}
      <div className="text-center py-8 border border-border rounded-2xl bg-card">
        <p className="text-sm text-muted-foreground font-medium">{results.testTitle ?? 'Test Result'}</p>
        <div className="mt-4">
          <span className={`text-6xl font-bold ${scoreColor}`}>{score}</span>
          <span className="text-2xl text-muted-foreground font-medium"> / {maxMarks}</span>
        </div>
        <p className={`text-lg font-bold mt-1 ${scoreColor}`}>{pct}%</p>
        <p className="text-sm text-muted-foreground mt-2">
          {pct >= 70 ? '🎉 Excellent performance!' : pct >= 40 ? '📈 Keep practicing!' : '💪 More practice needed.'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Correct', value: correct, icon: CheckCircle2, color: 'text-green-600 bg-green-50 dark:bg-green-950/30' },
          { label: 'Incorrect', value: incorrect, icon: XCircle, color: 'text-red-500 bg-red-50 dark:bg-red-950/30' },
          { label: 'Unanswered', value: skipped, icon: MinusCircle, color: 'text-gray-400 bg-gray-50 dark:bg-gray-900/50' },
          { label: 'Time Used', value: `${mins}m ${secs}s`, icon: Clock, color: 'text-primary bg-primary/10' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="p-4 rounded-xl border border-border bg-card text-center">
            <Icon className={`w-5 h-5 mx-auto mb-2 ${color.split(' ')[0]}`} />
            <p className="text-xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Subject breakdown */}
      {subjectBreakdown.length > 0 && (
        <div className="border border-border rounded-xl p-5 bg-card space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground">Subject Performance</h2>
          </div>
          <div className="space-y-3">
            {subjectBreakdown.map((sub) => {
              const pct = sub.total > 0 ? Math.round((sub.correct / sub.total) * 100) : 0;
              return (
                <div key={sub.name}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-foreground">{sub.name}</span>
                    <span className="text-muted-foreground">{sub.correct}/{sub.total} · {pct}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onHome} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted">
          <Home className="w-4 h-4" /> Dashboard
        </button>
        <button onClick={onReview} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">
          <BookOpen className="w-4 h-4" /> Review Answers
        </button>
      </div>
    </div>
  );
}
