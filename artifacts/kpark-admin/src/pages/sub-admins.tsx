import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/hooks/use-auth';
import { 
  UserPlus, 
  ShieldCheck, 
  Trash2, 
  KeyRound, 
  CheckCircle2, 
  Clock, 
  FileUp, 
  Sparkles, 
  LibraryBig, 
  FileText, 
  Layers, 
  Globe, 
  BarChart3,
  Loader2,
  Users
} from 'lucide-react';

export interface SubAdmin {
  id: number;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const PERMISSION_DEFINITIONS = [
  { key: 'pdf-extractor', label: 'PDF AI Extractor', description: 'Upload and extract curriculum from textbooks & PDFs', icon: FileUp },
  { key: 'generate', label: 'Question Generator', description: 'Generate original questions with AI solver & LaTeX', icon: Sparkles },
  { key: 'questions', label: 'Question Bank', description: 'View, search, and manage question repository', icon: LibraryBig },
  { key: 'papers', label: 'Test Papers', description: 'Create, edit, and export mock test papers', icon: FileText },
  { key: 'hierarchy', label: 'Curriculum Hierarchy', description: 'Manage Boards, Standards, Subjects, Chapters & Topics', icon: Layers },
  { key: 'translate', label: 'Translations', description: 'Run multi-language translation pipelines', icon: Globe },
  { key: 'analytics', label: 'Analytics', description: 'View generation performance & usage metrics', icon: BarChart3 },
];

export default function SubAdminsPage() {
  const token = useAuthStore((s) => s.token);
  const currentUser = useAuthStore((s) => s.user);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSubAdmin, setEditingSubAdmin] = useState<SubAdmin | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    'pdf-extractor',
    'generate',
    'questions',
  ]);

  // Fetch Sub-Admins
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['subadmins'],
    queryFn: async () => {
      const res = await fetch('/api/subadmins', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load sub-admins');
      return res.json() as Promise<{ subadmins: SubAdmin[]; count: number }>;
    },
  });

  // Fetch Pending Approvals Count
  const { data: approvalsData } = useQuery({
    queryKey: ['approvals-count'],
    queryFn: async () => {
      const res = await fetch('/api/approvals?status=pending&limit=1', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { pendingCount: 0 };
      return res.json() as Promise<{ pendingCount: number }>;
    },
  });

  // Create Sub-Admin Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/subadmins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          email,
          password,
          permissions: selectedPermissions,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create sub-admin');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: '✨ Sub-Admin Created',
        description: `Successfully registered ${name} (${email}).`,
      });
      setIsCreateOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      setSelectedPermissions(['pdf-extractor', 'generate', 'questions']);
      queryClient.invalidateQueries({ queryKey: ['subadmins'] });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Creation Failed',
        description: err.message,
      });
    },
  });

  // Update Sub-Admin Mutation
  const updateMutation = useMutation({
    mutationFn: async (payload: { id: number; permissions?: string[]; isActive?: boolean; password?: string }) => {
      const res = await fetch(`/api/subadmins/${payload.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update sub-admin');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Sub-Admin Updated', description: 'Changes saved successfully.' });
      setEditingSubAdmin(null);
      queryClient.invalidateQueries({ queryKey: ['subadmins'] });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Update Failed', description: err.message });
    },
  });

  // Delete Sub-Admin Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/subadmins/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete sub-admin');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Sub-Admin Removed', description: 'Account deleted.' });
      queryClient.invalidateQueries({ queryKey: ['subadmins'] });
    },
  });

  const togglePermission = (permKey: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permKey) ? prev.filter((p) => p !== permKey) : [...prev, permKey]
    );
  };

  const subadminsList = data?.subadmins || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <Users className="h-6 w-6 text-primary" /> Sub-Admin Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create sub-administrators, delegate specific task permissions, and monitor their workflow approvals.
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shrink-0">
              <UserPlus className="h-4 w-4" /> Add New Sub-Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[540px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" /> Create Sub-Admin Account
              </DialogTitle>
              <DialogDescription>
                Set credentials and choose which specific sections of Knowledge Park this sub-admin is permitted to access.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sub-name">Full Name</Label>
                  <Input
                    id="sub-name"
                    placeholder="e.g. John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sub-email">Email Address</Label>
                  <Input
                    id="sub-email"
                    type="email"
                    placeholder="subadmin@institution.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sub-password">Temporary Password</Label>
                <Input
                  id="sub-password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Task Permissions (What can this Sub-Admin do?)
                </Label>
                <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                  {PERMISSION_DEFINITIONS.map((perm) => {
                    const isChecked = selectedPermissions.includes(perm.key);
                    const IconComp = perm.icon;
                    return (
                      <div
                        key={perm.key}
                        onClick={() => togglePermission(perm.key)}
                        className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-primary/5 border-primary/40 ring-1 ring-primary/20'
                            : 'bg-background hover:bg-muted/40 border-border'
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => togglePermission(perm.key)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="text-xs font-semibold flex items-center gap-1.5">
                            <IconComp className="h-3.5 w-3.5 text-primary" /> {perm.label}
                          </div>
                          <p className="text-[11px] text-muted-foreground">{perm.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!name.trim() || !email.trim() || !password.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
                className="gap-2"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Create Account
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-muted-foreground">Total Sub-Admins</span>
            <div className="text-2xl font-bold">{subadminsList.length}</div>
          </div>
          <div className="p-3 rounded-full bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-muted-foreground">Active Accounts</span>
            <div className="text-2xl font-bold text-emerald-600">
              {subadminsList.filter((s) => s.isActive).length}
            </div>
          </div>
          <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-muted-foreground">Pending Approvals</span>
            <div className="text-2xl font-bold text-amber-600">
              {approvalsData?.pendingCount ?? 0}
            </div>
          </div>
          <div className="p-3 rounded-full bg-amber-500/10 text-amber-600">
            <Clock className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* Sub-Admins Table / Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sub-Administrator Accounts</CardTitle>
          <CardDescription>
            All actions and database updates performed by these accounts will require your approval before going live.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>Loading sub-admins...</span>
            </div>
          ) : subadminsList.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-3">
              <Users className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <div className="text-base font-medium text-foreground">No Sub-Admins Configured</div>
              <p className="text-xs max-w-sm mx-auto">
                Create sub-admins to delegate question extraction, paper generation, and translation tasks.
              </p>
              <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(true)} className="gap-2">
                <UserPlus className="h-4 w-4" /> Add First Sub-Admin
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {subadminsList.map((sub) => (
                <div
                  key={sub.id}
                  className="py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-muted/10 transition-colors rounded-lg px-2"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-semibold text-foreground text-sm">{sub.name}</span>
                      <span className="text-xs text-muted-foreground">({sub.email})</span>
                      <Badge
                        variant="outline"
                        className={
                          sub.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]'
                            : 'bg-muted text-muted-foreground text-[10px]'
                        }
                      >
                        {sub.isActive ? 'Active' : 'Suspended'}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                        Approval Required
                      </Badge>
                    </div>

                    {/* Permissions list chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] font-medium text-muted-foreground mr-1">Allowed Tasks:</span>
                      {sub.permissions.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground italic">No tasks assigned</span>
                      ) : (
                        sub.permissions.map((pKey) => {
                          const def = PERMISSION_DEFINITIONS.find((d) => d.key === pKey);
                          const IconComp = def?.icon || ShieldCheck;
                          return (
                            <Badge key={pKey} variant="outline" className="text-[10px] gap-1 py-0.5 px-1.5 bg-background">
                              <IconComp className="h-3 w-3 text-primary" />
                              {def?.label || pKey}
                            </Badge>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      onClick={() => setEditingSubAdmin(sub)}
                    >
                      <KeyRound className="h-3.5 w-3.5 text-muted-foreground" /> Edit Permissions
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm(`Are you sure you want to remove ${sub.name}?`)) {
                          deleteMutation.mutate(sub.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Sub-Admin Permissions Modal */}
      {editingSubAdmin && (
        <Dialog open={!!editingSubAdmin} onOpenChange={(open) => !open && setEditingSubAdmin(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" /> Permissions for {editingSubAdmin.name}
              </DialogTitle>
              <DialogDescription>
                Configure allowed task modules and account status for {editingSubAdmin.email}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold">Account Status</div>
                  <p className="text-[11px] text-muted-foreground">
                    {editingSubAdmin.isActive ? 'Account is currently active and can log in' : 'Account is suspended'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={editingSubAdmin.isActive ? 'outline' : 'default'}
                  className="h-7 text-xs"
                  onClick={() =>
                    setEditingSubAdmin((prev) => prev ? { ...prev, isActive: !prev.isActive } : null)
                  }
                >
                  {editingSubAdmin.isActive ? 'Suspend' : 'Activate'}
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Task Permissions
                </Label>
                <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                  {PERMISSION_DEFINITIONS.map((perm) => {
                    const isChecked = editingSubAdmin.permissions.includes(perm.key);
                    const IconComp = perm.icon;
                    return (
                      <div
                        key={perm.key}
                        onClick={() => {
                          setEditingSubAdmin((prev) => {
                            if (!prev) return null;
                            const nextPerms = isChecked
                              ? prev.permissions.filter((p) => p !== perm.key)
                              : [...prev.permissions, perm.key];
                            return { ...prev, permissions: nextPerms };
                          });
                        }}
                        className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-primary/5 border-primary/40 ring-1 ring-primary/20'
                            : 'bg-background hover:bg-muted/40 border-border'
                        }`}
                      >
                        <Checkbox checked={isChecked} className="mt-0.5" />
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="text-xs font-semibold flex items-center gap-1.5">
                            <IconComp className="h-3.5 w-3.5 text-primary" /> {perm.label}
                          </div>
                          <p className="text-[11px] text-muted-foreground">{perm.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingSubAdmin(null)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  updateMutation.mutate({
                    id: editingSubAdmin.id,
                    permissions: editingSubAdmin.permissions,
                    isActive: editingSubAdmin.isActive,
                  })
                }
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Permissions
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
