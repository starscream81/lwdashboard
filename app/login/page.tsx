"use client";

import { useState, FormEvent, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInAnonymously,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useLanguage } from "../i18n/LanguageProvider";

type AuthMode = "login" | "signup" | "reset";

// Simple Modal component for the guest warning
function GuestWarningModal({
  show,
  onClose,
  onConfirm,
  t,
}: {
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
  t: (key: string) => string;
}) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-xl bg-slate-900 p-6 shadow-2xl border border-slate-700 space-y-4">
        <h2 className="text-lg font-semibold text-white">Guest Mode Warning</h2>
        <p className="text-sm text-slate-300">
          {t("guest.info.blurb")}
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-400 rounded-lg hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [showGuestWarning, setShowGuestWarning] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Redirect to dashboard or home page after successful login
        router.push("/dashboard");
      }
    });

    return () => unsub();
  }, [router]);

  // Helper to handle form submission
  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      setResetMessage(null);
      setIsSubmitting(true);

      try {
        if (mode === "login") {
          await signInWithEmailAndPassword(auth, email, password);
        } else if (mode === "signup") {
          await createUserWithEmailAndPassword(auth, email, password);
        } else if (mode === "reset") {
          if (!email) {
            setError("Email is required for password reset."); // No i18n key for this
            setIsSubmitting(false);
            return;
          }
          await sendPasswordResetEmail(auth, email);
          setResetMessage("Password reset email sent. Please check your inbox."); // No i18n key for this
          setMode("login");
        }
      } catch (err: any) {
        console.error(err);
        // Using a non-i18n friendly message as no suitable error keys exist
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [mode, email, password]
  );

  const handleGuestLogin = async () => {
    setError(null);
    setShowGuestWarning(false); // Close the modal
    setIsSubmitting(true);

    try {
      await signInAnonymously(auth);
      // Success is handled by the useEffect redirect
    } catch (err) {
      console.error(err);
      setError("Failed to start guest session."); // No i18n key for this
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setResetMessage(null);
    setEmail("");
    setPassword("");
  };

  const currentTitle = mode === 'login' || mode === 'signup' 
    ? t("auth.mode.login.title")
    : t("auth.toggle.reset");

  const primaryButtonText = mode === 'login'
    ? t("auth.button.primary.login")
    : mode === 'signup'
    ? t("auth.toggle.signUp") // Using this as the best fit for a button label
    : "Send Reset Email"; // No i18n key for this

  const showEmailPasswordForm = mode === "login" || mode === "signup";

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 p-4">
      <div className="w-full max-w-md p-8 space-y-6 rounded-xl bg-slate-900 shadow-xl border border-slate-700">
        <h1 className="text-2xl font-semibold text-white text-center">
          {currentTitle}
        </h1>

        {/* Error and Success Messages */}
        {error && (
          <div className="text-sm text-red-400 bg-red-900/50 p-3 rounded-lg border border-red-700">
            {error}
          </div>
        )}
        {resetMessage && (
          <div className="text-sm text-emerald-400 bg-emerald-900/50 p-3 rounded-lg border border-emerald-700">
            {resetMessage}
          </div>
        )}

        {/* Auth Mode Toggles */}
        <div className="flex justify-center space-x-2">
          <button
            type="button"
            onClick={() => handleToggleMode("login")}
            className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${
              mode === "login"
                ? "bg-sky-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t("auth.toggle.login")}
          </button>
          <button
            type="button"
            onClick={() => handleToggleMode("signup")}
            className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${
              mode === "signup"
                ? "bg-sky-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t("auth.toggle.signUp")}
          </button>
          <button
            type="button"
            onClick={() => handleToggleMode("reset")}
            className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${
              mode === "reset"
                ? "bg-sky-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t("auth.toggle.reset")}
          </button>
        </div>

        {/* Email/Password Form for Login/Sign Up/Reset */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
              {t("auth.field.email.label")}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete={showEmailPasswordForm ? "email" : "off"}
              className="w-full rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500/70"
            />
          </div>

          {showEmailPasswordForm && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
                {t("auth.field.password.label")}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={mode === "login" || mode === "signup"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500/70"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50"
          >
            {isSubmitting ? "Loading..." : primaryButtonText}
          </button>
        </form>

        {/* Guest Login Button */}
        <div className="pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setShowGuestWarning(true)}
            disabled={isSubmitting}
            className="w-full py-2 px-4 border border-slate-700 rounded-lg shadow-sm text-sm font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50"
          >
            {t("guest.button.openDialog")}
          </button>
        </div>
      </div>

      {/* Guest Warning Modal */}
      <GuestWarningModal
        show={showGuestWarning}
        onClose={() => setShowGuestWarning(false)}
        onConfirm={handleGuestLogin}
        t={t}
      />
    </main>
  );
}