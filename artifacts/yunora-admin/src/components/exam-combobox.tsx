import * as React from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface ExamOption {
  id?: number;       // set when it already exists in DB
  name: string;
  code: string;
  description?: string;
}

// All major Indian competitive / board exams pre-populated
export const INDIA_EXAMS: Omit<ExamOption, 'id'>[] = [
  { name: 'JEE Main', code: 'JEE-MAIN', description: 'Joint Entrance Examination – Main (NTA)' },
  { name: 'JEE Advanced', code: 'JEE-ADV', description: 'Joint Entrance Examination – Advanced (IITs)' },
  { name: 'NEET UG', code: 'NEET-UG', description: 'National Eligibility cum Entrance Test – Undergraduate' },
  { name: 'NEET PG', code: 'NEET-PG', description: 'National Eligibility cum Entrance Test – Postgraduate' },
  { name: 'CUET UG', code: 'CUET-UG', description: 'Common University Entrance Test – Undergraduate (NTA)' },
  { name: 'CUET PG', code: 'CUET-PG', description: 'Common University Entrance Test – Postgraduate (NTA)' },
  { name: 'GATE', code: 'GATE', description: 'Graduate Aptitude Test in Engineering' },
  { name: 'CAT', code: 'CAT', description: 'Common Admission Test (IIMs)' },
  { name: 'UPSC CSE', code: 'UPSC-CSE', description: 'Civil Services Examination (UPSC)' },
  { name: 'UPSC CDS', code: 'UPSC-CDS', description: 'Combined Defence Services Examination' },
  { name: 'NDA', code: 'NDA', description: 'National Defence Academy Examination' },
  { name: 'CLAT', code: 'CLAT', description: 'Common Law Admission Test' },
  { name: 'AILET', code: 'AILET', description: 'All India Law Entrance Test (NLU Delhi)' },
  { name: 'BITSAT', code: 'BITSAT', description: 'BITS Admission Test' },
  { name: 'VITEEE', code: 'VITEEE', description: 'VIT Engineering Entrance Examination' },
  { name: 'MHT-CET', code: 'MHT-CET', description: 'Maharashtra Common Entrance Test' },
  { name: 'KCET', code: 'KCET', description: 'Karnataka Common Entrance Test' },
  { name: 'WBJEE', code: 'WBJEE', description: 'West Bengal Joint Entrance Examination' },
  { name: 'COMEDK', code: 'COMEDK', description: 'Consortium of Medical, Engineering and Dental Colleges of Karnataka' },
  { name: 'EAMCET', code: 'EAMCET', description: 'Engineering, Agriculture & Medical Common Entrance Test (AP/TS)' },
  { name: 'KEAM', code: 'KEAM', description: 'Kerala Engineering Architecture Medical Entrance' },
  { name: 'GUJCET', code: 'GUJCET', description: 'Gujarat Common Entrance Test' },
  { name: 'CBSE Board', code: 'CBSE', description: 'Central Board of Secondary Education' },
  { name: 'ICSE Board', code: 'ICSE', description: 'Indian Certificate of Secondary Education' },
  { name: 'SSC CGL', code: 'SSC-CGL', description: 'Staff Selection Commission – Combined Graduate Level' },
  { name: 'SSC CHSL', code: 'SSC-CHSL', description: 'Staff Selection Commission – Combined Higher Secondary Level' },
  { name: 'IBPS PO', code: 'IBPS-PO', description: 'Institute of Banking Personnel Selection – Probationary Officer' },
  { name: 'IBPS Clerk', code: 'IBPS-CLK', description: 'Institute of Banking Personnel Selection – Clerk' },
  { name: 'SBI PO', code: 'SBI-PO', description: 'State Bank of India – Probationary Officer' },
  { name: 'RRB NTPC', code: 'RRB-NTPC', description: 'Railway Recruitment Board – Non-Technical Popular Categories' },
];

interface ExamComboboxProps {
  /** Boards already in the database */
  existingBoards: ExamOption[];
  /** Called when the user picks a pre-populated exam that is not yet in DB */
  onCreateFromPreset: (preset: Omit<ExamOption, 'id'>) => void;
  /** Called when user types a custom name that doesn't match any preset/existing */
  onCreateCustom: (name: string) => void;
  /** Called when user selects a board that already exists */
  onSelectExisting: (board: ExamOption) => void;
  disabled?: boolean;
}

export function ExamCombobox({
  existingBoards,
  onCreateFromPreset,
  onCreateCustom,
  onSelectExisting,
  disabled,
}: ExamComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const existingCodes = new Set(existingBoards.map((b) => b.code.toUpperCase()));

  // Presets not yet created
  const availablePresets = INDIA_EXAMS.filter(
    (e) => !existingCodes.has(e.code.toUpperCase()),
  );

  const q = search.toLowerCase();

  const filteredExisting = existingBoards.filter(
    (b) =>
      b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q),
  );

  const filteredPresets = availablePresets.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      e.code.toLowerCase().includes(q) ||
      (e.description ?? '').toLowerCase().includes(q),
  );

  // Show "Create" option only when search doesn't exactly match anything
  const exactMatch =
    [...existingBoards, ...INDIA_EXAMS].some(
      (e) => e.name.toLowerCase() === q || e.code.toLowerCase() === q,
    );
  const showCreate = search.trim().length > 0 && !exactMatch;

  const handleSelect = (item: ExamOption | Omit<ExamOption, 'id'>, isExisting: boolean) => {
    setOpen(false);
    setSearch('');
    if (isExisting) {
      onSelectExisting(item as ExamOption);
    } else {
      onCreateFromPreset(item as Omit<ExamOption, 'id'>);
    }
  };

  const handleCreate = () => {
    setOpen(false);
    onCreateCustom(search.trim());
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-muted-foreground font-normal"
          disabled={disabled}
        >
          <span>Search or add an exam type…</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[420px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search exams (JEE, NEET, GATE…)"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {/* Existing boards */}
            {filteredExisting.length > 0 && (
              <CommandGroup heading="Your Exam Boards">
                {filteredExisting.map((board) => (
                  <CommandItem
                    key={`existing-${board.id}`}
                    value={board.name}
                    onSelect={() => handleSelect(board, true)}
                    className="flex items-start gap-2"
                  >
                    <Check className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium">{board.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{board.code}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {filteredExisting.length > 0 && filteredPresets.length > 0 && (
              <CommandSeparator />
            )}

            {/* Pre-populated presets not yet added */}
            {filteredPresets.length > 0 && (
              <CommandGroup heading="Common Indian Exams">
                {filteredPresets.map((exam) => (
                  <CommandItem
                    key={`preset-${exam.code}`}
                    value={exam.name}
                    onSelect={() => handleSelect(exam, false)}
                    className="flex items-start gap-2"
                  >
                    <Plus className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium">{exam.name}</span>
                      <span className="text-xs text-muted-foreground truncate">{exam.description}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {filteredExisting.length === 0 && filteredPresets.length === 0 && !showCreate && (
              <CommandEmpty>No exam found.</CommandEmpty>
            )}

            {/* Create custom option */}
            {showCreate && (
              <>
                {(filteredExisting.length > 0 || filteredPresets.length > 0) && (
                  <CommandSeparator />
                )}
                <CommandGroup>
                  <CommandItem
                    value={`__create__${search}`}
                    onSelect={handleCreate}
                    className="flex items-center gap-2 text-primary"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span>
                      Create <span className="font-semibold">"{search.trim()}"</span> as new exam
                    </span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
