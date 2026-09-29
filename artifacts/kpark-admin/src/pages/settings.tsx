import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw, KeyRound, UserCheck, ShieldCheck } from 'lucide-react';
import { customFetch } from '@workspace/api-client-react';

interface PaymentSettingsData {
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  webhookSecret?: string;
  testAccountEmail?: string;
  testAccountPassword?: string;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [testAccountEmail, setTestAccountEmail] = useState('');
  const [testAccountPassword, setTestAccountPassword] = useState('');

  const [showKeySecret, setShowKeySecret] = useState(false);
  const [showTestPassword, setShowTestPassword] = useState(false);
  const [testConnectionStatus, setTestConnectionStatus] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['paymentSettings'],
    queryFn: async () => {
      const res = await customFetch('/settings/payment', { method: 'GET' });
      return res as PaymentSettingsData;
    },
  });

  useEffect(() => {
    if (data) {
      setKeyId(data.razorpayKeyId || '');
      setKeySecret(data.razorpayKeySecret || '');
      setWebhookSecret(data.webhookSecret || '');
      setTestAccountEmail(data.testAccountEmail || '');
      setTestAccountPassword(data.testAccountPassword || '');
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: async (payload: PaymentSettingsData) => {
      const res = await customFetch('/settings/payment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res as PaymentSettingsData;
    },
    onSuccess: (updatedData) => {
      toast({ title: 'Settings saved successfully' });
      queryClient.setQueryData(['paymentSettings'], updatedData);
      setKeyId(updatedData.razorpayKeyId || '');
      setKeySecret(updatedData.razorpayKeySecret || '');
      setWebhookSecret(updatedData.webhookSecret || '');
      setTestAccountEmail(updatedData.testAccountEmail || '');
      setTestAccountPassword(updatedData.testAccountPassword || '');
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to save settings',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleTestConnection = async () => {
    setTestConnectionStatus({ status: 'testing', message: 'Testing connection to Razorpay...' });
    try {
      const res: any = await customFetch('/payments/test-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpayKeyId: keyId,
          razorpayKeySecret: keySecret,
        }),
      });

      if (res.success) {
        setTestConnectionStatus({
          status: 'success',
          message: res.message || 'Razorpay keys are valid and connected!',
        });
        toast({ title: 'Razorpay Verified', description: res.message });
      } else {
        setTestConnectionStatus({
          status: 'error',
          message: res.message || 'Verification failed. Please check keys.',
        });
        toast({ title: 'Connection Failed', description: res.message, variant: 'destructive' });
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to connect to Razorpay. Check credentials.';
      setTestConnectionStatus({ status: 'error', message: msg });
      toast({ title: 'Connection Error', description: msg, variant: 'destructive' });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      razorpayKeyId: keyId,
      razorpayKeySecret: keySecret,
      webhookSecret: webhookSecret,
      testAccountEmail: testAccountEmail,
      testAccountPassword: testAccountPassword,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full pt-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl pb-16">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings & Integrations</h1>
        <p className="text-muted-foreground mt-1">
          Configure payment gateway, test credentials, and application credentials.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Razorpay Gateway Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Razorpay Payment Gateway</CardTitle>
                  <CardDescription>
                    Configure your Razorpay API keys to process student and subscription payments.
                  </CardDescription>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${keyId ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800' : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'}`}>
                {keyId ? 'Configured' : 'Not Configured'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="razorpayKeyId">Key ID</Label>
              <Input
                id="razorpayKeyId"
                placeholder="rzp_test_..."
                value={keyId}
                onChange={(e) => setKeyId(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="razorpayKeySecret">Key Secret</Label>
              <div className="relative">
                <Input
                  id="razorpayKeySecret"
                  type={showKeySecret ? 'text' : 'password'}
                  placeholder="Enter secret to update"
                  value={keySecret}
                  onChange={(e) => setKeySecret(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKeySecret(!showKeySecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKeySecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave as is if you do not want to change the existing secret.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhookSecret">Webhook Secret (Optional)</Label>
              <Input
                id="webhookSecret"
                type="password"
                placeholder="Enter webhook secret from Razorpay Dashboard"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
              />
            </div>

            {/* Test Connection feedback */}
            {testConnectionStatus.status !== 'idle' && (
              <div
                className={`p-3.5 rounded-lg border text-sm flex items-start gap-2.5 ${
                  testConnectionStatus.status === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
                    : testConnectionStatus.status === 'error'
                    ? 'bg-destructive/10 text-destructive border-destructive/20'
                    : 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300'
                }`}
              >
                {testConnectionStatus.status === 'success' && <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />}
                {testConnectionStatus.status === 'error' && <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                {testConnectionStatus.status === 'testing' && <Loader2 className="h-4 w-4 mt-0.5 animate-spin shrink-0" />}
                <span>{testConnectionStatus.message}</span>
              </div>
            )}

            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={!keyId || testConnectionStatus.status === 'testing'}
                className="gap-2"
              >
                {testConnectionStatus.status === 'testing' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Test Razorpay Connection
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Test Account Credentials Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Test Account Credentials</CardTitle>
                <CardDescription>
                  Set up dedicated test credentials for automated testing and quick demonstration access.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="testAccountEmail">Add test account username/email</Label>
              <Input
                id="testAccountEmail"
                placeholder="test@admin.com"
                value={testAccountEmail}
                onChange={(e) => setTestAccountEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="testAccountPassword">Add test account password</Label>
              <div className="relative">
                <Input
                  id="testAccountPassword"
                  type={showTestPassword ? 'text' : 'password'}
                  placeholder="test123"
                  value={testAccountPassword}
                  onChange={(e) => setTestAccountPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowTestPassword(!showTestPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showTestPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-3 border-t pt-4">
            <Button type="submit" disabled={updateMutation.isPending} className="gap-2">
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Save Settings
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
