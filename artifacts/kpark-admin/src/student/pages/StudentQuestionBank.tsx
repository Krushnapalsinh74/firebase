import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStudentStore } from '@/hooks/use-student-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SlidersHorizontal } from 'lucide-react';
import { MathText } from '@/lib/math-text';

export default function StudentQuestionBank() {
  const { token, student, selectedBoardId, selectedStandardId } = useStudentStore();
  
  const [filterSubjectId, setFilterSubjectId] = useState<number | undefined>();
  const [filterChapterId, setFilterChapterId] = useState<number | undefined>();
  const [filterDifficulty, setFilterDifficulty] = useState<string>('');
  const [filterQuestionType, setFilterQuestionType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [revealedSolutions, setRevealedSolutions] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { data: curriculumData } = useQuery({
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

  const { data: questionsData, isLoading: loadingQuestions } = useQuery({
    queryKey: [
      'student',
      'questions',
      selectedBoardId,
      selectedStandardId,
      filterSubjectId,
      filterChapterId,
      filterDifficulty,
      filterQuestionType,
      debouncedSearch,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBoardId) params.set('boardId', String(selectedBoardId));
      if (selectedStandardId) params.set('standardId', String(selectedStandardId));
      if (filterSubjectId) params.set('subjectId', String(filterSubjectId));
      if (filterChapterId) params.set('chapterId', String(filterChapterId));
      if (filterDifficulty) params.set('difficulty', filterDifficulty);
      if (filterQuestionType) params.set('questionType', filterQuestionType);
      if (debouncedSearch) params.set('search', debouncedSearch);
      params.set('limit', '60');

      const res = await fetch(`/api/student/questions?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch questions');
      return (await res.json()) as { data: any[]; total: number };
    },
    enabled: !!token && !!student && !!selectedBoardId && !!selectedStandardId,
  });

  const questionsList = questionsData?.data ?? [];

  return (
    <div className="space-y-5">
      <Card className="p-4 rounded-xl border bg-card space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" /> Filter Questions
          </span>
          {(filterSubjectId || filterChapterId || filterDifficulty || filterQuestionType || searchQuery) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterSubjectId(undefined);
                setFilterChapterId(undefined);
                setFilterDifficulty('');
                setFilterQuestionType('');
                setSearchQuery('');
              }}
              className="h-6 text-[11px] text-muted-foreground hover:text-destructive"
            >
              Reset Filters
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Select
            value={filterSubjectId ? String(filterSubjectId) : '__all__'}
            onValueChange={(v) => {
              setFilterSubjectId(v === '__all__' ? undefined : Number(v));
              setFilterChapterId(undefined);
            }}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Subjects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Subjects</SelectItem>
              {subjectsList.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select
            value={filterDifficulty || '__all__'}
            onValueChange={(v) => setFilterDifficulty(v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Difficulty" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Difficulty</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filterQuestionType || '__all__'}
            onValueChange={(v) => setFilterQuestionType(v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Question Types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Types</SelectItem>
              <SelectItem value="mcq">MCQ</SelectItem>
              <SelectItem value="true-false">True / False</SelectItem>
              <SelectItem value="fill-blank">Fill in Blank</SelectItem>
              <SelectItem value="short-answer">Short Answer</SelectItem>
              <SelectItem value="numerical">Numerical</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </Card>

      {loadingQuestions ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
        </div>
      ) : questionsList.length > 0 ? (
        <div className="space-y-4">
          <span className="text-xs text-muted-foreground">{questionsList.length} Questions found</span>

          {questionsList.map((q: any, idx: number) => (
            <Card key={q.id} className="p-5 rounded-xl border bg-card space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-bold">Q{idx + 1} • {q.subjectName} {q.chapterName ? `› ${q.chapterName}` : ''}</span>
                <Badge variant="outline" className="text-[10px] uppercase font-bold">{q.difficulty}</Badge>
              </div>

              <div className="text-sm font-medium leading-relaxed text-foreground">
                <MathText>{q.question}</MathText>
              </div>

              {q.imageUrl && (
                <img src={q.imageUrl} alt="Diagram" className="max-h-48 rounded border object-contain" />
              )}

              <div className="pt-2 border-t flex items-center justify-between text-xs">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setRevealedSolutions((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                  }
                  className="h-7 text-xs text-primary hover:bg-primary/10"
                >
                  {revealedSolutions[q.id] ? 'Hide Answer & Solution' : 'View Answer & Solution'}
                </Button>
              </div>

              {revealedSolutions[q.id] && (
                <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1.5 border">
                  <p className="font-bold text-emerald-700">Answer: <MathText>{q.correctAnswer || '—'}</MathText></p>
                  {q.explanation && (
                    <div className="text-muted-foreground"><MathText block>{q.explanation}</MathText></div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-10 text-center border-dashed">
          <p className="text-sm text-muted-foreground">No questions found matching your filters.</p>
        </Card>
      )}
    </div>
  );
}
