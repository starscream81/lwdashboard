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

function getCategoryKeyForRow(row: ResearchTrackingDoc): string {
  if (row.id && row.id.includes("__")) {
    return row.id.split("__")[0];
  }
  const base = row.category || "other";
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

  // Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoadingUser(false);
    });

    return () => unsubscribe();
  }, []);

  // Load profile for header (displayName plus alliance)
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

  // Subscribe to research
  useEffect(() => {
    if (!user) return;

    setLoadingData(true);

    const unsubscribe = subscribeToResearch(user.uid, (nextRows) => {
      setRows(nextRows);
      setLoadingData(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Seed data if empty
  useEffect(() => {
    if (!user) return;
    if (loadingData) return;
    if (hasSeeded) return;

    if (rows.length === 0) {
      seedResearchForUser(user.uid).catch((err) => {
        console.error("Failed to seed research for user", err);
      });
    }

    setHasSeeded(true);
  }, [user, loadingData, hasSeeded, rows.length]);

  // Compute category level completion using canonical keys
  const categoryProgress = useMemo(() => {
    const map = new Map<
      string,
      { categoryKey: string; current: number; max: number; tracked: boolean; inProgress: boolean }
    >();

    for (const row of rows) {
      const key = getCategoryKeyForRow(row);
      const existing = map.get(key) || {
        categoryKey: key,
        current: 0,
        max: 0,
        tracked: false,
        inProgress: false,
      };

      const clampedCurrent = Math.max(0, row.currentLevel ?? 0);
      const clampedMax = Math.max(0, row.maxLevel ?? 0);

      existing.current += clampedCurrent;
      existing.max += clampedMax;

      existing.tracked = existing.tracked || !!row.trackStatus;
      existing.inProgress = existing.inProgress || !!row.inProgress;

      map.set(key, existing);
    }

    return Array.from(map.values())
      .map((data) => {
        const categoryLabel = t(`research.categories.${data.categoryKey}`);
        return {
          ...data,
          categoryLabel,
          percent:
            data.max > 0 ? Math.round((data.current / data.max) * 100) : 0,
          tracked: data.tracked,
          inProgress: data.inProgress,
        };
      })
      .sort((a, b) => a.categoryLabel.localeCompare(b.categoryLabel));
  }, [rows, t]);

  // Auto select first category when data loads
  useEffect(() => {
    if (!selectedCategory && categoryProgress.length > 0) {
      setSelectedCategory(categoryProgress[0].categoryKey);
    }
  }, [selectedCategory, categoryProgress]);

  const filteredRows = useMemo(() => {
    const list = rows.filter((r) => {
      if (!selectedCategory) return false;

      const rowCategoryKey = getCategoryKeyForRow(r);
      if (rowCategoryKey !== selectedCategory) return false;

      if (showInProgressOnly && !r.inProgress) return false;
      if (showTrackedForTileOnly && !r.trackStatus) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const localizedName = t(`research.names.${r.id}`).toLowerCase();
        if (!localizedName.includes(term)) return false;
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

      const aLabel = t(`research.names.${a.id}`);
      const bLabel = t(`research.names.${b.id}`);
      return aLabel.localeCompare(bLabel);
    });

    return list;
  }, [
    rows,
    selectedCategory,
    showInProgressOnly,
    showTrackedForTileOnly,
    searchTerm,
    t,
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

  if (!user || loadingUser) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-sm text-slate-400">
          {t("research.loading")}
        </div>
      </main>
    );
  }

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

        {/* Category Progress Overview (clickable selector) */}
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
                const isActive = selectedCategory === cat.categoryKey;

                return (
                  <div
                    key={cat.categoryKey}
                    onClick={() => setSelectedCategory(cat.categoryKey)}
                    className={`rounded-lg border px-3 py-2 flex items-center justify-between cursor-pointer transition ${
                      isActive
                        ? "border-sky-500 bg-sky-900/60 shadow-md"
                        : "border-slate-800 bg-slate-950/80 hover:border-slate-600 hover:bg-slate-900/80"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium text-slate-100">
                            {cat.categoryLabel}
                          </span>
                          {cat.tracked && (
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-sky-400" />
                          )}
                        </div>

                        {cat.inProgress && (
                          <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-500/40">
                            {t("research.status.researching")}
                          </span>
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
                className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500/70"
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
        <section className="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-900/90 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2">
                    {t("research.table.category")}
                  </th>
                  <th className="px-3 py-2">
                    {t("research.table.name")}
                  </th>
                  <th className="px-3 py-2 text-right">
                    {t("research.table.current")}
                  </th>
                  <th className="px-3 py-2 text-right">
                    {t("research.table.max")}
                  </th>
                  <th className="px-3 py-2 text-center">
                    {t("research.table.inProgress")}
                  </th>
                  <th className="px-3 py-2 text-center">
                    {t("research.table.priority")}
                  </th>
                  <th className="px-3 py-2 text-center">
                    {t("research.table.trackForTile")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {selectedCategory &&
                  !loadingData &&
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
                          {t(`research.categories.${getCategoryKeyForRow(row)}`)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {t(`research.names.${row.id}`)}
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
                            className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-right text-xs text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
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
          </div>
        </section>
      </div>
    </main>
  );

  async function handleNumberChange(
    row: ResearchTrackingDoc,
    field: "currentLevel",
    value: string
  ) {
    const num = Number(value);
    if (!Number.isFinite(num)) return;

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
}
