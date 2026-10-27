import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncFeedCache } from "../lib/apongram/repository";
import { posts } from "../lib/apongram/mock-data";
import AsyncStorage from "@react-native-async-storage/async-storage";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

describe("Feed Cache Merge", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("prioritizes fresh source data over cached data on duplicate IDs", async () => {
    const firstPostId = posts.find((p) => !p.isStory)?.id ?? "post-1";

    const staleCachedPost = {
      id: firstPostId,
      body: "stale content",
      authorName: "Stale",
    };
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(
      JSON.stringify([staleCachedPost]),
    );

    const result = await syncFeedCache(10);

    const mergedItem = result.items.find((item) => item.id === firstPostId);
    expect(mergedItem?.body).not.toBe("stale content");
    expect(mergedItem?.body).toBe(
      posts.find((p) => p.id === firstPostId)?.body,
    );
  });
});
