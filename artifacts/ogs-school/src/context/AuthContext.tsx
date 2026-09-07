import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile } from '../lib/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  passwordRecovery: boolean;
  clearPasswordRecovery: () => void;
  /** True once a password sign-in succeeds but the session still needs a TOTP code before it's fully authenticated. */
  mfaRequired: boolean;
  verifyMfa: (code: string) => Promise<{ error: Error | null }>;
  cancelMfaChallenge: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Detect a recovery link synchronously from the URL too — the supabase client
  // can consume the hash tokens before our onAuthStateChange listener attaches,
  // in which case we'd never see the PASSWORD_RECOVERY event.
  const [passwordRecovery, setPasswordRecovery] = useState(() =>
    typeof window !== 'undefined' && window.location.hash.includes('type=recovery')
  );
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);

  // Safety net: never hang on the loading screen for more than 8 seconds
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 8000);
    return () => clearTimeout(t);
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (data && data.is_active === false) {
      await supabase.auth.signOut();
      setProfile(null);
      return;
    }
    setProfile(data);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  // A password sign-in leaves the session at aal1 even when the user has an
  // enrolled TOTP factor — Supabase only elevates to aal2 after mfa.verify().
  // Detect that gap here so the app can hold the user on a code-entry screen
  // instead of letting them straight into the dashboard on password alone.
  const checkMfaStatus = async () => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data && data.currentLevel === 'aal1' && data.nextLevel === 'aal2') {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const factor = factorsData?.totp?.find(f => f.status === 'verified') ?? factorsData?.totp?.[0];
      setMfaFactorId(factor?.id ?? null);
      setMfaRequired(true);
    } else {
      setMfaRequired(false);
      setMfaFactorId(null);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        Promise.all([fetchProfile(session.user.id), checkMfaStatus()]).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch(() => {
      // Session restore failed (e.g. invalid refresh token) — clear the stale
      // local session so the app starts cleanly at the login screen.
      supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      setSession(null);
      setUser(null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        (async () => {
          if (event === 'SIGNED_IN') {
            setLoading(true);
          }
          await Promise.all([
            fetchProfile(session.user.id).catch(() => {}),
            checkMfaStatus().catch(() => {}),
          ]);
          setLoading(false);
        })();
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setMfaRequired(false);
        setMfaFactorId(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };
    if (data.user) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', data.user.id)
        .maybeSingle();
      if (prof && prof.is_active === false) {
        await supabase.auth.signOut();
        return { error: new Error('This account has been deactivated. Please contact your administrator.') };
      }
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setMfaRequired(false);
    setMfaFactorId(null);
  };

  const verifyMfa = async (code: string) => {
    if (!mfaFactorId) {
      return { error: new Error('No two-factor authentication method found on this account. Please contact your administrator.') };
    }
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
    if (challengeErr) return { error: challengeErr };
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyErr) return { error: verifyErr };
    setMfaRequired(false);
    return { error: null };
  };

  const cancelMfaChallenge = async () => {
    await signOut();
  };

  const contextValue = useMemo(() => ({
    user,
    session,
    profile,
    loading,
    signIn,
    signOut,
    refreshProfile,
    passwordRecovery,
    clearPasswordRecovery: () => setPasswordRecovery(false),
    mfaRequired,
    verifyMfa,
    cancelMfaChallenge,
  }), [user, session, profile, loading, passwordRecovery, mfaRequired, mfaFactorId]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
