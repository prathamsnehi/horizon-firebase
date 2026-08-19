import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getAuthClient, getDb } from "./firebase";

export type AuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  /** Signed in to Google, but no `admins/{uid}` document exists. */
  | { status: "not-authorized"; user: User }
  | { status: "admin"; user: User };

/**
 * Google sign-in plus the admin allowlist check.
 *
 * Membership is the existence of `admins/{uid}` in Firestore. This hook only
 * decides what to RENDER — the security boundary is the Firestore rules, which
 * refuse `generation_samples` to anyone without that document. Never treat a
 * passing check here as authorisation on its own.
 */
export function useAuth(): AuthState & {
  signIn: () => Promise<void>;
  signOutNow: () => Promise<void>;
} {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    return onAuthStateChanged(getAuthClient(), async (user) => {
      if (!user) {
        setState({ status: "signed-out" });
        return;
      }
      try {
        const snap = await getDoc(doc(getDb(), "admins", user.uid));
        setState(
          snap.exists()
            ? { status: "admin", user }
            : { status: "not-authorized", user }
        );
      } catch {
        // A rules rejection reading the admin doc means the same thing as a
        // missing one: this account does not have access.
        setState({ status: "not-authorized", user });
      }
    });
  }, []);

  return {
    ...state,
    signIn: async () => {
      await signInWithPopup(getAuthClient(), new GoogleAuthProvider());
    },
    signOutNow: async () => {
      await signOut(getAuthClient());
    },
  };
}
