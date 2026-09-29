import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useListBoards,
  useListStandards,
  useListSubjects,
  useListChapters,
  useListTopics,
  getListQuestionsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/hooks/use-auth';
import { MathText } from '@/lib/math-text';
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  Upload,
  Sparkles,
  Eye,
  CheckCircle2,
  HelpCircle,
  X,
  Sigma,
  ShieldCheck,
} from 'lucide-react';

interface OptionItem {
  id: string;
  text: string;
}

export function AddQuestionDialog() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  // ── Form State ──
  const [boardId, setBoardId] = useState<number | undefined>();
  const [standardId, setStandardId] = useState<number | undefined>();
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [chapterId, setChapterId] = useState<number | undefined>();
  const [topicId, setTopicId] = useState<number | undefined>();

  const [questionType, setQuestionType] = useState('mcq');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'advanced'>('medium');
  const [marks, setMarks] = useState('1');

  const [questionText, setQuestionText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFileName, setImageFileName] = useState('');

  const [options, setOptions] = useState<OptionItem[]>([
    { id: 'A', text: '' },
    { id: 'B', text: '' },
    { id: 'C', text: '' },
    { id: 'D', text: '' },
  ]);
  const [correctOptionId, setCorrectOptionId] = useState('A');
  const [manualCorrectAnswer, setManualCorrectAnswer] = useState('');
  const [explanation, setExplanation] = useState('');
  const [submitForApproval, setSubmitForApproval] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  // ── Hierarchy Data ──
  const { data: boards } = useListBoards();
  const { data: standards } = useListStandards({ boardId });
  const { data: subjects } = useListSubjects({ standardId });
  const { data: chapters } = useListChapters({ subjectId });
  const { data: topics } = useListTopics({ chapterId });

  // ── Options Helpers ──
  const updateOptionText = (index: number, text: string) => {
    setOptions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], text };
      return next;
    });
  };

  const addOption = () => {
    const nextLetter = String.fromCharCode(65 + options.length);
    setOptions((prev) => [...prev, { id: nextLetter, text: '' }]);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // Re-assign letters A, B, C, ...
      return next.map((opt, i) => ({ ...opt, id: String.fromCharCode(65 + i) }));
    });
  };

  // ── Image Upload via File Reader ──
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Please upload an image smaller than 5MB.', variant: 'destructive' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const base64 = loadEvt.target?.result as string;
      setImageUrl(base64);
      setImageFileName(file.name);
      toast({ title: 'Figure uploaded', description: file.name });
    };
    reader.readAsDataURL(file);
  };

  // ── LaTeX Helper Toolbar Insertion ──
  const insertLatexSnippet = (snippet: string, targetField: 'question' | 'explanation' = 'question') => {
    if (targetField === 'question') {
      setQuestionText((prev) => prev + snippet);
    } else {
      setExplanation((prev) => prev + snippet);
    }
  };

  // ── Reset Form ──
  const resetForm = () => {
    setQuestionText('');
    setImageUrl('');
    setImageFileName('');
    setOptions([
      { id: 'A', text: '' },
      { id: 'B', text: '' },
      { id: 'C', text: '' },
      { id: 'D', text: '' },
    ]);
    setCorrectOptionId('A');
    setManualCorrectAnswer('');
    setExplanation('');
  };

  // ── Submit Question ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) {
      toast({ title: 'Missing question', description: 'Please enter the question text.', variant: 'destructive' });
      return;
    }

    let finalCorrectAnswer = manualCorrectAnswer;
    let finalOptions: any = null;

    if (questionType === 'mcq' || questionType === 'single_choice' || questionType === 'multiple_choice') {
      finalOptions = options.map((o) => `${o.id}. ${o.text.trim()}`).join('\n');
      const found = options.find((o) => o.id === correctOptionId);
      finalCorrectAnswer = found ? `${found.id}. ${found.text.trim()}` : (options[0] ? `${options[0].id}. ${options[0].text.trim()}` : '');
    } else if (questionType === 'true-false') {
      finalOptions = 'A. True\nB. False';
      finalCorrectAnswer = manualCorrectAnswer || 'True';
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question: questionText.trim(),
          questionType,
          difficulty,
          marks: parseInt(marks) || 1,
          options: finalOptions,
          correctAnswer: finalCorrectAnswer,
          explanation: explanation.trim() || null,
          imageUrl: imageUrl || null,
          boardId: boardId || null,
          standardId: standardId || null,
          subjectId: subjectId || null,
          chapterId: chapterId || null,
          topicId: topicId || null,
          submitForApproval: user?.role === 'subadmin' ? submitForApproval : false,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create question');
      }

      toast({
        title: user?.role === 'subadmin' && submitForApproval ? 'Submitted for Approval! 🚀' : 'Question Added! 🎉',
        description: user?.role === 'subadmin' && submitForApproval
          ? 'Question submitted to Super Admin for approval.'
          : 'Question successfully added to the question library.',
      });

      queryClient.invalidateQueries({ queryKey: getListQuestionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      resetForm();
      setOpen(false);
    } catch (err: any) {
      toast({
        title: 'Error creating question',
        description: err.message || 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedBoard = boards?.data?.find((b) => b.id === boardId)?.name;
  const selectedSubject = subjects?.data?.find((s) => s.id === subjectId)?.name;
  const selectedChapter = chapters?.data?.find((c) => c.id === chapterId)?.name;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" /> Add Question
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b bg-muted/20 sticky top-0 z-10 backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" /> Manual Question Entry
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Author customized questions with rich LaTeX mathematical notation, uploaded diagrams, and detailed solutions.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="gap-1.5 text-xs"
            >
              <Eye className="h-3.5 w-3.5" />
              {showPreview ? 'Hide Preview' : 'Show Live Preview'}
            </Button>
          </div>
        </DialogHeader>

        <div className={`p-6 grid gap-6 ${showPreview ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'}`}>
          {/* ── Left / Main Form Column ── */}
          <div className={`space-y-6 ${showPreview ? 'lg:col-span-7' : 'w-full'}`}>
            {/* 1. Academic Hierarchy Selection */}
            <div className="space-y-2 p-4 rounded-xl border border-border bg-card">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                1. Curriculum & Classification
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">Board</label>
                  <Select value={boardId?.toString() ?? ''} onValueChange={(v) => { setBoardId(Number(v)); setStandardId(undefined); setSubjectId(undefined); setChapterId(undefined); setTopicId(undefined); }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Board" /></SelectTrigger>
                    <SelectContent>{boards?.data?.map((b) => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">Standard / Grade</label>
                  <Select value={standardId?.toString() ?? ''} onValueChange={(v) => { setStandardId(Number(v)); setSubjectId(undefined); setChapterId(undefined); setTopicId(undefined); }} disabled={!boardId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Grade" /></SelectTrigger>
                    <SelectContent>{standards?.data?.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">Subject</label>
                  <Select value={subjectId?.toString() ?? ''} onValueChange={(v) => { setSubjectId(Number(v)); setChapterId(undefined); setTopicId(undefined); }} disabled={!standardId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Subject" /></SelectTrigger>
                    <SelectContent>{subjects?.data?.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 sm:col-span-2">
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">Chapter</label>
                  <Select value={chapterId?.toString() ?? ''} onValueChange={(v) => { setChapterId(Number(v)); setTopicId(undefined); }} disabled={!subjectId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Chapter" /></SelectTrigger>
                    <SelectContent>{chapters?.data?.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">Topic</label>
                  <Select value={topicId?.toString() ?? ''} onValueChange={(v) => setTopicId(Number(v))} disabled={!chapterId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Topic (Optional)" /></SelectTrigger>
                    <SelectContent>{topics?.data?.map((t) => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 2. Question Properties */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Question Type</label>
                <Select value={questionType} onValueChange={setQuestionType}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mcq">Multiple Choice (MCQ)</SelectItem>
                    <SelectItem value="true-false">True / False</SelectItem>
                    <SelectItem value="fill-blank">Fill in the Blank</SelectItem>
                    <SelectItem value="short-answer">Short Answer</SelectItem>
                    <SelectItem value="long-answer">Long Answer</SelectItem>
                    <SelectItem value="numerical">Numerical</SelectItem>
                    <SelectItem value="assertion-reason">Assertion & Reason</SelectItem>
                    <SelectItem value="match-following">Match the Following</SelectItem>
                    <SelectItem value="hots">HOTS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Difficulty</label>
                <Select value={difficulty} onValueChange={(v: any) => setDifficulty(v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Marks</label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={marks}
                  onChange={(e) => setMarks(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* 3. Question Statement & LaTeX Toolbar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Question Statement *
                </label>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Sigma className="h-3 w-3 text-primary" /> Use $...$ for inline LaTeX and $$...$$ for display equations
                </span>
              </div>

              {/* LaTeX Quick Helpers */}
              <div className="flex items-center gap-1.5 flex-wrap bg-muted/40 p-1.5 rounded-lg border border-border/70 text-xs">
                <span className="text-[10px] text-muted-foreground font-semibold px-1">LaTeX Tools:</span>
                <button type="button" onClick={() => insertLatexSnippet('$x^2$')} className="px-1.5 py-0.5 rounded bg-background border hover:bg-muted font-mono text-[11px]">
                  {'$x^2$'}
                </button>
                <button type="button" onClick={() => insertLatexSnippet('$\\frac{a}{b}$')} className="px-1.5 py-0.5 rounded bg-background border hover:bg-muted font-mono text-[11px]">
                  {'$\\frac{a}{b}$'}
                </button>
                <button type="button" onClick={() => insertLatexSnippet('$\\sqrt{x}$')} className="px-1.5 py-0.5 rounded bg-background border hover:bg-muted font-mono text-[11px]">
                  {'$\\sqrt{x}$'}
                </button>
                <button type="button" onClick={() => insertLatexSnippet('$\\alpha, \\beta, \\theta$')} className="px-1.5 py-0.5 rounded bg-background border hover:bg-muted font-mono text-[11px]">
                  {'$\\alpha, \\beta, \\theta$'}
                </button>
                <button type="button" onClick={() => insertLatexSnippet('$\\Delta, \\Sigma$')} className="px-1.5 py-0.5 rounded bg-background border hover:bg-muted font-mono text-[11px]">
                  {'$\\Delta, \\Sigma$'}
                </button>
                <button type="button" onClick={() => insertLatexSnippet('$\\le, \\ge, \\neq$')} className="px-1.5 py-0.5 rounded bg-background border hover:bg-muted font-mono text-[11px]">
                  {'$\\le, \\ge, \\neq$'}
                </button>
              </div>

              <Textarea
                placeholder="Type your question statement here. Example: If $2x + 3y = 7$ and $x - y = 1$, find the value of $x^2 + y^2$."
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                rows={4}
                className="font-normal text-sm leading-relaxed"
              />
            </div>

            {/* 4. Diagram / Figure Attachment */}
            <div className="space-y-2 p-3.5 rounded-xl border border-dashed border-border bg-muted/10">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5 text-primary" /> Diagram / Figure (Optional)
                </label>
                {imageUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => { setImageUrl(''); setImageFileName(''); }}
                  >
                    <X className="h-3 w-3 mr-1" /> Remove Diagram
                  </Button>
                )}
              </div>

              {imageUrl ? (
                <div className="flex items-center gap-4 bg-background p-2.5 rounded-lg border">
                  <img src={imageUrl} alt="Attached Figure" className="h-20 w-32 object-contain rounded border bg-white" />
                  <div className="text-xs space-y-1 overflow-hidden">
                    <p className="font-medium truncate text-foreground">{imageFileName || 'Diagram attached'}</p>
                    <p className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Ready for display</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" /> Upload Image File
                  </Button>
                  <span className="text-xs text-muted-foreground">or</span>
                  <Input
                    placeholder="Paste image URL (https://...)"
                    value={imageUrl}
                    onChange={(e) => { setImageUrl(e.target.value); setImageFileName('Direct Image URL'); }}
                    className="h-8 text-xs flex-1"
                  />
                </div>
              )}
            </div>

            {/* 5. Options & Correct Answer */}
            {questionType === 'mcq' || questionType === 'single_choice' || questionType === 'multiple_choice' ? (
              <div className="space-y-3 p-4 rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Options & Correct Answer
                  </label>
                  <Button type="button" variant="outline" size="sm" onClick={addOption} className="h-7 text-xs gap-1">
                    <Plus className="h-3 w-3" /> Add Option
                  </Button>
                </div>

                <div className="space-y-2.5">
                  {options.map((opt, idx) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCorrectOptionId(opt.id)}
                        className={`h-8 w-8 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 border transition-all ${
                          correctOptionId === opt.id
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-muted/50 text-muted-foreground hover:border-emerald-500'
                        }`}
                        title={correctOptionId === opt.id ? 'Correct Answer' : 'Click to mark as correct'}
                      >
                        {opt.id}
                      </button>

                      <Input
                        placeholder={`Option ${opt.id} text or math like $x = 4$` }
                        value={opt.text}
                        onChange={(e) => updateOptionText(idx, e.target.value)}
                        className="h-8 text-xs flex-1"
                      />

                      {options.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOption(idx)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  💡 Click the letter badge (<span className="text-emerald-600 font-bold">A, B, C...</span>) to set it as the correct answer.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Correct Answer *
                </label>
                <Input
                  placeholder="Enter the correct answer statement or formula..."
                  value={manualCorrectAnswer}
                  onChange={(e) => setManualCorrectAnswer(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            )}

            {/* 6. Explanation / Solution */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Explanation & Step-by-Step Solution (Optional)
                </label>
                <span className="text-[11px] text-muted-foreground">LaTeX supported</span>
              </div>
              <Textarea
                placeholder="Explain the step-by-step resolution. Example: Using identity $(a+b)^2 = a^2 + 2ab + b^2$..."
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={3}
                className="text-xs leading-relaxed"
              />
            </div>

            {/* 7. Sub-Admin Approval Option */}
            {user?.role === 'subadmin' && (
              <div className="flex items-center space-x-2.5 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                <Checkbox
                  id="subadmin-approval"
                  checked={submitForApproval}
                  onCheckedChange={(checked) => setSubmitForApproval(!!checked)}
                />
                <label
                  htmlFor="subadmin-approval"
                  className="text-xs font-medium leading-none cursor-pointer flex items-center gap-1.5 text-emerald-800"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Request Super Admin approval immediately after creating
                </label>
              </div>
            )}
          </div>

          {/* ── Right Column: Live KaTeX & Diagram Preview ── */}
          {showPreview && (
            <div className="lg:col-span-5 space-y-3">
              <div className="sticky top-20">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Eye className="h-3.5 w-3.5 text-primary" /> Real-Time Live Preview
                </span>

                <Card className="p-4 border rounded-xl bg-card shadow-sm space-y-4">
                  {/* Preview Header Badges */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      {difficulty.toUpperCase()}
                    </Badge>
                    <Badge variant="outline">{questionType.toUpperCase()}</Badge>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      {marks} mark{marks !== '1' ? 's' : ''}
                    </Badge>
                    {(selectedSubject || selectedChapter) && (
                      <span className="text-[11px] text-muted-foreground ml-auto truncate max-w-[180px]">
                        {selectedSubject} {selectedChapter ? `• ${selectedChapter}` : ''}
                      </span>
                    )}
                  </div>

                  {/* Question Statement Rendered */}
                  <div className="text-sm font-medium leading-relaxed border-b pb-3">
                    {questionText.trim() ? (
                      <MathText>{questionText}</MathText>
                    ) : (
                      <span className="text-muted-foreground italic text-xs">
                        Question statement will render formatted math here...
                      </span>
                    )}
                  </div>

                  {/* Figure Preview */}
                  {imageUrl && (
                    <div className="p-2 border rounded-lg bg-background flex flex-col items-center">
                      <img src={imageUrl} alt="Figure Preview" className="max-h-48 object-contain rounded" />
                      <span className="text-[10px] text-muted-foreground mt-1">Figure attached</span>
                    </div>
                  )}

                  {/* Options List Rendered */}
                  {(questionType === 'mcq' || questionType === 'single_choice' || questionType === 'multiple_choice') && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase text-muted-foreground">Options:</p>
                      <div className="bg-muted/40 rounded-lg divide-y divide-border/60 text-xs">
                        {options.map((opt) => (
                          <div
                            key={opt.id}
                            className={`p-2 flex items-center gap-2 ${
                              correctOptionId === opt.id ? 'bg-emerald-500/10 font-medium text-emerald-800' : ''
                            }`}
                          >
                            <span className="font-bold shrink-0">{opt.id}.</span>
                            <div className="flex-1">
                              {opt.text ? <MathText>{opt.text}</MathText> : <span className="text-muted-foreground italic">Option text...</span>}
                            </div>
                            {correctOptionId === opt.id && (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Correct Answer Rendered */}
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                    <p className="font-semibold text-emerald-800 mb-0.5">Correct Answer:</p>
                    <div className="text-emerald-900 font-medium">
                      {questionType === 'mcq' || questionType === 'single_choice' || questionType === 'multiple_choice' ? (
                        (() => {
                          const o = options.find((x) => x.id === correctOptionId);
                          return o ? <MathText>{`${o.id}. ${o.text}`}</MathText> : '—';
                        })()
                      ) : (
                        manualCorrectAnswer ? <MathText>{manualCorrectAnswer}</MathText> : '—'
                      )}
                    </div>
                  </div>

                  {/* Explanation Rendered */}
                  {explanation.trim() && (
                    <div className="p-2.5 rounded-lg bg-muted/50 border border-border text-xs space-y-1">
                      <p className="font-semibold text-muted-foreground">Explanation:</p>
                      <div className="text-muted-foreground leading-relaxed">
                        <MathText block>{explanation}</MathText>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t bg-muted/20 sticky bottom-0 z-10 backdrop-blur flex items-center justify-between sm:justify-between">
          <Button type="button" variant="outline" size="sm" onClick={resetForm}>
            Reset Form
          </Button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting || !questionText.trim()}
              className="bg-primary text-primary-foreground gap-1.5 shadow-sm"
            >
              {isSubmitting ? (
                'Saving...'
              ) : user?.role === 'subadmin' && submitForApproval ? (
                <>
                  <ShieldCheck className="h-4 w-4" /> Save & Request Approval
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Save Question
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
