# Rules for every task in this repo (eKta Social)

## Project
- eKta (একতা) is a Bengali-first community app for India, piloting with residents of Gazole Block, Malda, West Bengal.
- Stack: Expo SDK 57, Expo Router, React Native, NativeWind, TypeScript, Supabase, pnpm. Do not add runtime dependencies unless the task says so.

## Language and copy
- Bengali is the default language. Every user-visible string needs a Bengali and an English version in the existing copy files (lib/apongram/types.ts `copy`, lib/apongram/safety-copy.ts, and similar). No hard-coded English in components.
- Use one Bengali term per concept across the app. Write natural Bengali, not word-by-word transliteration.

## Design
- Use theme tokens (theme.config.js, constants/theme.ts). Do not add new hex colours. Brand terracotta is #B4492A.
- Touch targets at least 44x44. Text at least 12px (Bengali at least 13px). Respect the `largeText` preference.
- The app is light-only for now.

## Honesty and safety
- Never put a service-role key or any secret in client code.
- Never claim something is saved, sent or live unless it is. Say plainly when something stays only on the device.
- Demo mode (Supabase not configured) must keep working and be clearly labelled. Sample data must never appear when Supabase is configured.
- Do not change RLS policies or existing migrations. New database changes go in a new migration file with the next free number; do not renumber old ones.

## Code and tests
- Put pure logic in files without React Native imports so vitest can test it (see lib/apongram/safety-core.ts when it exists).
- Tests must import and call the real function or module. Never copy logic into a test file and assert on the copy. Never write a test for behaviour the code does not have.
- Before finishing, run: pnpm check, pnpm lint, pnpm test, pnpm exec expo export --platform web. All must pass. Do not weaken or delete existing tests. If something cannot be run, say so.

## Pull requests
- One task = one branch = one small PR against main. Do not merge it.
- The PR description must say: what changed, what was NOT done, what could not be verified (for example real device, live Supabase), and include screenshots for UI changes.
- If the repo contradicts the task, stop and explain in the PR description instead of guessing.
