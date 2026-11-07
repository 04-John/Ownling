# Ownling

An AI pet that owns itself. Each ownling is an NFT on NEAR that carries its personality, its growth, its own food budget (NEAR that pays for the AI it thinks with) and a private diary only its owner can read. If the company behind the app disappears, the pet doesn't.

> Work in progress for the NEAR Hackathon (Nov 2026). This README will be expanded with try-it steps before submission.

## What exists so far

`contract/`: the Rust smart contract (near-sdk 5.29, NEP-171/177/181 via near-contract-standards).

- `adopt`: mint a pet. The deposit pays its storage; the rest becomes its food budget.
- `feed`: anyone can add food to any pet.
- `charge`: only the kitchen (AI relay) the owner chose can charge the budget, within the owner's daily cap, and each charge carries a receipt.
- `set_kitchen`, `set_daily_cap`: owner-only and need a wallet confirmation (1 yoctoNEAR).
- `save_diary`, `clear_diary`: an encrypted diary stored per (pet, owner). The pet pays its storage from its food. When a pet changes hands, the food goes with it and the diary does not.
- `play`: free, owner-only, with a 10-minute cooldown. It builds the bond.
- There are no admin methods.

Testnet deployment: `nearpet-pets-6831.testnet` (kitchen: `nearpet-kitchen-6831.testnet`).

## Build and test the contract

Requires Rust (the version is pinned in `contract/rust-toolchain.toml`) and [cargo-near](https://github.com/near/cargo-near). On Windows, use WSL.

```bash
cd contract
cargo test                              # 17 unit tests
cargo near build non-reproducible-wasm  # writes target/near/ownling.wasm
```

## License

MIT
