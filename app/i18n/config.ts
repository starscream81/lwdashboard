export const SUPPORTED_LOCALES = ["en", "de", "it", "ar"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const isLocale = (value: string): value is Locale => {
  return SUPPORTED_LOCALES.includes(value as Locale);
};

type Messages = Record<string, string>;

type AllMessages = Record<Locale, Messages>;

export const messages: AllMessages = {
  en: {
    "app.name": "Last War Command Center",

    "dashboard.title": "Last War Dashboard",
    "dashboard.subtitle": "Track your base, squads, and upgrades in one place.",

    "header.hq": "HQ",
    "header.totalHeroPower": "Total Hero Power",

    "tiles.vsToday.title": "VS Today",
    "tiles.armsRace.title": "Today’s Arms Race",
    "tiles.shiny.title": "Today’s Shiny Tasks",

    "tiles.hqRequirements.title": "HQ {level} Requirements",
    "tiles.hqRequirements.fallback": "HQ Requirements",
    "tiles.hqRequirements.noHq": "HQ level not set.",
    "tiles.hqRequirements.noData": "No requirement data found.",

    "tiles.researchStatus.title": "Research Status",
    "tiles.researchStatus.empty": "No tracked research categories yet.",

    "tiles.currentlyUpgrading.title": "Currently Upgrading",
    "tiles.currentlyUpgrading.description":
      "Includes research in progress and buildings marked as upgrading or with priority.",
    "tiles.currentlyUpgrading.empty":
      "Nothing upgrading yet. Start research or mark buildings as upgrading or add priority to see them here.",

    "tiles.nextUp.title": "Next Up",
    "tiles.nextUp.empty":
      "Nothing on deck yet. Set tracked or priority on research or buildings to see them here.",

    "links.heroes.title": "Heroes",
    "links.heroes.description": "Manage squads, power, and gear.",
    "links.buildings.title": "Buildings",
    "links.buildings.description": "Tune your base and upgrades.",
    "links.research.title": "Research",
    "links.research.description": "Plan your research path.",
    "links.groupDashboard.title": "Group Dashboard",
    "links.groupDashboard.description":
      "View shared stats for 977 and 982.",

    "lang.label": "Language",
    "lang.en": "English",
    "lang.de": "German",
    "lang.it": "Italian",
    "lang.ar": "Arabic",
  },
  de: {
    "app.name": "Last War Kommandozentrale",

    "dashboard.title": "Last War Dashboard",
    "dashboard.subtitle":
      "Beobachte Basis, Trupps und Verbesserungen auf einen Blick.",

    "header.hq": "HQ",
    "header.totalHeroPower": "Gesamte Heldenstärke",

    "tiles.vsToday.title": "VS heute",
    "tiles.armsRace.title": "Heutiges Wettrüsten",
    "tiles.shiny.title": "Heutige Shiny Aufgaben",

    "tiles.hqRequirements.title": "HQ {level} Anforderungen",
    "tiles.hqRequirements.fallback": "HQ Anforderungen",
    "tiles.hqRequirements.noHq": "HQ Stufe nicht gesetzt.",
    "tiles.hqRequirements.noData": "Keine Anforderungsdaten gefunden.",

    "tiles.researchStatus.title": "Forschungsstatus",
    "tiles.researchStatus.empty":
      "Noch keine verfolgten Forschungskategorien.",

    "tiles.currentlyUpgrading.title": "Aktuelle Verbesserungen",
    "tiles.currentlyUpgrading.description":
      "Beinhaltet laufende Forschung und Gebäude mit Upgrade oder Priorität.",
    "tiles.currentlyUpgrading.empty":
      "Derzeit keine Verbesserungen. Starte Forschung oder markiere Gebäude als Upgrade.",

    "tiles.nextUp.title": "Als nächstes",
    "tiles.nextUp.empty":
      "Noch nichts geplant. Markiere Forschung oder Gebäude als verfolgt oder mit Priorität.",

    "links.heroes.title": "Helden",
    "links.heroes.description": "Verwalte Trupps, Stärke und Ausrüstung.",
    "links.buildings.title": "Gebäude",
    "links.buildings.description": "Optimiere Basis und Upgrades.",
    "links.research.title": "Forschung",
    "links.research.description": "Plane deinen Forschungsweg.",
    "links.groupDashboard.title": "Gruppen Dashboard",
    "links.groupDashboard.description":
      "Zeige gemeinsame Werte für 977 und 982.",

    "lang.label": "Sprache",
    "lang.en": "Englisch",
    "lang.de": "Deutsch",
    "lang.it": "Italienisch",
    "lang.ar": "Arabisch",
  },
  it: {
    "app.name": "Centro di Comando Last War",

    "dashboard.title": "Dashboard Last War",
    "dashboard.subtitle":
      "Tieni sotto controllo base, squadre e miglioramenti in un solo posto.",

    "header.hq": "HQ",
    "header.totalHeroPower": "Potere totale eroi",

    "tiles.vsToday.title": "VS di oggi",
    "tiles.armsRace.title": "Corsa agli armamenti di oggi",
    "tiles.shiny.title": "Compiti Shiny di oggi",

    "tiles.hqRequirements.title": "Requisiti HQ {level}",
    "tiles.hqRequirements.fallback": "Requisiti HQ",
    "tiles.hqRequirements.noHq": "Livello HQ non impostato.",
    "tiles.hqRequirements.noData":
      "Nessun dato sui requisiti trovato.",

    "tiles.researchStatus.title": "Stato ricerca",
    "tiles.researchStatus.empty":
      "Nessuna categoria di ricerca tracciata.",

    "tiles.currentlyUpgrading.title": "Aggiornamenti in corso",
    "tiles.currentlyUpgrading.description":
      "Includono ricerche in corso e edifici segnati come in upgrade o con priorità.",
    "tiles.currentlyUpgrading.empty":
      "Nessun upgrade in corso. Avvia ricerche o segna edifici con upgrade o priorità.",

    "tiles.nextUp.title": "Prossimi",
    "tiles.nextUp.empty":
      "Niente in coda. Imposta ricerca o edifici come tracciati o con priorità.",

    "links.heroes.title": "Eroi",
    "links.heroes.description": "Gestisci squadre, potere e equipaggiamento.",
    "links.buildings.title": "Edifici",
    "links.buildings.description": "Ottimizza base e upgrade.",
    "links.research.title": "Ricerca",
    "links.research.description": "Pianifica il percorso di ricerca.",
    "links.groupDashboard.title": "Dashboard di gruppo",
    "links.groupDashboard.description":
      "Mostra statistiche condivise per 977 e 982.",

    "lang.label": "Lingua",
    "lang.en": "Inglese",
    "lang.de": "Tedesco",
    "lang.it": "Italiano",
    "lang.ar": "Arabo",
  },
  ar: {
    "app.name": "مركز قيادة لاست وور",

    "dashboard.title": "لوحة تحكم لاست وور",
    "dashboard.subtitle":
      "تابع قاعدتك والفرق والترقية في مكان واحد.",

    "header.hq": "المقر",
    "header.totalHeroPower": "قوة الأبطال الكلية",

    "tiles.vsToday.title": "تحديات اليوم",
    "tiles.armsRace.title": "سباق التسلح اليوم",
    "tiles.shiny.title": "مهام شايـني اليوم",

    "tiles.hqRequirements.title": "متطلبات المقر {level}",
    "tiles.hqRequirements.fallback": "متطلبات المقر",
    "tiles.hqRequirements.noHq": "مستوى المقر غير محدد.",
    "tiles.hqRequirements.noData": "لا توجد بيانات متطلبات.",

    "tiles.researchStatus.title": "حالة البحث",
    "tiles.researchStatus.empty":
      "لا توجد فئات بحث متابَعة بعد.",

    "tiles.currentlyUpgrading.title": "الترقيات الجارية",
    "tiles.currentlyUpgrading.description":
      "تشمل الأبحاث الجارية والمباني المحددة كترقية أو لها أولوية.",
    "tiles.currentlyUpgrading.empty":
      "لا توجد ترقيات حاليا. ابدأ بحثا أو حدّد مباني للترقية.",

    "tiles.nextUp.title": "التالي",
    "tiles.nextUp.empty":
      "لا شيء في قائمة الانتظار. حدّد أبحاثا أو مباني للمتابعة أو أضف أولوية.",

    "links.heroes.title": "الأبطال",
    "links.heroes.description": "إدارة الفرق وقوة الأبطال والتجهيز.",
    "links.buildings.title": "المباني",
    "links.buildings.description": "اضبط قاعدتك والترقيات.",
    "links.research.title": "البحث",
    "links.research.description": "خطط لمسار البحث.",
    "links.groupDashboard.title": "لوحة المجموعة",
    "links.groupDashboard.description":
      "عرض الإحصاءات المشتركة للخوادم 977 و 982.",

    "lang.label": "اللغة",
    "lang.en": "الإنجليزية",
    "lang.de": "الألمانية",
    "lang.it": "الإيطالية",
    "lang.ar": "العربية",
  },
};
