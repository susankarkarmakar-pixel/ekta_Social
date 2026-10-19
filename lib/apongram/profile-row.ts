import type { Profile } from "./types";

export type RemoteProfileRow = {
  id: string;
  name?: string | null;
  handle?: string | null;
  bio?: string | null;
  avatar_path?: string | null;
  region?: string | null;
  pronouns?: string | null;
  website?: string | null;
  category?: Profile["category"] | null;
};

export const FALLBACK_AVATAR_COLOR = "#365C57";

export function mapProfileRow(
  row: RemoteProfileRow,
  resolveAvatarUrl: (path: string) => string | undefined
): Profile {
  const name = row.name || "Unknown";
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  let avatarUrl: string | undefined;
  if (row.avatar_path) {
    if (row.avatar_path.startsWith("http")) {
      avatarUrl = row.avatar_path;
    } else {
      avatarUrl = resolveAvatarUrl(row.avatar_path);
    }
  }

  return {
    id: row.id,
    name,
    handle: row.handle || "unknown",
    bio: row.bio || "",
    initials,
    avatarColor: FALLBACK_AVATAR_COLOR,
    avatarUrl,
    region: row.region || "India",
    pronouns: row.pronouns || undefined,
    website: row.website || undefined,
    category: row.category || undefined,
    followers: 0,
    following: 0,
  };
}

export function buildProfilesQuery(ids: string[]): string | null {
  const validIds = Array.from(new Set(ids.filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))).slice(0, 50);
  if (validIds.length === 0) return null;
  const list = validIds.map((id) => `"${id}"`).join(",");
  return `profiles?select=id,name,handle,bio,avatar_path,region,pronouns,website,category&id=in.(${list})`;
}

export type CacheEntry<T> = { value: T; timestamp: number };

export function isFresh<T>(entry: CacheEntry<T> | undefined, now: number, ttlMs: number): boolean {
  if (!entry) return false;
  return now - entry.timestamp < ttlMs;
}

export function pruneCache<K, T>(entries: Map<K, CacheEntry<T>>, max: number): void {
  if (entries.size <= max) return;
  const sorted = Array.from(entries.entries()).sort((a, b) => b[1].timestamp - a[1].timestamp);
  entries.clear();
  for (const [k, v] of sorted.slice(0, max)) {
    entries.set(k, v);
  }
}
