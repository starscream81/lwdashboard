"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  subscribeToResearch,
  updateResearch,
  seedResearchForUser,
} from "@/lib/research";
import { ResearchTrackingDoc } from "@/types/research";
import { useLanguage } from "../i18n/LanguageProvider";

type Profile = {
  displayName?: string | null;
  alliance?: string | null;
};

export default function ResearchPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [rows, setRows] = useState<ResearchTrackingDoc[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [hasSeeded, setHasSeeded] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const { t } = useLanguage();

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showInProgressOnly, setShowInProgressOnly] =
    useState<boolean>(false);
  const [showTrackedForTileOnly, setShowTrackedForTileOnly] =
    useState<boolean>(false);

  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoadingUser(false);
        return;
      }
      setUser(firebaseUser);
      setLoadingUser(false);
    });

    return () => unsub();
  }, []);

  // Load profile for header (displayName + alliance)
  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      try {
        const ref = doc(db, "users", user.uid, "profiles", "default");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setProfile(snap.data() as Profile);
        }
      } catch (err) {
        console.error("Failed to load profile for header", err);
      }
    };

    loadProfile();
  }, [user]);

  // Subscribe to user research and seed from research_catalog if empty
  useEffect(() => {
    if (!user?.uid) return;

    setLoadingData(true);

    const unsubscribe = subscribeToResearch(user.uid, async (list) => {
      // First time we see an empty list, seed from catalog
      if (!hasSeeded && list.length === 0) {
        setHasSeeded(true);
        await seedResearchForUser(user.uid);
        // After seeding, Firestore will emit another snapshot with the new rows
        return;
      }

      // Normal case: we have rows, show them
      setRows(list);
      setLoadingData(false);
    });

    return () => unsubscribe();
  }, [user, hasSeeded]);

  // Compute category-level completion
  const categoryProgress = useMemo(() => {
    const map = new Map<
      string,
      { category: string; current: number; max: number; tracked: boolean }
    >();

    for (const row of rows) {
      const cat = row.category || "Uncategorized";
      const existing = map.get(cat) || {
        category: cat,
        current: 0,
        max: 0,
        tracked: false,
      };

      const clampedCurrent = Math.max(0, row.currentLevel ?? 0);
      const clampedMax = Math.max(0, row.maxLevel ?? 0);

      existing.current += clampedCurrent;
      existing.max += clampedMax;

      existing.tracked = existing.tracked || !!row.trackStatus;

      map.set(cat, existing);
    }

    return Array.from(map.values())
      .map((data) => ({
        ...data,
        percent:
          data.max > 0 ? Math.round((data.current / data.max) * 100) : 0,
        tracked: data.tracked,
      }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [rows]);

  // Auto select first category when data loads
  useEffect(() => {
    if (!selectedCategory && categoryProgress.length > 0) {
      setSelectedCategory(categoryProgress[0].category);
    }
  }, [selectedCategory, categoryProgress]);

  const filteredRows = useMemo(() => {
    const list = rows.filter((r) => {
      if (!selectedCategory) return false;
      if (r.category !== selectedCategory) return false;

      if (showInProgressOnly && !r.inProgress) return false;
      if (showTrackedForTileOnly && !r.trackStatus) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        if (!r.name.toLowerCase().includes(term)) return false;
      }

      return true;
    });

    list.sort((a, b) => {
      const aPriority = a.priority ?? 0;
      const bPriority = b.priority ?? 0;

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      const aIndex = a.orderIndex ?? 99999;
      const bIndex = b.orderIndex ?? 99999;
      if (aIndex !== bIndex) return aIndex - bIndex;

      return a.name.localeCompare(b.name);
    });

    return list;
  }, [
    rows,
    selectedCategory,
    showInProgressOnly,
    showTrackedForTileOnly,
    searchTerm,
  ]);

  if (!user && !loadingUser) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-semibold text-white">
            {t("research.title")}
          </h1>
          <p className="text-slate-300">
            {t("auth.loginRequired.message")}
          </p>
        </div>
      </main>
    );
  }

  async function handleNumberChange(
    row: ResearchTrackingDoc,
    field: "currentLevel",
    rawValue: string
  ) {
    const trimmed = rawValue.trim();
    const num = trimmed === "" ? 0 : Number(trimmed);
    if (isNaN(num)) return;

    await updateResearch(user!.uid, row.id, { [field]: num });
  }

  async function handleToggle(
    row: ResearchTrackingDoc,
    field: "inProgress" | "trackStatus"
  ) {
    await updateResearch(user!.uid, row.id, {
      [field]: !row[field],
    });
  }

  async function handlePriorityToggle(row: ResearchTrackingDoc) {
    const newPriority = row.priority ? 0 : 1;
    await updateResearch(user!.uid, row.id, {
      priority: newPriority,
    });
  }

  const combinedDisplayNameWithAlliance = useMemo(() => {
    if (!profile) return "";

    const name = profile.displayName?.trim() || "";
    const alliance = profile.alliance?.trim() || "";

    if (!name && !alliance) return "";
    if (!name) return `[${alliance}]`;
    if (!alliance) return name;

    return `${name} [${alliance}]`;
  }, [profile]);

  const displayName =
    combinedDisplayNameWithAlliance === ""
      ? "Guest"
      : combinedDisplayNameWithAlliance;

  const displayNameWithGuestSuffix = user?.isAnonymous
    ? `${combinedDisplayNameWithAlliance} (Guest)`
    : combinedDisplayNameWithAlliance;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Header */}
        <section className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            {t("research.title")}
          </h1>
          <p className="text-sm text-slate-300">
            {t("research.subtitle")}
          </p>
        </section>

        {/* Category Progress Overview (now clickable selector) */}
        <section className="rounded-xl bg-slate-900/80 border border-slate-800 px-4 py-3 space-y-3">
          <h2 className="text-sm font-semibold text-slate-100">
            {t("research.categoryOverview.title")}
          </h2>
          <p className="text-xs text-slate-400">
            {t("research.categoryOverview.description")}
          </p>

          {categoryProgress.length === 0 ? (
            <p className="text-xs text-slate-500">
              {t("research.noData")}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {categoryProgress.map((cat) => {
                const isActive = selectedCategory === cat.category;

                return (
                  <div
                    key={cat.category}
                    onClick={() => setSelectedCategory(cat.category)}
                    className={`rounded-lg border px-3 py-2 flex items-center justify-between cursor-pointer transition ${
                      isActive
                        ? "border-sky-500 bg-sky-900/60 shadow-md"
                        : "border-slate-800 bg-slate-950/80 hover:border-slate-600 hover:bg-slate-900/80"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-slate-100">
                          {cat.category}
                        </span>
                        {cat.tracked && (
                          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-sky-400" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {t("research.category.percentComplete", {
                          percent: cat.percent,
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Filters */}
        <section className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">
                {t("research.filter.search.label")}
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t("research.filter.search.placeholder")}
                className="w-full rounded-lg bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500/70"
              />
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <div className="flex flex-col justify-end gap-2 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showInProgressOnly}
                    onChange={(e) =>
                      setShowInProgressOnly(e.target.checked)
                    }
                  />
                  {t("research.filter.inProgressOnly")}
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showTrackedForTileOnly}
                    onChange={(e) =>
                      setShowTrackedForTileOnly(e.target.checked)
                    }
                  />
                  {t("research.filter.trackedOnly")}
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* Table */}
        <section className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900">
                <th className="text-left px-3 py-2">
                  {t("research.table.category")}
                </th>
                <th className="text-left px-3 py-2">
                  {t("research.table.name")}
                </th>
                <th className="text-right px-3 py-2">
                  {t("research.table.current")}
                </th>
                <th className="text-right px-3 py-2">
                  {t("research.table.max")}
                </th>
                <th className="text-center px-3 py-2">
                  {t("research.table.inProgress")}
                </th>
                <th className="text-center px-3 py-2">
                  {t("research.table.priority")}
                </th>
                <th className="text-center px-3 py-2">
                  {t("research.table.trackForTile")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loadingData && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-4 text-center text-slate-400"
                  >
                    {t("research.loading")}
                  </td>
                </tr>
              )}

              {!loadingData && !selectedCategory && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-4 text-center text-slate-400"
                  >
                    {t("research.category.clickToView")}
                  </td>
                </tr>
              )}

              {!loadingData &&
                selectedCategory &&
                filteredRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-4 text-center text-slate-400"
                    >
                      {t("research.category.noEntries")}
                    </td>
                  </tr>
                )}

              {!loadingData &&
                filteredRows.map((row) => {
                  const isPriority =
                    row.priority != null && row.priority > 0;

                  return (
                    <tr
                      key={row.id}
                      className="border-t border-slate-800"
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.category}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.name}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          defaultValue={row.currentLevel}
                          onBlur={(e) =>
                            handleNumberChange(
                              row,
                              "currentLevel",
                              e.target.value
                            )
                          }
                          className="w-20 rounded bg-slate-950 border border-slate-700 px-2 py-1 text-right"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.maxLevel}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.inProgress}
                          onChange={() =>
                            handleToggle(row, "inProgress")
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handlePriorityToggle(row)}
                          className={`inline-flex items-center justify-center rounded-full border px-2 py-1 text-xs ${
                            isPriority
                              ? "border-amber-400 text-amber-300 bg-amber-900/40"
                              : "border-slate-600 text-slate-300 bg-slate-900"
                          }`}
                        >
                          {isPriority ? 1 : 0}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.trackStatus}
                          onChange={() =>
                            handleToggle(row, "trackStatus")
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
