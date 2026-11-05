export type EntryRoute = "/(tabs)" | "/auth/phone";

export function getEntryRoute(accessToken: string | null): EntryRoute {
  return accessToken ? "/(tabs)" : "/auth/phone";
}
