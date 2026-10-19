import { describe, expect, it } from "vitest";
import { mapProfileRow, buildProfilesQuery, isFresh, pruneCache } from "../lib/apongram/profile-row";
import { FALLBACK_AVATAR_COLOR } from "../lib/apongram/profile-row";

describe("profile-row", () => {
  describe("mapProfileRow", () => {
    it("maps a full remote row correctly with http avatar", () => {
      const row = {
        id: "123",
        name: "Test User",
        handle: "test_user",
        bio: "Bio",
        avatar_path: "https://example.com/avatar.jpg",
        region: "Dhaka",
        pronouns: "he/him",
        website: "test.com",
        category: "creator" as const,
      };

      const profile = mapProfileRow(row, () => "ignored");
      expect(profile).toEqual({
        id: "123",
        name: "Test User",
        handle: "test_user",
        bio: "Bio",
        initials: "TU",
        avatarColor: FALLBACK_AVATAR_COLOR,
        avatarUrl: "https://example.com/avatar.jpg",
        region: "Dhaka",
        pronouns: "he/him",
        website: "test.com",
        category: "creator",
        followers: 0,
        following: 0,
      });
    });

    it("uses resolveAvatarUrl for non-http paths", () => {
      const row = { id: "1", name: "User", avatar_path: "user1/123.jpg" };
      const profile = mapProfileRow(row, (path) => `https://bucket/${path}`);
      expect(profile.avatarUrl).toBe("https://bucket/user1/123.jpg");
    });

    it("handles null fields properly with defaults", () => {
      const row = { id: "1" };
      const profile = mapProfileRow(row, () => undefined);
      expect(profile.name).toBe("Unknown");
      expect(profile.initials).toBe("U");
      expect(profile.handle).toBe("unknown");
      expect(profile.region).toBe("India");
      expect(profile.avatarUrl).toBeUndefined();
    });
  });

  describe("buildProfilesQuery", () => {
    it("filters invalid UUIDs and duplicates, caps at 50", () => {
      const ids = [
        "123e4567-e89b-12d3-a456-426614174000",
        "invalid",
        "123e4567-e89b-12d3-a456-426614174000",
      ];
      // Add 60 more valid UUIDs
      for (let i = 0; i < 60; i++) {
        ids.push(`123e4567-e89b-12d3-a456-4266141740${i.toString().padStart(2, '0')}`);
      }

      const query = buildProfilesQuery(ids);
      expect(query).toContain("profiles?select=id,name,handle,bio,avatar_path,region,pronouns,website,category&id=in.(");

      const matchedIds = query!.match(/"[0-9a-f-]{36}"/g);
      expect(matchedIds).toHaveLength(50);
      expect(new Set(matchedIds).size).toBe(50);
    });

    it("returns null if no valid ids", () => {
      expect(buildProfilesQuery(["invalid", ""])).toBeNull();
      expect(buildProfilesQuery([])).toBeNull();
    });
  });

  describe("cache logic", () => {
    it("isFresh", () => {
      expect(isFresh(undefined, 100, 50)).toBe(false);
      expect(isFresh({ value: 1, timestamp: 100 }, 149, 50)).toBe(true);
      expect(isFresh({ value: 1, timestamp: 100 }, 151, 50)).toBe(false);
    });

    it("pruneCache", () => {
      const cache = new Map();
      cache.set("a", { value: 1, timestamp: 10 });
      cache.set("b", { value: 2, timestamp: 30 });
      cache.set("c", { value: 3, timestamp: 20 });

      pruneCache(cache, 2);
      expect(cache.size).toBe(2);
      expect(cache.has("b")).toBe(true); // highest timestamp
      expect(cache.has("c")).toBe(true);
      expect(cache.has("a")).toBe(false); // oldest
    });
  });
});
