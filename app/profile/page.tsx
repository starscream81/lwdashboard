"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import Link from "next/link";
import { auth, db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

type ProfileForm = {
  displayName: string;
  alliance: string;
  serverId: string; // string in the form, number in Firestore
};

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [form, setForm] = useState<ProfileForm>({
    displayName: "",
    alliance: "",
    serverId: "",
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      setUser(firebaseUser);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      try {
        const refDoc = doc(db, "users", user.uid, "profiles", "default");
        const snap = await getDoc(refDoc);
        if (snap.exists()) {
          const data = snap.data() as any;
          setForm({
            displayName: data.displayName ?? "",
            alliance: data.alliance ?? "",
            serverId:
              data.serverId != null
                ? String(data.serverId)
                : data.server != null
                ? String(data.server)
                : data.serverNumber != null
                ? String(data.serverNumber)
                : "",
          });
          setAvatarUrl(data.avatarUrl ?? null);
        }
      } catch (err) {
        console.error("Failed to load profile", err);
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    loadProfile();
  }, [user]);

  const handleChange = (field: keyof ProfileForm, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSaveMessage(null);
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setSaveMessage(null);
    try {
      const refDoc = doc(db, "users", user.uid, "profiles", "default");

      const serverIdNumber =
        form.serverId.trim().length > 0
          ? Number(form.serverId.trim())
          : null;

      const payload: any = {
        displayName: form.displayName.trim(),
        alliance: form.alliance.trim(),
      };

      if (!isNaN(serverIdNumber as number) && serverIdNumber !== null) {
        payload.serverId = serverIdNumber;
      } else if (form.serverId.trim().length === 0) {
        payload.serverId = null;
      }

      await setDoc(refDoc, payload, { merge: true });
      setSaveMessage("Profile saved.");
    } catch (err) {
      console.error("Failed to save profile", err);
      setSaveMessage("Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!user) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setSaveMessage(null);

    try {
      const avatarRef = ref(storage, `users/${user.uid}/avatar.jpg`);
      await uploadBytes(avatarRef, file);
      const url = await getDownloadURL(avatarRef);

      setAvatarUrl(url);

      const refDoc = doc(db, "users", user.uid, "profiles", "default");
      await setDoc(
        refDoc,
        {
          avatarUrl: url,
        },
        { merge: true }
      );

      setSaveMessage("Avatar updated.");
    } catch (err) {
      console.error("Failed to upload avatar", err);
      setSaveMessage("Failed to upload avatar.");
    } finally {
      setUploadingAvatar(false);
      // clear file input selection so same file can be reselected
      event.target.value = "";
    }
  };

  if (!user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-50">
        <h1 className="text-2xl font-semibold tracking-tight">
          Profile
        </h1>
        <p className="mt-3 text-sm text-slate-300">
          Please sign in to edit your profile.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 shadow"
        >
          Go to login
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Commander Profile
            </h1>
            <p className="text-sm text-slate-300">
              Update your name, alliance, avatar, and server.
            </p>
          </div>
          <Link
            href="/"
            className="text-xs text-sky-300 hover:text-sky-200"
          >
            ← Back to Dashboard
          </Link>
        </header>

        <section className="rounded-xl border border-slate-700/70 bg-slate-900/80 px-4 py-4 space-y-6">
          {loading ? (
            <p className="text-sm text-slate-300">Loading profile…</p>
          ) : (
            <>
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="h-16 w-16 rounded-full object-cover border border-slate-700"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-lg font-semibold">
                      {(form.displayName?.[0] ?? "C").toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-300">
                    Avatar
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileChange}
                    className="block text-xs text-slate-200"
                  />
                  <p className="text-[11px] text-slate-400">
                    Square images work best. Avatar updates immediately after upload.
                  </p>
                  {uploadingAvatar && (
                    <p className="text-[11px] text-sky-300">
                      Uploading avatar…
                    </p>
                  )}
                </div>
              </div>

              {/* Display name */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-300">
                  Display name
                </label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(e) =>
                    handleChange("displayName", e.target.value)
                  }
                  className="w-full rounded-md bg-slate-950/60 border border-slate-600/80 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500/70"
                  placeholder="Commander name"
                />
                <p className="text-[11px] text-slate-400">
                  Shown in the dashboard header.
                </p>
              </div>

              {/* Alliance */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-300">
                  Alliance
                </label>
                <input
                  type="text"
                  value={form.alliance}
                  onChange={(e) =>
                    handleChange("alliance", e.target.value)
                  }
                  className="w-full rounded-md bg-slate-950/60 border border-slate-600/80 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500/70"
                  placeholder="Example: FER"
                />
                <p className="text-[11px] text-slate-400">
                  Displayed as Shōckwave [FER] on the dashboard.
                </p>
              </div>

              {/* Server */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-300">
                  Server
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.serverId}
                  onChange={(e) =>
                    handleChange("serverId", e.target.value)
                  }
                  className="w-full max-w-xs rounded-md bg-slate-950/60 border border-slate-600/80 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500/70"
                  placeholder="Example: 977"
                />
                <p className="text-[11px] text-slate-400">
                  Used for Arms Race and Shiny tasks.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-slate-400">
                  {saveMessage && <span>{saveMessage}</span>}
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center rounded-md bg-sky-500 px-4 py-1.5 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
