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

type Mode = "login" | "signup" | "reset";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [guestDialogOpen, setGuestDialogOpen] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  function mapAuthError(err: any): string {
    const code = err?.code as string | undefined;

    if (!code) {
      return "Something went wrong. Please try again.";
    }

    switch (code) {
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/user-not-found":
      case "auth/wrong-password":
        return "Email or password did not match any account.";
      case "auth/too-many-requests":
        return "Too many attempts. Please wait a moment and try again.";
      case "auth/email-already-in-use":
        return "That email is already in use. Please sign in instead.";
      case "auth/weak-password":
        return "Please choose a stronger password.";
      default:
        return "Something went wrong. Please try again.";
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
        router.push("/dashboard");
        return;
      }

      if (mode === "signup") {
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }
        await createUserWithEmailAndPassword(auth, email, password);
        router.push("/dashboard");
        return;
      }

      if (mode === "reset") {
        await sendPasswordResetEmail(auth, email);
        setInfo(
          "If there is an account with that email, you will receive a reset link shortly."
        );
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
      await signInAnonymously(auth);
      setGuestDialogOpen(false);
      router.push("/dashboard");
    } catch (err: any) {
      setError("Could not start guest session. Please try again.");
    } finally {
      setGuestLoading(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  const title =
    mode === "login"
      ? "Sign in"
      : mode === "signup"
      ? "Create account"
      : "Reset password";

  const subtitle =
    mode === "login"
      ? "Sign in to your Command Center profile."
      : mode === "signup"
      ? "Create a Command Center profile to keep your progress in one place."
      : "Enter your email to receive a password reset link.";

  const primaryButtonLabel =
    mode === "login"
      ? "Sign in"
      : mode === "signup"
      ? "Create account"
      : "Send reset link";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 px-4">
      <div className="w-full max-w-3xl">
        <div className="rounded-3xl bg-slate-900/70 border border-slate-800 shadow-xl overflow-hidden">
          <div className="grid md:grid-cols-[1.1fr,1fr]">
            {/* Left side: branding and context */}
            <div className="hidden md:flex flex-col justify-between bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8 border-r border-slate-800">
              <div className="space-y-4">
                <span className="inline-flex items-center rounded-full border border-slate-700 px-3 py-1 text-xs font-medium tracking-wide text-slate-200 bg-slate-950/60">
                  Last War Command Center
                </span>
                <h2 className="text-xl font-semibold leading-snug text-slate-50">
                  Track your heroes, buildings, and research in one place.
                </h2>
                <p className="text-sm text-slate-400">
                  This Command Center is a fan made helper tool. It does not
                  connect to the game servers and never asks for your game
                  login. You only use an email and password for this site.
                </p>
              </div>
              <div className="mt-6 space-y-1 text-xs text-slate-500">
                <p>Sign in to keep your progress.</p>
                <p>Or try a guest session to explore without a full profile.</p>
              </div>
            </div>

            {/* Right side: auth card */}
            <div className="p-6 md:p-8">
              <div className="mb-6 flex items-center justify-between md:hidden">
                <span className="inline-flex items-center rounded-full border border-slate-700 px-3 py-1 text-xs font-medium tracking-wide text-slate-200 bg-slate-950/60">
                  Last War Command Center
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
                  Sign in
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
                  Create account
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
                  Reset password
                </button>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1">
                  <label className="text-sm text-slate-300">Email</label>
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
                        Password
                      </label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        autoComplete={
                          mode === "login" ? "current-password" : "new-password"
                        }
                      />
                    </div>

                    {mode === "signup" && (
                      <div className="space-y-1">
                        <label className="text-sm text-slate-300">
                          Confirm password
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
                  {loading ? "Working..." : primaryButtonLabel}
                </button>
              </form>

              {/* Guest section */}
              <div className="mt-5 space-y-2">
                <button
                  type="button"
                  onClick={() => setGuestDialogOpen(true)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-900/80"
                >
                  Continue as guest
                </button>
                <p className="text-xs text-slate-500 text-center">
                  Guest sessions are meant for quick tests. You can look around
                  and try things, but nothing is guaranteed to be kept after you
                  close your browser.
                </p>
              </div>

              {/* Bottom helper text on mobile */}
              <div className="mt-6 md:hidden">
                <p className="text-xs text-slate-500 text-center">
                  This Command Center is a fan made helper tool. It does not
                  connect to the game servers or use your game login.
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
                Continue as guest
              </h3>
              <p className="text-sm text-slate-300 mb-3">
                In guest mode you can explore the Command Center and enter
                sample data. This is a temporary session. Data from guest
                sessions may not be kept after you close the browser window and
                cannot be recovered or linked to an email later.
              </p>
              <p className="text-xs text-slate-500 mb-4">
                If you want a stable record of your heroes, buildings, and
                research, create a free profile instead.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setGuestDialogOpen(false)}
                  disabled={guestLoading}
                  className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                >
                  Go back
                </button>
                <button
                  type="button"
                  onClick={handleGuestContinue}
                  disabled={guestLoading}
                  className="rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 px-3 py-2 text-xs font-medium text-slate-50"
                >
                  {guestLoading ? "Starting guest session..." : "Continue as guest"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
