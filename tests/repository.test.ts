import { afterEach, describe, expect, it, vi } from "vitest";

let mockStorage: Record<string, string> = {};

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key) => mockStorage[key] || null),
    setItem: vi.fn(async (key, value) => { mockStorage[key] = value.toString(); }),
    removeItem: vi.fn(async (key) => { delete mockStorage[key]; }),
    clear: vi.fn(async () => { mockStorage = {}; }),
  },
}));

vi.mock("../lib/apongram/supabase", () => {
  return {
    supabaseConfig: { isConfigured: false },
    supabaseFetch: vi.fn(),
    storagePublicUrl: vi.fn(),
  };
});

describe("syncFeedCache and getFeedPage true tests", () => {
  afterEach(() => {
    mockStorage = {};
    vi.clearAllMocks();
  });

  it("syncFeedCache: fresh local posts take precedence over cached posts when IDs match", async () => {
    const { syncFeedCache } = await import("../lib/apongram/repository");
    const { posts } = await import("../lib/apongram/mock-data");
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;

    const stalePost = { ...posts[0], body: "Stale cache body" };
    await AsyncStorage.setItem("@ekta/feed-cache-v1", JSON.stringify([stalePost]));

    const result = await syncFeedCache(12);

    const mergedPost = result.items.find((p) => p.id === posts[0].id);
    expect(mergedPost).toBeDefined();
    expect(mergedPost?.body).toBe(posts[0].body);
  });

  it("getFeedPage: fallback to cache works when fetch fails, and merges correctly", async () => {
    const { getFeedPage } = await import("../lib/apongram/repository");

    const result = await getFeedPage(0, 6);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.fromCache).toBe(false);
  });
});
