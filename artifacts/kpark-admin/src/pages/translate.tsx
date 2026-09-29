import React, { useState } from 'react';
import {
  useListQuestions,
  getListQuestionsQueryKey,
  useListBoards,
  useListStandards,
  useListSubjects,
  useListChapters,
  useListTopics,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Globe, ChevronDown, CheckSquare, Square, PlayCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MathText } from '@/lib/math-text';
import { useAuthStore } from '@/hooks/use-auth';
import { Progress } from '@/components/ui/progress';

type Difficulty = 'easy' | 'medium' | 'hard' | 'advanced';

const PAGE_SIZE = 50;

const LANG_OPTIONS = [
  { value: 'hi', label: 'Hindi' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'mr', label: 'Marathi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'bn', label: 'Bengali' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'ar', label: 'Arabic' },
  { value: 'zh', label: 'Chinese (Simplified)' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ur', label: 'Urdu' },
  { value: 'pa', label: 'Punjabi' },
];

export default function TranslatePage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  
  const [targetLang, setTargetLang] = useState<string>('hi');
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [translatedCount, setTranslatedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [boardId, setBoardId] = useState<number | undefined>();
  const [standardId, setStandardId] = useState<number | undefined>();
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [chapterId, setChapterId] = useState<number | undefined>();
  const [topicId, setTopicId] = useState<number | undefined>();

  const { data: boards } = useListBoards();
  const { data: standards } = useListStandards({ boardId });
  const { data: subjects } = useListSubjects({ standardId });
  const { data: chapters } = useListChapters({ subjectId });
  const { data: topics } = useListTopics({ chapterId });

  const clearSelection = () => setSelectedIds(new Set());

  const onBoardChange = (v: string) => {
    setBoardId(v === '__all__' ? undefined : Number(v));
    setStandardId(undefined); setSubjectId(undefined); setChapterId(undefined); setTopicId(undefined);
    setPage(1);
    clearSelection();
  };
  const onStandardChange = (v: string) => {
    setStandardId(v === '__all__' ? undefined : Number(v));
    setSubjectId(undefined); setChapterId(undefined); setTopicId(undefined);
    setPage(1);
    clearSelection();
  };
  const onSubjectChange = (v: string) => {
    setSubjectId(v === '__all__' ? undefined : Number(v));
    setChapterId(undefined); setTopicId(undefined);
    setPage(1);
    clearSelection();
  };
  const onChapterChange = (v: string) => {
    setChapterId(v === '__all__' ? undefined : Number(v));
    setTopicId(undefined);
    setPage(1);
    clearSelection();
  };
  const onTopicChange = (v: string) => {
    setTopicId(v === '__all__' ? undefined : Number(v));
    setPage(1);
    clearSelection();
  };

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const queryParams = {
    search: debouncedSearch || undefined,
    difficulty: (difficulty as Difficulty) || undefined,
    boardId,
    standardId,
    subjectId,
    chapterId,
    topicId,
    page,
    limit: PAGE_SIZE,
  };

  const { data, isLoading } = useListQuestions(queryParams);

  const visibleIds = data?.data?.map(q => q.id) ?? [];
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));

  const toggleSelect = (id: number) =>
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(prev => { const s = new Set(prev); visibleIds.forEach(id => s.delete(id)); return s; });
    } else {
      setSelectedIds(prev => { const s = new Set(prev); visibleIds.forEach(id => s.add(id)); return s; });
    }
  };

  const handleBulkTranslate = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Translate ${selectedIds.size} selected question(s) to ${LANG_OPTIONS.find(l => l.value === targetLang)?.label}?`)) return;
    
    setIsTranslating(true);
    setProgress(0);
    setTranslatedCount(0);
    setFailedCount(0);
    
    let currentSuccess = 0;
    let currentFail = 0;
    
    const idsToTranslate = Array.from(selectedIds);
    const total = idsToTranslate.length;

    for (let i = 0; i < total; i++) {
      const id = idsToTranslate[i];
      try {
        const res = await fetch('/api/translate-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ questionId: id, targetLanguage: targetLang }),
        });
        if (!res.ok) throw new Error('Translation failed');
        currentSuccess++;
      } catch (err) {
        console.error(err);
        currentFail++;
      }
      setTranslatedCount(currentSuccess);
      setFailedCount(currentFail);
      setProgress(Math.round(((i + 1) / total) * 100));
    }

    toast({ 
      title: 'Bulk Translation Complete', 
      description: `Successfully translated ${currentSuccess} questions. ${currentFail > 0 ? `Failed: ${currentFail}` : ''}`
    });
    
    queryClient.invalidateQueries({ queryKey: getListQuestionsQueryKey() });
    setIsTranslating(false);
    clearSelection();
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bulk Translation</h1>
          <p className="text-muted-foreground">Select multiple questions to translate them automatically.</p>
        </div>
      </div>

      <Card className="p-4 shadow-sm border border-border bg-card">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto flex-1">
            <Select value={targetLang} onValueChange={setTargetLang} disabled={isTranslating}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Target Language" />
              </SelectTrigger>
              <SelectContent>
                {LANG_OPTIONS.map(l => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-sm font-medium">
              {selectedIds.size} selected
            </div>
            {selectedIds.size > 0 && !isTranslating && (
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Clear
              </Button>
            )}
          </div>
          
          <div className="w-full md:w-auto flex flex-col md:flex-row items-center gap-4">
            {isTranslating ? (
              <div className="flex items-center gap-3 w-full md:w-64">
                <Progress value={progress} className="flex-1" />
                <span className="text-sm font-medium min-w-[3rem] text-right">{progress}%</span>
              </div>
            ) : null}
            
            <Button 
              className="w-full md:w-auto whitespace-nowrap" 
              onClick={handleBulkTranslate} 
              disabled={selectedIds.size === 0 || isTranslating}
            >
              {isTranslating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Translating...
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4 mr-2" />
                  Translate {selectedIds.size > 0 ? selectedIds.size : ''} Questions
                </>
              )}
            </Button>
          </div>
        </div>
        
        {isTranslating && (
          <div className="mt-4 flex gap-4 text-sm text-muted-foreground justify-end">
            <span className="text-green-600 font-medium">Success: {translatedCount}</span>
            {failedCount > 0 && <span className="text-red-600 font-medium">Failed: {failedCount}</span>}
          </div>
        )}
      </Card>

      {/* ── Advanced Cascading Database Filters ── */}
      <Card className="p-4 space-y-4 shadow-sm border border-border bg-card">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Database Filters</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Board Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Board</label>
            <Select value={boardId?.toString() ?? '__all__'} onValueChange={onBoardChange} disabled={isTranslating}>
              <SelectTrigger className="h-8 text-xs w-full">
                <SelectValue placeholder="All boards" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All boards</SelectItem>
                {boards?.data?.map((b: any) => (
                  <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Standard Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Standard</label>
            <Select value={standardId?.toString() ?? '__all__'} onValueChange={onStandardChange} disabled={!boardId || isTranslating}>
              <SelectTrigger className="h-8 text-xs w-full">
                <SelectValue placeholder="All standards" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All standards</SelectItem>
                {standards?.data?.map((s: any) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Subject</label>
            <Select value={subjectId?.toString() ?? '__all__'} onValueChange={onSubjectChange} disabled={!standardId || isTranslating}>
              <SelectTrigger className="h-8 text-xs w-full">
                <SelectValue placeholder="All subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All subjects</SelectItem>
                {subjects?.data?.map((s: any) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Chapter Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Chapter</label>
            <Select value={chapterId?.toString() ?? '__all__'} onValueChange={onChapterChange} disabled={!subjectId || isTranslating}>
              <SelectTrigger className="h-8 text-xs w-full">
                <SelectValue placeholder="All chapters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All chapters</SelectItem>
                {chapters?.data?.map((c: any) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name} {c.syllabus ? `(${c.syllabus})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Topic Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Topic</label>
            <Select value={topicId?.toString() ?? '__all__'} onValueChange={onTopicChange} disabled={!chapterId || isTranslating}>
              <SelectTrigger className="h-8 text-xs w-full">
                <SelectValue placeholder="All topics" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All topics</SelectItem>
                {topics?.data?.map((t: any) => (
                  <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search questions..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={isTranslating}
          />
        </div>
        <div className="flex items-center gap-2">
          {['easy', 'medium', 'hard', 'advanced'].map((diff) => (
            <button
              key={diff}
              disabled={isTranslating}
              onClick={() => { setDifficulty(d => d === diff ? '' : (diff as Difficulty)); setPage(1); clearSelection(); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                difficulty === diff 
                ? 'ring-2 ring-offset-1 ring-primary border-primary bg-primary/10 text-primary' 
                : 'border-border text-muted-foreground hover:border-foreground'
              }`}
            >
              {diff.charAt(0).toUpperCase() + diff.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {data && (
        <div className="flex items-center justify-between -mt-2">
          <p className="text-sm text-muted-foreground">
            {data.total} questions found
          </p>
          {data.data && data.data.length > 0 && !isTranslating && (
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {allVisibleSelected
                ? <CheckSquare className="h-4 w-4 text-primary" />
                : <Square className="h-4 w-4" />}
              {allVisibleSelected ? 'Deselect page' : 'Select page'}
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : data?.data && data.data.length > 0 ? (
        <div className="space-y-3">
          {data.data.map((q: any) => {
            const isSelected = selectedIds.has(q.id);
            const translationCount = q.translations ? Object.keys(q.translations).length : 0;
            const hasTargetLang = q.translations && !!q.translations[targetLang];
            
            return (
              <div
                key={q.id}
                className={`flex items-start gap-2 border rounded-lg bg-card shadow-sm transition-colors ${
                  isSelected ? 'border-primary/50 bg-primary/5' : 'border-border'
                }`}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => !isTranslating && toggleSelect(q.id)}
                  disabled={isTranslating}
                  className="mt-[1.15rem] ml-3 shrink-0"
                />
                
                <div className="w-full text-left px-3 py-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{q.difficulty.toUpperCase()}</Badge>
                    <Badge variant="outline">{q.questionType}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {q.subjectName} • {q.chapterName}
                    </span>
                  </div>
                  <span className="font-medium text-base line-clamp-2 block">
                    <MathText>{q.question}</MathText>
                  </span>
                  
                  <div className="flex items-center gap-3 mt-1 pt-2 border-t border-border/50">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {translationCount} Language{translationCount !== 1 ? 's' : ''} Translated
                    </div>
                    {hasTargetLang && (
                      <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-700 hover:bg-green-500/20">
                        Already has {LANG_OPTIONS.find(l => l.value === targetLang)?.label}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Search className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No questions found</h3>
        </Card>
      )}

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, data.total)} of {data.total}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || isTranslating}>Previous</Button>
            <span className="text-sm text-muted-foreground px-2">Page {page} of {Math.ceil(data.total / PAGE_SIZE)}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * PAGE_SIZE >= data.total || isTranslating}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
