import { useEffect } from 'react';
import { useAuthStore } from '@/hooks/use-auth';
import { useThemeStore } from '@/hooks/use-theme';
import { setAuthTokenGetter } from '@workspace/api-client-react';

export function useAppInit() {
  const theme = useThemeStore((s) => s.theme);
  
  useEffect(() => {
    // Setup API client auth token getter
    setAuthTokenGetter(() => {
      const state = useAuthStore.getState();
      return state.token;
    });

    // Clear any persisted dark theme so light is the default
    try {
      const stored = localStorage.getItem('yunora_theme');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.state?.theme === 'dark') {
          useThemeStore.getState().setTheme('light');
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);
}
