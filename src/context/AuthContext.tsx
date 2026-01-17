import React, { createContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Doc } from '../../convex/_generated/dataModel';

interface AuthContextType {
  sessionToken: string | null;
  user: (Doc<"users"> & { profile: (Doc<"userProfiles"> & { profileImageUrl: string | null; }) | null; }) | null | undefined;
  setToken: (token: string | null) => void;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [sessionToken, setSessionToken] = useState<string | null>(() => localStorage.getItem("sessionToken"));

  const setToken = useCallback((token: string | null) => {
    if (token) {
      localStorage.setItem("sessionToken", token);
    } else {
      localStorage.removeItem("sessionToken");
    }
    setSessionToken(token);
  }, []);

  const user = useQuery(api.auth.getUserFromToken, sessionToken ? { tokenIdentifier: sessionToken } : "skip");

  const isAuthenticated = useMemo(() => !!sessionToken && !!user, [sessionToken, user]);

  const value = { sessionToken, user, setToken, isAuthenticated };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};