import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStudentStore } from '@/hooks/use-student-store';
import { useAuthStore } from '@/hooks/use-auth';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface Board {
  id: number;
  name: string;
}

interface Standard {
  id: number;
  name: string;
  boardId?: number;
}

export function StudentOnboardingDialog() {
  const { token, user } = useAuthStore();
  const { toast } = useToast();
  
  const { 
    hasCompletedOnboarding, 
    selectedBoardId, 
    selectedStandardId,
    setBoardAndStandard 
  } = useStudentStore();

  const [isOpen, setIsOpen] = useState(false);
  const [tempBoardId, setTempBoardId] = useState<number | null>(null);
  const [tempStandardId, setTempStandardId] = useState<number | null>(null);

  // Check if we need to show onboarding
  useEffect(() => {
    if (user?.role === 'student' && (!hasCompletedOnboarding || !selectedBoardId || !selectedStandardId)) {
      setIsOpen(true);
    }
  }, [user, hasCompletedOnboarding, selectedBoardId, selectedStandardId]);

  const { data: bootstrap, isLoading } = useQuery({
    queryKey: ['student', 'bootstrap'],
    queryFn: async () => {
      const res = await fetch('/api/student/bootstrap', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load curriculum');
      return (await res.json()) as {
        boards: Board[];
        standards: Standard[];
      };
    },
    enabled: isOpen && !!token,
    staleTime: 60_000,
  });

  const boards = bootstrap?.boards ?? [];
  const standards = (bootstrap?.standards ?? []).filter(
    (s) => !tempBoardId || !s.boardId || s.boardId === tempBoardId
  );

  const handleSave = () => {
    if (!tempBoardId || !tempStandardId) {
      toast({ title: 'Please select both Board and Grade', variant: 'destructive' });
      return;
    }
    const bName = boards.find((b) => b.id === tempBoardId)?.name || 'Board';
    const sName = standards.find((s) => s.id === tempStandardId)?.name || 'Class';

    setBoardAndStandard(tempBoardId, bName, tempStandardId, sName);
    setIsOpen(false);

    toast({
      title: 'Curriculum Loaded! 🎯',
      description: `Active curriculum: ${bName} • ${sName}.`,
    });
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      // Prevent closing if they haven't completed onboarding
      if (!open && (!hasCompletedOnboarding || !selectedBoardId || !selectedStandardId)) return;
      setIsOpen(open);
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Welcome to Knowledge Park! 🎓</DialogTitle>
          <DialogDescription>
            Before we start, please select your curriculum so we can personalize your learning experience.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold">1. Select your Board</label>
            <Select 
              value={tempBoardId ? String(tempBoardId) : undefined} 
              onValueChange={(v) => {
                setTempBoardId(Number(v));
                setTempStandardId(null);
              }}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Loading..." : "Select Board (e.g. CBSE)"} />
              </SelectTrigger>
              <SelectContent>
                {boards.map(b => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-semibold">2. Select your Grade/Class</label>
            <Select 
              value={tempStandardId ? String(tempStandardId) : undefined} 
              onValueChange={(v) => setTempStandardId(Number(v))}
              disabled={!tempBoardId || isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Grade (e.g. 12th)" />
              </SelectTrigger>
              <SelectContent>
                {standards.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={!tempBoardId || !tempStandardId}>
            Start Learning
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
