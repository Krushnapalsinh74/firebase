import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  useListPlans,
  useCreatePlan,
  useUpdatePlan,
  useDeletePlan,
  Plan,
  useListBoards,
  useListStandards,
  useListSubjects,
  useListChapters,
  customFetch,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, CreditCard, History, CheckCircle2, ShieldCheck, Sparkles, Loader2, ArrowRight } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { openRazorpayCheckout } from '@/lib/razorpay';
import { useAuthStore } from '@/hooks/use-auth';

type AccessScope = "all" | "board" | "standard" | "subject" | "chapter";

export default function PlansPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<'plans' | 'history'>('plans');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [purchasingPlanId, setPurchasingPlanId] = useState<number | null>(null);

  const { data: plansData, isLoading } = useListPlans();
  const { data: boardsData } = useListBoards();

  // Fetch payment history
  const { data: historyData, isLoading: isHistoryLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['paymentHistory'],
    queryFn: async () => {
      const res: any = await customFetch('/payments/history', { method: 'GET' });
      return res?.data || [];
    },
    enabled: activeTab === 'history',
  });

  const [formData, setFormData] = useState({
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
    promoCode: '',
    discountPercent: 0 as string | number,
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
      accessScope: 'all', durationDays: '', boardId: '', standardId: '', subjectId: '', chapterId: '',
      promoCode: '', discountPercent: 0
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
      accessScope: (plan.accessScope as AccessScope) || 'all',
      durationDays: plan.durationDays ?? '',
      boardId: plan.boardId ?? '',
      standardId: plan.standardId ?? '',
      subjectId: plan.subjectId ?? '',
      chapterId: plan.chapterId ?? '',
      promoCode: (plan as any).promoCode ?? '',
      discountPercent: (plan as any).discountPercent ?? 0,
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
      promoCode: formData.promoCode || null,
      discountPercent: formData.discountPercent ? Number(formData.discountPercent) : null,
      accessScope: formData.accessScope as any,
    };

    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, data: payload });
    } else {
      createMutation.mutate({ data: payload });
    }
  };

  // Handle Razorpay Checkout
  const handleBuyPlan = async (plan: Plan) => {
    setPurchasingPlanId(plan.id);
    try {
      // 1. Create order on backend
      const orderRes: any = await customFetch('/payments/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id }),
      });

      if (!orderRes || !orderRes.orderId) {
        throw new Error(orderRes?.error || 'Failed to initialize payment order');
      }

      // 2. Open Razorpay Checkout modal
      await openRazorpayCheckout({
        key: orderRes.keyId,
        amount: orderRes.amountInPaise,
        currency: orderRes.currency || 'INR',
        name: 'KPark Education',
        description: `Subscription: ${plan.name}`,
        order_id: orderRes.orderId,
        prefill: {
          name: user?.name || undefined,
          email: user?.email || undefined,
        },
        theme: {
          color: '#2563eb',
        },
        handler: async (response) => {
          // 3. Verify signature on backend
          try {
            const verifyRes: any = await customFetch('/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (verifyRes.success) {
              toast({
                title: 'Payment Successful!',
                description: `You have successfully subscribed to ${plan.name}.`,
              });
              queryClient.invalidateQueries({ queryKey: ['listPlans'] });
              queryClient.invalidateQueries({ queryKey: ['paymentHistory'] });
              queryClient.invalidateQueries({ queryKey: ['authMe'] });
            } else {
              toast({
                title: 'Payment Verification Failed',
                description: verifyRes.error || 'Please contact support.',
                variant: 'destructive',
              });
            }
          } catch (err: any) {
            toast({
              title: 'Verification Error',
              description: err?.message || 'Failed to verify payment',
              variant: 'destructive',
            });
          } finally {
            setPurchasingPlanId(null);
          }
        },
        onDismiss: () => {
          setPurchasingPlanId(null);
        },
      });
    } catch (err: any) {
      toast({
        title: 'Payment Error',
        description: err?.message || 'Could not initiate Razorpay payment',
        variant: 'destructive',
      });
      setPurchasingPlanId(null);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Plans & Subscriptions</h1>
          <p className="text-muted-foreground mt-1">
            Manage pricing tiers, buy subscription plans via Razorpay, and view payment history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
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
                      placeholder="Leave empty for Lifetime"
                      value={formData.durationDays}
                      onChange={(e) => setFormData({ ...formData, durationDays: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="promoCode">Promo Code</Label>
                    <Input 
                      id="promoCode" 
                      placeholder="e.g. EARLYBIRD"
                      value={formData.promoCode}
                      onChange={(e) => setFormData({ ...formData, promoCode: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discountPercent">Discount (%)</Label>
                    <Input 
                      id="discountPercent" 
                      type="number" 
                      min="0"
                      max="100"
                      value={formData.discountPercent}
                      onChange={(e) => setFormData({ ...formData, discountPercent: Number(e.target.value) })}
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
      </div>

      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="plans" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Pricing & Plans
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2" onClick={() => refetchHistory()}>
            <History className="h-4 w-4" />
            Transaction History
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Plans */}
        <TabsContent value="plans" className="space-y-6 pt-4">
          {/* Plan Cards Display */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {isLoading ? (
              <div className="col-span-3 text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">Loading plans...</p>
              </div>
            ) : !plansData?.data || plansData.data.length === 0 ? (
              <div className="col-span-3 text-center py-12 bg-muted/20 border rounded-xl">
                <p className="text-muted-foreground">No subscription plans found. Add one above.</p>
              </div>
            ) : (
              plansData.data.map((plan: Plan) => {
                const isBuying = purchasingPlanId === plan.id;
                return (
                  <Card key={plan.id} className="relative flex flex-col justify-between border-2 hover:border-primary/50 transition-all shadow-sm">
                    {plan.price > 0 && (
                      <div className="absolute -top-3 right-4 bg-primary text-primary-foreground px-3 py-0.5 rounded-full text-xs font-semibold shadow-sm">
                        Popular
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                          <CardDescription className="capitalize mt-1">
                            {plan.accessScope} Scope Access
                          </CardDescription>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${plan.isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                          {plan.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold tracking-tight">₹{plan.price}</span>
                        <span className="text-sm text-muted-foreground">
                          {plan.durationDays ? ` / ${plan.durationDays} days` : ' / lifetime'}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm flex-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span><strong>{plan.questionLimit}</strong> Questions Limit</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>Full AI Question Generation</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>Multi-language Batch Translation</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>Instant Paper Export & LaTeX</span>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-2 border-t flex flex-col gap-2">
                      <Button 
                        className="w-full gap-2" 
                        onClick={() => handleBuyPlan(plan)}
                        disabled={isBuying || !plan.isActive}
                      >
                        {isBuying ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CreditCard className="h-4 w-4" />
                        )}
                        Subscribe with Razorpay
                      </Button>
                      <div className="flex items-center justify-end w-full gap-1 pt-1">
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => handleEdit(plan)}>
                          <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-destructive hover:text-destructive" onClick={() => handleDelete(plan.id)}>
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                );
              })
            )}
          </div>

          {/* Admin Table View */}
          <div className="rounded-md border bg-card mt-8">
            <div className="p-4 border-b">
              <h2 className="text-base font-semibold">Plan Configuration Matrix</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Price / Scope</TableHead>
                  <TableHead>Promo Code</TableHead>
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
                      <TableCell>
                        {(plan as any).promoCode ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-xs bg-muted px-2 py-1 rounded w-fit">{(plan as any).promoCode}</span>
                            <span className="text-[10px] text-muted-foreground mt-0.5">{(plan as any).discountPercent}% off</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
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
        </TabsContent>

        {/* Tab 2: Transaction History */}
        <TabsContent value="history" className="space-y-4 pt-4">
          <div className="rounded-md border bg-card">
            <div className="p-4 border-b flex justify-between items-center">
              <div>
                <h2 className="text-base font-semibold">Payment Transactions & Orders</h2>
                <p className="text-xs text-muted-foreground">Real-time record of Razorpay orders and verified payments.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchHistory()} className="gap-2">
                <History className="h-3.5 w-3.5" />
                Refresh
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order / Payment ID</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>User Email</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isHistoryLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading transaction records...
                    </TableCell>
                  </TableRow>
                ) : !historyData || historyData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      No payment transactions recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  historyData.map((order: any) => {
                    const isPaid = order.status === 'paid';
                    const dateStr = order.createdAt?._seconds
                      ? new Date(order.createdAt._seconds * 1000).toLocaleString()
                      : order.createdAt
                      ? new Date(order.createdAt).toLocaleString()
                      : 'N/A';

                    return (
                      <TableRow key={order.id || order.razorpayOrderId}>
                        <TableCell className="font-mono text-xs">
                          <div>{order.razorpayOrderId}</div>
                          {order.razorpayPaymentId && (
                            <div className="text-muted-foreground text-[11px]">{order.razorpayPaymentId}</div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{order.planName || `Plan #${order.planId}`}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{order.userEmail || order.userId || 'Student'}</TableCell>
                        <TableCell className="font-semibold">₹{order.amount}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${isPaid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>
                            {isPaid ? 'Paid' : order.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">{dateStr}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
