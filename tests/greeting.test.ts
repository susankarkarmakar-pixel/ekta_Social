import { describe, expect, it } from "vitest";
import { getGreetingCopyKey } from "../lib/apongram/greeting";

describe("getGreetingCopyKey", () => {
  it.each([
    [0, "greetingNight"],
    [4, "greetingNight"],
    [5, "greetingMorning"],
    [11, "greetingMorning"],
    [12, "greetingAfternoon"],
    [16, "greetingAfternoon"],
    [17, "greetingEvening"],
    [19, "greetingEvening"],
    [20, "greetingNight"],
    [23, "greetingNight"],
  ] as const)("selects the expected greeting at local hour %i", (hour, expected) => {
    const fixedNow = new Date(2026, 9, 19, hour, 0, 0, 0);
    expect(getGreetingCopyKey(fixedNow)).toBe(expected);
  });
});
