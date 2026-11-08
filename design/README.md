# Ownling design handoff

The design for the Ownling game app (`app/`) and the wake-anywhere client (`wake/`).
It was exported from the Ownling design canvas on Nov 7, 2026. **Layout, copy and art are final.
Build the screens with real components. Don't paste the static HTML into the app.**

Start with `screens/*.png`. They show what each screen must look like.

## What's in this folder

| Path | What it is | How to use it |
|---|---|---|
| `tokens.css` | Colors, type, radii, sizes as CSS variables, light and dark | Import once at the app root. Use `var(--ow-*)` in the game and `var(--proof-*)` on proof surfaces |
| `tokens.json` | Same tokens as data | For Tailwind config, React Native, or anything that isn't CSS |
| `mochi/mochi.ts` | The Mochi renderer: pure TypeScript, no dependencies, returns an SVG string | Use it everywhere Mochi appears (app, wake client, wallet picture) |
| `mochi/svg/<stage>/<mood>.svg` | 20 static renders: 5 stages × 4 moods | Placeholders, previews, README, and anywhere you can't run code |
| `mochi/svg/moments/*.svg` | The 10 moments on a child Mochi | Reference for each moment |
| `mochi/svg/slots/*.svg` | Dressing slot guides per stage | For when outfits get built |
| `brand/` | App icon (SVG + 512/180/64 PNG), 32 px icon, 16 px favicon, logo mark, wallet picture `wallet-512.png` | `wallet-512.png` is the NFT media for Meteor's NFT tab |
| `screens/*.png` | The 9 phone screens (390×844 @2x) and the wake page | The visual target |
| `screens/*.html` | Static HTML of the same screens: exact markup, spacing and copy | Copy values and structure from here |
| `boards/*.png` | Brand system, character sheet, moments, UI elements | Reference |
| `source/*.dc.html` | The original canvas sources | Only needed to edit the design itself |

## Mochi

```ts
import { renderMochi, stageFor, moodFor, runwayDays, MOCHI_CSS } from '../design/mochi/mochi';

// Put MOCHI_CSS in a <style> tag once per page (float, bounce and thinking-dot animations).
const svg = renderMochi({
  stage: stageFor(pet.growthPoints),              // egg 0 · baby 1–19 · child 20–74 · teen 75–199 · adult 200+
  mood: moodFor(pet.foodNear, pet.dailyCapNear),   // content ≥7 days · peckish <7 · hungry <2 · hibernating <0.0001 NEAR
  moment: 'none',                                  // see "Moments" below
  size: 270,
  name: pet.name,
});
el.innerHTML = svg;
```

React wrapper (only if `app/` uses React):

```tsx
export function Mochi(props: MochiOptions) {
  return <div className="mochi" dangerouslySetInnerHTML={{ __html: renderMochi(props) }} />;
}
```

`renderMochi` only builds markup from its own constants and the enum values you pass in, so the
inner HTML is safe. Don't pass free text from users into `title` or `name` without escaping;
the function escapes `"`, `<` and `&`, but keep pet names validated anyway.

- **Growth points** = messages answered + times played.
- **Food** is the pet's NEAR budget held for it. **Daily cap** defaults to 0.02 NEAR. Convert from yocto before calling `moodFor`.
- **Runway**: `runwayDays(food, cap)` gives days of thinking left. Show "Mochi can think for N more days" (rounded down, "1 more day" when singular). When food isn't loaded yet, `runwayDays` returns `null`: show "—", never 0.
- Every layer carries a `data-layer` attribute named like the handbook asked (`mochi/child/body`, `mochi/face/eyes-happy`, `mochi/prop/raindrop`), so you can target parts for animation.
- `prefers-reduced-motion` turns off every animation (handled in `MOCHI_CSS`).

### Moments: when to set each one

| Moment | Trigger | Ends |
|---|---|---|
| `thinking` | Message sent, waiting for the kitchen | Reply arrives |
| `talking` | Reply is streaming or typing in | ~1.5 s after the last character |
| `verified` | Reply's proof check passed | ~2 s, then back to `none` |
| `eating` | Feed transaction confirmed | 1.5 s |
| `playing` | Play tapped (bond and growth go up) | ~2 s, then `resting` |
| `resting` | Play cooldown (10 min) is running | Cooldown ends |
| `waking` | Pet opened in the wake-anywhere client, or woken from hibernation | ~3 s |
| `gifting` | Give-away screen and transfer confirmation | Screen closes |
| `talking` on `stage: 'egg'` | First message ever: the hatching moment | Reply arrives from the new baby |

Mood always wins over moments when `hibernating`: a sleeping Mochi can't play or talk.

## Screens

Routes are suggestions. Every screen is a 390 px wide phone layout. On desktop, center it in a max-width 430 px column on `--ow-mist`.

| # | Screen | File | Shows | Main action (the only filled button) |
|---|---|---|---|---|
| 01 | Welcome | `01-welcome` | Logo, baby Mochi floating, "A pet that owns itself." plus the ownership promise | **Sign in with email**; secondary "Use a NEAR wallet" |
| 02 | Adopt | `02-adopt` | Egg, name field (default "Mochi"), starter food card with amount, destination and cap | **Adopt Mochi** |
| 03 | Home | `03-home` | Name + mood dot + stage, diary and ownership icon buttons, Mochi's last line in a bubble, Mochi 270 px, runway meter card, Feed / Play / Talk tiles | **Talk** |
| 04 | Talk | `04-chat` | Header with mini Mochi + runway, bubbles, a proof tag under every Mochi reply, expandable proof details, thinking Mochi + Pending tag while waiting, composer | **Send** |
| 05 | Feed | `05-feed` | Bottom sheet over a dimmed home: Drizzle / Shower / Storm, money details (from, to, daily cap, days after), the "food stays with Mochi" note | **Feed 0.1 NEAR** (label shows the chosen amount) |
| 06 | Hibernating | `06-hibernating` | Grey sleeping Mochi, "Mochi can't afford a thought", nothing-is-lost copy | **Wake up** (feeds 0.1 NEAR, then plays `waking`) |
| 07 | Diary | `07-diary` | Lock status, the key explanation, dated memory entries, storage size | **Lock / Unlock** |
| 08 | Who controls Mochi | `08-ownership` | Proof style (`--proof-*`, Schibsted Grotesk). What we can do, what we can't do, mono facts (contract, kitchen, model, cap, admin keys) | **Change kitchen** (wallet confirmation) |
| 09 | Give away | `09-gift` | Mochi with bow, "Goes with Mochi" vs "Stays with you", receiver account field, can't-be-undone warning | **Give Mochi** (wallet confirmation) |
| — | Wake-anywhere | `wake` | Standalone single file in proof style. Status chips (Ownling app unreachable, contract and NEAR AI reachable), account + sign in, what was read from NEAR, Mochi `waking` + verified reply | **Sign in**, then **Send** |

Navigation: Welcome → Adopt → Home. From Home: Feed opens a sheet, Talk opens chat, the lock icon opens the diary, the shield opens ownership. Give away is reached from ownership. When the mood is `hibernating`, Home is replaced by screen 06.

## Components to build once

- **ProofTag**: pill with a dot plus a word. States: `verified` (`--ow-proof` on `--ow-proof-wash`), `pending` (`--ow-drizzle-ink` on `--ow-drizzle-wash`), `no proof` (`--ow-none-ink` on `--ow-none-wash`). Show "Verified" **only** when the attestation check passed. Practice mode always shows "No proof". Tapping it expands proof details: plain sentence, cost, model, receipt hash in mono, and a link to NEAR AI's Verification Center.
- **RunwayMeter**: line of text plus a 10–12 px bar on `--ow-puddle`. The bar fills to 30 days. Fill color follows mood: rain (content), drizzle (peckish), storm (very hungry), sleep (hibernating).
- **MoodLine**: dot plus "Content · Child". Dot colors are in `tokens.json → color.moodDot`.
- **ActionTiles**: 3 tiles, 64 px tall, radius 20. Only Talk is filled. During cooldown, Play's label becomes "Rest 9:58" (counting down).
- **MoneyDetails**: the "before money moves" block. From, to, daily cap and result, with amounts and accounts in mono, placed right above the button. Use it on Adopt, Feed, Wake up, Change kitchen and Give.
- **Bubble**: you on the right in `--ow-rain` (tail bottom-right, radius `20 20 6 20`); Mochi on the left on paper or puddle (tail bottom-left). Action text like `*wiggles happily*` is rendered in italics.
- **Sheet**: radius 28 on top, 40×5 grab handle, scrim `--ow-scrim`.

## Copy and voice rules (from NEAR AI, applied to everything on screen)

- Sentence case. No exclamation marks, no emoji, no apologies in errors.
- Buttons are one or two verbs: Feed, Play, Talk, Wake up, Adopt Mochi, Give Mochi. Never "OK".
- Proof, not promises. Never write "private", "secure" or "encrypted" as a claim; say what happens to the data ("We never see it, so we can't read this").
- Concede limits first. Write to "you". The kitchen briefly sees messages in memory, and the ownership page says so.
- Status is a dot plus words. Unknown values show "—", never 0.
- **Mochi's own voice**: at most two short sentences, warm and a little playful, small actions in asterisks. It never mentions AI, models, blockchains or money.
- **No crypto imagery in the game**: no coins, tokens or chain logos near the pet. Food is rain. NEAR amounts appear only in MoneyDetails, the runway sub-line and proof details, always in mono.

## Accessibility

- Touch targets are at least 44 px. Icon-only buttons have `aria-label` ("Mochi's diary", "Who controls Mochi", "Send", "Back").
- Mochi's SVG has `role="img"` and an `aria-label` like "Mochi, child, content". Update it when state changes.
- Every text and background pair in `tokens.css` passes 4.5:1 in both themes.
- Use real `<button>`, `<a>`, `<input>` and `<label>`.

## Assumptions (confirmed Nov 8, 2026)

1. **Feed portions: confirmed.** Drizzle 0.02, Shower 0.1 and Storm 0.5 NEAR (1, 5 and 25 days at the default cap). Wake up feeds 0.1, which lands a hibernating pet on "peckish": awake, still hinting at food. Days are counted at the full daily cap, so they're the minimum Mochi lasts. On testnet, MoneyDetails labels amounts as testnet NEAR.
2. **Wake client billing: confirmed.** The owner pastes their own NEAR AI key. It stays in that browser tab and is sent only to NEAR AI, which accepts calls straight from a web page (checked Nov 8). Mochi's food isn't touched there, because only its chosen kitchen can charge it. The page can also point to the long-term path: Change kitchen (screen 08) moves Mochi to another kitchen, and its own food pays again.
3. **Placeholder content**: diary entries, chat lines and numbers (23 days, 0.46 NEAR, growth 34) are examples.
4. Fonts load from Google Fonts. Self-host them with `@fontsource/nunito`, `@fontsource/schibsted-grotesk` and `@fontsource/jetbrains-mono` if the hosted demo must work offline.
