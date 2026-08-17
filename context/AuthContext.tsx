import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import { Session } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";

export type Profile = {
  id: string;
  display_name: string;
};

type AuthContextType = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext =
  createContext<AuthContextType | undefined>(
    undefined
  );

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] =
    useState<Session | null>(null);

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [loading, setLoading] =
    useState(true);

  async function loadProfile(
    currentSession: Session | null
  ) {
    if (!currentSession) {
      setProfile(null);
      return;
    }

    const { data, error } =
      await supabase
        .from("profiles")
        .select(
          "id, display_name"
        )
        .eq(
          "id",
          currentSession.user.id
        )
        .maybeSingle();

    if (error) {
      console.error(
        "Failed to load profile:",
        error.message
      );

      setProfile(null);
      return;
    }

    setProfile(data);
  }

  async function refreshProfile() {
    /*
     * Deliberately does not touch `loading`. That flag
     * gates whether _layout.tsx renders the Stack navigator
     * at all - flipping it here would unmount and remount
     * the whole navigator on every routine profile refresh
     * (e.g. after editing your display name), which resets
     * Expo Router's resolved route and can land you on an
     * unrelated screen. `loading` should only reflect "we
     * don't yet know the auth state" (initial boot, sign-in/
     * sign-out), not "a profile field just changed".
     */
    const {
      data: {
        session: currentSession,
      },
      error,
    } =
      await supabase.auth
        .getSession();

    if (error) {
      console.error(
        "Failed to get session:",
        error.message
      );

      return;
    }

    setSession(currentSession);

    await loadProfile(
      currentSession
    );
  }

  useEffect(() => {
    let mounted = true;

    async function initialise() {
      setLoading(true);

      const {
        data: {
          session:
            initialSession,
        },
        error,
      } =
        await supabase.auth
          .getSession();

      if (!mounted) {
        return;
      }

      if (error) {
        console.error(
          "Failed to initialise session:",
          error.message
        );

        setSession(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setSession(
        initialSession
      );

      await loadProfile(
        initialSession
      );

      if (mounted) {
        setLoading(false);
      }
    }

    initialise();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth
        .onAuthStateChange(
          (
            _event,
            newSession
          ) => {
            if (!mounted) {
              return;
            }

            if (!newSession) {
              setSession(null);
              setProfile(null);
              setLoading(false);
              return;
            }

            /*
             * We have authenticated the user,
             * but we do not yet know whether
             * they already have a profile.
             *
             * Keep the app on the loading
             * screen until that check finishes.
             */
            setLoading(true);

            setSession(
              newSession
            );

            setProfile(null);

            /*
             * Defer Supabase database work
             * until the auth callback finishes.
             */
            setTimeout(
              async () => {
                if (!mounted) {
                  return;
                }

                await loadProfile(
                  newSession
                );

                if (mounted) {
                  setLoading(false);
                }
              },
              0
            );
          }
        );

    return () => {
      mounted = false;

      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}