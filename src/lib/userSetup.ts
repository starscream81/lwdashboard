// src/lib/userSetup.ts
import { User } from "firebase/auth";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Make sure a user has:
 * - a root doc at users/{uid}
 * - a dashboard_meta/privacy doc (default canCompare = false)
 */
export async function ensureUserInitialized(firebaseUser: User) {
  const uid = firebaseUser.uid;

  // 1. Root user doc
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(
      userRef,
      {
        createdAt: serverTimestamp(),
        email: firebaseUser.email ?? null,
        displayName: firebaseUser.displayName ?? null,
      },
      { merge: true }
    );
  }

  // 2. Default privacy doc for Compare Center
  const privacyRef = doc(db, "users", uid, "dashboard_meta", "privacy");
  const privacySnap = await getDoc(privacyRef);

  if (!privacySnap.exists()) {
    await setDoc(
      privacyRef,
      {
        canCompare: false,
      },
      { merge: true }
    );
  }

  // (Optional) you could also create a default profile here if you want.
}
