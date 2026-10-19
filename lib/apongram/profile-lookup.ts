import AsyncStorage from "@react-native-async-storage/async-storage";
import { profiles as mockProfiles } from "./mock-data";
import { buildProfilesQuery, isFresh, mapProfileRow, pruneCache } from "./profile-row";
import type { RemoteProfileRow, CacheEntry } from "./profile-row";
import { supabaseConfig, supabaseFetch, storagePublicUrl } from "./supabase";
import type { Profile } from "./types";

const ASYNC_CACHE_KEY = "@ekta/profile-cache-v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_ENTRIES = 200;

const memoryCache = new Map<string, CacheEntry<Profile>>();

async function loadAsyncCache(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(ASYNC_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CacheEntry<Profile>>;
    const now = Date.now();
    for (const [id, entry] of Object.entries(parsed)) {
      if (isFresh(entry, now, CACHE_TTL_MS)) {
        memoryCache.set(id, entry);
      }
    }
    pruneCache(memoryCache, MAX_CACHE_ENTRIES);
  } catch {
    // Ignore async storage errors
  }
}

async function saveAsyncCache(): Promise<void> {
  try {
    const data = Object.fromEntries(memoryCache.entries());
    await AsyncStorage.setItem(ASYNC_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignore async storage errors
  }
}

export async function getProfilesByIds(ids: string[]): Promise<Map<string, Profile>> {
  const result = new Map<string, Profile>();
  const missingIds = new Set<string>();
  const now = Date.now();

  if (memoryCache.size === 0) {
    await loadAsyncCache();
  }

  for (const id of ids) {
    // 1. Check mock data
    const mockProfile = mockProfiles.find((p) => p.id === id);
    if (mockProfile) {
      result.set(id, mockProfile);
      continue;
    }

    // 2. Check memory cache
    const cached = memoryCache.get(id);
    if (isFresh(cached, now, CACHE_TTL_MS)) {
      result.set(id, cached!.value);
      continue;
    }

    // 3. Mark as missing for network fetch
    if (!supabaseConfig.isConfigured && id.startsWith("user-")) {
      // Create a dummy for demo mode if it wasn't in mock data but looks like a demo user
      result.set(id, mapProfileRow({ id, name: "Demo User", handle: "demo" }, () => undefined));
      continue;
    }
    missingIds.add(id);
  }

  if (missingIds.size > 0 && supabaseConfig.isConfigured) {
    const query = buildProfilesQuery(Array.from(missingIds));
    if (query) {
      try {
        const rows = await supabaseFetch<RemoteProfileRow[]>(query);
        for (const row of rows) {
          const profile = mapProfileRow(row, (path) => storagePublicUrl("avatars", path));
          result.set(row.id, profile);
          memoryCache.set(row.id, { value: profile, timestamp: now });
        }
        pruneCache(memoryCache, MAX_CACHE_ENTRIES);
        await saveAsyncCache();
      } catch (e) {
        console.error("Failed to fetch profiles", e);
      }
    }
  }

  return result;
}

export async function getProfileById(id: string): Promise<Profile | undefined> {
  const map = await getProfilesByIds([id]);
  return map.get(id);
}
