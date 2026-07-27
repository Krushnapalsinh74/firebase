import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { getPaymentSettings, updatePaymentSettings } from '@workspace/api-client-react';

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [keyId, setKeyId] = React.useState('');
  const [keySecret, setKeySecret] = React.useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['paymentSettings'],
    queryFn: () => getPaymentSettings(),
  });

  useEffect(() => {
    if (data) {
      setKeyId(data.razorpayKeyId || '');
      setKeySecret(data.razorpayKeySecret || '');
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (payload: { razorpayKeyId: string; razorpayKeySecret: string }) => 
      updatePaymentSettings(payload),
    onSuccess: (updatedData) => {
      toast({ title: 'Payment settings saved successfully' });
      queryClient.setQueryData(['paymentSettings'], updatedData);
      setKeyId(updatedData.razorpayKeyId || '');
      setKeySecret(updatedData.razorpayKeySecret || '');
    },
    onError: () => {
      toast({ title: 'Failed to save settings', variant: 'destructive' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      razorpayKeyId: keyId,
      razorpayKeySecret: keySecret,
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
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage application integrations and keys.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Razorpay Integration</CardTitle>
            <CardDescription>
              Configure your Razorpay API keys to process student payments. You can get these from your Razorpay Dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="razorpayKeyId">Key ID</Label>
              <Input 
                id="razorpayKeyId" 
                placeholder="rzp_live_..."
                value={keyId}
                onChange={(e) => setKeyId(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="razorpayKeySecret">Key Secret</Label>
              <Input 
                id="razorpayKeySecret" 
                type="password"
                placeholder="Enter secret to update"
                value={keySecret}
                onChange={(e) => setKeySecret(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave as is if you do not want to update the secret.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Settings
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
