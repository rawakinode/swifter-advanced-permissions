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

run();

// jalankan fungsi utama
async function run() {
    let count = 0;
    while (true) {
        count++;
        console.log(`Iterations: ${count}`);

        await new Promise(r => setTimeout(r, 2000));
        await getTask();
    }
}

// mendapatkan semua task yang status='active' dan urutkan
async function getTask() {
    try {
        const db = await connectDB();
        const tasks = await db.collection("task")
            .find({ status: "active", type: "scheduled" })
            .sort({ timestampExecute: 1 })
            .toArray();

        if (!tasks.length) {
            console.log("No active task.");
            return;
        }

        for (const task of tasks) {
            const now = Math.floor(Date.now() / 1000);
            if (now >= task.swap_scheduled_execution_time) {
                await executeOnce(task);
            } else {
                console.log(`Task ${task._id} not execute yet (execute at ${task.swap_scheduled_execution_time})`);
            }
        }

    } catch (error) {
        console.error("Error getTask:", error);
    }
}

// Fungsi eksekusi sekali tanpa retry
async function executeOnce(task) {
    console.log(`Executing task ${task._id}`);

    const hash = await executeTask(task);
    console.log(`Transaction hash: ${hash}`);

    if (hash) {
        try {
            await updateStatus(task, 'completed', hash, '');
            console.log(`Transaction successful`);
        } catch (err) {
            console.error(`Error:`, err);
            await updateStatus(task, 'failed', hash, err.message);
        }
    } else {
        console.log(`No transaction hash received`);
        await updateStatus(task, 'failed', '', 'No transaction hash received');
    }
}

// Ekseskui task swap
async function executeTask(task) {
    try {

        let calls = [];
        const sessionAccount = await sessionSmartAccount(task.owner_address);
        const fromTokenAddress =
            task.from_token.address.toLowerCase() === '0x0000000000000000000000000000000000000000'
                ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
                : task.from_token.address;

        const toTokenAddress =
            task.to_token.address.toLowerCase() === '0x0000000000000000000000000000000000000000'
                ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
                : task.to_token.address;

        const quoteSwap = await getSwap({
            publicClient,
            tokenIn: fromTokenAddress,
            tokenOut: toTokenAddress,
            amountIn: task.from_amount,
            recipient: task.owner_address,
        });

        if (!quoteSwap) { return null };

        if (task.from_token.address.toLowerCase() !== zeroAddress) {
            // erc20 transferr
            const calldata = encodeFunctionData({
                abi: erc20Abi,
                args: [sessionAccount.address, parseUnits(task.from_amount.toString(), task.from_token.decimals)],
                functionName: 'transfer',
            });

            calls.push({
                to: task.from_token.address,
                data: calldata,
                permissionsContext: task.permission[0].context,
                delegationManager: task.permission[0].signerMeta.delegationManager,
            });

        } else {
            // native token transfer
            calls.push({
                to: sessionAccount.address,
                value: parseEther(task.from_amount.toString()),
                data: "0x",
                permissionsContext: task.permission[0].context,
                delegationManager: task.permission[0].signerMeta.delegationManager,
            });
        }

        if (task.from_token.address.toLowerCase() !== zeroAddress) {
            const calldataApprove = encodeFunctionData({
                abi: erc20Abi,
                functionName: "approve",
                args: [quoteSwap.transaction.to, parseUnits(task.from_amount, task.from_token.decimals).toString()],
            });

            calls.push({
                to: task.from_token.address,
                data: calldataApprove,
            });
        }

        // add swap call
        calls.push({
            to: quoteSwap.transaction.to,
            data: quoteSwap.transaction.data,
            value: quoteSwap.transaction.value,
        });

        const userOperationGasPrice = await pimlicoClient.getUserOperationGasPrice();

        const userOperationHash = await bundlerClient.sendUserOperationWithDelegation({
            publicClient,
            account: sessionAccount,
            calls,
            ...userOperationGasPrice,
        });

        const { receipt } = await bundlerClient.waitForUserOperationReceipt({ hash: userOperationHash });

        if (receipt) {
            return receipt.transactionHash;
        }

    } catch (error) {
        console.log('Error in executeTask:', error);
        return null;
    }
}

// Update status task di DB
async function updateStatus(task, status, hash, message) {
    const db = await connectDB();
    await db.collection("task").updateOne(
        { _id: task._id },
        { $set: { status: status, hash: hash, message_status: message } }
    );
}