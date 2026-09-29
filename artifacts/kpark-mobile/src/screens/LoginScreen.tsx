import React from 'react';
import { useWindowDimensions, View, StyleSheet } from 'react-native';
import { MobileLoginView } from '../components/MobileLoginView';
import { DesktopLoginView } from '../components/DesktopLoginView';

export function LoginScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  return (
    <View style={styles.screen}>
      {isDesktop ? <DesktopLoginView /> : <MobileLoginView />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});
