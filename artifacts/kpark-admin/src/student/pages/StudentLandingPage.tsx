import React from 'react';
import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { GraduationCap, BookOpen, Award, BarChart3, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudentStore } from '@/hooks/use-student-store';

export default function StudentLandingPage() {
  const { student, token } = useStudentStore();
  const [, setLocation] = useLocation();

  const handleGetStarted = () => {
    if (student && token) {
      setLocation('/dashboard');
    } else {
      setLocation('/login');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-500/30">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl w-full mx-auto border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight block leading-tight text-slate-900">Knowledge Park</span>
            <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Student Portal</span>
          </div>
        </div>
        <div>
          {student && token ? (
            <Button onClick={handleGetStarted} className="bg-slate-900 text-white hover:bg-slate-800 font-bold px-6 rounded-full shadow-md transition-all">
              Go to Dashboard
            </Button>
          ) : (
            <Button onClick={handleGetStarted} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 rounded-full shadow-lg shadow-blue-500/20 transition-all">
              Sign In
            </Button>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col">
        <section className="relative px-6 py-24 md:py-32 flex flex-col items-center justify-center text-center overflow-hidden">
          {/* Background Glows */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-100 rounded-full blur-[120px] -z-10 pointer-events-none" />
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-100 rounded-full blur-[100px] -z-10 pointer-events-none" />

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-sm font-semibold mb-8 shadow-sm"
          >
            <Sparkles className="h-4 w-4" /> The all-new learning experience
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 max-w-4xl mb-6"
          >
            Master Your Studies with AI-Powered Practice
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-slate-600 max-w-2xl mb-10"
          >
            Access your complete curriculum, take real-time mock exams, and track your performance effortlessly. All in one beautiful dashboard.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-4"
          >
            <Button 
              onClick={handleGetStarted}
              size="lg"
              className="h-14 px-8 text-lg font-bold rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-500/20 group"
            >
              Start Learning Now
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>
        </section>

        {/* Features Section */}
        <section className="px-6 py-24 bg-white border-t border-slate-200 relative z-10">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">Everything you need to succeed</h2>
              <p className="text-slate-600 max-w-2xl mx-auto">We have completely re-imagined the student experience to focus on what matters most: learning effectively.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: BookOpen,
                  title: 'Structured Curriculum',
                  description: 'Browse your subjects, chapters, and topics in an intuitive, beautifully organized format.',
                  color: 'text-blue-600',
                  bg: 'bg-blue-50'
                },
                {
                  icon: Award,
                  title: 'Mock Exams Simulator',
                  description: 'Take timed tests that mimic the real exam environment to build your confidence.',
                  color: 'text-purple-600',
                  bg: 'bg-purple-50'
                },
                {
                  icon: BarChart3,
                  title: 'Performance Analytics',
                  description: 'Track your accuracy, streak, and progress over time to identify areas for improvement.',
                  color: 'text-emerald-600',
                  bg: 'bg-emerald-50'
                }
              ].map((feature, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.2 }}
                  className="p-8 rounded-3xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors shadow-sm"
                >
                  <div className={`h-12 w-12 rounded-2xl ${feature.bg} flex items-center justify-center mb-6`}>
                    <feature.icon className={`h-6 w-6 ${feature.color}`} />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-slate-900">{feature.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-slate-500 border-t border-slate-200 text-sm bg-white">
        <p>© {new Date().getFullYear()} Knowledge Park. All rights reserved.</p>
      </footer>
    </div>
  );
}
