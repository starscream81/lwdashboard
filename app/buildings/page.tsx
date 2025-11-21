"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  DocumentData,
  getDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { auth, db } from "@/lib/firebase";
import { useLanguage } from "../i18n/LanguageProvider";

type BuildingKvDoc = {
  name?: string;
  level?: number;
};

type BuildingTrackingDoc = {
  id?: string;
  name?: string;
  tracked?: boolean;
  upgrading?: boolean;
  priority?: number;
  orderIndex?: number;
};

type BuildingTracking = {
  id: string;
  name: string;
  tracked: boolean;
  upgrading: boolean;
  priority?: number | null;
  orderIndex?: number | null;
};

type BuildingInstance = {
  id: string;
  instanceLabel: string;
  level: number;
  tracking: BuildingTracking;
  baseGroupKey?: string;
  baseDisplayName?: string;
};

type BuildingGroup = {
  groupKey: string;
  displayName: string;
  instances: BuildingInstance[];
  hasTracked: boolean;
  multiInstance?: boolean;
  maxInstances?: number;
  isSeasonGroup?: boolean;
};

type LevelChangeHandler = (
  groupKey: string,
  instanceId: string,
  newLevel: number
) => void;

type TrackingToggleHandler = (
  groupKey: string,
  instanceId: string,
  field: "tracked" | "upgrading",
  value: boolean
) => void;

type DeleteInstanceHandler = (groupKey: string, instanceId: string) => void;

type BuildingGroupDef = {
  key: string;
  displayName: string;
  multiInstance?: boolean;
  maxInstances?: number;
  seasonGroups?: string[];
};

type Profile = {
  displayName?: string | null;
  alliance?: string | null;
};

const SEASON_1 = "Season 1 Buildings";
const SEASON_2 = "Season 2 Buildings";
const SEASON_3 = "Season 3 Buildings";
const SEASON_4 = "Season 4 Buildings";
const SEASON_5 = "Season 5 Buildings";

const BUILDING_GROUP_DEFS: BuildingGroupDef[] = [
  {
    key: "Air Force Base",
    displayName: "Air Force Base",
    seasonGroups: [SEASON_1, SEASON_2],
  },
  { key: "Alert Tower", displayName: "Alert Tower" },
  { key: "Alliance Center", displayName: "Alliance Center" },
  { key: "Altar", displayName: "Altar", seasonGroups: [SEASON_3] },
  {
    key: "Barracks",
    displayName: "Barracks",
    multiInstance: true,
    maxInstances: 4,
  },
  {
    key: "Blessing Fountain",
    displayName: "Blessing Fountain",
    multiInstance: true,
    maxInstances: 5,
    seasonGroups: [SEASON_3],
  },
  { key: "Builder's Hut", displayName: "Builder's Hut" },
  {
    key: "Caffiene Institute",
    displayName: "Caffiene Institute",
    seasonGroups: [SEASON_5],
  },
  { key: "Chip Lab", displayName: "Chip Lab" },
  {
    key: "Coffee Factory",
    displayName: "Coffee Factory",
    multiInstance: true,
    maxInstances: 5,
    seasonGroups: [SEASON_5],
  },
  { key: "Coin Vault", displayName: "Coin Vault" },
  { key: "Component Factory", displayName: "Component Factory" },
  {
    key: "Curse Research Lab",
    displayName: "Curse Research Lab",
    seasonGroups: [SEASON_3],
  },
  {
    key: "Drill Ground",
    displayName: "Drill Ground",
    multiInstance: true,
    maxInstances: 4,
  },
  {
    key: "Drone Parts Workshop",
    displayName: "Drone Parts Workshop",
  },
  { key: "Emergency Center", displayName: "Emergency Center" },
  {
    key: "Farmland",
    displayName: "Farmland",
    multiInstance: true,
    maxInstances: 5,
  },
  { key: "Food Warehouse", displayName: "Food Warehouse" },
  { key: "Gear Factory", displayName: "Gear Factory" },
  {
    key: "Gold Mine",
    displayName: "Gold Mine",
    multiInstance: true,
    maxInstances: 5,
  },
  { key: "HQ", displayName: "HQ" },
  {
    key: "High-heat Furnace",
    displayName: "High-heat Furnace",
    seasonGroups: [SEASON_2],
  },
  {
    key: "Hospital",
    displayName: "Hospital",
    multiInstance: true,
    maxInstances: 4,
  },
  {
    key: "Iron Mine",
    displayName: "Iron Mine",
    multiInstance: true,
    maxInstances: 5,
  },
  { key: "Iron Warehouse", displayName: "Iron Warehouse" },
  {
    key: "Library",
    displayName: "Library",
    seasonGroups: [SEASON_4],
  },
  { key: "Market", displayName: "Market" },
  {
    key: "Metal Warehouse",
    displayName: "Metal Warehouse",
    multiInstance: true,
    maxInstances: 3,
  },
  {
    key: "Oil Well",
    displayName: "Oil Well",
    multiInstance: true,
    maxInstances: 5,
  },
  {
    key: "Oil Warehouse",
    displayName: "Oil Warehouse",
    multiInstance: true,
    maxInstances: 3,
  },
  {
    key: "Outpost",
    displayName: "Outpost",
    seasonGroups: [SEASON_1, SEASON_2, SEASON_3, SEASON_4, SEASON_5],
  },
  {
    key: "Power Plant",
    displayName: "Power Plant",
    multiInstance: true,
    maxInstances: 3,
  },
  { key: "Radar Station", displayName: "Radar Station" },
  {
    key: "Reactor",
    displayName: "Reactor",
    multiInstance: true,
    maxInstances: 5,
    seasonGroups: [SEASON_4],
  },
  {
    key: "Recon Plane",
    displayName: "Recon Plane",
    multiInstance: true,
    maxInstances: 3,
  },
  {
    key: "Smelter",
    displayName: "Smelter",
    multiInstance: true,
    maxInstances: 5,
  },
  {
    key: "Tank Base",
    displayName: "Tank Base",
    seasonGroups: [SEASON_1, SEASON_2],
  },
  { key: "Tank Center", displayName: "Tank Center" },
  {
    key: "Tanker Bar",
    displayName: "Tanker Bar",
    seasonGroups: [SEASON_5],
  },
  { key: "Tavern", displayName: "Tavern" },
  {
    key: "Tech Center",
    displayName: "Tech Center",
    multiInstance: true,
    maxInstances: 3,
  },
  {
    key: "Technical Institute",
    displayName: "Tactical Institute",
  },
  {
    key: "Titanium Alloy Factory",
    displayName: "Titanium Alloy Factory",
    multiInstance: true,
    maxInstances: 5,
    seasonGroups: [SEASON_2],
  },
  {
    key: "Training Base",
    displayName: "Training Base",
    multiInstance: true,
    maxInstances: 5,
  },
  {
    key: "Virus Research Institute",
    displayName: "Virus Research Institute",
    seasonGroups: [SEASON_1],
  },
  { key: "Wall", displayName: "Wall" },
];

/**
 * Normalize an identifier for comparison:
 *  - lower case
 *  - collapse non alphanumeric into spaces
 *  - trim
 */
function normalizeIdentifier(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Resolve a raw building name to a canonical group key from BUILDING_GROUP_DEFS.
 */
function resolveGroupName(rawName: string): string {
  const trimmed = rawName.trim();
  const normalized = normalizeIdentifier(trimmed);

  for (const def of BUILDING_GROUP_DEFS) {
    const defNorm = normalizeIdentifier(def.key);

    if (normalized === defNorm) {
      return def.key;
    }

    if (
      normalized.startsWith(defNorm + " ") ||
      normalized.startsWith(defNorm)
    ) {
      return def.key;
    }
  }

  const match = trimmed.match(/^(.*?)(?:\s+(\d+))$/);
  if (match && match[1]) {
    return match[1].trim();
  }

  return trimmed;
}

function deriveGroupAndInstance(rawName: string): {
  groupName: string;
  instanceLabel: string;
} {
  const groupName = resolveGroupName(rawName);
  return {
    groupName,
    instanceLabel: rawName.trim(),
  };
}

function buildDefaultTracking(
  id: string,
  groupName: string
): BuildingTracking {
  return {
    id,
    name: groupName,
    tracked: false,
    upgrading: false,
    priority: null,
    orderIndex: null,
  };
}

export default function BuildingsPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [groups, setGroups] = useState<BuildingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(
    null
  );

  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/login");
        setAuthChecked(true);
        return;
      }
      setUser(firebaseUser);
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, [router]);

  // Load profile (currently only used for header in other pages; safe to keep)
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

  useEffect(() => {
    if (!user) {
      return;
    }

    const uid = user.uid;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const kvRef = collection(db, "users", uid, "buildings_kv");
        const trackingRef = collection(
          db,
          "users",
          uid,
          "buildings_tracking"
        );

        const [kvSnap, trackingSnap] = await Promise.all([
          getDocs(kvRef),
          getDocs(trackingRef),
        ]);

        const trackingMap = new Map<string, BuildingTracking>();

        trackingSnap.forEach((docSnap) => {
          const id = docSnap.id;
          const data = docSnap.data() as BuildingTrackingDoc;

          const name = (data.name || id).toString();
          const tracked = Boolean(data.tracked);
          const upgrading = Boolean(data.upgrading);
          const priority =
            typeof data.priority === "number" ? data.priority : null;
          const orderIndex =
            typeof data.orderIndex === "number"
              ? data.orderIndex
              : null;

          trackingMap.set(id, {
            id,
            name,
            tracked,
            upgrading,
            priority,
            orderIndex,
          });
        });

        const coreGroupMap = new Map<string, BuildingGroup>();

        // First pass: existing KV docs -> core building groups
        kvSnap.forEach((docSnap) => {
          const id = docSnap.id;
          const data = docSnap.data() as BuildingKvDoc;

          const baseName =
            (data.name || id).toString().trim() || id.toString();

          const { groupName, instanceLabel } =
            deriveGroupAndInstance(baseName);

          const levelValue =
            typeof data.level === "number" ? data.level : 0;

          const tracking =
            trackingMap.get(id) ||
            buildDefaultTracking(id, groupName);

          const def = BUILDING_GROUP_DEFS.find(
            (entry) => entry.key === groupName
          );

          const existingGroup = coreGroupMap.get(groupName);

          const instance: BuildingInstance = {
            id,
            instanceLabel,
            level: levelValue,
            tracking,
          };

          if (!existingGroup) {
            coreGroupMap.set(groupName, {
              groupKey: groupName,
              displayName: def?.displayName || groupName,
              instances: [instance],
              hasTracked:
                tracking.tracked === true ||
                tracking.upgrading === true,
              multiInstance: def?.multiInstance ?? false,
              maxInstances: def?.maxInstances,
            });
          } else {
            existingGroup.instances.push(instance);
            if (tracking.tracked || tracking.upgrading) {
              existingGroup.hasTracked = true;
            }
            if (def && existingGroup.multiInstance !== def.multiInstance) {
              existingGroup.multiInstance = def.multiInstance;
            }
            if (def && existingGroup.maxInstances !== def.maxInstances) {
              existingGroup.maxInstances = def.maxInstances;
            }
          }
        });

        // Second pass: auto create missing instances per building definition
        for (const def of BUILDING_GROUP_DEFS) {
          const groupKey = def.key;
          const baseLabel = def.displayName;

          let group = coreGroupMap.get(groupKey);
          const existingInstances = group?.instances ?? [];
          const currentCount = existingInstances.length;

          let targetCount: number;
          if (def.multiInstance) {
            targetCount =
              typeof def.maxInstances === "number"
                ? def.maxInstances
                : currentCount;
          } else {
            targetCount = 1;
          }

          if (targetCount < 1) {
            targetCount = currentCount;
          }

          const instancesArray = [...existingInstances];

          if (currentCount < targetCount) {
            const numToCreate = targetCount - currentCount;

            for (let i = 0; i < numToCreate; i++) {
              const index = currentCount + i;
              const instanceLabel =
                def.multiInstance && targetCount > 1
                  ? `${baseLabel} ${index + 1}`
                  : baseLabel;

              const ref = await addDoc(
                collection(db, "users", uid, "buildings_kv"),
                {
                  name: instanceLabel,
                  level: 0,
                }
              );

              const newInstanceId = ref.id;
              const tracking = buildDefaultTracking(
                newInstanceId,
                baseLabel
              );

              instancesArray.push({
                id: newInstanceId,
                instanceLabel,
                level: 0,
                tracking,
              });
            }
          }

          const hasTracked = instancesArray.some(
            (inst) =>
              inst.tracking.tracked || inst.tracking.upgrading
          );

          if (group) {
            group.instances = instancesArray;
            group.displayName = baseLabel;
            group.multiInstance = def.multiInstance;
            group.maxInstances = def.maxInstances;
            group.hasTracked = hasTracked;
          } else {
            coreGroupMap.set(groupKey, {
              groupKey,
              displayName: baseLabel,
              instances: instancesArray,
              hasTracked,
              multiInstance: def.multiInstance,
              maxInstances: def.maxInstances,
            });
          }
        }

        // Strict labeling inside each core building group
        for (const group of coreGroupMap.values()) {
          const def = BUILDING_GROUP_DEFS.find(
            (entry) => entry.key === group.groupKey
          );
          const baseLabel =
            def?.displayName || group.displayName || group.groupKey;

          group.instances.sort((a, b) =>
            a.id.localeCompare(b.id)
          );

          if (group.instances.length === 1 && !group.multiInstance) {
            group.instances[0].instanceLabel = baseLabel;
          } else if (group.instances.length > 0) {
            group.instances.forEach((instance, idx) => {
              if (group.multiInstance) {
                instance.instanceLabel = `${baseLabel} ${idx + 1}`;
              } else {
                instance.instanceLabel = baseLabel;
              }
            });
          }
        }

        // Build UI groups:
        //  - Non-season buildings -> normal tiles
        //  - Season buildings -> grouped under Season 1/2/3/4/5 tiles
        const uiGroupMap = new Map<string, BuildingGroup>();

        for (const coreGroup of coreGroupMap.values()) {
          const def = BUILDING_GROUP_DEFS.find(
            (entry) => entry.key === coreGroup.groupKey
          );
          const seasonGroups = def?.seasonGroups;

          // Non-season: one tile per building type
          if (!seasonGroups || seasonGroups.length === 0) {
            const uiInstances: BuildingInstance[] =
              coreGroup.instances.map((inst) => ({
                ...inst,
                baseGroupKey: coreGroup.groupKey,
                baseDisplayName: coreGroup.displayName,
              }));

            const hasTracked = uiInstances.some(
              (inst) =>
                inst.tracking.tracked ||
                inst.tracking.upgrading
            );

            uiGroupMap.set(coreGroup.groupKey, {
              groupKey: coreGroup.groupKey,
              displayName: coreGroup.displayName,
              instances: uiInstances,
              hasTracked,
              multiInstance: coreGroup.multiInstance,
              maxInstances: coreGroup.maxInstances,
              isSeasonGroup: false,
            });
            continue;
          }

          // Season buildings: contribute to one or more season buckets
          for (const seasonName of seasonGroups) {
            let seasonGroup = uiGroupMap.get(seasonName);
            if (!seasonGroup) {
              seasonGroup = {
                groupKey: seasonName,
                displayName: seasonName,
                instances: [],
                hasTracked: false,
                multiInstance: true,
                maxInstances: undefined,
                isSeasonGroup: true,
              };
              uiGroupMap.set(seasonName, seasonGroup);
            }

            const seasonInstances: BuildingInstance[] =
              coreGroup.instances.map((inst) => ({
                ...inst,
                baseGroupKey: coreGroup.groupKey,
                baseDisplayName: coreGroup.displayName,
              }));

            seasonGroup.instances.push(...seasonInstances);

            if (
              seasonInstances.some(
                (inst) =>
                  inst.tracking.tracked ||
                  inst.tracking.upgrading
              )
            ) {
              seasonGroup.hasTracked = true;
            }
          }
        }

        const builtGroups = Array.from(uiGroupMap.values()).sort(
          (a, b) => a.displayName.localeCompare(b.displayName)
        );

        setGroups(builtGroups);
      } catch (err: unknown) {
        console.error(err);
        setError(t("buildings.error.loadFailed"));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user, t]);

  const selectedGroup = useMemo(
    () =>
      groups.find(
        (group) => group.groupKey === selectedGroupKey
      ) || null,
    [groups, selectedGroupKey]
  );

  const handleLevelChange: LevelChangeHandler = async (
    _groupKey,
    instanceId,
    newLevel
  ) => {
    if (!user) return;
    const safeLevel = Number.isNaN(newLevel) ? 0 : newLevel;

    // Update all appearances of this instance id (in case it shows in multiple season tiles)
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        instances: group.instances.map((instance) =>
          instance.id === instanceId
            ? { ...instance, level: safeLevel }
            : instance
        ),
      }))
    );

    try {
      const ref = doc(
        db,
        "users",
        user.uid,
        "buildings_kv",
        instanceId
      );
      await setDoc(
        ref,
        { level: safeLevel },
        { merge: true }
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleTrackingToggle: TrackingToggleHandler = async (
    _groupKey,
    instanceId,
    field,
    value
  ) => {
    if (!user) return;

    // Find the instance so we know its base display name
    const owningGroup = groups.find((group) =>
      group.instances.some((inst) => inst.id === instanceId)
    );
    const targetInstance = owningGroup?.instances.find(
      (inst) => inst.id === instanceId
    );

    const baseDisplayName =
      targetInstance?.baseDisplayName ||
      owningGroup?.displayName ||
      _groupKey;

    const baseTracking: BuildingTracking =
      targetInstance?.tracking ??
      buildDefaultTracking(instanceId, baseDisplayName);

    const updatedTracking: BuildingTracking = {
      ...baseTracking,
      [field]: value,
    };

    setGroups((prev) =>
      prev.map((group) => {
        const updatedInstances = group.instances.map((instance) =>
          instance.id === instanceId
            ? { ...instance, tracking: updatedTracking }
            : instance
        );

        const hasTracked = updatedInstances.some(
          (inst) =>
            inst.tracking.tracked ||
            inst.tracking.upgrading
        );

        return {
          ...group,
          instances: updatedInstances,
          hasTracked,
        };
      })
    );

    try {
      const ref = doc(
        db,
        "users",
        user.uid,
        "buildings_tracking",
        instanceId
      );

      const payload: DocumentData = {
        id: instanceId,
        name: baseDisplayName,
        tracked: updatedTracking.tracked,
        upgrading: updatedTracking.upgrading,
      };

      if (
        typeof updatedTracking.priority === "number" ||
        updatedTracking.priority === null
      ) {
        payload.priority = updatedTracking.priority;
      }
      if (
        typeof updatedTracking.orderIndex === "number" ||
        updatedTracking.orderIndex === null
      ) {
        payload.orderIndex = updatedTracking.orderIndex;
      }

      await setDoc(ref, payload, { merge: true });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteInstance: DeleteInstanceHandler = async (
    _groupKey,
    instanceId
  ) => {
    if (!user) return;

    const confirmed = window.confirm(
      t("buildings.detail.deleteConfirm")
    );
    if (!confirmed) return;

    setGroups((prev) =>
      prev.map((group) => {
        const updatedInstances = group.instances.filter(
          (inst) => inst.id !== instanceId
        );
        const hasTracked = updatedInstances.some(
          (inst) =>
            inst.tracking.tracked ||
            inst.tracking.upgrading
        );
        return {
          ...group,
          instances: updatedInstances,
          hasTracked,
        };
      })
    );

    try {
      const kvRef = doc(
        db,
        "users",
        user.uid,
        "buildings_kv",
        instanceId
      );
      const trackingRef = doc(
        db,
        "users",
        user.uid,
        "buildings_tracking",
        instanceId
      );

      await Promise.all([
        deleteDoc(kvRef),
        deleteDoc(trackingRef).catch(() => {}),
      ]);
    } catch (err) {
      console.error(err);
    }
  };

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-sm text-slate-400">
          {t("common.loading")}
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-sm text-slate-400">
            {t("auth.loginRequired.message")}
          </p>
          <Link
            href="/login"
            className="inline-flex items-center rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
          >
            {t("auth.loginRequired.goToLogin")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <section className="mb-6 space-y-1">
          <h1 className="text-2xl font-semibold text-slate-50">
            {t("buildings.title")}
          </h1>
          <p className="text-sm text-slate-400">
            {t("buildings.subtitle")}
          </p>
        </section>

        {loading && (
          <div className="mt-10 flex justify-center">
            <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300">
              {t("buildings.loading")}
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="mt-10 flex justify-center">
            <div className="rounded-xl border border-rose-700/70 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          </div>
        )}

        {!loading && !error && groups.length === 0 && (
          <div className="mt-10 flex justify-center">
            <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300">
              {t("buildings.empty.none")}
            </div>
          </div>
        )}

        {!loading && !error && groups.length > 0 && (
          <section className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((group) => (
                <BuildingCard
                  key={group.groupKey}
                  group={group}
                  onClick={() =>
                    setSelectedGroupKey(group.groupKey)
                  }
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {selectedGroup && (
        <BuildingDetailPanel
          group={selectedGroup}
          onClose={() => setSelectedGroupKey(null)}
          onLevelChange={handleLevelChange}
          onTrackingToggle={handleTrackingToggle}
          onDeleteInstance={handleDeleteInstance}
        />
      )}
    </main>
  );
}

type BuildingCardProps = {
  group: BuildingGroup;
  onClick: () => void;
};

function BuildingCard({ group, onClick }: BuildingCardProps) {
  const { t } = useLanguage();
  const hasInstances = group.instances.length > 0;
  const levels = group.instances
    .map((instance) => instance.level)
    .filter((level) => typeof level === "number");
  const levelsText =
    levels.length > 0
      ? levels.join(", ")
      : t("buildings.card.levels.none");

  const anyUpgrading = group.instances.some(
    (instance) => instance.tracking.upgrading
  );
  const anyTracked = group.instances.some(
    (instance) => instance.tracking.tracked
  );

  const multiple =
    group.instances.length > 1 || group.isSeasonGroup;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full flex-col rounded-2xl border border-slate-800/80 bg-slate-900/80 p-4 text-left shadow-sm transition hover:border-indigo-500/80 hover:bg-slate-900 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500/70"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-50">
            {group.displayName}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {hasInstances
              ? multiple
                ? t("buildings.card.entries", {
                    count: group.instances.length,
                  })
                : t("buildings.card.singleInstance")
              : t("buildings.card.noneCreated")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {anyTracked && (
            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-500/40">
              {t("buildings.status.tracked")}
            </span>
          )}
          {anyUpgrading && (
            <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-500/40">
              {t("buildings.status.upgrading")}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-300">
        <span className="text-slate-400">
          {group.isSeasonGroup
            ? t("buildings.card.seasonLevels")
            : t("buildings.card.levels")}
        </span>
        <span className="font-medium text-slate-100">
          {hasInstances ? levelsText : t("buildings.card.levels.none")}
        </span>
      </div>

      <div className="mt-3 text-[11px] text-slate-500">
        {group.isSeasonGroup
          ? t("buildings.card.hint.season")
          : t("buildings.card.hint.normal")}
      </div>
    </button>
  );
}

type BuildingDetailPanelProps = {
  group: BuildingGroup;
  onClose: () => void;
  onLevelChange: LevelChangeHandler;
  onTrackingToggle: TrackingToggleHandler;
  onDeleteInstance: DeleteInstanceHandler;
};

function BuildingDetailPanel({
  group,
  onClose,
  onLevelChange,
  onTrackingToggle,
  onDeleteInstance,
}: BuildingDetailPanelProps) {
  const { t } = useLanguage();
  const hasInstances = group.instances.length > 0;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-950/95 px-4 py-6 shadow-xl backdrop-blur">
        <header className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">
              {group.displayName}
            </h2>
            <p className="text-xs text-slate-400">
              {group.isSeasonGroup
                ? t("buildings.detail.header.season")
                : t("buildings.detail.header.normal")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <span className="text-sm">✕</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pb-6">
          {hasInstances ? (
            <>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70">
                <div className="grid grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)] gap-3 border-b border-slate-800 px-4 py-3 text-[11px] font-semibold text-slate-400">
                  <div>
                    {group.isSeasonGroup
                      ? t(
                          "buildings.detail.table.instanceSeason"
                        )
                      : t("buildings.detail.table.instance")}
                  </div>
                  <div className="text-center">
                    {t("buildings.detail.table.level")}
                  </div>
                  <div className="text-center">
                    {t("buildings.detail.table.tracked")}
                  </div>
                  <div className="text-center">
                    {t("buildings.detail.table.upgrading")}
                  </div>
                  <div className="text-center">
                    {t("buildings.detail.table.delete")}
                  </div>
                </div>

                {group.instances.map((instance) => (
                  <div
                    key={instance.id}
                    className="grid grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)] items-center gap-3 border-t border-slate-900 px-4 py-3 text-xs text-slate-100"
                  >
                    <div className="pr-2">
                      <div className="font-medium text-slate-50">
                        {group.isSeasonGroup &&
                        instance.baseDisplayName
                          ? `${instance.baseDisplayName} — ${instance.instanceLabel}`
                          : instance.instanceLabel}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {t("buildings.detail.instance.docId", {
                          id: instance.id,
                        })}
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <input
                        type="number"
                        className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none ring-indigo-500/60 focus:border-indigo-500 focus:ring-1"
                        value={
                          Number.isFinite(instance.level)
                            ? instance.level
                            : ""
                        }
                        onChange={(event) => {
                          const value = parseInt(
                            event.target.value,
                            10
                          );
                          const levelValue = Number.isNaN(value)
                            ? 0
                            : value;
                          onLevelChange(
                            group.groupKey,
                            instance.id,
                            levelValue
                          );
                        }}
                      />
                    </div>

                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                        checked={instance.tracking.tracked}
                        onChange={(event) =>
                          onTrackingToggle(
                            group.groupKey,
                            instance.id,
                            "tracked",
                            event.target.checked
                          )
                        }
                      />
                    </div>

                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                        checked={instance.tracking.upgrading}
                        onChange={(event) =>
                          onTrackingToggle(
                            group.groupKey,
                            instance.id,
                            "upgrading",
                            event.target.checked
                          )
                        }
                      />
                    </div>

                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() =>
                          onDeleteInstance(
                            group.groupKey,
                            instance.id
                          )
                        }
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-700/60 text-[11px] text-rose-200 hover:bg-rose-900/60"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-[11px] text-slate-500">
                {t("buildings.detail.footer.hint")}
              </p>
            </>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4 text-xs text-slate-200">
              <p>{t("buildings.detail.empty")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
