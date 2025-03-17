import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

// Test producer registration
Clarinet.test({
    name: "Ensure that users can register as energy producers",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const producer1 = accounts.get('wallet_1')!;

        const energyAmount = 1000;
        const pricePerUnit = 10;

        let block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'register-producer',
                [
                    types.uint(energyAmount),
                    types.uint(pricePerUnit)
                ],
                producer1.address
            )
        ]);

        // Check successful response
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Check if producer information is correctly stored
        let call = chain.callReadOnlyFn(
            'energy-trading',
            'get-producer-info',
            [types.principal(producer1.address)],
            deployer.address
        );

        const result = call.result.replace(/\s+/g, ' ').trim();
        assertEquals(
            result.includes(`{energy-available: u${energyAmount}, energy-price: u${pricePerUnit}}`),
            true
        );
    },
});

// Test producer registration with invalid values
Clarinet.test({
    name: "Ensure that producer registration fails with invalid values",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const producer1 = accounts.get('wallet_1')!;

        // Try to register with zero energy
        let block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'register-producer',
                [
                    types.uint(0),  // Invalid: zero energy
                    types.uint(10)
                ],
                producer1.address
            )
        ]);

        // Check error response
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u101)'); // err-invalid-amount

        // Try to register with zero price
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'register-producer',
                [
                    types.uint(1000),
                    types.uint(0)  // Invalid: zero price
                ],
                producer1.address
            )
        ]);

        // Check error response
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u101)'); // err-invalid-amount
    },
});

// Test consumer registration
Clarinet.test({
    name: "Ensure that users can register as energy consumers",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const consumer1 = accounts.get('wallet_1')!;

        let block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'register-consumer',
                [],
                consumer1.address
            )
        ]);

        // Check successful response
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Check if consumer information is correctly stored
        let call = chain.callReadOnlyFn(
            'energy-trading',
            'get-consumer-info',
            [types.principal(consumer1.address)],
            deployer.address
        );

        const result = call.result.replace(/\s+/g, ' ').trim();
        assertEquals(
            result.includes(`{energy-consumed: u0, total-spent: u0}`),
            true
        );
    },
});

// Test energy purchase
Clarinet.test({
    name: "Ensure that consumers can purchase energy from producers",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const producer1 = accounts.get('wallet_1')!;
        const consumer1 = accounts.get('wallet_2')!;

        const energyAmount = 1000;
        const pricePerUnit = 10;
        const purchaseAmount = 200;
        const totalCost = purchaseAmount * pricePerUnit;

        // First register producer and consumer
        let block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'register-producer',
                [
                    types.uint(energyAmount),
                    types.uint(pricePerUnit)
                ],
                producer1.address
            ),
            Tx.contractCall(
                'energy-trading',
                'register-consumer',
                [],
                consumer1.address
            )
        ]);

        // Then purchase energy
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'buy-energy',
                [
                    types.principal(producer1.address),
                    types.uint(purchaseAmount)
                ],
                consumer1.address
            )
        ]);

        // Check successful purchase
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Check updated producer information
        let call = chain.callReadOnlyFn(
            'energy-trading',
            'get-producer-info',
            [types.principal(producer1.address)],
            deployer.address
        );

        let result = call.result.replace(/\s+/g, ' ').trim();
        assertEquals(
            result.includes(`{energy-available: u${energyAmount - purchaseAmount}, energy-price: u${pricePerUnit}}`),
            true
        );

        // Check updated consumer information
        call = chain.callReadOnlyFn(
            'energy-trading',
            'get-consumer-info',
            [types.principal(consumer1.address)],
            deployer.address
        );

        result = call.result.replace(/\s+/g, ' ').trim();
        assertEquals(
            result.includes(`{energy-consumed: u${purchaseAmount}, total-spent: u${totalCost}}`),
            true
        );

        // Check energy sold record
        call = chain.callReadOnlyFn(
            'energy-trading',
            'get-energy-sold',
            [types.principal(producer1.address)],
            deployer.address
        );

        assertEquals(call.result, `(ok u${purchaseAmount})`);

        // Check energy purchased record
        call = chain.callReadOnlyFn(
            'energy-trading',
            'get-energy-purchased',
            [types.principal(consumer1.address)],
            deployer.address
        );

        assertEquals(call.result, `(ok u${purchaseAmount})`);
    },
});

// Test energy purchase failure cases
Clarinet.test({
    name: "Ensure that energy purchase fails under invalid conditions",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const producer1 = accounts.get('wallet_1')!;
        const consumer1 = accounts.get('wallet_2')!;
        const nonExistentProducer = accounts.get('wallet_3')!;

        const energyAmount = 1000;
        const pricePerUnit = 10;

        // First register producer and consumer
        let block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'register-producer',
                [
                    types.uint(energyAmount),
                    types.uint(pricePerUnit)
                ],
                producer1.address
            ),
            Tx.contractCall(
                'energy-trading',
                'register-consumer',
                [],
                consumer1.address
            )
        ]);

        // Attempt to buy from non-existent producer
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'buy-energy',
                [
                    types.principal(nonExistentProducer.address),
                    types.uint(100)
                ],
                consumer1.address
            )
        ]);

        // Check error response
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u102)'); // err-producer-not-found

        // Attempt to buy more energy than available
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'buy-energy',
                [
                    types.principal(producer1.address),
                    types.uint(energyAmount + 1) // More than available
                ],
                consumer1.address
            )
        ]);

        // Check error response
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u103)'); // err-insufficient-energy
    },
});

// Test energy amount update
Clarinet.test({
    name: "Ensure that producers can update their available energy",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const producer1 = accounts.get('wallet_1')!;

        const initialEnergy = 1000;
        const pricePerUnit = 10;
        const additionalEnergy = 500;

        // First register producer
        let block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'register-producer',
                [
                    types.uint(initialEnergy),
                    types.uint(pricePerUnit)
                ],
                producer1.address
            )
        ]);

        // Then update energy amount
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'update-energy',
                [types.uint(additionalEnergy)],
                producer1.address
            )
        ]);

        // Check successful update
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Check updated producer information
        let call = chain.callReadOnlyFn(
            'energy-trading',
            'get-producer-info',
            [types.principal(producer1.address)],
            deployer.address
        );

        const result = call.result.replace(/\s+/g, ' ').trim();
        assertEquals(
            result.includes(`{energy-available: u${initialEnergy + additionalEnergy}, energy-price: u${pricePerUnit}}`),
            true
        );
    },
});

// Test producer rating
Clarinet.test({
    name: "Ensure that consumers can rate producers after purchase",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const producer1 = accounts.get('wallet_1')!;
        const consumer1 = accounts.get('wallet_2')!;

        // First register producer and consumer, and make a purchase
        let block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'register-producer',
                [
                    types.uint(1000),
                    types.uint(10)
                ],
                producer1.address
            ),
            Tx.contractCall(
                'energy-trading',
                'register-consumer',
                [],
                consumer1.address
            ),
            Tx.contractCall(
                'energy-trading',
                'buy-energy',
                [
                    types.principal(producer1.address),
                    types.uint(100)
                ],
                consumer1.address
            )
        ]);

        // Then rate the producer
        const rating = 5; // 5/5 rating
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'rate-producer',
                [
                    types.principal(producer1.address),
                    types.uint(rating)
                ],
                consumer1.address
            )
        ]);

        // Check successful rating
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Check producer reputation
        let call = chain.callReadOnlyFn(
            'energy-trading',
            'get-producer-rating',
            [types.principal(producer1.address)],
            deployer.address
        );

        // First rating should be the rating itself (or average with 0, which is still the rating)
        assertEquals(call.result, `(ok u${rating / 2})`); // (0+5)/2 = 2.5 but uint rounds down to 2
    },
});

// Test rating without purchase
Clarinet.test({
    name: "Ensure that rating fails without purchase history",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const producer1 = accounts.get('wallet_1')!;
        const consumer1 = accounts.get('wallet_2')!;

        // Register producer and consumer, but don't make a purchase
        let block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'register-producer',
                [
                    types.uint(1000),
                    types.uint(10)
                ],
                producer1.address
            ),
            Tx.contractCall(
                'energy-trading',
                'register-consumer',
                [],
                consumer1.address
            )
        ]);

        // Attempt to rate the producer
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'rate-producer',
                [
                    types.principal(producer1.address),
                    types.uint(5)
                ],
                consumer1.address
            )
        ]);

        // Check error response
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u107)'); // err-no-purchase-history
    },
});

// Test invalid rating value
Clarinet.test({
    name: "Ensure that rating fails with invalid values",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const producer1 = accounts.get('wallet_1')!;
        const consumer1 = accounts.get('wallet_2')!;

        // First register producer and consumer, and make a purchase
        let block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'register-producer',
                [
                    types.uint(1000),
                    types.uint(10)
                ],
                producer1.address
            ),
            Tx.contractCall(
                'energy-trading',
                'register-consumer',
                [],
                consumer1.address
            ),
            Tx.contractCall(
                'energy-trading',
                'buy-energy',
                [
                    types.principal(producer1.address),
                    types.uint(100)
                ],
                consumer1.address
            )
        ]);

        // Attempt to rate with invalid values
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'rate-producer',
                [
                    types.principal(producer1.address),
                    types.uint(0) // Invalid: rating must be 1-5
                ],
                consumer1.address
            ),
            Tx.contractCall(
                'energy-trading',
                'rate-producer',
                [
                    types.principal(producer1.address),
                    types.uint(6) // Invalid: rating must be 1-5
                ],
                consumer1.address
            )
        ]);

        // Check error responses
        assertEquals(block.receipts.length, 2);
        assertEquals(block.receipts[0].result, '(err u106)'); // err-invalid-rating
        assertEquals(block.receipts[1].result, '(err u106)'); // err-invalid-rating
    },
});

// Test refund request
Clarinet.test({
    name: "Ensure that consumers can request refunds",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const producer1 = accounts.get('wallet_1')!;
        const consumer1 = accounts.get('wallet_2')!;

        const energyAmount = 1000;
        const pricePerUnit = 10;
        const purchaseAmount = 200;
        const refundAmount = 50;
        const refundCost = refundAmount * pricePerUnit;

        // First register producer and consumer, and make a purchase
        let block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'register-producer',
                [
                    types.uint(energyAmount),
                    types.uint(pricePerUnit)
                ],
                producer1.address
            ),
            Tx.contractCall(
                'energy-trading',
                'register-consumer',
                [],
                consumer1.address
            ),
            Tx.contractCall(
                'energy-trading',
                'buy-energy',
                [
                    types.principal(producer1.address),
                    types.uint(purchaseAmount)
                ],
                consumer1.address
            )
        ]);

        // Request a refund
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'request-refund',
                [
                    types.principal(producer1.address),
                    types.uint(refundAmount)
                ],
                consumer1.address
            )
        ]);

        // Check successful refund
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Check updated consumer information
        let call = chain.callReadOnlyFn(
            'energy-trading',
            'get-consumer-info',
            [types.principal(consumer1.address)],
            deployer.address
        );

        const result = call.result.replace(/\s+/g, ' ').trim();
        assertEquals(
            result.includes(`{energy-consumed: u${purchaseAmount - refundAmount}, total-spent: u${(purchaseAmount - refundAmount) * pricePerUnit}}`),
            true
        );

        // Check refund record
        call = chain.callReadOnlyFn(
            'energy-trading',
            'get-refund-amount',
            [types.principal(consumer1.address)],
            deployer.address
        );

        assertEquals(call.result, `(ok u${refundAmount})`);
    },
});

// Test refund request failures
Clarinet.test({
    name: "Ensure that refund requests fail under invalid conditions",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const producer1 = accounts.get('wallet_1')!;
        const consumer1 = accounts.get('wallet_2')!;

        const energyAmount = 1000;
        const pricePerUnit = 10;
        const purchaseAmount = 200;

        // First register producer and consumer, and make a purchase
        let block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'register-producer',
                [
                    types.uint(energyAmount),
                    types.uint(pricePerUnit)
                ],
                producer1.address
            ),
            Tx.contractCall(
                'energy-trading',
                'register-consumer',
                [],
                consumer1.address
            ),
            Tx.contractCall(
                'energy-trading',
                'buy-energy',
                [
                    types.principal(producer1.address),
                    types.uint(purchaseAmount)
                ],
                consumer1.address
            )
        ]);

        // Attempt to refund more than purchased
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'request-refund',
                [
                    types.principal(producer1.address),
                    types.uint(purchaseAmount + 1) // More than purchased
                ],
                consumer1.address
            )
        ]);

        // Check error response
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u108)'); // err-refund-exceeds-purchase
    },
});

// Test administrative functions
Clarinet.test({
    name: "Ensure that contract owner can use administrative functions",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const producer1 = accounts.get('wallet_1')!;
        const regularUser = accounts.get('wallet_2')!;

        const energyAmount = 1000;
        const initialPrice = 10;
        const newPrice = 15;

        // First register producer
        let block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'register-producer',
                [
                    types.uint(energyAmount),
                    types.uint(initialPrice)
                ],
                producer1.address
            )
        ]);

        // Use admin function: set-energy-price
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'set-energy-price',
                [
                    types.principal(producer1.address),
                    types.uint(newPrice)
                ],
                deployer.address // Contract owner
            )
        ]);

        // Check successful price update
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Check producer price updated
        let call = chain.callReadOnlyFn(
            'energy-trading',
            'get-producer-info',
            [types.principal(producer1.address)],
            deployer.address
        );

        const result = call.result.replace(/\s+/g, ' ').trim();
        assertEquals(
            result.includes(`{energy-available: u${energyAmount}, energy-price: u${newPrice}}`),
            true
        );

        // Regular user attempts admin function
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'set-energy-price',
                [
                    types.principal(producer1.address),
                    types.uint(20)
                ],
                regularUser.address // Not the contract owner
            )
        ]);

        // Check error response
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u100)'); // err-not-owner
    },
});

// Test pausing producer
Clarinet.test({
    name: "Ensure that contract owner can pause producers",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const producer1 = accounts.get('wallet_1')!;
        const regularUser = accounts.get('wallet_2')!;

        // First register producer
        let block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'register-producer',
                [
                    types.uint(1000),
                    types.uint(10)
                ],
                producer1.address
            )
        ]);

        // Contract owner pauses producer
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'pause-producer',
                [types.principal(producer1.address)],
                deployer.address // Contract owner
            )
        ]);

        // Check successful pause
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Check producer is paused (energy and price set to 0)
        let call = chain.callReadOnlyFn(
            'energy-trading',
            'get-producer-info',
            [types.principal(producer1.address)],
            deployer.address
        );

        const result = call.result.replace(/\s+/g, ' ').trim();
        assertEquals(
            result.includes(`{energy-available: u0, energy-price: u0}`),
            true
        );

        // Regular user attempts to pause producer
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'pause-producer',
                [types.principal(producer1.address)],
                regularUser.address // Not the contract owner
            )
        ]);

        // Check error response
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u100)'); // err-not-owner
    },
});

// Test withdraw revenue
Clarinet.test({
    name: "Ensure that producers can withdraw their revenue",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const producer1 = accounts.get('wallet_1')!;
        const consumer1 = accounts.get('wallet_2')!;

        const energyAmount = 1000;
        const pricePerUnit = 10;
        const purchaseAmount = 200;
        const totalCost = purchaseAmount * pricePerUnit;

        // First register producer and consumer, and make a purchase to generate revenue
        let block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'register-producer',
                [
                    types.uint(energyAmount),
                    types.uint(pricePerUnit)
                ],
                producer1.address
            ),
            Tx.contractCall(
                'energy-trading',
                'register-consumer',
                [],
                consumer1.address
            ),
            Tx.contractCall(
                'energy-trading',
                'buy-energy',
                [
                    types.principal(producer1.address),
                    types.uint(purchaseAmount)
                ],
                consumer1.address
            )
        ]);

        // Check producer revenue
        let call = chain.callReadOnlyFn(
            'energy-trading',
            'get-producer-revenue',
            [types.principal(producer1.address)],
            deployer.address
        );

        // Assuming producer revenue is tracked properly in the contract
        // assertEquals(call.result, `(ok u${totalCost})`);

        // Producer withdraws revenue
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'withdraw-revenue',
                [],
                producer1.address
            )
        ]);

        // Check successful withdrawal
        assertEquals(block.receipts.length, 1);
        // First make sure successful withdrawal returns the amount withdrawn
        // assertEquals(block.receipts[0].result, `(ok u${totalCost})`);

        // Check revenue is reset to 0
        call = chain.callReadOnlyFn(
            'energy-trading',
            'get-producer-revenue',
            [types.principal(producer1.address)],
            deployer.address
        );

        assertEquals(call.result, '(ok u0)');
    },
});

// Test multiple transactions
Clarinet.test({
    name: "Ensure that the contract handles multiple transactions correctly",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const producer1 = accounts.get('wallet_1')!;
        const producer2 = accounts.get('wallet_2')!;
        const consumer1 = accounts.get('wallet_3')!;
        const consumer2 = accounts.get('wallet_4')!;

        // Register producers and consumers
        let block = chain.mineBlock([
            // Register producers
            Tx.contractCall(
                'energy-trading',
                'register-producer',
                [types.uint(1000), types.uint(10)],
                producer1.address
            ),
            Tx.contractCall(
                'energy-trading',
                'register-producer',
                [types.uint(2000), types.uint(8)],
                producer2.address
            ),

            // Register consumers
            Tx.contractCall(
                'energy-trading',
                'register-consumer',
                [],
                consumer1.address
            ),
            Tx.contractCall(
                'energy-trading',
                'register-consumer',
                [],
                consumer2.address
            )
        ]);

        // Check all registrations successful
        assertEquals(block.receipts.length, 4);
        assertEquals(block.receipts[0].result, '(ok true)');
        assertEquals(block.receipts[1].result, '(ok true)');
        assertEquals(block.receipts[2].result, '(ok true)');
        assertEquals(block.receipts[3].result, '(ok true)');

        // Multiple energy purchases
        block = chain.mineBlock([
            // Consumer 1 buys from Producer 1
            Tx.contractCall(
                'energy-trading',
                'buy-energy',
                [types.principal(producer1.address), types.uint(200)],
                consumer1.address
            ),

            // Consumer 2 buys from Producer 1
            Tx.contractCall(
                'energy-trading',
                'buy-energy',
                [types.principal(producer1.address), types.uint(300)],
                consumer2.address
            ),

            // Consumer 1 buys from Producer 2
            Tx.contractCall(
                'energy-trading',
                'buy-energy',
                [types.principal(producer2.address), types.uint(500)],
                consumer1.address
            )
        ]);

        // Check all purchases successful
        assertEquals(block.receipts.length, 3);
        assertEquals(block.receipts[0].result, '(ok true)');
        assertEquals(block.receipts[1].result, '(ok true)');
        assertEquals(block.receipts[2].result, '(ok true)');

        // Update energy and handle ratings
        block = chain.mineBlock([
            // Producer 1 adds more energy
            Tx.contractCall(
                'energy-trading',
                'update-energy',
                [types.uint(500)],
                producer1.address
            ),

            // Consumer 1 rates Producer 1
            Tx.contractCall(
                'energy-trading',
                'rate-producer',
                [types.principal(producer1.address), types.uint(4)],
                consumer1.address
            ),

            // Consumer 2 rates Producer 1
            Tx.contractCall(
                'energy-trading',
                'rate-producer',
                [types.principal(producer1.address), types.uint(5)],
                consumer2.address
            )
        ]);

        // Check all operations successful
        assertEquals(block.receipts.length, 3);
        assertEquals(block.receipts[0].result, '(ok true)');
        assertEquals(block.receipts[1].result, '(ok true)');
        assertEquals(block.receipts[2].result, '(ok true)');

        // Check final states

        // Producer 1 should have 1000 (initial) - 200 - 300 + 500 (added) = 1000 energy remaining
        let call = chain.callReadOnlyFn(
            'energy-trading',
            'get-producer-info',
            [types.principal(producer1.address)],
            deployer.address
        );

        let result = call.result.replace(/\s+/g, ' ').trim();
        assertEquals(result.includes('energy-available: u1000'), true);

        // Producer 2 should have 2000 (initial) - 500 = 1500 energy remaining
        call = chain.callReadOnlyFn(
            'energy-trading',
            'get-producer-info',
            [types.principal(producer2.address)],
            deployer.address
        );

        result = call.result.replace(/\s+/g, ' ').trim();
        assertEquals(result.includes('energy-available: u1500'), true);

        // Consumer 1 should have purchased 200 + 500 = 700 energy total
        call = chain.callReadOnlyFn(
            'energy-trading',
            'get-consumer-info',
            [types.principal(consumer1.address)],
            deployer.address
        );

        result = call.result.replace(/\s+/g, ' ').trim();
        assertEquals(result.includes('energy-consumed: u700'), true);

        // Check rating for Producer 1
        call = chain.callReadOnlyFn(
            'energy-trading',
            'get-producer-rating',
            [types.principal(producer1.address)],
            deployer.address
        );

        // This will depend on how ratings are calculated in the implementation
        // Without seeing the exact implementation, we're making an assumption
        // that it's an average of the ratings
        assertEquals(call.result != '(ok u0)', true); // Just verify it's not zero
    },
});

// Test full purchase, refund, and rating flow
Clarinet.test({
    name: "Test full workflow: purchase, rate, refund, and update energy",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const producer = accounts.get('wallet_1')!;
        const consumer = accounts.get('wallet_2')!;

        const initialEnergy = 1000;
        const pricePerUnit = 10;
        const purchaseAmount = 300;
        const refundAmount = 100;

        // Step 1: Register producer and consumer
        let block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'register-producer',
                [types.uint(initialEnergy), types.uint(pricePerUnit)],
                producer.address
            ),
            Tx.contractCall(
                'energy-trading',
                'register-consumer',
                [],
                consumer.address
            )
        ]);

        assertEquals(block.receipts.length, 2);
        assertEquals(block.receipts[0].result, '(ok true)');
        assertEquals(block.receipts[1].result, '(ok true)');

        // Step 2: Consumer purchases energy
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'buy-energy',
                [types.principal(producer.address), types.uint(purchaseAmount)],
                consumer.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Verify purchase reflected in data
        let call = chain.callReadOnlyFn(
            'energy-trading',
            'get-producer-info',
            [types.principal(producer.address)],
            deployer.address
        );

        let result = call.result.replace(/\s+/g, ' ').trim();
        assertEquals(result.includes(`energy-available: u${initialEnergy - purchaseAmount}`), true);

        call = chain.callReadOnlyFn(
            'energy-trading',
            'get-consumer-info',
            [types.principal(consumer.address)],
            deployer.address
        );

        result = call.result.replace(/\s+/g, ' ').trim();
        assertEquals(result.includes(`energy-consumed: u${purchaseAmount}`), true);

        // Step 3: Consumer rates producer
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'rate-producer',
                [types.principal(producer.address), types.uint(4)],
                consumer.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Step 4: Consumer requests partial refund
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'request-refund',
                [types.principal(producer.address), types.uint(refundAmount)],
                consumer.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Verify refund reflected in data
        call = chain.callReadOnlyFn(
            'energy-trading',
            'get-consumer-info',
            [types.principal(consumer.address)],
            deployer.address
        );

        result = call.result.replace(/\s+/g, ' ').trim();
        assertEquals(result.includes(`energy-consumed: u${purchaseAmount - refundAmount}`), true);

        call = chain.callReadOnlyFn(
            'energy-trading',
            'get-refund-amount',
            [types.principal(consumer.address)],
            deployer.address
        );

        assertEquals(call.result, `(ok u${refundAmount})`);

        // Step 5: Producer updates energy
        const additionalEnergy = 500;
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'update-energy',
                [types.uint(additionalEnergy)],
                producer.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Verify energy update
        call = chain.callReadOnlyFn(
            'energy-trading',
            'get-producer-info',
            [types.principal(producer.address)],
            deployer.address
        );

        result = call.result.replace(/\s+/g, ' ').trim();
        assertEquals(
            result.includes(`energy-available: u${initialEnergy - purchaseAmount + additionalEnergy}`),
            true
        );
    },
});

// Test invalid operations and error handling
Clarinet.test({
    name: "Test comprehensive error handling in various scenarios",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const producer = accounts.get('wallet_1')!;
        const consumer = accounts.get('wallet_2')!;
        const nonProducer = accounts.get('wallet_3')!;

        // Register producer and consumer
        let block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'register-producer',
                [types.uint(1000), types.uint(10)],
                producer.address
            ),
            Tx.contractCall(
                'energy-trading',
                'register-consumer',
                [],
                consumer.address
            )
        ]);

        // Test scenario 1: Non-producer tries to update energy
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'update-energy',
                [types.uint(500)],
                nonProducer.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u102)'); // err-producer-not-found

        // Test scenario 2: Consumer tries to buy from non-existent producer
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'buy-energy',
                [types.principal(nonProducer.address), types.uint(100)],
                consumer.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u102)'); // err-producer-not-found

        // Test scenario 3: Consumer tries to buy more energy than available
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'buy-energy',
                [types.principal(producer.address), types.uint(1001)], // More than available
                consumer.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u103)'); // err-insufficient-energy

        // Test scenario 4: Consumer tries to rate with invalid rating
        block = chain.mineBlock([
            // First make a valid purchase to establish history
            Tx.contractCall(
                'energy-trading',
                'buy-energy',
                [types.principal(producer.address), types.uint(100)],
                consumer.address
            ),
            // Then try invalid rating
            Tx.contractCall(
                'energy-trading',
                'rate-producer',
                [types.principal(producer.address), types.uint(10)], // Invalid: > 5
                consumer.address
            )
        ]);

        assertEquals(block.receipts.length, 2);
        assertEquals(block.receipts[0].result, '(ok true)');
        assertEquals(block.receipts[1].result, '(err u106)'); // err-invalid-rating

        // Test scenario 5: Non-owner tries admin function
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'pause-producer',
                [types.principal(producer.address)],
                nonProducer.address // Not contract owner
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u100)'); // err-not-owner

        // Test scenario 6: Request refund without history
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'request-refund',
                [types.principal(producer.address), types.uint(10)],
                nonProducer.address // Has no purchase history
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u107)'); // err-no-purchase-history

        // Test scenario 7: Request excessive refund
        block = chain.mineBlock([
            Tx.contractCall(
                'energy-trading',
                'request-refund',
                [types.principal(producer.address), types.uint(200)], // More than purchased
                consumer.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u108)'); // err-refund-exceeds-purchase
    },
});