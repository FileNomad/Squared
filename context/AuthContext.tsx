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

/*
 * profile is a three-state value, not a boolean-ish
 * nullable: `undefined` means "there's a session but we
 * haven't checked whether it has a profile yet", `null`
 * means "checked, confirmed no profile", and Profile means
 * "checked, found one". Collapsing the first two into a
 * single `null` (as this used to do) is what caused the
 * create-profile screen to flash for returning users on
 * sign-in - the guard in _layout.tsx couldn't tell "still
 * checking" apart from "definitely no profile".
 */
type AuthContextType = {
  session: Session | null;
  profile: Profile | null | undefined;
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
    useState<
      Profile | null | undefined
    >(undefined);

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

    /*
     * `loading` is only ever touched here, during the app's
     * very first boot. _layout.tsx fully unmounts the Stack
     * navigator while it's true, so toggling it again later
     * (e.g. on sign-in/sign-out) would tear down and remount
     * an already-mounted navigator, which resets Expo
     * Router's resolved route. Stack.Protected's guards
     * already react to session/profile changing on their
     * own without needing that - see the onAuthStateChange
     * handler below, which deliberately never touches it.
     */
    async function initialise() {
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
              return;
            }

            /*
             * We have authenticated the user,
             * but we do not yet know whether
             * they already have a profile.
             * profile goes to undefined (not
             * null) specifically so
             * _layout.tsx can show a neutral
             * loading screen instead of
             * flashing create-profile for
             * returning users, without ever
             * needing to unmount the Stack.
             */
            setSession(
              newSession
            );

            setProfile(undefined);

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