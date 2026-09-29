
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ChevronDown, BookOpen, Hash, ArrowLeft } from 'lucide-react';
import { studentApi, Subject, Chapter } from '../api/studentApi';
import { useStudentStore } from '@/hooks/use-student-store';
import { SubjectSkeleton } from '../components/SkeletonLoaders';

interface SubjectsPageProps {
  onNavigate: (view: string, params?: Record<string, any>) => void;
  initialSubjectId?: number;
}

const SUBJECT_COLORS: Record<string, string> = {
  Physics: 'bg-blue-500',
  Chemistry: 'bg-emerald-500',
  Biology: 'bg-rose-500',
};
const SUBJECT_EMOJIS: Record<string, string> = {
  Physics: '⚛️', Chemistry: '🧪', Biology: '🧬',
};

export function SubjectsPage({ onNavigate, initialSubjectId }: SubjectsPageProps) {
  const { selectedBoardId, selectedStandardId } = useStudentStore();
  const [expandedSubject, setExpandedSubject] = useState<number | null>(initialSubjectId ?? null);
  const [expandedChapter, setExpandedChapter] = useState<number | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['curriculum', selectedBoardId, selectedStandardId],
    queryFn: () => studentApi.getCurriculum({
      boardId: selectedBoardId ?? undefined,
      standardId: selectedStandardId ?? undefined,
    }),
    staleTime: 60_000,
  });

  const subjects = data?.data ?? [];

  if (isLoading) return <SubjectSkeleton />;
  if (isError) return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <p className="text-muted-foreground mb-4">Unable to load curriculum.</p>
      <button onClick={() => refetch()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Try Again</button>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Subjects</h1>
        <p className="text-sm text-muted-foreground mt-1">Explore your NEET curriculum</p>
      </div>

      {subjects.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          No subjects found. Please complete onboarding.
        </div>
      ) : (
        subjects.map((sub) => {
          const isExpanded = expandedSubject === sub.id;
          const dotColor = SUBJECT_COLORS[sub.name] ?? 'bg-primary';
          const emoji = SUBJECT_EMOJIS[sub.name] ?? '📚';
          return (
            <div key={sub.id} className="border border-border rounded-xl overflow-hidden bg-card">
              {/* Subject header */}
              <button
                onClick={() => setExpandedSubject(isExpanded ? null : sub.id)}
                className="w-full flex items-center gap-4 p-5 hover:bg-muted/40 transition-colors text-left"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${dotColor}/15`}>
                  {emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-foreground">{sub.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {sub.totalQuestions} questions · {sub.chaptersCount} chapters
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); onNavigate('practice', { subjectId: sub.id }); }}
                    className="text-xs text-primary font-medium border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition-colors"
                  >
                    Practice
                  </button>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {/* Chapters */}
              {isExpanded && (
                <div className="border-t border-border divide-y divide-border">
                  {sub.chapters.map((chap) => {
                    const chapExpanded = expandedChapter === chap.id;
                    return (
                      <div key={chap.id}>
                        <button
                          onClick={() => setExpandedChapter(chapExpanded ? null : chap.id)}
                          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors text-left"
                        >
                          <Hash className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{chap.name}</p>
                            <p className="text-xs text-muted-foreground">{chap.questionCount} questions · {chap.topics.length} topics</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); onNavigate('practice', { subjectId: sub.id, chapterId: chap.id }); }}
                              className="text-xs text-primary border border-primary/20 rounded px-2.5 py-1 hover:bg-primary/10 transition-colors"
                            >
                              Practice
                            </button>
                            {chapExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        </button>
                        {chapExpanded && chap.topics.length > 0 && (
                          <div className="bg-muted/20 divide-y divide-border/50">
                            {chap.topics.map((topic) => (
                              <div key={topic.id} className="flex items-center gap-3 px-8 py-2.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                                <span className="text-sm text-foreground flex-1">{topic.name}</span>
                                <button
                                  onClick={() => onNavigate('practice', { subjectId: sub.id, chapterId: chap.id, topicId: topic.id })}
                                  className="text-xs text-primary font-medium hover:underline"
                                >
                                  Practice →
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
