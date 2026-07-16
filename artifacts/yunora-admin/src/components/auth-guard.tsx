import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuthStore } from '@/hooks/use-auth';
import { useGetMe } from '@workspace/api-client-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [location, setLocation] = useLocation();
  const token = useAuthStore((state) => state.token);
  const setUser = useAuthStore((state) => state.setUser);
  
  const { data: user, isError, isLoading } = useGetMe({ 
    query: { 
      queryKey: ['/api/auth/me'],
      enabled: !!token, 
      retry: false 
    } 
  });

  useEffect(() => {
    if (!token) {
      setLocation('/login');
    }
  }, [token, setLocation]);

  useEffect(() => {
    if (isError) {
      // Token might be invalid
      useAuthStore.getState().logout();
      setLocation('/login');
    } else if (user) {
      setUser(user);
    }
  }, [user, isError, setLocation, setUser]);

  if (!token) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return <>{children}</>;
}
