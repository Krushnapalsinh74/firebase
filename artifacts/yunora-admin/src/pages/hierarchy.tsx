import React, { useState } from 'react';
import { 
  useListBoards, 
  useListStandards, 
  useListSubjects, 
  useListChapters, 
  useListTopics,
  useListAiProviders,
  useCreateBoard,
  useDeleteBoard,
  useCreateStandard,
  useDeleteStandard,
  useCreateSubject,
  useDeleteSubject,
  useCreateChapter,
  useDeleteChapter,
  useCreateTopic,
  useDeleteTopic,
  getListBoardsQueryKey,
  getListStandardsQueryKey,
  getListSubjectsQueryKey,
  getListChaptersQueryKey,
  getListTopicsQueryKey,
  useListChapterSyllabusCategories,
  getListChapterSyllabusCategoriesQueryKey,
} from '@workspace/api-client-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/hooks/use-auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Loader2, Sparkles, CheckCircle2, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format, parseISO } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';

interface AiTopic {
  name: string;
  description: string;
}

export default function HierarchyPage() {
  const [activeTab, setActiveTab] = useState('boards');
  const [selectedBoardId, setSelectedBoardId] = useState<number | undefined>();
  const [selectedStandardId, setSelectedStandardId] = useState<number | undefined>();
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | undefined>();
  const [selectedChapterId, setSelectedChapterId] = useState<number | undefined>();

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Educational Hierarchy</h1>
        <p className="text-muted-foreground">Manage the structural backbone of your curriculum.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="boards">Boards</TabsTrigger>
          <TabsTrigger value="standards">Standards</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="chapters">Chapters</TabsTrigger>
          <TabsTrigger value="topics">Topics</TabsTrigger>
        </TabsList>

        <TabsContent value="boards" className="space-y-4">
          <BoardsTab onSelectBoard={(id) => { setSelectedBoardId(id); setActiveTab('standards'); }} />
        </TabsContent>
        
        <TabsContent value="standards" className="space-y-4">
          <StandardsTab boardId={selectedBoardId} onSelectStandard={(id) => { setSelectedStandardId(id); setActiveTab('subjects'); }} />
        </TabsContent>
        
        <TabsContent value="subjects" className="space-y-4">
          <SubjectsTab standardId={selectedStandardId} onSelectSubject={(id) => { setSelectedSubjectId(id); setActiveTab('chapters'); }} />
        </TabsContent>
        
        <TabsContent value="chapters" className="space-y-4">
          <ChaptersTab subjectId={selectedSubjectId} onSelectChapter={(id) => { setSelectedChapterId(id); setActiveTab('topics'); }} />
        </TabsContent>
        
        <TabsContent value="topics" className="space-y-4">
          <TopicsTab chapterId={selectedChapterId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BoardsTab({ onSelectBoard }: { onSelectBoard: (id: number) => void }) {
  const { data, isLoading } = useListBoards();
  const deleteBoard = useDeleteBoard();
  const createBoard = useCreateBoard();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');

  const handleDelete = (id: number) => {
    deleteBoard.mutate({ id }, {
      onSuccess: () => {
        toast({ title: 'Board deleted' });
        queryClient.invalidateQueries({ queryKey: getListBoardsQueryKey() });
      },
      onError: (err) => {
        toast({ variant: 'destructive', title: 'Failed to delete board', description: err.message });
      }
    });
  };

  const handleCreate = () => {
    if (!name.trim() || !code.trim()) {
      toast({ variant: 'destructive', title: 'Name and code are required' });
      return;
    }
    createBoard.mutate(
      { data: { name: name.trim(), code: code.trim().toUpperCase(), description: description.trim() || undefined } },
      {
        onSuccess: () => {
          toast({ title: 'Board created!' });
          queryClient.invalidateQueries({ queryKey: getListBoardsQueryKey() });
          setDialogOpen(false);
          setName(''); setCode(''); setDescription('');
        },
        onError: (err) => {
          toast({ variant: 'destructive', title: 'Failed to create board', description: err.message });
        }
      }
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Boards</CardTitle>
            <CardDescription>Top-level educational bodies. Click a board to drill into its standards.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Board
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-64 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((board) => (
                  <TableRow key={board.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectBoard(board.id)}>
                    <TableCell className="font-mono text-xs">{board.code}</TableCell>
                    <TableCell className="font-medium flex items-center gap-2">{board.name} <ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                    <TableCell><Badge variant={board.isActive ? 'default' : 'secondary'}>{board.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{board.createdAt ? format(parseISO(board.createdAt), 'MMM d, yyyy') : '-'}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete the board and all nested data.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(board.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
                {(!data?.data || data.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No boards found. Add one to get started.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Board</DialogTitle>
            <DialogDescription>Create a new top-level educational board (e.g. CBSE, ICSE).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="board-name">Name <span className="text-destructive">*</span></Label>
              <Input id="board-name" placeholder="e.g. Central Board of Secondary Education" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="board-code">Code <span className="text-destructive">*</span></Label>
              <Input id="board-code" placeholder="e.g. CBSE" value={code} onChange={e => setCode(e.target.value)} />
              <p className="text-xs text-muted-foreground">A short unique identifier. Will be uppercased automatically.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="board-desc">Description</Label>
              <Textarea id="board-desc" placeholder="Optional description" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createBoard.isPending}>
              {createBoard.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</> : 'Create Board'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StandardsTab({ boardId, onSelectStandard }: { boardId?: number, onSelectStandard: (id: number) => void }) {
  const { data, isLoading } = useListStandards({ boardId });
  const { data: boardsData } = useListBoards();
  const createStandard = useCreateStandard();
  const deleteStandard = useDeleteStandard();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    deleteStandard.mutate({ id }, {
      onSuccess: () => {
        toast({ title: 'Standard deleted' });
        queryClient.invalidateQueries({ queryKey: getListStandardsQueryKey({ boardId }) });
      },
      onError: (err) => {
        toast({ variant: 'destructive', title: 'Failed to delete standard', description: err.message });
      }
    });
  };

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const [selectedBoard, setSelectedBoard] = useState<string>(boardId ? String(boardId) : '');

  const handleCreate = () => {
    if (!name.trim() || !level.trim() || !selectedBoard) {
      toast({ variant: 'destructive', title: 'Name, level, and board are required' });
      return;
    }
    createStandard.mutate(
      { data: { name: name.trim(), level: parseInt(level), boardId: parseInt(selectedBoard) } },
      {
        onSuccess: () => {
          toast({ title: 'Standard created!' });
          queryClient.invalidateQueries({ queryKey: getListStandardsQueryKey({ boardId: parseInt(selectedBoard) }) });
          setDialogOpen(false);
          setName(''); setLevel('');
        },
        onError: (err) => {
          toast({ variant: 'destructive', title: 'Failed to create standard', description: err.message });
        }
      }
    );
  };

  const openDialog = () => {
    setSelectedBoard(boardId ? String(boardId) : '');
    setDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Standards</CardTitle>
            <CardDescription>Grade levels. Click to see its subjects.</CardDescription>
          </div>
          <Button size="sm" onClick={openDialog}>
            <Plus className="mr-2 h-4 w-4" /> Add Standard
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-64 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Level</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Board</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectStandard(item.id)}>
                    <TableCell>{item.level}</TableCell>
                    <TableCell className="font-medium flex items-center gap-2">{item.name} <ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                    <TableCell className="text-muted-foreground">{item.boardName}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete standard?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete <strong>{item.name}</strong> and all its subjects, chapters, and topics.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
                {(!data?.data || data.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">{boardId ? 'No standards found for this board.' : 'Select a board first, or add a standard for any board.'}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Standard</DialogTitle>
            <DialogDescription>Create a new grade level / standard under a board.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Board <span className="text-destructive">*</span></Label>
              <Select value={selectedBoard} onValueChange={setSelectedBoard}>
                <SelectTrigger>
                  <SelectValue placeholder="Select board" />
                </SelectTrigger>
                <SelectContent>
                  {boardsData?.data.map(b => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name} ({b.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="std-name">Name <span className="text-destructive">*</span></Label>
              <Input id="std-name" placeholder="e.g. Grade 10" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="std-level">Level (number) <span className="text-destructive">*</span></Label>
              <Input id="std-level" type="number" placeholder="e.g. 10" value={level} onChange={e => setLevel(e.target.value)} />
              <p className="text-xs text-muted-foreground">Numeric ordering of the grade (e.g. 1 for Grade 1, 12 for Grade 12).</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createStandard.isPending}>
              {createStandard.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</> : 'Create Standard'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SubjectsTab({ standardId, onSelectSubject }: { standardId?: number, onSelectSubject: (id: number) => void }) {
  const { data, isLoading } = useListSubjects({ standardId });
  const { data: standardsData } = useListStandards({});
  const createSubject = useCreateSubject();
  const deleteSubject = useDeleteSubject();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    deleteSubject.mutate({ id }, {
      onSuccess: () => {
        toast({ title: 'Subject deleted' });
        queryClient.invalidateQueries({ queryKey: getListSubjectsQueryKey() });
      },
      onError: (err) => {
        toast({ variant: 'destructive', title: 'Failed to delete subject', description: err.message });
      }
    });
  };

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [selectedStandard, setSelectedStandard] = useState<string>(standardId ? String(standardId) : '');

  const handleCreate = () => {
    if (!name.trim() || !code.trim() || !selectedStandard) {
      toast({ variant: 'destructive', title: 'Name, code, and standard are required' });
      return;
    }
    createSubject.mutate(
      { data: { name: name.trim(), code: code.trim().toUpperCase(), standardId: parseInt(selectedStandard) } },
      {
        onSuccess: () => {
          toast({ title: 'Subject created!' });
          queryClient.invalidateQueries({ queryKey: getListSubjectsQueryKey() });
          setDialogOpen(false);
          setName(''); setCode('');
        },
        onError: (err) => {
          toast({ variant: 'destructive', title: 'Failed to create subject', description: err.message });
        }
      }
    );
  };

  const openDialog = () => {
    setSelectedStandard(standardId ? String(standardId) : '');
    setDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Subjects</CardTitle>
            <CardDescription>Academic subjects. Click to see its chapters.</CardDescription>
          </div>
          <Button size="sm" onClick={openDialog}>
            <Plus className="mr-2 h-4 w-4" /> Add Subject
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-64 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Standard</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectSubject(item.id)}>
                    <TableCell className="font-mono text-xs">{item.code}</TableCell>
                    <TableCell className="font-medium flex items-center gap-2">{item.name} <ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                    <TableCell className="text-muted-foreground">{item.standardName}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete subject?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete <strong>{item.name}</strong> and all its chapters, topics, and questions.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
                {(!data?.data || data.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">{standardId ? 'No subjects found.' : 'Select a standard first, or add a subject for any standard.'}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Subject</DialogTitle>
            <DialogDescription>Create a new academic subject under a standard.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Standard <span className="text-destructive">*</span></Label>
              <Select value={selectedStandard} onValueChange={setSelectedStandard}>
                <SelectTrigger>
                  <SelectValue placeholder="Select standard" />
                </SelectTrigger>
                <SelectContent>
                  {standardsData?.data.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name} — {s.boardName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subj-name">Name <span className="text-destructive">*</span></Label>
              <Input id="subj-name" placeholder="e.g. Mathematics" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subj-code">Code <span className="text-destructive">*</span></Label>
              <Input id="subj-code" placeholder="e.g. MATH" value={code} onChange={e => setCode(e.target.value)} />
              <p className="text-xs text-muted-foreground">A short unique code. Will be uppercased automatically.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createSubject.isPending}>
              {createSubject.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</> : 'Create Subject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ChaptersTab({ subjectId, onSelectChapter }: { subjectId?: number, onSelectChapter: (id: number) => void }) {
  const { data, isLoading } = useListChapters({ subjectId });
  const { data: subjectsData } = useListSubjects({});
  const { data: syllabusCategories } = useListChapterSyllabusCategories();
  const createChapter = useCreateChapter();
  const deleteChapter = useDeleteChapter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    deleteChapter.mutate({ id }, {
      onSuccess: () => {
        toast({ title: 'Chapter deleted' });
        queryClient.invalidateQueries({ queryKey: getListChaptersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListChapterSyllabusCategoriesQueryKey() });
      },
      onError: (err) => {
        toast({ variant: 'destructive', title: 'Failed to delete chapter', description: err.message });
      }
    });
  };

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [orderIndex, setOrderIndex] = useState('1');
  const [selectedSubject, setSelectedSubject] = useState<string>(subjectId ? String(subjectId) : '');
  const [syllabus, setSyllabus] = useState<string>('__none__');
  const [customSyllabus, setCustomSyllabus] = useState<string>('');

  const handleCreate = () => {
    if (!name.trim() || !selectedSubject) {
      toast({ variant: 'destructive', title: 'Name and subject are required' });
      return;
    }
    
    const finalSyllabus = syllabus === '__custom__' ? customSyllabus.trim() : (syllabus === '__none__' ? null : syllabus);
    if (syllabus === '__custom__' && !finalSyllabus) {
      toast({ variant: 'destructive', title: 'Please provide a custom category name' });
      return;
    }

    createChapter.mutate(
      { data: { name: name.trim(), orderIndex: parseInt(orderIndex) || 1, subjectId: parseInt(selectedSubject), syllabus: finalSyllabus } },
      {
        onSuccess: () => {
          toast({ title: 'Chapter created!' });
          queryClient.invalidateQueries({ queryKey: getListChaptersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListChapterSyllabusCategoriesQueryKey() });
          setDialogOpen(false);
          setName(''); setOrderIndex('1'); setSyllabus('__none__'); setCustomSyllabus('');
        },
        onError: (err) => {
          toast({ variant: 'destructive', title: 'Failed to create chapter', description: err.message });
        }
      }
    );
  };

  const openDialog = () => {
    setSelectedSubject(subjectId ? String(subjectId) : '');
    setSyllabus('__none__');
    setCustomSyllabus('');
    setDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Chapters</CardTitle>
            <CardDescription>Subject chapters. Click to see its topics.</CardDescription>
          </div>
          <Button size="sm" onClick={openDialog}>
            <Plus className="mr-2 h-4 w-4" /> Add Chapter
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-64 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectChapter(item.id)}>
                    <TableCell>{item.orderIndex}</TableCell>
                    <TableCell className="font-medium flex items-center gap-2">
                      {item.name}
                      {item.syllabus && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-semibold py-0.5 px-2">
                          {item.syllabus}
                        </Badge>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.subjectName}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete chapter?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete <strong>{item.name}</strong> and all its topics and questions.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
                {(!data?.data || data.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">{subjectId ? 'No chapters found.' : 'Select a subject first, or add a chapter for any subject.'}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Chapter</DialogTitle>
            <DialogDescription>Create a new chapter under a subject.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Subject <span className="text-destructive">*</span></Label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjectsData?.data.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.code}) — {s.standardName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="chap-name">Chapter Name <span className="text-destructive">*</span></Label>
              <Input id="chap-name" placeholder="e.g. Real Numbers" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chap-order">Order / Chapter Number</Label>
              <Input id="chap-order" type="number" min={1} placeholder="1" value={orderIndex} onChange={e => setOrderIndex(e.target.value)} className="w-32" />
              <p className="text-xs text-muted-foreground">Used to sort chapters in order.</p>
            </div>
            <div className="space-y-2">
              <Label>Syllabus Category (Optional)</Label>
              <Select value={syllabus} onValueChange={setSyllabus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select syllabus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None / General</SelectItem>
                  {syllabusCategories?.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">+ Add Custom Category...</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {syllabus === '__custom__' && (
              <div className="space-y-2 animate-in fade-in-50 duration-200">
                <Label htmlFor="chap-custom-syllabus">Custom Category Name <span className="text-destructive">*</span></Label>
                <Input 
                  id="chap-custom-syllabus" 
                  placeholder="e.g. NEET, MHT-CET" 
                  value={customSyllabus} 
                  onChange={e => setCustomSyllabus(e.target.value)} 
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createChapter.isPending}>
              {createChapter.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</> : 'Create Chapter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TopicsTab({ chapterId }: { chapterId?: number }) {
  const { data, isLoading } = useListTopics({ chapterId });
  const { data: chaptersData } = useListChapters({});
  const deleteTopic = useDeleteTopic();
  const createTopic = useCreateTopic();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedChapter, setSelectedChapter] = useState<string>(chapterId ? String(chapterId) : '');

  const handleDelete = (id: number) => {
    deleteTopic.mutate({ id }, {
      onSuccess: () => {
        toast({ title: 'Topic deleted' });
        queryClient.invalidateQueries({ queryKey: getListTopicsQueryKey() });
      },
      onError: (err) => {
        toast({ variant: 'destructive', title: 'Failed to delete', description: err.message });
      }
    });
  };

  const handleCreate = () => {
    if (!name.trim() || !selectedChapter) {
      toast({ variant: 'destructive', title: 'Name and chapter are required' });
      return;
    }
    createTopic.mutate(
      { data: { name: name.trim(), description: description.trim() || undefined, chapterId: parseInt(selectedChapter) } },
      {
        onSuccess: () => {
          toast({ title: 'Topic created!' });
          queryClient.invalidateQueries({ queryKey: getListTopicsQueryKey() });
          setAddDialogOpen(false);
          setName(''); setDescription('');
        },
        onError: (err) => {
          toast({ variant: 'destructive', title: 'Failed to create topic', description: err.message });
        }
      }
    );
  };

  const openAddDialog = () => {
    setSelectedChapter(chapterId ? String(chapterId) : '');
    setAddDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Topics</CardTitle>
            <CardDescription>
              {chapterId ? 'Specific learning topics for the selected chapter.' : 'Select a chapter first to see its topics.'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!chapterId}
              onClick={() => setAiDialogOpen(true)}
              className="border-primary/50 text-primary hover:bg-primary/10"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Generate with AI
            </Button>
            <Button size="sm" onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" /> Add Topic
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-64 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Questions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-sm truncate">{item.description ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.questionsCount}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.isActive ? 'default' : 'secondary'}>{item.isActive ? 'Active' : 'Inactive'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete topic?</AlertDialogTitle>
                            <AlertDialogDescription>This cannot be undone. Any questions linked to this topic will also be affected.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
                {(!data?.data || data.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      {chapterId
                        ? 'No topics yet. Add one manually or use "Generate with AI" to auto-populate.'
                        : 'Select a chapter from the Chapters tab first.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Topic</DialogTitle>
            <DialogDescription>Create a new learning topic under a chapter.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Chapter <span className="text-destructive">*</span></Label>
              <Select value={selectedChapter} onValueChange={setSelectedChapter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select chapter" />
                </SelectTrigger>
                <SelectContent>
                  {chaptersData?.data.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name} — {c.subjectName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="topic-name">Topic Name <span className="text-destructive">*</span></Label>
              <Input id="topic-name" placeholder="e.g. Euclid's Division Lemma" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="topic-desc">Description</Label>
              <Textarea id="topic-desc" placeholder="Optional description of this topic" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createTopic.isPending}>
              {createTopic.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</> : 'Create Topic'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {chapterId && (
        <AiGenerateTopicsDialog
          open={aiDialogOpen}
          onClose={() => setAiDialogOpen(false)}
          chapterId={chapterId}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: getListTopicsQueryKey() });
          }}
        />
      )}
    </>
  );
}

interface AiGenerateTopicsDialogProps {
  open: boolean;
  onClose: () => void;
  chapterId: number;
  onSaved: () => void;
}

function AiGenerateTopicsDialog({ open, onClose, chapterId, onSaved }: AiGenerateTopicsDialogProps) {
  const { toast } = useToast();
  const token = useAuthStore((s) => s.token);

  const { data: providers } = useListAiProviders();

  const [providerId, setProviderId] = useState<string>('');
  const [model, setModel] = useState<string>('');

  const [step, setStep] = useState<'config' | 'review'>('config');
  const [generatedTopics, setGeneratedTopics] = useState<AiTopic[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [chapterName, setChapterName] = useState('');

  const selectedProvider = providers?.find(p => p.id === Number(parseInt(providerId)));

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/topics/ai-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ chapterId, providerId: parseInt(providerId), model }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? 'Generation failed');
      }
      return res.json() as Promise<{ topics: AiTopic[]; chapterName: string }>;
    },
    onSuccess: (data) => {
      setGeneratedTopics(data.topics);
      setChapterName(data.chapterName);
      setSelected(new Set(data.topics.map((_, i) => i)));
      setStep('review');
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Generation failed', description: err.message });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const toSave = generatedTopics.filter((_, i) => selected.has(i));
      const res = await fetch('/api/topics/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ chapterId, topics: toSave }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? 'Save failed');
      }
      return res.json() as Promise<{ saved: number }>;
    },
    onSuccess: (data) => {
      toast({ title: `${data.saved} topics saved!`, description: `Added to chapter successfully.` });
      onSaved();
      handleClose();
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Save failed', description: err.message });
    },
  });

  const handleClose = () => {
    setStep('config');
    setGeneratedTopics([]);
    setSelected(new Set());
    onClose();
  };

  const toggleSelect = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(generatedTopics.map((_, i) => i)));
  const deselectAll = () => setSelected(new Set());

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-2xl">
        {step === 'config' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Topic Generator
              </DialogTitle>
              <DialogDescription>
                AI will analyze the chapter and suggest curriculum-aligned topics with descriptions. You can review and select which ones to save.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>AI Provider</Label>
                  <Select value={providerId} onValueChange={(v) => { setProviderId(v); setModel(''); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers?.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select value={model} onValueChange={setModel} disabled={!providerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProvider?.availableModels?.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-md bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                AI will determine the appropriate number of topics based on the real curriculum for this chapter. You can review and deselect any topics before saving.
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={!providerId || !model || generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" /> Generate Topics</>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Review Generated Topics
              </DialogTitle>
              <DialogDescription>
                AI generated {generatedTopics.length} topics for <strong>{chapterName}</strong>.
                Select the ones you want to save — {selected.size} selected.
              </DialogDescription>
            </DialogHeader>

            <div className="flex gap-2 text-sm">
              <button onClick={selectAll} className="text-primary hover:underline">Select all</button>
              <span className="text-muted-foreground">·</span>
              <button onClick={deselectAll} className="text-muted-foreground hover:underline">Deselect all</button>
            </div>

            <ScrollArea className="h-[360px] rounded-md border p-2">
              <div className="space-y-2">
                {generatedTopics.map((topic, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 rounded-lg p-3 cursor-pointer transition-colors ${selected.has(i) ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50'}`}
                    onClick={() => toggleSelect(i)}
                  >
                    <Checkbox
                      checked={selected.has(i)}
                      onCheckedChange={() => toggleSelect(i)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{topic.name}</p>
                      {topic.description && (
                        <p className="text-xs text-muted-foreground mt-1">{topic.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('config')}>Back</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={selected.size === 0 || saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
                ) : (
                  <>Save {selected.size} Topic{selected.size !== 1 ? 's' : ''}</>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
