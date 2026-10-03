import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useLogin } from '@workspace/api-client-react';
import { useAuthStore } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { signInWithPopup, signInWithRedirect, getRedirectResult } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

const registerSchema = z.object({
  name: z.string().min(2, { message: "Name is required" }),
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const setToken = useAuthStore((s) => s.setToken);
  const setUser = useAuthStore((s) => s.setUser);
  const { toast } = useToast();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  
  const loginMutation = useLogin();

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  // Handle Google Auth Return
  React.useEffect(() => {
    if (!auth) return;
    const checkRedirect = async () => {
      try {
        setGoogleLoading(true);
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          await completeGoogleLogin(result.user.email || "", result.user.displayName || "Student", result.user.photoURL);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setGoogleLoading(false);
      }
    };
    checkRedirect();
  }, []);

  const completeGoogleLogin = async (email: string, name: string, photoUrl: string | null = null) => {
    try {
      const res = await fetch("/api/student/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, photoUrl })
      });
      if (!res.ok) throw new Error("Google login failed");
      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
      setLocation('/dashboard');
      toast({ title: "Welcome!", description: "Successfully signed in with Google." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      if (auth) {
        try {
          const result = await signInWithPopup(auth, googleProvider);
          await completeGoogleLogin(result.user.email || "", result.user.displayName || "Student", result.user.photoURL);
        } catch (popupError: any) {
          await signInWithRedirect(auth, googleProvider);
        }
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Google Auth Failed", description: e.message });
      setGoogleLoading(false);
    }
  };

  const onLoginSubmit = (data: LoginFormValues) => {
    loginMutation.mutate({ data }, {
      onSuccess: (res) => {
        setToken(res.token);
        setUser(res.user);
        setLocation('/dashboard');
        toast({ title: "Welcome back", description: "You have successfully logged in." });
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Login failed", description: err?.message || "Invalid credentials." });
      }
    });
  };

  const onRegisterSubmit = async (data: RegisterFormValues) => {
    setRegisterLoading(true);
    try {
      // Assuming planId 1 is the default free plan
      const res = await fetch("/api/students/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, planId: 1 })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Registration failed");
      
      setToken(resData.token);
      setUser(resData.user);
      setLocation('/dashboard');
      toast({ title: "Account created!", description: "Welcome to Knowledge Park." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Registration failed", description: err.message });
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-background">
      {/* Visual Side */}
      <div className="hidden md:flex flex-1 flex-col justify-between bg-zinc-950 p-12 text-zinc-50 relative overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary rounded-full blur-[128px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600 rounded-full blur-[128px]" />
        </div>
        
        <div className="relative z-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground mb-4">
            <span className="font-bold text-xl">K</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Knowledge Park</h1>
        </div>
        
        <div className="relative z-10 max-w-lg">
          <h2 className="text-4xl font-bold tracking-tight mb-4 leading-tight">
            The intelligent engine for educational assessment.
          </h2>
          <p className="text-zinc-400 text-lg">
            Join the platform to access mock exams, practice materials, or manage curriculum.
          </p>
        </div>
        
        <div className="relative z-10 text-sm text-zinc-500">
          &copy; {new Date().getFullYear()} Knowledge Park Education
        </div>
      </div>

      {/* Form Side */}
      <div className="flex-1 flex items-center justify-center p-8 md:p-12 lg:p-24 relative bg-card">
        <div className="w-full max-w-md flex flex-col justify-center space-y-8">
          <div className="md:hidden flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground mb-4 mx-auto">
            <span className="font-bold text-xl">K</span>
          </div>
          
          <div className="text-center md:text-left space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Welcome</h2>
            <p className="text-muted-foreground">
              Sign in or create an account to continue.
            </p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="register">Create Account</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="space-y-6">
              <button
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-md bg-white border border-slate-300 text-slate-900 font-medium text-sm hover:bg-slate-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
              >
                {googleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                ) : (
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                <span>Continue with Google</span>
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="name@example.com" type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input placeholder="••••••••" type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full h-11" disabled={loginMutation.isPending}>
                    {loginMutation.isPending ? "Signing in..." : "Sign in"}
                  </Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="register" className="space-y-6">
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                  <FormField
                    control={registerForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="name@example.com" type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input placeholder="••••••••" type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full h-11" disabled={registerLoading}>
                    {registerLoading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>

        </div>
      </div>
    </div>
  );
}
