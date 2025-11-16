"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/60 p-8 shadow-lg border border-slate-800">
        <h1 className="text-2xl font-semibold mb-6 text-center">
          {mode === "login" ? "Sign in" : "Create account"}
        </h1>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-sm text-slate-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-300">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 whitespace-pre-wrap">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 px-3 py-2 text-sm font-medium mt-2"
          >
            {loading
              ? "Working..."
              : mode === "login"
              ? "Sign in"
              : "Create account"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-slate-400">
          {mode === "login" ? (
            <>
              Need an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="text-sky-400 hover:underline"
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-sky-400 hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
