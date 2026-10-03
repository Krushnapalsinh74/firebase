import React, { useState } from "react";
import { GraduationCap, Loader2, ShieldCheck, Mail, ArrowRight } from "lucide-react";
import { signInWithPopup, signInWithRedirect, getRedirectResult } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { studentApi } from "../api/studentApi";
import { useStudentStore } from "@/hooks/use-student-store";

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const { setToken, setStudent } = useStudentStore();

  React.useEffect(() => {
    if (!auth) return;
    // Check if we just came back from a Google Redirect
    const checkRedirect = async () => {
      try {
        setLoading(true);
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          const fbUser = result.user;
          const email = fbUser.email || "";
          const name = fbUser.displayName || email.split("@")[0];
          const photoUrl = fbUser.photoURL || null;
          if (email) {
            await completeLogin(email, name, photoUrl);
          }
        }
      } catch (e: any) {
        console.error("Redirect auth error:", e);
        setError("Sign-in failed. Please try again.");
        setShowEmailForm(true);
      } finally {
        setLoading(false);
      }
    };
    checkRedirect();
  }, []);

  const completeLogin = async (email: string, name: string, photoUrl: string | null = null) => {
    const res = await studentApi.loginGoogle({ email, name, photoUrl });
    setToken(res.token);
    setStudent({
      id: res.user.id,
      email: res.user.email,
      name: res.user.name,
      photoUrl: res.user.photoUrl,
      role: "student",
      boardId: res.user.boardId,
      standardId: res.user.standardId,
    });
    onLoginSuccess();
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      if (auth) {
        // Try popup first
        try {
          const result = await signInWithPopup(auth, googleProvider);
          const fbUser = result.user;
          const email = fbUser.email || "";
          const name = fbUser.displayName || email.split("@")[0];
          const photoUrl = fbUser.photoURL || null;
          
          if (!email) throw new Error("Could not retrieve email.");
          await completeLogin(email, name, photoUrl);
        } catch (popupError: any) {
          console.warn("Popup failed, falling back to redirect:", popupError);
          // If popup is blocked or fails, automatically fallback to redirect
          await signInWithRedirect(auth, googleProvider);
        }
      } else {
        setShowEmailForm(true);
        setLoading(false);
      }
    } catch (e: any) {
      console.error("Google Auth error:", e);
      setShowEmailForm(true);
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) {
      setError("Please enter a valid email address");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const email = emailInput.trim();
      const name = nameInput.trim() || email.split("@")[0];
      await completeLogin(email, name, null);
    } catch (e: any) {
      setError(e.message ?? "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/20 mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Knowledge Park</h1>
          <p className="text-slate-600 text-xs mt-1">NEET Preparation & Examination Portal</p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-xl space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-base font-bold text-slate-900">Student Sign In</h2>
            <p className="text-slate-600 text-xs">Sign in with your Google account to access practice & mock exams.</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-xs text-center font-medium">
              {error}
            </div>
          )}

          {/* Primary Google Auth Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl bg-white border border-slate-300 text-slate-900 font-bold text-sm hover:bg-slate-50 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
            ) : (
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            <span>{loading ? "Authenticating..." : "Continue with Google"}</span>
          </button>

          {/* Secondary Email Form Option if popup is skipped or manually requested */}
          {showEmailForm ? (
            <form onSubmit={handleEmailSubmit} className="space-y-3 pt-2 border-t border-slate-200">
              <div className="text-xs text-slate-600 font-medium">Or enter your email below:</div>
              <div>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Your Name (optional)"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setShowEmailForm(true)}
                className="text-xs text-slate-600 hover:text-slate-900 underline transition-colors"
              >
                Sign in with Email instead
              </button>
            </div>
          )}

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Secure SSL Encrypted Sign-in</span>
          </div>
        </div>

        <p className="text-center text-slate-500 text-[11px] mt-6">
          Knowledge Park Educational Services © 2025
        </p>
      </div>
    </div>
  );
}
