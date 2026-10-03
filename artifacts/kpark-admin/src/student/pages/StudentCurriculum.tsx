import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStudentStore } from '@/hooks/use-student-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, ArrowRight, PlayCircle, ArrowLeft } from 'lucide-react';
import { MathText } from '@/lib/math-text';
import { useLocation } from 'wouter';

export default function StudentCurriculum() {
  const [, setLocation] = useLocation();
  const { token, student, selectedBoardId, selectedStandardId, selectedStandardName, bootstrap } = useStudentStore();

  const [activeSubject, setActiveSubject] = useState<any | null>(null);
  const [activeChapter, setActiveChapter] = useState<any | null>(null);

  const { data: curriculumData, isLoading: loadingCurriculum } = useQuery({
    queryKey: ['student', 'curriculum-tree', selectedBoardId, selectedStandardId],
    queryFn: async () => {
      const res = await fetch(
        `/api/student/curriculum-tree?boardId=${selectedBoardId || ''}&standardId=${selectedStandardId || ''}`
      );
      if (!res.ok) throw new Error('Failed to load curriculum tree');
      return (await res.json()) as { data: any[] };
    },
    enabled: !!token && !!student && !!selectedBoardId && !!selectedStandardId,
  });

  const subjectsList = curriculumData?.data ?? [];

  // Question preview fetch for chapter view
  const { data: questionsData, isLoading: loadingQuestions } = useQuery({
    queryKey: ['student', 'questions', selectedBoardId, selectedStandardId, activeSubject?.id, activeChapter?.id],
    queryFn: async () => {
      if (!activeSubject?.id || !activeChapter?.id) return { data: [] };
      const params = new URLSearchParams();
      params.set('boardId', String(selectedBoardId));
      params.set('standardId', String(selectedStandardId));
      params.set('subjectId', String(activeSubject.id));
      params.set('chapterId', String(activeChapter.id));
      params.set('limit', '60');
      const res = await fetch(`/api/student/questions?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch questions');
      return (await res.json()) as { data: any[] };
    },
    enabled: !!token && !!student && !!activeSubject && !!activeChapter,
  });
  const questionsList = questionsData?.data ?? [];

  if (activeChapter && activeSubject) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setActiveChapter(null); setActiveSubject(null); }}
          className="text-xs gap-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Curriculum
        </Button>

        <Card className="p-6 rounded-2xl border bg-card space-y-4">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <Badge variant="outline" className="mb-2 text-primary">{activeSubject.name}</Badge>
              <h2 className="text-2xl font-extrabold">{activeChapter.name}</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {activeChapter.questionCount} Verified questions available for practice
              </p>
            </div>
          </div>

          {activeChapter.topics?.length > 0 && (
            <div className="pt-4 border-t space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Topics in this chapter:</h4>
              <div className="flex flex-wrap gap-2">
                {activeChapter.topics.map((top: any) => (
                  <Badge key={top.id} variant="secondary" className="px-3 py-1 text-xs">
                    {top.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-3">
          <h3 className="font-bold text-base">Questions in this Chapter</h3>
          {loadingQuestions ? (
            <Skeleton className="h-40 w-full" />
          ) : questionsList.length > 0 ? (
            <div className="space-y-3">
              {questionsList.map((q: any, idx: number) => (
                <Card key={q.id} className="p-4 rounded-xl border bg-card space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-bold">Q{idx + 1} • {q.difficulty?.toUpperCase()} • {q.questionType}</span>
                    {q.marks && <span>{q.marks} Marks</span>}
                  </div>
                  <div className="text-sm font-medium"><MathText>{q.question}</MathText></div>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No questions added yet to this chapter.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Curriculum & Chapters</h2>
        <p className="text-xs text-muted-foreground">
          Select a subject below to explore its chapters, topics, and practice questions.
        </p>
      </div>

      {loadingCurriculum ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-44 w-full rounded-2xl" />)}
        </div>
      ) : subjectsList.length > 0 ? (
        <div className="space-y-6">
          {subjectsList.map((subject: any) => (
            <Card key={subject.id} className="p-6 rounded-2xl border border-border/80 bg-card shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-foreground">{subject.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {subject.chaptersCount} Chapters • {subject.totalQuestions} Questions
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation('/student/question-bank')}
                  className="text-xs gap-1"
                >
                  View All Questions <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {subject.chapters?.length > 0 ? (
                  subject.chapters.map((chap: any, cIdx: number) => (
                    <div
                      key={chap.id}
                      className="p-4 rounded-xl border border-border/70 bg-muted/20 hover:border-primary/50 hover:bg-muted/40 transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">
                            Chapter {cIdx + 1}
                          </span>
                          <Badge variant="outline" className="text-[10px] bg-background">
                            {chap.questionCount} Qs
                          </Badge>
                        </div>
                        <h4 className="font-bold text-sm text-foreground line-clamp-1">{chap.name}</h4>
                        {chap.topics?.length > 0 && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1">
                            Topics: {chap.topics.map((t: any) => t.name).join(', ')}
                          </p>
                        )}
                      </div>

                      <div className="pt-3 mt-2 border-t border-border/50 flex items-center justify-between gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setActiveSubject(subject);
                            setActiveChapter(chap);
                          }}
                          className="w-full h-7 text-xs px-2"
                        >
                          View Chapter Details
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-4 text-center text-xs text-muted-foreground">
                    No chapters registered yet under {subject.name}.
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center rounded-2xl border-dashed space-y-3">
          <BookOpen className="h-8 w-8 text-muted-foreground mx-auto" />
          <h3 className="font-bold text-base">No subjects found for this grade</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Please make sure you have selected a valid board and class.
          </p>
        </Card>
      )}
    </div>
  );
}
