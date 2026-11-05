export type GreetingCopyKey =
  | "greetingMorning"
  | "greetingAfternoon"
  | "greetingEvening"
  | "greetingNight";

export function getGreetingCopyKey(now: Date): GreetingCopyKey {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return "greetingMorning";
  if (hour >= 12 && hour < 17) return "greetingAfternoon";
  if (hour >= 17 && hour < 20) return "greetingEvening";
  return "greetingNight";
}
