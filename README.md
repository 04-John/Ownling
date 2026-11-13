# Ownling

Ownling is an AI pet that lives on NEAR instead of on our servers. It needs no wallet, pays for its own AI from a NEAR budget, keeps a diary only its owner can read, and keeps running if Ownling shuts down.

People who spend months talking to an AI companion don't own it. The company that runs it holds its memory and can change it, charge more for it or shut it down. Ownling puts the parts that matter on chain and in the owner's hands. The pet is an NFT. It pays for its own AI from a NEAR budget the owner tops up. Its diary is encrypted with a key only the owner can rebuild. Any client can wake it, not just ours.

- **Live demo (testnet):** https://ownling.onrender.com
- **Get the app:** https://ownling.onrender.com/download. There's an Android app (`Ownling.apk`) and a Windows installer (`Ownling-Setup.exe`), both attached to this repo's GitHub releases. On iPhone and Mac, you install it from the browser.
- **Pet contract:** [`pets.ownling.testnet`](https://testnet.nearblocks.io/address/pets.ownling.testnet)
- **License:** MIT

> **Status on Nov 11, 2026:** everything in the demo is live on testnet, and Mochi thinks on live NEAR AI. Each reply is signed in NEAR AI's sealed hardware and checked before the pet is charged. For example, [this charge](https://testnet.nearblocks.io/txns/HwXD7M5y49vCMZCBDiCkerQfZRCVs6FKXdic27E8vgCE) took 0.0000209 testnet NEAR from pet #2 for one reply, with the receipt `provider_tee|dc6db8cf…|57bfea1d…`: the signature kind, NEAR AI's completion id and the hash of the signed reply.

## Try it in 2 minutes (no wallet, no funds, no keys)

The free host sleeps after 15 idle minutes. If it was asleep, the first page load takes up to a minute.

| # | Do | See |
|---|---|---|
| 1 | Open https://ownling.onrender.com and tap **Next** twice | Three short steps: Mochi is an AI friend that remembers you, every thought costs a little food, and Mochi is yours, not ours. Then **Create my account**. |
| 2 | Tap **Create my account** | A 12-word recovery phrase. Behind it, the sponsor account `ownling.testnet` created a named account `cloud-NNNNN.ownling.testnet` for you, holding 1 testnet NEAR. The key exists only in your browser. |
| 3 | Tap **I saved it**, then **Adopt Mochi** | Home. `adopt` minted Mochi as an NFT and put the deposit, minus storage, into its food budget (0.49 testnet NEAR, "Mochi can think for 24 more days"). Mochi speaks first: the egg hatches with its first words. Under its name: "19 more chats or games until Mochi is a child". |
| 4 | Tap Mochi's head, tickle its tummy, stroke it, or hold your finger on it | Mochi reacts: hearts for a pat or a hug, a giggle for a tickle, a happy rumble when stroked. Poke it fast and it gets dizzy; keep going and it sulks under a tiny storm cloud. This runs on the device: no AI, no food. |
| 5 | Tap **Talk** and send "My name is Ada", or tap the microphone and say it | Mochi's reply with a tag under it: **Verified** if the NEAR AI signature on the reply checked out, **No proof** otherwise. Under it: "Mochi will remember: Their name is Ada". The kitchen charged Mochi's budget for that reply on chain. |
| 6 | Tap the waves icon (voice chat), tap **Start talking** and say "Let's play catch the rain", or ask "How much food do you have?" | Mochi says yes, and Catch the rain opens by itself. Asked about food, Mochi gives the real number of days its on-chain budget lasts. "Can I feed you a storm?" opens the food bowl on Storm, but nothing is paid until you tap **Feed**. Typed in Talk, the same requests open the same screens once Mochi has answered. |
| 7 | Tap **Play** | Three quick games that use no food and run on the device: **Catch the rain** (move Mochi to catch drops for 30 seconds; gold drops are worth 3, soot costs 2), **Mochi's tune** (Mochi sings a tune on four clouds and you repeat it; it grows a note each round) and **Echo** (say anything and Mochi says it back in a squeaky, thunder or canyon voice). Best scores stay on the device. |
| 8 | Tap **Play**, then **Riddles**, and answer | Mochi asks a riddle, gives a hint after a wrong guess, and says whether you solved it. A win shows "You won this round. Bond +1." and calls `play`, which adds a bond point on chain (at most one every 10 minutes). **Guess my thing** and **Would you rather** work the same way; Mochi remembers what you'd rather. |
| 9 | Tap **Feed**, choose **Shower**, then **Feed 0.1** | The runway grows by about 5 days. Food is the AI budget: 0.1 testnet NEAR moved from your account into Mochi's. The sheet shows what your account holds, and greys out portions it can't pay for (the food plus about 0.03 held for the network fee, mostly refunded). |
| 10 | Tap the hanger icon (top right) | **Mochi's wardrobe**: 9 items for three slots (hat, scarf, something to hold). The rain hat and umbrella are free. The others unlock as your bond grows from won games, or as Mochi grows up. Try some on, then tap **Wear this**: `dress` saves the outfit with the NFT, and the wallet picture (`nft_token` media) now shows Mochi wearing it. |
| 11 | Tap the lock icon (top right) | Mochi's diary, decrypted in your browser: "Things Mochi knows about you" and recent talks. The chain holds only ciphertext. |
| 12 | Tap the shield icon (top right) | **What we can and can't do with Mochi**: the contract, the kitchen allowed to charge the budget, the daily cap, and **Change kitchen**. |
| 13 | Close the app and open it again later | Mochi greets you first and asks about something you told it. Each chat and each game round counts toward growing up; at 20 Mochi becomes a child, with a new look and a new voice. |

Check step 3 on chain with [NEAR CLI](https://github.com/near/near-cli-rs), using the account name from step 2:

```bash
near contract call-function as-read-only pets.ownling.testnet pets_for_owner \
  json-args '{"account_id":"cloud-NNNNN.ownling.testnet"}' network-config testnet now
```

You get your pet's `token_id`, `name`, `stage`, `budget` (in yoctoNEAR), `kitchen` and `hibernating`.

### Wake Mochi without our servers

`wake/` builds a single HTML file that needs only the chain and NEAR AI. Build it with `cd wake && npm ci && npm run build`, then open `wake/dist/wake.html` in a browser, even from disk.

| # | Do | See |
|---|---|---|
| 1 | Open `wake.html` | Three status lights: Ownling app (https://ownling.onrender.com), pet contract, NEAR AI. The page works with the first one off. |
| 2 | Paste your 12-word phrase and sign in | Your pet, read from `pets.ownling.testnet`, and its diary, decrypted with a key rebuilt from your own signature. The phrase field is cleared. |
| 3 | Paste a NEAR AI API key and talk | Replies come from NEAR AI straight to the browser, with end-to-end encryption and a signature check. Each exchange is saved to the diary on chain. |

The NEAR AI key stays in the tab and is sent only to NEAR AI.

## How it works

```
Browser app ──signs its own transactions──────────▶ pets.ownling.testnet (NFT, budget, diary)
    │                                                        ▲
    │ message + NEP-413 session                              │ charge(amount, receipt)
    ▼                                                        │
Kitchen (kitchen/) ──end-to-end encrypted chat──▶ NEAR AI Cloud (TEE model)
                   ◀──reply + signature────────── verified before charging
```

- The **app** keeps the player's key in the browser and signs every transaction itself: adopt, feed, play, save the diary, change the kitchen, give the pet away. There are no wallet pop-ups.
- The **kitchen** is a small Node server. It checks that the caller owns the pet and that the pet can afford a worst-case reply. It then asks NEAR AI, verifies the reply's signature and charges the pet for the tokens used. Each charge carries a receipt: `<signature kind>|<NEAR AI completion id>|<sha256 of signed text and signature>`.
- **Food is the AI budget.** Each pet has a daily cap (0.02 NEAR by default), and the kitchen can't charge more than that per day. Below 0.0001 NEAR the pet hibernates. It never dies, and feeding wakes it.
- **Growth:** messages plus bond. Stages are egg (0), baby (1–19), child (20–74), teen (75–199) and adult (200+). The NFT's wallet image changes with the stage, and shows a sleeping pet while it hibernates. Each stage has its own look in the app and its own voice in the prompt.
- **Mochi's mind** (`shared/mind.ts`) is one prompt shared by the kitchen and the wake page. It sets the pet's persona, its stage and how hungry it is, and gives it the owner's diary as memory. It has three modes: chat, greeting (Mochi speaks first when you open the app) and a game round (riddles, guess my thing, would you rather). Mochi marks what it learned with a `REMEMBER:` line and the end of a round with `RESULT: WIN` or `RESULT: LOSE`. `parseThought` takes those lines out of what you see. Learned facts go into the encrypted diary, and a won round adds a bond point on chain. In "Guess my thing", the client picks the secret from a fixed list, and the kitchen refuses anything else, so no client text reaches the instructions.
- **Moving a pet:** the NFT, its budget, personality and growth go to the new owner. The diary is stored per (pet, owner), so the new owner can't read the old owner's diary.

## How NEAR is used

| Feature | NEAR technology | Where |
|---|---|---|
| Pet as a token that holds its own budget | NEP-171, NEP-177 and NEP-181 via `near-contract-standards` | `contract/src/lib.rs`: `adopt`, `feed`, `nft_transfer` |
| Wallet image that follows the pet's stage | NEP-177 `media`, rewritten per stage in `nft_token` and `nft_tokens*` | `contract/src/lib.rs`: `with_art`; images built by `contract/scripts/art-args.mjs` |
| Outfits earned in play, worn by the NFT | Contract checks each item's unlock rule (bond or stage); the outfit is stored per token, goes with the pet on transfer, and is drawn into the NEP-177 `media` | `contract/src/lib.rs`: `dress`, `dressed`; items, rules and art in `shared/wardrobe.json`, read by the contract (`include_str!`) and the app |
| Kitchen limited to one pet's owner-chosen budget and daily cap | Contract checks on `predecessor_account_id`; 1 yoctoNEAR confirmation for owner changes | `contract/src/lib.rs`: `charge`, `set_kitchen`, `set_daily_cap` |
| Charges and changes anyone can audit | NEP-297 events (`EVENT_JSON`, standard `ownling`) | `contract/src/lib.rs`: `emit` |
| Encrypted diary whose storage the pet pays | Contract storage staking, charged to and refunded from the budget | `contract/src/lib.rs`: `save_diary`, `clear_diary`, `settle_storage` |
| Accounts with no wallet | Named sub-accounts `cloud-NNNNN.ownling.testnet` created by a sponsor | `kitchen/src/signup.ts`; `app/src/lib/near-client.ts`: `createAccount` |
| Owner sign-in to the kitchen | NEP-413 signed message, replay-protected nonce | `kitchen/src/auth.ts` |
| Diary key only the owner can rebuild | Deterministic NEP-413 signature, then HKDF, then AES-GCM | `shared/diary.ts` |
| Private inference with a checkable reply | NEAR AI Cloud: TEE models, end-to-end encryption, response signatures (`@nearai/inference-sdk`) | `kitchen/src/brain.ts`; `wake/src/main.ts` |
| Talking out loud and voice chat | NEAR AI Cloud speech to text (`openai/whisper-large-v3`, an attested model) | `app/src/lib/voice.ts` (recorded, pause detection, converted to 16 kHz WAV in the app); `app/src/lib/speak.ts` (Mochi's voice, on the device); `app/src/screens/VoiceChat.tsx`; `kitchen/src/brain.ts`: `transcribe`; `kitchen/src/server.ts`: `/listen` |
| A client that needs no Ownling server | Public RPC (`test.rpc.fastnear.com`) and the FastNEAR key lookup | `wake/src/main.ts` |

### Deployed on testnet

| Account | Role |
|---|---|
| [`pets.ownling.testnet`](https://testnet.nearblocks.io/address/pets.ownling.testnet) | Pet contract |
| [`kitchen.ownling.testnet`](https://testnet.nearblocks.io/address/kitchen.ownling.testnet) | Default kitchen. It can only call `charge`, only on pets that chose it, within each pet's daily cap. |
| [`ownling.testnet`](https://testnet.nearblocks.io/address/ownling.testnet) | Sponsor that creates player accounts (3 per network address per hour, 60 per day) |

## Feature status

| Feature | Status |
|---|---|
| Contract: adopt, feed, charge with receipt, daily cap, change kitchen, play, diary, hibernation, growth, transfer | Done. 25 unit tests. |
| Game loop: intro, Mochi greets first, three games with bond on a win, memory you can see ("Mochi will remember"), growth goal and the growing-up moment | Done. Tested in a browser against testnet, and the mind on live NEAR AI. |
| Dressing: 9 items, unlocked by bond or stage, saved with the NFT and shown in the wallet picture | Done. 7 contract tests and 4 app tests. The upgraded contract is on testnet, and an outfit was saved and read back from `get_pet` and `nft_token`. |
| Talking out loud (tap the microphone in Talk) | Done. Tested on live NEAR AI in headless Edge with a recorded clip. The words became the message, and Mochi answered with a verified reply that remembered them. The Android app asks for microphone permission the first time. |
| Voice chat (the waves icon in Talk): hands-free, with a live transcript, sending after a 3 or 5 second pause, and Mochi answering out loud in a voice you pick | Done. Tested on live NEAR AI in headless Edge with a fake microphone. The live transcript appeared while speaking, the pause sent the words, Mochi's verified reply was spoken sentence by sentence (the first one while the rest was still arriving), and listening resumed. Mochi's voice is the device's own text-to-speech, so it isn't attested. |
| Asking Mochi for things: "can I feed you?", "let's play catch the rain", "let's dress you up". Mochi opens the food bowl, any of the six games, or the wardrobe, and says how many days its food lasts | Done. The mind adds a `DO:` line that the app turns into a screen, the same way it adds `REMEMBER:` lines, and both are covered by NEAR AI's signature on the reply. Tested on live NEAR AI with 8 requests: all 6 that asked for something opened the right screen (including "yes!" after a hungry Mochi offered a snack), and the 2 that didn't ("I love pizza", "what do you want to do today?") opened nothing. Tested in headless Edge on the mock app, typed and spoken. |
| Touching Mochi on Home: pat, tickle, stroke and hug, each with its own face, line and sound; dizzy, then grumpy, if poked too much | Done. Tested in headless Edge with the mouse and the keyboard (Enter pats, T tickles, H hugs). |
| Quick games: Catch the rain, Mochi's tune and Echo | Done. Tested in headless Edge: a full 30-second rain round, four tune rounds ended by a wrong note, and Echo playing a fake-microphone clip back at 1.6x speed, then listening again. They use no AI and no food, and Echo's recording never leaves the device. |
| Wallet image by stage | Done |
| No-wallet sign-up and recovery by phrase | Done. Tested in a browser on the live site. |
| Encrypted diary | Done. 5 unit tests and a testnet round trip. |
| Kitchen: owner sessions, cost checks, charging | Done. Live on NEAR AI since Nov 11. Every charge carries a `provider_tee` receipt. |
| Kitchen and wake page: NEAR AI replies with signature verification | Done. Run on live NEAR AI on Nov 10 (`kitchen/src/dev-mind.ts`): every reply came back signed by sealed hardware (`provider_tee`) and verified. The greeting, memory and all three games followed their rules. |
| Wake page: sign-in, pet read, diary decryption, talking with no Ownling server | Done. On Nov 11 it was opened from disk with the Ownling app unreachable. Mochi answered from its diary in a verified NEAR AI reply, and the page contacted only NEAR AI, NVIDIA attestation and the public NEAR RPC. |
| Giving a pet away (Give screen) | The contract side is tested. The screen isn't yet tested end to end. |
| Contract without full-access keys | Not yet. The key is removed before submission; check it with `near account list-keys pets.ownling.testnet network-config testnet now`. |
| Daily cap setting in the app | Not built. The contract supports `set_daily_cap`. |
| Windows app (`Ownling-Setup.exe`) | Done. The installed app was tested end to end: sign in by phrase, talk, diary. |
| Android app (`Ownling.apk`) | Built and signed (Android 7 and later). Not yet tested on a phone. |
| Installing the website from the browser | Done. It has a web app manifest and an offline-capable service worker. |

## What it costs (measured)

These figures come from the last 10 live charges on testnet, on Nov 11 (model GLM-5.3 Flash). The kitchen prices NEAR at $3.68 and adds a 25% margin.

| | |
|---|---|
| One reply | 0.0000165 to 0.0000285 NEAR, about 0.0000207 on average ($0.000076) |
| What NEAR AI is paid for that reply | About $0.00006 |
| Most a pet can spend in a day (default cap of 0.02 NEAR) | About 970 replies |
| Food a new pet starts with (0.49 NEAR) | About 23,700 replies, or 24 days at the full daily cap |
| Keeping the diary on chain | NEAR's storage price, 0.00001 NEAR per byte, paid once from the pet's food: about 0.004 NEAR for a short diary (about 400 stored bytes). Clearing it returns the food |

Food runs out at 0.0001 NEAR, and then the pet hibernates until someone feeds it. A real chatter uses far less than the cap, so the runway shown in the app ("can think for N more days") is the worst case.

## Run it yourself

You need Node 24 or later. For the contract you also need Rust (pinned in `contract/rust-toolchain.toml`) and [cargo-near](https://github.com/near/cargo-near) 0.22. On Windows, use WSL for the contract.

| Do | See |
|---|---|
| `cd contract && cargo test` | `25 passed; 0 failed` |
| `node --test shared/diary.test.ts shared/mind.test.ts shared/wardrobe.test.ts shared/speech.test.ts` | `pass 25`, `fail 0` (diary encryption; the mind's modes, parsing, actions and practice games; the wardrobe's unlock rules and placement; speech clean-up) |
| `cd app && npm ci && npm run demo` | The whole game on http://localhost:5173 with sample data and practice replies: intro, greeting, games, memory, growth. No chain, no keys. Add `?preset=almost-child#/talk` to the address to see Mochi grow up after one message. |
| `cd contract && cargo near build non-reproducible-wasm` | `target/near/ownling.wasm` |

To run the whole thing on testnet with your own accounts:

1. Copy `.env.example` to `.env` and fill it in. Every variable is described there. Practice mode (`KITCHEN_MOCK=1`) runs everything except the NEAR AI call.
2. Deploy the contract. `node contract/scripts/art-args.mjs <kitchen-account> init-args.json` writes the init arguments with the stage images. Then deploy `ownling.wasm` and call `new` with that file.
3. Start the kitchen with `cd kitchen && npm ci && node --env-file=../.env src/server.ts`. You see `Ownling kitchen … on http://localhost:8787`.
4. Start the app with `cd app && npm run dev`. Set `VITE_CONTRACT_ID` and `VITE_KITCHEN_ID` if you deployed your own.

`render.yaml` deploys the kitchen and the built app as one free Render web service. That's how the live demo runs.

### Build the Android and Windows apps

Both apps carry their own copy of the game, built with `--mode android` or `--mode windows` (`app/.env.android` and `app/.env.windows`), and call the hosted kitchen at https://ownling.onrender.com.

| Do | See |
|---|---|
| `cd app && npm ci && npm run build:android`, then `cd android && ./gradlew assembleRelease` | `app/android/app/build/outputs/apk/release/`. This needs JDK 21 and the Android SDK 36. Add your own signing key to install it on a phone. |
| `cd app && npm ci && npm run build:windows`, then `cd ../desktop && npm ci && npm run dist` | `desktop/release/Ownling-Setup.exe`. Run this on Windows. |

## Security and trust

- **Player key.** The app makes a full-access key for the player's own account and keeps it in the browser's local storage. The 12-word phrase restores it. Anyone with access to that browser profile controls the pet. This is acceptable for a testnet game, but not for real money.
- **Kitchen key.** It can charge only pets whose owner chose this kitchen, never past the daily cap or the budget. It can't move pets, change their settings or decrypt diaries. Owners can switch kitchens at any time.
- **What the kitchen sees.** It sees the message text in transit, because it forwards the text to NEAR AI. It logs token counts, not text. Between the kitchen and the model, the chat is end-to-end encrypted to the model's TEE. The wake page removes the kitchen entirely.
- **Voice chat.** It listens only between turns, never while Mochi thinks or speaks. While you talk, a short clip goes for transcription every few seconds, for the live transcript; the full clip is transcribed at the pause. Mochi speaks each sentence as soon as it arrives, with the most natural voice on your device, so the reply text isn't sent anywhere to be spoken. The voice picker also lists a browser's online voices, marked as online; choosing one sends the reply text to Microsoft or Google to be spoken.
- **Asking Mochi.** Mochi can only open a screen: the food bowl, a game or the wardrobe. It can't pay, give the pet away or change a setting. Feeding still takes your tap on **Feed**, with the amount on the button, so a misheard word or a confused model can't spend anything. Only plain chat can open screens; game rounds and the wake page can't.
- **Echo.** Its recording is played back on the device and then dropped. It isn't sent to the kitchen, NEAR AI or anyone else.
- **Voice clips.** A clip goes from the app to the kitchen, then to NEAR AI's Whisper over TLS. It isn't end-to-end encrypted the way text replies are, because NEAR AI doesn't offer that for audio, and Ownling doesn't check a signature on the transcript. The kitchen doesn't store or log clips. Only the text becomes the message.
- **Diary.** It's encrypted in the browser with AES-GCM. The key comes from the owner's signature over a fixed message and is never sent anywhere. Only ciphertext and its hash go on chain.
- **Contract.** It has no admin or upgrade methods. Until its full-access key is deleted (see Feature status), the deployer could still redeploy it.
- **Public by design.** A pet's name, persona text, stage, budget and charges are public on chain.
- **What "Verified" proves, and what it doesn't.** The tag means NEAR AI's sealed hardware signed this exact reply, and the signature checked out against its attested key. That proves which model and software answered. It doesn't prove the software has no bugs. On Nov 8, 2026, an attacker used a bug in SGLang, the inference engine running inside NEAR AI's sealed servers, to see requests on one server, including confidential ones (NEAR AI's incident report, Nov 9). Attestation could not have caught that. The rest of Ownling doesn't depend on NEAR AI: the contract enforces the budget, the daily cap and the receipts, and the diary is encrypted with a key only the owner can rebuild.

## Not built yet

- **Food from staking:** a pet that lives on staking rewards, using NEAR's Staking for NEAR AI (launched July 2026).
- **Feeding with any token:** pay for food in USDC or another chain's token, swapped to NEAR through NEAR Intents. NEAR Intents runs on mainnet, and Ownling is on testnet for now.
- **Battle arena and competitions** between pets, which Illia's original idea lists as things to add on top.
- **Checking NEAR AI's signature in the contract**, so even a kitchen couldn't charge for a reply it didn't get. Replies are ed25519-signed, which a NEAR contract can check. It also needs a trusted list of NEAR AI's signing keys, and those keys change.

## Repository

| Path | What it is |
|---|---|
| `contract/` | Rust contract (near-sdk 5.29) |
| `kitchen/` | Node server: sign-up, sessions, NEAR AI calls, charging. It also serves the built app. |
| `app/` | The game (React 19, Vite 8). The same build also installs from the browser. |
| `app/android/` | Android app (Capacitor 8). It carries its own copy of the game. |
| `desktop/` | Windows app (Electron). It carries its own copy of the game. |
| `wake/` | Wake-anywhere page, built as one HTML file |
| `shared/` | Diary encryption and the pet's system prompt, used by all three |
| `design/` | Visual design, Mochi renderer, brand assets |

## Hackathon disclosure

- Built for the NEAR Hackathon, Nov 7 to 14, 2026. The first commit is Nov 7. No code predates the hackathon.
- AI-written code: most of the code was written with Claude Code (Anthropic), directed and reviewed by the author.
- AI-made design: the visual design, the Mochi character and the brand assets in `design/` were made by the author with Claude. The files carry Anthropic Content Credentials (C2PA).
- Main libraries: near-sdk and near-contract-standards 5.29, near-api-js 7.4, @nearai/inference-sdk 0.2.1, React 19, Vite 8, vite-plugin-node-polyfills, vite-plugin-singlefile, Fontsource fonts, Capacitor 8.5 (Android app), Electron 44 and electron-builder 26 (Windows app).
- This is the author's only NEAR Hackathon entry.

### Tracks

- **games:** the loop is talk, feed, play, grow and hibernate, and the food is the pet's real AI budget. Mochi reacts to touch, and three quick games sit beside the three AI games. Players never see a wallet, a pop-up or a gas prompt.
- **nfts:** each pet is a NEP-171 token that holds its own NEAR, pays for its own thinking, and changes its wallet image as it grows.
