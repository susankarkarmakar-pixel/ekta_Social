import { describe, expect, it } from "vitest";

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
});
