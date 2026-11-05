import { describe, expect, it } from "vitest";
import { getEntryRoute } from "../lib/apongram/auth-routing";

describe("getEntryRoute", () => {
  it("routes a user without a session to email OTP sign-in", () => {
    expect(getEntryRoute(null)).toBe("/auth/phone");
  });

  it("routes a user with a session into the app", () => {
    expect(getEntryRoute("access-token")).toBe("/(tabs)");
  });
});
