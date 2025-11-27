// src/components/AuthGate.tsx
"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase"; 
import { usePathname, useRouter } from "next/navigation";
// FIX: Using relative path to resolve Module not found error
import { useLanguage } from "../../app/i18n/LanguageProvider"; 

// Custom hook to centralize auth state logic
function useAuthStatus() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { user, loading };
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStatus();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();

  // Define your public routes
  const PUBLIC_ROUTES = new Set(["/", "/login", "/privacy"]); 
  
  const isProtectedRoute = !PUBLIC_ROUTES.has(pathname);

  // Redirection logic
  useEffect(() => {
    if (loading) return;

    // 1. Logged in and on a public route -> redirect to dashboard
    if (user && PUBLIC_ROUTES.has(pathname)) {
      router.replace("/dashboard");
      return;
    }

    // 2. Not logged in and trying to access a protected route -> redirect to login
    if (!user && isProtectedRoute) {
      router.replace("/login");
      return;
    }
  }, [user, loading, pathname, isProtectedRoute, router, t]);

  // Render logic

  // Show a loading screen while Firebase initializes
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
        <p className="text-xl">{t("common.loading", { default: "Loading..." })}</p>
      </main>
    );
  }

  // If we are on a protected page WITHOUT a user, show a brief message until the redirect happens.
  if (!user && isProtectedRoute) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
        <p className="text-sm text-slate-400">
            {t("auth.redirecting", { default: "Redirecting to login..." })}
        </p>
      </main>
    );
  }

  // Render the app content
  return children;
}