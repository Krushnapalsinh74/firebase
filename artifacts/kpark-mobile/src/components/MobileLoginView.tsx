import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { loginEmailApi, loginGoogleApi } from '../api/client';

export function MobileLoginView() {
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
    <ScrollView contentContainerStyle={styles.container} bounces={false}>
      {/* ── Top Curved Hero Banner (Image 1) ── */}
      <View style={styles.heroBanner}>
        {/* Floating badge */}
        <View style={styles.floatingBadge}>
          <Text style={styles.floatingBadgeText}>Your Success Our Mission</Text>
        </View>

        {/* Logo & Tagline */}
        <View style={styles.logoRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeIcon}>🎓</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>
              Knowledge<Text style={styles.brandTitleAccent}>Park</Text>
            </Text>
            <Text style={styles.brandSubTitle}>Edu</Text>
          </View>
        </View>

        <Text style={styles.pillsRow}>Learn   •   Practice   •   Grow</Text>

        {/* 3D Illustration Graphic Box */}
        <View style={styles.illustrationBox}>
          <Text style={styles.illustrationEmoji}>📚🎓✨</Text>
        </View>
      </View>

      {/* ── Main Form Card ── */}
      <View style={styles.formCard}>
        <Text style={styles.heading}>Welcome Back 👋</Text>
        <Text style={styles.subHeading}>
          Sign in to continue your learning journey with KnowledgePark Edu.
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Email Field */}
        <View style={styles.inputWrapper}>
          <Text style={styles.inputIcon}>✉️</Text>
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            placeholderTextColor="#94a3b8"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Password Field */}
        <View style={styles.inputWrapper}>
          <Text style={styles.inputIcon}>🔒</Text>
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#94a3b8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '🙈'}</Text>
          </TouchableOpacity>
        </View>

        {/* Remember & Forgot Password */}
        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={styles.rememberBox}
            onPress={() => setRememberMe(!rememberMe)}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
              {rememberMe ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <Text style={styles.rememberText}>Remember me</Text>
          </TouchableOpacity>

          <TouchableOpacity>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        {/* Sign In Button */}
        <TouchableOpacity
          style={styles.signInButton}
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.signInButtonText}>Sign In  →</Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google Button */}
        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          <Text style={styles.googleIcon}>🌐</Text>
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Register prompt */}
        <View style={styles.registerRow}>
          <Text style={styles.registerPrompt}>Don't have an account? </Text>
          <TouchableOpacity>
            <Text style={styles.registerLink}>Create Account</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>Better Learning  •  Brighter Future</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f8fafc',
  },
  heroBanner: {
    backgroundColor: '#0c4a6e',
    paddingTop: 50,
    paddingHorizontal: 24,
    paddingBottom: 40,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    alignItems: 'center',
    position: 'relative',
  },
  floatingBadge: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  floatingBadgeText: {
    color: '#e0f2fe',
    fontSize: 11,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadgeIcon: {
    fontSize: 26,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  brandTitleAccent: {
    color: '#38bdf8',
  },
  brandSubTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#bae6fd',
    marginTop: -4,
  },
  pillsRow: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    letterSpacing: 1,
  },
  illustrationBox: {
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  illustrationEmoji: {
    fontSize: 32,
  },
  formCard: {
    padding: 24,
    marginTop: -20,
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    borderRadius: 24,
    boxShadow: '0px 4px 12px rgba(0,0,0,0.08)' as any,
    marginBottom: 30,
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  subHeading: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 18,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 14,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
  },
  eyeIcon: {
    fontSize: 16,
    padding: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  rememberBox: {
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
  signInButton: {
    backgroundColor: '#0284c7',
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 4px 8px rgba(2,132,199,0.30)' as any,
  },
  signInButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '700',
    marginHorizontal: 12,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    height: 48,
    backgroundColor: '#ffffff',
    gap: 10,
  },
  googleIcon: {
    fontSize: 18,
  },
  googleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  registerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
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
  footerText: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 24,
  },
});
