import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  Globe, 
  ExternalLink, 
  Sparkles, 
  CheckCircle2, 
  RefreshCw, 
  Image as ImageIcon, 
  Copy, 
  Terminal, 
  ShieldCheck,
  Bot,
  Zap,
  Check,
  Cpu
} from 'lucide-react';
import { useListAiProviders } from '@workspace/api-client-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BrowserStatus {
  status: 'running' | 'idle';
  cdpPort: number;
  hasExecutable: boolean;
  executablePath: string | null;
  profileDirectory: string;
  openTabs: Array<{ id: string; title: string; url: string }>;
  geminiTab: { id: string; title: string; url: string } | null;
  chatgptTab: { id: string; title: string; url: string } | null;
}

export default function BrowserSessionsPage() {
  const { toast } = useToast();
  const { data: providersData } = useListAiProviders();
  const providers = providersData?.data || [];
  const [status, setStatus] = useState<BrowserStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLaunching, setIsLaunching] = useState<string | null>(null);

  // Image generator playground state
  const [selectedProviderId, setSelectedProviderId] = useState<string>('free');
  const [generatedEngine, setGeneratedEngine] = useState<string>('');
  const [imagePrompt, setImagePrompt] = useState('Physics diagram showing two force vectors u and v acting on a particle with an angle of 120 degrees, Cartesian coordinate axes');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/browser/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // Backend status poll failure handled gracefully
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleLaunch = async (target: 'gemini' | 'chatgpt') => {
    setIsLaunching(target);
    try {
      const res = await fetch('/api/browser/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: 'Browser Launched!',
          description: data.message,
        });
        await fetchStatus();
      } else {
        toast({
          variant: 'destructive',
          title: 'Launch Notice',
          description: data.error || 'Server browser executable not found. Use the direct web tab below to log in.',
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Launch Failed',
        description: err.message,
      });
    } finally {
      setIsLaunching(null);
    }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    setIsGeneratingImage(true);
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt,
          providerId: selectedProviderId === 'free' ? undefined : selectedProviderId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setGeneratedImageUrl(data.url);
        setGeneratedEngine(data.engine || '');
        toast({ 
          title: 'Image Generated Successfully!',
          description: `Engine: ${data.engine || 'AI Engine'}`
        });
      } else {
        toast({ variant: 'destructive', title: 'Generation Failed', description: data.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const copyDiagramTag = () => {
    if (!generatedImageUrl) return;
    const tag = `<diagram type="image" url="${generatedImageUrl}"></diagram>`;
    navigator.clipboard.writeText(tag);
    setCopied(true);
    toast({ title: 'Copied Diagram Tag to Clipboard!' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <Globe className="h-8 w-8 text-primary" />
            AI Browser & Image Hub
          </h1>
          <p className="text-muted-foreground mt-1">
            Log in to your Google and OpenAI accounts to empower the question generator with free web models and AI image generation.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStatus} disabled={isLoading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Status
        </Button>
      </div>

      {/* Persistent Profile Status Bar */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Profile Storage</span>
              <div className="flex items-center gap-2 font-mono text-xs bg-background/80 px-2.5 py-1.5 rounded border">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="truncate">{status?.profileDirectory || '~/.yunora_browser_profile'}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Browser Engine</span>
              <div className="flex items-center gap-2 text-sm bg-background/80 px-2.5 py-1.5 rounded border">
                {status?.status === 'running' ? (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-medium text-emerald-700">Active on Port {status.cdpPort}</span>
                  </>
                ) : (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50" />
                    <span className="text-muted-foreground">Standby / Ready</span>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Capabilities</span>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-800">
                  <Zap className="h-3 w-3 mr-1" />
                  Unlimited Qs
                </Badge>
                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                  <ImageIcon className="h-3 w-3 mr-1" />
                  AI Images
                </Badge>
                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800">
                  <Sparkles className="h-3 w-3 mr-1" />
                  No API Cost
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Login Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gemini Card */}
        <Card className="border-2 border-border hover:border-blue-300 transition-colors">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-lg">
                G
              </div>
              <Badge variant={status?.geminiTab ? 'default' : 'outline'} className={status?.geminiTab ? 'bg-blue-600' : ''}>
                {status?.geminiTab ? 'Tab Active' : 'Login Required'}
              </Badge>
            </div>
            <CardTitle className="text-xl mt-3">Google Gemini Web</CardTitle>
            <CardDescription>
              Connect your Google account to access Gemini 2.0 Flash and generate complex diagrams using Imagen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-muted-foreground space-y-1.5 bg-muted/30 p-3 rounded-md border">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span>One-time Google login</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span>Cookies automatically persist across restarts</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span>Used automatically when generating with &quot;Gemini Web&quot;</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700" 
              onClick={() => handleLaunch('gemini')}
              disabled={isLaunching === 'gemini'}
            >
              <Terminal className="h-4 w-4 mr-2" />
              {isLaunching === 'gemini' ? 'Opening...' : 'Launch Gemini in Profile'}
            </Button>
            <a 
              href="https://gemini.google.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="w-full sm:w-auto"
            >
              <Button variant="outline" className="w-full">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Web
              </Button>
            </a>
          </CardFooter>
        </Card>

        {/* ChatGPT Card */}
        <Card className="border-2 border-border hover:border-emerald-300 transition-colors">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-lg">
                C
              </div>
              <Badge variant={status?.chatgptTab ? 'default' : 'outline'} className={status?.chatgptTab ? 'bg-emerald-600' : ''}>
                {status?.chatgptTab ? 'Tab Active' : 'Login Required'}
              </Badge>
            </div>
            <CardTitle className="text-xl mt-3">OpenAI ChatGPT Web</CardTitle>
            <CardDescription>
              Connect your OpenAI account for GPT-4o reasoning and DALL-E 3 educational figure generation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-muted-foreground space-y-1.5 bg-muted/30 p-3 rounded-md border">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>One-time OpenAI login</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Cookies automatically persist across restarts</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Used automatically when generating with &quot;ChatGPT Web&quot;</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <Button 
              className="w-full bg-emerald-600 hover:bg-emerald-700" 
              onClick={() => handleLaunch('chatgpt')}
              disabled={isLaunching === 'chatgpt'}
            >
              <Terminal className="h-4 w-4 mr-2" />
              {isLaunching === 'chatgpt' ? 'Opening...' : 'Launch ChatGPT in Profile'}
            </Button>
            <a 
              href="https://chatgpt.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="w-full sm:w-auto"
            >
              <Button variant="outline" className="w-full">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Web
              </Button>
            </a>
          </CardFooter>
        </Card>
      </div>

      {/* AI Image Generation Studio */}
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-md bg-primary/10 text-primary">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">AI Educational Image & Diagram Studio</CardTitle>
              <CardDescription>
                Generate high-resolution educational diagrams, physics vectors, science schematics, and geometric figures.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-primary" />
                Choose AI Provider for Images
              </label>
              <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select AI provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">⚡ Fast Free AI Generator (No Key Required)</SelectItem>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} ({p.provider.toUpperCase()} {p.provider === 'openai' ? '— DALL-E 3' : p.provider === 'gemini' ? '— Imagen 3' : ''})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Select your configured OpenAI provider for DALL-E 3, Gemini for Imagen 3, or use the free generator.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Illustration Prompt</label>
            <Textarea
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="Describe the educational diagram or illustration you want the AI to generate..."
              className="min-h-[75px] resize-y text-sm"
            />
          </div>

          <Button 
            onClick={handleGenerateImage} 
            disabled={isGeneratingImage || !imagePrompt.trim()} 
            className="gap-2"
          >
            {isGeneratingImage ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Generating Image with {selectedProviderId === 'free' ? 'Free AI' : 'Provider API'}...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate AI Diagram
              </>
            )}
          </Button>

          {/* Generated Image Preview */}
          {generatedImageUrl && (
            <div className="mt-6 border rounded-xl p-4 bg-muted/20 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Generated Output</span>
                  {generatedEngine && (
                    <Badge variant="secondary" className="text-xs font-normal">
                      {generatedEngine}
                    </Badge>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={copyDiagramTag} className="gap-1.5 h-8 text-xs">
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied Tag' : 'Copy <diagram> Tag'}
                </Button>
              </div>

              <div className="flex justify-center bg-white rounded-lg p-2 border shadow-sm max-h-96 overflow-hidden">
                <img 
                  src={generatedImageUrl} 
                  alt="Generated Diagram" 
                  className="max-h-80 w-auto object-contain rounded-md" 
                />
              </div>

              <div className="text-xs bg-muted/60 p-2.5 rounded font-mono break-all border text-muted-foreground">
                &lt;diagram type=&quot;image&quot; url=&quot;{generatedImageUrl}&quot;&gt;&lt;/diagram&gt;
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
