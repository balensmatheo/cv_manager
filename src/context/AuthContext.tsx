import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  getCurrentUser,
  fetchUserAttributes,
  fetchAuthSession,
  signOut as amplifySignOut,
} from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

interface AuthUser {
  username: string;
  email: string;
  groups: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, isAdmin: false, loading: true,
  signOut: () => {}, refreshUser: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      await getCurrentUser();
      const [attrs, session] = await Promise.all([
        fetchUserAttributes(),
        fetchAuthSession(),
      ]);
      const groups = (session.tokens?.accessToken?.payload?.['cognito:groups'] as string[] | undefined) ?? [];
      setUser({
        username: attrs.sub ?? '',
        email: attrs.email ?? '',
        groups,
      });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();
    const unsub = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn') void loadUser();
      if (payload.event === 'signedOut') { setUser(null); setLoading(false); }
    });
    return unsub;
  }, [loadUser]);

  const signOut = useCallback(() => {
    void amplifySignOut().then(() => setUser(null));
  }, []);

  // Users without any group are treated as regular "user"
  return (
    <AuthContext.Provider value={{
      user,
      isAdmin: user?.groups.includes('ADMINS') ?? false,
      loading,
      signOut,
      refreshUser: loadUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
