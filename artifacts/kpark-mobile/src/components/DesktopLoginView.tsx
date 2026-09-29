import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { loginEmailApi, loginGoogleApi } from '../api/client';

export function DesktopLoginView() {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleSignIn = async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await loginEmailApi({ email: email.trim(), password });
      setAuth(res.token, res.user);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const demoEmail = email.trim() || 'student.demo@gmail.com';
      const res = await loginGoogleApi({ email: demoEmail, name: demoEmail.split('@')[0] });
      setAuth(res.token, res.user);
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.splitWrapper}>
      {/* ── LEFT HERO PANEL (Image 2) ── */}
      <View style={styles.leftHero}>
        <View style={styles.heroHeader}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoIcon}>🎓</Text>
          </View>
          <View>
            <Text style={styles.heroBrandTitle}>
              Knowledge<Text style={styles.heroBrandAccent}>Park</Text>
            </Text>
            <Text style={styles.heroBrandSub}>Edu</Text>
          </View>
        </View>

        <View style={styles.heroContent}>
          <Text style={styles.heroHeadline}>
            Learn Today,{'\n'}
            <Text style={styles.heroHeadlineHighlight}>Build Tomorrow</Text>
          </Text>
          <Text style={styles.heroSubheadline}>
            Your complete learning companion for exams, practice, and success.
          </Text>

          {/* Feature Pills */}
          <View style={styles.featurePillsRow}>
            <View style={styles.pillItem}>
              <Text style={styles.pillIcon}>📖</Text>
              <View>
                <Text style={styles.pillTitle}>Quality</Text>
                <Text style={styles.pillSub}>Study Materials</Text>
              </View>
            </View>

            <View style={styles.pillItem}>
              <Text style={styles.pillIcon}>🎯</Text>
              <View>
                <Text style={styles.pillTitle}>Smart</Text>
                <Text style={styles.pillSub}>Practice</Text>
              </View>
            </View>

            <View style={styles.pillItem}>
              <Text style={styles.pillIcon}>📄</Text>
              <View>
                <Text style={styles.pillTitle}>Past Papers</Text>
                <Text style={styles.pillSub}>& More</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 3D Graduation & Laptop Artwork Box */}
        <View style={styles.heroArtworkCard}>
          <Text style={styles.artworkEmoji}>🎓 📚 💻 ✨</Text>
        </View>

        <Text style={styles.heroFooterBadge}>Better Learning  •  Brighter Future</Text>
      </View>

      {/* ── RIGHT FORM PANEL (Image 2) ── */}
      <View style={styles.rightForm}>
        {/* Top Language selector */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.langSelector}>
            <Text style={styles.langText}>🌐  English  ▾</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Welcome Back</Text>
          <Text style={styles.formSubTitle}>Sign in to your account to continue</Text>

          {/* Segmented Tab Bar [ Login | Register ] */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabButton, authMode === 'login' && styles.tabButtonActive]}
              onPress={() => setAuthMode('login')}
            >
              <Text style={[styles.tabText, authMode === 'login' && styles.tabTextActive]}>
                Login
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, authMode === 'register' && styles.tabButtonActive]}
              onPress={() => setAuthMode('register')}
            >
              <Text style={[styles.tabText, authMode === 'register' && styles.tabTextActive]}>
                Register
              </Text>
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Email input */}
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputBox}>
            <Text style={styles.inputFieldIcon}>✉️</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter your email address"
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Password input */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputBox}>
            <Text style={styles.inputFieldIcon}>🔒</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter your password"
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '🙈'}</Text>
            </TouchableOpacity>
          </View>

          {/* Remember me & Forgot Password */}
          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
              <Text style={styles.rememberText}>Remember me</Text>
            </TouchableOpacity>

            <TouchableOpacity>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>Sign In  →</Text>
            )}
          </TouchableOpacity>

          {/* OR Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social Sign In Buttons */}
          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            <Text style={styles.socialIcon}>🌐</Text>
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            <Text style={styles.socialIcon}>🐙</Text>
            <Text style={styles.socialButtonText}>Continue with GitHub</Text>
          </TouchableOpacity>

          <View style={styles.registerRow}>
            <Text style={styles.registerPrompt}>Don't have an account? </Text>
            <TouchableOpacity>
              <Text style={styles.registerLink}>Create an account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  splitWrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    minHeight: '100%' as any,
  },
  leftHero: {
    flex: 1,
    backgroundColor: '#0369a1',
    padding: 48,
    justifyContent: 'space-between',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: {
    fontSize: 24,
  },
  heroBrandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  heroBrandAccent: {
    color: '#38bdf8',
  },
  heroBrandSub: {
    fontSize: 16,
    fontWeight: '700',
    color: '#bae6fd',
    marginTop: -4,
  },
  heroContent: {
    marginTop: 20,
  },
  heroHeadline: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 44,
  },
  heroHeadlineHighlight: {
    color: '#38bdf8',
  },
  heroSubheadline: {
    fontSize: 15,
    color: '#e0f2fe',
    marginTop: 12,
    lineHeight: 22,
    maxWidth: 420,
  },
  featurePillsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
  },
  pillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  pillIcon: {
    fontSize: 16,
  },
  pillTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  pillSub: {
    fontSize: 10,
    color: '#bae6fd',
  },
  heroArtworkCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  artworkEmoji: {
    fontSize: 48,
  },
  heroFooterBadge: {
    fontSize: 12,
    color: '#bae6fd',
    fontWeight: '600',
    fontStyle: 'italic',
  },
  rightForm: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 48,
    justifyContent: 'center',
  },
  topBar: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  langSelector: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
  },
  langText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  formContainer: {
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  formTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  formSubTitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 24,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#0284c7',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 12,
  },
  inputFieldIcon: {
    fontSize: 14,
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  eyeIcon: {
    fontSize: 14,
    padding: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 14,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#0284c7',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  rememberText: {
    fontSize: 13,
    color: '#334155',
  },
  forgotText: {
    fontSize: 13,
    color: '#0284c7',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#0284c7',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 4px 8px rgba(2,132,199,0.25)' as any,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '700',
    marginHorizontal: 12,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    height: 46,
    backgroundColor: '#ffffff',
    gap: 10,
    marginBottom: 10,
  },
  socialIcon: {
    fontSize: 16,
  },
  socialButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  registerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  registerPrompt: {
    fontSize: 13,
    color: '#64748b',
  },
  registerLink: {
    fontSize: 13,
    color: '#0284c7',
    fontWeight: '700',
  },
});
