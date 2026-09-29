import React, { useState, useEffect, useRef } from 'react';
import { 
  FileUp, 
  Sparkles, 
  Layers, 
  LibraryBig, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Trash2, 
  BookOpen, 
  FileText, 
  ChevronRight, 
  ChevronDown, 
  Check, 
  Copy, 
  RotateCcw,
  Plus,
  ArrowRight,
  Database,
  Wand2,
  RefreshCw,
  HelpCircle,
  ExternalLink,
  Image as ImageIcon,
  Maximize2,
  Download,
  ZoomIn,
  Link2,
  Code,
  X,
  Server,
  Activity,
  Settings2,
  UploadCloud,
  Globe,
  FileCheck
} from 'lucide-react';
import { useAuthStore } from '@/hooks/use-auth';
import { 
  useListBoards, 
  useListStandards, 
  useListSubjects, 
  useListAiProviders,
  useListQuestionTypes,
} from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { MathText } from '@/lib/math-text';

export const DEFAULT_DOCLING_API_BASE = 'https://3w7qjzkr-3001.inc1.devtunnels.ms';

export interface DoclingProcessResult {
  markdown: string;
  markdownUrl?: string;
  files: string[];
  imageUrls: string[];
  processingTimeMs: number;
}

/**
 * Sends a PDF file to the Docling Document AI Processing API and polls until complete
 */
export async function processPdfWithDocling(
  file: File,
  apiBase: string = DEFAULT_DOCLING_API_BASE,
  onStatusUpdate?: (status: string, elapsedMs?: number, progress?: number) => void
): Promise<DoclingProcessResult> {
  const cleanBase = (apiBase || DEFAULT_DOCLING_API_BASE).replace(/\/+$/, '');

  // 1. Prepare Form Data
  const formData = new FormData();
  formData.append('pdf', file);

  // 2. Upload PDF & get Job ID immediately
  if (onStatusUpdate) onStatusUpdate('Uploading PDF to Docling AI server...', 0, 15);
  
  const uploadRes = await fetch(`${cleanBase}/api/process-pdf`, {
    method: 'POST',
    body: formData,
  });

  const uploadData = await uploadRes.json();
  if (!uploadRes.ok || !uploadData.success) {
    throw new Error(uploadData.error || uploadData.message || 'Failed to upload PDF to Docling server.');
  }

  const { jobId } = uploadData;
  if (onStatusUpdate) onStatusUpdate('Docling processing queued...', 0, 30);

  // 3. Poll GET /api/process-pdf/:jobId every 2.5 seconds
  const pollInterval = 2500;
  let elapsedPolling = 0;

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    elapsedPolling += pollInterval;

    const pollRes = await fetch(`${cleanBase}/api/process-pdf/${jobId}`);
    if (!pollRes.ok) {
      throw new Error(`Docling API returned HTTP ${pollRes.status} during job polling`);
    }
    const job = await pollRes.json();

    if (job.status === 'queued') {
      if (onStatusUpdate) onStatusUpdate('Queued (waiting for Docling server capacity)...', job.elapsedTimeMs || elapsedPolling, 40);
      continue;
    }

    if (job.status === 'processing') {
      const elapsedSec = ((job.elapsedTimeMs || elapsedPolling) / 1000).toFixed(1);
      const simulatedProgress = Math.min(90, 40 + Math.round(elapsedPolling / 1000) * 5);
      if (onStatusUpdate) onStatusUpdate(`Docling AI extracting layout, LaTeX math & tables (${elapsedSec}s)...`, job.elapsedTimeMs || elapsedPolling, simulatedProgress);
      continue;
    }

    if (job.status === 'completed') {
      if (onStatusUpdate) onStatusUpdate('Docling extraction complete!', job.processingTimeMs, 100);

      // Prefix relative markdown image URLs with full server base URL
      const markdownWithFullUrls = (job.markdown || '').replace(
        /!\[(.*?)\]\(\/api\/files\/(.*?)\)/g,
        `![$1](${cleanBase}/api/files/$2)`
      );

      const allFiles = Array.isArray(job.files)
        ? job.files.map((path: string) => path.startsWith('http') ? path : `${cleanBase}${path.startsWith('/') ? '' : '/'}${path}`)
        : [];

      const imageUrls = allFiles.filter((f: string) => /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(f));

      return {
        markdown: markdownWithFullUrls,
        markdownUrl: job.markdownUrl ? `${cleanBase}${job.markdownUrl.startsWith('/') ? '' : '/'}${job.markdownUrl}` : undefined,
        files: allFiles,
        imageUrls,
        processingTimeMs: job.processingTimeMs || elapsedPolling,
      };
    }

    if (job.status === 'failed') {
      throw new Error(job.error || 'Docling document processing failed.');
    }
  }
}

export interface ExtractedPdfImage {
  id: string;
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
  name?: string;
}

interface ExtractedChapter {
  id?: string;
  name: string;
  description?: string;
  orderIndex?: number;
  selected?: boolean;
}

interface ExtractedTopic {
  id?: string;
  name: string;
  description?: string;
  chapterName: string;
  selected?: boolean;
}

export const AVAILABLE_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'mr', label: 'Marathi', native: 'મરાઠી', flag: '🇮🇳' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা', flag: '🇮🇳' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം', flag: '🇮🇳' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { code: 'ur', label: 'Urdu', native: 'اردو', flag: '🇮🇳' },
];

export const DEFAULT_QUESTION_TYPES = [
  { id: 'mcq', name: 'Multiple Choice (MCQ)', slug: 'mcq', icon: '🔘' },
  { id: 'true-false', name: 'True / False', slug: 'true-false', icon: '⚖️' },
  { id: 'fill-blank', name: 'Fill in Blanks', slug: 'fill-blank', icon: '✍️' },
  { id: 'short-answer', name: 'Short Answer', slug: 'short-answer', icon: '📝' },
  { id: 'long-answer', name: 'Long Answer', slug: 'long-answer', icon: '📄' },
  { id: 'very-short', name: 'Very Short Answer', slug: 'very-short', icon: '⚡' },
  { id: 'assertion-reason', name: 'Assertion & Reason', slug: 'assertion-reason', icon: '🧠' },
  { id: 'match-following', name: 'Match Following', slug: 'match-following', icon: '🔗' },
  { id: 'hots', name: 'HOTS Questions', slug: 'hots', icon: '🔥' },
  { id: 'numerical', name: 'Numerical / Math', slug: 'numerical', icon: '🔢' },
  { id: 'case-study', name: 'Case Study', slug: 'case-study', icon: '📊' },
  { id: 'one-word', name: 'One Word', slug: 'one-word', icon: '💡' },
];

interface ExtractedQuestion {
  id?: string;
  question: string;
  questionType?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  difficultyScore?: number;
  correctAnswer?: string;
  options?: Array<{ id: string; text: string }> | null;
  explanation?: string;
  marks?: number;
  chapterName?: string;
  topicName?: string;
  imageRef?: string;
  imageUrl?: string;
  selected?: boolean;
  isAiGeneratedVariant?: boolean;
  translations?: Record<string, {
    question: string;
    options?: Array<{ id: string; text: string }> | null;
    explanation?: string;
    correctAnswer?: string;
  }>;
}

/**
 * Resolves diagram image URL for a question by matching the exact image name,
 * full filename, base name, numeric index, URL, or embedded markdown image reference.
 */
export function resolveQuestionDiagramImage(
  q: any,
  imagesList: ExtractedPdfImage[],
  doclingBase: string = DEFAULT_DOCLING_API_BASE
): string | undefined {
  if (!q || !imagesList || imagesList.length === 0) return undefined;

  const cleanBase = (doclingBase || DEFAULT_DOCLING_API_BASE).replace(/\/+$/, '');

  // Helper: extracts the clean filename from any path/URL (e.g. "/api/files/job/image_0.png" -> "image_0.png")
  const getBasename = (str: string): string => {
    if (!str) return '';
    const clean = str.split('?')[0].split('#')[0].trim();
    const parts = clean.split(/[/\\]/);
    return parts[parts.length - 1] || clean;
  };

  // Helper: removes file extension (e.g. "image_0.png" -> "image_0")
  const stripExt = (str: string): string => {
    return str.replace(/\.(png|jpe?g|webp|gif|svg)$/i, '').trim();
  };

  // 1. Direct valid absolute HTTP or data: URL in imageUrl
  if (q.imageUrl && typeof q.imageUrl === 'string' && q.imageUrl.trim()) {
    let url = q.imageUrl.trim();
    if (url.startsWith('/api/files/')) {
      url = `${cleanBase}${url}`;
    }
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/')) {
      return url;
    }
  }

  // 2. Gather all candidate references from AI question object
  const candidates: string[] = [];

  const addCandidate = (val: any) => {
    if (val == null) return;
    if (typeof val === 'number') {
      candidates.push(String(val));
    } else if (typeof val === 'string' && val.trim()) {
      candidates.push(val.trim());
    }
  };

  addCandidate(q.imageRef);
  addCandidate(q.image_ref);
  addCandidate(q.image);
  addCandidate(q.diagramRef);
  addCandidate(q.imageUrl);
  addCandidate(q.image_name);
  addCandidate(q.imageName);
  addCandidate(q.figure);

  // 3. For every candidate reference returned by AI, attempt matching against imagesList
  for (const raw of candidates) {
    const cleanRef = raw.replace(/[\[\]]/g, '').trim();
    const refBasename = getBasename(cleanRef).toLowerCase();
    const refBaseNoExt = stripExt(refBasename).toLowerCase();

    // A) Direct matching against image URLs / filenames
    for (const img of imagesList) {
      const imgDataUrl = img.dataUrl || '';
      const imgName = (img.name || '').toLowerCase();
      const imgBasename = getBasename(imgDataUrl).toLowerCase();
      const imgBaseNoExt = stripExt(imgBasename).toLowerCase();

      // Exact filename match (e.g. "image_0.png" === "image_0.png" or "Docling Diagram: image_0.png")
      if (refBasename && (imgBasename === refBasename || imgName.includes(refBasename))) {
        return imgDataUrl.startsWith('/api/files/') ? `${cleanBase}${imgDataUrl}` : imgDataUrl;
      }

      // Base name match without extension (e.g. "image_0" === "image_0")
      if (refBaseNoExt && (imgBaseNoExt === refBaseNoExt || imgName.includes(refBaseNoExt))) {
        return imgDataUrl.startsWith('/api/files/') ? `${cleanBase}${imgDataUrl}` : imgDataUrl;
      }

      // Exact full URL or path match
      if (cleanRef.toLowerCase() === imgDataUrl.toLowerCase() || imgDataUrl.toLowerCase().endsWith(cleanRef.toLowerCase())) {
        return imgDataUrl.startsWith('/api/files/') ? `${cleanBase}${imgDataUrl}` : imgDataUrl;
      }
    }

    // B) Tag matching: IMAGE_1, IMAGE_2, IMAGE_0, etc.
    const tagMatch = cleanRef.match(/IMAGE_?(\d+)/i) || cleanRef.match(/FIGURE_?(\d+)/i) || cleanRef.match(/FIG_?(\d+)/i) || cleanRef.match(/^(\d+)$/);
    if (tagMatch) {
      const num = parseInt(tagMatch[1], 10);
      // Try 1-based index (IMAGE_1 -> index 0)
      if (num >= 1 && imagesList[num - 1]?.dataUrl) {
        const u = imagesList[num - 1].dataUrl;
        return u.startsWith('/api/files/') ? `${cleanBase}${u}` : u;
      }
      // Try 0-based index (IMAGE_0 -> index 0)
      if (num === 0 && imagesList[0]?.dataUrl) {
        const u = imagesList[0].dataUrl;
        return u.startsWith('/api/files/') ? `${cleanBase}${u}` : u;
      }
    }

    // C) Direct /api/files/ or HTTP URL in candidate
    if (cleanRef.startsWith('/api/files/')) {
      return `${cleanBase}${cleanRef}`;
    }
    if (cleanRef.startsWith('http://') || cleanRef.startsWith('https://') || cleanRef.startsWith('data:image/')) {
      return cleanRef;
    }
  }

  // 4. Fallback: Search question text, title, and explanation for image filenames or tags
  const combinedText = `${q.question || q.questionText || ''} ${q.explanation || ''} ${q.solution || ''}`;

  // Search for direct image filenames like image_0.png, figure_1.png in text
  for (const img of imagesList) {
    const imgBasename = getBasename(img.dataUrl).toLowerCase();
    if (imgBasename && combinedText.toLowerCase().includes(imgBasename)) {
      return img.dataUrl.startsWith('/api/files/') ? `${cleanBase}${img.dataUrl}` : img.dataUrl;
    }
  }

  // Search for [IMAGE_N] or IMAGE_N in text
  const textMatch = combinedText.match(/\[IMAGE_?(\d+)\]/i) || combinedText.match(/\bIMAGE_(\d+)\b/i) || combinedText.match(/!\[.*?\]\((.*?)\)/);
  if (textMatch) {
    if (textMatch[1] && /^\d+$/.test(textMatch[1])) {
      const idx = parseInt(textMatch[1], 10) - 1;
      if (idx >= 0 && imagesList[idx]?.dataUrl) {
        const u = imagesList[idx].dataUrl;
        return u.startsWith('/api/files/') ? `${cleanBase}${u}` : u;
      }
    } else if (textMatch[1]) {
      const matchedPath = textMatch[1].trim();
      const matchedBase = getBasename(matchedPath).toLowerCase();
      const found = imagesList.find(img => getBasename(img.dataUrl).toLowerCase() === matchedBase);
      if (found?.dataUrl) {
        return found.dataUrl.startsWith('/api/files/') ? `${cleanBase}${found.dataUrl}` : found.dataUrl;
      }
    }
  }

  return undefined;
}

export default function PdfExtractorPage() {
  const { toast } = useToast();
  const token = useAuthStore((s) => s.token);

  // Question Types Data
  const { data: dbQuestionTypes } = useListQuestionTypes();
  const availableQuestionTypesList = React.useMemo(() => {
    if (dbQuestionTypes?.data && dbQuestionTypes.data.length > 0) {
      return dbQuestionTypes.data.map((qt: any) => ({
        id: String(qt.id),
        name: qt.name,
        slug: qt.slug || qt.name.toLowerCase().replace(/\s+/g, '-'),
        icon: DEFAULT_QUESTION_TYPES.find(d => d.slug === qt.slug)?.icon || '📝',
      }));
    }
    return DEFAULT_QUESTION_TYPES;
  }, [dbQuestionTypes]);

  // Hierarchy Data
  const { data: boards } = useListBoards();
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const { data: standards } = useListStandards(
    selectedBoardId ? { boardId: parseInt(selectedBoardId) } : undefined
  );
  const [selectedStandardId, setSelectedStandardId] = useState<string>('');
  const { data: subjects } = useListSubjects(
    selectedStandardId ? { standardId: parseInt(selectedStandardId) } : undefined
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  // AI Providers Data
  const { data: providers } = useListAiProviders();
  const [providerId, setProviderId] = useState<string>('');
  const [model, setModel] = useState<string>('');

  // State: Step 1 PDF Upload & Docling Processing
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [processingStatusText, setProcessingStatusText] = useState('');
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractedText, setExtractedText] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State: Docling API Endpoint Integration
  const [doclingApiUrl, setDoclingApiUrl] = useState<string>(() => {
    return localStorage.getItem('docling_api_url') || DEFAULT_DOCLING_API_BASE;
  });
  const [doclingServerStatus, setDoclingServerStatus] = useState<'unknown' | 'checking' | 'online' | 'offline'>('unknown');
  const [doclingEngineInfo, setDoclingEngineInfo] = useState<{ engine?: string; doclingAvailable?: boolean; maxConcurrentJobs?: number } | null>(null);
  const [lastExtractionSource, setLastExtractionSource] = useState<'docling' | null>(null);

  // Check Docling Server Health on load and when endpoint URL changes
  const checkDoclingHealth = async (urlToCheck?: string) => {
    const targetUrl = (urlToCheck || doclingApiUrl).replace(/\/+$/, '');
    setDoclingServerStatus('checking');
    try {
      const res = await fetch(`${targetUrl}/api/health`, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        setDoclingServerStatus('online');
        setDoclingEngineInfo(data);
      } else {
        setDoclingServerStatus('offline');
      }
    } catch {
      setDoclingServerStatus('offline');
    }
  };

  useEffect(() => {
    checkDoclingHealth();
  }, [doclingApiUrl]);

  // State: Diagrams & Images (Extracted automatically by Docling AI)
  const [extractedImages, setExtractedImages] = useState<ExtractedPdfImage[]>([]);
  const [imagePreviewModal, setImagePreviewModal] = useState<ExtractedPdfImage | null>(null);
  const [targetQuestionForImage, setTargetQuestionForImage] = useState<string | null>(null);
  const [isAttachPickerOpen, setIsAttachPickerOpen] = useState(false);

  // State: Step 2 Extraction Settings, Question Types & Multi-Language
  const [mode, setMode] = useState<'full' | 'curriculum' | 'questions'>('full');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['en']);
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiProgressText, setAiProgressText] = useState('');
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [isJsonDialogOpen, setIsJsonDialogOpen] = useState(false);
  const [rawJsonInput, setRawJsonInput] = useState('');

  // State: Step 3 Extracted Review Items & Language Switcher
  const [chapters, setChapters] = useState<ExtractedChapter[]>([]);
  const [topics, setTopics] = useState<ExtractedTopic[]>([]);
  const [questions, setQuestions] = useState<ExtractedQuestion[]>([]);
  const [activeReviewTab, setActiveReviewTab] = useState<'chapters' | 'questions' | 'images' | 'rawText'>('chapters');
  const [activeViewLang, setActiveViewLang] = useState<string>('en');
  const [isDualView, setIsDualView] = useState(false);
  const [isTranslatingQuestions, setIsTranslatingQuestions] = useState(false);
  const [translateTargetLang, setTranslateTargetLang] = useState<string>('gu');
  const [isSolvingQuestions, setIsSolvingQuestions] = useState(false);

  // Helper to reliably check if an option is the correct answer
  const isOptionCorrect = (correctAnswer?: string, opt?: { id: string; text: string }) => {
    if (!correctAnswer || !opt) return false;
    const ans = String(correctAnswer).trim().toLowerCase();
    const optId = String(opt.id || '').trim().toLowerCase();
    const optText = String(opt.text || '').trim().toLowerCase();
    if (ans === optId || (optText && ans === optText)) return true;
    if (
      ans.startsWith(optId + '.') ||
      ans.startsWith(optId + ')') ||
      ans.startsWith(optId + ':') ||
      ans.startsWith(optId + ' ') ||
      ans.startsWith('option ' + optId)
    ) {
      return true;
    }
    if (optText.length > 0 && (ans === optText || ans.endsWith(optText) || ans.includes(optText))) {
      return true;
    }
    return false;
  };

  // State: Similar Question Generation
  const [generatingForId, setGeneratingForId] = useState<string | null>(null);
  const [isGeneratingBulkSimilar, setIsGeneratingBulkSimilar] = useState(false);

  // State: Step 4 Saving
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<{
    savedChapters: number;
    savedTopics: number;
    savedQuestions: number;
  } | null>(null);

  const toggleLanguageSelection = (code: string) => {
    setSelectedLanguages((prev) => {
      if (code === 'en') {
        if (prev.includes('en') && prev.length === 1) return prev;
        return prev.includes('en') ? prev.filter((c) => c !== 'en') : ['en', ...prev];
      }
      if (prev.includes(code)) {
        return prev.filter((c) => c !== code);
      } else {
        return [...prev, code];
      }
    });
  };

  const toggleQuestionType = (slug: string) => {
    setSelectedQuestionTypes((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleImportDirectJson = (rawInput: string) => {
    try {
      if (!rawInput.trim()) {
        toast({ variant: 'destructive', title: 'Empty JSON', description: 'Please paste valid JSON first.' });
        return;
      }
      let clean = rawInput.trim();
      clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      
      let data: any;
      try {
        data = JSON.parse(clean);
      } catch {
        // Auto-repair single LaTeX backslashes
        const repaired = clean.replace(/(?<!\\)\\([a-zA-Z]+|[^"\\/bfnrtu0-9])/g, (_match, p1) => '\\\\' + p1);
        data = JSON.parse(repaired);
      }

      let rawChapters: any[] = [];
      let rawTopics: any[] = [];
      let rawQuestions: any[] = [];

      if (Array.isArray(data)) {
        if (data.length > 0 && (data[0].question || data[0].questionText || data[0].options)) {
          rawQuestions = data;
        } else {
          rawChapters = data;
        }
      } else if (typeof data === 'object' && data !== null) {
        rawChapters = data.chapters || data.Chapters || [];
        rawTopics = data.topics || data.Topics || [];
        rawQuestions = data.questions || data.Questions || [];
      }

      const chaps = rawChapters.map((c: any, i: number) => ({
        name: typeof c === 'string' ? c.trim() : String(c.name || `Chapter ${i + 1}`).trim(),
        description: typeof c === 'string' ? '' : String(c.description || '').trim(),
        orderIndex: typeof c.orderIndex === 'number' ? c.orderIndex : i + 1,
        id: `c_${i}_${Date.now()}`,
        selected: true,
      }));

      const tops = rawTopics.map((t: any, i: number) => ({
        name: typeof t === 'string' ? t.trim() : String(t.name || `Topic ${i + 1}`).trim(),
        description: typeof t === 'string' ? '' : String(t.description || '').trim(),
        chapterName: String(t.chapterName || chaps[0]?.name || '').trim(),
        id: `t_${i}_${Date.now()}`,
        selected: true,
      }));

      const qs = rawQuestions.map((q: any, i: number) => {
        let options = q.options;
        if (Array.isArray(options)) {
          options = options.map((opt: any, idx: number) => {
            if (typeof opt === 'string') {
              return { id: String.fromCharCode(65 + idx), text: opt };
            }
            return {
              id: String(opt.id || String.fromCharCode(65 + idx)),
              text: String(opt.text || opt.value || ''),
            };
          });
        }
        const resolvedImage = resolveQuestionDiagramImage(q, extractedImages, doclingApiUrl);
        return {
          question: String(q.question || q.questionText || '').trim(),
          questionType: q.questionType || (options && options.length > 0 ? 'single_choice' : 'subjective'),
          difficulty: q.difficulty || 'medium',
          correctAnswer: q.correctAnswer != null ? String(q.correctAnswer).trim() : undefined,
          options: options || null,
          explanation: q.explanation != null ? String(q.explanation).trim() : '',
          marks: typeof q.marks === 'number' ? q.marks : 4,
          chapterName: q.chapterName || chaps[0]?.name || '',
          topicName: q.topicName || tops[0]?.name || '',
          imageUrl: resolvedImage || (typeof q.imageUrl === 'string' && q.imageUrl.trim() ? q.imageUrl.trim() : undefined),
          imageRef: q.imageRef || q.image_ref || undefined,
          id: `q_${i}_${Date.now()}`,
          selected: true,
        };
      });

      setChapters(chaps);
      setTopics(tops);
      setQuestions(qs);
      setSaveSuccess(null);
      setExtractionError(null);
      setIsJsonDialogOpen(false);
      setRawJsonInput('');

      if (qs.length > 0 && chaps.length === 0) {
        setActiveReviewTab('questions');
      } else {
        setActiveReviewTab('chapters');
      }

      toast({
        title: 'JSON Loaded Successfully!',
        description: `Loaded ${chaps.length} Chapters, ${tops.length} Topics, and ${qs.length} Questions into Review.`,
      });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'JSON Parse Error',
        description: e.message || 'Could not parse the pasted JSON.',
      });
    }
  };

  const boardsList: any[] = Array.isArray(boards) ? boards : (boards as any)?.data || [];
  const standardsList: any[] = Array.isArray(standards) ? standards : (standards as any)?.data || [];
  const subjectsList: any[] = Array.isArray(subjects) ? subjects : (subjects as any)?.data || [];
  const providersList: any[] = Array.isArray(providers) ? providers : (providers as any)?.data || [];

  // Auto-select active provider
  useEffect(() => {
    if (providersList && providersList.length > 0 && !providerId) {
      const active = providersList.find((p: any) => p.isActive) || providersList[0];
      if (active) {
        setProviderId(active.id.toString());
        setModel(active.defaultModel || active.availableModels?.[0] || '');
      }
    }
  }, [providersList, providerId]);

  const selectedProvider = providersList?.find((p: any) => p.id === Number(parseInt(providerId)));

  // Process uploaded PDF through Docling AI Server API
  const processUploadedPdfFile = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      toast({ variant: 'destructive', title: 'Invalid File', description: 'Please upload a valid PDF document.' });
      return;
    }

    setPdfFile(file);
    setIsExtractingText(true);
    setExtractionProgress(10);
    setExtractedText('');
    setExtractedImages([]);
    setSaveSuccess(null);
    setExtractionError(null);
    setProcessingStatusText('Connecting to Docling AI Processing Server...');

    try {
      const doclingResult = await processPdfWithDocling(file, doclingApiUrl, (status, _elapsedMs, progress) => {
        setProcessingStatusText(status);
        if (progress != null) setExtractionProgress(progress);
      });

      if (doclingResult.markdown && doclingResult.markdown.trim().length > 0) {
        setExtractedText(doclingResult.markdown);
        setLastExtractionSource('docling');

        // Estimate pages from markdown headers or length
        const estimatedPages = Math.max(
          1,
          (doclingResult.markdown.match(/<!-- page \d+ -->|# Page \d+|--- Page \d+/gi) || []).length ||
          Math.ceil(doclingResult.markdown.split(/\s+/).length / 400)
        );
        setPageCount(estimatedPages);

        // Store Docling extracted PNG images
        const targetImages = doclingResult.imageUrls.length > 0
          ? doclingResult.imageUrls
          : doclingResult.files.filter((f) => /\.(png|jpe?g|webp|gif|svg)/i.test(f));

        if (targetImages.length > 0) {
          const doclingImages: ExtractedPdfImage[] = targetImages.map((fileUrl, idx) => {
            const filename = fileUrl.split('/').pop() || `figure_${idx + 1}.png`;
            return {
              id: `docling_fig_${idx}_${Date.now()}`,
              pageNumber: 1,
              dataUrl: fileUrl,
              width: 800,
              height: 600,
              name: `Docling Diagram: ${filename}`,
            };
          });
          setExtractedImages(doclingImages);
        }

        toast({
          title: '✨ Docling AI Extraction Complete',
          description: `Extracted rich Markdown with LaTeX formulas, tables & ${targetImages.length} diagram(s) in ${(doclingResult.processingTimeMs / 1000).toFixed(1)}s.`,
        });
      } else {
        throw new Error('Docling returned empty Markdown content from the PDF.');
      }
    } catch (doclingErr: any) {
      console.error('Docling API processing error:', doclingErr);
      setExtractionError(doclingErr.message || 'Docling document processing failed.');
      toast({
        variant: 'destructive',
        title: 'Docling Processing Failed',
        description: doclingErr.message || 'Could not process PDF on Docling server. Check that the dev tunnel is active.',
      });
    } finally {
      setIsExtractingText(false);
      setExtractionProgress(100);
      setProcessingStatusText('');
    }
  };

  // Handle PDF File Upload via input element
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processUploadedPdfFile(file);
    // Reset file input value so user can upload the same file again if desired
    if (e.target) e.target.value = '';
  };

  // Handle Drag and Drop for PDF Upload
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processUploadedPdfFile(file);
    }
  };

  // Helper to translate an array of questions into a target language with client-side chunking
  const translateQuestionsList = async (
    qs: ExtractedQuestion[],
    targetLang: string,
    effProviderId: string,
    effModel: string
  ): Promise<ExtractedQuestion[]> => {
    if (!qs || qs.length === 0) return qs;
    
    const CLIENT_CHUNK = 3;
    let accumulated: ExtractedQuestion[] = [...qs];

    for (let i = 0; i < qs.length; i += CLIENT_CHUNK) {
      const slice = accumulated.slice(i, i + CLIENT_CHUNK);
      try {
        const res = await fetch('/api/ai/batch-translate-questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            questions: slice,
            targetLanguage: targetLang,
            providerId: effProviderId || undefined,
            model: effModel,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.questions && Array.isArray(data.questions)) {
            data.questions.forEach((updatedQ: ExtractedQuestion, idx: number) => {
              accumulated[i + idx] = updatedQ;
            });
          }
        }
      } catch (chunkErr) {
        console.warn(`Chunk [${i}..${i + CLIENT_CHUNK}] translation error for ${targetLang}:`, chunkErr);
      }
    }

    return accumulated;
  };

  // Manual on-demand translation of all review questions
  const handleTranslateAllQuestions = async (targetLang: string) => {
    if (questions.length === 0) {
      toast({ variant: 'destructive', title: 'No Questions Found', description: 'Extract or generate questions first.' });
      return;
    }
    const effectiveProviderId = providerId || (providersList.find((p: any) => p.isActive) || providersList[0])?.id?.toString();
    const activeProv = providersList.find((p: any) => p.id?.toString() === effectiveProviderId);
    const effectiveModel = model || activeProv?.defaultModel || activeProv?.availableModels?.[0] || 'gemini-2.0-flash';

    if (!effectiveProviderId) {
      toast({ variant: 'destructive', title: 'Provider Required', description: 'Please configure at least one AI Provider.' });
      return;
    }

    const lObj = AVAILABLE_LANGUAGES.find((al) => al.code === targetLang);
    const lName = lObj ? `${lObj.label} (${lObj.native})` : targetLang;

    setIsTranslatingQuestions(true);
    try {
      const updated = await translateQuestionsList(questions, targetLang, effectiveProviderId, effectiveModel);
      setQuestions(updated);
      if (!selectedLanguages.includes(targetLang)) {
        setSelectedLanguages((prev) => [...prev, targetLang]);
      }
      setActiveViewLang(targetLang);
      toast({
        title: `✨ Translation Complete!`,
        description: `Successfully translated questions into ${lName}.`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Translation Failed',
        description: err.message || 'Could not complete translation.',
      });
    } finally {
      setIsTranslatingQuestions(false);
    }
  };

  // Dedicated function to auto-solve all or specific questions to compute answers & step-by-step solutions
  const handleSolveMissingAnswers = async (targetQuestions?: ExtractedQuestion[]) => {
    const qsToSolve = targetQuestions || questions;
    if (qsToSolve.length === 0) {
      toast({ variant: 'destructive', title: 'No Questions Found', description: 'Extract or load questions first.' });
      return;
    }
    const effectiveProviderId = providerId || (providersList.find((p: any) => p.isActive) || providersList[0])?.id?.toString();
    const activeProv = providersList.find((p: any) => p.id?.toString() === effectiveProviderId);
    const effectiveModel = model || activeProv?.defaultModel || activeProv?.availableModels?.[0] || 'gemini-2.0-flash';

    if (!effectiveProviderId) {
      toast({ variant: 'destructive', title: 'Provider Required', description: 'Please configure at least one AI Provider.' });
      return;
    }

    setIsSolvingQuestions(true);
    try {
      const CLIENT_CHUNK = 4;
      let accumulated = [...qsToSolve];

      for (let i = 0; i < qsToSolve.length; i += CLIENT_CHUNK) {
        const slice = accumulated.slice(i, i + CLIENT_CHUNK);
        try {
          const res = await fetch('/api/ai/solve-missing-answers', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              questions: slice,
              providerId: effectiveProviderId || undefined,
              model: effectiveModel,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.questions && Array.isArray(data.questions)) {
              data.questions.forEach((solvedQ: ExtractedQuestion, idx: number) => {
                const originalQ = accumulated[i + idx];
                const resolvedImg = resolveQuestionDiagramImage(solvedQ, extractedImages, doclingApiUrl) || solvedQ.imageUrl || originalQ?.imageUrl;
                accumulated[i + idx] = {
                  ...solvedQ,
                  imageUrl: resolvedImg,
                };
              });
            }
          }
        } catch (chunkErr) {
          console.warn(`Chunk solve error:`, chunkErr);
        }
      }

      if (targetQuestions && targetQuestions.length === 1) {
        const solvedQ = accumulated[0];
        setQuestions((prev) => prev.map((q) => (q.id === solvedQ.id ? { ...q, ...solvedQ } : q)));
      } else {
        setQuestions(accumulated);
      }

      toast({
        title: '✨ Questions Solved!',
        description: `Successfully computed answers and solutions for ${accumulated.length} questions.`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Solving Failed',
        description: err.message || 'Could not auto-solve questions.',
      });
    } finally {
      setIsSolvingQuestions(false);
    }
  };

  // Run AI Extraction with Multi-Language & Auto-Solver Pipeline
  const handleRunAiExtraction = async () => {
    if (!extractedText.trim()) {
      toast({ variant: 'destructive', title: 'No Content Found', description: 'Please upload a PDF first.' });
      return;
    }

    // Auto-resolve provider and model if not explicitly selected
    const effectiveProviderId = providerId || (providersList.find((p: any) => p.isActive) || providersList[0])?.id?.toString();
    const activeProv = providersList.find((p: any) => p.id?.toString() === effectiveProviderId);
    const effectiveModel = model || activeProv?.defaultModel || activeProv?.availableModels?.[0] || 'gemini-2.0-flash';

    if (!effectiveProviderId) {
      toast({ variant: 'destructive', title: 'Provider Required', description: 'Please configure at least one AI Provider in settings.' });
      setExtractionError('No AI Provider available. Please go to AI Providers settings and add an active API key.');
      return;
    }

    setIsAiProcessing(true);
    setSaveSuccess(null);
    setExtractionError(null);
    const nonEngLangs = selectedLanguages.filter((l) => l !== 'en');
    const totalSteps = 1 + nonEngLangs.length;
    
    let currentStepLabel = 'Extracting curriculum structure & questions';
    let currentStepNumber = 1;
    let elapsedSeconds = 0;
    
    setAiProgressText(`Step 1/${totalSteps}: ${currentStepLabel} (0s elapsed)...`);

    // Live timer that keeps updating every second during AI processing
    const timerInterval = setInterval(() => {
      elapsedSeconds++;
      setAiProgressText(`Step ${currentStepNumber}/${totalSteps}: ${currentStepLabel} (${elapsedSeconds}s elapsed — processing in background)...`);
    }, 1000);

    try {
      // Start asynchronous extraction job to prevent any network or gateway timeout
      const res = await fetch('/api/ai/extract-from-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: extractedText,
          mode,
          boardId: selectedBoardId ? parseInt(selectedBoardId) : undefined,
          standardId: selectedStandardId ? parseInt(selectedStandardId) : undefined,
          subjectId: selectedSubjectId ? parseInt(selectedSubjectId) : undefined,
          providerId: parseInt(effectiveProviderId),
          model: effectiveModel,
          customPrompt: customPrompt.trim() || undefined,
          questionTypes: selectedQuestionTypes.length > 0 ? selectedQuestionTypes : undefined,
          asyncMode: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'AI Extraction failed to start' }));
        throw new Error(err.error || 'Failed to extract content');
      }

      const startData = await res.json();
      let data: any = null;

      if (startData.jobId) {
        // Poll status every 1.5s until completed or failed
        const jobId = startData.jobId;
        const maxPollSeconds = 3600; // Allow up to 1 hour
        const pollStartTime = Date.now();

        while (true) {
          const pollElapsed = Math.floor((Date.now() - pollStartTime) / 1000);
          if (pollElapsed > maxPollSeconds) {
            throw new Error('AI Extraction exceeded 1 hour limit.');
          }

          await new Promise((r) => setTimeout(r, 1500));

          try {
            const pollRes = await fetch(`/api/ai/extraction-status/${jobId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            if (pollRes.ok) {
              const statusData = await pollRes.json();
              if (statusData.statusText) {
                currentStepLabel = statusData.statusText;
              }

              if (statusData.status === 'completed') {
                data = statusData.result;
                break;
              } else if (statusData.status === 'failed') {
                throw new Error(statusData.error || 'AI Extraction failed on server');
              }
            }
          } catch (pollErr: any) {
            if (pollErr.message && !pollErr.message.includes('fetch')) {
              throw pollErr;
            }
          }
        }
      } else {
        data = startData;
      }

      const chaps = (data.chapters || []).map((c: any, i: number) => ({
        ...c,
        id: `c_${i}_${Date.now()}`,
        selected: true,
      }));

      const tops = (data.topics || []).map((t: any, i: number) => ({
        ...t,
        id: `t_${i}_${Date.now()}`,
        selected: true,
      }));

      let currentQuestions: ExtractedQuestion[] = (data.questions || []).map((q: any, i: number) => {
        let options = q.options;
        if (Array.isArray(options)) {
          options = options.map((opt: any, idx: number) => {
            if (typeof opt === 'string') {
              return { id: String.fromCharCode(65 + idx), text: opt };
            }
            return {
              id: String(opt.id || String.fromCharCode(65 + idx)),
              text: String(opt.text || opt.value || ''),
            };
          });
        }
        const qText = String(q.question || q.questionText || q.statement || q.problem || q.text || q.title || q.name || '').trim();
        const resolvedImage = resolveQuestionDiagramImage(q, extractedImages, doclingApiUrl);
        return {
          ...q,
          question: qText,
          questionType: q.questionType || (options && options.length > 0 ? 'single_choice' : 'subjective'),
          difficulty: q.difficulty || 'medium',
          correctAnswer: q.correctAnswer != null ? String(q.correctAnswer).trim() : undefined,
          options: options || null,
          explanation: String(q.explanation || q.solution || q.answer || '').trim(),
          marks: typeof q.marks === 'number' ? q.marks : 4,
          imageUrl: resolvedImage || (typeof q.imageUrl === 'string' && q.imageUrl.trim() ? q.imageUrl.trim() : undefined),
          imageRef: q.imageRef || q.image_ref || undefined,
          id: `q_${i}_${Date.now()}`,
          selected: true,
          translations: {},
        };
      });

      // Auto-Solve check: If any question is missing a correct answer or explanation, solve it immediately
      const missingAnswers = currentQuestions.some((q) => !q.correctAnswer || !q.explanation);
      if (missingAnswers && currentQuestions.length > 0) {
        currentStepLabel = 'Auto-solving questions for step-by-step solutions';
        setAiProgressText(`Step 1/${totalSteps}: ${currentStepLabel} (${elapsedSeconds}s elapsed)...`);
        try {
          const solveRes = await fetch('/api/ai/solve-missing-answers', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              questions: currentQuestions,
              providerId: parseInt(effectiveProviderId),
              model: effectiveModel,
            }),
          });
          if (solveRes.ok) {
            const solveData = await solveRes.json();
            if (solveData.questions && Array.isArray(solveData.questions)) {
              currentQuestions = solveData.questions;
            }
          }
        } catch (solveErr) {
          console.warn('Auto-solve pass failed:', solveErr);
        }
      }

      // Update state with initial base questions
      setChapters(chaps);
      setTopics(tops);
      setQuestions(currentQuestions);

      // Sequential Translation Pipeline for each selected secondary language
      if (currentQuestions.length > 0 && nonEngLangs.length > 0) {
        for (let i = 0; i < nonEngLangs.length; i++) {
          const lCode = nonEngLangs[i];
          const lObj = AVAILABLE_LANGUAGES.find((al) => al.code === lCode);
          const lName = lObj ? `${lObj.label} (${lObj.native})` : lCode;

          currentStepNumber = i + 2;
          currentStepLabel = `Translating ${currentQuestions.length} questions into ${lName}`;
          setAiProgressText(`Step ${currentStepNumber}/${totalSteps}: ${currentStepLabel} (${elapsedSeconds}s elapsed)...`);

          currentQuestions = await translateQuestionsList(
            currentQuestions,
            lCode,
            effectiveProviderId,
            effectiveModel
          );

          // Update questions state after each language completes
          setQuestions([...currentQuestions]);
        }
      }

      if (currentQuestions.length > 0 && chaps.length === 0) {
        setActiveReviewTab('questions');
      } else {
        setActiveReviewTab('chapters');
      }

      toast({
        title: 'Extraction Complete! 🎉',
        description: `Extracted ${chaps.length} Chapters, ${tops.length} Topics, and ${currentQuestions.length} Questions across ${selectedLanguages.length} language(s) in ${elapsedSeconds}s.`,
      });
    } catch (err: any) {
      setExtractionError(err.message || 'Could not complete AI extraction.');
      toast({
        variant: 'destructive',
        title: 'Extraction Error',
        description: err.message || 'Could not complete AI extraction.',
      });
    } finally {
      clearInterval(timerInterval);
      setIsAiProcessing(false);
      setAiProgressText('');
    }
  };

  // Generate Similar Questions (Few-Shot) with Multi-Language Support
  const handleGenerateSimilarQuestions = async (targetQuestions: ExtractedQuestion[], count = 3, specificId?: string) => {
    if (targetQuestions.length === 0) {
      toast({ variant: 'destructive', title: 'No Question Selected', description: 'Please select an example question first.' });
      return;
    }
    // Auto-resolve provider and model if not explicitly selected
    const effectiveProviderId = providerId || (providersList.find((p: any) => p.isActive) || providersList[0])?.id?.toString();
    const activeProv = providersList.find((p: any) => p.id?.toString() === effectiveProviderId);
    const effectiveModel = model || activeProv?.defaultModel || activeProv?.availableModels?.[0] || 'gemini-2.0-flash';

    if (!effectiveProviderId) {
      toast({ variant: 'destructive', title: 'Provider Required', description: 'Please configure at least one AI Provider in settings.' });
      return;
    }

    if (specificId) {
      setGeneratingForId(specificId);
    } else {
      setIsGeneratingBulkSimilar(true);
    }

    try {
      const res = await fetch('/api/ai/generate-similar-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          exampleQuestions: targetQuestions,
          count,
          providerId: parseInt(effectiveProviderId),
          model: effectiveModel,
          boardId: selectedBoardId ? parseInt(selectedBoardId) : undefined,
          standardId: selectedStandardId ? parseInt(selectedStandardId) : undefined,
          subjectId: selectedSubjectId ? parseInt(selectedSubjectId) : undefined,
          customInstructions: customPrompt.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Generation failed' }));
        throw new Error(err.error || 'Failed to generate similar questions');
      }

      const data = await res.json();
      let newQuestions: ExtractedQuestion[] = (data.questions || []).map((q: any, i: number) => {
        let options = q.options;
        if (Array.isArray(options)) {
          options = options.map((opt: any, idx: number) => {
            if (typeof opt === 'string') {
              return { id: String.fromCharCode(65 + idx), text: opt };
            }
            return {
              id: String(opt.id || String.fromCharCode(65 + idx)),
              text: String(opt.text || opt.value || ''),
            };
          });
        }
        const qText = String(q.question || q.questionText || q.statement || q.problem || q.text || q.title || q.name || '').trim();
        return {
          ...q,
          question: qText,
          questionType: q.questionType || (options && options.length > 0 ? 'single_choice' : 'subjective'),
          difficulty: q.difficulty || 'medium',
          correctAnswer: q.correctAnswer != null ? String(q.correctAnswer).trim() : undefined,
          options: options || null,
          explanation: String(q.explanation || q.solution || q.answer || '').trim(),
          marks: typeof q.marks === 'number' ? q.marks : 4,
          id: `gen_q_${i}_${Date.now()}`,
          selected: true,
          isAiGeneratedVariant: true,
          translations: {},
        };
      });

      if (newQuestions.length === 0) {
        toast({ variant: 'destructive', title: 'No Questions Returned', description: 'AI did not produce new questions. Please try again.' });
        return;
      }

      // If multiple languages are active, translate newly generated questions as well
      const nonEngLangs = selectedLanguages.filter((l) => l !== 'en');
      if (nonEngLangs.length > 0) {
        for (const lCode of nonEngLangs) {
          newQuestions = await translateQuestionsList(newQuestions, lCode, effectiveProviderId, effectiveModel);
        }
      }

      // Prepend new questions
      setQuestions((prev) => [...newQuestions, ...prev]);
      setActiveReviewTab('questions');

      toast({
        title: `✨ Generated ${newQuestions.length} Similar Questions!`,
        description: `Added to the top of your Questions review list in ${selectedLanguages.length} language(s).`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: err.message || 'Could not generate similar questions.',
      });
    } finally {
      setGeneratingForId(null);
      setIsGeneratingBulkSimilar(false);
    }
  };

  // Auto-map diagrams from extracted images to all loaded questions
  const handleAutoMapDiagrams = () => {
    if (extractedImages.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Images Available',
        description: 'No diagrams were extracted from the PDF or Docling yet. Please upload a PDF or extract figures first.',
      });
      return;
    }

    let mappedCount = 0;
    setQuestions((prev) =>
      prev.map((q) => {
        const resolved = resolveQuestionDiagramImage(q, extractedImages, doclingApiUrl);
        if (resolved && resolved !== q.imageUrl) {
          mappedCount++;
          return { ...q, imageUrl: resolved };
        }
        return q;
      })
    );

    toast({
      title: '🖼️ Diagrams Mapped!',
      description: `Auto-linked diagrams to ${mappedCount} question(s) matching image references.`,
    });
  };

  // Bulk Save to Database
  const handleBulkSave = async (options?: { onlyChapters?: boolean; onlyQuestions?: boolean }) => {
    const selectedChapters = options?.onlyQuestions ? [] : chapters.filter((c) => c.selected);
    const selectedTopics = options?.onlyQuestions ? [] : topics.filter((t) => t.selected);
    const selectedQuestions = options?.onlyChapters ? [] : questions.filter((q) => q.selected);

    if (selectedChapters.length === 0 && selectedTopics.length === 0 && selectedQuestions.length === 0) {
      toast({ variant: 'destructive', title: 'Nothing Selected', description: 'Please select at least one item to save.' });
      return;
    }

    setIsSaving(true);

    try {
      const res = await fetch('/api/ai/import-extracted', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          boardId: selectedBoardId ? parseInt(selectedBoardId) : undefined,
          standardId: selectedStandardId ? parseInt(selectedStandardId) : undefined,
          subjectId: selectedSubjectId ? parseInt(selectedSubjectId) : undefined,
          chapters: selectedChapters,
          topics: selectedTopics,
          questions: selectedQuestions,
          providerId: parseInt(providerId),
          modelUsed: model,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Import failed' }));
        throw new Error(err.error || 'Failed to save items to database');
      }

      const data = await res.json();
      setSaveSuccess(data);

      if (data.pendingApproval) {
        toast({
          title: 'Submitted for Approval! ⏳',
          description: data.message || 'Your extracted questions have been submitted for Super Admin review and will go live once approved.',
        });
      } else {
        toast({
          title: 'Import Successful! 🎉',
          description: `Saved ${data.savedChapters} Chapters, ${data.savedTopics} Topics, and ${data.savedQuestions} Questions directly to the live database.`,
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: err.message || 'Could not import items to database.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle selection helpers
  const toggleAllChapters = (val: boolean) => {
    setChapters((prev) => prev.map((c) => ({ ...c, selected: val })));
    setTopics((prev) => prev.map((t) => ({ ...t, selected: val })));
  };

  const toggleChapter = (chapName: string, val: boolean) => {
    setChapters((prev) => prev.map((c) => (c.name === chapName ? { ...c, selected: val } : c)));
    setTopics((prev) => prev.map((t) => (t.chapterName === chapName ? { ...t, selected: val } : t)));
  };

  const toggleTopic = (id: string) => {
    setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t)));
  };

  const toggleAllQuestions = (val: boolean) => {
    setQuestions((prev) => prev.map((q) => ({ ...q, selected: val })));
  };

  const toggleQuestion = (id: string) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, selected: !q.selected } : q)));
  };

  const deleteQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const wordCount = extractedText.split(/\s+/).filter(Boolean).length;
  const hasExtractedData = chapters.length > 0 || topics.length > 0 || questions.length > 0;
  const selectedQuestionsCount = questions.filter((q) => q.selected).length;
  const selectedChaptersCount = chapters.filter((c) => c.selected).length;
  const selectedTopicsCount = topics.filter((t) => t.selected).length;

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-7xl pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileUp className="h-7 w-7 text-primary" />
            PDF AI Curriculum & Question Extractor
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Convert any textbook, syllabus document, or test paper into structured Chapters, Topics, and Questions.
          </p>
        </div>

        {hasExtractedData && (
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button
              size="lg"
              onClick={() => handleBulkSave()}
              disabled={isSaving}
              className="w-full sm:w-auto shadow-md font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isSaving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding to Database...</>
              ) : (
                <><Database className="mr-2 h-4 w-4" /> Add All to Database ({selectedChaptersCount + selectedTopicsCount + selectedQuestionsCount})</>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Save Success Banner */}
      {saveSuccess && (
        <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/50 shadow-sm animate-in fade-in-50">
          <CardContent className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <h3 className="font-semibold text-base text-emerald-900 dark:text-emerald-200">
                  Data Successfully Added to Database!
                </h3>
                <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-0.5">
                  Saved <strong>{saveSuccess.savedChapters}</strong> chapters,{' '}
                  <strong>{saveSuccess.savedTopics}</strong> topics, and{' '}
                  <strong>{saveSuccess.savedQuestions}</strong> questions into your active database.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/hierarchy'}>
                View in Hierarchy <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </Button>
              <Button variant="default" size="sm" onClick={() => window.location.href = '/questions'}>
                View Questions Bank <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Grid: Left Config, Right Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload & AI Configuration */}
        <div className="lg:col-span-4 space-y-6">
          {/* 1. Document Input Source Card */}
          {/* 1. Document Input Source Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="flex h-6 w-6 rounded-full bg-primary/10 text-primary items-center justify-center text-xs font-bold">1</span>
                  Upload PDF Document
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-mono">
                  PDF Engine
                </Badge>
              </div>
              <CardDescription>
                Upload any PDF file. It will be parsed via Docling AI engine into Markdown, formulas, and diagrams.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {/* Docling AI Server Status Bar */}
                <div className="flex items-center justify-between p-2 rounded-md bg-muted/40 border text-xs">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      {doclingServerStatus === 'online' && (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </>
                      )}
                      {doclingServerStatus === 'checking' && (
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 animate-pulse"></span>
                      )}
                      {doclingServerStatus === 'offline' && (
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      )}
                      {doclingServerStatus === 'unknown' && (
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-muted-foreground"></span>
                      )}
                    </span>
                    <span className="font-medium text-foreground">
                      Docling AI Engine:
                    </span>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] font-mono ${
                        doclingServerStatus === 'online'
                          ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                          : doclingServerStatus === 'offline'
                          ? 'text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/30'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {doclingServerStatus === 'online' ? 'Online (DevTunnel)' : doclingServerStatus === 'checking' ? 'Connecting...' : 'Offline'}
                    </Badge>
                  </div>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                        <Settings2 className="h-3.5 w-3.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 space-y-3 p-3 text-xs" align="end">
                      <div className="font-semibold flex items-center justify-between">
                        <span>Docling Server Settings</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={() => checkDoclingHealth()}
                        >
                          <RefreshCw className="h-2.5 w-2.5 mr-1" /> Test Ping
                        </Button>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">API Base Endpoint</Label>
                        <Input
                          value={doclingApiUrl}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDoclingApiUrl(val);
                            localStorage.setItem('docling_api_url', val);
                          }}
                          placeholder="https://..."
                          className="h-7 text-xs font-mono"
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1 border-t">
                        <span>Status: {doclingServerStatus}</span>
                        <Button
                          variant="link"
                          className="h-auto p-0 text-[10px]"
                          onClick={() => {
                            setDoclingApiUrl(DEFAULT_DOCLING_API_BASE);
                            localStorage.setItem('docling_api_url', DEFAULT_DOCLING_API_BASE);
                            checkDoclingHealth(DEFAULT_DOCLING_API_BASE);
                          }}
                        >
                          Reset Default
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all bg-muted/20 ${
                    isDraggingOver
                      ? 'border-primary bg-primary/10 scale-[1.01]'
                      : 'hover:border-primary/50'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="application/pdf"
                    className="hidden"
                  />
                  <UploadCloud className={`h-10 w-10 mx-auto mb-2 transition-transform ${isDraggingOver ? 'text-primary scale-110' : 'text-muted-foreground'}`} />
                  <p className="font-medium text-sm">
                    {pdfFile ? pdfFile.name : 'Click or drop PDF document here'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {pdfFile ? `${(pdfFile.size / 1024 / 1024).toFixed(2)} MB` : 'Automatically parsed via Docling AI document engine'}
                  </p>
                </div>

                {isExtractingText && (
                  <div className="space-y-2 p-3 bg-muted/40 rounded-lg border border-primary/20 animate-in fade-in">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="flex items-center gap-1.5 truncate">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                        <span className="truncate">{processingStatusText || 'Extracting PDF with Docling AI...'}</span>
                      </span>
                      <span className="font-mono">{extractionProgress}%</span>
                    </div>
                    <Progress value={extractionProgress} className="h-2" />
                  </div>
                )}
              </div>

              {/* Document Overview stats when content is loaded */}
              {extractedText && (
                <div className="space-y-2 pt-1 border-t">
                  <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-md">
                    <span className="font-medium text-foreground">
                      {pageCount} Page{pageCount === 1 ? '' : 's'}
                    </span>
                    <span>{wordCount.toLocaleString()} words</span>
                    {lastExtractionSource === 'docling' && (
                      <Badge variant="outline" className="text-[10px] font-mono text-emerald-600 border-emerald-500/30">
                        ⚡ Docling Engine
                      </Badge>
                    )}
                    {extractedImages.length > 0 && (
                      <Badge variant="outline" className="text-[10px] font-mono text-primary border-primary/30">
                        📷 {extractedImages.length} diagram{extractedImages.length === 1 ? '' : 's'}
                      </Badge>
                    )}
                  </div>
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        if (pdfFile) processUploadedPdfFile(pdfFile);
                      }}
                      disabled={isExtractingText || !pdfFile}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      Re-parse with Docling Engine
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. Target Hierarchy & AI Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="flex h-6 w-6 rounded-full bg-primary/10 text-primary items-center justify-center text-xs font-bold">2</span>
                Extraction & AI Setup
              </CardTitle>
              <CardDescription>
                Assign target curriculum and select AI engine for extraction.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Hierarchy Selectors */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Board (Optional)</Label>
                  <Select value={selectedBoardId} onValueChange={(v) => { setSelectedBoardId(v); setSelectedStandardId(''); setSelectedSubjectId(''); }}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select board" />
                    </SelectTrigger>
                    <SelectContent>
                      {boardsList.map((b: any) => (
                        <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Standard / Grade</Label>
                    <Select
                      value={selectedStandardId}
                      onValueChange={(v) => { setSelectedStandardId(v); setSelectedSubjectId(''); }}
                      disabled={!selectedBoardId}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Grade" />
                      </SelectTrigger>
                      <SelectContent>
                        {standardsList.map((s: any) => (
                          <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Subject</Label>
                    <Select
                      value={selectedSubjectId}
                      onValueChange={setSelectedSubjectId}
                      disabled={!selectedStandardId}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjectsList.map((sub: any) => (
                          <SelectItem key={sub.id} value={sub.id.toString()}>{sub.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Extraction Mode */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Extraction Mode</Label>
                <Select value={mode} onValueChange={(v: any) => setMode(v)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">🌟 Full (Chapters + Topics + Questions)</SelectItem>
                    <SelectItem value="curriculum">📚 Syllabus Hierarchy (Chapters & Topics)</SelectItem>
                    <SelectItem value="questions">❓ Questions Bank Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Target Question Types Multi-Select Dropdown */}
              {mode !== 'curriculum' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                      <span>🎯</span> Target Question Types
                    </Label>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {selectedQuestionTypes.length === 0 ? 'All Types' : `${selectedQuestionTypes.length} selected`}
                    </span>
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between h-auto min-h-9 px-3 py-1.5 text-xs font-normal bg-background hover:bg-muted/40 border-input"
                      >
                        <div className="flex flex-wrap gap-1 items-center max-w-[88%] text-left">
                          {selectedQuestionTypes.length === 0 ? (
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <span>🎯</span> All Question Types (No Filter)
                            </span>
                          ) : (
                            selectedQuestionTypes.map((slug) => {
                              const item = availableQuestionTypesList.find((t) => t.slug === slug);
                              return (
                                <span
                                  key={slug}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-medium border border-blue-500/20"
                                >
                                  <span>{item?.icon || '📝'}</span>
                                  <span>{item?.name || slug}</span>
                                </span>
                              );
                            })
                          )}
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[330px] p-2 space-y-2" align="start">
                      <div className="flex items-center justify-between px-1 pb-1.5 border-b">
                        <span className="text-xs font-semibold text-foreground">Filter Question Types</span>
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setSelectedQuestionTypes(availableQuestionTypesList.map((t) => t.slug))}
                            className="text-primary hover:underline font-medium cursor-pointer"
                          >
                            Select All
                          </button>
                          <span className="text-muted-foreground">|</span>
                          <button
                            type="button"
                            onClick={() => setSelectedQuestionTypes([])}
                            className="text-muted-foreground hover:underline cursor-pointer"
                          >
                            Reset (All Types)
                          </button>
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                        {availableQuestionTypesList.map((qType) => {
                          const isSelected = selectedQuestionTypes.includes(qType.slug);
                          return (
                            <div
                              key={qType.slug}
                              onClick={() => toggleQuestionType(qType.slug)}
                              className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer select-none transition-colors ${
                                isSelected
                                  ? 'bg-primary/10 text-primary font-medium'
                                  : 'hover:bg-muted text-foreground'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleQuestionType(qType.slug)}
                                  className="pointer-events-none"
                                />
                                <span className="flex items-center gap-1.5">
                                  <span>{qType.icon || '📝'}</span>
                                  <span>{qType.name}</span>
                                </span>
                              </div>
                              {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                            </div>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {selectedQuestionTypes.length === 0
                      ? 'Extracts all question types. Click dropdown to select specific types.'
                      : `Only questions matching the ${selectedQuestionTypes.length} selected type(s) will be fetched.`}
                  </p>
                </div>
              )}

              {/* Target Languages Multi-Select Dropdown */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <span>🌐</span> Target Languages
                  </Label>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {selectedLanguages.length} selected
                  </span>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between h-auto min-h-9 px-3 py-1.5 text-xs font-normal bg-background hover:bg-muted/40 border-input"
                    >
                      <div className="flex flex-wrap gap-1 items-center max-w-[88%] text-left">
                        {selectedLanguages.map((code) => {
                          const lang = AVAILABLE_LANGUAGES.find((l) => l.code === code);
                          return (
                            <span
                              key={code}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-medium border border-primary/20"
                            >
                              <span>{lang?.flag || '🌐'}</span>
                              <span>{lang?.label || code}</span>
                            </span>
                          );
                        })}
                      </div>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[330px] p-2 space-y-2" align="start">
                    <div className="flex items-center justify-between px-1 pb-1.5 border-b">
                      <span className="text-xs font-semibold text-foreground">Select Languages</span>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setSelectedLanguages(AVAILABLE_LANGUAGES.map((l) => l.code))}
                          className="text-primary hover:underline font-medium cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-muted-foreground">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedLanguages(['en'])}
                          className="text-muted-foreground hover:underline cursor-pointer"
                        >
                          Reset (EN)
                        </button>
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                      {AVAILABLE_LANGUAGES.map((lang) => {
                        const isSelected = selectedLanguages.includes(lang.code);
                        return (
                          <div
                            key={lang.code}
                            onClick={() => toggleLanguageSelection(lang.code)}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer select-none transition-colors ${
                              isSelected
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'hover:bg-muted text-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleLanguageSelection(lang.code)}
                                className="pointer-events-none"
                              />
                              <span className="flex items-center gap-1.5">
                                <span>{lang.flag}</span>
                                <span>{lang.label}</span>
                                <span className="text-muted-foreground text-[10px]">({lang.native})</span>
                              </span>
                            </div>
                            {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                          </div>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  AI will extract base questions, then translate and generate full questions into all selected languages.
                </p>
              </div>

              {/* AI Provider & Model */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">AI Provider</Label>
                  <Select
                    value={providerId}
                    onValueChange={(v) => {
                      setProviderId(v);
                      const p = providersList?.find((item: any) => item.id === Number(parseInt(v)));
                      setModel(p?.defaultModel || p?.availableModels?.[0] || '');
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {providersList.map((p: any) => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Model</Label>
                  <Select value={model} onValueChange={setModel} disabled={!providerId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Model" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProvider?.availableModels?.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Custom Instructions (Optional) */}
              <div className="space-y-1.5">
                <Label className="text-xs">Custom Instructions (Optional)</Label>
                <Textarea
                  placeholder="e.g. Focus on Chapter 3 only, or convert all multiple choice questions to standard format"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="text-xs resize-none h-16"
                />
              </div>

              {extractionError && (
                <Alert variant="destructive" className="py-2.5">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="text-xs font-semibold">Extraction Failed</AlertTitle>
                  <AlertDescription className="text-xs mt-1">
                    {extractionError}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleRunAiExtraction}
                  disabled={!extractedText || isAiProcessing}
                  className="w-full"
                  size="lg"
                >
                  {isAiProcessing ? (
                    <div className="flex items-center gap-2 text-xs truncate max-w-full">
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      <span className="truncate">{aiProgressText || 'Extracting & Translating...'}</span>
                    </div>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" /> Start AI Extraction ({selectedLanguages.length} Lang{selectedLanguages.length > 1 ? 's' : ''})</>
                  )}
                </Button>

                <Dialog open={isJsonDialogOpen} onOpenChange={setIsJsonDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground">
                      <FileText className="mr-1.5 h-3.5 w-3.5" /> Paste / Import AI JSON Directly
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Import Raw AI JSON
                      </DialogTitle>
                      <DialogDescription>
                        Paste any JSON response from Gemini, ChatGPT, Claude, or your local AI model. All chapters, topics, and questions will be parsed and loaded into the Review tables.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="py-2 flex-1 min-h-0">
                      <Textarea
                        placeholder={`Paste raw JSON here...\n{\n  "chapters": [...],\n  "topics": [...],\n  "questions": [...]\n}`}
                        value={rawJsonInput}
                        onChange={(e) => setRawJsonInput(e.target.value)}
                        className="font-mono text-xs h-72 resize-none"
                      />
                    </div>

                    <DialogFooter className="flex justify-between sm:justify-between items-center">
                      <Button variant="ghost" size="sm" onClick={() => setIsJsonDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={() => handleImportDirectJson(rawJsonInput)} disabled={!rawJsonInput.trim()}>
                        <Check className="mr-1.5 h-4 w-4" /> Load into Review Table
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Review & Confirmation */}
        <div className="lg:col-span-8">
          <Card className="min-h-[600px] flex flex-col">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="flex h-6 w-6 rounded-full bg-primary/10 text-primary items-center justify-center text-xs font-bold">3</span>
                    Review Extracted Curriculum & Questions
                  </CardTitle>
                  <CardDescription>
                    Verify detected chapters, topics, and questions before committing to the database.
                  </CardDescription>
                </div>

                {hasExtractedData && (
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {selectedChaptersCount} / {chapters.length} Chapters
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {selectedTopicsCount} / {topics.length} Topics
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {selectedQuestionsCount} / {questions.length} Questions
                    </Badge>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex-1 p-4 sm:p-6">
              {!extractedText && !hasExtractedData ? (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 border border-dashed rounded-lg">
                  <FileUp className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="font-semibold text-lg">No PDF Document Uploaded</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mt-1">
                    Upload a PDF document on the left to extract curriculum hierarchy, LaTeX formulas, diagrams, and questions.
                  </p>
                </div>
              ) : isAiProcessing ? (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8">
                  <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                  <p className="text-sm text-muted-foreground max-w-md mt-1">
                    Extracting structured chapters, topics, and questions. This may take 10-30 seconds depending on document size.
                  </p>
                </div>
              ) : (
                <Tabs value={activeReviewTab} onValueChange={(v: any) => setActiveReviewTab(v)} className="w-full space-y-4">
                  {/* Tabs Bar Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b">
                    <TabsList className="h-9">
                      <TabsTrigger value="chapters" className="text-xs gap-1.5 px-3">
                        <Layers className="h-3.5 w-3.5" />
                        Chapters & Topics ({chapters.length})
                      </TabsTrigger>
                      <TabsTrigger value="questions" className="text-xs gap-1.5 px-3">
                        <LibraryBig className="h-3.5 w-3.5" />
                        Questions ({questions.length})
                      </TabsTrigger>
                      <TabsTrigger value="images" className="text-xs gap-1.5 px-3">
                        <ImageIcon className="h-3.5 w-3.5" />
                        Diagrams & Images ({extractedImages.length})
                      </TabsTrigger>
                      <TabsTrigger value="rawText" className="text-xs gap-1.5 px-3">
                        <FileText className="h-3.5 w-3.5" />
                        Extracted Markdown
                      </TabsTrigger>
                    </TabsList>

                    {hasExtractedData && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>Selected:</span>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {selectedChaptersCount} Ch • {selectedTopicsCount} Top • {selectedQuestionsCount} Qs
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Tab 1: Chapters & Topics Tree */}
                  <TabsContent value="chapters" className="space-y-4 focus-visible:outline-none">
                    {chapters.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground text-sm">
                        No chapters detected. Try running extraction or switch to Questions tab.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Chapters Action Toolbar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs py-1">
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleAllChapters(true)}>Select All</Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleAllChapters(false)}>Deselect All</Button>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleBulkSave({ onlyChapters: true })}
                            disabled={isSaving || (selectedChaptersCount === 0 && selectedTopicsCount === 0)}
                            className="font-medium gap-1.5 text-xs h-8"
                          >
                            <Database className="h-3.5 w-3.5 text-primary" />
                            Add Chapters to DB ({selectedChaptersCount})
                          </Button>
                        </div>

                        <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1 sm:pr-2">
                          {chapters.map((chap, idx) => {
                            const chapTopics = topics.filter((t) => t.chapterName === chap.name);
                            return (
                              <Card key={chap.id || idx} className={`border transition-all ${chap.selected ? 'border-primary/40 bg-card shadow-xs' : 'opacity-60 bg-muted/30'}`}>
                                <CardHeader className="py-3 px-4 flex flex-row items-start justify-between space-y-0 gap-3">
                                  <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <Checkbox
                                      checked={chap.selected}
                                      onCheckedChange={(v) => toggleChapter(chap.name, !!v)}
                                      className="mt-1 shrink-0"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                                        <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">Ch.{chap.orderIndex || idx + 1}</span>
                                        <span className="break-words">{chap.name}</span>
                                      </div>
                                      {chap.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5 break-words">{chap.description}</p>
                                      )}
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="text-xs shrink-0">
                                    {chapTopics.length} Topics
                                  </Badge>
                                </CardHeader>

                                {chapTopics.length > 0 && (
                                  <CardContent className="py-2.5 px-4 border-t bg-muted/20">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                                      {chapTopics.map((top) => (
                                        <div
                                          key={top.id}
                                          onClick={() => toggleTopic(top.id!)}
                                          className={`flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                                            top.selected ? 'bg-background border-primary/30 text-foreground shadow-xs' : 'bg-muted/40 text-muted-foreground'
                                          }`}
                                        >
                                          <Checkbox checked={top.selected} className="pointer-events-none shrink-0" />
                                          <span className="truncate flex-1">{top.name}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </CardContent>
                                )}
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* Tab 2: Questions Review */}
                  <TabsContent value="questions" className="space-y-4 focus-visible:outline-none">
                    {questions.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground text-sm">
                        No questions detected in this document.
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {/* Language Switcher Bar */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 p-3 rounded-xl bg-muted/30 border border-border/80">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
                              <span>🌐</span> View Language:
                            </span>
                            {AVAILABLE_LANGUAGES.filter((l) => l.code === 'en' || selectedLanguages.includes(l.code) || questions.some((q) => !!q.translations?.[l.code])).map((lang) => {
                              const isActive = activeViewLang === lang.code;
                              const translatedCount = lang.code === 'en'
                                ? questions.length
                                : questions.filter((q) => !!q.translations?.[lang.code]).length;

                              return (
                                <Button
                                  key={lang.code}
                                  type="button"
                                  variant={isActive ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => setActiveViewLang(lang.code)}
                                  className={`h-7 px-2.5 text-xs gap-1.5 cursor-pointer ${
                                    isActive ? 'shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground bg-background'
                                  }`}
                                >
                                  <span>{lang.flag}</span>
                                  <span>{lang.label}</span>
                                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                    {translatedCount}
                                  </span>
                                </Button>
                              );
                            })}

                            {/* Dual View Toggle */}
                            <Button
                              type="button"
                              variant={isDualView ? 'secondary' : 'outline'}
                              size="sm"
                              onClick={() => setIsDualView(!isDualView)}
                              className={`h-7 px-2.5 text-xs gap-1.5 cursor-pointer ${
                                isDualView ? 'bg-primary/15 border-primary/60 text-primary font-semibold' : 'border-dashed text-muted-foreground hover:text-foreground bg-background'
                              }`}
                              title="Compare English source alongside translated regional questions"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Dual-View Mode</span>
                              {isDualView && <Check className="h-3 w-3 ml-0.5" />}
                            </Button>
                          </div>

                          {/* Quick Manual Translate Dropdown */}
                          <div className="flex items-center gap-2 shrink-0">
                            <Select
                              value={translateTargetLang}
                              onValueChange={(val) => {
                                setTranslateTargetLang(val);
                                handleTranslateAllQuestions(val);
                              }}
                              disabled={isTranslatingQuestions || isAiProcessing}
                            >
                              <SelectTrigger className="h-7 text-xs w-[160px] bg-background">
                                <SelectValue placeholder="+ Translate to..." />
                              </SelectTrigger>
                              <SelectContent>
                                {AVAILABLE_LANGUAGES.map((l) => (
                                  <SelectItem key={l.code} value={l.code}>
                                    {l.flag} {l.label} ({l.native})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {isTranslatingQuestions && (
                              <span className="flex items-center gap-1 text-xs text-primary font-medium animate-pulse">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Translating...
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Question Action Buttons Toolbar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs py-1">
                          <div className="flex items-center gap-1.5">
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => toggleAllQuestions(true)}>Select All</Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => toggleAllQuestions(false)}>Deselect All</Button>
                            <span className="text-muted-foreground text-xs ml-1">({selectedQuestionsCount} of {questions.length} selected)</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {/* Auto-Solve Answers Button */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSolveMissingAnswers()}
                              disabled={isSolvingQuestions || isSaving || questions.length === 0}
                              className="h-8 gap-1.5 border-amber-500/50 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium text-xs"
                              title="Solve all questions to determine correct answers and generate step-by-step solutions"
                            >
                              {isSolvingQuestions ? (
                                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Solving Answers...</>
                              ) : (
                                <><Sparkles className="h-3.5 w-3.5 text-amber-600" /> AI Solve Answers & Solutions</>
                              )}
                            </Button>

                            {/* Auto-Map Diagrams Button */}
                            {extractedImages.length > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleAutoMapDiagrams}
                                disabled={isSaving || questions.length === 0}
                                className="h-8 gap-1.5 border-blue-500/40 hover:bg-blue-500/10 text-blue-700 dark:text-blue-300 font-medium text-xs"
                                title="Auto-match [IMAGE_N] or imageRef tags to extracted Docling/PDF diagrams"
                              >
                                <ImageIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                <span>Auto-Map Diagrams ({extractedImages.length})</span>
                              </Button>
                            )}

                            {/* Generate Similar Questions Button */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const selectedQs = questions.filter((q) => q.selected);
                                handleGenerateSimilarQuestions(selectedQs.length > 0 ? selectedQs : questions.slice(0, 3), 5);
                              }}
                              disabled={isGeneratingBulkSimilar || isSaving}
                              className="h-8 gap-1.5 border-primary/40 hover:bg-primary/5 text-primary font-medium text-xs"
                            >
                              {isGeneratingBulkSimilar ? (
                                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</>
                              ) : (
                                <><Wand2 className="h-3.5 w-3.5 text-primary" /> Generate 5 More Like Selected</>
                              )}
                            </Button>

                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleBulkSave({ onlyQuestions: true })}
                              disabled={isSaving || selectedQuestionsCount === 0}
                              className="h-8 font-medium gap-1.5 text-xs"
                            >
                              <Database className="h-3.5 w-3.5 text-primary" />
                              Add to DB ({selectedQuestionsCount})
                            </Button>
                          </div>
                        </div>

                        {/* Questions Cards List */}
                        <div className="space-y-3.5 max-h-[620px] overflow-y-auto pr-1 sm:pr-2">
                          {questions.map((q, idx) => {
                            const trans = activeViewLang !== 'en' ? q.translations?.[activeViewLang] : null;
                            const displayQText = trans?.question || q.question;
                            const displayOptions = trans?.options || q.options;
                            const displayExplanation = trans?.explanation || q.explanation;
                            const effectiveAnswer = trans?.correctAnswer || q.correctAnswer;
                            const translatedLangKeys = Object.keys(q.translations || {});

                            return (
                              <Card
                                key={q.id || idx}
                                className={`border transition-all ${
                                  q.selected ? 'border-primary/40 shadow-xs' : 'opacity-60 bg-muted/20'
                                } ${q.isAiGeneratedVariant ? 'bg-primary/5 border-primary/50' : ''}`}
                              >
                                <CardHeader className="py-3 px-4">
                                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                      <Checkbox
                                        checked={q.selected}
                                        onCheckedChange={() => toggleQuestion(q.id!)}
                                        className="mt-1 shrink-0"
                                      />
                                      <div className="space-y-2 flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className="text-xs font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Q{idx + 1}</span>
                                          {q.isAiGeneratedVariant && (
                                            <Badge variant="default" className="text-[10px] bg-primary text-primary-foreground gap-1">
                                              <Sparkles className="h-2.5 w-2.5" /> AI Similar Variant
                                            </Badge>
                                          )}
                                          <Badge variant="outline" className="text-[10px] uppercase">
                                            {q.questionType?.replace('_', ' ')}
                                          </Badge>
                                          <Badge
                                            variant="secondary"
                                            className={`text-[10px] ${
                                              q.difficulty === 'easy'
                                                ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                                                : q.difficulty === 'hard'
                                                ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/40'
                                                : 'text-amber-600 bg-amber-50 dark:bg-amber-950/40'
                                            }`}
                                          >
                                            {q.difficulty}
                                          </Badge>
                                          {q.marks && (
                                            <Badge variant="outline" className="text-[10px]">{q.marks} Marks</Badge>
                                          )}

                                          {/* Correct Answer / Solution status indicator */}
                                          {effectiveAnswer ? (
                                            <Badge variant="secondary" className="text-[10px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-semibold gap-1">
                                              <Check className="h-2.5 w-2.5" /> Ans: {effectiveAnswer}
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300">
                                              No Ans Detected
                                            </Badge>
                                          )}

                                          {/* Available Translations Badges */}
                                          {translatedLangKeys.length > 0 && (
                                            <div className="flex items-center gap-1 flex-wrap">
                                              <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                                                🇬🇧 EN
                                              </Badge>
                                              {translatedLangKeys.map((k) => {
                                                const lObj = AVAILABLE_LANGUAGES.find((al) => al.code === k);
                                                return (
                                                  <Badge
                                                    key={k}
                                                    variant="secondary"
                                                    className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-normal"
                                                    title={lObj?.label || k}
                                                  >
                                                    {lObj?.flag || '🌐'} {lObj?.label || k}
                                                  </Badge>
                                                );
                                              })}
                                            </div>
                                          )}

                                          {q.chapterName && (
                                            <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal max-w-[200px] truncate ml-auto">
                                              📁 {q.chapterName} {q.topicName ? `› ${q.topicName}` : ''}
                                            </Badge>
                                          )}
                                        </div>

                                        {/* Question Text Rendering: Dual-View vs Single Language */}
                                        {isDualView && trans ? (
                                          <div className="space-y-2 pt-1">
                                            {/* English Source */}
                                            <div className="p-2.5 rounded-lg bg-muted/30 border text-xs space-y-1">
                                              <div className="font-semibold text-[11px] text-muted-foreground flex items-center gap-1">
                                                <span>🇬🇧</span> English (Source)
                                              </div>
                                              <div className="text-sm font-medium text-foreground leading-relaxed break-words">
                                                <MathText text={q.question} />
                                              </div>
                                            </div>

                                            {/* Translated Language */}
                                            <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-xs space-y-1">
                                              <div className="font-semibold text-[11px] text-primary flex items-center gap-1">
                                                <span>{AVAILABLE_LANGUAGES.find((l) => l.code === activeViewLang)?.flag || '🌐'}</span>
                                                {AVAILABLE_LANGUAGES.find((l) => l.code === activeViewLang)?.label || activeViewLang} (Translated)
                                              </div>
                                              <div className="text-sm font-medium text-foreground leading-relaxed break-words">
                                                <MathText text={trans.question} />
                                              </div>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="text-sm font-medium pt-1 text-foreground leading-relaxed break-words">
                                            <MathText text={displayQText} />
                                            {activeViewLang !== 'en' && !trans && (
                                              <span className="text-[11px] text-amber-600 dark:text-amber-400 block mt-0.5 italic">
                                                (Translation into {AVAILABLE_LANGUAGES.find((l) => l.code === activeViewLang)?.label || activeViewLang} not generated yet. Use the dropdown above to translate.)
                                              </span>
                                            )}
                                          </div>
                                        )}

                                        {/* Attached Diagram / Image if present */}
                                        {q.imageUrl && (
                                          <div className="mt-2.5 p-2 rounded-lg border bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                            <img
                                              src={q.imageUrl}
                                              alt="Question Diagram"
                                              className="max-h-36 max-w-full sm:max-w-xs object-contain rounded border bg-background cursor-pointer hover:opacity-90 shadow-xs"
                                              onClick={() => setImagePreviewModal({ id: 'q_diag', pageNumber: 1, dataUrl: q.imageUrl!, width: 400, height: 300, name: `Diagram for Q${idx + 1}` })}
                                            />
                                            <div className="space-y-1.5 flex-1 min-w-0">
                                              <div className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                                                <ImageIcon className="h-3.5 w-3.5" /> Attached Diagram / Figure
                                              </div>
                                              <p className="text-[11px] text-muted-foreground">
                                                This diagram will be saved and displayed alongside this question on the student app and exam papers.
                                              </p>
                                              <div className="flex items-center gap-2 pt-1">
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  size="sm"
                                                  className="h-6 text-[11px] gap-1 px-2"
                                                  onClick={() => {
                                                    setTargetQuestionForImage(q.id!);
                                                    setIsAttachPickerOpen(true);
                                                  }}
                                                >
                                                  <RotateCcw className="h-3 w-3" /> Change Diagram
                                                </Button>
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-6 text-[11px] text-destructive hover:bg-destructive/10 gap-1 px-2"
                                                  onClick={() => {
                                                    setQuestions((prev) => prev.map((item) => item.id === q.id ? { ...item, imageUrl: undefined } : item));
                                                    toast({ title: 'Diagram Detached', description: 'Diagram removed from this question.' });
                                                  }}
                                                >
                                                  <Trash2 className="h-3 w-3" /> Detach
                                                </Button>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Action Buttons in Card Header */}
                                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-start">
                                      {!q.imageUrl && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            setTargetQuestionForImage(q.id!);
                                            setIsAttachPickerOpen(true);
                                          }}
                                          className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/5 px-2"
                                          title="Attach a diagram or figure from the PDF to this question"
                                        >
                                          <ImageIcon className="h-3 w-3 text-primary" />
                                          <span>+ Diagram</span>
                                        </Button>
                                      )}

                                      {!effectiveAnswer && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleSolveMissingAnswers([q])}
                                          disabled={isSolvingQuestions || isSaving}
                                          className="h-7 text-xs gap-1 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 px-2"
                                          title="Solve this question and compute the correct answer"
                                        >
                                          <Sparkles className="h-3 w-3 text-amber-600" />
                                          <span>Solve</span>
                                        </Button>
                                      )}

                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleGenerateSimilarQuestions([q], 3, q.id)}
                                        disabled={generatingForId === q.id || isSaving}
                                        className="h-7 text-xs gap-1 border-primary/30 hover:bg-primary/5 text-primary px-2"
                                        title="Generate 3 more questions similar to this example"
                                      >
                                        {generatingForId === q.id ? (
                                          <><Loader2 className="h-3 w-3 animate-spin" /> Generating...</>
                                        ) : (
                                          <><Wand2 className="h-3.5 w-3.5" /> +3 Similar</>
                                        )}
                                      </Button>

                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => deleteQuestion(q.id!)}
                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                </CardHeader>

                                {/* Options Rendering with robust isOptionCorrect matching */}
                                {displayOptions && displayOptions.length > 0 && (
                                  <CardContent className="py-2.5 px-4 border-t bg-muted/10 space-y-1.5">
                                    {isDualView && trans?.options ? (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                        {/* English Options */}
                                        <div className="space-y-1.5">
                                          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                                            <span>🇬🇧</span> English Options:
                                          </span>
                                          <div className="space-y-1.5">
                                            {(q.options || []).map((opt) => {
                                              const isCorrect = isOptionCorrect(q.correctAnswer, opt);
                                              return (
                                                <div
                                                  key={opt.id}
                                                  className={`text-xs p-2 rounded-lg border flex items-start justify-between gap-2 transition-colors ${
                                                    isCorrect
                                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/60 text-emerald-950 dark:text-emerald-100 font-semibold shadow-xs ring-1 ring-emerald-500/20'
                                                      : 'bg-background border-border text-foreground'
                                                  }`}
                                                >
                                                  <div className="flex items-start gap-2 flex-1 min-w-0">
                                                    <span className={`font-mono font-bold shrink-0 ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                                      {opt.id}.
                                                    </span>
                                                    <div className="flex-1 min-w-0 break-words">
                                                      <MathText text={opt.text} />
                                                    </div>
                                                  </div>
                                                  {isCorrect && (
                                                    <Badge variant="secondary" className="text-[9px] bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 shrink-0">
                                                      Correct
                                                    </Badge>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>

                                        {/* Translated Options */}
                                        <div className="space-y-1.5">
                                          <span className="text-[11px] font-semibold text-primary flex items-center gap-1">
                                            <span>{AVAILABLE_LANGUAGES.find((l) => l.code === activeViewLang)?.flag}</span>
                                            {AVAILABLE_LANGUAGES.find((l) => l.code === activeViewLang)?.label} Options:
                                          </span>
                                          <div className="space-y-1.5">
                                            {trans.options.map((opt) => {
                                              const isCorrect = isOptionCorrect(trans.correctAnswer || q.correctAnswer, opt);
                                              return (
                                                <div
                                                  key={opt.id}
                                                  className={`text-xs p-2 rounded-lg border flex items-start justify-between gap-2 transition-colors ${
                                                    isCorrect
                                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/60 text-emerald-950 dark:text-emerald-100 font-semibold shadow-xs ring-1 ring-emerald-500/20'
                                                      : 'bg-background border-border text-foreground'
                                                  }`}
                                                >
                                                  <div className="flex items-start gap-2 flex-1 min-w-0">
                                                    <span className={`font-mono font-bold shrink-0 ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                                      {opt.id}.
                                                    </span>
                                                    <div className="flex-1 min-w-0 break-words">
                                                      <MathText text={opt.text} />
                                                    </div>
                                                  </div>
                                                  {isCorrect && (
                                                    <Badge variant="secondary" className="text-[9px] bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 shrink-0">
                                                      Correct
                                                    </Badge>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {displayOptions.map((opt) => {
                                          const isCorrect = isOptionCorrect(effectiveAnswer, opt);
                                          return (
                                            <div
                                              key={opt.id}
                                              className={`text-xs p-2 rounded-lg border flex items-start justify-between gap-2 transition-colors ${
                                                isCorrect
                                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/60 text-emerald-950 dark:text-emerald-100 font-semibold shadow-xs ring-1 ring-emerald-500/20'
                                                  : 'bg-background border-border text-foreground'
                                              }`}
                                            >
                                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                                <span className={`font-mono font-bold shrink-0 ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                                  {opt.id}.
                                                </span>
                                                <div className="flex-1 min-w-0 break-words">
                                                  <MathText text={opt.text} />
                                                </div>
                                              </div>
                                              {isCorrect && (
                                                <Badge variant="secondary" className="text-[9px] bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 shrink-0">
                                                  ✓ Correct Answer
                                                </Badge>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </CardContent>
                                )}

                                {/* Explanation / Solution */}
                                {(displayExplanation || (isDualView && trans?.explanation)) && (
                                  <CardFooter className="py-2.5 px-4 border-t bg-muted/20 text-xs text-muted-foreground flex-col items-start gap-1">
                                    {isDualView && trans?.explanation ? (
                                      <div className="w-full space-y-1.5">
                                        <div className="break-words">
                                          <span className="font-semibold text-foreground mr-1">🇬🇧 Solution:</span>
                                          <MathText text={q.explanation || ''} />
                                        </div>
                                        <div className="pt-1.5 border-t border-border/50 break-words">
                                          <span className="font-semibold text-primary mr-1">
                                            {AVAILABLE_LANGUAGES.find((l) => l.code === activeViewLang)?.flag} Solution:
                                          </span>
                                          <MathText text={trans.explanation || ''} />
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="break-words">
                                        <span className="font-semibold text-foreground mr-1">💡 Solution & Step-by-Step Explanation:</span>
                                        <MathText text={displayExplanation || ''} />
                                      </div>
                                    )}
                                  </CardFooter>
                                )}
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* Tab 3: Diagrams & Images Gallery */}
                  <TabsContent value="images" className="space-y-4 focus-visible:outline-none">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-muted/30 border border-border/80">
                      <div className="space-y-0.5">
                        <div className="text-sm font-semibold flex items-center gap-2">
                          <ImageIcon className="h-4 w-4 text-primary" />
                          Docling AI Extracted Diagrams & Figures
                          <Badge variant="secondary" className="font-mono text-xs ml-1">
                            {extractedImages.length} items
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Diagrams and figures extracted directly from your PDF by the Docling AI server. Attach them to questions or download as PNG.
                        </p>
                      </div>
                    </div>

                    {extractedImages.length === 0 ? (
                      <div className="h-64 flex flex-col items-center justify-center text-center p-8 border border-dashed rounded-lg">
                        <ImageIcon className="h-10 w-10 text-muted-foreground/40 mb-3" />
                        <h4 className="font-semibold text-sm">No Diagrams Extracted</h4>
                        <p className="text-xs text-muted-foreground max-w-sm mt-1">
                          When you upload a PDF with embedded figures, Docling AI will automatically extract and display them here.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[620px] overflow-y-auto pr-1">
                        {extractedImages.map((img, idx) => (
                          <Card key={img.id || idx} className="overflow-hidden border hover:border-primary/50 transition-all flex flex-col group bg-card shadow-xs">
                            <div
                              className="relative aspect-video bg-muted/40 flex items-center justify-center p-2 cursor-pointer overflow-hidden group-hover:bg-muted/60 transition-colors"
                              onClick={() => setImagePreviewModal(img)}
                            >
                              <img
                                src={img.dataUrl}
                                alt={img.name || `Diagram ${idx + 1}`}
                                className="max-h-full max-w-full object-contain rounded drop-shadow-xs transition-transform group-hover:scale-105"
                              />
                              <div className="absolute top-2 left-2 flex gap-1">
                                <Badge variant="secondary" className="text-[10px] font-mono bg-background/90 backdrop-blur-xs shadow-xs">
                                  Page {img.pageNumber}
                                </Badge>
                                {img.width > 0 && (
                                  <Badge variant="outline" className="text-[9px] font-mono bg-background/80">
                                    {img.width}×{img.height}
                                  </Badge>
                                )}
                              </div>
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Button size="sm" variant="secondary" className="h-7 text-xs gap-1.5 shadow-md">
                                  <ZoomIn className="h-3.5 w-3.5" /> Enlarge View
                                </Button>
                              </div>
                            </div>

                            <CardFooter className="p-2.5 flex items-center justify-between border-t bg-muted/10 gap-2">
                              <span className="text-xs font-medium truncate flex-1" title={img.name || `Image ${idx + 1}`}>
                                {img.name || `Figure ${idx + 1}`}
                              </span>

                              <div className="flex items-center gap-1 shrink-0">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button size="sm" variant="outline" className="h-7 text-xs px-2 gap-1 border-primary/30 text-primary hover:bg-primary/10">
                                      <Link2 className="h-3 w-3" />
                                      <span>Attach to Q</span>
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-56 p-2 space-y-1.5" align="end">
                                    <div className="text-[11px] font-semibold text-muted-foreground pb-1 border-b">
                                      Attach to which Question?
                                    </div>
                                    {questions.length === 0 ? (
                                      <div className="text-xs text-muted-foreground py-2 text-center">
                                        No questions available
                                      </div>
                                    ) : (
                                      <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                                        {questions.map((qItem, qIdx) => (
                                          <div
                                            key={qItem.id || qIdx}
                                            onClick={() => {
                                              setQuestions((prev) => prev.map((q) => (q.id === qItem.id ? { ...q, imageUrl: img.dataUrl } : q)));
                                              toast({
                                                title: `Diagram Attached to Q${qIdx + 1}!`,
                                                description: 'The diagram has been linked to the selected question.',
                                              });
                                            }}
                                            className="flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer hover:bg-muted select-none"
                                          >
                                            <span className="font-semibold font-mono text-primary mr-1.5">Q{qIdx + 1}</span>
                                            <span className="truncate flex-1 text-[11px]">{qItem.question.slice(0, 32)}...</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </PopoverContent>
                                </Popover>

                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  onClick={() => {
                                    const a = document.createElement('a');
                                    a.href = img.dataUrl;
                                    a.download = `pdf_diagram_p${img.pageNumber}_${idx + 1}.png`;
                                    a.click();
                                  }}
                                  title="Download Diagram PNG"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </Button>

                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => {
                                    setExtractedImages((prev) => prev.filter((_, i) => i !== idx));
                                  }}
                                  title="Delete Diagram"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </CardFooter>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Tab 4: Raw Text */}
                  <TabsContent value="rawText" className="space-y-2 focus-visible:outline-none">
                    <Textarea
                      value={extractedText}
                      onChange={(e) => setExtractedText(e.target.value)}
                      className="font-mono text-xs h-[450px] resize-none"
                    />
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Floating Bottom Sticky Action Bar */}
      {hasExtractedData && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-6xl bg-background/95 backdrop-blur-md border border-border/80 p-3 sm:p-4 shadow-2xl rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-muted-foreground">
            <Badge variant="outline" className="text-xs bg-muted/60 font-semibold text-primary">
              Ready to Save
            </Badge>
            <span>
              <strong>{selectedChaptersCount}</strong> Chapters • <strong>{selectedTopicsCount}</strong> Topics • <strong>{selectedQuestionsCount}</strong> Questions selected
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const selectedQs = questions.filter((q) => q.selected);
                handleGenerateSimilarQuestions(selectedQs.length > 0 ? selectedQs : questions.slice(0, 3), 5);
              }}
              disabled={isGeneratingBulkSimilar || isSaving}
              className="text-xs gap-1 border-primary/40 text-primary h-9"
            >
              {isGeneratingBulkSimilar ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating Similar...</>
              ) : (
                <><Wand2 className="h-3.5 w-3.5" /> Generate 5 More Like Selected</>
              )}
            </Button>

            <Button
              size="default"
              onClick={() => handleBulkSave()}
              disabled={isSaving || (selectedChaptersCount === 0 && selectedTopicsCount === 0 && selectedQuestionsCount === 0)}
              className="text-xs sm:text-sm font-semibold shadow-lg gap-2 bg-primary hover:bg-primary/90 text-primary-foreground h-9 px-4"
            >
              {isSaving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Adding to Database...</>
              ) : (
                <><Database className="h-4 w-4" /> Add All to Database ({selectedChaptersCount + selectedTopicsCount + selectedQuestionsCount})</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Diagram Full Preview Modal */}
      {imagePreviewModal && (
        <Dialog open={!!imagePreviewModal} onOpenChange={(open) => !open && setImagePreviewModal(null)}>
          <DialogContent className="max-w-3xl flex flex-col p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  {imagePreviewModal.name || 'Diagram Full View'}
                </span>
                <Badge variant="outline" className="text-xs font-mono">
                  Page {imagePreviewModal.pageNumber}
                </Badge>
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center p-4 bg-muted/30 rounded-lg border max-h-[65vh] overflow-auto">
              <img
                src={imagePreviewModal.dataUrl}
                alt="Full Diagram Preview"
                className="max-h-[58vh] max-w-full object-contain rounded shadow-md"
              />
            </div>
            <DialogFooter className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {imagePreviewModal.width ? `${imagePreviewModal.width} × ${imagePreviewModal.height} px` : ''}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = imagePreviewModal.dataUrl;
                    a.download = `diagram_${imagePreviewModal.id || 'preview'}.png`;
                    a.click();
                  }}
                  className="gap-1 text-xs"
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
                <Button size="sm" onClick={() => setImagePreviewModal(null)}>
                  Close
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Attach Diagram Modal Picker for a specific question */}
      {isAttachPickerOpen && (
        <Dialog open={isAttachPickerOpen} onOpenChange={setIsAttachPickerOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="h-5 w-5 text-primary" />
                Select Diagram for Question
              </DialogTitle>
              <DialogDescription className="text-xs">
                Choose an extracted diagram from the PDF to attach to this question.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-xs font-semibold text-muted-foreground">
                Available Diagrams ({extractedImages.length})
              </span>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {extractedImages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs space-y-2">
                  <ImageIcon className="h-8 w-8 mx-auto opacity-40" />
                  <p>No diagrams available from this document.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {extractedImages.map((img, idx) => (
                    <div
                      key={img.id || idx}
                      onClick={() => {
                        if (targetQuestionForImage) {
                          setQuestions((prev) =>
                            prev.map((q) => (q.id === targetQuestionForImage ? { ...q, imageUrl: img.dataUrl } : q))
                          );
                          toast({ title: 'Diagram Attached!', description: 'Attached diagram to question.' });
                        }
                        setIsAttachPickerOpen(false);
                        setTargetQuestionForImage(null);
                      }}
                      className="border rounded-lg p-2 bg-card hover:border-primary cursor-pointer transition-all hover:shadow-sm space-y-1.5 group"
                    >
                      <div className="aspect-video bg-muted/40 rounded flex items-center justify-center p-1 overflow-hidden">
                        <img src={img.dataUrl} alt="Thumbnail" className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform" />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="truncate">{img.name || `Image ${idx + 1}`}</span>
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 font-mono">P.{img.pageNumber}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setIsAttachPickerOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
