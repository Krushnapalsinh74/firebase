
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Bookmark, RotateCcw, Flag, Menu } from 'lucide-react';
import { useExamStore } from '../store/examStore';
import { studentApi } from '../api/studentApi';
import { useStudentStore } from '@/hooks/use-student-store';
import { QuestionRenderer, QuestionOptions } from '../components/QuestionRenderer';
import { QuestionPalette } from '../components/QuestionPalette';
import { ExamTimer } from '../components/ExamTimer';
import type { PracticeConfig } from './PracticePage';

interface PracticeSessionProps {
  config: PracticeConfig;
  onFinish: (results: SessionResults) => void;
  onExit: () => void;
}

export interface SessionResults {
  questions: any[];
  answers: Record<number, string | string[]>;
  markedForReview: Record<number, boolean>;
  timeSpentPerQuestion: Record<number, number>;
  sessionType: 'practice' | 'mock';
  testTitle?: string;
}

type SubmitDialogState = 'none' | 'confirm';

export function PracticeSession({ config, onFinish, onExit }: PracticeSessionProps) {
  const { session, startSession, setCurrentIndex, setAnswer, clearAnswer, toggleMarkForReview,
    tickTimer, markSubmitted, getQuestionState, getAnsweredCount, getNotAnsweredCount,
    getMarkedCount, getNotVisitedCount, markVisited, addTimeSpent } = useExamStore();
  const { student, token } = useStudentStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitState, setSubmitState] = useState<SubmitDialogState>('none');
  const [showPalette, setShowPalette] = useState(false);
  const questionStartTime = useRef<number>(Date.now());
  const submittedAttempts = useRef<Set<number>>(new Set());

  // Load questions on mount
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await studentApi.getQuestions({
          subjectId: config.subjectId,
          chapterId: config.chapterId,
          topicId: config.topicId,
          difficulty: config.difficulty,
          questionType: config.questionType,
          lang: config.lang,
          limit: config.limit,
          page: 1,
        });
        if (!res.data || res.data.length === 0) {
          setError('No questions found for this selection. Try different filters.');
          setLoading(false);
          return;
        }
        const sessionTitle = [config.subjectName, config.chapterName, config.topicName].filter(Boolean).join(' · ');
        startSession('practice', res.data, 0, { testTitle: sessionTitle, subjectId: config.subjectId, chapterId: config.chapterId, topicId: config.topicId });
      } catch (e: any) {
        setError(e.message ?? 'Failed to load questions.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Track time on question change
  useEffect(() => {
    if (!session) return;
    const qId = session.questions[session.currentIndex]?.id;
    if (!qId) return;
    questionStartTime.current = Date.now();
    markVisited(qId);
    return () => {
      const spent = Math.round((Date.now() - questionStartTime.current) / 1000);
      addTimeSpent(qId, spent);
    };
  }, [session?.currentIndex]);

  const handleSubmit = useCallback(async () => {
    if (!session) return;
    markSubmitted();
    // Submit all answered attempts
    const promises = session.questions.map(async (q) => {
      if (submittedAttempts.current.has(q.id)) return;
      const ans = session.answers[q.id];
      const answered = ans !== undefined && (Array.isArray(ans) ? ans.length > 0 : ans !== '');
      if (!answered) return;
      const sel = Array.isArray(ans) ? ans.join(',') : String(ans);
      const correct = q.correctAnswer ? (q.correctAnswer.includes(',')
        ? q.correctAnswer.split(',').map((s: string) => s.trim()).sort().join(',') === (Array.isArray(ans) ? [...ans].sort().join(',') : sel)
        : q.correctAnswer.trim() === sel) : false;
      submittedAttempts.current.add(q.id);
      await studentApi.submitAttempt({
        userId: student?.id,
        questionId: q.id,
        selectedOption: sel,
        isCorrect: correct,
        timeSpentSec: session.timeSpentPerQuestion[q.id] ?? 0,
        chapterId: q.chapterId ?? config.chapterId,
        subjectId: q.subjectId ?? config.subjectId,
      }).catch(() => {});
    });
    await Promise.all(promises);
    onFinish({
      questions: session.questions,
      answers: session.answers,
      markedForReview: session.markedForReview,
      timeSpentPerQuestion: session.timeSpentPerQuestion,
      sessionType: 'practice',
      testTitle: session.testTitle,
    });
  }, [session]);

  if (loading) return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm">Loading questions...</p>
      </div>
    </div>
  );
  if (error) return (
    <div className="h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-sm">
        <p className="text-foreground font-medium">{error}</p>
        <button onClick={onExit} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Go Back</button>
      </div>
    </div>
  );
  if (!session) return null;

  const questions = session.questions;
  const currentQ = questions[session.currentIndex];
  const currentAnswer = session.answers[currentQ?.id];
  const total = questions.length;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* TOP BAR */}
      <header className="flex-shrink-0 border-b border-border bg-card px-4 py-3 flex items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button onClick={() => setSubmitState('confirm')} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium truncate">{session.testTitle ?? 'Practice Session'}</p>
            <p className="text-sm font-semibold text-foreground">Q{session.currentIndex + 1} of {total}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:block">{getAnsweredCount()} answered</span>
          {/* Mobile palette toggle */}
          <button
            onClick={() => setShowPalette(true)}
            className="md:hidden w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MAIN */}
      <div className="flex-1 flex overflow-hidden">
        {/* Question area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Question scroll area */}
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
            <div className="max-w-2xl mx-auto space-y-6">
              <QuestionRenderer question={currentQ} />
              <QuestionOptions
                question={currentQ}
                selectedAnswer={currentAnswer}
                onSelect={(ans) => setAnswer(currentQ.id, ans)}
              />
            </div>
          </div>

          {/* Bottom controls */}
          <div className="flex-shrink-0 border-t border-border bg-card px-4 py-3">
            <div className="max-w-2xl mx-auto flex items-center gap-2 flex-wrap">
              <button
                disabled={session.currentIndex === 0}
                onClick={() => setCurrentIndex(session.currentIndex - 1)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>

              <button
                onClick={() => clearAnswer(currentQ.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Clear
              </button>

              <button
                onClick={() => {
                  toggleMarkForReview(currentQ.id);
                  if (session.currentIndex < total - 1) setCurrentIndex(session.currentIndex + 1);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${session.markedForReview[currentQ.id] ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700' : 'border-border text-muted-foreground hover:bg-muted'}`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mark for Review</span>
                <span className="sm:hidden">Mark</span>
              </button>

              <button
                onClick={() => {
                  if (session.currentIndex < total - 1) setCurrentIndex(session.currentIndex + 1);
                  else setSubmitState('confirm');
                }}
                className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                {session.currentIndex < total - 1 ? (
                  <><span>Save & Next</span> <ChevronRight className="w-4 h-4" /></>
                ) : (
                  <><Flag className="w-4 h-4" /> <span>Finish</span></>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Desktop palette */}
        <div className="hidden md:flex flex-col w-64 border-l border-border bg-card overflow-hidden">
          <QuestionPalette
            questions={questions}
            currentIndex={session.currentIndex}
            getState={getQuestionState}
            onNavigate={setCurrentIndex}
            answeredCount={getAnsweredCount()}
            notAnsweredCount={getNotAnsweredCount()}
            markedCount={getMarkedCount()}
            notVisitedCount={getNotVisitedCount()}
            onSubmit={() => setSubmitState('confirm')}
            sessionType="practice"
          />
        </div>
      </div>

      {/* Mobile Palette Drawer */}
      {showPalette && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPalette(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <p className="font-semibold text-foreground">Question Palette</p>
              <button onClick={() => setShowPalette(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <QuestionPalette
                questions={questions}
                currentIndex={session.currentIndex}
                getState={getQuestionState}
                onNavigate={(idx) => { setCurrentIndex(idx); setShowPalette(false); }}
                answeredCount={getAnsweredCount()}
                notAnsweredCount={getNotAnsweredCount()}
                markedCount={getMarkedCount()}
                notVisitedCount={getNotVisitedCount()}
                onSubmit={() => { setShowPalette(false); setSubmitState('confirm'); }}
                sessionType="practice"
              />
            </div>
          </div>
        </div>
      )}

      {/* Submit Confirmation Dialog */}
      {submitState === 'confirm' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-5">
            <h3 className="text-lg font-bold text-foreground">Finish Practice?</h3>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Answered', value: getAnsweredCount(), color: 'text-green-600' },
                { label: 'Unanswered', value: getNotAnsweredCount(), color: 'text-red-500' },
                { label: 'Marked for Review', value: getMarkedCount(), color: 'text-amber-500' },
                { label: 'Not Visited', value: getNotVisitedCount(), color: 'text-gray-400' },
              ].map((r) => (
                <div key={r.label} className="flex justify-between">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className={`font-semibold ${r.color}`}>{r.value}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSubmitState('none')} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
                Continue
              </button>
              <button onClick={handleSubmit} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
