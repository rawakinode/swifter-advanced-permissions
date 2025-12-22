import 'dotenv/config';
import { encodeFunctionData, erc20Abi, parseEther, parseUnits, zeroAddress } from 'viem';
import { MongoClient } from "mongodb";
import { getSwap } from './handler/swap.js';
import { bundlerClient, pimlicoClient, publicClient, sessionSmartAccount } from './permission_client.js';

// MongoDB Atlas init
const uri = process.env.MONGODB_DB_URL;
let mongoClient;
let db;

// Koneksi DB
async function connectDB() {
    try {
        if (db) return db;
        mongoClient = new MongoClient(uri);
        await mongoClient.connect();
        db = mongoClient.db("swifter-v2");
        console.log('MongoDB client connected.');
        return db;
    } catch (err) {
        console.error("MongoDB connection error:", err);
    }
}

// Jalankan fungsi utama
async function run() {
    let count = 0;
    while (true) {
        count++;
        console.log(`[AutoBuy Bot] Iterations: ${count}`);

        await new Promise(r => setTimeout(r, 5000)); // Check every 5 seconds
        await processSubscriptions();
    }
}

// Mendapatkan semua subscription yang aktif dan perlu dijalankan
async function processSubscriptions() {
    try {
        const db = await connectDB();
        const now = Math.floor(Date.now() / 1000); // Current timestamp in seconds

        // Cari subscription yang aktif dan nextExecutionTimestamp sudah tiba
        const subscriptions = await db.collection("subscriptions")
            .find({
                status: "active",
                nextExecutionTimestamp: { $lte: now }
            })
            .sort({ nextExecutionTimestamp: 1 })
            .toArray();

        if (!subscriptions.length) {
            console.log("No active subscriptions ready for execution.");
            return;
        }

        console.log(`Found ${subscriptions.length} subscriptions ready for execution`);

        for (const subscription of subscriptions) {
            await executeSubscription(subscription);
        }

    } catch (error) {
        console.error("Error processing subscriptions:", error);
    }
}

async function executeSubscription(subscription) {
    console.log(`Executing subscription ${subscription._id}`);

    try {
        const hash = await executeSubscriptionTask(subscription);
        console.log(`Transaction hash: ${hash}`);

        if (hash) {
            // Tunggu konfirmasi transaksi
            await new Promise(r => setTimeout(r, 3000));
            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (receipt.status === 'success' || receipt.status === 1n || receipt.status === 1) {
                await handleSuccessfulExecution(subscription, hash);
                console.log(`Subscription ${subscription._id} executed successfully`);
            } else {
                // Langsung catat sebagai failed tanpa percobaan ulang
                await handleFailedExecution(subscription, hash, 'Transaction failed on-chain');
                console.log(`Subscription ${subscription._id} transaction failed, marked as failed and moving to next execution`);
            }
        } else {
            // Langsung catat sebagai failed tanpa percobaan ulang
            await handleFailedExecution(subscription, '', 'No transaction hash received');
            console.log(`Subscription ${subscription._id} failed to get transaction hash, marked as failed`);
        }
    } catch (error) {
        console.error(`Error executing subscription ${subscription._id}:`, error);
        // Langsung catat sebagai failed tanpa percobaan ulang
        await handleFailedExecution(subscription, '', error.message);
        console.log(`Subscription ${subscription._id} encountered error, marked as failed`);
    }
}

// Handle eksekusi berhasil - update status dan jadwalkan berikutnya
async function handleSuccessfulExecution(subscription, hash) {
    const db = await connectDB();

    // Update executed count
    const newExecutedCount = subscription.executed + 1;

    // Check if subscription should continue
    if (newExecutedCount >= subscription.totalExecutions) {
        // Subscription completed
        await db.collection("subscriptions").updateOne(
            { _id: subscription._id },
            {
                $set: {
                    status: "completed",
                    executed: newExecutedCount,
                    lastExecutionHash: hash,
                    lastExecutionTime: new Date(),
                    completedAt: new Date()
                },
                $push: {
                    execution_history: {
                        timestamp: new Date(),
                        status: "success",
                        transactionHash: hash,
                        executedAmount: subscription.amount_formatted || subscription.amount,
                        fromToken: subscription.paymentToken.symbol,
                        toToken: subscription.targetToken.symbol
                    }
                }
            }
        );
        console.log(`Subscription ${subscription._id} completed all executions`);
        return;
    }

    // Calculate next execution time
    const nextExecutionTimestamp = subscription.nextExecutionTimestamp + subscription.frequency_in_second;
    const nextExecutionDate = new Date(nextExecutionTimestamp * 1000);

    // Check if subscription has expired (beyond endTimestamp)
    if (nextExecutionTimestamp > subscription.duration_in_second) {
        await db.collection("subscriptions").updateOne(
            { _id: subscription._id },
            {
                $set: {
                    status: "expired",
                    executed: newExecutedCount,
                    lastExecutionHash: hash,
                    lastExecutionTime: new Date(),
                    expiredAt: new Date()
                },
                $push: {
                    execution_history: {
                        timestamp: new Date(),
                        status: "success",
                        transactionHash: hash,
                        executedAmount: subscription.amount_formatted || subscription.amount,
                        fromToken: subscription.paymentToken.symbol,
                        toToken: subscription.targetToken.symbol
                    }
                }
            }
        );
        console.log(`Subscription ${subscription._id} expired`);
        return;
    }

    // Update for next execution
    await db.collection("subscriptions").updateOne(
        { _id: subscription._id },
        {
            $set: {
                executed: newExecutedCount,
                nextExecution: nextExecutionDate.toISOString(),
                nextExecutionTimestamp: nextExecutionTimestamp,
                lastExecutionHash: hash,
                lastExecutionTime: new Date()
            },
            $push: {
                execution_history: {
                    timestamp: new Date(),
                    status: "success",
                    transactionHash: hash,
                    executedAmount: subscription.amount_formatted || subscription.amount,
                    fromToken: subscription.paymentToken.symbol,
                    toToken: subscription.targetToken.symbol
                }
            }
        }
    );

    console.log(`Subscription ${subscription._id} scheduled for next execution at ${nextExecutionDate}`);
}

// Handle eksekusi gagal
async function handleFailedExecution(subscription, hash, errorMessage) {
    const db = await connectDB();

    // Update executed count - TETAP tambah 1 walau gagal
    const newExecutedCount = subscription.executed + 1;

    // Hitung waktu eksekusi berikutnya
    const nextExecutionTimestamp = subscription.nextExecutionTimestamp + subscription.frequency_in_second;
    const nextExecutionDate = new Date(nextExecutionTimestamp * 1000);

    // Check if subscription should continue (berdasarkan executed count)
    if (newExecutedCount >= subscription.totalExecutions) {
        // Subscription completed meskipun ada yang gagal
        await db.collection("subscriptions").updateOne(
            { _id: subscription._id },
            {
                $set: {
                    status: "completed",
                    executed: newExecutedCount,
                    lastExecutionHash: hash,
                    lastExecutionTime: new Date(),
                    completedAt: new Date()
                },
                $push: {
                    execution_history: {
                        timestamp: new Date(),
                        status: "failed",
                        error: errorMessage,
                        transactionHash: hash || null,
                        executedAmount: subscription.amount_formatted || subscription.amount,
                        fromToken: subscription.paymentToken.symbol,
                        toToken: subscription.targetToken.symbol
                    }
                }
            }
        );
        console.log(`Subscription ${subscription._id} completed all executions (last one failed)`);
        return;
    }

    // Check if subscription has expired (beyond endTimestamp)
    if (nextExecutionTimestamp > subscription.duration_in_second) {
        await db.collection("subscriptions").updateOne(
            { _id: subscription._id },
            {
                $set: {
                    status: "expired",
                    executed: newExecutedCount,
                    lastExecutionHash: hash,
                    lastExecutionTime: new Date(),
                    expiredAt: new Date()
                },
                $push: {
                    execution_history: {
                        timestamp: new Date(),
                        status: "failed",
                        error: errorMessage,
                        transactionHash: hash || null,
                        executedAmount: subscription.amount_formatted || subscription.amount,
                        fromToken: subscription.paymentToken.symbol,
                        toToken: subscription.targetToken.symbol
                    }
                }
            }
        );
        console.log(`Subscription ${subscription._id} expired (last execution failed)`);
        return;
    }

    // Update untuk eksekusi berikutnya
    await db.collection("subscriptions").updateOne(
        { _id: subscription._id },
        {
            $set: {
                executed: newExecutedCount,
                nextExecution: nextExecutionDate.toISOString(),
                nextExecutionTimestamp: nextExecutionTimestamp,
                lastExecutionHash: hash,
                lastExecutionTime: new Date()
            },
            $push: {
                execution_history: {
                    timestamp: new Date(),
                    status: "failed",
                    error: errorMessage,
                    transactionHash: hash || null,
                    executedAmount: subscription.amount_formatted || subscription.amount,
                    fromToken: subscription.paymentToken.symbol,
                    toToken: subscription.targetToken.symbol
                }
            }
        }
    );

    console.log(`Subscription ${subscription._id} (failed) scheduled for next execution at ${nextExecutionDate}`);
}

// Eksekusi task swap untuk subscription dengan metode baru
async function executeSubscriptionTask(subscription) {
    try {
        const sessionAccount = await sessionSmartAccount(subscription.wallet_address);

        // Prepare token addresses for swap
        const fromTokenAddress =
            subscription.paymentToken.address.toLowerCase() === zeroAddress.toLowerCase()
                ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
                : subscription.paymentToken.address;

        const toTokenAddress =
            subscription.targetToken.address.toLowerCase() === zeroAddress.toLowerCase()
                ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
                : subscription.targetToken.address;

        // Get swap quote
        const quoteSwap = await getSwap({
            publicClient,
            tokenIn: fromTokenAddress,
            tokenOut: toTokenAddress,
            amountIn: subscription.amount_formatted || subscription.amount,
            recipient: subscription.wallet_address,
            slippage: subscription.settings?.slippage || 1,
            deadline: subscription.settings?.deadline || 600
        });

        if (!quoteSwap) {
            throw new Error("Failed to get swap quote");
        }

        // Prepare calls array
        const calls = [];

        // Check if we have permission context for the subscription
        if (!subscription.permission || !subscription.permission[0]) {
            throw new Error("No permission found for subscription");
        }

        // Prepare token transfer call (with permission context)
        if (subscription.paymentToken.address.toLowerCase() !== zeroAddress.toLowerCase()) {
            // ERC20 transfer to session account
            const calldata = encodeFunctionData({
                abi: erc20Abi,
                args: [sessionAccount.address, parseUnits(subscription.amount_formatted || subscription.amount.toString(), subscription.paymentToken.decimals)],
                functionName: 'transfer',
            });

            calls.push({
                to: subscription.paymentToken.address,
                data: calldata,
                permissionsContext: subscription.permission[0].context,
                delegationManager: subscription.permission[0].signerMeta.delegationManager,
            });
        } else {
            // Native token transfer to session account
            calls.push({
                to: sessionAccount.address,
                value: parseEther(subscription.amount_formatted || subscription.amount.toString()),
                data: "0x",
                permissionsContext: subscription.permission[0].context,
                delegationManager: subscription.permission[0].signerMeta.delegationManager,
            });
        }

        // Add ERC20 approval if needed
        if (subscription.paymentToken.address.toLowerCase() !== zeroAddress.toLowerCase()) {
            const calldataApprove = encodeFunctionData({
                abi: erc20Abi,
                functionName: "approve",
                args: [quoteSwap.transaction.to, parseUnits(subscription.amount_formatted || subscription.amount.toString(), subscription.paymentToken.decimals)],
            });

            calls.push({
                to: subscription.paymentToken.address,
                data: calldataApprove,
            });
        }

        // Add swap call
        calls.push({
            to: quoteSwap.transaction.to,
            data: quoteSwap.transaction.data,
            value: quoteSwap.transaction.value || 0n,
        });

        // Get gas price
        const userOperationGasPrice = await pimlicoClient.getUserOperationGasPrice();

        // Send user operation with delegation
        const userOperationHash = await bundlerClient.sendUserOperationWithDelegation({
            publicClient,
            account: sessionAccount,
            calls,
            ...userOperationGasPrice,
        });

        // Wait for receipt
        const { receipt } = await bundlerClient.waitForUserOperationReceipt({
            hash: userOperationHash
        });

        if (receipt) {
            return receipt.transactionHash;
        }

        return null;

    } catch (error) {
        console.log('Error in executeSubscriptionTask:', error);
        throw error;
    }
}

// Start the bot
run().catch(console.error);