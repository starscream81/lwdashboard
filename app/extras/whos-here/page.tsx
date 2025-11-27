"use client";

import { useEffect, useState } from "react";
import {
  collectionGroup,
  DocumentData,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  QueryDocumentSnapshot,
  startAfter,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useLanguage } from "../../i18n/LanguageProvider";

type Profile = {
  id: string;
  path: string;
  serverId: number | string | null;
  avatarUrl?: string;
  displayName: string;
  alliance?: string;
  totalHeroPower?: number;
};

const PAGE_SIZE = 25;

// Helper function for K/M abbreviation (same logic as dashboard)
function formatHeroPower(power: number | null | undefined): string {
  if (power == null || power === 0) return "0";

  const num = Math.round(power);

  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  }

  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  }

  return num.toLocaleString();
}

export default function WhosHerePage() {
  const { t } = useLanguage();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = async (shouldReset = false) => {
    if (isLoading) return;
    if (!hasMore && !shouldReset) return;

    setIsLoading(true);
    setError(null);

    let currentLastDoc = lastDoc;
    if (shouldReset) {
      setProfiles([]);
      currentLastDoc = null;
      setHasMore(true);
    }

    const orderField = "__name__";
    const orderDirection = "asc";

    let baseQuery = query(
      collectionGroup(db, "profiles"),
      orderBy(orderField, orderDirection as "asc" | "desc"),
      limit(PAGE_SIZE)
    );

    if (currentLastDoc) {
      baseQuery = query(
        collectionGroup(db, "profiles"),
        orderBy(orderField, orderDirection as "asc" | "desc"),
        startAfter(currentLastDoc),
        limit(PAGE_SIZE)
      );
    }

    try {
      const snapshot = await getDocs(baseQuery);

      if (snapshot.empty) {
        setHasMore(false);
        if (shouldReset) setProfiles([]);
        return;
      }

      const newProfiles: Profile[] = snapshot.docs.map((snap) => {
        const data = snap.data();
        return {
          id: snap.id,
          path: snap.ref.path,
          serverId: data.serverId ?? null,
          avatarUrl: data.avatarUrl,
          displayName: data.displayName ?? "",
          alliance: data.alliance,
          totalHeroPower:
            typeof data.totalHeroPower === "number"
              ? data.totalHeroPower
              : undefined,
        };
      });

      setProfiles((prev) => {
        if (shouldReset) {
          return newProfiles;
        }

        const existingPaths = new Set(prev.map((p) => p.path));
        const uniqueNewProfiles = newProfiles.filter(
          (p) => !existingPaths.has(p.path)
        );

        return [...prev, ...uniqueNewProfiles];
      });

      const lastVisible = snapshot.docs[snapshot.docs.length - 1];
      setLastDoc(lastVisible);
      setHasMore(snapshot.size === PAGE_SIZE);
    } catch (err) {
      console.error(err);
      setError(
        "Failed to load accounts. Ensure your Firebase index for (__name__) exists."
      );
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Optional debug: direct getDoc for your own profile
  useEffect(() => {
    const run = async () => {
      try {
        const uid = "6FGO4OpqkdbA34amGS4Y8ZwuHWX2";
        const ref = doc(db, "users", uid, "profiles", "default");
        const snap = await getDoc(ref);
        console.log("[DEBUG] Direct getDoc for your profile:", snap.data());
      } catch (err) {
        console.error("[DEBUG] Error reading direct profile doc:", err);
      }
    };
    void run();
  }, []);

  const renderAvatar = (profile: Profile) => {
    if (profile.avatarUrl) {
      return (
        <img
          src={profile.avatarUrl}
          alt={profile.displayName || "Avatar"}
          className="h-10 w-10 rounded-full object-cover"
        />
      );
    }

    const initial = profile.displayName?.charAt(0)?.toUpperCase() ?? "?";

    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-700 text-sm font-semibold text-white">
        {initial}
      </div>
    );
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold">
          {t("extras.whoshere.title")}
        </h1>
      </header>

      {error && (
        <div className="rounded-md border border-red-500 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {profiles.length === 0 && !isLoading && !hasMore ? (
        <div className="rounded-lg border px-4 py-8 text-center text-sm text-gray-500">
          <div className="mb-1 text-base font-medium">
            {t("extras.whoshere.emptyTitle")}
          </div>
          <div>{t("extras.whoshere.emptyDescription")}</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => {
            const pathParts = profile.path.split("/");
            const uid = pathParts[2];
            const displayId = uid.substring(0, 8);
            const isTrulyEmpty =
              profile.displayName === "" && !profile.alliance;
            const finalDisplayName =
              profile.displayName ||
              (isTrulyEmpty
                ? `User ID: ${displayId}...`
                : t("extras.whoshere.unnamedPlayer"));

            return (
              <div
                key={profile.path}
                className="flex h-full flex-col justify-between rounded-lg border bg-black/30 p-4"
              >
                <div className="mb-2 text-xs text-gray-400">
                  {profile.serverId !== undefined &&
                  profile.serverId !== null &&
                  profile.serverId !== ""
                    ? `${t("extras.whoshere.serverLabel")} ${
                        profile.serverId
                      }`
                    : ""}
                </div>

                <div className="flex flex-1 items-center gap-3">
                  {renderAvatar(profile)}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {finalDisplayName}
                    </span>
                    {profile.alliance && (
                      <span className="text-xs text-gray-400">
                        [{profile.alliance}]
                      </span>
                    )}
                    {isTrulyEmpty && (
                      <span className="text-xs text-orange-400 italic">
                        {t("extras.whoshere.noProfileData")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex justify-end text-xs text-gray-300">
                  {typeof profile.totalHeroPower === "number" &&
                  profile.totalHeroPower >= 0 ? (
                    <span className="font-semibold text-white">
                      {formatHeroPower(profile.totalHeroPower)}{" "}
                      <span className="text-gray-400 font-normal">
                        {t("extras.whoshere.totalHeroPowerLabel")}
                      </span>
                    </span>
                  ) : (
                    <span className="italic text-gray-500">
                      {t("extras.whoshere.totalHeroPowerLabel")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex justify-center">
        {hasMore && (
          <button
            type="button"
            onClick={() => loadPage(false)}
            disabled={isLoading}
            className="rounded-md border px-4 py-2 text-sm disabled:opacity-60"
          >
            {isLoading
              ? t("extras.whoshere.loading")
              : t("extras.whoshere.loadMore")}
          </button>
        )}
        {!hasMore && profiles.length > 0 && (
          <div className="text-xs text-gray-500">
            {t("extras.whoshere.noMoreResults")}
          </div>
        )}
      </div>
    </div>
  );
}
