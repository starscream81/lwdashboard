'use client';

import { useEffect, useState } from 'react';
import {
  collectionGroup,
  DocumentData,
  getDocs,
  limit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  startAfter,
} from 'firebase/firestore';
// TODO: Adjust this import to match your Firebase setup
import { db } from '@/lib/firebase';

type Profile = {
  id: string;
  serverId: number | string;
  avatarUrl?: string;
  displayName: string;
  alliance?: string;
  totalHeroPower?: number;
};

const PAGE_SIZE = 25;

// TODO: Replace this with your real i18n hook.
// For now this keeps everything functional and uses the keys we agreed on.
function useWhosHereTranslations() {
  const t = (key: string) => {
    switch (key) {
      case 'extras.whoshere.title':
        return "Who's Here";
      case 'extras.whoshere.totalHeroPowerLabel':
        return 'Total Hero Power';
      case 'extras.whoshere.loadMore':
        return 'Load more';
      case 'extras.whoshere.noMoreResults':
        return 'No more results';
      case 'extras.whoshere.emptyTitle':
        return 'No accounts found';
      case 'extras.whoshere.emptyDescription':
        return 'Once players create profiles, they will appear here.';
      default:
        return key;
    }
  };

  return { t };
}

export default function WhosHerePage() {
  const { t } = useWhosHereTranslations();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setError(null);

    try {
      let baseQuery = query(
        collectionGroup(db, 'profiles'),
        limit(PAGE_SIZE),
      );

      if (lastDoc) {
        baseQuery = query(
          collectionGroup(db, 'profiles'),
          startAfter(lastDoc),
          limit(PAGE_SIZE),
        );
      }

      const snapshot = await getDocs(baseQuery);

      console.log('[Who’s Here] snapshot size:', snapshot.size);
      snapshot.docs.forEach((doc) => {
      console.log('[Who’s Here] doc path:', doc.ref.path, 'data:', doc.data());
      });

      if (snapshot.empty) {
        if (!lastDoc) {
          setProfiles([]);
        }
        setHasMore(false);
        return;
      }

      const newProfiles: Profile[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          serverId: data.serverId,
          avatarUrl: data.avatarUrl,
          displayName: data.displayName ?? '',
          alliance: data.alliance,
          totalHeroPower:
            typeof data.totalHeroPower === 'number' ? data.totalHeroPower : undefined,
        };
      });

      setProfiles((prev) => [...prev, ...newProfiles]);

      const lastVisible = snapshot.docs[snapshot.docs.length - 1];
      setLastDoc(lastVisible);

      if (snapshot.size < PAGE_SIZE) {
        setHasMore(false);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load accounts.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // initial load
    void loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderAvatar = (profile: Profile) => {
    if (profile.avatarUrl) {
      return (
        <img
          src={profile.avatarUrl}
          alt={profile.displayName || 'Avatar'}
          className="h-10 w-10 rounded-full object-cover"
        />
      );
    }

    const initial = profile.displayName?.charAt(0)?.toUpperCase() ?? '?';

    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-700 text-sm font-semibold text-white">
        {initial}
      </div>
    );
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold">{t('extras.whoshere.title')}</h1>
      </header>

      {error && (
        <div className="rounded-md border border-red-500 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {profiles.length === 0 && !isLoading ? (
        <div className="rounded-lg border px-4 py-8 text-center text-sm text-gray-500">
          <div className="mb-1 text-base font-medium">
            {t('extras.whoshere.emptyTitle')}
          </div>
          <div>{t('extras.whoshere.emptyDescription')}</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="flex h-full flex-col justify-between rounded-lg border bg-black/30 p-4"
            >
              {/* Top line: server */}
              <div className="mb-2 text-xs text-gray-400">
                {profile.serverId !== undefined && profile.serverId !== null
                  ? `Server ${profile.serverId}`
                  : ''}
              </div>

              {/* Middle: avatar, name, alliance */}
              <div className="flex flex-1 items-center gap-3">
                {renderAvatar(profile)}
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {profile.displayName || 'Unnamed player'}
                  </span>
                  {profile.alliance && (
                    <span className="text-xs text-gray-400">
                      [{profile.alliance}]
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom: total hero power */}
              <div className="mt-4 flex justify-end text-xs text-gray-300">
                {typeof profile.totalHeroPower === 'number' ? (
                  <span>
                    {/* TODO: hook this up to your useFormatter helper once you add it here */}
                    {profile.totalHeroPower.toLocaleString()}{' '}
                    {t('extras.whoshere.totalHeroPowerLabel')}
                  </span>
                ) : (
                  <span className="italic text-gray-500">
                    {t('extras.whoshere.totalHeroPowerLabel')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-center">
        {hasMore && (
          <button
            type="button"
            onClick={loadPage}
            disabled={isLoading}
            className="rounded-md border px-4 py-2 text-sm disabled:opacity-60"
          >
            {isLoading ? 'Loading…' : t('extras.whoshere.loadMore')}
          </button>
        )}
        {!hasMore && profiles.length > 0 && (
          <div className="text-xs text-gray-500">
            {t('extras.whoshere.noMoreResults')}
          </div>
        )}
      </div>
    </div>
  );
}
