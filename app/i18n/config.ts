// app/i18n/config.ts

export const SUPPORTED_LOCALES = ["en", "de", "it", "fr", "ar"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const isLocale = (value: string): value is Locale => {
  return SUPPORTED_LOCALES.includes(value as Locale);
};

type Messages = Record<string, string>;
type AllMessages = Record<Locale, Messages>;

// allow any object-like source so empty {} JSON is fine
function mergeMessages(...sources: Array<{ [key: string]: any }>): Messages {
  return Object.assign({}, ...sources);
}

// Common
import enCommon from "./en/common.json";
import deCommon from "./de/common.json";
import itCommon from "./it/common.json";
import frCommon from "./fr/common.json";
import arCommon from "./ar/common.json";

// Nav
import enNav from "./en/nav.json";
import deNav from "./de/nav.json";
import itNav from "./it/nav.json";
import frNav from "./fr/nav.json";
import arNav from "./ar/nav.json";

//Dashboard
import enDashboard from "./en/dashboard.json";
import deDashboard from "./de/dashboard.json";
import itDashboard from "./it/dashboard.json";
import frDashboard from "./fr/dashboard.json";
import arDashboard from "./ar/dashboard.json";

// Tiles
import enTiles from "./en/tiles.json";
import deTiles from "./de/tiles.json";
import itTiles from "./it/tiles.json";
import frTiles from "./fr/tiles.json";
import arTiles from "./ar/tiles.json";

//VS Tasks
import enVsTasks from "./en/vsTasks.json";
import deVsTasks from "./de/vsTasks.json";
import itVsTasks from "./it/vsTasks.json";
import frVsTasks from "./fr/vsTasks.json";
import arVsTasks from "./ar/vsTasks.json";

//Footer
import enFooter from "./en/footer.json";
import deFooter from "./de/footer.json";
import itFooter from "./it/footer.json";
import frFooter from "./fr/footer.json";
import arFooter from "./ar/footer.json";

// Footer
import enProfile from "./en/profile.json";
import deProfile from "./de/profile.json";
import itProfile from "./it/profile.json";
import frProfile from "./fr/profile.json";
import arProfile from "./ar/profile.json";

// Next Up
import enNextUp from "./en/nextUp.json";
import deNextUp from "./de/nextUp.json";
import itNextUp from "./it/nextUp.json";
import frNextUp from "./fr/nextUp.json";
import arNextUp from "./ar/nextUp.json";

// Teams
import enTeams from "./en/teams.json";
import deTeams from "./de/teams.json";
import itTeams from "./it/teams.json";
import frTeams from "./fr/teams.json";
import arTeams from "./ar/teams.json";

// Links
import enLinks from "./en/links.json";
import deLinks from "./de/links.json";
import itLinks from "./it/links.json";
import frLinks from "./fr/links.json";
import arLinks from "./ar/links.json";

// Auth
import enAuth from "./en/auth.json";
import deAuth from "./de/auth.json";
import itAuth from "./it/auth.json";
import frAuth from "./fr/auth.json";
import arAuth from "./ar/auth.json";

// Status
import enStatus from "./en/status.json";
import deStatus from "./de/status.json";
import itStatus from "./it/status.json";
import frStatus from "./fr/status.json";
import arStatus from "./ar/status.json";

// Heroes
import enHeroes from "./en/heroes.json";
import deHeroes from "./de/heroes.json";
import itHeroes from "./it/heroes.json";
import frHeroes from "./fr/heroes.json";
import arHeroes from "./ar/heroes.json";

// Buildings
import enBuildings from "./en/buildings.json";
import deBuildings from "./de/buildings.json";
import itBuildings from "./it/buildings.json";
import frBuildings from "./fr/buildings.json";
import arBuildings from "./ar/buildings.json";

// Research
import enResearch from "./en/research.json";
import deResearch from "./de/research.json";
import itResearch from "./it/research.json";
import frResearch from "./fr/research.json";
import arResearch from "./ar/research.json";

// Compare
import enCompare from "./en/compare.json";
import deCompare from "./de/compare.json";
import itCompare from "./it/compare.json";
import frCompare from "./fr/compare.json";
import arCompare from "./ar/compare.json";


export const messages: AllMessages = {
  en: mergeMessages(
    enCommon,
    enNav,
    enDashboard,
    enTiles,
    enVsTasks,
    enFooter,
    enProfile,
    enNextUp,
    enTeams,
    enLinks,
    enAuth,
    enStatus,    
    enHeroes,
    enBuildings,
    enResearch,
    enCompare
  ),
  de: mergeMessages(
    deCommon,
    deNav,
    deDashboard,
    deTiles,
    deVsTasks,
    deFooter,
    deProfile,
    deNextUp,
    deTeams,
    deLinks,
    deAuth,
    deStatus,
    deHeroes,
    deBuildings,
    deResearch,
    deCompare
  ),
  it: mergeMessages(
    itCommon,
    itNav,
    itDashboard,
    itTiles,
    itVsTasks,
    itFooter,
    itProfile,
    itNextUp,
    itTeams,
    itLinks,
    itAuth,
    itStatus,
    itHeroes,
    itBuildings,
    itResearch,
    itCompare
  ),
  fr: mergeMessages(
    frCommon,
    frNav,
    frDashboard,
    frTiles,
    frVsTasks,
    frFooter,
    frProfile,
    frNextUp,
    frTeams,
    frLinks,
    frAuth,
    frStatus,
    frHeroes,
    frBuildings,
    frResearch,
    frCompare
  ),
  ar: mergeMessages(
    arCommon,
    arNav,
    arDashboard,
    arTiles,
    arVsTasks,
    arFooter,
    arProfile,
    arNextUp,
    arTeams,
    arLinks,
    arAuth,
    arStatus,
    arHeroes,
    arBuildings,
    arResearch,
    arCompare
  ),
};
