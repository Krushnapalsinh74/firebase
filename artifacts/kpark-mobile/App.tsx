import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useAuthStore } from './src/store/authStore';
import { LoginScreen } from './src/screens/LoginScreen';

export default function App() {
  const { token, user, logout } = useAuthStore();

  if (!token || !user) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <LoginScreen />
      </View>
    );
  }

  return (
    <View style={styles.dashboardContainer}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome, {user.name}! 🌟</Text>
        <Text style={styles.emailText}>{user.email}</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Text style={styles.bodyTitle}>KnowledgePark Student Portal</Text>
        <Text style={styles.bodySub}>Your cross-platform Expo application is connected to the KnowledgePark backend.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  dashboardContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 24,
    backgroundColor: '#0284c7',
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  emailText: {
    fontSize: 13,
    color: '#e0f2fe',
    marginTop: 2,
  },
  logoutBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  logoutBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  bodyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  bodySub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 360,
  },
});
