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

// EN
import enCommon from "./en/common.json";
import enNav from "./en/nav.json";
import enDashboard from "./en/dashboard.json";
import enTiles from "./en/tiles.json";
import enVsTasks from "./en/vsTasks.json";
import enFooter from "./en/footer.json";
import enProfile from "./en/profile.json";
import enNextUp from "./en/nextUp.json";
import enTeams from "./en/teams.json";
import enLinks from "./en/links.json";
import enAuth from "./en/auth.json";

// DE
import deCommon from "./de/common.json";
import deNav from "./de/nav.json";
import deDashboard from "./de/dashboard.json";
import deTiles from "./de/tiles.json";
import deVsTasks from "./de/vsTasks.json";
import deFooter from "./de/footer.json";
import deProfile from "./de/profile.json";
import deNextUp from "./de/nextUp.json";
import deTeams from "./de/teams.json";
import deLinks from "./de/links.json";
import deAuth from "./de/auth.json";

// IT
import itCommon from "./it/common.json";
import itNav from "./it/nav.json";
import itDashboard from "./it/dashboard.json";
import itTiles from "./it/tiles.json";
import itVsTasks from "./it/vsTasks.json";
import itFooter from "./it/footer.json";
import itProfile from "./it/profile.json";
import itNextUp from "./it/nextUp.json";
import itTeams from "./it/teams.json";
import itLinks from "./it/links.json";
import itAuth from "./it/auth.json";

// FR
import frCommon from "./fr/common.json";
import frNav from "./fr/nav.json";
import frDashboard from "./fr/dashboard.json";
import frTiles from "./fr/tiles.json";
import frVsTasks from "./fr/vsTasks.json";
import frFooter from "./fr/footer.json";
import frProfile from "./fr/profile.json";
import frNextUp from "./fr/nextUp.json";
import frTeams from "./fr/teams.json";
import frLinks from "./fr/links.json";
import frAuth from "./fr/auth.json";

// AR
import arCommon from "./ar/common.json";
import arNav from "./ar/nav.json";
import arDashboard from "./ar/dashboard.json";
import arTiles from "./ar/tiles.json";
import arVsTasks from "./ar/vsTasks.json";
import arFooter from "./ar/footer.json";
import arProfile from "./ar/profile.json";
import arNextUp from "./ar/nextUp.json";
import arTeams from "./ar/teams.json";
import arLinks from "./ar/links.json";
import arAuth from "./ar/auth.json";

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
    enAuth
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
    deAuth
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
    itAuth
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
    frAuth
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
    arAuth
  ),
};
