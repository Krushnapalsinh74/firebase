import React, { useState } from 'react';
import {
  useListAiProviders,
  useCreateAiProvider,
  useDeleteAiProvider,
  useTestAiProvider,
  getListAiProvidersQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Cpu, Plus, Trash2, ShieldCheck, KeyRound, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';

const PROVIDER_MODELS: Record<string, string[]> = {
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
    'o1',
    'o1-mini',
    'o3-mini',
  ],
  anthropic: [
    'claude-opus-4-5',
    'claude-sonnet-4-5',
    'claude-3-5-haiku-latest',
    'claude-3-opus-latest',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ],
  gemini: [
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
    'gemini-2.0-flash-lite',
    'gemini-1.5-pro',
    'gemini-1.5-pro-002',
    'gemini-1.5-flash',
    'gemini-1.5-flash-002',
    'gemini-3.5-flash',
    'gemini-pro',
  ],
  groq: [
    'llama-3.3-70b-versatile',
    'llama-3.1-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
  ],
  azure_openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-35-turbo',
  ],
  github_models: [
    'gpt-4o',
    'gpt-4o-mini',
    'Meta-Llama-3.1-70B-Instruct',
    'Mistral-Large-2411',
    'Phi-4',
  ],
};

const providerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  providerType: z.enum(['openai', 'anthropic', 'azure_openai', 'gemini', 'groq', 'github_models']),
  accessToken: z.string().min(1, "Access token is required"),
  defaultModel: z.string().min(1, "Default model is required"),
  availableModels: z.array(z.string()).min(1, "Select at least one model"),
  isActive: z.boolean().default(true)
});

type ProviderFormValues = z.infer<typeof providerSchema>;

export default function ProvidersPage() {
  const { data: providers, isLoading } = useListAiProviders();
  const deleteProvider = useDeleteAiProvider();
  const testProvider = useTestAiProvider();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [testingId, setTestingId] = useState<number | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleDelete = (id: number) => {
    if (confirm("Remove this provider?")) {
      deleteProvider.mutate({ id }, {
        onSuccess: () => {
          toast({ title: 'Provider removed' });
          queryClient.invalidateQueries({ queryKey: getListAiProvidersQueryKey() });
        }
      });
    }
  };

  const handleTest = (id: number) => {
    setTestingId(id);
    testProvider.mutate({ id }, {
      onSuccess: (res) => {
        if (res.success) {
          toast({
            title: "Connection Successful",
            description: `Latency: ${res.latencyMs}ms`,
            className: "bg-green-500/10 border-green-500/20"
          });
        } else {
          toast({
            variant: "destructive",
            title: "Connection Failed",
            description: res.message
          });
        }
        setTestingId(null);
      },
      onError: () => {
        toast({ variant: "destructive", title: "Test Error", description: "Network or server error." });
        setTestingId(null);
      }
    });
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Providers</h1>
          <p className="text-muted-foreground">Configure LLM endpoints and manage API keys.</p>
        </div>

        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Provider</Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Add AI Provider</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <ProviderForm onSuccess={() => setIsSheetOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {providers?.map((provider) => (
          <Card key={provider.id} className={`flex flex-col ${!provider.isActive && 'opacity-60'}`}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="bg-primary/10 p-2 rounded-md">
                    <Cpu className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{provider.name}</CardTitle>
                    <CardDescription>{provider.providerType}</CardDescription>
                  </div>
                </div>
                <Badge variant={provider.isActive ? "default" : "secondary"}>
                  {provider.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Default Model</span>
                  <span className="font-mono text-xs">{provider.defaultModel}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Available Models</span>
                  <div className="flex flex-wrap gap-1">
                    {provider.availableModels?.map((m) => (
                      <Badge key={m} variant="secondary" className="text-xs font-mono">{m}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-muted-foreground flex items-center gap-1"><KeyRound className="h-3 w-3" /> API Key</span>
                  <span className="text-muted-foreground">••••••••••••</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t bg-muted/20 p-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTest(provider.id)}
                disabled={testingId === provider.id}
              >
                {testingId === provider.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Test Connection
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(provider.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        ))}
        {(!providers || providers.length === 0) && !isLoading && (
          <Card className="col-span-full p-12 flex flex-col items-center justify-center text-center border-dashed">
            <Cpu className="h-8 w-8 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No providers configured</h3>
            <p className="text-muted-foreground mb-4 max-w-sm">Add your first AI provider to start generating questions.</p>
            <Button onClick={() => setIsSheetOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Provider</Button>
          </Card>
        )}
      </div>
    </div>
  );
}

function ProviderForm({ onSuccess }: { onSuccess: () => void }) {
  const createProvider = useCreateAiProvider();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(providerSchema),
    defaultValues: {
      name: '',
      providerType: 'openai',
      accessToken: '',
      defaultModel: '',
      availableModels: [],
      isActive: true,
    }
  });

  const providerType = form.watch('providerType');
  const availableModels = form.watch('availableModels');
  const modelOptions = PROVIDER_MODELS[providerType] ?? [];

  const toggleModel = (model: string) => {
    const current = form.getValues('availableModels');
    const next = current.includes(model)
      ? current.filter((m) => m !== model)
      : [...current, model];
    form.setValue('availableModels', next, { shouldValidate: true });
    // Clear default model if it was removed
    if (!next.includes(form.getValues('defaultModel'))) {
      form.setValue('defaultModel', '', { shouldValidate: true });
    }
  };

  const selectAll = () => {
    form.setValue('availableModels', [...modelOptions], { shouldValidate: true });
  };

  const onSubmit = (data: ProviderFormValues) => {
    createProvider.mutate({ data: data as any }, {
      onSuccess: () => {
        toast({ title: "Provider created" });
        queryClient.invalidateQueries({ queryKey: getListAiProvidersQueryKey() });
        onSuccess();
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Error", description: err.message });
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display Name</FormLabel>
              <FormControl><Input placeholder="e.g. OpenAI Primary" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="providerType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Provider Type</FormLabel>
              <Select
                onValueChange={(val) => {
                  field.onChange(val);
                  form.setValue('availableModels', []);
                  form.setValue('defaultModel', '');
                }}
                value={field.value}
              >
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="azure_openai">Azure OpenAI</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                  <SelectItem value="groq">Groq</SelectItem>
                  <SelectItem value="github_models">GitHub Models</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="accessToken"
          render={({ field }) => (
            <FormItem>
              <FormLabel>API Key / Token</FormLabel>
              <FormControl><Input type="password" placeholder="sk-..." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="availableModels"
          render={() => (
            <FormItem>
              <div className="flex items-center justify-between mb-2">
                <FormLabel>Available Models</FormLabel>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={selectAll}
                >
                  Select all
                </button>
              </div>
              <div className="rounded-md border p-3 space-y-2 max-h-52 overflow-y-auto">
                {modelOptions.map((model) => (
                  <div key={model} className="flex items-center gap-2">
                    <Checkbox
                      id={`model-${model}`}
                      checked={availableModels.includes(model)}
                      onCheckedChange={() => toggleModel(model)}
                    />
                    <Label htmlFor={`model-${model}`} className="font-mono text-sm cursor-pointer">
                      {model}
                    </Label>
                  </div>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="defaultModel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Default Model</FormLabel>
              <Select
                disabled={availableModels.length === 0}
                onValueChange={field.onChange}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={availableModels.length === 0 ? "Select models above first" : "Pick default"} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {availableModels.map((m) => (
                    <SelectItem key={m} value={m} className="font-mono text-sm">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Active Status</FormLabel>
                <div className="text-sm text-muted-foreground">Enable this provider for use.</div>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={createProvider.isPending}>
          {createProvider.isPending ? "Saving..." : "Save Provider"}
        </Button>
      </form>
    </Form>
  );
}
