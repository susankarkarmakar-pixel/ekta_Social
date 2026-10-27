import re

with open('tests/repository.test.ts', 'r') as f:
    content = f.read()

# I want to accept BOTH changes or just keep the one I added since it tests the actual implementation and not just a simulation.
# Or I could keep both. Let's look at the image from the user: "Resolve Conflicts". The user is showing the github UI where both tests are present.
# The user wants me to resolve the merge conflict.

resolved_content = """import { describe, it, expect, vi, beforeEach } from "vitest";
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

describe("Feed Cache Merge bug", () => {
  it("fresh server posts take precedence over cached posts when IDs match", () => {
    const source = [{ id: "1", body: "Fresh body", likes: 10 }];
    const cachedFeed = [{ id: "1", body: "Stale body", likes: 5 }, { id: "2", body: "Cached 2" }];

    // Simulate what getFeedPage and syncFeedCache do with the fix
    const merged = [...source, ...cachedFeed];
    const uniqueMap = new Map();
    for (const item of merged) {
      if (!uniqueMap.has(item.id)) uniqueMap.set(item.id, item);
    }
    const unique = [...uniqueMap.values()];

    expect(unique.length).toBe(2);
    expect(unique[0].body).toBe("Fresh body");
    expect(unique[0].likes).toBe(10);
    expect(unique[1].body).toBe("Cached 2");
  });
});"""

with open('tests/repository.test.ts', 'w') as f:
    f.write(resolved_content)
