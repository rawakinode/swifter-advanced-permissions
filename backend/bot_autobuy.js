import 'dotenv/config';
import axios from "axios";
import { createExecution, getDeleGatorEnvironment, ExecutionMode } from "@metamask/delegation-toolkit"
import { DelegationManager } from "@metamask/delegation-toolkit/contracts"
import { encodeFunctionData, erc20Abi, parseEther, parseUnits, zeroAddress } from 'viem';
import { MongoClient } from "mongodb";
import { delegateAutoBuyClient, publicClient, autoBuyAccount } from './client.js';
import { monadTestnet as chain } from "viem/chains";

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
        console.log(`[Subscription Bot] Iterations: ${count}`);

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

// Eksekusi satu subscription
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
                await handleFailedExecution(subscription, hash, 'Transaction failed');
                console.log(`Subscription ${subscription._id} transaction failed`);
            }
        } else {
            await handleFailedExecution(subscription, '', 'No transaction hash received');
        }
    } catch (error) {
        console.error(`Error executing subscription ${subscription._id}:`, error);
        await handleFailedExecution(subscription, '', error.message);
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
                // TAMBAHKAN BARIS INI
                $push: {
                    execution_history: {
                        timestamp: new Date(),
                        status: "success",
                        transactionHash: hash,
                        executedAmount: subscription.amount_formatted,
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
    const nextExecutionTimestamp = subscription.nextExecutionTimestamp + subscription.frequencyInSecond;
    const nextExecutionDate = new Date(nextExecutionTimestamp * 1000);

    // Check if subscription has expired (beyond endTimestamp)
    if (nextExecutionTimestamp > subscription.endTimestamp) {
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
                // TAMBAHKAN BARIS INI
                $push: {
                    execution_history: {
                        timestamp: new Date(),
                        status: "success",
                        transactionHash: hash,
                        executedAmount: subscription.amount_formatted,
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
            // TAMBAHKAN BARIS INI
            $push: {
                execution_history: {
                    timestamp: new Date(),
                    status: "success",
                    transactionHash: hash,
                    executedAmount: subscription.amount_formatted,
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

    // Increment failure count
    const newFailureCount = (subscription.failureCount || 0) + 1;

    // If too many failures, mark as failed
    if (newFailureCount >= 3) { // Max 3 failures
        await db.collection("subscriptions").updateOne(
            { _id: subscription._id },
            {
                $set: {
                    status: "failed",
                    failureCount: newFailureCount,
                    lastError: errorMessage,
                    failedAt: new Date()
                },
                // TAMBAHKAN BARIS INI
                $push: {
                    execution_history: {
                        timestamp: new Date(),
                        status: "failed",
                        error: errorMessage,
                        transactionHash: hash || null
                    }
                }
            }
        );
        console.log(`Subscription ${subscription._id} marked as failed after ${newFailureCount} failures`);
    } else {
        // Retry after delay (e.g., 10 minutes)
        const retryTimestamp = Math.floor(Date.now() / 1000) + 180; // 10 minutes from now
        const retryDate = new Date(retryTimestamp * 1000);

        await db.collection("subscriptions").updateOne(
            { _id: subscription._id },
            {
                $set: {
                    failureCount: newFailureCount,
                    nextExecution: retryDate.toISOString(),
                    nextExecutionTimestamp: retryTimestamp,
                    lastError: errorMessage,
                    lastRetryTime: new Date()
                },
                // TAMBAHKAN BARIS INI
                $push: {
                    execution_history: {
                        timestamp: new Date(),
                        status: "failed",
                        error: errorMessage,
                        transactionHash: hash || null
                    }
                }
            }
        );
        console.log(`Subscription ${subscription._id} will retry at ${retryDate}`);
    }
}

// Eksekusi task swap untuk subscription
async function executeSubscriptionTask(subscription) {
    try {
        // Create payload to get quote swap from monorail
        const payload = {
            "from": subscription.paymentToken.address,
            "to": subscription.targetToken.address,
            "amount": subscription.amount_formatted,
            "slippage": (Number(subscription.settings?.slippage || 1) * 100).toString(),
            "deadline": "600",
            "sender": subscription.smart_account
        }

        const quoteSwap = await getQuoteSwap(payload);
        if (!quoteSwap) {
            throw new Error("Failed to get quote swap");
        }

        // Prepare delegations and amounts
        const delegations = [subscription.signedSwapDelegation];
        const delegations_approve = [subscription.signedApproveDelegation];
        const amount = parseEther(subscription.amount_formatted);
        const erc20_amount = BigInt(subscription.amount);

        console.log('Executing subscription swap for amount:', subscription.amount_formatted);

        if (subscription.paymentToken.address.toLowerCase() == zeroAddress.toLowerCase()) {
            // Native token swap
            const executions = [createExecution({
                target: process.env.MONORAIL_ADDRESS,
                value: amount,
                callData: quoteSwap.transaction.data
            })];

            const redeemDelegationCalldata = DelegationManager.encode.redeemDelegations({
                delegations: [delegations],
                modes: [ExecutionMode.SingleDefault],
                executions: [executions]
            });

            const transactionHash = await delegateAutoBuyClient.sendTransaction({
                account: autoBuyAccount,
                to: getDeleGatorEnvironment(chain.id).DelegationManager,
                data: redeemDelegationCalldata,
                chain,
            });

            return transactionHash;

        } else {
            // ERC20 token swap - need approval first
            const callData = encodeFunctionData({
                abi: erc20Abi,
                functionName: "approve",
                args: [process.env.MONORAIL_ADDRESS, erc20_amount],
            });

            const approveExecution = [createExecution({
                target: subscription.paymentToken.address,
                value: 0n,
                callData: callData,
            })];

            const swapExecution = [createExecution({
                target: process.env.MONORAIL_ADDRESS,
                value: 0n,
                callData: quoteSwap.transaction.data
            })];

            // Execute approval
            const redeemDelegationCalldata = DelegationManager.encode.redeemDelegations({
                delegations: [delegations_approve],
                modes: [ExecutionMode.SingleDefault],
                executions: [approveExecution]
            });

            const currentNonce = await publicClient.getTransactionCount({
                address: autoBuyAccount.address
            });

            const transactionHash1 = await delegateAutoBuyClient.sendTransaction({
                account: autoBuyAccount,
                to: getDeleGatorEnvironment(chain.id).DelegationManager,
                data: redeemDelegationCalldata,
                chain,
                nonce: currentNonce
            });

            console.log('Approval transaction hash:', transactionHash1);

            await new Promise(r => setTimeout(r, 4000));

            // Execute swap
            const redeemDelegationCalldata2 = DelegationManager.encode.redeemDelegations({
                delegations: [delegations],
                modes: [ExecutionMode.SingleDefault],
                executions: [swapExecution]
            });

            const transactionHash2 = await delegateAutoBuyClient.sendTransaction({
                account: autoBuyAccount,
                to: getDeleGatorEnvironment(chain.id).DelegationManager,
                data: redeemDelegationCalldata2,
                chain,
                nonce: currentNonce + 1
            });

            console.log(transactionHash2);


            await new Promise(r => setTimeout(r, 2000));

            return transactionHash2;
        }

    } catch (error) {
        console.log('Error in executeSubscriptionTask:', error);
        throw error;
    }
}

// Fungsi untuk mendapatkan swap data
const getQuoteSwap = async (payload) => {
    const from = payload.from;
    const to = payload.to;
    const amount = payload.amount;
    const slippage = payload.slippage;
    const deadline = payload.deadline;
    const sender = payload.sender;

    const url = `https://testnet-pathfinder.monorail.xyz/v4/quote?amount=${amount}&from=${from}&to=${to}&slippage=${slippage}&deadline=${deadline}&source=1175140441783&sender=${sender}`;

    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.log('Error getting quote swap:', error);
        return null;
    }
}

// Start the bot
run().catch(console.error);