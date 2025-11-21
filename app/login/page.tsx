"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInAnonymously,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ensureUserInitialized } from "@/lib/userSetup";
import { useLanguage } from "../i18n/LanguageProvider";

type Mode = "login" | "signup" | "reset";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [guestDialogOpen, setGuestDialogOpen] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  const mapAuthError = (err: any): string => {
    const code = err?.code as string | undefined;

    if (!code) {
      return t("auth.error.generic");
    }

    switch (code) {
      case "auth/invalid-email":
        return t("auth.error.invalidEmail");
      case "auth/user-not-found":
      case "auth/wrong-password":
        return t("auth.error.userNotFoundOrWrongPassword");
      case "auth/too-many-requests":
        return t("auth.error.tooManyRequests");
      case "auth/email-already-in-use":
        return t("auth.error.emailInUse");
      case "auth/weak-password":
        return t("auth.error.weakPassword");
      default:
        return t("auth.error.generic");
    }
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await ensureUserInitialized(cred.user);
        router.push("/dashboard");
        return;
      }

      if (mode === "signup") {
        if (password !== confirmPassword) {
          setError(t("auth.error.passwordMismatch"));
          return;
        }
        const cred = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        await ensureUserInitialized(cred.user);
        router.push("/dashboard");
        return;
      }

      if (mode === "reset") {
        await sendPasswordResetEmail(auth, email);
        setInfo(t("auth.info.resetSent"));
        return;
      }
    } catch (err: any) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGuestContinue() {
    setError(null);
    setInfo(null);
    setGuestLoading(true);
    try {
      const cred = await signInAnonymously(auth);
      await ensureUserInitialized(cred.user);
      setGuestDialogOpen(false);
      router.push("/dashboard");
    } catch (err: any) {
      setError(t("guest.error.couldNotStart"));
    } finally {
      setGuestLoading(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  const titleKey =
    mode === "login"
      ? "auth.mode.login.title"
      : mode === "signup"
      ? "auth.mode.signup.title"
      : "auth.mode.reset.title";

  const subtitleKey =
    mode === "login"
      ? "auth.mode.login.subtitle"
      : mode === "signup"
      ? "auth.mode.signup.subtitle"
      : "auth.mode.reset.subtitle";

  const primaryButtonKey =
    mode === "login"
      ? "auth.button.primary.login"
      : mode === "signup"
      ? "auth.button.primary.signup"
      : "auth.button.primary.reset";

  const title = t(titleKey);
  const subtitle = t(subtitleKey);
  const primaryButtonLabel = t(primaryButtonKey);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 px-4">
      <div className="w-full max-w-3xl">
        <div className="rounded-3xl bg-slate-900/70 border border-slate-800 shadow-xl overflow-hidden">
          <div className="grid md:grid-cols-[1.1fr,1fr]">
            {/* Left side: branding and context */}
            <div className="hidden md:flex flex-col justify-between bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8 border-r border-slate-800">
              <div className="space-y-4">
                <span className="inline-flex items-center rounded-full border border-slate-700 px-3 py-1 text-xs font-medium tracking-wide text-slate-200 bg-slate-950/60">
                  {t("app.name")}
                </span>
                <h2 className="text-xl font-semibold leading-snug text-slate-50">
                  {t("auth.brand.tagline")}
                </h2>
                <p className="text-sm text-slate-400">
                  {t("auth.brand.description")}
                </p>
              </div>
              <div className="mt-6 space-y-1 text-xs text-slate-500">
                <p>{t("auth.brand.signInHint")}</p>
                <p>{t("auth.brand.guestHint")}</p>
              </div>
            </div>

            {/* Right side: auth card */}
            <div className="p-6 md:p-8">
              <div className="mb-6 flex items-center justify-between md:hidden">
                <span className="inline-flex items-center rounded-full border border-slate-700 px-3 py-1 text-xs font-medium tracking-wide text-slate-200 bg-slate-950/60">
                  {t("app.name")}
                </span>
              </div>

              <div className="mb-6">
                <h1 className="text-2xl font-semibold text-slate-50">
                  {title}
                </h1>
                <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
              </div>

              {/* Mode toggle for login and signup */}
              <div className="mb-4 inline-flex items-center rounded-full bg-slate-900 border border-slate-800 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className={`px-3 py-1 rounded-full ${
                    mode === "login"
                      ? "bg-sky-600 text-slate-50"
                      : "text-slate-400 hover:text-slate-100"
                  }`}
                >
                  {t("auth.toggle.login")}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className={`px-3 py-1 rounded-full ${
                    mode === "signup"
                      ? "bg-sky-600 text-slate-50"
                      : "text-slate-400 hover:text-slate-100"
                  }`}
                >
                  {t("auth.toggle.signup")}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("reset")}
                  className={`px-3 py-1 rounded-full ${
                    mode === "reset"
                      ? "bg-sky-600 text-slate-50"
                      : "text-slate-400 hover:text-slate-100"
                  }`}
                >
                  {t("auth.toggle.reset")}
                </button>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1">
                  <label className="text-sm text-slate-300">
                    {t("auth.field.email.label")}
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    autoComplete="email"
                  />
                </div>

                {mode !== "reset" && (
                  <>
                    <div className="space-y-1">
                      <label className="text-sm text-slate-300">
                        {t("auth.field.password.label")}
                      </label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        autoComplete={
                          mode === "login"
                            ? "current-password"
                            : "new-password"
                        }
                      />
                    </div>

                    {mode === "signup" && (
                      <div className="space-y-1">
                        <label className="text-sm text-slate-300">
                          {t("auth.field.confirmPassword.label")}
                        </label>
                        <input
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) =>
                            setConfirmPassword(e.target.value)
                          }
                          className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                          autoComplete="new-password"
                        />
                      </div>
                    )}
                  </>
                )}

                {error && (
                  <p className="text-sm text-red-400 whitespace-pre-wrap">
                    {error}
                  </p>
                )}
                {info && (
                  <p className="text-sm text-emerald-400 whitespace-pre-wrap">
                    {info}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 px-3 py-2 text-sm font-medium mt-2"
                >
                  {loading
                    ? t("auth.button.primary.working")
                    : primaryButtonLabel}
                </button>
              </form>

              {/* Guest section */}
              <div className="mt-5 space-y-2">
                <button
                  type="button"
                  onClick={() => setGuestDialogOpen(true)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-900/80"
                >
                  {t("guest.button.openDialog")}
                </button>
                <p className="text-xs text-slate-500 text-center">
                  {t("guest.info.blurb")}
                </p>
              </div>

              {/* Bottom helper text on mobile */}
              <div className="mt-6 md:hidden">
                <p className="text-xs text-slate-500 text-center">
                  {t("auth.mobile.footer")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Guest dialog overlay */}
        {guestDialogOpen && (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70">
            <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl">
              <h3 className="text-lg font-semibold text-slate-50 mb-2">
                {t("guest.dialog.title")}
              </h3>
              <p className="text-sm text-slate-300 mb-3">
                {t("guest.dialog.body")}
              </p>
              <p className="text-xs text-slate-500 mb-4">
                {t("guest.dialog.note")}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setGuestDialogOpen(false)}
                  disabled={guestLoading}
                  className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                >
                  {t("guest.dialog.back")}
                </button>
                <button
                  type="button"
                  onClick={handleGuestContinue}
                  disabled={guestLoading}
                  className="rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 px-3 py-2 text-xs font-medium text-slate-50"
                >
                  {guestLoading
                    ? t("guest.dialog.starting")
                    : t("guest.dialog.continue")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
