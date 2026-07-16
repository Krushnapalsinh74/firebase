import React, { useState } from 'react';
import {
  useListPapers,
  useCreatePaper,
  useExportPaper,
  getListPapersQueryKey,
  useListQuestions,
  useListBoards,
  useListStandards,
  useListSubjects,
  useListChapters,
  useListTopics,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { FileText, Download, Plus, Loader2, ChevronDown, X, CheckSquare, Square } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MathText } from '@/lib/math-text';

type Difficulty = 'easy' | 'medium' | 'hard' | 'advanced';

const DIFF_OPTS: { value: Difficulty; label: string; cls: string }[] = [
  { value: 'easy',     label: 'Easy',     cls: 'bg-green-500/10 text-green-700 border-green-500/30' },
  { value: 'medium',   label: 'Medium',   cls: 'bg-amber-500/10 text-amber-700 border-amber-500/30' },
  { value: 'hard',     label: 'Hard',     cls: 'bg-red-500/10 text-red-700 border-red-500/30'       },
  { value: 'advanced', label: 'Advanced', cls: 'bg-purple-500/10 text-purple-700 border-purple-500/30' },
];

function diffClass(d: string) {
  const m: Record<string, string> = {
    easy:     'bg-green-500/10 text-green-700 border-green-500/20',
    medium:   'bg-amber-500/10 text-amber-700 border-amber-500/20',
    hard:     'bg-red-500/10 text-red-700 border-red-500/20',
    advanced: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
  };
  return m[d] ?? '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Papers list page
// ─────────────────────────────────────────────────────────────────────────────

export default function PapersPage() {
  const { data, isLoading } = useListPapers();
  const exportPaper = useExportPaper();
  const { toast } = useToast();
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleExport = (id: number) => {
    setExportingId(id);
    exportPaper.mutate({ id }, {
      onSuccess: (res) => {
        if (res.success && res.downloadUrl) {
          window.open(res.downloadUrl, '_blank');
          toast({ title: 'Export started', description: 'Your PDF is downloading.' });
        } else {
          toast({ variant: 'destructive', title: 'Export failed' });
        }
        setExportingId(null);
      },
      onError: (err) => {
        toast({ variant: 'destructive', title: 'Export failed', description: err.message });
        setExportingId(null);
      },
    });
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Papers</h1>
          <p className="text-muted-foreground">Assemble questions into ready-to-print exam papers.</p>
        </div>

        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Create Paper</Button>
          </SheetTrigger>
          <SheetContent side="right" className="!max-w-3xl w-[95vw] overflow-hidden flex flex-col p-0">
            <SheetHeader className="px-6 py-4 border-b shrink-0">
              <SheetTitle>Create Exam Paper</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-hidden">
              <CreatePaperForm onSuccess={() => setIsSheetOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Institution</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
              )}
              {data?.data.map((paper) => (
                <TableRow key={paper.id}>
                  <TableCell className="font-medium">{paper.title}</TableCell>
                  <TableCell>{paper.institutionName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[paper.boardName, paper.standardName, paper.subjectName].filter(Boolean).join(' › ')}
                  </TableCell>
                  <TableCell>{paper.totalQuestions}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(parseISO(paper.createdAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => handleExport(paper.id)} disabled={exportingId === paper.id}>
                      {exportingId === paper.id
                        ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        : <Download className="h-4 w-4 mr-2" />}
                      Export PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!data?.data || data.data.length === 0) && !isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <FileText className="h-8 w-8 mb-2 opacity-40" />
                      <p>No papers yet.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Paper form (inside the slide-out sheet)
// ─────────────────────────────────────────────────────────────────────────────

const schema = z.object({
  title:              z.string().min(1, 'Title is required'),
  institutionName:    z.string().optional(),
  includeAnswerKey:   z.boolean().default(true),
  includeExplanations: z.boolean().default(false),
});
type FormValues = z.infer<typeof schema>;

function CreatePaperForm({ onSuccess }: { onSuccess: () => void }) {
  const createPaper = useCreatePaper();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Hierarchy filter state ──
  const [boardId,    setBoardId]    = useState<number | undefined>();
  const [standardId, setStandardId] = useState<number | undefined>();
  const [subjectId,  setSubjectId]  = useState<number | undefined>();
  const [chapterId,  setChapterId]  = useState<number | undefined>();
  const [topicId,    setTopicId]    = useState<number | undefined>();
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>();

  // ── Hierarchy data ──
  const { data: boards }    = useListBoards({ limit: 200 });
  const { data: standards } = useListStandards({ boardId,    limit: 200 });
  const { data: subjects }  = useListSubjects ({ standardId, boardId, limit: 200 });
  const { data: chapters }  = useListChapters ({ subjectId,  limit: 200 });
  const { data: topics }    = useListTopics   ({ chapterId,  limit: 200 });

  // ── Filtered questions ──
  const { data: questionsData, isLoading: qLoading } = useListQuestions({
    boardId, standardId, subjectId, chapterId, topicId,
    difficulty: difficulty as any,
    limit: 300,
  });

  // ── Selection ──
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const visibleIds  = questionsData?.data?.map(q => q.id) ?? [];
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));

  const toggle = (id: number) =>
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(prev => { const s = new Set(prev); visibleIds.forEach(id => s.delete(id)); return s; });
    } else {
      setSelectedIds(prev => { const s = new Set(prev); visibleIds.forEach(id => s.add(id)); return s; });
    }
  };

  // ── Reset cascading selections ──
  const onBoardChange = (v: string) => {
    setBoardId(v === '__all__' ? undefined : Number(v));
    setStandardId(undefined); setSubjectId(undefined); setChapterId(undefined); setTopicId(undefined);
    setSelectedIds(new Set());
  };
  const onStandardChange = (v: string) => {
    setStandardId(v === '__all__' ? undefined : Number(v));
    setSubjectId(undefined); setChapterId(undefined); setTopicId(undefined);
    setSelectedIds(new Set());
  };
  const onSubjectChange = (v: string) => {
    setSubjectId(v === '__all__' ? undefined : Number(v));
    setChapterId(undefined); setTopicId(undefined);
    setSelectedIds(new Set());
  };
  const onChapterChange = (v: string) => {
    setChapterId(v === '__all__' ? undefined : Number(v));
    setTopicId(undefined);
    setSelectedIds(new Set());
  };
  const onTopicChange = (v: string) => {
    setTopicId(v === '__all__' ? undefined : Number(v));
    setSelectedIds(new Set());
  };

  const clearFilters = () => {
    setBoardId(undefined); setStandardId(undefined); setSubjectId(undefined);
    setChapterId(undefined); setTopicId(undefined); setDifficulty(undefined);
    setSelectedIds(new Set());
  };

  const hasFilters = !!(boardId || standardId || subjectId || chapterId || topicId || difficulty);

  // ── Form ──
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', institutionName: '', includeAnswerKey: true, includeExplanations: false },
  });

  const onSubmit = (values: FormValues) => {
    if (selectedIds.size === 0) {
      toast({ variant: 'destructive', title: 'Select questions', description: 'Select at least one question.' });
      return;
    }
    createPaper.mutate({ data: { ...values, questionIds: [...selectedIds] } }, {
      onSuccess: () => {
        toast({ title: 'Paper created successfully' });
        queryClient.invalidateQueries({ queryKey: getListPapersQueryKey() });
        onSuccess();
      },
      onError: (err) => {
        toast({ variant: 'destructive', title: 'Error creating paper', description: err.message });
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="h-full flex flex-col overflow-hidden">

        {/* ── Scrollable body ── */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-5 space-y-6">

            {/* ── Paper details ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Paper Title</FormLabel>
                  <FormControl><Input placeholder="e.g. Midterm Examination 2024" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="institutionName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Institution Name <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl><Input placeholder="e.g. Springfield High School" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* ── Hierarchy filters ── */}
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Filter Questions</p>
                {hasFilters && (
                  <button type="button" onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <X className="h-3 w-3" /> Clear filters
                  </button>
                )}
              </div>

              {/* Row 1: Board / Standard / Subject */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Board</label>
                  <Select value={boardId?.toString() ?? '__all__'} onValueChange={onBoardChange}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All boards" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All boards</SelectItem>
                      {boards?.data?.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Standard / Class</label>
                  <Select value={standardId?.toString() ?? '__all__'} onValueChange={onStandardChange} disabled={!boardId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All standards" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All standards</SelectItem>
                      {standards?.data?.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Subject</label>
                  <Select value={subjectId?.toString() ?? '__all__'} onValueChange={onSubjectChange}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All subjects" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All subjects</SelectItem>
                      {subjects?.data?.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Chapter / Topic */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Chapter</label>
                  <Select value={chapterId?.toString() ?? '__all__'} onValueChange={onChapterChange} disabled={!subjectId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All chapters" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All chapters</SelectItem>
                      {chapters?.data?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Topic</label>
                  <Select value={topicId?.toString() ?? '__all__'} onValueChange={onTopicChange} disabled={!chapterId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All topics" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All topics</SelectItem>
                      {topics?.data?.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 3: Difficulty pills */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Difficulty Level</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {DIFF_OPTS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setDifficulty(d => d === opt.value ? undefined : opt.value); setSelectedIds(new Set()); }}
                      className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${
                        difficulty === opt.value
                          ? opt.cls + ' ring-2 ring-offset-1 ring-current'
                          : 'border-border text-muted-foreground hover:border-current ' + opt.cls
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Question list ── */}
            <div className="rounded-xl border overflow-hidden">
              {/* Header row */}
              <div className="bg-muted/50 px-4 py-2.5 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={toggleAll} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    {allSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                    {allSelected ? 'Deselect all' : 'Select all'}
                  </button>
                  {selectedIds.size > 0 && (
                    <span className="text-xs text-primary font-medium">({selectedIds.size} selected)</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {qLoading ? 'Loading…' : `${questionsData?.total ?? 0} question${(questionsData?.total ?? 0) !== 1 ? 's' : ''}`}
                </span>
              </div>

              {/* Question rows */}
              <div className="divide-y max-h-[400px] overflow-y-auto">
                {qLoading ? (
                  <div className="p-4 space-y-3">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : questionsData?.data && questionsData.data.length > 0 ? (
                  questionsData.data.map(q => {
                    const selected = selectedIds.has(q.id);
                    return (
                      <div
                        key={q.id}
                        onClick={() => toggle(q.id)}
                        className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors ${selected ? 'bg-primary/5' : ''}`}
                      >
                        <Checkbox checked={selected} className="mt-0.5 shrink-0 pointer-events-none" />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${diffClass(q.difficulty)}`}>
                              {q.difficulty}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{q.questionType}</Badge>
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {q.subjectName} {q.chapterName ? `› ${q.chapterName}` : ''}
                              {q.topicName ? ` › ${q.topicName}` : ''}
                            </span>
                          </div>
                          <p className="text-sm leading-snug line-clamp-2">
                            <MathText>{q.question}</MathText>
                          </p>
                          {q.options && (
                            <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              <MathText>{q.options.split('\n').filter(Boolean).slice(0, 4).join('  ·  ')}</MathText>
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right ml-2">
                          <span className={`text-xs font-medium tabular-nums ${q.qualityScore != null && q.qualityScore >= 8 ? 'text-green-600' : q.qualityScore != null && q.qualityScore >= 6 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                            {q.qualityScore ?? '—'}/10
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    {hasFilters ? 'No questions match the selected filters.' : 'No questions in the bank yet.'}
                  </div>
                )}
              </div>
            </div>

            {/* ── Options ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField control={form.control} name="includeAnswerKey" render={({ field }) => (
                <FormItem className="flex items-start space-x-3 space-y-0 rounded-lg border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-0.5 leading-none">
                    <FormLabel>Include Answer Key</FormLabel>
                    <CardDescription className="text-xs">Append answers at the end.</CardDescription>
                  </div>
                </FormItem>
              )} />
              <FormField control={form.control} name="includeExplanations" render={({ field }) => (
                <FormItem className="flex items-start space-x-3 space-y-0 rounded-lg border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-0.5 leading-none">
                    <FormLabel>Include Explanations</FormLabel>
                    <CardDescription className="text-xs">Add detailed explanations to answers.</CardDescription>
                  </div>
                </FormItem>
              )} />
            </div>

          </div>
        </ScrollArea>

        {/* ── Sticky footer ── */}
        <div className="px-6 py-4 border-t shrink-0 bg-background flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {selectedIds.size > 0
              ? <><span className="font-semibold text-foreground">{selectedIds.size}</span> question{selectedIds.size !== 1 ? 's' : ''} selected</>
              : 'Select questions above'}
          </p>
          <Button type="submit" disabled={createPaper.isPending || selectedIds.size === 0} className="min-w-[140px]">
            {createPaper.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating…</> : 'Create Paper'}
          </Button>
        </div>

      </form>
    </Form>
  );
}
