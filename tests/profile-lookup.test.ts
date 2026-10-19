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
    supabaseConfig: { isConfigured: true },
    supabaseFetch: vi.fn().mockResolvedValue([]),
    storagePublicUrl: vi.fn((bucket, path) => `http://storage/${bucket}/${path}`),
  };
});

describe("profile-lookup", () => {
  afterEach(() => {
    mockStorage = {};
    vi.clearAllMocks();
  });

  it("getProfilesByIds falls back to mock profiles for demo ids", async () => {
    const { getProfilesByIds } = await import("../lib/apongram/profile-lookup");
    const { profiles: mockProfiles } = await import("../lib/apongram/mock-data");
    const supabase = await import("../lib/apongram/supabase");

    // Call with a mock profile ID
    const mockId = mockProfiles[0].id;
    const result = await getProfilesByIds([mockId]);

    expect(result.get(mockId)?.name).toBe(mockProfiles[0].name);
    // Should not hit network for mock ids
    expect(supabase.supabaseFetch).not.toHaveBeenCalled();
  });

  it("fetches missing ids from network when Supabase is configured", async () => {
    const { getProfilesByIds } = await import("../lib/apongram/profile-lookup");
    const supabase = await import("../lib/apongram/supabase");

    const validUuid = "123e4567-e89b-12d3-a456-426614174000";

    // Mock the supabase fetch response
    (supabase.supabaseFetch as any).mockResolvedValueOnce([
      { id: validUuid, name: "Remote User" }
    ]);

    const result = await getProfilesByIds([validUuid]);

    expect(supabase.supabaseFetch).toHaveBeenCalledTimes(1);
    expect(result.get(validUuid)?.name).toBe("Remote User");
  });
});
