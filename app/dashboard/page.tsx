"use client";

import { useEffect, useState, useMemo } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";

import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import hqRequirementsGroups from "@/config/dashboard/hq_requirements_groups.json";
import serverArmsRaceState from "@/config/dashboard/server_arms_race_state.json";
import shinyTasksRotation from "@/config/dashboard/shiny_tasks_rotation.json";
import vsTasks from "@/config/dashboard/vs_tasks.json";
import armsRaceSchedule from "@/config/dashboard/arms_race_schedule.json";
import hqRequirements from "@/config/dashboard/hq_requirements.json";

type HqRequirementsMap = Record<string, string[]>;

type HqRequirementGroup = {
  label: string;
  buildings: string[];
  rule: "any_one";
};

type BuildingLevelsMap = Record<string, number>;

type ResolvedRequirement = {
  id: string;
  label: string;
  requiredLevel: number;
  currentLevel: number;
  met: boolean;
};

type VsTask = {
  id: string;
  name: string;
};

type VsDayConfig = {
  title: string;
  tasks: VsTask[];
};

type VsTasksConfig = Record<string, VsDayConfig>;

type ArmsRacePhaseDisplay = {
  id: string;
  name: string;
  startLabel: string;
  endLabel: string;
  isCurrent: boolean;
};

type ArmsRaceToday = {
  title: string;
  phases: ArmsRacePhaseDisplay[];
  reason: string | null;
};

type ShinyRotationConfig = {
  rotationOrder: string[];
  currentGroup: string;
  groups: Record<string, number[]>;
};

type ShinyToday = {
  groupLabel: string | null;
  serversDisplay: string | null;
};

type ResearchStatusCategory = {
  category: string;
  percent: number;
};

type UpgradeSummary = {
  id: string;
  name: string;
  type: "research" | "building";
  status: string;
  currentLevel?: number | null;
  nextLevel?: number | null;
};

type Profile = {
  displayName?: string | null;
  allianceTag?: string | null;
  serverId?: string | null;
  avatarUrl?: string | null;
  totalHeroPower?: number | null;
};

type Hero = {
  id: string;
  name: string;
  power?: number | string | null;
  team?: number | null;
  type?: string | null;
  role?: string | null;
};

type TeamsPower = {
  [team: number]: string;
};

type TrackingItem = {
  id: string;
  kind?: string;
  name?: string;
  [key: string]: any;
};

const VS_TASKS = vsTasks as VsTasksConfig;

const HQ_REQUIREMENTS = hqRequirements as HqRequirementsMap;
const HQ_REQUIREMENT_GROUPS = hqRequirementsGroups as Record<
  string,
  HqRequirementGroup
>;

const SHINY_ROTATION = shinyTasksRotation as ShinyRotationConfig;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Anchor for Shiny rotation: this server calendar day was Group C
const SHINY_ROTATION_ANCHOR = {
  date: "2025-11-14",
  group: "C",
};

const ARMS_RACE_ANCHOR = {
  // server calendar date when server_arms_race_state.json was generated
  // and its day numbers were correct for all servers
  date: "2025-11-14",
};

// Server time helper (GMT minus 2)
const SERVER_UTC_OFFSET_HOURS = -2;

function getServerDate(): Date {
  const now = new Date();
  const utcMillis = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const serverMillis = utcMillis + SERVER_UTC_OFFSET_HOURS * 60 * 60 * 1000;
  return new Date(serverMillis);
}

function getServerDayNumber(): number {
  const serverDate = getServerDate();
  const y = serverDate.getUTCFullYear();
  const m = serverDate.getUTCMonth();
  const d = serverDate.getUTCDate();
  return Math.floor(Date.UTC(y, m, d) / MS_PER_DAY);
}

function getDayNumberFromDateString(dateStr: string): number {
  const [yStr, mStr, dStr] = dateStr.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

// Convert a server time string "HH:MM" (UTC minus 2) into the user's local time string
function convertServerTimeToLocal(timeStr: string): string {
  const [hhStr, mmStr] = timeStr.split(":");
  const hh = Number(hhStr);
  const mm = Number(mmStr);

  if (isNaN(hh) || isNaN(mm)) return timeStr;

  const now = new Date();
  const serverOffsetMinutes = SERVER_UTC_OFFSET_HOURS * 60;

  const utcMillis =
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hh,
      mm
    ) - serverOffsetMinutes * 60 * 1000;

  const localDate = new Date(utcMillis);

  return localDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function groupServerIds(ids: number[]): string {
  if (!ids || ids.length === 0) return "";

  const sorted = [...ids].sort((a, b) => a - b);
  const ranges: string[] = [];

  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];

    if (current === prev + 1) {
      prev = current;
      continue;
    }

    if (start === prev) {
      ranges.push(String(start));
    } else {
      ranges.push(`${start}\u2013${prev}`);
    }

    start = current;
    prev = current;
  }

  if (start === prev) {
    ranges.push(String(start));
  } else {
    ranges.push(`${start}\u2013${prev}`);
  }

  return ranges.join(", ");
}

function resolveHqRequirementsForNextLevel(
  currentHqLevel: number | null | undefined,
  buildingLevels: BuildingLevelsMap
): {
  nextLevel: number | null;
  rows: ResolvedRequirement[];
  metCount: number;
  totalCount: number;
} {
  if (currentHqLevel == null) {
    return { nextLevel: null, rows: [], metCount: 0, totalCount: 0 };
  }

  const nextLevel = currentHqLevel + 1;
  const requiredLevel = currentHqLevel;

  const key = String(nextLevel);
  const groupIds = HQ_REQUIREMENTS[key] ?? [];

  const rows: ResolvedRequirement[] = groupIds.map((groupId) => {
    const group = HQ_REQUIREMENT_GROUPS[groupId];
    if (!group) {
      return {
        id: groupId,
        label: groupId,
        requiredLevel,
        currentLevel: 0,
        met: false,
      };
    }

    let currentLevel = 0;

    for (const buildingName of group.buildings) {
      const level = buildingLevels[buildingName] ?? 0;
      if (level > currentLevel) {
        currentLevel = level;
      }
    }

    const met = currentLevel >= requiredLevel;

    return {
      id: groupId,
      label: group.label,
      requiredLevel,
      currentLevel,
      met,
    };
  });

  const metCount = rows.filter((r) => r.met).length;
  const totalCount = rows.length;

  return {
    nextLevel,
    rows,
    metCount,
    totalCount,
  };
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hqLevel, setHqLevel] = useState<number | null>(null);
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [teamsPower, setTeamsPower] = useState<TeamsPower>({});
  const [trackingItems, setTrackingItems] = useState<TrackingItem[]>([]);
  const [trackedCount, setTrackedCount] = useState<number>(0);
  const [trackedUpgrades, setTrackedUpgrades] = useState<UpgradeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTeam, setSavingTeam] = useState<number | null>(null);
  const [buildingLevels, setBuildingLevels] = useState<BuildingLevelsMap>({});
  const [researchStatus, setResearchStatus] = useState<
    ResearchStatusCategory[]
  >([]);

  const isGuest = user?.isAnonymous ?? false;

  const profileAlliance = isGuest
    ? "GUEST"
    : (profile as any)?.alliance != null &&
      (profile as any)?.alliance !== ""
    ? String((profile as any).alliance)
    : null;

  const baseDisplayName = isGuest
    ? "Guest Commander"
    : profile?.displayName ?? "Commander";

  const combinedDisplayNameWithAlliance = profileAlliance
    ? `${baseDisplayName} [${profileAlliance}]`
    : baseDisplayName;

  const combinedDisplayName = isGuest
    ? `${combinedDisplayNameWithAlliance} (Guest)`
    : combinedDisplayNameWithAlliance;

  const profileServerId =
    isGuest
      ? "977"
      : (profile as any)?.serverId ??
        (profile as any)?.server ??
        (profile as any)?.serverNumber ??
        null;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
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

    const loadData = async () => {
      try {
        const uid = user.uid;

        // Profile
        const profileRef = doc(db, "users", uid, "profiles", "default");
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          setProfile(profileSnap.data() as Profile);
        }

        // HQ level from buildings_kv
        let hqData: any | null = null;

        const directHqRef = doc(db, "users", uid, "buildings_kv", "HQ");
        const directHqSnap = await getDoc(directHqRef);

        if (directHqSnap.exists()) {
          hqData = directHqSnap.data();
        } else {
          const kvRef = collection(db, "users", uid, "buildings_kv");
          const hqQuery = query(kvRef, where("name", "==", "HQ"));
          const hqQuerySnap = await getDocs(hqQuery);

          if (!hqQuerySnap.empty) {
            hqData = hqQuerySnap.docs[0].data();
          }
        }

        if (hqData) {
          const rawLevel = hqData.level ?? hqData.value ?? null;
          const parsed =
            typeof rawLevel === "number"
              ? rawLevel
              : rawLevel != null
              ? Number(rawLevel)
              : null;

          setHqLevel(Number.isNaN(parsed as number) ? null : parsed);
        }

        // All building levels from buildings_kv (for HQ requirements tile and upgrades)
        const buildingsKvRef = collection(db, "users", uid, "buildings_kv");
        const buildingsKvSnap = await getDocs(buildingsKvRef);

        const levels: BuildingLevelsMap = {};

        buildingsKvSnap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const rawLevel = data.level ?? data.value ?? null;

          const level =
            typeof rawLevel === "number"
              ? rawLevel
              : rawLevel != null
              ? Number(rawLevel)
              : 0;

          const name =
            (data.name || docSnap.id || "").toString().trim();

          if (name) {
            levels[name] = level;
          }

          levels[docSnap.id] = level;
        });

        setBuildingLevels(levels);

        // Heroes
        const heroesRef = collection(db, "users", uid, "heroes");
        const heroesSnap = await getDocs(query(heroesRef));
        const heroList: Hero[] = heroesSnap.docs.map((d) => {
          const data = d.data() as any;
          let power: number | string | undefined = data.power;
          if (typeof power === "string") {
            const parsed = Number(power);
            power = isNaN(parsed) ? power : parsed;
          }
          return {
            id: d.id,
            name: data.name ?? "",
            power,
            team:
              data.team === null || data.team === undefined
                ? null
                : Number(data.team),
          };
        });
        setHeroes(heroList);

        // Teams power meta
        const teamsRef = doc(db, "users", uid, "dashboard_meta", "teams");
        const teamsSnap = await getDoc(teamsRef);
        if (teamsSnap.exists()) {
          const data = teamsSnap.data() as any;
          const newTeams: TeamsPower = {};
          [1, 2, 3, 4].forEach((team) => {
            const key = `team${team}Power`;
            if (data[key] != null) {
              newTeams[team] = String(data[key]);
            }
          });
          setTeamsPower(newTeams);
        }

        // Research tracking
        const researchRef = collection(db, "users", uid, "research_tracking");
        const researchSnap = await getDocs(query(researchRef));

        type ResearchRow = {
          id: string;
          name: string;
          category: string;
          currentLevel: number;
          maxLevel: number;
          inProgress: boolean;
          priority: number | null;
          trackStatus: boolean;
          orderIndex: number | null;
        };

        const researchRows: ResearchRow[] = researchSnap.docs.map((d) => {
          const data = d.data() as any;
          const currentLevel =
            data.currentLevel != null ? Number(data.currentLevel) : 0;
          const maxLevel =
            data.maxLevel != null ? Number(data.maxLevel) : 0;

          return {
            id: d.id,
            name: data.name ?? "(no name)",
            category: data.category ?? "Other",
            currentLevel: isNaN(currentLevel) ? 0 : currentLevel,
            maxLevel: isNaN(maxLevel) ? 0 : maxLevel,
            inProgress: !!data.inProgress,
            priority: data.priority != null ? Number(data.priority) : null,
            trackStatus: !!data.trackStatus,
            orderIndex: data.orderIndex != null ? Number(data.orderIndex) : null,
          };
        });

        // Research Status tile: only rows with trackStatus contribute
        const categoryTotals: Record<
          string,
          { current: number; max: number }
        > = {};

        researchRows.forEach((row) => {
          if (!row.trackStatus) return;

          const key = row.category || "Other";
          if (!categoryTotals[key]) {
            categoryTotals[key] = { current: 0, max: 0 };
          }

          categoryTotals[key].current += row.currentLevel;
          categoryTotals[key].max += row.maxLevel;
        });

        const status: ResearchStatusCategory[] = Object.entries(
          categoryTotals
        )
          .map(([category, totals]) => {
            const { current, max } = totals;
            const percent =
              max > 0 ? Math.floor((current / max) * 100) : 0;
            return { category, percent };
          })
          .sort((a, b) => a.category.localeCompare(b.category));

        setResearchStatus(status);

        // Research upgrades: anything currently researching, or queued via priority
        const trackedResearchUpgrades = researchRows.filter((row) => {
          if (row.inProgress) return true;
          if (row.priority != null && row.priority > 0) return true;
          return false;
        });

        // Next Up research: not in progress but has trackStatus or priority
        const nextUpResearch: TrackingItem[] = researchRows
          .filter(
            (row) =>
              !row.inProgress &&
              (row.trackStatus ||
                (row.priority != null && row.priority > 0))
          )
          .map((row) => ({
            id: row.id,
            name: row.name,
            type: "research" as const,
            priority: row.priority,
            orderIndex: row.orderIndex,
          }));

        // Buildings tracking
        const buildingsRef = collection(db, "users", uid, "buildings_tracking");
        const buildingsSnap = await getDocs(query(buildingsRef));

        type BuildingRow = {
          id: string;
          name: string;
          priority: number | null;
          orderIndex: number | null;
          tracked: boolean;
          upgrading: boolean;
        };

        const buildingRows: BuildingRow[] = buildingsSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name ?? "(no name)",
            priority: data.priority != null ? Number(data.priority) : null,
            orderIndex:
              data.orderIndex != null ? Number(data.orderIndex) : null,
            tracked: !!data.tracked,
            upgrading: !!data.upgrading,
          };
        });

        // Currently Upgrading tile: upgrading or has priority
        const trackedBuildingUpgrades = buildingRows.filter((row) => {
          if (row.upgrading) return true;
          if (row.priority != null && row.priority > 0) return true;
          return false;
        });

        // Next Up buildings: not upgrading and either tracked or priority
        const nextUpBuildings: TrackingItem[] = buildingRows
          .filter(
            (row) =>
              !row.upgrading &&
              (row.tracked ||
                (row.priority != null && row.priority > 0))
          )
          .map((row) => ({
            id: row.id,
            name: row.name,
            type: "building" as const,
            priority: row.priority,
            orderIndex: row.orderIndex,
          }));

        // Next Up panel combines research plus buildings
        const combined: TrackingItem[] = [
          ...nextUpResearch,
          ...nextUpBuildings,
        ];

        combined.sort((a, b) => {
          const pa = a.priority ?? Number.POSITIVE_INFINITY;
          const pb = b.priority ?? Number.POSITIVE_INFINITY;
          if (pa !== pb) return pa - pb;
          const oa = a.orderIndex ?? Number.POSITIVE_INFINITY;
          const ob = b.orderIndex ?? Number.POSITIVE_INFINITY;
          return oa - ob;
        });

        setTrackingItems(combined);

        // Tracked Upgrades tile (research plus buildings with level info)
        const researchSummaries: UpgradeSummary[] =
          trackedResearchUpgrades.map((row) => {
            const currentLevel = row.currentLevel;
            let nextLevel: number | null = null;
            if (currentLevel > 0) {
              const tentative = currentLevel + 1;
              if (row.maxLevel > 0 && tentative > row.maxLevel) {
                nextLevel = row.maxLevel;
              } else {
                nextLevel = tentative;
              }
            }

            return {
              id: row.id,
              name: row.name,
              type: "research",
              status: row.inProgress
                ? "In progress"
                : row.priority != null && row.priority > 0
                ? `Priority ${row.priority}`
                : "Tracked",
              currentLevel,
              nextLevel,
            };
          });

        const buildingSummaries: UpgradeSummary[] =
          trackedBuildingUpgrades.map((row) => {
            const currentLevel =
              levels[row.name] != null ? levels[row.name] : 0;
            const nextLevel =
              currentLevel > 0 ? currentLevel + 1 : null;

            return {
              id: row.id,
              name: row.name,
              type: "building",
              status: row.upgrading
                ? "Upgrading"
                : row.priority != null && row.priority > 0
                ? `Priority ${row.priority}`
                : "Tracked",
              currentLevel,
              nextLevel,
            };
          });

        const allSummaries: UpgradeSummary[] = [
          ...researchSummaries,
          ...buildingSummaries,
        ];

        const totalTrackedUpgrades = allSummaries.length;
        setTrackedCount(totalTrackedUpgrades);
        setTrackedUpgrades(allSummaries);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    loadData();
  }, [user]);

  const {
    nextLevel,
    rows: hqRequirementRows,
    metCount,
    totalCount,
  } = useMemo(
    () => resolveHqRequirementsForNextLevel(hqLevel, buildingLevels),
    [hqLevel, buildingLevels]
  );

  const vsToday = useMemo(() => {
    const serverDate = getServerDate();
    const weekdayIndex = serverDate.getUTCDay();
    const weekdayKeys = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const weekdayKey = weekdayKeys[weekdayIndex] ?? "sunday";

    const config = VS_TASKS[weekdayKey];
    return config ?? null;
  }, []);

  const armsRaceToday: ArmsRaceToday = useMemo(() => {
    const scheduleJson: any = armsRaceSchedule as any;
    const stateJson: any = serverArmsRaceState as any;

    const serverId = profileServerId;

    if (!serverId) {
      return {
        title: "Today\u2019s Arms Race",
        phases: [],
        reason: "Server is not configured in your profile.",
      };
    }

    const serversMap = stateJson.servers ?? {};
    const stateEntry = serversMap[String(serverId)];
    let baseDayNumber: number | null = null;

    if (typeof stateEntry === "number") {
      baseDayNumber = stateEntry;
    } else if (typeof stateEntry === "string") {
      const parsed = Number(stateEntry);
      if (!isNaN(parsed)) {
        baseDayNumber = parsed;
      }
    } else if (stateEntry && typeof stateEntry === "object") {
      const possibleKeys = ["day", "currentDay", "dayNumber", "index"];
      for (const key of possibleKeys) {
        const value = (stateEntry as any)[key];
        if (typeof value === "number") {
          baseDayNumber = value;
          break;
        }
        if (typeof value === "string") {
          const parsed = Number(value);
          if (!isNaN(parsed)) {
            baseDayNumber = parsed;
            break;
          }
        }
      }
    }

    if (baseDayNumber == null) {
      console.log("[ArmsRaceDebug]", {
        serverId,
        stateEntry,
        baseDayNumber,
        effectiveDayNumber: null,
        reason: "no baseDayNumber",
      });
      return {
        title: "Today\u2019s Arms Race",
        phases: [],
        reason: `No Arms Race day found for server ${serverId}.`,
      };
    }

    const cycleLength =
      typeof scheduleJson.cycleLengthDays === "number"
        ? scheduleJson.cycleLengthDays
        : 7;

    let dayNumber = baseDayNumber;

    if (cycleLength > 0) {
      const serverDayNumberToday = getServerDayNumber();
      const anchorDayNumber = getDayNumberFromDateString(
        ARMS_RACE_ANCHOR.date
      );
      const daysSinceAnchor = serverDayNumberToday - anchorDayNumber;

      const normalizedOffset =
        ((daysSinceAnchor % cycleLength) + cycleLength) % cycleLength;

      dayNumber =
        ((baseDayNumber - 1 + normalizedOffset) % cycleLength) + 1;

      console.log("[ArmsRaceDebug]", {
        serverId,
        stateEntry,
        baseDayNumber,
        daysSinceAnchor,
        cycleLength,
        effectiveDayNumber: dayNumber,
      });
    }

    const daysArray: any[] = Array.isArray(scheduleJson.days)
      ? scheduleJson.days
      : [];

    let dayConfig = daysArray.find((d) => d.dayNumber === dayNumber);

    if (!dayConfig && daysArray.length > 0) {
      const fallbackCycle =
        typeof scheduleJson.cycleLengthDays === "number"
          ? scheduleJson.cycleLengthDays
          : daysArray.length;

      if (fallbackCycle > 0) {
        const modDay = ((dayNumber - 1) % fallbackCycle) + 1;
        dayConfig =
          daysArray.find((d) => d.dayNumber === modDay) ?? daysArray[0];
      } else {
        dayConfig = daysArray[0];
      }
    }

    if (!dayConfig) {
      return {
        title: "Today\u2019s Arms Race",
        phases: [],
        reason: `No Arms Race schedule found for day ${dayNumber}.`,
      };
    }

    const phasesData: any[] = Array.isArray(dayConfig.phases)
      ? dayConfig.phases
      : [];

    const now = getServerDate();
    const minutesNow = now.getUTCHours() * 60 + now.getUTCHours();

    const parseTime = (time: string): number => {
      const [hhStr, mmStr] = time.split(":");
      const hh = Number(hhStr);
      const mm = Number(mmStr);
      if (isNaN(hh) || isNaN(mm)) return 0;
      return hh * 60 + mm;
    };

    const phases: ArmsRacePhaseDisplay[] = phasesData.map(
      (phase, index: number) => {
        const startStr = phase.startServer ?? "00:00";
        const endStr = phase.endServer ?? "23:59";
        const startMinutes = parseTime(startStr);
        const endMinutes = parseTime(endStr);

        const isCurrent =
          minutesNow >= startMinutes && minutesNow <= endMinutes;

        return {
          id: `phase-${index}`,
          name: phase.label ?? "Unknown",
          startLabel: convertServerTimeToLocal(startStr),
          endLabel: convertServerTimeToLocal(endStr),
          isCurrent,
        };
      }
    );

    const title =
      typeof dayConfig.title === "string"
        ? dayConfig.title
        : "Today\u2019s Arms Race";

    return {
      title,
      phases,
      reason: null,
    };
  }, [profileServerId]);

  const shinyToday: ShinyToday = useMemo(() => {
    const cfg = SHINY_ROTATION;

    if (
      !cfg ||
      !cfg.rotationOrder ||
      cfg.rotationOrder.length === 0 ||
      !cfg.groups
    ) {
      return {
        groupLabel: null,
        serversDisplay: null,
      };
    }

    const n = cfg.rotationOrder.length;
    const anchorGroup = SHINY_ROTATION_ANCHOR.group;
    const anchorIndexRaw = cfg.rotationOrder.indexOf(anchorGroup);
    const anchorIndex = anchorIndexRaw === -1 ? 0 : anchorIndexRaw;

    const serverDayNumber = getServerDayNumber();
    const anchorDayNumber = getDayNumberFromDateString(
      SHINY_ROTATION_ANCHOR.date
    );

    const diffDays = serverDayNumber - anchorDayNumber;

    const normalizedDiff = ((diffDays % n) + n) % n;
    const groupIndex = (anchorIndex + normalizedDiff) % n;
    const groupKey = cfg.rotationOrder[groupIndex];

    const servers = cfg.groups[groupKey];

    if (!servers || servers.length === 0) {
      return {
        groupLabel: `Group ${groupKey}`,
        serversDisplay: null,
      };
    }

    return {
      groupLabel: `Group ${groupKey}`,
      serversDisplay: groupServerIds(servers),
    };
  }, []);

  const totalHeroPower = useMemo(() => {
    return heroes.reduce((sum, h) => {
      const value =
        typeof h.power === "number"
          ? h.power
          : h.power != null
          ? Number(h.power)
          : 0;
      return sum + (isNaN(value) ? 0 : value);
    }, 0);
  }, [heroes]);

  const formattedTotalHeroPower = useMemo(() => {
    if (!totalHeroPower) return "0";
    if (totalHeroPower >= 1_000_000) {
      return `${(totalHeroPower / 1_000_000).toFixed(2)}M`;
    }
    if (totalHeroPower >= 1_000) {
      return `${(totalHeroPower / 1_000).toFixed(1)}K`;
    }
    return String(totalHeroPower);
  }, [totalHeroPower]);

  const heroesByTeam = useMemo(() => {
    const byTeam: { [team: number]: Hero[] } = {};
    heroes.forEach((h) => {
      if (!h.team) return;
      if (!byTeam[h.team]) byTeam[h.team] = [];
      byTeam[h.team].push(h);
    });
    Object.values(byTeam).forEach((list) =>
      list.sort((a, b) => a.name.localeCompare(b.name))
    );
    return byTeam;
  }, [heroes]);

  const handleTeamPowerChange = (team: number, value: string) => {
    if (value.length > 5) return;
    setTeamsPower((prev) => ({
      ...prev,
      [team]: value,
    }));
  };

  const saveTeamPower = async (team: number) => {
    if (!user) return;
    const value = teamsPower[team];
    setSavingTeam(team);
    try {
      const uid = user.uid;
      const ref = doc(db, "users", uid, "dashboard_meta", "teams");
      const key = `team${team}Power`;
      await setDoc(ref, { [key]: value ?? "" }, { merge: true });
    } catch (err) {
      console.error("Failed to save team power", err);
    } finally {
      setSavingTeam(null);
    }
  };

  if (!user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-50">
        <h1 className="text-3xl font-semibold tracking-tight">
          Last War Command Center
        </h1>

        <p className="mt-3 text-sm text-slate-300">
          Please sign in to view your command center.
        </p>

        <Link
          href="/login"
          className="mt-6 inline-flex items-center items-center rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 shadow"
        >
          Go to login
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Header strip */}
        <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/70 px-3 py-1 border border-slate-700/60">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-slate-200">
                Last War Command Center
              </span>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                Last War Dashboard
              </h1>
              <p className="text-sm text-slate-300">
                Track your base, squads, and upgrades in one place.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-slate-900/80 px-4 py-3 border border-slate-700/70">
            <div className="relative">
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName ?? "Commander avatar"}
                  className="h-12 w-12 rounded-full object-cover border border-slate-700"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-lg font-semibold">
                  {(baseDisplayName[0] ?? "C").toUpperCase()}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Link
                href="/profile"
                className="text-sm font-semibold hover:text-sky-300 transition-colors"
              >
                {combinedDisplayName}
              </Link>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                {profileServerId && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-1 border border-slate-700/80">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                    {profileServerId}
                  </span>
                )}

                <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-1 border border-slate-700/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                  HQ:{" "}
                  {hqLevel != null && !isNaN(hqLevel)
                    ? hqLevel
                    : "not set"}
                </span>

                <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-1 border border-slate-700/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Total Hero Power: {formattedTotalHeroPower}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Daily tiles */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* VS Today */}
          <div className="rounded-xl bg-slate-900/80 border border-slate-700/70 px-4 py-4 flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-slate-100">
              {vsToday?.title ?? "VS Today"}
            </h2>

            {!vsToday && (
              <p className="text-xs text-slate-300">
                VS tasks are not configured for today.
              </p>
            )}

            {vsToday && (
              <ul className="mt-1 space-y-1 text-xs text-slate-200">
                {vsToday.tasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                    <span>{task.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Arms Race */}
          <div className="rounded-xl bg-slate-900/80 border border-slate-700/70 px-4 py-4 flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-slate-100">
              {armsRaceToday.title}
            </h2>

            {armsRaceToday.phases.length === 0 && (
              <p className="text-xs text-slate-300">
                {armsRaceToday.reason ??
                  "Arms Race schedule is not configured yet."}
              </p>
            )}

            {armsRaceToday.phases.length > 0 && (
              <ul className="mt-1 space-y-1 text-xs text-slate-200">
                {armsRaceToday.phases.map((phase) => (
                  <li
                    key={phase.id}
                    className={`flex items-center justify-between rounded-md px-2 py-1 ${
                      phase.isCurrent
                        ? "bg-slate-800 border border-sky-500/60"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {phase.isCurrent && (
                        <span className="text-sky-400 text-xs">→</span>
                      )}
                      <span
                        className={
                          phase.isCurrent ? "font-semibold" : ""
                        }
                      >
                        {phase.startLabel} - {phase.endLabel}
                      </span>
                    </div>
                    <span
                      className={phase.isCurrent ? "font-semibold" : ""}
                    >
                      {phase.name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Shiny Tasks */}
          <div className="rounded-xl bg-slate-900/80 border border-slate-700/70 px-4 py-4 flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-slate-100">
              Today&apos;s Shiny Tasks
            </h2>

            {!shinyToday.groupLabel && (
              <p className="text-xs text-slate-300">
                Shiny rotation is not configured.
              </p>
            )}

            {shinyToday.groupLabel && (
              <div className="space-y-1">
                <p className="text-xs text-slate-400">
                  {shinyToday.groupLabel}
                </p>
                {shinyToday.serversDisplay && (
                  <p className="text-xs text-slate-200">
                    {shinyToday.serversDisplay}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Summary chips */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* HQ Requirements */}
          <div className="rounded-xl bg-slate-900/80 border border-slate-700/70 px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                {nextLevel != null
                  ? `HQ ${nextLevel} Requirements`
                  : "HQ Requirements"}
              </p>
              {nextLevel != null && (
                <span className="text-xs text-slate-300">
                  {metCount} / {totalCount}
                </span>
              )}
            </div>

            {hqLevel == null && (
              <p className="text-xs text-slate-400">HQ level not set.</p>
            )}

            {hqLevel != null && nextLevel != null && totalCount === 0 && (
              <p className="text-xs text-slate-400">
                No requirement data found.
              </p>
            )}

            {hqLevel != null && nextLevel != null && totalCount > 0 && (
              <ul className="space-y-1 text-xs">
                {hqRequirementRows.map((req) => (
                  <li
                    key={req.id}
                    className="flex items-center justify-between"
                  >
                    <span>{req.label}</span>
                    <span
                      className={
                        req.met
                          ? "font-medium text-green-500"
                          : "font-medium text-red-500"
                      }
                    >
                      {req.met
                        ? "Met"
                        : `${req.currentLevel} / ${req.requiredLevel}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Research Status */}
          <div className="rounded-xl bg-slate-900/80 border border-slate-700/70 px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">Research Status</p>
            </div>

            {researchStatus.length === 0 && (
              <p className="text-xs text-slate-400">
                No tracked research categories yet.
              </p>
            )}

            {researchStatus.length > 0 && (
              <ul className="mt-1 space-y-1 text-xs text-slate-200">
                {researchStatus.map((item) => (
                  <li
                    key={item.category}
                    className="flex items-center justify-between"
                  >
                    <span>{item.category}</span>
                    <span>{item.percent}%</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Currently Upgrading */}
          <div className="rounded-xl bg-slate-900/80 border border-slate-700/70 px-4 py-3 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">
                  Currently Upgrading
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Includes research in progress and buildings marked as
                  upgrading or with priority.
                </p>
              </div>
            </div>

            {trackedUpgrades.length > 0 && (
              <ul className="mt-1 space-y-1 text-[11px] text-slate-200">
                {trackedUpgrades.slice(0, 4).map((u) => (
                  <li
                    key={`${u.type}-${u.id}`}
                    className="flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <span className="truncate max-w-[11rem] font-medium">
                        {u.name}
                        {u.currentLevel != null &&
                          u.currentLevel > 0 &&
                          u.nextLevel != null && (
                            <span className="ml-1 text-slate-300">
                              {u.currentLevel} {"->"} {u.nextLevel}
                            </span>
                          )}
                      </span>
                    </div>
                    <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 border border-slate-600/80 text-[10px] text-slate-200">
                      {u.type === "research" ? "R" : "B"} · {u.status}
                    </span>
                  </li>
                ))}
                {trackedUpgrades.length > 4 && (
                  <li className="text-[10px] text-slate-400">
                    +{trackedUpgrades.length - 4} more
                  </li>
                )}
              </ul>
            )}

            {trackedUpgrades.length === 0 && (
              <p className="mt-1 text-[11px] text-slate-400">
                Nothing upgrading yet. Start research or mark buildings as
                upgrading or add priority to see them here.
              </p>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Teams section */}
          <section className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">
                Teams
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((team) => {
                const teamHeroes = heroesByTeam[team] ?? [];
                if (teamHeroes.length === 0) return null;

                const heroNames = teamHeroes
                  .map((h) => h.name)
                  .filter(Boolean)
                  .join(", ");

                const inputValue = teamsPower[team] ?? "";

                return (
                  <div
                    key={team}
                    className="relative overflow-hidden rounded-xl border border-slate-700/80 bg-gradient-to-br from-slate-900/90 via-slate-900 to-slate-900/80 px-4 py-4"
                  >
                    <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(129,140,248,0.16),transparent_55%)]" />
                    <div className="relative space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">
                          Team {team}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-slate-300">
                          Team Power
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={inputValue}
                            onChange={(e) =>
                              handleTeamPowerChange(
                                team,
                                e.target.value
                              )
                            }
                            onBlur={() => saveTeamPower(team)}
                            className="w-20 rounded-md bg-slate-950/60 border border-slate-600/80 px-2 py-1 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500/70"
                            placeholder="0.00"
                          />
                          <span className="text-sm text-slate-200">
                            M
                          </span>
                          {savingTeam === team && (
                            <span className="text-xs text-sky-300">
                              saving
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-300">
                        {heroNames || "No heroes"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Next Up section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">
                Next Up
              </h2>
            </div>
            <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 max-h-80 overflow-hidden flex flex-col">
              {trackingItems.length === 0 ? (
                <div className="flex-1 flex items-center justify-center px-4 py-6 text-sm text-slate-400">
                  Nothing on deck yet. Set tracked or priority on research
                  or buildings to see them here.
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80">
                  {trackingItems.map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-900/90"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-100 truncate">
                          {item.name}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium border ${
                          item.type === "research"
                            ? "bg-emerald-900/40 text-emerald-200 border-emerald-500/40"
                            : "bg-sky-900/40 text-sky-200 border-sky-500/40"
                        }`}
                      >
                        {item.type === "research"
                          ? "Research"
                          : "Building"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Quick links */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-100">
            Command Center Links
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <QuickLinkCard
              href="/heroes"
              title="Heroes"
              description="Manage squads, power, and gear."
            />
            <QuickLinkCard
              href="/buildings"
              title="Buildings"
              description="Tune your base and upgrades."
            />
            <QuickLinkCard
              href="/research"
              title="Research"
              description="Plan your research path."
            />
            <QuickLinkCard
              href="/group-dashboard"
              title="Group Dashboard"
              description="View shared stats for 977 and 982."
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function QuickLinkCard(props: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={props.href}
      className="group rounded-xl border border-slate-700/80 bg-slate-900/80 px-4 py-4 flex flex-col justify-between hover:border-sky-500/70 hover:bg-slate-900 transition-colors"
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-50 group-hover:text-sky-200">
          {props.title}
        </h3>
        <p className="text-xs text-slate-300">{props.description}</p>
      </div>
      <div className="mt-3 text-xs text-sky-300 group-hover:text-sky-200">
        Open
      </div>
    </Link>
  );
}
