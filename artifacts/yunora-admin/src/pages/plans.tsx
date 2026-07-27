import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  useListPlans,
  useCreatePlan,
  useUpdatePlan,
  useDeletePlan,
  Plan
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

export default function PlansPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingPlan, setEditingPlan] = React.useState<Plan | null>(null);

  const { data: plansData, isLoading } = useListPlans();

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

  const [formData, setFormData] = React.useState({
    name: '',
    price: 0,
    questionLimit: 100,
    isActive: true,
  });

  const resetForm = () => {
    setFormData({ name: '', price: 0, questionLimit: 100, isActive: true });
    setEditingPlan(null);
  };

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      price: plan.price,
      questionLimit: plan.questionLimit,
      isActive: plan.isActive,
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
    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, data: formData });
    } else {
      createMutation.mutate({ data: formData });
    }
  };

  return (
    <div className="space-y-6">
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPlan ? 'Edit Plan' : 'Create New Plan'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
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
              <div className="flex items-center justify-between pt-2">
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
              <TableHead>Price (INR)</TableHead>
              <TableHead>Question Limit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Loading plans...
                </TableCell>
              </TableRow>
            ) : !plansData?.data || plansData.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No plans found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              plansData.data.map((plan: Plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>₹{plan.price}</TableCell>
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
