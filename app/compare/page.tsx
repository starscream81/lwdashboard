"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type CompareMode = "aggregated" | "direct";

type UserPrivacy = {
  canCompare?: boolean;
};

type TeamsData = Record<string, unknown>;

const TEAM_LABELS: Record<string, string> = {
  team1Power: "Team 1 Power",
  team2Power: "Team 2 Power",
  team3Power: "Team 3 Power",
  team4Power: "Team 4 Power",
};

function formatPowerM(value: unknown): string {
  const num =
    typeof value === "number" ? value : parseFloat(String(value).trim());

  if (Number.isNaN(num)) {
    return String(value);
  }

  return `${num.toFixed(2)} M`;
}

type TeamKey = "team1Power" | "team2Power" | "team3Power" | "team4Power";

type AggregatedTeamStats = {
  average: number | null;
  count: number;
  values: number[];
};

type AggregatedStats = {
  teams: Record<TeamKey, AggregatedTeamStats>;
};

const TEAM_KEYS: TeamKey[] = [
  "team1Power",
  "team2Power",
  "team3Power",
  "team4Power",
];

function parsePower(value: unknown): number | null {
  const num =
    typeof value === "number" ? value : parseFloat(String(value).trim());
  return Number.isNaN(num) ? null : num;
}

function computePercentileRank(values: number[], userValue: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  let below = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i] < userValue) {
      below += 1;
    } else {
      break;
    }
  }
  const percentile = (below / sorted.length) * 100;
  return Math.round(percentile);
}

export default function CompareCenterPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [canCompare, setCanCompare] = useState<boolean | null>(null);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  const [activeMode, setActiveMode] = useState<CompareMode>("aggregated");

  const [teamsData, setTeamsData] = useState<TeamsData | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(true);

  const [aggregated, setAggregated] = useState<AggregatedStats | null>(null);
  const [loadingAggregated, setLoadingAggregated] = useState(true);
  const [aggregatedError, setAggregatedError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/login");
        return;
      }
      setUser(firebaseUser);
      setLoadingUser(false);
    });

    return () => unsubscribe();
  }, [router]);

  // Load privacy from users/{uid}/dashboard_meta/privacy
  useEffect(() => {
    if (!user) return;

    const loadPrivacy = async () => {
      try {
        const privacyRef = doc(
          db,
          "users",
          user.uid,
          "dashboard_meta",
          "privacy"
        );
        const snap = await getDoc(privacyRef);

        if (snap.exists()) {
          const data = snap.data() as UserPrivacy;
          setCanCompare(Boolean(data.canCompare));
        } else {
          setCanCompare(false);
        }
      } catch (err) {
        console.error("Error loading privacy settings", err);
        setCanCompare(false);
      }
    };

    loadPrivacy();
  }, [user]);

  // Load this user's team powers from users/{uid}/dashboard_meta/teams
  useEffect(() => {
    if (!user) return;

    const loadTeams = async () => {
      setLoadingTeams(true);
      try {
        const teamsRef = doc(db, "users", user.uid, "dashboard_meta", "teams");
        const snap = await getDoc(teamsRef);
        if (snap.exists()) {
          setTeamsData(snap.data() as TeamsData);
        } else {
          setTeamsData(null);
        }
      } catch (err) {
        console.error("Error loading teams data", err);
        setTeamsData(null);
      } finally {
        setLoadingTeams(false);
      }
    };

    loadTeams();
  }, [user]);

  // Load aggregated team powers for all users
  useEffect(() => {
    const fetchAggregated = async () => {
      setLoadingAggregated(true);
      setAggregatedError(null);

      try {
        const res = await fetch("/api/compare/aggregated");
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as AggregatedStats;
        setAggregated(data);
      } catch (err) {
        console.error("Error loading aggregated compare", err);
        setAggregatedError("Failed to load group averages.");
        setAggregated(null);
      } finally {
        setLoadingAggregated(false);
      }
    };

    fetchAggregated();
  }, []);

  const handleToggleCompare = async () => {
    if (!user || canCompare === null) return;

    const nextValue = !canCompare;
    setCanCompare(nextValue);
    setSavingPrivacy(true);

    try {
      const privacyRef = doc(
        db,
        "users",
        user.uid,
        "dashboard_meta",
        "privacy"
      );

      await setDoc(
        privacyRef,
        {
          canCompare: nextValue,
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Error saving privacy settings", err);
      setCanCompare(!nextValue);
    } finally {
      setSavingPrivacy(false);
    }
  };

  if (loadingUser) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="h-8 w-48 rounded-xl bg-slate-800 animate-pulse" />
          <div className="h-24 w-full rounded-2xl bg-slate-900 animate-pulse" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Compare Center
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Control how your stats are used in comparisons, then choose how
              you want to view results.
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
          >
            Back To Dashboard
          </button>
        </div>

        {/* Direct compare visibility */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Direct Compare Visibility
              </h2>
              <p className="mt-1 text-sm text-slate-400 max-w-xl">
                Anonymous averages and percentiles always use every player&apos;s
                stats. Turn this on if you want to appear in direct, side by
                side comparisons with other players. Your raw data is never
                exposed, only comparison views.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {canCompare === null ? (
                <span className="text-sm text-slate-500">Loading…</span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleToggleCompare}
                    disabled={savingPrivacy}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
                      canCompare
                        ? "border-emerald-400 bg-emerald-500/80"
                        : "border-slate-600 bg-slate-700"
                    } ${savingPrivacy ? "opacity-70 cursor-wait" : ""}`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow transition ${
                        canCompare ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-slate-200">
                      {canCompare
                        ? "Included In Direct Comparisons"
                        : "Excluded From Direct Comparisons"}
                    </span>
                    {savingPrivacy && (
                      <span className="text-[11px] text-slate-500">
                        Saving…
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Compare modes */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Compare Modes
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Choose how you want compare results to be presented. Modes
                always respect privacy settings.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setActiveMode("aggregated")}
                className={`inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium transition ${
                  activeMode === "aggregated"
                    ? "bg-sky-500 text-slate-950 shadow border border-sky-400"
                    : "border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                }`}
              >
                Aggregated Compare
              </button>

              <button
                type="button"
                onClick={() => setActiveMode("direct")}
                className={`inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium transition ${
                  activeMode === "direct"
                    ? "bg-sky-500 text-slate-950 shadow border border-sky-400"
                    : "border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                }`}
              >
                Direct Player Compare
              </button>
            </div>

            {activeMode === "aggregated" && (
              <div className="mt-1 space-y-4">
                <div className="text-sm text-slate-300 space-y-2">
                  <p>
                    Aggregated Compare shows how your team powers stack up
                    against group averages and percentiles, using stats from
                    every player who has saved their dashboard meta.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  {loadingTeams ? (
                    <p className="text-sm text-slate-500">
                      Loading Your Team Data…
                    </p>
                  ) : !teamsData ? (
                    <p className="text-sm text-slate-500">
                      No team data found in your dashboard meta.
                    </p>
                  ) : loadingAggregated ? (
                    <p className="text-sm text-slate-500">
                      Loading Group Averages…
                    </p>
                  ) : aggregatedError ? (
                    <p className="text-sm text-red-400">{aggregatedError}</p>
                  ) : !aggregated ? (
                    <p className="text-sm text-slate-500">
                      No group data available yet.
                    </p>
                  ) : (
                    <div className="space-y-3 text-sm">
                      {TEAM_KEYS.map((key) => {
                        const label = TEAM_LABELS[key] ?? key;
                        const userValueRaw = (
                          teamsData as Record<string, unknown>
                        )[key];
                        const userValue = parsePower(userValueRaw);
                        const groupStats = aggregated.teams[key];

                        if (
                          userValue === null &&
                          groupStats.average === null &&
                          !groupStats.values.length
                        ) {
                          return null;
                        }

                        const percentile =
                          userValue !== null && groupStats.values.length
                            ? computePercentileRank(
                                groupStats.values,
                                userValue
                              )
                            : null;

                        return (
                          <div
                            key={key}
                            className="flex flex-col gap-1 rounded-lg bg-slate-950/80 px-3 py-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-100">
                                {label}
                              </span>
                              {groupStats.count > 0 && (
                                <span className="text-[11px] text-slate-500">
                                  Based On {groupStats.count} Players
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-4 text-xs sm:text-sm">
                              <div className="flex items-center gap-1">
                                <span className="text-slate-400">You</span>
                                <span className="text-slate-200">
                                  {userValue !== null
                                    ? formatPowerM(userValue)
                                    : "No Data"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-slate-400">
                                  Group Average
                                </span>
                                <span className="text-slate-200">
                                  {groupStats.average !== null
                                    ? formatPowerM(groupStats.average)
                                    : "No Data"}
                                </span>
                              </div>
                              {percentile !== null && (
                                <div className="flex items-center gap-1">
                                  <span className="text-slate-400">
                                    Percentile Rank
                                  </span>
                                  <span className="text-slate-200">
                                    {percentile}
                                    th Percentile
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      <p className="mt-2 text-xs text-slate-500">
                        Aggregated Compare uses team power from every player who
                        has saved their dashboard meta, without identifying
                        anyone directly.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeMode === "direct" && (
              <div className="mt-1 text-sm text-slate-300 space-y-2">
                <p>
                  Direct Player Compare will let you pick a specific player and
                  view side by side stats when both of you have Direct Compare
                  Visibility enabled.
                </p>
                <p className="text-xs text-slate-500">
                  This mode is not wired yet. Once you are happy with
                  Aggregated Compare, we can add a player picker and a safe API
                  that respects mutual consent.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
