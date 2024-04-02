import { observable, action, computed, makeAutoObservable } from "mobx";

function assert(condition: any, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg);
  }
}
  
type NFTContractMetadata = {
  spec: string, // required, essentially a version like "nft-2.0.0", replacing "2.0.0" with the implemented version of NEP-177
  name: string, // required, ex. "Mochi Rising — Digital Edition" or "Metaverse 3"
  symbol: string, // required, ex. "MOCHI"
  icon?: string|null, // Data URL
  base_uri?: string|null, // Centralized gateway known to have reliable access to decentralized storage assets referenced by `reference` or `media` URLs
  reference?: string|null, // URL to a JSON file with more info
  reference_hash?: string|null, // Base64-encoded sha256 hash of JSON from reference field. Required if `reference` is included.
}
  
type TokenMetadata = {
  title: string|null, // ex. "Arch Nemesis: Mail Carrier" or "Parcel #5055"
  description: string|null, // free-form description
  media: string|null, // URL to associated media, preferably to decentralized, content-addressed storage
  media_hash?: string|null, // Base64-encoded sha256 hash of content referenced by the `media` field. Required if `media` is included.
  copies?: number|null, // number of copies of this set of metadata in existence when token was minted.
  issued_at?: number|null, // When token was issued or minted, Unix epoch in milliseconds
  expires_at?: number|null, // When token expires, Unix epoch in milliseconds
  starts_at?: number|null, // When token starts being valid, Unix epoch in milliseconds
  updated_at?: number|null, // When token was last updated, Unix epoch in milliseconds
  extra?: string|null, // anything extra the NFT wants to store on-chain. Can be stringified JSON.
  reference?: string|null, // URL to an off-chain JSON file with more info.
  reference_hash?: string|null // Base64-encoded sha256 hash of JSON from reference field. Required if `reference` is included.
}
  
class Token {
  owner_id: string;
  token_id: number;
  approved_account_ids: { [accountId: string]: number };
  next_approval_id: number;
  balance: number;

  constructor({ 
      ownerId, 
      token_id,
      balance,
      next_approval_id, 
      approved_account_ids, 
  }:{ 
      ownerId: string, 
      token_id: number, 
      balance: number,
      next_approval_id: number, 
      approved_account_ids: { [accountId: string]: number }, 
  }) {
      this.owner_id = ownerId
      this.token_id = token_id
      this.approved_account_ids = approved_account_ids
      this.next_approval_id = next_approval_id
      this.balance = balance
  }
}
  
class UnorderedMap<T> extends Map<string, Token>{}
class LookupMap<T> extends Map<T, number>{}
  
const near = {
  signerAccountId: () => {
    return 'morgan'
  },
  log: (log_string: string) => {
    console.log(log_string)
  }
}
  
class Collectible {
  @observable greeting: string = "hi"
  @observable tokensPerOwner: LookupMap<string>
  @observable tokensById: UnorderedMap<Token>
  @observable tokenMetadataById: LookupMap<TokenMetadata>
  @observable contractMetadata: NFTContractMetadata
  @observable tokenMetadata: TokenMetadata
  @observable owner: string;

  constructor({ contractMetadata, tokenMetadata }: { contractMetadata: NFTContractMetadata, tokenMetadata: TokenMetadata }){
    makeAutoObservable(this);
    this.owner = near.signerAccountId()
    this.tokensPerOwner = new LookupMap()
    this.tokensById = new UnorderedMap()
    this.tokenMetadataById = new LookupMap()
    this.contractMetadata = contractMetadata
    this.tokenMetadata = tokenMetadata
  }

  @computed
  get_greeting(): string {
    return this.greeting
  }

  @action
  set_greeting({ greeting }: { greeting: string }): void {
    near.log(`Saving greeting ${greeting}`)
    assert(near.signerAccountId() == this.owner, "Sender not the Owner")
    this.greeting = greeting
  }

  @computed 
  nft_metadata() {
      return this.contractMetadata;
  }

  @computed
  nft_total_supply() : { supply: number } {
    const balances: IterableIterator<Token> = this.tokensById.values()
    let supply = 0
    for (const value of balances) supply+=value.balance
    return {supply: supply}
  }

  @action
  nft_approve({ token_id, account_id } : { token_id: number, account_id: string }) : boolean {
    const token = this.tokensById.get(String(token_id+":"+near.signerAccountId()))!
    assert(near.signerAccountId() === token.owner_id, "Predecessor must be the token owner");
    token.approved_account_ids[account_id] = token.next_approval_id
    token.next_approval_id+=1
    this.tokensById.set(String(token_id+":"+near.signerAccountId()), token)
    return true
  }

  @computed
  nft_is_approved({ account_id, token_id, owner_account_id }: { token_id: number, account_id: string, owner_account_id: string}): boolean {
    const token = this.tokensById.get(String(token_id+":"+owner_account_id))!
    let isApproved = false
    const approved_account_id_values = Object.keys(token.approved_account_ids)
    for(let i = 0; i < approved_account_id_values.length; i++) if(approved_account_id_values[i] == account_id) isApproved = true
    return isApproved || token.owner_id == account_id
  }

  @action
  nft_transfer({ token_id, to_account_id, from_account_id } : { token_id: number, to_account_id: string, from_account_id: string}) {
    
    // checks
    assert(this.nft_is_approved({account_id: from_account_id, token_id: token_id, owner_account_id: from_account_id}), "user is not approved")
    assert(this.nft_balance({account_id: from_account_id, token_id: token_id }) > 0, "user has no balance")

    this.tokensById.set(String(token_id+":"+to_account_id), this.tokensById.get(String(token_id+":"+near.signerAccountId()))!)

    // update tokens per owner
    this.tokensPerOwner.set(from_account_id, this.tokensPerOwner.get(from_account_id)! - 1)
    this.tokensPerOwner.set(to_account_id, (this.tokensPerOwner.get(to_account_id) ? this.tokensPerOwner.get(to_account_id)! : 0)  + 1)
    
    let token = this.tokensById.get(String(token_id+":"+near.signerAccountId()))!
    token.balance -= 1
    
    // update tokens by id
    if(token.balance == 0) this.tokensById.delete(String(token_id+":"+near.signerAccountId()))
    else this.tokensById.set(String(token_id+":"+near.signerAccountId()), token)

    this.tokensById.set(String(token_id+":"+to_account_id), new Token({
      ownerId: to_account_id,
      token_id: token_id,
      next_approval_id: 0,
      balance: 1,
      approved_account_ids: {}
    }))

    return true
  }

  @action
  nft_collect({ token_id } : {token_id: number}) : boolean {

    if(this.tokensById.get(String(token_id+":"+near.signerAccountId()))) {
      this.tokensPerOwner.set(near.signerAccountId(), this.tokensPerOwner.get(near.signerAccountId())! + 1)
      let token = this.tokensById.get(String(token_id+":"+near.signerAccountId()))!
      token.balance += 1
      this.tokensById.set(String(token_id+":"+near.signerAccountId()), token)
    }
    else {
      if(!this.tokensPerOwner.get(near.signerAccountId())) this.tokensPerOwner.set(near.signerAccountId(), 1)
      else this.tokensPerOwner.set(near.signerAccountId(), this.tokensPerOwner.get(near.signerAccountId())! +1)

      this.tokensById.set(String(token_id+":"+near.signerAccountId()), new Token({
        ownerId: near.signerAccountId(),
        token_id: token_id,
        next_approval_id: 0,
        balance: 1,
        approved_account_ids: {}
      }))
    }

    const nftTransferLog = {
      event: 'transfer'
    }

    near.log(JSON.stringify(nftTransferLog));
    return true
  }

  // @view({}) nft_token({ tokenId } : {tokenId: number}) {
  //   this.tokensById
  //   let token = this.tokensById.get(String(tokenId))

  //   if(!token) return null

  //   let metadata = this.tokenMetadataById.get(String(tokenId)) as TokenMetadata

  //   return {
  //     tokenId: tokenId,
  //     ownerId: token.owner_id,
  //     metadata,
  //     approvedAccountIds: token.approved_account_ids
  //   }
  // }

  @computed
  collection_balance({ account_id } : { account_id: string }){
    return this.tokensPerOwner.get(account_id)
  }

  @computed
  nft_balance({ account_id, token_id } : { account_id: string, token_id: number }) : number {
    return this.tokensById.get(String(token_id+":"+account_id)) ?this.tokensById.get(String(token_id+":"+account_id))?.balance! : 0 
  }
}

export default Collectible