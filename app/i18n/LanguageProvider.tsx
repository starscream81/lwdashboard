// starscream81/lwdashboard/lwdashboard-work/app/i18n/LanguageProvider.tsx

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { DEFAULT_LOCALE, Locale, isLocale, messages } from "./config";

import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (value: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

const STORAGE_KEY = "lastwar.locale";

export function LanguageProvider(props: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [user, setUser] = useState<User | null>(null);

  // track if the user has already changed language in this session
  const userChangedLocaleRef = useRef(false);

  // subscribe to Firebase auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return unsubscribe;
  }, []);

  // initial locale from localStorage or browser language
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && isLocale(stored)) {
        setLocaleState(stored);
        return;
      }

      const browserLang =
        typeof navigator !== "undefined"
          ? navigator.language.slice(0, 2).toLowerCase()
          : "en";

      if (isLocale(browserLang)) {
        setLocaleState(browserLang);
      }
    } catch {
      // ignore
    }
  }, []);

  // if authenticated, try to load preferred language from Firestore
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    (async () => {
      try {
        const ref = doc(db, "users", user.uid, "profiles", "default");
        const snap = await getDoc(ref);
        const data = snap.exists() ? snap.data() : null;
        const storedLocale = data?.language;

        if (
          !cancelled &&
          !userChangedLocaleRef.current &&
          typeof storedLocale === "string" &&
          isLocale(storedLocale)
        ) {
          setLocaleState(storedLocale);
        }
      } catch {
        // ignore Firestore errors for language loading
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // 💡 FINAL FIX: REMOVED WRITE-TO-FIRESTORE LOGIC
  // We only keep localStorage and DOM manipulation (if any), 
  // but the conflicting Firestore write is gone.
  useEffect(() => {
    // Removed document.documentElement.lang/dir mutation earlier
    
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // ignore
    }

    // 🛑 DELETED THE CONFLICTING FIREBASE WRITE:
    // if (user) {
    //   const ref = doc(db, "users", user.uid, "profiles", "default");
    //   setDoc(ref, { language: locale }, { merge: true }).catch(() => {});
    // }
  }, [locale, user]);

  const setLocale = useCallback((value: Locale) => {
    userChangedLocaleRef.current = true;
    setLocaleState(value);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const localeTable = messages[locale] || {};
      const defaultTable = messages[DEFAULT_LOCALE] || {};

      let template =
        (localeTable[key] as string | undefined) ??
        (defaultTable[key] as string | undefined) ??
        key;

      if (vars) {
        Object.entries(vars).forEach(([name, value]) => {
          template = template.replace(
            new RegExp(`\\{${name}\\}`, "g"),
            String(value)
          );
        });
      }

      return template;
    },
    [locale]
  );

  const value: LanguageContextValue = {
    locale,
    setLocale,
    t,
  };

  return (
    <LanguageContext.Provider value={value}>
      {props.children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return ctx;
}