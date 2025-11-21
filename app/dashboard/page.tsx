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
import { useLanguage } from "../i18n/LanguageProvider";

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

type ArmsRaceReasonCode =
  | "noServerConfigured"
  | "noDayForServer"
  | "noPhasesToday"
  | "notConfigured";

type ArmsRaceToday = {
  phases: ArmsRacePhaseDisplay[];
  reasonCode: ArmsRaceReasonCode | null;
};

type ShinyRotationConfig = {
  rotationOrder: string[];
  currentGroup: string;
  groups: Record<string, number[]>;
};

type ShinyToday = {
  groupKey: string | null;
  serversDisplay: string | null;
};

type ResearchStatusCategory = {
  category: string;
  percent: number;
};

type UpgradeStatus = "inProgress" | "priority" | "tracked" | "upgrading";

type UpgradeSummary = {
  id: string;
  name: string;
  type: "research" | "building";
  status: UpgradeStatus;
  priority?: number | null;
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
  type?: "research" | "building";
  priority?: number | null;
  orderIndex?: number | null;
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

// Anchor for Shiny rotation
const SHINY_ROTATION_ANCHOR = {
  date: "2025-11-14",
  group: "C",
};

const ARMS_RACE_ANCHOR = {
  // server calendar date when server_arms_race_state.json was generated
  date: "2025-11-14",
};

// Server time helper (GMT minus 2)
const SERVER_UTC_OFFSET_HOURS = -2;

function getServerDate(): Date {
  const now = new Date();
  const serverMillis =
    now.getTime() + SERVER_UTC_OFFSET_HOURS * 60 * 60 * 1000;
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

// Convert server time "HH:MM" to local display string
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

function normalizeBuildingKey(name: string): string {
  return name.trim().toLowerCase();
}

function getMaxLevelForGroup(
  group: HqRequirementGroup,
  buildingLevels: BuildingLevelsMap
): number {
  // Build a set of normalized search tokens:
  //   - the group label
  //   - each building name listed in the group
  const searchTokens = new Set<string>();

  searchTokens.add(normalizeBuildingKey(group.label));

  if (Array.isArray(group.buildings)) {
    for (const name of group.buildings) {
      if (!name) continue;
      searchTokens.add(normalizeBuildingKey(name));
    }
  }

  let currentLevel = 0;

  // Scan all building level entries and take the max level
  // for any key that contains at least one of the tokens.
  for (const [rawKey, level] of Object.entries(buildingLevels)) {
    const key = normalizeBuildingKey(rawKey);

    for (const token of searchTokens) {
      if (!token) continue;

      if (key.includes(token)) {
        if (level > currentLevel) {
          currentLevel = level;
        }
        // No need to check other tokens for this key
        break;
      }
    }
  }

  return currentLevel;
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

    const currentLevel = getMaxLevelForGroup(group, buildingLevels);
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
  const { t } = useLanguage();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hqLevel, setHqLevel] = useState<number | null>(null);
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [teamsPower, setTeamsPower] = useState<TeamsPower>({});
  const [trackingItems, setTrackingItems] = useState<TrackingItem[]>([]);
  const [trackedCount, setTrackedCount] = useState<number>(0);
  const [trackedUpgrades, setTrackedUpgrades] = useState<UpgradeSummary[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [savingTeam, setSavingTeam] = useState<number | null>(null);
  const [buildingLevels, setBuildingLevels] = useState<BuildingLevelsMap>({});
  const [researchStatus, setResearchStatus] = useState<
    ResearchStatusCategory[]
  >([]);

  const isGuest = user?.isAnonymous ?? false;

  const profileAlliance = isGuest
    ? t("profile.alliance.guestTag")
    : (profile as any)?.alliance != null &&
      (profile as any)?.alliance !== ""
    ? String((profile as any).alliance)
    : null;

  const baseDisplayName = isGuest
    ? t("profile.role.guestCommander")
    : profile?.displayName ?? t("profile.role.commander");

  const combinedDisplayNameWithAlliance = profileAlliance
    ? `${baseDisplayName} [${profileAlliance}]`
    : baseDisplayName;

  const combinedDisplayName = isGuest
    ? `${combinedDisplayNameWithAlliance} ${t("profile.badge.guestSuffix")}`
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

        // All building levels from buildings_kv
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

          const name = (data.name || docSnap.id || "").toString().trim();

          if (name) {
            levels[normalizeBuildingKey(name)] = level;
          }

          levels[normalizeBuildingKey(docSnap.id)] = level;
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
            orderIndex:
              data.orderIndex != null ? Number(data.orderIndex) : null,
          };
        });

        // Research Status tile
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

        // Research upgrades
        const trackedResearchUpgrades = researchRows.filter((row) => {
          if (row.inProgress) return true;
          if (row.priority != null && row.priority > 0) return true;
          return false;
        });

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

        const trackedBuildingUpgrades = buildingRows.filter((row) => {
          if (row.upgrading) return true;
          if (row.priority != null && row.priority > 0) return true;
          return false;
        });

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

            const status: UpgradeStatus = row.inProgress
              ? "inProgress"
              : row.priority != null && row.priority > 0
              ? "priority"
              : "tracked";

            return {
              id: row.id,
              name: row.name,
              type: "research",
              status,
              priority: row.priority,
              currentLevel,
              nextLevel,
            };
          });

        const buildingSummaries: UpgradeSummary[] =
          trackedBuildingUpgrades.map((row) => {
            const key = normalizeBuildingKey(row.name);
            const currentLevel =
              levels[key] != null ? levels[key] : 0;
            const nextLevel =
              currentLevel > 0 ? currentLevel + 1 : null;

            const status: UpgradeStatus = row.upgrading
              ? "upgrading"
              : row.priority != null && row.priority > 0
              ? "priority"
              : "tracked";

            return {
              id: row.id,
              name: row.name,
              type: "building",
              status,
              priority: row.priority,
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
  }, [user, t]);

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
        phases: [],
        reasonCode: "noServerConfigured",
      };
    }

    const serversMap = stateJson.servers ?? {};
    const rawEntry = serversMap[String(serverId)];

    if (rawEntry == null) {
      console.log("[ArmsRaceDebug] no entry for server", {
        serverId,
        serversMap,
      });
      return {
        phases: [],
        reasonCode: "noDayForServer",
      };
    }

    let baseDayNumber: number | null = null;

    if (typeof rawEntry === "number") {
      baseDayNumber = rawEntry;
    } else if (typeof rawEntry === "string") {
      const parsed = Number(rawEntry);
      if (!isNaN(parsed)) baseDayNumber = parsed;
    } else if (typeof rawEntry === "object" && rawEntry !== null) {
      const possibleKeys = ["day", "currentDay", "dayNumber", "index"];
      for (const key of possibleKeys) {
        const value = (rawEntry as any)[key];
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
      console.log("[ArmsRaceDebug] could not resolve baseDayNumber", {
        serverId,
        rawEntry,
      });
      return {
        phases: [],
        reasonCode: "noDayForServer",
      };
    }

    const cycleLength =
      typeof scheduleJson.cycleLengthDays === "number"
        ? scheduleJson.cycleLengthDays
        : typeof stateJson.cycleLengthDays === "number"
        ? stateJson.cycleLengthDays
        : 7;

    let activeDayNumber = baseDayNumber;

    if (cycleLength > 0 && ARMS_RACE_ANCHOR.date) {
      const serverDayNumberToday = getServerDayNumber();
      const anchorDayNumber = getDayNumberFromDateString(
        ARMS_RACE_ANCHOR.date
      );
      const diffDays = serverDayNumberToday - anchorDayNumber;

      const baseIndex = baseDayNumber - 1;
      const adjustedIndexRaw = baseIndex + diffDays;

      const adjustedIndex =
        ((adjustedIndexRaw % cycleLength) + cycleLength) % cycleLength;

      activeDayNumber = adjustedIndex + 1;
    }

    const allDays: any[] = Array.isArray(scheduleJson.days)
      ? scheduleJson.days
      : [];

    let dayConfig: any =
      allDays.find((d) => d && d.dayNumber === activeDayNumber) ?? null;

    if (!dayConfig && allDays.length > 0) {
      const index = Math.max(
        0,
        Math.min(allDays.length - 1, activeDayNumber - 1)
      );
      dayConfig = allDays[index];
    }

    if (!dayConfig || !Array.isArray(dayConfig.phases)) {
      console.log("[ArmsRaceDebug] no phases for active day", {
        serverId,
        baseDayNumber,
        activeDayNumber,
        dayConfig,
      });
      return {
        phases: [],
        reasonCode: "noPhasesToday",
      };
    }

    const serverNow = getServerDate();
    const currentMinutes =
      serverNow.getUTCHours() * 60 + serverNow.getUTCMinutes();

    const phases: ArmsRacePhaseDisplay[] = dayConfig.phases.map(
      (phase: any, index: number) => {
        const id = String(phase.id ?? index);
        const name = String(
          phase.label ?? phase.name ?? `Phase ${index + 1}`
        );

        const startServerTime = String(
          phase.startServer ?? phase.startTime ?? phase.start ?? "00:00"
        );
        const endServerTime = String(
          phase.endServer ?? phase.endTime ?? phase.end ?? "23:59"
        );

        const startLabel = convertServerTimeToLocal(startServerTime);
        const endLabel = convertServerTimeToLocal(endServerTime);

        const [shhStr, smmStr] = startServerTime.split(":");
        const [ehhStr, emmStr] = endServerTime.split(":");
        const shh = Number(shhStr);
        const smm = Number(smmStr);
        const ehh = Number(ehhStr);
        const emm = Number(emmStr);

        let isCurrent = false;

        if (
          !isNaN(shh) &&
          !isNaN(smm) &&
          !isNaN(ehh) &&
          !isNaN(emm)
        ) {
          const startMinutes = shh * 60 + smm;
          const endMinutes = ehh * 60 + emm;

          if (startMinutes <= endMinutes) {
            isCurrent =
              currentMinutes >= startMinutes &&
              currentMinutes <= endMinutes;
          } else {
            isCurrent =
              currentMinutes >= startMinutes ||
              currentMinutes <= endMinutes;
          }
        }

        return {
          id,
          name,
          startLabel,
          endLabel,
          isCurrent,
        };
      }
    );

    return {
      phases,
      reasonCode: phases.length === 0 ? "noPhasesToday" : null,
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
        groupKey: null,
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
        groupKey,
        serversDisplay: null,
      };
    }

    return {
      groupKey,
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

  const getUpgradeStatusLabel = (u: UpgradeSummary) => {
    switch (u.status) {
      case "inProgress":
        return t("status.upgrade.inProgress");
      case "upgrading":
        return t("status.upgrade.upgrading");
      case "priority":
        return t("status.upgrade.priority", {
          priority: u.priority ?? "",
        });
      default:
        return t("status.upgrade.tracked");
    }
  };

  if (!user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-50">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("app.name")}
        </h1>

        <p className="mt-3 text-sm text-slate-300">
          {t("auth.loginRequired.message")}
        </p>

        <Link
          href="/login"
          className="mt-6 inline-flex items-center rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 shadow"
        >
          {t("auth.loginRequired.cta")}
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">

      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Dashboard title and overlapping profile card */}
        <section className="pt-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-xl space-y-2">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                {t("dashboard.title")}
              </h1>
              <p className="text-sm text-slate-300">
                {t("dashboard.subtitle")}
              </p>
            </div>

            <div className="mt-4 md:mt-0 flex justify-end md:justify-between md:min-w-[260px]">
              <div className="relative md:-translate-y-10">
                <div className="flex itemsCenter gap-3 rounded-xl bg-slate-900/80 px-4 py-3 border border-slate-700/70 shadow-lg shadow-slate-900/80">
                  <div className="relative">
                    {profile?.avatarUrl ? (
                      <img
                        src={profile.avatarUrl}
                        alt={
                          profile.displayName ??
                          t("profile.avatar.alt")
                        }
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
                        {t("profile.badge.hq.label")}:{" "}
                        {hqLevel != null && !isNaN(hqLevel)
                          ? hqLevel
                          : t("profile.badge.hq.notSet")}
                      </span>

                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-1 border border-slate-700/80">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {t("profile.badge.totalHeroPower")}:{" "}
                        {formattedTotalHeroPower}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Daily tiles */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* VS Today */}
          <div className="rounded-xl bg-slate-900/80 border border-slate-700/70 px-4 py-4 flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-slate-100">
              {vsToday?.title ?? t("tiles.vsToday.title")}
            </h2>

            {!vsToday && (
              <p className="text-xs text-slate-300">
                {t("tiles.vsToday.empty")}
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
              {t("tiles.armsRace.title")}
            </h2>

            {armsRaceToday.phases.length === 0 && (
              <p className="text-xs text-slate-300">
                {armsRaceToday.reasonCode
                  ? t(
                      `tiles.armsRace.reason.${armsRaceToday.reasonCode}`,
                      { serverId: profileServerId ?? "" }
                    )
                  : t("tiles.armsRace.reason.notConfigured")}
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
              {t("tiles.shinyTasks.title")}
            </h2>

            {!shinyToday.groupKey && (
              <p className="text-xs text-slate-300">
                {t("tiles.shinyTasks.notConfigured")}
              </p>
            )}

            {shinyToday.groupKey && (
              <div className="space-y-1">
                <p className="text-xs text-slate-400">
                  {t("tiles.shinyTasks.groupLabel", {
                    groupKey: shinyToday.groupKey,
                  })}
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

        {/* HQ Requirements */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-900/80 border border-slate-700/70 px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                {nextLevel != null
                  ? t("tiles.hqRequirements.title", {
                      level: nextLevel,
                    })
                  : t("tiles.hqRequirements.titleFallback")}
              </p>
              {nextLevel != null && (
                <span className="text-xs text-slate-300">
                  {metCount} / {totalCount}
                </span>
              )}
            </div>

            {hqLevel == null && (
              <p className="text-xs text-slate-400">
                {t("tiles.hqRequirements.hqNotSet")}
              </p>
            )}

            {hqLevel != null &&
              nextLevel != null &&
              totalCount === 0 && (
                <p className="text-xs text-slate-400">
                  {t("tiles.hqRequirements.noData")}
                </p>
              )}

            {hqLevel != null &&
              nextLevel != null &&
              totalCount > 0 && (
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
                          ? t("tiles.hqRequirements.metLabel")
                          : t("tiles.hqRequirements.progress", {
                              current: req.currentLevel,
                              required: req.requiredLevel,
                            })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
          </div>

          {/* Research Status */}
          <div className="rounded-xl bg-slate-900/80 border border-slate-700/70 px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                {t("tiles.researchStatus.title")}
              </p>
            </div>

            {researchStatus.length === 0 && (
              <p className="text-xs text-slate-400">
                {t("tiles.researchStatus.empty")}
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
                  {t("tiles.currentlyUpgrading.title")}
                </p>
                <p className="text-[11px] text-slate-400 mt-1" />
              </div>
            </div>

            {trackedUpgrades.length > 0 && (
              <ul className="mt-1 space-y-1 text-[11px] text-slate-200">
                {trackedUpgrades.slice(0, 7).map((u) => (
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
                      {u.type === "research"
                        ? t("status.research.short")
                        : t("status.building.short")}
                      {" · "}
                      {getUpgradeStatusLabel(u)}
                    </span>
                  </li>
                ))}
                {trackedUpgrades.length > 7 && (
                  <li className="text-[10px] text-slate-400">
                    {t("tiles.currentlyUpgrading.more", {
                      count: trackedUpgrades.length - 4,
                    })}
                  </li>
                )}
              </ul>
            )}

            {trackedUpgrades.length === 0 && (
              <p className="mt-1 text-[11px] text-slate-400">
                {t("tiles.currentlyUpgrading.empty")}
              </p>
            )}
          </div>
        </section>

        {/* Teams and Next Up */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Teams section */}
          <section className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">
                {t("teams.sectionTitle")}
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
                          {t("teams.card.title", { number: team })}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-slate-300">
                          {t("teams.card.powerLabel")}
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
                            placeholder={t(
                              "teams.card.powerPlaceholder"
                            )}
                          />
                          <span className="text-sm text-slate-200">
                            {t("teams.card.powerUnitMillions")}
                          </span>
                          {savingTeam === team && (
                            <span className="text-xs text-sky-300">
                              {t("teams.card.saving")}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-300">
                        {heroNames || t("teams.card.noHeroes")}
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
                {t("nextUp.sectionTitle")}
              </h2>
            </div>
            <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 max-h-80 overflow-hidden flex flex-col">
              {trackingItems.length === 0 ? (
                <div className="flex-1 flex items-center justify-center px-4 py-6 text-sm text-slate-400">
                  {t("nextUp.empty")}
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
                          ? t("nextUp.badge.research")
                          : t("nextUp.badge.building")}
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
            {t("links.sectionTitle")}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <QuickLinkCard
              href="/heroes"
              title={t("links.heroes.title")}
              description={t("links.heroes.description")}
              openLabel={t("links.card.open")}
            />
            <QuickLinkCard
              href="/buildings"
              title={t("links.buildings.title")}
              description={t("links.buildings.description")}
              openLabel={t("links.card.open")}
            />
            <QuickLinkCard
              href="/research"
              title={t("links.research.title")}
              description={t("links.research.description")}
              openLabel={t("links.card.open")}
            />
            <QuickLinkCard
              href="/compare"
              title={t("links.compareCenter.title")}
              description={t("links.compareCenter.description")}
              openLabel={t("links.card.open")}
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
  openLabel: string;
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
        {props.openLabel}
      </div>
    </Link>
  );
}
