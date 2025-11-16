"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  addDoc,
} from "firebase/firestore";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";

type HeroRole = "Attack" | "Defense" | "Support" | string;

type Hero = {
  id: string;
  name: string;
  power?: number | string;
  team?: number | null;
  type?: string;
  role?: HeroRole;
  rail_gun?: number | null;
  rail_gun_stars?: string | null;
  data_chip?: number | null;
  data_chip_stars?: string | null;
  armor?: number | null;
  armor_stars?: string | null;
  radar?: number | null;
  radar_stars?: string | null;
  skill1?: number | null;
  skill2?: number | null;
  skill3?: number | null;
  max_skill_level?: number | null;
  exclusive_weapon_owned?: boolean;
  exclusive_weapon_level?: number | null;
};

type HeroCatalogEntry = {
  id: string;
  name: string;
  type?: string;
  role?: HeroRole;
};

const TEAM_FILTERS = [
  "All",
  "Team 1",
  "Team 2",
  "Team 3",
  "Team 4",
  "Unassigned",
] as const;
type TeamFilter = (typeof TEAM_FILTERS)[number];

const ROLE_FILTERS = ["All", "Attack", "Defense", "Support"] as const;
type RoleFilter = (typeof ROLE_FILTERS)[number];

const SORT_OPTIONS = ["Power", "Name", "Team"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

const STAR_VALUES: string[] = [
  "0",
  "0.1",
  "0.2",
  "0.3",
  "0.4",
  "1",
  "1.1",
  "1.2",
  "1.3",
  "1.4",
  "2",
  "2.1",
  "2.2",
  "2.3",
  "2.4",
  "3",
  "3.1",
  "3.2",
  "3.3",
  "3.4",
  "4",
  "4.1",
  "4.2",
  "4.3",
  "4.4",
  "5",
];

export default function HeroesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [loading, setLoading] = useState(true);

  const [teamFilter, setTeamFilter] = useState<TeamFilter>("All");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("All");
  const [sortBy, setSortBy] = useState<SortOption>("Power");

  const [catalog, setCatalog] = useState<HeroCatalogEntry[]>([]);
  const [catalogFilter, setCatalogFilter] = useState<string>("All");

  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [creatingHero, setCreatingHero] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setHeroes([]);
        setLoading(false);
        return;
      }
      setUser(firebaseUser);
    });

    return () => unsub();
  }, []);

  // Load user heroes
  useEffect(() => {
    if (!user) return;

    const loadHeroes = async () => {
      try {
        setLoading(true);
        const heroesRef = collection(db, "users", user.uid, "heroes");
        const snap = await getDocs(query(heroesRef));
        const list: Hero[] = snap.docs.map((d) => {
          const data = d.data() as any;
          const toNum = (v: any): number | null => {
            if (v === null || v === undefined || v === "") return null;
            const num = Number(v);
            return isNaN(num) ? null : num;
          };

          const normalized: Hero = {
            id: d.id,
            name: data.name ?? "",
            power:
              typeof data.power === "number"
                ? data.power
                : data.power != null
                ? Number(data.power)
                : undefined,
            team:
              data.team === null || data.team === undefined
                ? null
                : Number(data.team),
            type: data.type ?? undefined,
            role: data.role ?? undefined,
            rail_gun: toNum(data.rail_gun),
            rail_gun_stars: data.rail_gun_stars ?? null,
            data_chip: toNum(data.data_chip),
            data_chip_stars: data.data_chip_stars ?? null,
            armor: toNum(data.armor),
            armor_stars: data.armor_stars ?? null,
            radar: toNum(data.radar),
            radar_stars: data.radar_stars ?? null,
            skill1: toNum(data.skill1),
            skill2: toNum(data.skill2),
            skill3: toNum(data.skill3),
            max_skill_level: toNum(data.max_skill_level),
            exclusive_weapon_owned: !!data.exclusive_weapon_owned,
            exclusive_weapon_level: toNum(data.exclusive_weapon_level),
          };
          return normalized;
        });

        setHeroes(list);
      } catch (err) {
        console.error("Failed to load heroes", err);
      } finally {
        setLoading(false);
      }
    };

    loadHeroes();
  }, [user]);

  // Load hero catalog (name, type, role)
  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const catalogRef = collection(db, "hero_catalog");
        const snap = await getDocs(query(catalogRef));
        const list: HeroCatalogEntry[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name ?? "",
            type: data.type ?? undefined,
            role: data.role ?? undefined,
          };
        });

        list.sort((a, b) => a.name.localeCompare(b.name));
        setCatalog(list);
      } catch (err) {
        console.error("Failed to load hero catalog", err);
      }
    };

    loadCatalog();
  }, []);

  // Build dropdown options from catalog plus user hero power
  const heroOptions = useMemo(() => {
    const list = catalog.map((entry) => {
      const userHero = heroes.find((h) => h.name === entry.name);

      let power: number | null = null;
      if (userHero) {
        if (typeof userHero.power === "number") {
          power = userHero.power;
        } else if (userHero.power != null) {
          const num = Number(userHero.power);
          power = isNaN(num) ? null : num;
        }
      }

      return {
        ...entry,
        power,
      };
    });

    list.sort((a, b) => {
      const pa = a.power ?? 0;
      const pb = b.power ?? 0;
      if (pb !== pa) return pb - pa;
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [catalog, heroes]);

  const filteredHeroes = useMemo(() => {
    let list = [...heroes];

    if (catalogFilter !== "All") {
      list = list.filter((h) => h.name === catalogFilter);
    }

    if (teamFilter !== "All") {
      if (teamFilter === "Unassigned") {
        list = list.filter((h) => h.team == null);
      } else {
        const teamNumber = Number(teamFilter.replace("Team ", ""));
        list = list.filter((h) => h.team === teamNumber);
      }
    }

    if (roleFilter !== "All") {
      list = list.filter(
        (h) =>
          h.role &&
          h.role.toLowerCase() === roleFilter.toLowerCase()
      );
    }

    list.sort((a, b) => {
      if (sortBy === "Name") {
        return a.name.localeCompare(b.name);
      }

      if (sortBy === "Team") {
        const ta = a.team ?? 999;
        const tb = b.team ?? 999;
        if (ta !== tb) return ta - tb;
        return a.name.localeCompare(b.name);
      }

      const pa =
        typeof a.power === "number"
          ? a.power
          : a.power != null
          ? Number(a.power)
          : 0;
      const pb =
        typeof b.power === "number"
          ? b.power
          : b.power != null
          ? Number(b.power)
          : 0;
      if (pb !== pa) return pb - pa;
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [heroes, catalogFilter, teamFilter, roleFilter, sortBy]);

  const selectedHero = useMemo(
    () => heroes.find((h) => h.id === selectedHeroId) ?? null,
    [heroes, selectedHeroId]
  );

  const handleUpdateHeroField = async (
    heroId: string,
    field: string,
    value: any
  ) => {
    if (!user) return;
    setSavingField(`${heroId}:${field}`);
    try {
      const ref = doc(db, "users", user.uid, "heroes", heroId);
      await updateDoc(ref, { [field]: value });

      setHeroes((prev) =>
        prev.map((h) =>
          h.id === heroId
            ? {
                ...h,
                [field]: value,
              }
            : h
        )
      );
    } catch (err) {
      console.error("Failed to update hero", err);
    } finally {
      setSavingField(null);
    }
  };

  const handleUpdateNumericField = (
    heroId: string,
    field: keyof Hero,
    raw: string
  ) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      handleUpdateHeroField(heroId, field as string, null);
      return;
    }
    const num = Number(trimmed);
    if (isNaN(num)) return;
    handleUpdateHeroField(heroId, field as string, num);
  };

  const handleUpdateTeam = (heroId: string, value: string) => {
    if (value === "Unassigned") {
      handleUpdateHeroField(heroId, "team", null);
      return;
    }
    const team = Number(value);
    if (isNaN(team)) return;
    handleUpdateHeroField(heroId, "team", team);
  };

  const getGearFieldsForRole = (role?: HeroRole): [string, string][] => {
    if (!role) return [];

    const r = role.toLowerCase();

    if (r === "attack") {
      return [
        ["rail_gun", "rail_gun_stars"],
        ["data_chip", "data_chip_stars"],
      ] as [string, string][];
    }

    if (r === "defense") {
      return [
        ["armor", "armor_stars"],
        ["radar", "radar_stars"],
      ] as [string, string][];
    }

    if (r === "support") {
      return [
        ["rail_gun", "rail_gun_stars"],
        ["radar", "radar_stars"],
      ] as [string, string][];
    }

    return [];
  };

  const isSaving = (heroId: string, field: string) =>
    savingField === `${heroId}:${field}`;

  const handleCreateHeroFromCatalogSelection = async () => {
    if (!user) return;
    if (catalogFilter === "All") return;

    try {
      setCreatingHero(true);

      const catalogHero =
        heroOptions.find((h) => h.name === catalogFilter) ?? null;

      const heroesRef = collection(db, "users", user.uid, "heroes");
      const docRef = await addDoc(heroesRef, {
        name: catalogHero?.name ?? catalogFilter,
        type: catalogHero?.type ?? null,
        role: catalogHero?.role ?? null,
        power: null,
        team: null,
        rail_gun: null,
        rail_gun_stars: null,
        data_chip: null,
        data_chip_stars: null,
        armor: null,
        armor_stars: null,
        radar: null,
        radar_stars: null,
        skill1: null,
        skill2: null,
        skill3: null,
        max_skill_level: null,
        exclusive_weapon_owned: false,
        exclusive_weapon_level: null,
      });

      const newHero: Hero = {
        id: docRef.id,
        name: catalogHero?.name ?? catalogFilter,
        type: catalogHero?.type ?? undefined,
        role: catalogHero?.role ?? undefined,
        team: null,
        power: undefined,
        rail_gun: null,
        rail_gun_stars: null,
        data_chip: null,
        data_chip_stars: null,
        armor: null,
        armor_stars: null,
        radar: null,
        radar_stars: null,
        skill1: null,
        skill2: null,
        skill3: null,
        max_skill_level: null,
        exclusive_weapon_owned: false,
        exclusive_weapon_level: null,
      };

      setHeroes((prev) => [...prev, newHero]);
      setSelectedHeroId(docRef.id);
    } catch (err) {
      console.error("Failed to create hero from catalog", err);
    } finally {
      setCreatingHero(false);
    }
  };

  const handleCloseDetail = () => {
    // Close the detail panel and reset to "All heroes"
    setSelectedHeroId(null);
    setCatalogFilter("All");
  };

  if (!user && !loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-semibold text-white">Heroes</h1>
          <p className="text-slate-300">
            Please sign in to view your heroes.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Top navigation pills */}
        <div className="flex flex-wrap gap-2 mb-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-full px-4 py-1.5 text-sm border border-slate-600 bg-slate-950 text-slate-200 hover:border-sky-500 hover:text-sky-200 transition-colors"
          >
            Dashboard
          </Link>
          <span className="inline-flex items-center rounded-full px-4 py-1.5 text-sm border border-sky-500 bg-sky-600 text-white">
            Heroes
          </span>
          <Link
            href="/research"
            className="inline-flex items-center rounded-full px-4 py-1.5 text-sm border border-slate-600 bg-slate-950 text-slate-200 hover:border-sky-500 hover:text-sky-200 transition-colors"
          >
            Research
          </Link>
        </div>

        {/* Header */}
        <section className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Heroes
          </h1>
          <p className="text-sm text-slate-300">
            Manage your squads, power, gear, and skills.
          </p>
        </section>

        {/* Filters */}
        <section className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">
                Hero
              </label>
              <select
                value={catalogFilter}
                onChange={(e) => setCatalogFilter(e.target.value)}
                className="w-full rounded-lg bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500/70"
              >
                <option value="All">All heroes</option>
                {heroOptions.map((h) => {
                  const label =
                    h.power != null
                      ? `${h.name} (${h.power.toLocaleString()})`
                      : h.name;

                  return (
                    <option key={h.id} value={h.name}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Role
                </label>
                <select
                  value={roleFilter}
                  onChange={(e) =>
                    setRoleFilter(e.target.value as RoleFilter)
                  }
                  className="rounded-lg bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500/70"
                >
                  {ROLE_FILTERS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(e.target.value as SortOption)
                  }
                  className="rounded-lg bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500/70"
                >
                  {SORT_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Team filter chips */}
          <div className="flex flex-wrap gap-2">
            {TEAM_FILTERS.map((t) => {
              const active = t === teamFilter;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTeamFilter(t)}
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "bg-sky-600/80 border-sky-400 text-white"
                      : "bg-slate-900/90 border-slate-700/80 text-slate-200 hover:border-sky-500/70"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </section>

        {/* Heroes grid */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading && filteredHeroes.length === 0 ? (
            <div className="col-span-full text-sm text-slate-400">
              Loading heroes...
            </div>
          ) : filteredHeroes.length === 0 ? (
            <div className="col-span-full text-sm text-slate-400 space-y-2">
              {catalogFilter === "All" ? (
                <p>No heroes match your filters.</p>
              ) : (
                <>
                  <p>
                    You do not have {catalogFilter} in your roster yet.
                  </p>
                  <button
                    type="button"
                    onClick={handleCreateHeroFromCatalogSelection}
                    disabled={creatingHero}
                    className="inline-flex items-center rounded-lg bg-sky-600/90 px-3 py-2 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {creatingHero
                      ? "Adding hero..."
                      : `Add ${catalogFilter} to your roster`}
                  </button>
                </>
              )}
            </div>
          ) : (
            filteredHeroes.map((hero) => {
              const teamLabel =
                hero.team == null ? "Unassigned" : `Team ${hero.team}`;
              const roleLabel = hero.role ?? "Unknown";
              const powerDisplay =
                typeof hero.power === "number"
                  ? hero.power.toLocaleString()
                  : hero.power ?? "0";

              return (
                <button
                  key={hero.id}
                  type="button"
                  onClick={() => setSelectedHeroId(hero.id)}
                  className="group rounded-xl border border-slate-700/80 bg-slate-900/80 px-4 py-3 text-left hover:border-sky-500/70 hover:bg-slate-900 transition-colors flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-50 group-hover:text-sky-200">
                        {hero.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        Type: {hero.type ?? "Unknown"} · Role:{" "}
                        {roleLabel}
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium bg-slate-800/80 border border-slate-600/80 text-slate-200">
                      {teamLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400">Power</p>
                    <p className="text-sm font-semibold">
                      {powerDisplay}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </section>

        {/* Detail panel */}
        {selectedHero && (
          <HeroDetailPanel
            hero={selectedHero}
            onClose={handleCloseDetail}
            onUpdateField={handleUpdateHeroField}
            onUpdateNumericField={handleUpdateNumericField}
            onUpdateTeam={handleUpdateTeam}
            getGearFieldsForRole={getGearFieldsForRole}
            isSaving={isSaving}
          />
        )}
      </div>
    </main>
  );
}

function HeroDetailPanel(props: {
  hero: Hero;
  onClose: () => void;
  onUpdateField: (heroId: string, field: string, value: any) => void;
  onUpdateNumericField: (
    heroId: string,
    field: keyof Hero,
    raw: string
  ) => void;
  onUpdateTeam: (heroId: string, value: string) => void;
  getGearFieldsForRole: (role?: HeroRole) => [string, string][];
  isSaving: (heroId: string, field: string) => boolean;
}) {
  const {
    hero,
    onClose,
    onUpdateField,
    onUpdateNumericField,
    onUpdateTeam,
    getGearFieldsForRole,
    isSaving,
  } = props;

  // All gear pairs every hero has, in your requested order:
  // Rail Gun, Armor, Data Chip, Radar (each with stars)
  const allGearPairs: [string, string][] = [
    ["rail_gun", "rail_gun_stars"],
    ["armor", "armor_stars"],
    ["data_chip", "data_chip_stars"],
    ["radar", "radar_stars"],
  ];

  // Role–relevant gear (for highlighting)
  const rolePairs = getGearFieldsForRole(hero.role);
  const relevantBaseKeys = new Set(rolePairs.map(([base]) => base));

  const skillColor = (value: number | null | undefined) => {
    if (value == null) return "text-slate-200";
    if (
      hero.max_skill_level != null &&
      value === hero.max_skill_level
    ) {
      return "text-emerald-300";
    }
    if (value < 20) {
      return "text-orange-300";
    }
    return "text-slate-200";
  };

  const canShowStars = (base: number | null | undefined) =>
    base === 40;

  const gearRowClass = (
    baseValue: number | null | undefined,
    starValue: string | null | undefined,
    isRelevant: boolean
  ) => {
    const showStars = canShowStars(baseValue ?? null);

    if (showStars && (starValue === "5" || starValue === "5.0")) {
      return "text-emerald-300";
    }

    if (isRelevant) {
      return "text-orange-300";
    }

    return "text-slate-200";
  };

  const exclusiveOwned = !!hero.exclusive_weapon_owned;
  const exclusiveLevel = hero.exclusive_weapon_level ?? null;

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex justify-end">
      <div className="h-full w-full max-w-md bg-slate-950 border-l border-slate-800 flex flex-col">
        <header className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-50">
              {hero.name}
            </p>
            <p className="text-xs text-slate-400">
              Type: {hero.type ?? "Unknown"} · Role:{" "}
              {hero.role ?? "Unknown"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-100"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Core stats */}
          <section className="rounded-xl bg-slate-900/80 border border-slate-700/80 px-4 py-3 space-y-3">
            <h2 className="text-sm font-semibold text-slate-100">
              Core Stats
            </h2>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Power
                </label>
                <input
                  type="text"
                  defaultValue={
                    hero.power != null ? String(hero.power) : ""
                  }
                  onBlur={(e) =>
                    onUpdateNumericField(
                      hero.id,
                      "power",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg bg-slate-950/80 border border-slate-700/80 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500/70"
                />
                {isSaving(hero.id, "power") && (
                  <p className="text-[10px] text-sky-300 mt-1">
                    Saving
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Team
                </label>
                <select
                  value={
                    hero.team == null ? "Unassigned" : String(hero.team)
                  }
                  onChange={(e) =>
                    onUpdateTeam(hero.id, e.target.value)
                  }
                  className="w-full rounded-lg bg-slate-950/80 border border-slate-700/80 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500/70"
                >
                  <option value="Unassigned">Unassigned</option>
                  <option value="1">Team 1</option>
                  <option value="2">Team 2</option>
                  <option value="3">Team 3</option>
                  <option value="4">Team 4</option>
                </select>
                {isSaving(hero.id, "team") && (
                  <p className="text-[10px] text-sky-300 mt-1">
                    Saving
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Type
                  </label>
                  <div className="text-sm text-slate-200">
                    {hero.type ?? "Unknown"}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Role
                  </label>
                  <div className="text-sm text-slate-200">
                    {hero.role ?? "Unknown"}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Gear and bonuses */}
          <section className="rounded-xl bg-slate-900/80 border border-slate-700/80 px-4 py-3 space-y-3">
            <h2 className="text-sm font-semibold text-slate-100">
              Gear And Bonuses
            </h2>
            <p className="text-[11px] text-slate-400">
              Role important gear is highlighted. Set base gear to 40
              to unlock stars.
            </p>
            <div className="space-y-3">
              {allGearPairs.map(([baseKey, starKey]) => {
                const baseValue = hero[baseKey as keyof Hero] as
                  | number
                  | null
                  | undefined;
                const starValue =
                  hero[starKey as keyof Hero] as
                    | string
                    | null
                    | undefined;

                const baseLabel = baseKey
                  .replace("_", " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase());
                const starLabel = baseLabel + " Stars";

                const showStars = canShowStars(baseValue ?? null);
                const isRelevant = relevantBaseKeys.has(baseKey);
                const rowColorClass = gearRowClass(
                  baseValue ?? null,
                  starValue ?? null,
                  isRelevant
                );

                return (
                  <div
                    key={baseKey}
                    className="grid grid-cols-1 gap-2"
                  >
                    <div>
                      <label
                        className={`block text-xs mb-1 ${rowColorClass}`}
                      >
                        {baseLabel}
                      </label>
                      <input
                        type="text"
                        defaultValue={
                          baseValue != null ? String(baseValue) : ""
                        }
                        onBlur={(e) => {
                          const raw = e.target.value;
                          onUpdateNumericField(
                            hero.id,
                            baseKey as keyof Hero,
                            raw
                          );

                          const trimmed = raw.trim();
                          const num =
                            trimmed === "" ? null : Number(trimmed);
                          if (num !== 40) {
                            onUpdateField(hero.id, starKey, null);
                          }
                        }}
                        className={`w-full rounded-lg bg-slate-950/80 border border-slate-700/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500/70 ${rowColorClass}`}
                      />
                      {isSaving(hero.id, baseKey) && (
                        <p className="text-[10px] text-sky-300 mt-1">
                          Saving
                        </p>
                      )}
                    </div>
                    {showStars ? (
                      <div>
                        <label
                          className={`block text-xs mb-1 ${rowColorClass}`}
                        >
                          {starLabel}
                        </label>
                        <select
                          value={starValue ?? ""}
                          onChange={(e) =>
                            onUpdateField(
                              hero.id,
                              starKey,
                              e.target.value || null
                            )
                          }
                          className={`w-full rounded-lg bg-slate-950/80 border border-slate-700/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500/70 ${rowColorClass}`}
                        >
                          <option value="">
                            Select star level
                          </option>
                          {STAR_VALUES.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                        {isSaving(hero.id, starKey) && (
                          <p className="text-[10px] text-sky-300 mt-1">
                            Saving
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400">
                        Set {baseLabel} to 40 to unlock stars.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Exclusive weapon */}
            <div className="mt-4 border-t border-slate-800 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-slate-200">
                  <input
                    type="checkbox"
                    checked={exclusiveOwned}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      onUpdateField(
                        hero.id,
                        "exclusive_weapon_owned",
                        checked
                      );
                      if (!checked) {
                        onUpdateField(
                          hero.id,
                          "exclusive_weapon_level",
                          null
                        );
                      }
                    }}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-500"
                  />
                  Has exclusive weapon
                </label>
              </div>

              {exclusiveOwned && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Exclusive Weapon Level
                  </label>
                  <input
                    type="text"
                    defaultValue={
                      exclusiveLevel != null
                        ? String(exclusiveLevel)
                        : ""
                    }
                    onBlur={(e) =>
                      onUpdateNumericField(
                        hero.id,
                        "exclusive_weapon_level",
                        e.target.value
                      )
                    }
                    className="w-full rounded-lg bg-slate-950/80 border border-slate-700/80 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500/70"
                  />
                  {isSaving(
                    hero.id,
                    "exclusive_weapon_level"
                  ) && (
                    <p className="text-[10px] text-sky-300 mt-1">
                      Saving
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Skills */}
          <section className="rounded-xl bg-slate-900/80 border border-slate-700/80 px-4 py-3 space-y-3">
            <h2 className="text-sm font-semibold text-slate-100">
              Skills
            </h2>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Max Skill Level
                </label>
                <input
                  type="text"
                  defaultValue={
                    hero.max_skill_level != null
                      ? String(hero.max_skill_level)
                      : ""
                  }
                  onBlur={(e) =>
                    onUpdateNumericField(
                      hero.id,
                      "max_skill_level",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg bg-slate-950/80 border border-slate-700/80 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500/70"
                />
                {isSaving(hero.id, "max_skill_level") && (
                  <p className="text-[10px] text-sky-300 mt-1">
                    Saving
                  </p>
                )}
              </div>

              <SkillRow
                label="Skill 1"
                hero={hero}
                field="skill1"
                onUpdateNumericField={onUpdateNumericField}
                isSaving={isSaving}
                colorClass={skillColor(hero.skill1)}
              />
              <SkillRow
                label="Skill 2"
                hero={hero}
                field="skill2"
                onUpdateNumericField={onUpdateNumericField}
                isSaving={isSaving}
                colorClass={skillColor(hero.skill2)}
              />
              <SkillRow
                label="Skill 3"
                hero={hero}
                field="skill3"
                onUpdateNumericField={onUpdateNumericField}
                isSaving={isSaving}
                colorClass={skillColor(hero.skill3)}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SkillRow(props: {
  label: string;
  hero: Hero;
  field: "skill1" | "skill2" | "skill3";
  onUpdateNumericField: (
    heroId: string,
    field: keyof Hero,
    raw: string
  ) => void;
  isSaving: (heroId: string, field: string) => boolean;
  colorClass: string;
}) {
  const { label, hero, field, onUpdateNumericField, isSaving, colorClass } =
    props;
  const value = hero[field];

  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">
        {label}
      </label>
      <input
        type="text"
        defaultValue={value != null ? String(value) : ""}
        onBlur={(e) =>
          onUpdateNumericField(hero.id, field, e.target.value)
        }
        className={`w-full rounded-lg bg-slate-950/80 border border-slate-700/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500/70 ${colorClass}`}
      />
      {isSaving(hero.id, field) && (
        <p className="text-[10px] text-sky-300 mt-1">Saving</p>
      )}
    </div>
  );
}
