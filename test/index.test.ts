
import { autorun } from "mobx";
import Collectible from "../src/contract";

(async () => {
    let collectible: any;

    beforeAll(() => {

        const contractMetadata = {
            spec: 'collectible-0.0.1',
            name: 'collectible',
            symbol: 'cltbl'
        }
    
        const tokenMetadata = {
            title: 'how to make friends',
            description: 'curiosity',
            media: 'https://usb.ngrok.app/%E2%99%A6/metadata/tools/noun-bike.png'
        }
        
        collectible = new Collectible({contractMetadata, tokenMetadata});
    })


    // logging outputs
    autorun(() => {
        if(collectible!= undefined)  JSON.stringify(collectible)
    });

    describe("Greetings", () => {
        it("should return the default greeting", async () => {
            expect(await collectible.get_greeting()).toEqual('hi');
        });

        it("should set a new greeting", async () => {
            const greeting = 'welcome'
            await collectible.set_greeting({ greeting })
            expect(await collectible.get_greeting()).toEqual('welcome');
        });

        it("should return the updated greeting", async () => {
            expect(await collectible.get_greeting()).toEqual('welcome');
        });
    });

    describe("Token", () => {
        it("should mint a token", async () => {
            expect(await collectible.nft_collect({token_id: 0})).toEqual(true)
        })

        it("should get the total supply", async () => {
            expect((await collectible.nft_total_supply()).supply).toEqual(1)
        })

        it("should mint a token", async () => {
            expect(await collectible.nft_collect({token_id: 1})).toEqual(true)
        })

        it("should get the collection balance", async () => {
            expect((await collectible.collection_balance({ account_id: 'morgan'}))).toEqual(2)
        })

        it("should get the total supply", async () => {
            expect((await collectible.nft_total_supply()).supply).toEqual(2)
        })

        it("should add an approver", async () => {
            expect(await collectible.nft_approve({ token_id: '0', account_id: 'paul' })).toEqual(true)
            expect(await collectible.nft_is_approved({ token_id: '0', account_id: 'paul', owner_account_id: 'morgan' })).toEqual(true)
        })

        it("should transfer token", async () => {
            expect(await collectible.nft_transfer({token_id: 1, to_account_id: 'paul', from_account_id: 'morgan'})).toEqual(true)
            expect(await collectible.nft_balance({token_id: 1, account_id: 'paul'})).toEqual(1)
            expect(await collectible.nft_balance({token_id: 1, account_id: 'morgan'})).toEqual(0)
        })

        it('should still have some balance', async () => {
            expect(await collectible.nft_balance({token_id: 0, account_id: 'morgan'})).toEqual(1)
        }) 

        it("should get the total supply", async () => {
            expect((await collectible.nft_total_supply()).supply).toEqual(2)
        })
        
        it("should get the collection balance", async () => {
            expect((await collectible.collection_balance({ account_id: 'paul'}))).toEqual(1)
            expect((await collectible.collection_balance({ account_id: 'morgan'}))).toEqual(1)
        })
    })

    // describe("Metadata", () => {
    //     it("should get token metadata", async () => {
    //         await collectible.nft_token()
    //         expect()
    //     })
    // })
})()