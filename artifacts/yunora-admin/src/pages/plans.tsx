import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  useListPlans,
  useCreatePlan,
  useUpdatePlan,
  useDeletePlan,
  Plan,
  useListBoards,
  useListStandards,
  useListSubjects,
  useListChapters
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type AccessScope = "all" | "board" | "standard" | "subject" | "chapter";

export default function PlansPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingPlan, setEditingPlan] = React.useState<Plan | null>(null);

  const { data: plansData, isLoading } = useListPlans();
  const { data: boardsData } = useListBoards();

  const [formData, setFormData] = React.useState({
    name: '',
    price: 0,
    questionLimit: 100,
    isActive: true,
    accessScope: 'all' as AccessScope,
    durationDays: '' as string | number,
    boardId: '' as string | number,
    standardId: '' as string | number,
    subjectId: '' as string | number,
    chapterId: '' as string | number,
  });

  const { data: standardsData } = useListStandards(
    { boardId: formData.boardId ? Number(formData.boardId) : undefined }
  );

  const { data: subjectsData } = useListSubjects(
    { standardId: formData.standardId ? Number(formData.standardId) : undefined }
  );

  const { data: chaptersData } = useListChapters(
    { subjectId: formData.subjectId ? Number(formData.subjectId) : undefined }
  );

  const createMutation = useCreatePlan({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['listPlans'] });
        toast({ title: 'Plan created successfully' });
        setIsDialogOpen(false);
        resetForm();
      },
      onError: () => {
        toast({ title: 'Failed to create plan', variant: 'destructive' });
      }
    }
  });

  const updateMutation = useUpdatePlan({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['listPlans'] });
        toast({ title: 'Plan updated successfully' });
        setIsDialogOpen(false);
        resetForm();
      },
      onError: () => {
        toast({ title: 'Failed to update plan', variant: 'destructive' });
      }
    }
  });

  const deleteMutation = useDeletePlan({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['listPlans'] });
        toast({ title: 'Plan deleted successfully' });
      },
      onError: () => {
        toast({ title: 'Failed to delete plan', variant: 'destructive' });
      }
    }
  });

  const resetForm = () => {
    setFormData({ 
      name: '', price: 0, questionLimit: 100, isActive: true, 
      accessScope: 'all', durationDays: '', boardId: '', standardId: '', subjectId: '', chapterId: '' 
    });
    setEditingPlan(null);
  };

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      price: plan.price,
      questionLimit: plan.questionLimit,
      isActive: plan.isActive,
      accessScope: plan.accessScope as AccessScope || 'all',
      durationDays: plan.durationDays ?? '',
      boardId: plan.boardId ?? '',
      standardId: plan.standardId ?? '',
      subjectId: plan.subjectId ?? '',
      chapterId: plan.chapterId ?? '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this plan?')) {
      deleteMutation.mutate({ id });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      durationDays: formData.durationDays ? Number(formData.durationDays) : null,
      boardId: formData.boardId ? Number(formData.boardId) : null,
      standardId: formData.standardId ? Number(formData.standardId) : null,
      subjectId: formData.subjectId ? Number(formData.subjectId) : null,
      chapterId: formData.chapterId ? Number(formData.chapterId) : null,
      accessScope: formData.accessScope as any,
    };

    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, data: payload });
    } else {
      createMutation.mutate({ data: payload });
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Plans & Pricing</h1>
          <p className="text-muted-foreground mt-1">
            Manage subscription plans, pricing, and access limits.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPlan ? 'Edit Plan' : 'Create New Plan'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Plan Name</Label>
                  <Input 
                    id="name" 
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price (INR)</Label>
                  <Input 
                    id="price" 
                    type="number" 
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="questionLimit">Question Limit</Label>
                  <Input 
                    id="questionLimit" 
                    type="number" 
                    value={formData.questionLimit}
                    onChange={(e) => setFormData({ ...formData, questionLimit: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="durationDays">Duration (Days)</Label>
                  <Input 
                    id="durationDays" 
                    type="number" 
                    placeholder="Leave empty for One-time pay"
                    value={formData.durationDays}
                    onChange={(e) => setFormData({ ...formData, durationDays: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <Label>Access Scope</Label>
                <Select 
                  value={formData.accessScope} 
                  onValueChange={(val) => setFormData({ ...formData, accessScope: val as AccessScope })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Access</SelectItem>
                    <SelectItem value="board">Specific Board</SelectItem>
                    <SelectItem value="standard">Specific Standard</SelectItem>
                    <SelectItem value="subject">Specific Subject</SelectItem>
                    <SelectItem value="chapter">Specific Chapter</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.accessScope !== 'all' && (
                <div className="grid grid-cols-2 gap-4 bg-muted/50 p-4 rounded-md">
                  <div className="space-y-2">
                    <Label>Board</Label>
                    <Select 
                      value={String(formData.boardId)} 
                      onValueChange={(val) => setFormData({ ...formData, boardId: val, standardId: '', subjectId: '', chapterId: '' })}
                    >
                      <SelectTrigger><SelectValue placeholder="Select Board" /></SelectTrigger>
                      <SelectContent>
                        {boardsData?.data.map((b: any) => (
                          <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {(formData.accessScope === 'standard' || formData.accessScope === 'subject' || formData.accessScope === 'chapter') && (
                    <div className="space-y-2">
                      <Label>Standard</Label>
                      <Select 
                        value={String(formData.standardId)} 
                        onValueChange={(val) => setFormData({ ...formData, standardId: val, subjectId: '', chapterId: '' })}
                        disabled={!formData.boardId}
                      >
                        <SelectTrigger><SelectValue placeholder="Select Standard" /></SelectTrigger>
                        <SelectContent>
                          {standardsData?.data.map((s: any) => (
                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(formData.accessScope === 'subject' || formData.accessScope === 'chapter') && (
                    <div className="space-y-2">
                      <Label>Subject</Label>
                      <Select 
                        value={String(formData.subjectId)} 
                        onValueChange={(val) => setFormData({ ...formData, subjectId: val, chapterId: '' })}
                        disabled={!formData.standardId}
                      >
                        <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
                        <SelectContent>
                          {subjectsData?.data.map((s: any) => (
                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {formData.accessScope === 'chapter' && (
                    <div className="space-y-2">
                      <Label>Chapter</Label>
                      <Select 
                        value={String(formData.chapterId)} 
                        onValueChange={(val) => setFormData({ ...formData, chapterId: val })}
                        disabled={!formData.subjectId}
                      >
                        <SelectTrigger><SelectValue placeholder="Select Chapter" /></SelectTrigger>
                        <SelectContent>
                          {chaptersData?.data.map((c: any) => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t">
                <Label htmlFor="isActive">Active Status</Label>
                <Switch 
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
              <div className="pt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit">
                  {editingPlan ? 'Update Plan' : 'Create Plan'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Price / Scope</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Question Limit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading plans...
                </TableCell>
              </TableRow>
            ) : !plansData?.data || plansData.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No plans found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              plansData.data.map((plan: Plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>₹{plan.price}</span>
                      <span className="text-xs text-muted-foreground uppercase">{plan.accessScope}</span>
                    </div>
                  </TableCell>
                  <TableCell>{plan.durationDays ? `${plan.durationDays} Days` : 'Lifetime'}</TableCell>
                  <TableCell>{plan.questionLimit}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${plan.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(plan)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(plan.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
