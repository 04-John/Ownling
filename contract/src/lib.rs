//! Ownling: an AI pet that owns itself.
//!
//! Each ownling is a NEP-171 NFT that also carries its personality, its growth, its own food budget
//! (NEAR that pays for the AI it thinks with) and an encrypted diary that only the owner who wrote
//! it can read. Only the kitchen the owner picked can charge the budget, never more than the
//! owner's daily cap, and every charge carries a receipt. There are no admin methods: once the
//! contract account's keys are removed, nobody (including us) can change a pet but its owner.

use std::collections::HashMap;

use near_contract_standards::non_fungible_token::core::{
    NonFungibleTokenCore, NonFungibleTokenResolver,
};
use near_contract_standards::non_fungible_token::enumeration::NonFungibleTokenEnumeration;
use near_contract_standards::non_fungible_token::events::NftMint;
use near_contract_standards::non_fungible_token::metadata::{
    NFT_METADATA_SPEC, NFTContractMetadata, NonFungibleTokenMetadataProvider, TokenMetadata,
};
use near_contract_standards::non_fungible_token::{NonFungibleToken, Token, TokenId};
use near_sdk::json_types::{U64, U128};
use near_sdk::serde_json::{Value, json};
use near_sdk::store::{LazyOption, LookupMap};
use near_sdk::{
    AccountId, BorshStorageKey, NearToken, PanicOnDefault, Promise, PromiseOrValue,
    assert_one_yocto, env, near, require,
};

const DAY_NS: u64 = 86_400 * 1_000_000_000;
const PLAY_COOLDOWN_NS: u64 = 10 * 60 * 1_000_000_000;
/// Food an adoption must leave once storage is paid: 0.01 NEAR.
const MIN_ADOPT_BUDGET: NearToken = NearToken::from_millinear(10);
/// The most a kitchen may charge per day unless the owner says otherwise: 0.02 NEAR.
const DEFAULT_DAILY_CAP: NearToken = NearToken::from_millinear(20);
/// Below this the pet can't afford a thought and hibernates: 0.0001 NEAR.
const HIBERNATE_BELOW: NearToken = NearToken::from_yoctonear(100_000_000_000_000_000_000);

const MAX_NAME: usize = 32;
const MAX_SPECIES: usize = 32;
const MAX_PERSONA: usize = 1_200;
const MAX_MODEL: usize = 100;
const MAX_RECEIPT: usize = 256;
const MAX_DIARY: usize = 16_384;
const MAX_HASH: usize = 128;

#[derive(BorshStorageKey)]
#[near]
enum StorageKey {
    OwnerById,
    TokenMetadata,
    Enumeration,
    Pets,
    Diaries,
    Earnings,
    Art,
}

/// The wallet pictures, as data URIs, stored once and chosen per pet when a wallet asks: the
/// picture follows the pet's stage, and a hibernating pet shows asleep.
#[near(serializers = [borsh, json])]
pub struct StageArt {
    pub egg: String,
    pub baby: String,
    pub child: String,
    pub teen: String,
    pub adult: String,
    pub asleep: String,
    /// The collection icon shown by wallets and marketplaces.
    pub icon: Option<String>,
}

#[near(serializers = [borsh])]
pub struct Pet {
    pub name: String,
    pub species: String,
    pub persona: String,
    pub model: String,
    pub born_at: u64,
    pub budget: NearToken,
    pub kitchen: AccountId,
    pub daily_cap: NearToken,
    pub spent_today: NearToken,
    pub spend_day: u64,
    pub total_spent: NearToken,
    pub messages: u64,
    pub bond: u64,
    pub last_fed_at: u64,
    pub last_played_at: u64,
}

impl Pet {
    /// What the kitchen has charged on the day `now` falls in.
    fn spent_on(&self, now: u64) -> NearToken {
        if self.spend_day == now / DAY_NS {
            self.spent_today
        } else {
            NearToken::from_yoctonear(0)
        }
    }

    fn stage(&self) -> &'static str {
        match self.messages + self.bond {
            0 => "egg",
            1..=19 => "baby",
            20..=74 => "child",
            75..=199 => "teen",
            _ => "adult",
        }
    }
}

#[near(serializers = [borsh])]
pub struct Diary {
    pub ciphertext: String,
    pub hash: String,
    pub updated_at: u64,
}

#[near(serializers = [json])]
pub struct PetView {
    pub token_id: TokenId,
    pub owner_id: AccountId,
    pub name: String,
    pub species: String,
    pub persona: String,
    pub model: String,
    pub stage: String,
    pub born_at: U64,
    pub budget: NearToken,
    pub kitchen: AccountId,
    pub daily_cap: NearToken,
    pub spent_today: NearToken,
    pub remaining_today: NearToken,
    pub total_spent: NearToken,
    pub messages: u64,
    pub bond: u64,
    pub last_fed_at: U64,
    pub last_played_at: U64,
    pub hibernating: bool,
    pub has_diary: bool,
}

#[near(serializers = [json])]
pub struct DiaryView {
    pub ciphertext: String,
    pub hash: String,
    pub updated_at: U64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    tokens: NonFungibleToken,
    metadata: NFTContractMetadata,
    pets: LookupMap<TokenId, Pet>,
    /// Keyed by (pet, owner who wrote it), so a diary never passes to the next owner.
    diaries: LookupMap<(TokenId, AccountId), Diary>,
    /// What each kitchen has charged and not yet withdrawn.
    earnings: LookupMap<AccountId, NearToken>,
    default_kitchen: AccountId,
    next_id: u64,
    /// Loaded only by the NFT views, so ordinary calls don't pay to read the pictures.
    art: LazyOption<StageArt>,
}

#[near]
impl Contract {
    #[init]
    pub fn new(default_kitchen: AccountId, art: StageArt) -> Self {
        Self {
            tokens: NonFungibleToken::new(
                StorageKey::OwnerById,
                env::current_account_id(),
                Some(StorageKey::TokenMetadata),
                Some(StorageKey::Enumeration),
                None::<StorageKey>,
            ),
            metadata: NFTContractMetadata {
                spec: NFT_METADATA_SPEC.to_string(),
                name: "Ownling".to_string(),
                symbol: "OWNLING".to_string(),
                icon: None,
                base_uri: None,
                reference: None,
                reference_hash: None,
            },
            pets: LookupMap::new(StorageKey::Pets),
            diaries: LookupMap::new(StorageKey::Diaries),
            earnings: LookupMap::new(StorageKey::Earnings),
            default_kitchen,
            next_id: 1,
            art: LazyOption::new(StorageKey::Art, Some(art)),
        }
    }

    /// Mint a pet to the caller. The deposit pays the pet's storage; the rest becomes its food.
    #[payable]
    pub fn adopt(
        &mut self,
        name: String,
        species: String,
        persona: String,
        model: String,
        kitchen: Option<AccountId>,
        daily_cap: Option<NearToken>,
    ) -> PetView {
        require!(!name.is_empty() && name.len() <= MAX_NAME, "Name must be 1-32 bytes");
        require!(!species.is_empty() && species.len() <= MAX_SPECIES, "Species must be 1-32 bytes");
        require!(persona.len() <= MAX_PERSONA, "Persona is too long");
        require!(!model.is_empty() && model.len() <= MAX_MODEL, "Model must be 1-100 bytes");

        let owner_id = env::predecessor_account_id();
        let deposit = env::attached_deposit();
        let now = env::block_timestamp();
        let storage_before = env::storage_usage();

        let token_id = self.next_id.to_string();
        self.next_id += 1;
        // Not `internal_mint`: that refunds the leftover deposit, and here the leftover is food.
        self.tokens.internal_mint_with_refund(
            token_id.clone(),
            owner_id.clone(),
            Some(TokenMetadata {
                title: Some(name.clone()),
                description: Some(format!("{name} is an ownling, a {species} that owns itself.")),
                media: None,
                media_hash: None,
                copies: Some(1),
                issued_at: Some((now / 1_000_000).to_string()),
                expires_at: None,
                starts_at: None,
                updated_at: None,
                extra: None,
                reference: None,
                reference_hash: None,
            }),
            None,
        );
        NftMint { owner_id: &owner_id, token_ids: &[&token_id], memo: None }.emit();

        self.pets.insert(
            token_id.clone(),
            Pet {
                name,
                species,
                persona,
                model,
                born_at: now,
                budget: NearToken::from_yoctonear(0),
                kitchen: kitchen.unwrap_or_else(|| self.default_kitchen.clone()),
                daily_cap: daily_cap.unwrap_or(DEFAULT_DAILY_CAP),
                spent_today: NearToken::from_yoctonear(0),
                spend_day: now / DAY_NS,
                total_spent: NearToken::from_yoctonear(0),
                messages: 0,
                bond: 0,
                last_fed_at: now,
                last_played_at: 0,
            },
        );
        self.pets.flush();

        let storage_cost = env::storage_byte_cost()
            .saturating_mul((env::storage_usage() - storage_before) as u128);
        require!(
            deposit >= storage_cost.saturating_add(MIN_ADOPT_BUDGET),
            format!(
                "Attached deposit is not enough to adopt: storage costs {storage_cost} and the pet needs at least {MIN_ADOPT_BUDGET} of food"
            )
        );
        let budget = deposit.saturating_sub(storage_cost);
        self.pets.get_mut(&token_id).unwrap().budget = budget;

        emit("adopt", json!({ "token_id": token_id, "owner_id": owner_id, "budget": budget }));
        self.view(&token_id)
    }

    /// Add food. Anyone may feed any pet; the deposit goes entirely to its budget.
    #[payable]
    pub fn feed(&mut self, token_id: TokenId) -> NearToken {
        let amount = env::attached_deposit();
        require!(amount > NearToken::from_yoctonear(0), "Attach some NEAR to feed the pet");
        let pet = self.pet_mut(&token_id);
        pet.budget = pet.budget.saturating_add(amount);
        pet.last_fed_at = env::block_timestamp();
        let budget = pet.budget;
        emit(
            "feed",
            json!({ "token_id": token_id, "by": env::predecessor_account_id(), "amount": amount }),
        );
        budget
    }

    /// Called by the pet's kitchen after each thought. `receipt` identifies the AI provider's
    /// signed response so anyone can match the charge to the work.
    pub fn charge(&mut self, token_id: TokenId, amount: NearToken, receipt: String) -> NearToken {
        require!(!receipt.is_empty() && receipt.len() <= MAX_RECEIPT, "Receipt must be 1-256 bytes");
        require!(amount > NearToken::from_yoctonear(0), "Amount must be positive");
        let kitchen = env::predecessor_account_id();
        let now = env::block_timestamp();

        let pet = self.pet_mut(&token_id);
        require!(pet.kitchen == kitchen, "Only this pet's kitchen can charge it");
        let spent = pet.spent_on(now);
        require!(spent.saturating_add(amount) <= pet.daily_cap, "Daily cap reached");
        require!(amount <= pet.budget, "Not enough food");
        pet.budget = pet.budget.saturating_sub(amount);
        pet.spent_today = spent.saturating_add(amount);
        pet.spend_day = now / DAY_NS;
        pet.total_spent = pet.total_spent.saturating_add(amount);
        pet.messages += 1;
        let budget = pet.budget;

        let earned = self.earnings.get(&kitchen).copied().unwrap_or(NearToken::from_yoctonear(0));
        self.earnings.insert(kitchen.clone(), earned.saturating_add(amount));
        emit(
            "charge",
            json!({ "token_id": token_id, "kitchen": kitchen, "amount": amount, "receipt": receipt }),
        );
        budget
    }

    /// Switch the kitchen that feeds this pet's thoughts. Needs a wallet confirmation (1 yocto),
    /// so a leaked app key can't redirect the budget.
    #[payable]
    pub fn set_kitchen(&mut self, token_id: TokenId, kitchen: AccountId) {
        assert_one_yocto();
        self.assert_owner(&token_id);
        self.pet_mut(&token_id).kitchen = kitchen.clone();
        emit("kitchen_changed", json!({ "token_id": token_id, "kitchen": kitchen }));
    }

    /// Change how much the kitchen may charge per day. Needs a wallet confirmation (1 yocto).
    #[payable]
    pub fn set_daily_cap(&mut self, token_id: TokenId, daily_cap: NearToken) {
        assert_one_yocto();
        self.assert_owner(&token_id);
        self.pet_mut(&token_id).daily_cap = daily_cap;
        emit("cap_changed", json!({ "token_id": token_id, "daily_cap": daily_cap }));
    }

    /// Play with the pet: free, owner-only, once every ten minutes. Builds the bond.
    pub fn play(&mut self, token_id: TokenId) -> PetView {
        self.assert_owner(&token_id);
        let now = env::block_timestamp();
        let pet = self.pet_mut(&token_id);
        require!(
            pet.last_played_at == 0 || now >= pet.last_played_at + PLAY_COOLDOWN_NS,
            "The pet needs a rest before playing again"
        );
        pet.bond += 1;
        pet.last_played_at = now;
        emit("play", json!({ "token_id": token_id }));
        self.view(&token_id)
    }

    /// Store the owner's encrypted diary. The pet pays the storage out of its food (memory costs
    /// food); shrinking the diary gives the difference back.
    pub fn save_diary(&mut self, token_id: TokenId, ciphertext: String, hash: String) -> NearToken {
        require!(ciphertext.len() <= MAX_DIARY, "Diary is too long");
        require!(!hash.is_empty() && hash.len() <= MAX_HASH, "Hash must be 1-128 bytes");
        let owner_id = self.assert_owner(&token_id);
        let storage_before = env::storage_usage();
        self.diaries.insert(
            (token_id.clone(), owner_id),
            Diary { ciphertext, hash: hash.clone(), updated_at: env::block_timestamp() },
        );
        self.diaries.flush();
        let budget = self.settle_storage(&token_id, storage_before);
        emit("diary_saved", json!({ "token_id": token_id, "hash": hash }));
        budget
    }

    /// Delete the owner's diary for this pet and return its storage to the pet's food.
    pub fn clear_diary(&mut self, token_id: TokenId) -> NearToken {
        let owner_id = self.assert_owner(&token_id);
        let storage_before = env::storage_usage();
        self.diaries.remove(&(token_id.clone(), owner_id));
        self.diaries.flush();
        let budget = self.settle_storage(&token_id, storage_before);
        emit("diary_cleared", json!({ "token_id": token_id }));
        budget
    }

    /// Pay a kitchen everything it has charged so far.
    pub fn kitchen_withdraw(&mut self) -> Promise {
        let kitchen = env::predecessor_account_id();
        let amount = self.earnings.remove(&kitchen).unwrap_or(NearToken::from_yoctonear(0));
        require!(amount > NearToken::from_yoctonear(0), "Nothing to withdraw");
        emit("withdraw", json!({ "kitchen": kitchen, "amount": amount }));
        Promise::new(kitchen).transfer(amount)
    }

    pub fn get_pet(&self, token_id: TokenId) -> Option<PetView> {
        self.pets.contains_key(&token_id).then(|| self.view(&token_id))
    }

    pub fn pets_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<PetView> {
        self.tokens
            .nft_tokens_for_owner(account_id, from_index, limit)
            .iter()
            .map(|token| self.view(&token.token_id))
            .collect()
    }

    /// The current owner's diary for this pet, still encrypted.
    pub fn get_diary(&self, token_id: TokenId) -> Option<DiaryView> {
        let owner_id = self.tokens.owner_by_id.get(&token_id)?;
        self.diaries.get(&(token_id, owner_id)).map(|d| DiaryView {
            ciphertext: d.ciphertext.clone(),
            hash: d.hash.clone(),
            updated_at: U64(d.updated_at),
        })
    }

    pub fn kitchen_earnings(&self, account_id: AccountId) -> NearToken {
        self.earnings.get(&account_id).copied().unwrap_or(NearToken::from_yoctonear(0))
    }

    pub fn default_kitchen(&self) -> AccountId {
        self.default_kitchen.clone()
    }
}

impl Contract {
    fn owner_of(&self, token_id: &TokenId) -> AccountId {
        self.tokens.owner_by_id.get(token_id).unwrap_or_else(|| env::panic_str("No such pet"))
    }

    fn assert_owner(&self, token_id: &TokenId) -> AccountId {
        let owner_id = self.owner_of(token_id);
        require!(env::predecessor_account_id() == owner_id, "Only the pet's owner can do that");
        owner_id
    }

    fn pet(&self, token_id: &TokenId) -> &Pet {
        self.pets.get(token_id).unwrap_or_else(|| env::panic_str("No such pet"))
    }

    fn pet_mut(&mut self, token_id: &TokenId) -> &mut Pet {
        self.pets.get_mut(token_id).unwrap_or_else(|| env::panic_str("No such pet"))
    }

    /// The token as wallets see it: its picture follows the pet's stage, or asleep when hibernating.
    fn with_art(&self, mut token: Token) -> Token {
        if let (Some(art), Some(pet), Some(metadata)) =
            (self.art.get().as_ref(), self.pets.get(&token.token_id), token.metadata.as_mut())
        {
            let picture = if pet.budget < HIBERNATE_BELOW {
                &art.asleep
            } else {
                match pet.stage() {
                    "egg" => &art.egg,
                    "baby" => &art.baby,
                    "child" => &art.child,
                    "teen" => &art.teen,
                    _ => &art.adult,
                }
            };
            metadata.media = Some(picture.clone());
        }
        token
    }

    /// Charge or refund the pet's budget for the storage change since `storage_before`.
    fn settle_storage(&mut self, token_id: &TokenId, storage_before: u64) -> NearToken {
        let storage_after = env::storage_usage();
        let pet = self.pet_mut(token_id);
        if storage_after > storage_before {
            let cost = env::storage_byte_cost()
                .saturating_mul((storage_after - storage_before) as u128);
            require!(pet.budget >= cost, "Not enough food to remember that");
            pet.budget = pet.budget.saturating_sub(cost);
        } else {
            let refund = env::storage_byte_cost()
                .saturating_mul((storage_before - storage_after) as u128);
            pet.budget = pet.budget.saturating_add(refund);
        }
        pet.budget
    }

    fn view(&self, token_id: &TokenId) -> PetView {
        let pet = self.pet(token_id);
        let owner_id = self.owner_of(token_id);
        let spent_today = pet.spent_on(env::block_timestamp());
        PetView {
            token_id: token_id.clone(),
            has_diary: self.diaries.contains_key(&(token_id.clone(), owner_id.clone())),
            owner_id,
            name: pet.name.clone(),
            species: pet.species.clone(),
            persona: pet.persona.clone(),
            model: pet.model.clone(),
            stage: pet.stage().to_string(),
            born_at: U64(pet.born_at),
            budget: pet.budget,
            kitchen: pet.kitchen.clone(),
            daily_cap: pet.daily_cap,
            spent_today,
            remaining_today: pet.daily_cap.saturating_sub(spent_today),
            total_spent: pet.total_spent,
            messages: pet.messages,
            bond: pet.bond,
            last_fed_at: U64(pet.last_fed_at),
            last_played_at: U64(pet.last_played_at),
            hibernating: pet.budget < HIBERNATE_BELOW,
        }
    }
}

/// Log a NEP-297 event so indexers and the app can follow every pet's history.
fn emit(event: &str, data: Value) {
    let payload = json!({ "standard": "ownling", "version": "1.0.0", "event": event, "data": [data] });
    env::log_str(&format!("EVENT_JSON:{payload}"));
}

#[near]
impl NonFungibleTokenCore for Contract {
    #[payable]
    fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
    ) {
        self.tokens.nft_transfer(receiver_id, token_id, approval_id, memo);
    }

    #[payable]
    fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<bool> {
        self.tokens.nft_transfer_call(receiver_id, token_id, approval_id, memo, msg)
    }

    fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        self.tokens.nft_token(token_id).map(|token| self.with_art(token))
    }
}

#[near]
impl NonFungibleTokenResolver for Contract {
    #[private]
    fn nft_resolve_transfer(
        &mut self,
        previous_owner_id: AccountId,
        receiver_id: AccountId,
        token_id: TokenId,
        approved_account_ids: Option<HashMap<AccountId, u64>>,
    ) -> bool {
        self.tokens.nft_resolve_transfer(previous_owner_id, receiver_id, token_id, approved_account_ids)
    }
}

#[near]
impl NonFungibleTokenEnumeration for Contract {
    fn nft_total_supply(&self) -> U128 {
        self.tokens.nft_total_supply()
    }

    fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        self.tokens.nft_tokens(from_index, limit).into_iter().map(|t| self.with_art(t)).collect()
    }

    fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        self.tokens.nft_supply_for_owner(account_id)
    }

    fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<Token> {
        self.tokens
            .nft_tokens_for_owner(account_id, from_index, limit)
            .into_iter()
            .map(|t| self.with_art(t))
            .collect()
    }
}

#[near]
impl NonFungibleTokenMetadataProvider for Contract {
    fn nft_metadata(&self) -> NFTContractMetadata {
        let mut metadata = self.metadata.clone();
        metadata.icon = self.art.get().as_ref().and_then(|art| art.icon.clone());
        metadata
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{VMContextBuilder, accounts};
    use near_sdk::testing_env;

    const T0: u64 = 1_762_500_000_000_000_000;
    const ZERO: NearToken = NearToken::from_yoctonear(0);
    const ONE_YOCTO: NearToken = NearToken::from_yoctonear(1);

    fn kitchen() -> AccountId {
        "kitchen.testnet".parse().unwrap()
    }

    fn ctx(who: &AccountId, deposit: NearToken, now: u64) {
        testing_env!(
            VMContextBuilder::new()
                .current_account_id("pets.testnet".parse().unwrap())
                .predecessor_account_id(who.clone())
                .signer_account_id(who.clone())
                .attached_deposit(deposit)
                .account_balance(NearToken::from_near(100))
                .block_timestamp(now)
                .build()
        );
    }

    fn setup() -> Contract {
        ctx(&accounts(0), ZERO, T0);
        Contract::new(
            kitchen(),
            StageArt {
                egg: "art:egg".into(),
                baby: "art:baby".into(),
                child: "art:child".into(),
                teen: "art:teen".into(),
                adult: "art:adult".into(),
                asleep: "art:asleep".into(),
                icon: Some("art:icon".into()),
            },
        )
    }

    fn media(c: &Contract, id: &str) -> String {
        c.nft_token(id.into()).unwrap().metadata.unwrap().media.unwrap()
    }

    #[test]
    fn the_wallet_picture_follows_the_pet() {
        let mut c = setup();
        let pet = adopt(&mut c, &accounts(1), NearToken::from_millinear(50));
        let id = pet.token_id.clone();
        assert_eq!(media(&c, &id), "art:egg");
        assert_eq!(c.nft_metadata().icon.as_deref(), Some("art:icon"));

        ctx(&accounts(1), ONE_YOCTO, T0);
        c.set_daily_cap(id.clone(), NearToken::from_near(1));
        ctx(&kitchen(), ZERO, T0);
        c.charge(id.clone(), NearToken::from_millinear(1), "r1".into());
        assert_eq!(media(&c, &id), "art:baby");
        assert_eq!(c.nft_tokens_for_owner(accounts(1), None, None)[0].metadata.as_ref().unwrap().media.as_deref(), Some("art:baby"));

        let rest = c.get_pet(id.clone()).unwrap().budget;
        c.charge(id.clone(), rest, "r2".into());
        assert_eq!(media(&c, &id), "art:asleep");
    }

    fn adopt(c: &mut Contract, who: &AccountId, deposit: NearToken) -> PetView {
        ctx(who, deposit, T0);
        c.adopt(
            "Mochi".into(),
            "blob".into(),
            "A shy, curious blob who loves rain.".into(),
            "test/model".into(),
            None,
            None,
        )
    }

    #[test]
    fn adoption_pays_storage_and_keeps_the_rest_as_food() {
        let mut c = setup();
        let pet = adopt(&mut c, &accounts(1), NearToken::from_near(1));
        assert_eq!(pet.owner_id, accounts(1));
        assert_eq!(pet.stage, "egg");
        assert_eq!(pet.kitchen, kitchen());
        assert_eq!(pet.daily_cap, DEFAULT_DAILY_CAP);
        assert!(pet.budget < NearToken::from_near(1));
        assert!(pet.budget > NearToken::from_millinear(950));
        assert_eq!(c.nft_token(pet.token_id.clone()).unwrap().owner_id, accounts(1));
        assert_eq!(c.pets_for_owner(accounts(1), None, None).len(), 1);
    }

    #[test]
    #[should_panic(expected = "not enough to adopt")]
    fn adoption_needs_enough_for_storage_and_food() {
        let mut c = setup();
        adopt(&mut c, &accounts(1), NearToken::from_millinear(5));
    }

    #[test]
    fn anyone_can_feed() {
        let mut c = setup();
        let pet = adopt(&mut c, &accounts(1), NearToken::from_near(1));
        ctx(&accounts(2), NearToken::from_near(2), T0 + 1);
        let budget = c.feed(pet.token_id.clone());
        assert_eq!(budget, pet.budget.saturating_add(NearToken::from_near(2)));
    }

    #[test]
    #[should_panic(expected = "Only this pet's kitchen")]
    fn only_the_chosen_kitchen_can_charge() {
        let mut c = setup();
        let pet = adopt(&mut c, &accounts(1), NearToken::from_near(1));
        ctx(&accounts(2), ZERO, T0);
        c.charge(pet.token_id, NearToken::from_millinear(1), "receipt".into());
    }

    #[test]
    #[should_panic(expected = "Daily cap reached")]
    fn charging_past_the_daily_cap_fails() {
        let mut c = setup();
        let pet = adopt(&mut c, &accounts(1), NearToken::from_near(1));
        ctx(&kitchen(), ZERO, T0);
        c.charge(pet.token_id.clone(), NearToken::from_millinear(15), "r1".into());
        c.charge(pet.token_id, NearToken::from_millinear(10), "r2".into());
    }

    #[test]
    fn the_daily_cap_resets_the_next_day() {
        let mut c = setup();
        let pet = adopt(&mut c, &accounts(1), NearToken::from_near(1));
        let id = pet.token_id.clone();
        ctx(&kitchen(), ZERO, T0);
        c.charge(id.clone(), NearToken::from_millinear(15), "r1".into());
        ctx(&kitchen(), ZERO, T0 + DAY_NS);
        let budget = c.charge(id.clone(), NearToken::from_millinear(15), "r2".into());
        let v = c.get_pet(id).unwrap();
        assert_eq!(v.spent_today, NearToken::from_millinear(15));
        assert_eq!(v.total_spent, NearToken::from_millinear(30));
        assert_eq!(v.messages, 2);
        assert_eq!(budget, pet.budget.saturating_sub(NearToken::from_millinear(30)));
        assert_eq!(c.kitchen_earnings(kitchen()), NearToken::from_millinear(30));
    }

    #[test]
    #[should_panic(expected = "Not enough food")]
    fn charging_more_than_the_budget_fails() {
        let mut c = setup();
        let pet = adopt(&mut c, &accounts(1), NearToken::from_millinear(50));
        ctx(&accounts(1), ONE_YOCTO, T0);
        c.set_daily_cap(pet.token_id.clone(), NearToken::from_near(1));
        ctx(&kitchen(), ZERO, T0);
        c.charge(pet.token_id, NearToken::from_millinear(45), "r".into());
    }

    #[test]
    #[should_panic(expected = "1 yoctoNEAR")]
    fn changing_the_kitchen_needs_a_wallet_confirmation() {
        let mut c = setup();
        let pet = adopt(&mut c, &accounts(1), NearToken::from_near(1));
        ctx(&accounts(1), ZERO, T0);
        c.set_kitchen(pet.token_id, accounts(3));
    }

    #[test]
    #[should_panic(expected = "Only the pet's owner")]
    fn strangers_cannot_change_the_kitchen() {
        let mut c = setup();
        let pet = adopt(&mut c, &accounts(1), NearToken::from_near(1));
        ctx(&accounts(2), ONE_YOCTO, T0);
        c.set_kitchen(pet.token_id, accounts(2));
    }

    #[test]
    fn a_new_kitchen_takes_over() {
        let mut c = setup();
        let pet = adopt(&mut c, &accounts(1), NearToken::from_near(1));
        ctx(&accounts(1), ONE_YOCTO, T0);
        c.set_kitchen(pet.token_id.clone(), accounts(3));
        ctx(&accounts(3), ZERO, T0);
        c.charge(pet.token_id.clone(), NearToken::from_millinear(1), "r".into());
        assert_eq!(c.get_pet(pet.token_id).unwrap().kitchen, accounts(3));
    }

    #[test]
    fn the_diary_stays_with_the_owner_who_wrote_it() {
        let mut c = setup();
        let pet = adopt(&mut c, &accounts(1), NearToken::from_near(1));
        let id = pet.token_id.clone();

        ctx(&accounts(1), ZERO, T0);
        let budget = c.save_diary(id.clone(), "cipher-of-alice".into(), "hash-a".into());
        assert!(budget < pet.budget, "memory costs food");
        assert_eq!(c.get_diary(id.clone()).unwrap().ciphertext, "cipher-of-alice");

        ctx(&accounts(1), ONE_YOCTO, T0);
        c.nft_transfer(accounts(2), id.clone(), None, None);
        let v = c.get_pet(id.clone()).unwrap();
        assert_eq!(v.owner_id, accounts(2));
        assert_eq!(v.budget, budget, "the food moves with the pet");
        assert!(!v.has_diary);
        assert!(c.get_diary(id.clone()).is_none(), "the diary does not");

        ctx(&accounts(2), ONE_YOCTO, T0);
        c.nft_transfer(accounts(1), id.clone(), None, None);
        assert_eq!(c.get_diary(id).unwrap().ciphertext, "cipher-of-alice");
    }

    #[test]
    fn clearing_the_diary_gives_its_storage_back_as_food() {
        let mut c = setup();
        let pet = adopt(&mut c, &accounts(1), NearToken::from_near(1));
        ctx(&accounts(1), ZERO, T0);
        c.save_diary(pet.token_id.clone(), "x".repeat(2_000), "h".into());
        let budget = c.clear_diary(pet.token_id.clone());
        assert_eq!(budget, pet.budget);
        assert!(c.get_diary(pet.token_id).is_none());
    }

    #[test]
    #[should_panic(expected = "Only the pet's owner")]
    fn strangers_cannot_write_the_diary() {
        let mut c = setup();
        let pet = adopt(&mut c, &accounts(1), NearToken::from_near(1));
        ctx(&accounts(2), ZERO, T0);
        c.save_diary(pet.token_id, "x".into(), "h".into());
    }

    #[test]
    fn kitchens_withdraw_what_they_earned() {
        let mut c = setup();
        let pet = adopt(&mut c, &accounts(1), NearToken::from_near(1));
        ctx(&kitchen(), ZERO, T0);
        c.charge(pet.token_id, NearToken::from_millinear(5), "r".into());
        assert_eq!(c.kitchen_earnings(kitchen()), NearToken::from_millinear(5));
        let _ = c.kitchen_withdraw();
        assert_eq!(c.kitchen_earnings(kitchen()), ZERO);
    }

    #[test]
    fn pets_hatch_grow_and_hibernate_when_out_of_food() {
        let mut c = setup();
        let pet = adopt(&mut c, &accounts(1), NearToken::from_millinear(50));
        let id = pet.token_id.clone();
        assert!(!pet.hibernating);

        ctx(&accounts(1), ONE_YOCTO, T0);
        c.set_daily_cap(id.clone(), NearToken::from_near(1));
        ctx(&kitchen(), ZERO, T0);
        c.charge(id.clone(), NearToken::from_millinear(1), "r1".into());
        assert_eq!(c.get_pet(id.clone()).unwrap().stage, "baby");

        let rest = c.get_pet(id.clone()).unwrap().budget;
        c.charge(id.clone(), rest, "r2".into());
        assert!(c.get_pet(id).unwrap().hibernating);
    }

    #[test]
    #[should_panic(expected = "needs a rest")]
    fn play_has_a_cooldown() {
        let mut c = setup();
        let pet = adopt(&mut c, &accounts(1), NearToken::from_near(1));
        ctx(&accounts(1), ZERO, T0);
        assert_eq!(c.play(pet.token_id.clone()).bond, 1);
        c.play(pet.token_id);
    }

    #[test]
    fn play_works_again_after_the_cooldown() {
        let mut c = setup();
        let pet = adopt(&mut c, &accounts(1), NearToken::from_near(1));
        ctx(&accounts(1), ZERO, T0);
        c.play(pet.token_id.clone());
        ctx(&accounts(1), ZERO, T0 + PLAY_COOLDOWN_NS);
        assert_eq!(c.play(pet.token_id).bond, 2);
    }
}
