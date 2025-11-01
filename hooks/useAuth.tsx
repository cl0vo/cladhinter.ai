import { useState, useEffect } from 'react';

export interface AuthUser {
  id: string;
  email?: string;
  accessToken: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(true);

  useEffect(() => {
    // Use anonymous user ID based on device
    const anonymousId = localStorage.getItem('cladhunter_anonymous_id') || 
      `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('cladhunter_anonymous_id', anonymousId);
    
    setUser({
      id: anonymousId,
      accessToken: '',
    });
    setIsAnonymous(true);
    setLoading(false);
  }, []);

  return { user, loading, isAnonymous };
}
