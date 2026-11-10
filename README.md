# Ownling

Ownling is a virtual pet whose AI personality, memory and food budget are stored on NEAR, so it keeps working if the Ownling company and its servers go away.

People who spend months talking to an AI companion don't own it. The company that runs it holds its memory and can change it, charge more for it or shut it down. Ownling puts the parts that matter on chain and in the owner's hands. The pet is an NFT. It pays for its own AI from a NEAR budget the owner tops up. Its diary is encrypted with a key only the owner can rebuild. Any client can wake it, not just ours.

- **Live demo (testnet):** https://ownling.onrender.com
- **Pet contract:** [`pets.ownling.testnet`](https://testnet.nearblocks.io/address/pets.ownling.testnet)
- **License:** MIT

> **Status on Nov 10, 2026:** the hosted kitchen runs in practice mode until its NEAR AI credits are active. In practice mode, replies are canned and tagged **No proof**, and each costs the pet 0.000001 testnet NEAR. Everything else in the demo is live on testnet.

## Try it in 2 minutes (no wallet, no funds, no keys)

The free host sleeps after 15 idle minutes. If it was asleep, the first page load takes up to a minute.

| # | Do | See |
|---|---|---|
| 1 | Open https://ownling.onrender.com | Mochi, a small cloud, and **Create my account** |
| 2 | Tap **Create my account** | A 12-word recovery phrase. Behind it, the sponsor account `ownling.testnet` created a named account `cloud-NNNNN.ownling.testnet` for you, holding 1 testnet NEAR. The key exists only in your browser. |
| 3 | Tap **I saved it**, then **Adopt Mochi** | Home: "Mochi can think for 24 more days" and 0.49 testnet NEAR. `adopt` minted Mochi as an NFT and put the deposit, minus storage, into its food budget. |
| 4 | Tap **Talk** and send a message | Mochi's reply with a tag under it: **Verified** if the NEAR AI signature on the reply checked out, **No proof** otherwise. The kitchen charged Mochi's budget for that reply on chain. |
| 5 | Tap **Feed**, choose **Shower**, then **Feed 0.1** | The runway grows to about 29 days. Food is the AI budget: 0.1 testnet NEAR moved from your account into Mochi's. |
| 6 | Tap **Play** | Mochi reacts, and the button turns into **Rest** with a 10-minute countdown. Play builds the bond, which counts toward growth. |
| 7 | Tap the lock icon (top right) | Mochi's diary, decrypted in your browser. The chain holds only ciphertext. |
| 8 | Tap the shield icon (top right) | **What we can and can't do with Mochi**: the contract, the kitchen allowed to charge the budget, the daily cap, and **Change kitchen**. |

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
- **Growth:** messages plus bond. Stages are egg (0), baby (1–19), child (20–74), teen (75–199) and adult (200+). The NFT's wallet image changes with the stage, and shows a sleeping pet while it hibernates.
- **Moving a pet:** the NFT, its budget, personality and growth go to the new owner. The diary is stored per (pet, owner), so the new owner can't read the old owner's diary.

## How NEAR is used

| Feature | NEAR technology | Where |
|---|---|---|
| Pet as a token that holds its own budget | NEP-171, NEP-177 and NEP-181 via `near-contract-standards` | `contract/src/lib.rs`: `adopt`, `feed`, `nft_transfer` |
| Wallet image that follows the pet's stage | NEP-177 `media`, rewritten per stage in `nft_token` and `nft_tokens*` | `contract/src/lib.rs`: `with_art`; images built by `contract/scripts/art-args.mjs` |
| Kitchen limited to one pet's owner-chosen budget and daily cap | Contract checks on `predecessor_account_id`; 1 yoctoNEAR confirmation for owner changes | `contract/src/lib.rs`: `charge`, `set_kitchen`, `set_daily_cap` |
| Charges and changes anyone can audit | NEP-297 events (`EVENT_JSON`, standard `ownling`) | `contract/src/lib.rs`: `emit` |
| Encrypted diary whose storage the pet pays | Contract storage staking, charged to and refunded from the budget | `contract/src/lib.rs`: `save_diary`, `clear_diary`, `settle_storage` |
| Accounts with no wallet | Named sub-accounts `cloud-NNNNN.ownling.testnet` created by a sponsor | `kitchen/src/signup.ts`; `app/src/lib/near-client.ts`: `createAccount` |
| Owner sign-in to the kitchen | NEP-413 signed message, replay-protected nonce | `kitchen/src/auth.ts` |
| Diary key only the owner can rebuild | Deterministic NEP-413 signature, then HKDF, then AES-GCM | `shared/diary.ts` |
| Private inference with a checkable reply | NEAR AI Cloud: TEE models, end-to-end encryption, response signatures (`@nearai/inference-sdk`) | `kitchen/src/brain.ts`; `wake/src/main.ts` |
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
| Contract: adopt, feed, charge with receipt, daily cap, change kitchen, play, diary, hibernation, growth, transfer | Done. 18 unit tests. |
| Wallet image by stage | Done |
| No-wallet sign-up and recovery by phrase | Done. Tested in a browser on the live site. |
| Encrypted diary | Done. 5 unit tests and a testnet round trip. |
| Kitchen: owner sessions, cost checks, charging | Done. Tested on testnet in practice mode. |
| Kitchen and wake page: NEAR AI replies with signature verification | Built. Not yet run against live NEAR AI, because the credits aren't active yet (see Status). |
| Wake page: sign-in, pet read, diary decryption | Done. Tested in a browser. |
| Giving a pet away (Give screen) | The contract side is tested. The screen isn't yet tested end to end. |
| Contract without full-access keys | Not yet. The key is removed before submission; check it with `near account list-keys pets.ownling.testnet network-config testnet now`. |
| Daily cap setting in the app | Not built. The contract supports `set_daily_cap`. |

## Run it yourself

You need Node 24 or later. For the contract you also need Rust (pinned in `contract/rust-toolchain.toml`) and [cargo-near](https://github.com/near/cargo-near) 0.22. On Windows, use WSL for the contract.

| Do | See |
|---|---|
| `cd contract && cargo test` | `18 passed; 0 failed` |
| `node --test shared/diary.test.ts` | `pass 5`, `fail 0` |
| `cd app && npm ci && VITE_MOCK=1 npm run dev` | The app on http://localhost:5173 with sample data. No chain and no keys. |
| `cd contract && cargo near build non-reproducible-wasm` | `target/near/ownling.wasm` |

To run the whole thing on testnet with your own accounts:

1. Copy `.env.example` to `.env` and fill it in. Every variable is described there. Practice mode (`KITCHEN_MOCK=1`) runs everything except the NEAR AI call.
2. Deploy the contract. `node contract/scripts/art-args.mjs <kitchen-account> init-args.json` writes the init arguments with the stage images. Then deploy `ownling.wasm` and call `new` with that file.
3. Start the kitchen with `cd kitchen && npm ci && node --env-file=../.env src/server.ts`. You see `Ownling kitchen … on http://localhost:8787`.
4. Start the app with `cd app && npm run dev`. Set `VITE_CONTRACT_ID` and `VITE_KITCHEN_ID` if you deployed your own.

`render.yaml` deploys the kitchen and the built app as one free Render web service. That's how the live demo runs.

## Security and trust

- **Player key.** The app makes a full-access key for the player's own account and keeps it in the browser's local storage. The 12-word phrase restores it. Anyone with access to that browser profile controls the pet. This is acceptable for a testnet game, but not for real money.
- **Kitchen key.** It can charge only pets whose owner chose this kitchen, never past the daily cap or the budget. It can't move pets, change their settings or decrypt diaries. Owners can switch kitchens at any time.
- **What the kitchen sees.** It sees the message text in transit, because it forwards the text to NEAR AI. It logs token counts, not text. Between the kitchen and the model, the chat is end-to-end encrypted to the model's TEE. The wake page removes the kitchen entirely.
- **Diary.** It's encrypted in the browser with AES-GCM. The key comes from the owner's signature over a fixed message and is never sent anywhere. Only ciphertext and its hash go on chain.
- **Contract.** It has no admin or upgrade methods. Until its full-access key is deleted (see Feature status), the deployer could still redeploy it.
- **Public by design.** A pet's name, persona text, stage, budget and charges are public on chain.

## Repository

| Path | What it is |
|---|---|
| `contract/` | Rust contract (near-sdk 5.29) |
| `kitchen/` | Node server: sign-up, sessions, NEAR AI calls, charging. It also serves the built app. |
| `app/` | The game (React 19, Vite 8) |
| `wake/` | Wake-anywhere page, built as one HTML file |
| `shared/` | Diary encryption and the pet's system prompt, used by all three |
| `design/` | Visual design, Mochi renderer, brand assets |

## Hackathon disclosure

- Built for the NEAR Hackathon, Nov 7 to 14, 2026. The first commit is Nov 7. No code predates the hackathon.
- AI-written code: most of the code was written with Claude Code (Anthropic), directed and reviewed by the author.
- The visual design and the Mochi character are in `design/`.
- Main libraries: near-sdk and near-contract-standards 5.29, near-api-js 7.4, @nearai/inference-sdk 0.2.1, React 19, Vite 8, vite-plugin-node-polyfills, vite-plugin-singlefile, Fontsource fonts.
- This is the author's only NEAR Hackathon entry.

### Tracks

- **games:** the loop is talk, feed, play, grow and hibernate, and the food is the pet's real AI budget. Players never see a wallet, a pop-up or a gas prompt.
- **nfts:** each pet is a NEP-171 token that holds its own NEAR, pays for its own thinking, and changes its wallet image as it grows.
