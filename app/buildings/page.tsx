"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  setDoc,
  DocumentData,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { auth, db } from "@/lib/firebase";

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
};

type BuildingGroup = {
  groupKey: string;
  displayName: string;
  instances: BuildingInstance[];
  hasTracked: boolean;
  multiInstance?: boolean;
  maxInstances?: number;
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

type AddInstanceHandler = (groupKey: string) => void;

type BuildingGroupDef = {
  key: string;
  displayName: string;
  multiInstance?: boolean;
  maxInstances?: number;
};

const BUILDING_GROUP_DEFS: BuildingGroupDef[] = [
  { key: "Aircraft Center", displayName: "Aircraft Center" },
  { key: "Alert Tower", displayName: "Alert Tower" },
  { key: "Alliance Center", displayName: "Alliance Center" },
  {
    key: "Barracks",
    displayName: "Barracks",
    multiInstance: true,
    maxInstances: 4,
  },
  { key: "Builder's Hut", displayName: "Builder's Hut" },
  { key: "Chip Lab", displayName: "Chip Lab" },
  { key: "Coin Vault", displayName: "Coin Vault" },
  { key: "Component Factory", displayName: "Component Factory" },
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
    key: "Material Workshop",
    displayName: "Material Workshop",
    multiInstance: true,
    maxInstances: 5,
  },
  { key: "Missile Center", displayName: "Missile Center" },
  {
    key: "Oil Well",
    displayName: "Oil Well",
    multiInstance: true,
    maxInstances: 5,
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
  { key: "Tank Center", displayName: "Tank Center" },
  { key: "Tavern", displayName: "Tavern" },
  {
    key: "Tech Center",
    displayName: "Tech Center",
    multiInstance: true,
    maxInstances: 3,
  },
  {
    key: "Technical Institute",
    displayName: "Technical Institute",
  },
  {
    key: "Training Base",
    displayName: "Training Base",
    multiInstance: true,
    maxInstances: 5,
  },
  { key: "Wall", displayName: "Wall" },
];

function deriveGroupAndInstance(rawName: string): {
  groupName: string;
  instanceLabel: string;
} {
  const trimmed = rawName.trim();

  const match = trimmed.match(/^(.*?)(?:\s+(\d+))$/);
  if (match && match[1]) {
    const groupName = match[1].trim();
    return {
      groupName,
      instanceLabel: trimmed,
    };
  }

  return {
    groupName: trimmed,
    instanceLabel: trimmed,
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
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [groups, setGroups] = useState<BuildingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(
    null
  );

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

        const groupMap = new Map<string, BuildingGroup>();

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

          const existingGroup = groupMap.get(groupName);

          const instance: BuildingInstance = {
            id,
            instanceLabel,
            level: levelValue,
            tracking,
          };

          if (!existingGroup) {
            groupMap.set(groupName, {
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

        for (const def of BUILDING_GROUP_DEFS) {
          const existing = groupMap.get(def.key);
          if (existing) {
            existing.displayName = def.displayName;
            existing.multiInstance = def.multiInstance;
            existing.maxInstances = def.maxInstances;
          } else {
            groupMap.set(def.key, {
              groupKey: def.key,
              displayName: def.displayName,
              instances: [],
              hasTracked: false,
              multiInstance: def.multiInstance,
              maxInstances: def.maxInstances,
            });
          }
        }

        const builtGroups = Array.from(groupMap.values()).sort((a, b) =>
          a.displayName.localeCompare(b.displayName)
        );

        setGroups(builtGroups);
      } catch (err: unknown) {
        console.error(err);
        setError("Something went wrong while loading buildings.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user]);

  const selectedGroup = useMemo(
    () =>
      groups.find(
        (group) => group.groupKey === selectedGroupKey
      ) || null,
    [groups, selectedGroupKey]
  );

  const handleLevelChange: LevelChangeHandler = async (
    groupKey,
    instanceId,
    newLevel
  ) => {
    if (!user) return;
    const safeLevel = Number.isNaN(newLevel) ? 0 : newLevel;

    setGroups((prev) =>
      prev.map((group) => {
        if (group.groupKey !== groupKey) return group;
        return {
          ...group,
          instances: group.instances.map((instance) =>
            instance.id === instanceId
              ? { ...instance, level: safeLevel }
              : instance
          ),
        };
      })
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
    groupKey,
    instanceId,
    field,
    value
  ) => {
    if (!user) return;

    // Find the current group and instance so we can compute the new tracking state once
    const currentGroup = groups.find(
      (g) => g.groupKey === groupKey
    );
    if (!currentGroup) return;

    const currentInstance = currentGroup.instances.find(
      (i) => i.id === instanceId
    );
    const baseTracking: BuildingTracking =
      currentInstance?.tracking ??
      buildDefaultTracking(instanceId, currentGroup.displayName);

    const updatedTracking: BuildingTracking = {
      ...baseTracking,
      [field]: value,
    };

    // Update local state using the computed tracking
    setGroups((prev) =>
      prev.map((group) => {
        if (group.groupKey !== groupKey) return group;

        const updatedInstances = group.instances.map((instance) => {
          if (instance.id !== instanceId) return instance;
          return {
            ...instance,
            tracking: updatedTracking,
          };
        });

        const hasTracked = updatedInstances.some(
          (instance) =>
            instance.tracking.tracked ||
            instance.tracking.upgrading
        );

        return {
          ...group,
          instances: updatedInstances,
          hasTracked,
        };
      })
    );

    // Persist to Firestore
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
        name: currentGroup.displayName,
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

  const handleAddInstance: AddInstanceHandler = async (groupKey) => {
    if (!user) return;

    const group = groups.find((entry) => entry.groupKey === groupKey);
    if (!group) return;

    if (!group.multiInstance && group.instances.length > 0) {
      return;
    }

    if (
      group.maxInstances != null &&
      group.instances.length >= group.maxInstances
    ) {
      return;
    }

    const baseName = group.displayName;
    const index = group.instances.length;
    const instanceLabel =
      !group.multiInstance || index === 0
        ? baseName
        : `${baseName} ${index + 1}`;

    try {
      const ref = await addDoc(
        collection(db, "users", user.uid, "buildings_kv"),
        {
          name: instanceLabel,
          level: 0,
        }
      );

      const newInstanceId = ref.id;
      const tracking = buildDefaultTracking(
        newInstanceId,
        group.displayName
      );

      setGroups((prev) =>
        prev.map((entry) => {
          if (entry.groupKey !== groupKey) return entry;

          return {
            ...entry,
            instances: [
              ...entry.instances,
              {
                id: newInstanceId,
                instanceLabel,
                level: 0,
                tracking,
              },
            ],
          };
        })
      );
    } catch (err) {
      console.error(err);
    }
  };

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-sm text-slate-400">
          Checking authentication…
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-sm text-slate-400">
            You need to be signed in to view your buildings.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
          >
            Go to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-50">
              Buildings
            </h1>
            <p className="text-sm text-slate-400">
              Manage building levels and tracking flags that feed your
              command center dashboard.
            </p>
          </div>
          <Link
            href="/"
            className="mt-2 inline-flex items-center justify-center rounded-xl border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 sm:mt-0"
          >
            Back to dashboard
          </Link>
        </header>

        {loading && (
          <div className="mt-10 flex justify-center">
            <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300">
              Loading buildings…
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
              No buildings found yet. Add some building data to see it
              here.
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
          onAddInstance={handleAddInstance}
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
  const hasInstances = group.instances.length > 0;
  const levels = group.instances
    .map((instance) => instance.level)
    .filter((level) => typeof level === "number");
  const levelsText =
    levels.length > 0 ? levels.join(", ") : "none yet";

  const anyUpgrading = group.instances.some(
    (instance) => instance.tracking.upgrading
  );
  const anyTracked = group.instances.some(
    (instance) => instance.tracking.tracked
  );

  const multiple =
    group.instances.length > 1 ||
    (!!group.multiInstance && group.instances.length > 0);

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
                ? `Instances: ${group.instances.length}`
                : "Single instance"
              : "No buildings created yet"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {anyTracked && (
            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-500/40">
              Tracked
            </span>
          )}
          {anyUpgrading && (
            <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-500/40">
              Upgrading
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-300">
        <span className="text-slate-400">Levels</span>
        <span className="font-medium text-slate-100">
          {hasInstances ? levelsText : "none"}
        </span>
      </div>

      <div className="mt-3 text-[11px] text-slate-500">
        Click to edit levels and tracking for this building group.
      </div>
    </button>
  );
}

type BuildingDetailPanelProps = {
  group: BuildingGroup;
  onClose: () => void;
  onLevelChange: LevelChangeHandler;
  onTrackingToggle: TrackingToggleHandler;
  onAddInstance: AddInstanceHandler;
};

function BuildingDetailPanel({
  group,
  onClose,
  onLevelChange,
  onTrackingToggle,
  onAddInstance,
}: BuildingDetailPanelProps) {
  const hasInstances = group.instances.length > 0;
  const canAddAnother = group.multiInstance
    ? group.maxInstances != null
      ? group.instances.length < group.maxInstances
      : true
    : !hasInstances;

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
              Update building levels plus tracked and upgrading flags.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canAddAnother && (
              <button
                type="button"
                onClick={() => onAddInstance(group.groupKey)}
                className="inline-flex items-center rounded-full border border-slate-700 px-3 py-1 text-[11px] font-medium text-slate-100 hover:bg-slate-800"
              >
                {hasInstances
                  ? "Add instance"
                  : "Create building"}
              </button>
            )}
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
                <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-slate-800 px-4 py-3 text-[11px] font-semibold text-slate-400">
                  <div>Instance</div>
                  <div className="text-center">Level</div>
                  <div className="text-center">Tracked</div>
                  <div className="text-center">Upgrading</div>
                </div>

                {group.instances.map((instance) => (
                  <div
                    key={instance.id}
                    className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 border-t border-slate-900 px-4 py-3 text-xs text-slate-100"
                  >
                    <div className="pr-2">
                      <div className="font-medium text-slate-50">
                        {instance.instanceLabel}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Document id: {instance.id}
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
                  </div>
                ))}
              </div>

              <p className="mt-3 text-[11px] text-slate-500">
                Changes save automatically when you edit a level or
                toggle a checkbox. Use tracked to flag buildings you want
                to focus on next. When you begin the upgrade, switch to
                upgrading so the dashboard can follow progress.
              </p>
            </>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4 text-xs text-slate-200">
              <p>
                No buildings created for this group yet. Use the
                button above to create the first one. Levels can stay
                at zero until you unlock them in game.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
