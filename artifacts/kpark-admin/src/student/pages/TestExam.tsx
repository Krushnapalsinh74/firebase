
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Bookmark, RotateCcw, Flag, Menu } from 'lucide-react';
import { useExamStore } from '../store/examStore';
import { studentApi } from '../api/studentApi';
import { useStudentStore } from '@/hooks/use-student-store';
import { QuestionRenderer, QuestionOptions } from '../components/QuestionRenderer';
import { QuestionPalette } from '../components/QuestionPalette';
import { ExamTimer } from '../components/ExamTimer';
import type { MockTest } from '../api/studentApi';
import type { SessionResults } from './PracticeSession';

interface TestExamProps {
  test: MockTest;
  onFinish: (results: SessionResults) => void;
  onExit: () => void;
}

export function TestExam({ test, onFinish, onExit }: TestExamProps) {
  const { session, startSession, setCurrentIndex, setAnswer, clearAnswer, toggleMarkForReview,
    tickTimer, markSubmitted, getQuestionState, getAnsweredCount, getNotAnsweredCount,
    getMarkedCount, getNotVisitedCount, markVisited, addTimeSpent } = useExamStore();
  const { student } = useStudentStore();
  const [loading, setLoading] = useState(!session || session.testId !== test.id || session.isSubmitted);
  const [error, setError] = useState('');
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const questionStartTime = useRef<number>(Date.now());
  const submittedRef = useRef(false);

  const title = test.title ?? test.name ?? `Test #${test.id}`;
  const duration = (test.durationMinutes ?? 180) * 60;

  useEffect(() => {
    if (!loading) return;
    (async () => {
      setLoading(true); setError('');
      try {
        // Try embedded questions first
        let questions = test.questions ?? [];
        if (questions.length === 0) {
          const res = await studentApi.getQuestions({
            standardId: test.standardId,
            boardId: test.boardId,
            subjectId: test.subjectId,
            limit: test.questionCount ?? 180,
          });
          questions = res.data;
        }
        if (questions.length === 0) {
          setError('No questions available for this test.');
          setLoading(false);
          return;
        }
        startSession('mock', questions, duration, { testId: test.id, testTitle: title });
      } catch (e: any) {
        setError(e.message ?? 'Failed to load test.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  const handleAutoSubmit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    doSubmit();
  }, [session]);

  const doSubmit = useCallback(() => {
    if (!session) return;
    markSubmitted();
    onFinish({
      questions: session.questions,
      answers: session.answers,
      markedForReview: session.markedForReview,
      timeSpentPerQuestion: session.timeSpentPerQuestion,
      sessionType: 'mock',
      testTitle: title,
    });
  }, [session]);

  if (loading) return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm">Loading test...</p>
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
    <div className="h-screen flex flex-col bg-[#f8f9fb] dark:bg-background overflow-hidden">
      {/* TOP BAR — NTA-style */}
      <header className="flex-shrink-0 bg-white dark:bg-card border-b border-border shadow-sm z-10">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground text-xs font-bold">KP</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground leading-tight truncate">{title}</p>
              <p className="text-xs text-muted-foreground">Q {session.currentIndex + 1} / {total}</p>
            </div>
          </div>

          <ExamTimer
            remainingSeconds={session.remainingSeconds}
            isActive={session.isActive && !session.isSubmitted}
            onTick={tickTimer}
            onExpire={handleAutoSubmit}
          />

          <button
            onClick={() => setShowPalette(true)}
            className="md:hidden w-8 h-8 rounded-lg border border-border flex items-center justify-center"
          >
            <Menu className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </header>

      {/* MAIN */}
      <div className="flex-1 flex overflow-hidden">
        {/* Question area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Candidate info bar */}
          <div className="flex-shrink-0 bg-white dark:bg-card border-b border-border px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Question Type: <span className="font-medium text-foreground">{currentQ?.questionType?.replace('_', ' ')}</span></span>
            <span>Marks: <span className="font-medium text-green-600">+4</span> / <span className="font-medium text-red-500">-1</span></span>
          </div>

          {/* Question scroll */}
          <div className="flex-1 overflow-y-auto bg-white dark:bg-card p-6">
            <div className="max-w-2xl mx-auto space-y-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Question {session.currentIndex + 1}
              </p>
              <QuestionRenderer question={currentQ} />
              <QuestionOptions
                question={currentQ}
                selectedAnswer={currentAnswer}
                onSelect={(ans) => setAnswer(currentQ.id, ans)}
              />
            </div>
          </div>

          {/* Bottom controls */}
          <div className="flex-shrink-0 bg-white dark:bg-card border-t border-border px-4 py-3 shadow-[0_-1px_0_0_hsl(var(--border))]">
            <div className="max-w-2xl mx-auto flex items-center gap-2 flex-wrap">
              <button
                disabled={session.currentIndex === 0}
                onClick={() => setCurrentIndex(session.currentIndex - 1)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>

              <button
                onClick={() => clearAnswer(currentQ.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Clear Response
              </button>

              <button
                onClick={() => {
                  toggleMarkForReview(currentQ.id);
                  if (session.currentIndex < total - 1) setCurrentIndex(session.currentIndex + 1);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${session.markedForReview[currentQ.id] ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700' : 'border-border text-muted-foreground hover:bg-muted'}`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mark for Review & Next</span>
                <span className="sm:hidden">Mark & Next</span>
              </button>

              <button
                onClick={() => {
                  if (session.currentIndex < total - 1) setCurrentIndex(session.currentIndex + 1);
                  else setShowSubmitDialog(true);
                }}
                className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
              >
                {session.currentIndex < total - 1 ? (
                  <><span>Save & Next</span><ChevronRight className="w-4 h-4" /></>
                ) : (
                  <><Flag className="w-4 h-4" /><span>Submit Test</span></>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Desktop palette */}
        <div className="hidden md:flex flex-col w-64 border-l border-border bg-white dark:bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Question Palette</p>
          </div>
          <QuestionPalette
            questions={questions}
            currentIndex={session.currentIndex}
            getState={getQuestionState}
            onNavigate={setCurrentIndex}
            answeredCount={getAnsweredCount()}
            notAnsweredCount={getNotAnsweredCount()}
            markedCount={getMarkedCount()}
            notVisitedCount={getNotVisitedCount()}
            onSubmit={() => setShowSubmitDialog(true)}
            sessionType="mock"
          />
        </div>
      </div>

      {/* Mobile palette */}
      {showPalette && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPalette(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <p className="font-semibold text-foreground">Question Palette</p>
              <button onClick={() => setShowPalette(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <QuestionPalette
                questions={questions}
                currentIndex={session.currentIndex}
                getState={getQuestionState}
                onNavigate={(i) => { setCurrentIndex(i); setShowPalette(false); }}
                answeredCount={getAnsweredCount()}
                notAnsweredCount={getNotAnsweredCount()}
                markedCount={getMarkedCount()}
                notVisitedCount={getNotVisitedCount()}
                onSubmit={() => { setShowPalette(false); setShowSubmitDialog(true); }}
                sessionType="mock"
              />
            </div>
          </div>
        </div>
      )}

      {/* Submit Dialog */}
      {showSubmitDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-5">
            <h3 className="text-lg font-bold text-foreground">Submit Test?</h3>
            <div className="space-y-2.5">
              {[
                { label: 'Answered', value: getAnsweredCount(), color: 'text-green-600' },
                { label: 'Unanswered', value: getNotAnsweredCount(), color: 'text-red-500' },
                { label: 'Marked for Review', value: getMarkedCount(), color: 'text-amber-500' },
                { label: 'Not Visited', value: getNotVisitedCount(), color: 'text-gray-400' },
                { label: 'Total Questions', value: questions.length, color: 'text-foreground' },
              ].map((r) => (
                <div key={r.label} className="flex justify-between items-center text-sm border-b border-border/50 pb-2 last:border-0">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className={`font-semibold ${r.color}`}>{r.value}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">Are you sure you want to submit this test?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSubmitDialog(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted">
                Continue Test
              </button>
              <button onClick={() => { setShowSubmitDialog(false); doSubmit(); }} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">
                Submit Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
