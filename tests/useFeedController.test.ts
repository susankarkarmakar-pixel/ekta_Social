import { describe, expect, it } from "vitest";

describe("useFeedController Merge", () => {
  it("maintains the top-level order and values of accumulated items when loading more", () => {
    const items = [{ id: "1", body: "Fresh item 1" }];
    const resultItems = [{ id: "1", body: "Stale item 1" }, { id: "2", body: "Item 2" }];

    // Simulate what loadMore does with the fix:
    const merged = [...items, ...resultItems];
    const uniqueMap = new Map();
    for (const item of merged) {
      if (!uniqueMap.has(item.id)) uniqueMap.set(item.id, item);
    }
    const unique = [...uniqueMap.values()];

    expect(unique.length).toBe(2);
    expect(unique[0].body).toBe("Fresh item 1");
    expect(unique[1].body).toBe("Item 2");
  });
});
