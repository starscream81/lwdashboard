"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";

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

type DirectComparePlayer = {
  uid: string;
  displayName: string;
  serverId?: string | number;
};

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

  // Direct Compare states
  const [directPlayers, setDirectPlayers] =
    useState<DirectComparePlayer[]>([]);
  const [directPlayersLoading, setDirectPlayersLoading] = useState(false);
  const [directPlayersError, setDirectPlayersError] = useState<string | null>(
    null
  );
  const [selectedPlayerUid, setSelectedPlayerUid] = useState("");

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

  // Load players eligible for Direct Compare (client side via Firestore)
  useEffect(() => {
    if (!user || activeMode !== "direct") return;

    const loadPlayers = async () => {
      setDirectPlayersLoading(true);
      setDirectPlayersError(null);

      try {
        // 1. Get all users
        const usersCol = collection(db, "users");
        const usersSnap = await getDocs(usersCol);

        const players: DirectComparePlayer[] = [];

        for (const userDoc of usersSnap.docs) {
          const uid = userDoc.id;

          // skip current user
          if (uid === user.uid) continue;

          // 2. Read privacy doc: users/{uid}/dashboard_meta/privacy
          const privacyRef = doc(db, "users", uid, "dashboard_meta", "privacy");
          const privacySnap = await getDoc(privacyRef);

          if (!privacySnap.exists()) {
            continue;
          }

          const privacyData = privacySnap.data() as
            | { canCompare?: boolean }
            | undefined;
          if (!privacyData?.canCompare) {
            continue;
          }

          // 3. Read a profile doc for name + server
          let displayName = `Player ${uid.slice(0, 6)}`;
          let serverId: string | number | undefined = undefined;

          try {
            const profilesCol = collection(db, "users", uid, "profiles");
            const profilesSnap = await getDocs(profilesCol);

            if (!profilesSnap.empty) {
              const pdata = profilesSnap.docs[0].data() as {
                displayName?: string;
                name?: string;
                serverId?: string | number;
                server?: string | number;
              };
              displayName =
                pdata.displayName ||
                pdata.name ||
                `Player ${uid.slice(0, 6)}`;
              serverId = pdata.serverId ?? pdata.server;
            }
          } catch (err) {
            console.warn(`Profile lookup failed for user ${uid}`, err);
          }

          players.push({ uid, displayName, serverId });
        }

        // optional sort
        players.sort((a, b) => {
          const sA = String(a.serverId ?? "");
          const sB = String(b.serverId ?? "");
          if (sA !== sB) return sA.localeCompare(sB);
          return a.displayName.localeCompare(b.displayName);
        });

        setDirectPlayers(players);
      } catch (err: any) {
        console.error("Failed loading direct compare players:", err);
        setDirectPlayersError(
          err?.message || "Failed to load players for direct compare."
        );
        setDirectPlayers([]);
      } finally {
        setDirectPlayersLoading(false);
      }
    };

    loadPlayers();
  }, [user, activeMode]);

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
              <div className="mt-1 space-y-6 text-sm text-slate-300">
                <p className="text-slate-300">
                  Choose a player who has also enabled Direct Compare to view
                  side by side statistics.
                </p>

                {/* Player Picker */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
                  <h3 className="text-base font-semibold text-slate-100">
                    Select Player To Compare With
                  </h3>

                  {directPlayersLoading && (
                    <p className="text-xs text-slate-400">Loading players…</p>
                  )}

                  {directPlayersError && (
                    <p className="text-xs text-red-400">
                      {directPlayersError}
                    </p>
                  )}

                  {!directPlayersLoading && directPlayers.length === 0 && (
                    <p className="text-xs text-slate-500">
                      No players are currently eligible for direct compare.
                    </p>
                  )}

                  {directPlayers.length > 0 && (
                    <select
                      className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                      value={selectedPlayerUid}
                      onChange={(e) => setSelectedPlayerUid(e.target.value)}
                    >
                      <option value="">Select a player…</option>
                      {directPlayers.map((p) => (
                        <option key={p.uid} value={p.uid}>
                          {p.displayName}
                          {p.serverId ? ` (S${p.serverId})` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Placeholder for compare results */}
                {selectedPlayerUid && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                    <p className="text-sm text-slate-100 mb-2">
                      Preparing comparison with:
                    </p>
                    <p className="text-base text-sky-400 font-semibold">
                      {(
                        directPlayers.find(
                          (p) => p.uid === selectedPlayerUid
                        ) ?? { displayName: "" }
                      ).displayName}
                    </p>

                    <p className="mt-3 text-xs text-slate-500">
                      Data will be loaded when Direct Compare API is added.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
