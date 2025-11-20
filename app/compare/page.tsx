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

type HeroDoc = {
  id: string;
  name?: string;
  displayName?: string;
  [key: string]: unknown;
};

type HeroesByTeam = Record<TeamKey, HeroDoc[]>;

// Research: we will use category names exactly as stored in researchTrackingDoc.category
// and focus on these eight canonical labels. Adjust if your category strings differ.
const RESEARCH_CATEGORY_ORDER: string[] = [
  "Units",
  "Hero",
  "Special Forces",
  "Siege to Seize",
  "Defense Fortifications",
  "Tank Mastery",
  "Air Mastery",
  "Missile Mastery",
];

type ResearchSummary = Map<string, number>; // category -> percent complete (0–100)

const TEAM_LABELS: Record<string, string> = {
  team1Power: "Team 1 Power",
  team2Power: "Team 2 Power",
  team3Power: "Team 3 Power",
  team4Power: "Team 4 Power",
};

function formatHeroFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function formatPowerM(value: unknown): string {
  const num =
    typeof value === "number" ? value : parseFloat(String(value).trim());

  if (Number.isNaN(num)) {
    return String(value);
  }

  return `${num.toFixed(2)} M`;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "No data";
  return `${value.toFixed(1)} %`;
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

function getTeamKeyForHero(hero: Record<string, unknown>): TeamKey | null {
  // Adjust this if your schema uses different properties
  const rawTeam = hero.team ?? hero.assignedTeam ?? hero.teamKey;

  if (rawTeam === 1 || rawTeam === "team1" || rawTeam === "Team 1") {
    return "team1Power";
  }
  if (rawTeam === 2 || rawTeam === "team2" || rawTeam === "Team 2") {
    return "team2Power";
  }
  if (rawTeam === 3 || rawTeam === "team3" || rawTeam === "Team 3") {
    return "team3Power";
  }
  if (rawTeam === 4 || rawTeam === "team4" || rawTeam === "Team 4") {
    return "team4Power";
  }

  return null;
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

  // Direct Compare: your heroes grouped by team
  const [myHeroesByTeam, setMyHeroesByTeam] = useState<HeroesByTeam>({
    team1Power: [],
    team2Power: [],
    team3Power: [],
    team4Power: [],
  });
  const [loadingMyHeroes, setLoadingMyHeroes] = useState(false);
  const [myHeroesError, setMyHeroesError] = useState<string | null>(null);

  // Direct Compare: their heroes grouped by team
  const [otherHeroesByTeam, setOtherHeroesByTeam] = useState<HeroesByTeam>({
    team1Power: [],
    team2Power: [],
    team3Power: [],
    team4Power: [],
  });
  const [loadingOtherHeroes, setLoadingOtherHeroes] = useState(false);
  const [otherHeroesError, setOtherHeroesError] = useState<string | null>(null);

  // Direct Compare: other player teams
  const [otherTeamsData, setOtherTeamsData] = useState<TeamsData | null>(null);
  const [loadingOtherTeams, setLoadingOtherTeams] = useState(false);
  const [otherTeamsError, setOtherTeamsError] = useState<string | null>(null);

  // Direct Compare: which team card is expanded for details
  const [expandedTeamKey, setExpandedTeamKey] = useState<TeamKey | null>(null);

  // Direct Compare: research summaries (aggregated from research_tracking rows)
  const [myResearch, setMyResearch] = useState<ResearchSummary | null>(null);
  const [otherResearch, setOtherResearch] =
    useState<ResearchSummary | null>(null);
  const [loadingMyResearch, setLoadingMyResearch] = useState(false);
  const [loadingOtherResearch, setLoadingOtherResearch] = useState(false);
  const [myResearchError, setMyResearchError] = useState<string | null>(null);
  const [otherResearchError, setOtherResearchError] =
    useState<string | null>(null);

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

  // Load aggregated compare data directly from Firestore (client side)
  useEffect(() => {
    if (!user) return;

    const loadAggregatedFromFirestore = async () => {
      setLoadingAggregated(true);
      setAggregatedError(null);

      try {
        // Get all users so we can read their dashboard_meta/teams docs
        const usersCol = collection(db, "users");
        const usersSnap = await getDocs(usersCol);

        const teamStats: AggregatedStats["teams"] = {
          team1Power: { average: null, count: 0, values: [] },
          team2Power: { average: null, count: 0, values: [] },
          team3Power: { average: null, count: 0, values: [] },
          team4Power: { average: null, count: 0, values: [] },
        };

        const teamDocPromises = usersSnap.docs.map(async (userDoc) => {
          const uid = userDoc.id;
          const teamsRef = doc(
            db,
            "users",
            uid,
            "dashboard_meta",
            "teams"
          );
          const teamsSnap = await getDoc(teamsRef);
          if (!teamsSnap.exists()) return;

          const data = teamsSnap.data() as Record<string, unknown>;

          TEAM_KEYS.forEach((key) => {
            const value = parsePower(data[key]);
            if (value !== null) {
              const stats = teamStats[key];
              stats.values.push(value);
              stats.count += 1;
            }
          });
        });

        await Promise.all(teamDocPromises);

        TEAM_KEYS.forEach((key) => {
          const stats = teamStats[key];
          if (stats.values.length > 0) {
            const sum = stats.values.reduce((acc, v) => acc + v, 0);
            stats.average = sum / stats.values.length;
          } else {
            stats.average = null;
          }
        });

        setAggregated({ teams: teamStats });
      } catch (err: any) {
        console.error(
          "[AggregatedCompare] Failed to load from Firestore",
          err
        );
        setAggregatedError(
          err?.message || "Failed to load aggregated compare."
        );
        setAggregated(null);
      } finally {
        setLoadingAggregated(false);
      }
    };

    loadAggregatedFromFirestore();
  }, [user]);

  // Load players eligible for Direct Compare
  useEffect(() => {
    if (!user || activeMode !== "direct") return;

    const loadPlayers = async () => {
      setDirectPlayersLoading(true);
      setDirectPlayersError(null);

      try {
        const usersCol = collection(db, "users");
        const usersSnap = await getDocs(usersCol);

        const players: DirectComparePlayer[] = [];

        for (const userDoc of usersSnap.docs) {
          const uid = userDoc.id;

          if (uid === user.uid) {
            continue;
          }

          const privacyRef = doc(
            db,
            "users",
            uid,
            "dashboard_meta",
            "privacy"
          );
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
            console.warn(
              `[DirectCompare] Profile lookup failed for ${uid}`,
              err
            );
          }

          players.push({ uid, displayName, serverId });
        }

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

  // Load teams for the selected player in Direct Compare
  useEffect(() => {
    if (!user || !selectedPlayerUid || activeMode !== "direct") {
      setOtherTeamsData(null);
      setOtherTeamsError(null);
      return;
    }

    const loadOtherTeams = async () => {
      setLoadingOtherTeams(true);
      setOtherTeamsError(null);

      try {
        const teamsRef = doc(
          db,
          "users",
          selectedPlayerUid,
          "dashboard_meta",
          "teams"
        );
        const snap = await getDoc(teamsRef);

        if (snap.exists()) {
          const data = snap.data() as TeamsData;
          setOtherTeamsData(data);
        } else {
          setOtherTeamsData(null);
        }
      } catch (err) {
        console.error(
          "[DirectCompare] Error loading other player teams",
          err
        );
        setOtherTeamsError(
          "Failed to load teams for the selected player."
        );
        setOtherTeamsData(null);
      } finally {
        setLoadingOtherTeams(false);
      }
    };

    loadOtherTeams();
  }, [user, selectedPlayerUid, activeMode]);

  // Load your heroes and group them by team
  useEffect(() => {
    if (!user || activeMode !== "direct") {
      setMyHeroesByTeam({
        team1Power: [],
        team2Power: [],
        team3Power: [],
        team4Power: [],
      });
      setMyHeroesError(null);
      return;
    }

    const loadMyHeroes = async () => {
      setLoadingMyHeroes(true);
      setMyHeroesError(null);

      try {
        const heroesCol = collection(db, "users", user.uid, "heroes");
        const heroesSnap = await getDocs(heroesCol);

        const grouped: HeroesByTeam = {
          team1Power: [],
          team2Power: [],
          team3Power: [],
          team4Power: [],
        };

        heroesSnap.forEach((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          const teamKey = getTeamKeyForHero(data);
          if (!teamKey) {
            return;
          }

          const hero: HeroDoc = {
            id: docSnap.id,
            name: (data.name as string | undefined) ?? undefined,
            displayName: (data.displayName as string | undefined) ?? undefined,
            ...data,
          };

          grouped[teamKey].push(hero);
        });

        setMyHeroesByTeam(grouped);
      } catch (err) {
        console.error("[DirectCompare][Heroes] Error loading my heroes", err);
        setMyHeroesError(
          "Failed to load your heroes for team composition."
        );
      } finally {
        setLoadingMyHeroes(false);
      }
    };

    loadMyHeroes();
  }, [user, activeMode]);

  // Load selected player heroes and group them by team
  useEffect(() => {
    if (!user || !selectedPlayerUid || activeMode !== "direct") {
      setOtherHeroesByTeam({
        team1Power: [],
        team2Power: [],
        team3Power: [],
        team4Power: [],
      });
      setOtherHeroesError(null);
      return;
    }

    const loadOtherHeroes = async () => {
      setLoadingOtherHeroes(true);
      setOtherHeroesError(null);

      try {
        const heroesCol = collection(
          db,
          "users",
          selectedPlayerUid,
          "heroes"
        );
        const heroesSnap = await getDocs(heroesCol);

        const grouped: HeroesByTeam = {
          team1Power: [],
          team2Power: [],
          team3Power: [],
          team4Power: [],
        };

        heroesSnap.forEach((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          const teamKey = getTeamKeyForHero(data);
          if (!teamKey) {
            return;
          }

          const hero: HeroDoc = {
            id: docSnap.id,
            name: (data.name as string | undefined) ?? undefined,
            displayName: (data.displayName as string | undefined) ?? undefined,
            ...data,
          };

          grouped[teamKey].push(hero);
        });

        setOtherHeroesByTeam(grouped);
      } catch (err) {
        console.error(
          "[DirectCompare][Heroes] Error loading other player heroes",
          err
        );
        setOtherHeroesError(
          "Failed to load heroes for the selected player."
        );
      } finally {
        setLoadingOtherHeroes(false);
      }
    };

    loadOtherHeroes();
  }, [user, selectedPlayerUid, activeMode]);

  // Helper to aggregate research for a given user from users/{uid}/research_tracking/*
  async function aggregateResearchForUser(
    uid: string
  ): Promise<ResearchSummary | null> {
    const colRef = collection(db, "users", uid, "research_tracking");
    const snap = await getDocs(colRef);

    if (snap.empty) {
      return null;
    }

    // category -> { current, max }
    const accum = new Map<string, { current: number; max: number }>();

    snap.forEach((docSnap) => {
      const data = docSnap.data() as {
        category?: string;
        currentLevel?: number;
        maxLevel?: number;
      };

      const category = data.category;
      if (!category) return;

      const current = data.currentLevel ?? 0;
      const max = data.maxLevel ?? 0;

      const entry = accum.get(category) ?? { current: 0, max: 0 };
      entry.current += current;
      entry.max += max;
      accum.set(category, entry);
    });

    if (accum.size === 0) {
      return null;
    }

    const result: ResearchSummary = new Map();

    accum.forEach((value, category) => {
      if (value.max > 0) {
        const percent = (value.current / value.max) * 100;
        result.set(category, percent);
      } else {
        result.set(category, 0);
      }
    });

    return result;
  }

  // Load your research completion summary
  useEffect(() => {
    if (!user || activeMode !== "direct") {
      setMyResearch(null);
      setMyResearchError(null);
      return;
    }

    const load = async () => {
      setLoadingMyResearch(true);
      setMyResearchError(null);

      try {
        const summary = await aggregateResearchForUser(user.uid);
        setMyResearch(summary);
      } catch (err) {
        console.error(
          "[DirectCompare][Research] Error loading my research",
          err
        );
        setMyResearchError("Failed to load your research summary.");
        setMyResearch(null);
      } finally {
        setLoadingMyResearch(false);
      }
    };

    load();
  }, [user, activeMode]);

  // Load selected player's research completion summary
  useEffect(() => {
    if (!user || !selectedPlayerUid || activeMode !== "direct") {
      setOtherResearch(null);
      setOtherResearchError(null);
      return;
    }

    const load = async () => {
      setLoadingOtherResearch(true);
      setOtherResearchError(null);

      try {
        const summary = await aggregateResearchForUser(selectedPlayerUid);
        setOtherResearch(summary);
      } catch (err) {
        console.error(
          "[DirectCompare][Research] Error loading other player research",
          err
        );
        setOtherResearchError(
          "Failed to load research for the selected player."
        );
        setOtherResearch(null);
      } finally {
        setLoadingOtherResearch(false);
      }
    };

    load();
  }, [user, selectedPlayerUid, activeMode]);

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
                      onChange={(e) => {
                        setSelectedPlayerUid(e.target.value);
                        setExpandedTeamKey(null);
                      }}
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

                {/* Direct compare results */}
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

                    {loadingOtherTeams && (
                      <p className="mt-3 text-xs text-slate-500">
                        Loading team data for this player…
                      </p>
                    )}

                    {otherTeamsError && !loadingOtherTeams && (
                      <p className="mt-3 text-xs text-red-400">
                        {otherTeamsError}
                      </p>
                    )}

                    {!loadingOtherTeams && !otherTeamsError && (
                      <>
                        <p className="mt-3 text-xs text-slate-500">
                          Team data loaded from Firestore.
                        </p>

                        {teamsData && otherTeamsData ? (
                          <div className="mt-4 space-y-4">
                            {/* Teams table */}
                            <div>
                              <div className="mb-2 flex items-center justify-between">
                                <span className="text-sm font-semibold text-slate-100">
                                  Teams Side-by-Side
                                </span>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="min-w-full text-xs sm:text-sm">
                                  <thead>
                                    <tr className="border-b border-slate-800">
                                      <th className="py-2 pr-3 text-left text-slate-400">
                                        Team
                                      </th>
                                      <th className="py-2 px-3 text-left text-slate-400">
                                        You
                                      </th>
                                      <th className="py-2 px-3 text-left text-slate-400">
                                        Them
                                      </th>
                                      <th className="py-2 pl-3 text-left text-slate-400">
                                        Difference
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {TEAM_KEYS.map((key) => {
                                      const label = TEAM_LABELS[key] ?? key;

                                      const meRaw = (teamsData as Record<
                                        string,
                                        unknown
                                      >)[key];
                                      const themRaw = (otherTeamsData as Record<
                                        string,
                                        unknown
                                      >)[key];

                                      const meValue = parsePower(meRaw);
                                      const themValue = parsePower(themRaw);

                                      if (meValue === null && themValue === null) {
                                        return null;
                                      }

                                      let diffDisplay = "n/a";
                                      if (meValue !== null && themValue !== null) {
                                        const diff = meValue - themValue;
                                        const mag = Math.abs(diff);
                                        if (diff === 0) {
                                          diffDisplay = "Equal";
                                        } else {
                                          const formatted = formatPowerM(mag);
                                          diffDisplay =
                                            diff > 0 ? `+${formatted}` : `-${formatted}`;
                                        }
                                      }

                                      return (
                                        <tr
                                          key={key}
                                          className="border-b border-slate-900/60 last:border-0"
                                        >
                                          <td className="py-2 pr-3 text-slate-200">
                                            {label}
                                          </td>
                                          <td className="py-2 px-3 text-slate-100">
                                            {meValue !== null
                                              ? formatPowerM(meValue)
                                              : "No data"}
                                          </td>
                                          <td className="py-2 px-3 text-slate-100">
                                            {themValue !== null
                                              ? formatPowerM(themValue)
                                              : "No data"}
                                          </td>
                                          <td className="py-2 pl-3 text-slate-100">
                                            {diffDisplay}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Team compositions: You vs Them */}
                            <div className="mt-6">
                              <div className="mb-2 flex items-center justify-between">
                                <span className="text-sm font-semibold text-slate-100">
                                  Team Compositions - Click On the Tile For Full Team Comparison
                                </span>
                                {(loadingMyHeroes || loadingOtherHeroes) && (
                                  <span className="text-[11px] text-slate-500">
                                    Loading heroes…
                                  </span>
                                )}
                              </div>

                              {(myHeroesError || otherHeroesError) && (
                                <p className="text-xs text-red-400">
                                  {myHeroesError || otherHeroesError}
                                </p>
                              )}

                              {!myHeroesError && !otherHeroesError && (
                                <>
                                  {/* Grid of team cards */}
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    {TEAM_KEYS.map((key) => {
                                      const myHeroes = myHeroesByTeam[key] || [];
                                      const theirHeroes =
                                        otherHeroesByTeam[key] || [];

                                      if (
                                        myHeroes.length === 0 &&
                                        theirHeroes.length === 0
                                      ) {
                                        return null;
                                      }

                                      const label = TEAM_LABELS[key] ?? key;

                                      return (
                                        <div
                                          key={key}
                                          onClick={() =>
                                            setExpandedTeamKey((prev) =>
                                              prev === key ? null : key
                                            )
                                          }
                                          className={`rounded-lg border px-3 py-2 bg-slate-950/60 cursor-pointer transition ${
                                            expandedTeamKey === key
                                              ? "border-sky-500/80 shadow-sm"
                                              : "border-slate-800 hover:border-slate-700"
                                          }`}
                                        >
                                          <div className="text-xs font-semibold text-slate-200 mb-2">
                                            {label}
                                          </div>

                                          <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-300">
                                            {/* YOU */}
                                            <div>
                                              <div className="mb-1 text-[10px] font-semibold text-slate-400 uppercase">
                                                You
                                              </div>
                                              {myHeroes.length === 0 ? (
                                                <p className="text-slate-500">
                                                  No heroes
                                                </p>
                                              ) : (
                                                <ul className="space-y-0.5">
                                                  {myHeroes.map((h) => (
                                                    <li key={h.id}>
                                                      {h.displayName ||
                                                        h.name ||
                                                        h.id}
                                                    </li>
                                                  ))}
                                                </ul>
                                              )}
                                            </div>

                                            {/* THEM */}
                                            <div>
                                              <div className="mb-1 text-[10px] font-semibold text-slate-400 uppercase">
                                                Them
                                              </div>
                                              {theirHeroes.length === 0 ? (
                                                <p className="text-slate-500">
                                                  No heroes
                                                </p>
                                              ) : (
                                                <ul className="space-y-0.5">
                                                  {theirHeroes.map((h) => (
                                                    <li key={h.id}>
                                                      {h.displayName ||
                                                        h.name ||
                                                        h.id}
                                                    </li>
                                                  ))}
                                                </ul>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Expanded team details panel */}
                                  {expandedTeamKey && (() => {
                                    const teamLabel =
                                      TEAM_LABELS[expandedTeamKey] ??
                                      expandedTeamKey;
                                    const myHeroes =
                                      myHeroesByTeam[expandedTeamKey] || [];
                                    const theirHeroes =
                                      otherHeroesByTeam[expandedTeamKey] ||
                                      [];

                                    if (
                                      myHeroes.length === 0 &&
                                      theirHeroes.length === 0
                                    ) {
                                      return null;
                                    }

                                    const renderHeroDetails = (hero: any) => {
                                      const title =
                                        hero.displayName ||
                                        hero.name ||
                                        hero.id;

                                      const getVal = (key: string) =>
                                        formatHeroFieldValue(hero[key]);

                                      return (
                                        <div
                                          key={hero.id}
                                          className="rounded-lg border border-slate-800 bg-slate-950 p-3"
                                        >
                                          <p className="text-xs font-semibold text-slate-100">
                                            {title}
                                          </p>

                                          <div className="mt-2 space-y-2 text-[11px] text-slate-300">
                                            {/* Power */}
                                            <div className="flex items-baseline justify-between gap-4">
                                              <span className="text-[10px] uppercase text-slate-500">
                                                Power
                                              </span>
                                              <span className="text-[11px] text-slate-200">
                                                {getVal("power")}
                                              </span>
                                            </div>

                                            {/* Rail Gun / Rail Gun Stars */}
                                            <div className="grid grid-cols-2 gap-4">
                                              <div className="flex items-baseline justify-between gap-2">
                                                <span className="text-[10px] uppercase text-slate-500">
                                                  Rail Gun
                                                </span>
                                                <span className="text-[11px] text-slate-200">
                                                  {getVal("rail_gun")}
                                                </span>
                                              </div>
                                              <div className="flex items-baseline justify-between gap-2">
                                                <span className="text-[10px] uppercase text-slate-500">
                                                  Rail Gun Stars
                                                </span>
                                                <span className="text-[11px] text-slate-200">
                                                  {getVal("rail_gun_stars")}
                                                </span>
                                              </div>
                                            </div>

                                            {/* Armor / Armor Stars */}
                                            <div className="grid grid-cols-2 gap-4">
                                              <div className="flex items-baseline justify-between gap-2">
                                                <span className="text-[10px] uppercase text-slate-500">
                                                  Armor
                                                </span>
                                                <span className="text-[11px] text-slate-200">
                                                  {getVal("armor")}
                                                </span>
                                              </div>
                                              <div className="flex items-baseline justify-between gap-2">
                                                <span className="text-[10px] uppercase text-slate-500">
                                                  Armor Stars
                                                </span>
                                                <span className="text-[11px] text-slate-200">
                                                  {getVal("armor_stars")}
                                                </span>
                                              </div>
                                            </div>

                                            {/* Data Chip / Data Chip Stars */}
                                            <div className="grid grid-cols-2 gap-4">
                                              <div className="flex items-baseline justify-between gap-2">
                                                <span className="text-[10px] uppercase text-slate-500">
                                                  Data Chip
                                                </span>
                                                <span className="text-[11px] text-slate-200">
                                                  {getVal("data_chip")}
                                                </span>
                                              </div>
                                              <div className="flex items-baseline justify-between gap-2">
                                                <span className="text-[10px] uppercase text-slate-500">
                                                  Data Chip Stars
                                                </span>
                                                <span className="text-[11px] text-slate-200">
                                                  {getVal("data_chip_stars")}
                                                </span>
                                              </div>
                                            </div>

                                            {/* Radar / Radar Stars */}
                                            <div className="grid grid-cols-2 gap-4">
                                              <div className="flex items-baseline justify-between gap-2">
                                                <span className="text-[10px] uppercase text-slate-500">
                                                  Radar
                                                </span>
                                                <span className="text-[11px] text-slate-200">
                                                  {getVal("radar")}
                                                </span>
                                              </div>
                                              <div className="flex items-baseline justify-between gap-2">
                                                <span className="text-[10px] uppercase text-slate-500">
                                                  Radar Stars
                                                </span>
                                                <span className="text-[11px] text-slate-200">
                                                  {getVal("radar_stars")}
                                                </span>
                                              </div>
                                            </div>

                                            {/* Exclusive Weapon Owned / Level */}
                                            <div className="grid grid-cols-2 gap-4">
                                              <div className="flex items-baseline justify-between gap-2">
                                                <span className="text-[10px] uppercase text-slate-500">
                                                  Exclusive Weapon Owned
                                                </span>
                                                <span className="text-[11px] text-slate-200">
                                                  {getVal(
                                                    "exclusive_weapon_owned"
                                                  )}
                                                </span>
                                              </div>
                                              <div className="flex items-baseline justify-between gap-2">
                                                <span className="text-[10px] uppercase text-slate-500">
                                                  Exclusive Weapon Level
                                                </span>
                                                <span className="text-[11px] text-slate-200">
                                                  {getVal(
                                                    "exclusive_weapon_level"
                                                  )}
                                                </span>
                                              </div>
                                            </div>

                                            {/* Skill 1 / Skill 2 */}
                                            <div className="grid grid-cols-2 gap-4">
                                              <div className="flex items-baseline justify-between gap-2">
                                                <span className="text-[10px] uppercase text-slate-500">
                                                  Skill 1
                                                </span>
                                                <span className="text-[11px] text-slate-200">
                                                  {getVal("skill1")}
                                                </span>
                                              </div>
                                              <div className="flex items-baseline justify-between gap-2">
                                                <span className="text-[10px] uppercase text-slate-500">
                                                  Skill 2
                                                </span>
                                                <span className="text-[11px] text-slate-200">
                                                  {getVal("skill2")}
                                                </span>
                                              </div>
                                            </div>

                                            {/* Skill 3 */}
                                            <div className="flex items-baseline justify-between gap-4">
                                              <span className="text-[10px] uppercase text-slate-500">
                                                Skill 3
                                              </span>
                                              <span className="text-[11px] text-slate-200">
                                                {getVal("skill3")}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    };

                                    return (
                                      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                                        <div className="flex items-center justify-between gap-2">
                                          <div>
                                            <p className="text-sm font-semibold text-slate-100">
                                              {teamLabel} details
                                            </p>
                                            <p className="text-xs text-slate-500">
                                              Showing full hero stats for this
                                              team. Click the team tile again to
                                              close.
                                            </p>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setExpandedTeamKey(null)
                                            }
                                            className="text-xs text-slate-400 hover:text-slate-200"
                                          >
                                            Close
                                          </button>
                                        </div>

                                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                                          {/* YOU SIDE */}
                                          <div>
                                            <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
                                              You
                                            </p>
                                            {myHeroes.length === 0 ? (
                                              <p className="text-xs text-slate-500">
                                                No heroes on this team.
                                              </p>
                                            ) : (
                                              <div className="space-y-3">
                                                {myHeroes.map(
                                                  renderHeroDetails
                                                )}
                                              </div>
                                            )}
                                          </div>

                                          {/* THEM SIDE */}
                                          <div>
                                            <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
                                              Them
                                            </p>
                                            {theirHeroes.length === 0 ? (
                                              <p className="text-xs text-slate-500">
                                                No heroes on this team for the
                                                selected player.
                                              </p>
                                            ) : (
                                              <div className="space-y-3">
                                                {theirHeroes.map(
                                                  renderHeroDetails
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </>
                              )}
                            </div>

                            {/* Research comparison */}
                            <div className="mt-8 border-t border-slate-800 pt-4">
                              <div className="mb-2 flex items-center justify-between">
                                <span className="text-sm font-semibold text-slate-100">
                                  Research Comparison
                                </span>
                                {(loadingMyResearch || loadingOtherResearch) && (
                                  <span className="text-[11px] text-slate-500">
                                    Loading research…
                                  </span>
                                )}
                              </div>

                              {(myResearchError || otherResearchError) && (
                                <p className="text-xs text-red-400">
                                  {myResearchError || otherResearchError}
                                </p>
                              )}

                              {myResearch === null && !loadingMyResearch && (
                                <p className="text-xs text-slate-500">
                                  No research summary found for your account
                                  yet.
                                </p>
                              )}

                              {myResearch &&
                                otherResearch === null &&
                                !loadingOtherResearch && (
                                  <p className="text-xs text-slate-500">
                                    Research summary not available for the
                                    selected player.
                                  </p>
                                )}

                              {myResearch && otherResearch && (
                                <div className="mt-2 overflow-x-auto">
                                  <table className="min-w-full text-xs sm:text-sm">
                                    <thead>
                                      <tr className="border-b border-slate-800">
                                        <th className="py-2 pr-3 text-left text-slate-400">
                                          Category
                                        </th>
                                        <th className="py-2 px-3 text-left text-slate-400">
                                          You
                                        </th>
                                        <th className="py-2 px-3 text-left text-slate-400">
                                          Them
                                        </th>
                                        <th className="py-2 pl-3 text-left text-slate-400">
                                          Difference
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {RESEARCH_CATEGORY_ORDER.map((catName) => {
                                        const meVal = myResearch.get(catName);
                                        const themVal =
                                          otherResearch.get(catName);

                                        if (
                                          meVal === undefined &&
                                          themVal === undefined
                                        ) {
                                          return null;
                                        }

                                        let diffDisplay = "n/a";
                                        if (
                                          meVal !== undefined &&
                                          themVal !== undefined
                                        ) {
                                          const diff = meVal - themVal;
                                          const mag = Math.abs(diff);
                                          if (Math.abs(diff) < 0.05) {
                                            diffDisplay = "Equal";
                                          } else {
                                            const sign =
                                              diff > 0 ? "+" : "-";
                                            diffDisplay = `${sign}${mag.toFixed(
                                              1
                                            )} %`;
                                          }
                                        }

                                        return (
                                          <tr
                                            key={catName}
                                            className="border-b border-slate-900/60 last:border-0"
                                          >
                                            <td className="py-2 pr-3 text-slate-200">
                                              {catName}
                                            </td>
                                            <td className="py-2 px-3 text-slate-100">
                                              {formatPercent(meVal)}
                                            </td>
                                            <td className="py-2 px-3 text-slate-100">
                                              {formatPercent(themVal)}
                                            </td>
                                            <td className="py-2 pl-3 text-slate-100">
                                              {diffDisplay}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="mt-3 text-xs text-slate-500">
                            Waiting for both your teams and their teams to be
                            available.
                          </p>
                        )}
                      </>
                    )}
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
