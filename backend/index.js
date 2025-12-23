import 'dotenv/config';
import express from "express";
import cors from "cors";
import axios from "axios";
import jwt from 'jsonwebtoken';
import { encodeFunctionData, parseEther, parseUnits, verifyMessage, zeroAddress } from 'viem';
import crypto from 'crypto';
import { createPublicClient, http, formatUnits, erc20Abi } from "viem";
import { form, sepolia } from "viem/chains";
import { MongoClient, ObjectId } from "mongodb";
import { tokenList } from './tokenlist.js';
import { sessionSmartAccount, pimlicoClient, paymasterClient, bundlerClient, publicClient } from './permission_client.js';
import { getSwap, getSwapQuoteData } from "./handler/swap.js";

const client = createPublicClient({ chain: sepolia, transport: http(sepolia.rpcUrls.default.http[0]) });

const app = express();
const PORT = 3300;
const JWT_SECRET = process.env.JWT_SECRET || 'aabbccddeessdfsfsrgsegsdfgserg3wegeg7787834t87ff';
const TOKEN_EXPIRY = '1h';

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-signature'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

app.use(express.json())
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-signature, Authorization");
    next();
});

// MongoDB Atlas init
const uri = process.env.MONGODB_DB_URL;
let mongoClient;
let db;

// Temporary storage untuk nonce 
const nonceStore = new Map();

const ALCHEMY_URL = "https://base-mainnet.g.alchemy.com/v2/BJ39Qw0-XKctwrZOOdQI5";
let tokenListSaved = []; // Format: { address, name, symbol, decimals }

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

// Function
async function getSwapQuote(sellToken, buyToken, sellAmount, slippage, taker) {
    try {
        const data = await getSwapQuoteData({
            publicClient,
            tokenIn: sellToken,
            tokenOut: buyToken,
            amountIn: sellAmount,
            recipient: taker
        });
        return data;
    } catch (error) {
        console.error(error);
        return {};
    }
}

// Function
async function getVerifiedTokenWithBalance(address) {
    try {
        let wallet = "";
        if (address !== undefined) {
            wallet = `&address=${address}`;
        }
        return tokenList;
    } catch (error) {
        console.error(error);
        return null;
    }
}

// Middleware untuk verifikasi JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ message: 'Token tidak ditemukan' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(401).json({ message: 'Token tidak valid atau expired' });
        }
        req.user = user;
        next();
    });
};

// Generate random nonce
const generateNonce = () => {
    return crypto.randomBytes(32).toString('hex');
};

app.get("/all_balance_wallet/:address", async (req, res) => {
    try {
        const address = req.params.address;

        // 1) Ambil list token ERC20 dari Alchemy (tanpa balance)
        const tokenListRes = await axios.post(ALCHEMY_URL, {
            jsonrpc: "2.0",
            id: 1,
            method: "alchemy_getTokenBalances",
            params: [address, "erc20"]
        }, { headers: { "Content-Type": "application/json" } });

        const tokenBalances = tokenListRes.data.result.tokenBalances || [];
        const tokenAddresses = tokenBalances.map(tb => tb.contractAddress);

        // Fungsi untuk mendapatkan metadata token dengan retry mechanism
        const getTokenMetadataWithRetry = async (tokenAddress, maxRetries = 10) => {
            let retries = 0;
            let name = '', symbol = '', decimals = 18;

            while (retries < maxRetries) {
                try {
                    [name, symbol, decimals] = await Promise.all([
                        client.readContract({
                            address: tokenAddress,
                            abi: erc20Abi,
                            functionName: "name"
                        }).catch(() => ""),
                        client.readContract({
                            address: tokenAddress,
                            abi: erc20Abi,
                            functionName: "symbol"
                        }).catch(() => ""),
                        client.readContract({
                            address: tokenAddress,
                            abi: erc20Abi,
                            functionName: "decimals"
                        }).catch(() => 18)
                    ]);

                    // Cek apakah semua metadata sudah lengkap
                    if (name && symbol && decimals !== undefined) {
                        break; // Keluar dari loop jika semua metadata lengkap
                    }

                    retries++;
                    if (retries < maxRetries) {
                        console.log(`Retry ${retries} for token ${tokenAddress} - name: ${name || 'empty'}, symbol: ${symbol || 'empty'}, decimals: ${decimals}`);
                        await new Promise(resolve => setTimeout(resolve, 500 * retries)); // Exponential backoff
                    }
                } catch (error) {
                    retries++;
                    console.log(`Error retry ${retries} for token ${tokenAddress}:`, error.message);
                    if (retries < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 500 * retries));
                    }
                }
            }

            return { name, symbol, decimals };
        };

        // 2) Ambil metadata dan balance untuk setiap token menggunakan Viem
        const tokensWithMeta = await Promise.all(
            tokenAddresses.map(async (tokenAddress) => {
                try {
                    let tokenAddressLower = tokenAddress.toLowerCase();

                    // Cek apakah token sudah ada di cache
                    let cachedToken = tokenListSaved.find(t => t.address.toLowerCase() === tokenAddressLower);

                    // Ambil balance menggunakan Viem
                    let balance;
                    if (tokenAddressLower === "0x0000000000000000000000000000000000000000") {
                        // Native ETH balance
                        balance = await client.getBalance({ address });
                    } else {
                        // ERC-20 balance
                        balance = await client.readContract({
                            address: tokenAddressLower,
                            abi: erc20Abi,
                            functionName: "balanceOf",
                            args: [address]
                        }).catch(() => 0n);
                    }

                    // Skip token dengan balance 0
                    if (balance === 0n) return null;

                    let name, symbol, decimals;

                    if (cachedToken && cachedToken.name && cachedToken.symbol && cachedToken.decimals !== undefined) {
                        // Gunakan data dari cache jika sudah lengkap
                        ({ name, symbol, decimals } = cachedToken);
                    } else {
                        // Ambil metadata dengan retry mechanism
                        const metadata = await getTokenMetadataWithRetry(tokenAddressLower);
                        name = metadata.name;
                        symbol = metadata.symbol;
                        decimals = metadata.decimals;

                        // Update cache
                        if (cachedToken) {
                            // Update existing cache dengan data baru
                            cachedToken.name = name || cachedToken.name || "";
                            cachedToken.symbol = symbol || cachedToken.symbol || "";
                            cachedToken.decimals = decimals !== undefined ? decimals : (cachedToken.decimals || 18);
                        } else {
                            // Tambahkan ke cache
                            const newToken = {
                                address: tokenAddressLower,
                                name: name || "",
                                symbol: symbol || "",
                                decimals: decimals !== undefined ? decimals : 18
                            };
                            tokenListSaved.push(newToken);
                            cachedToken = newToken;
                        }
                    }

                    const formatted_balance = formatUnits(balance, decimals);

                    return {
                        address: tokenAddressLower,
                        symbol: symbol || "UNKNOWN",
                        name: name || "Unknown Token",
                        decimals: decimals,
                        balance: formatted_balance.toString()
                    };
                } catch (err) {
                    console.log(`Error processing token ${tokenAddress}:`, err);
                    return null;
                }
            })
        );

        // Filter out null values (token dengan balance 0 atau error)
        const validTokens = tokensWithMeta.filter(token => token !== null);

        // 3) Tambahkan native ETH balance
        const nativeBalance = await client.getBalance({ address });
        const nativeFormatted = formatUnits(nativeBalance, 18);

        // Cek apakah native ETH sudah ada di list (jangan duplikat)
        const nativeTokenExists = validTokens.some(token =>
            token.address === "0x0000000000000000000000000000000000000000"
        );

        if (!nativeTokenExists && nativeBalance > 0n) {
            validTokens.unshift({
                address: "0x0000000000000000000000000000000000000000",
                symbol: "ETH",
                name: "Ethereum",
                decimals: 18,
                balance: nativeFormatted
            });
        }

        res.json(validTokens);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "error get data" });
    }
});

app.get("/balance/:address", async (req, res) => {
    try {
        const address = req.params.address;
        const tokenQuery = req.query.token?.toLowerCase();

        if (!tokenQuery) {
            return res.status(400).json({ error: "Query param 'token' required" });
        }

        // jika tokenQuery = native 
        if (tokenQuery === "0x0000000000000000000000000000000000000000") {
            const nativeBalance = await client.getBalance({ address });
            const formatted = formatUnits(nativeBalance, 18);

            return res.json({
                address: tokenQuery,
                symbol: "ETH",
                name: "Ethereum",
                decimals: 18,
                balance: formatted,
            });
        }

        // jika token ERC-20
        const [name, symbol, decimals, rawBalance] = await Promise.all([
            client.readContract({ address: tokenQuery, abi: erc20Abi, functionName: "name" }).catch(() => ""),
            client.readContract({ address: tokenQuery, abi: erc20Abi, functionName: "symbol" }).catch(() => ""),
            client.readContract({ address: tokenQuery, abi: erc20Abi, functionName: "decimals" }).catch(() => 18),
            client.readContract({ address: tokenQuery, abi: erc20Abi, functionName: "balanceOf", args: [address] }).catch(() => 0n),
        ]);

        const formatted_balance = formatUnits(rawBalance, decimals);

        if (rawBalance === 0n) {
            return res.status(404).json({ error: "Token not found or balance 0" });
        }

        res.json({
            address: tokenQuery,
            symbol: symbol || "",
            name: name || "",
            decimals,
            balance: formatted_balance,
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "error get data" });
    }
});

app.get("/get_quote", async (req, res) => {
    try {
        const { from, to, amount, slippage, sender } = req.query;

        if (!from || !to || !amount || !slippage) {
            return res.status(400).json({ error: "Missing required query parameters" });
        }

        const data = await getSwapQuote(from, to, amount, slippage, sender);
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error fetching quote" });
    }
});

app.get("/verified_token", async (req, res) => {
    try {
        const { address } = req.query;
        const data = await getVerifiedTokenWithBalance(address);
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error fetching verified tokens" });
    }
});

app.post('/api/auth/nonce', (req, res) => {
    try {
        const { address } = req.body;

        if (!address) {
            return res.status(400).json({ message: 'Address diperlukan' });
        }

        // Validasi format address
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
            return res.status(400).json({ message: 'Format address tidak valid' });
        }

        const nonce = generateNonce();
        const message = `Sign this message to authenticate with your wallet.\n\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString()}`;

        // Simpan nonce dengan timestamp
        nonceStore.set(address.toLowerCase(), {
            nonce,
            timestamp: Date.now()
        });

        res.json({
            nonce,
            message,
            address: address.toLowerCase()
        });
    } catch (error) {
        console.error('Error generating nonce:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/auth', async (req, res) => {
    try {
        const { address, signature, nonce } = req.body;

        if (!address || !signature || !nonce) {
            return res.status(400).json({
                message: 'Address, signature, dan nonce diperlukan'
            });
        }

        const lowerAddress = address.toLowerCase();

        // Cek apakah nonce valid
        const storedData = nonceStore.get(lowerAddress);
        if (!storedData || storedData.nonce !== nonce) {
            return res.status(401).json({
                message: 'Nonce tidak valid atau sudah expired'
            });
        }

        // Cek apakah nonce sudah expired (> 5 menit)
        if (Date.now() - storedData.timestamp > 5 * 60 * 1000) {
            nonceStore.delete(lowerAddress);
            return res.status(401).json({
                message: 'Nonce sudah expired'
            });
        }

        // Recreate message yang sama dengan yang di-sign
        const message = `Sign this message to authenticate with your wallet.\n\nNonce: ${nonce}\nTimestamp: ${new Date(storedData.timestamp).toISOString()}`;

        // Verifikasi signature menggunakan viem
        const isValid = await verifyMessage({
            address: address,
            message: message,
            signature: signature
        });

        if (!isValid) {
            return res.status(401).json({
                message: 'Signature tidak valid'
            });
        }

        // Hapus nonce setelah digunakan (prevent replay attack)
        nonceStore.delete(lowerAddress);

        // Generate JWT token
        const token = jwt.sign(
            {
                address: lowerAddress,
                timestamp: Date.now()
            },
            JWT_SECRET,
            { expiresIn: TOKEN_EXPIRY }
        );

        res.json({
            token,
            expiresIn: 3600000, // 1 jam dalam milliseconds
            address: lowerAddress
        });
    } catch (error) {
        console.error('Error during authentication:', error);
        res.status(500).json({
            message: 'Internal server error',
            error: error.message
        });
    }
});

app.get('/api/is_logged', authenticateToken, (req, res) => {
    try {
        const { address } = req.user;
        res.json({ loggedIn: true, address: address });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.json({ loggedIn: false, address: null });
    }
});

app.get('/api/userdata', authenticateToken, (req, res) => {
    try {
        const { address } = req.user;
        const userData = {
            address: address,
            username: `User_${address.slice(2, 8)}`,
            createdAt: new Date().toISOString(),
        };
        res.json(userData);
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/userdata', authenticateToken, (req, res) => {
    try {
        const { address } = req.user;
        const updateData = req.body;
        res.json({
            message: 'Data berhasil diupdate',
            address: address,
            updatedData: updateData
        });
    } catch (error) {
        console.error('Error updating user data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/api/get_session_account', authenticateToken, async (req, res) => {
    try {
        const ownerAddress = req.user.address;
        const sessionAccount = await sessionSmartAccount(ownerAddress);
        res.status(200).json({ address: sessionAccount.address.toLowerCase() });
    } catch (error) {
        console.error('Error fetching session account:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get all permissions for user
app.get('/api/permissions', authenticateToken, async (req, res) => {
    try {
        const db = await connectDB();
        const ownerAddress = req.user.address;

        const permissions = await db.collection("permissions").find({
            owner_address: ownerAddress.toLowerCase()
        }).sort({ created_at: -1 }).toArray();

        res.status(200).json({
            status: "success",
            count: permissions.length,
            data: permissions
        });
    } catch (error) {
        console.error('Error fetching permissions:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get total remaining token amount by token address and wallet address
app.get('/api/remain_token_permission/', authenticateToken, async (req, res) => {
    try {
        const db = await connectDB();

        const wallet_address = req.user.address?.toLowerCase();
        const token_address = req.query.token_address?.toLowerCase();

        if (!wallet_address || !token_address) {
            return res.status(400).json({
                status: "error",
                message: "wallet_address and token_address are required as query parameters"
            });
        }

        const currentTime = Math.floor(Date.now() / 1000);

        // 👉 normalize wallet_address di DB saat QUERY
        const permissions = await db.collection("permissions").find({
            type: 'immediately',
            $expr: {
                $and: [
                    { $eq: [{ $toLower: "$wallet_address" }, wallet_address] },
                    { $eq: [{ $toLower: "$token.address" }, token_address] },
                    { $gte: ["$expired_in", currentTime] }
                ]
            }
        }).toArray();

        let totalRemaining = 0;

        permissions.forEach(p => {
            totalRemaining += Number(p.amount_remaining) || 0;
        });

        res.status(200).json({
            status: "success",
            count: permissions.length,
            total_remaining: totalRemaining,
        });
    } catch (error) {
        console.error('Error fetching permissions by token:', error);
        res.status(500).json({
            status: "error",
            message: 'Internal server error'
        });
    }
});

// Create new permission
app.post('/api/permissions', authenticateToken, async (req, res) => {
    try {
        const db = await connectDB();
        const ownerAddress = req.user.address;
        const data = req.body;

        // Validasi required fields
        if (!data.token.address || !data.type || !data.permissions || !data.wallet_address || !data.session_address) {
            return res.status(400).json({
                status: "error",
                message: "Token address, type, and permission data are required"
            });
        }

        if (data.wallet_address.toLowerCase() !== ownerAddress.toLowerCase()) {
            return res.status(400).json({
                status: "error",
                message: "Wallet address does not match authenticated user"
            });
        }

        const sessionAccount = await sessionSmartAccount(ownerAddress);

        if (data.session_address.toLowerCase() !== sessionAccount.address.toLowerCase()) {
            return res.status(400).json({
                status: "error",
                message: "Session address does not match derived session account"
            });
        }

        const dataInsert = {
            ...data,
            token_type: data.token.address.toLowerCase() === "0x0000000000000000000000000000000000000000" ? "native" : "erc20",
            period_duration: data.permissions[0].permission.data.periodDuration,
            start_time: data.permissions[0].permission.data.startTime,
            expired_in: data.permissions[0].rules[0].data.timestamp,
            amount_used: "0",
            amount_remaining: formatUnits(BigInt(data.permissions[0].permission.data.periodAmount), data.token.decimals).toString(),
        };

        const result = await db.collection("permissions").insertOne(dataInsert);

        res.status(201).json({
            status: "success",
            message: "Permission created successfully",
            permission_id: result.insertedId,
            data: data
        });
    } catch (error) {
        console.error('Error creating permission:', error);
        res.status(500).json({
            status: "error",
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Update permission status
app.put('/api/permissions/:permissionId', authenticateToken, async (req, res) => {
    try {
        const db = await connectDB();
        const ownerAddress = req.user.address;
        const permissionId = req.params.permissionId;
        const updateData = req.body;

        if (!ObjectId.isValid(permissionId)) {
            return res.status(400).json({ status: "error", message: "Invalid permission ID" });
        }

        const result = await db.collection("permissions").findOneAndUpdate(
            {
                _id: new ObjectId(permissionId),
                owner_address: ownerAddress.toLowerCase()
            },
            {
                $set: {
                    ...updateData,
                    updated_at: new Date()
                }
            },
            { returnDocument: 'after' }
        );

        if (!result) {
            return res.status(404).json({
                status: "error",
                message: "Permission not found"
            });
        }

        res.status(200).json({
            status: "success",
            message: "Permission updated successfully",
            data: result
        });
    } catch (error) {
        console.error('Error updating permission:', error);
        res.status(500).json({
            status: "error",
            message: 'Internal server error'
        });
    }
});

// Delete permission
app.delete('/api/permissions/:permissionId', authenticateToken, async (req, res) => {
    try {
        const db = await connectDB();
        const ownerAddress = req.user.address;
        const permissionId = req.params.permissionId;

        if (!ObjectId.isValid(permissionId)) {
            return res.status(400).json({ status: "error", message: "Invalid permission ID" });
        }

        const result = await db.collection("permissions").findOneAndDelete({
            _id: new ObjectId(permissionId),
            owner_address: ownerAddress.toLowerCase()
        });

        if (!result) {
            return res.status(404).json({
                status: "error",
                message: "Permission not found"
            });
        }

        res.status(200).json({
            status: "success",
            message: "Permission deleted successfully"
        });
    } catch (error) {
        console.error('Error deleting permission:', error);
        res.status(500).json({
            status: "error",
            message: 'Internal server error'
        });
    }
});

// Check permission for specific token (before swap)
app.post('/api/permissions/check', authenticateToken, async (req, res) => {
    try {
        const db = await connectDB();
        const ownerAddress = req.user.address;
        const { token_address, amount_needed, type } = req.body;

        if (!token_address) {
            return res.status(400).json({
                status: "error",
                message: "Token address is required"
            });
        }

        const tokenAddress = token_address.toLowerCase();
        const amountNeeded = amount_needed || "0";

        // Cari permission aktif untuk token tersebut
        const permissions = await db.collection("permissions").find({
            owner_address: ownerAddress.toLowerCase(),
            token_address: tokenAddress,
            status: "active",
            is_active: true
        }).toArray();

        if (permissions.length === 0) {
            return res.status(200).json({
                status: "success",
                has_permission: false,
                message: "No active permission found for this token"
            });
        }

        // Filter by type jika type diberikan
        let filteredPermissions = permissions;
        if (type) {
            filteredPermissions = permissions.filter(p => p.type === type);
        }

        // Cek apakah ada permission yang mencukupi amount
        const sufficientPermissions = filteredPermissions.filter(permission => {
            const remainingAmount = BigInt(permission.amount) - BigInt(permission.amount_used || "0");
            return remainingAmount >= BigInt(amountNeeded);
        });

        res.status(200).json({
            status: "success",
            has_permission: sufficientPermissions.length > 0,
            permissions: filteredPermissions,
            sufficient_permissions: sufficientPermissions,
            message: sufficientPermissions.length > 0
                ? "Permission found"
                : "No sufficient permission found"
        });
    } catch (error) {
        console.error('Error checking permission:', error);
        res.status(500).json({
            status: "error",
            message: 'Internal server error'
        });
    }
});

app.post('/api/swap', authenticateToken, async (req, res) => {
    try {

        const db = await connectDB();
        const ownerAddress = req.user.address;
        const data = req.body;

        if (ownerAddress.toLowerCase() !== data.user_address.toLowerCase()) {
            return res.status(400).json({ message: 'address not match' });
        }

        const currentTime = Math.floor(Date.now() / 1000);
        const neededAmount = Number(data.from_amount || 0);

        if (!neededAmount || neededAmount <= 0) {
            return res.status(400).json({ message: 'invalid amount' });
        }

        const permissions = await db.collection("permissions")
            .find({
                type: 'immediately',
                $expr: {
                    $and: [
                        { $eq: [{ $toLower: "$wallet_address" }, ownerAddress.toLowerCase()] },
                        { $eq: [{ $toLower: "$token.address" }, data.from_token.address.toLowerCase()] },
                        { $gte: ["$expired_in", currentTime] }
                    ]
                }
            })
            .sort({ expired_in: 1 })
            .toArray();

        // Kembalikan jika tidak ada permission
        if (permissions.length === 0) {
            return res.status(400).json({ message: 'no permission found for this token' });
        }

        let remainingNeeded = neededAmount;
        let selectedPermissions = [];
        let calls = [];

        const sessionAccount = await sessionSmartAccount(ownerAddress);

        for (const p of permissions) {

            if (remainingNeeded <= 0) break;

            const available = Number(p.amount_remaining) || 0;
            if (available <= 0) continue;

            const takeAmount = Math.min(available, remainingNeeded);

            if (p.token_type === 'erc20') {

                const calldata = encodeFunctionData({
                    abi: erc20Abi,
                    args: [sessionAccount.address, parseUnits(takeAmount.toString(), p.token.decimals)],
                    functionName: 'transfer',
                });

                calls.push({
                    to: p.token.address,
                    data: calldata,
                    permissionsContext: p.permissions[0].context,
                    delegationManager: p.permissions[0].signerMeta.delegationManager,
                });

            } else {
                // native token transfer
                calls.push({
                    to: sessionAccount.address,
                    value: parseEther(takeAmount.toString()),
                    data: "0x",
                    permissionsContext: p.permissions[0].context,
                    delegationManager: p.permissions[0].signerMeta.delegationManager,
                });
            }

            selectedPermissions.push({
                permission_id: p._id,
                take_amount: takeAmount
            });

            remainingNeeded -= takeAmount;
        }


        const amount_in_wei_string = parseUnits(data.from_amount, data.from_token.decimals).toString();
        const fromTokenAddress =
            data.from_token.address.toLowerCase() === '0x0000000000000000000000000000000000000000'
                ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
                : data.from_token.address;

        const toTokenAddress =
            data.to_token.address.toLowerCase() === '0x0000000000000000000000000000000000000000'
                ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
                : data.to_token.address;

        // Contoh menggunakan getSwap dengan bundler support
        const swapQuote = await getSwap({
            publicClient,
            tokenIn: fromTokenAddress,
            tokenOut: toTokenAddress,
            amountIn: data.from_amount,
            recipient: ownerAddress,
        });


        if (data.from_token.address.toLowerCase() !== zeroAddress) {
            const calldataApprove = encodeFunctionData({
                abi: erc20Abi,
                functionName: "approve",
                args: [swapQuote.transaction.to, amount_in_wei_string],
            });

            calls.push({
                to: data.from_token.address,
                data: calldataApprove,
            });
        }

        // tambahkan calls untuk swap
        calls.push({
            to: swapQuote.transaction.to,
            data: swapQuote.transaction.data,
            value: swapQuote.transaction.value,
        });

        const userOperationGasPrice = await pimlicoClient.getUserOperationGasPrice();
        console.log(userOperationGasPrice);

        const userOperationHash = await bundlerClient.sendUserOperationWithDelegation({
            publicClient,
            account: sessionAccount,
            calls,
            ...userOperationGasPrice,
        });

        const { receipt } = await bundlerClient.waitForUserOperationReceipt({ hash: userOperationHash });

        if (!receipt) {
            return res.status(500).json({
                status: "error",
                message: "Swap transaction failed",
            });
        }

        for (const sp of selectedPermissions) {
            const perm = await db.collection("permissions").findOne(
                { _id: sp.permission_id },
                { projection: { amount_used: 1, amount_remaining: 1 } }
            );

            const currentUsed = Number(perm.amount_used) || 0;
            const currentRemaining = Number(perm.amount_remaining) || 0;

            const newUsed = currentUsed + sp.take_amount;

            const newRemaining = Math.max(
                currentRemaining - sp.take_amount,
                0
            );

            await db.collection("permissions").updateOne(
                { _id: sp.permission_id },
                {
                    $set: {
                        amount_used: newUsed.toString(),
                        amount_remaining: newRemaining.toString()
                    }
                }
            );
        }

        res.status(200).json({
            status: "success",
            message: "Swap transaction successful",
            hash: receipt.transactionHash
        });

    } catch (error) {
        console.error('Error processing swap:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/send_delegation', authenticateToken, async (req, res) => {
    try {
        const db = await connectDB();
        const ownerAddress = req.user.address;
        const delegationData = req.body;

        if (ownerAddress.toLowerCase() !== delegationData.owner_address.toLowerCase()) {
            return res.status(400).json({ message: 'address not match' });
        }

        await db.collection("task").insertOne({
            owner_address: delegationData.owner_address.toLowerCase(),
            type: delegationData.type,
            from_token: delegationData.from_token,
            to_token: delegationData.to_token,
            from_amount: delegationData.from_amount,
            swap_limit_price: delegationData.swap_limit_price,
            swap_limit_amount: delegationData.swap_limit_amount,
            swap_limit_exchange_rate: delegationData.swap_limit_exchange_rate,
            swap_scheduled_execution_time: delegationData.swap_scheduled_execution_time,
            swap_limit_expired: delegationData.swap_limit_expired,
            permission: delegationData.permission,
            status: "active",
            message_status: "",
            hash: "",
            timestamp: Math.floor(Date.now() / 1000),
            updated_at: Math.floor(Date.now() / 1000)
        });


        res.status(200).json({ status: "ok" });
    } catch (error) {
        console.error('Error updating user data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/delegations', authenticateToken, async (req, res) => {
    try {
        const db = await connectDB();
        const ownerAddress = req.user.address;

        const delegations = await db.collection("task").find({
            owner_address: ownerAddress.toLowerCase(),
            type: { $in: ["scheduled", "price"] }
        },
            {
                projection: {
                    permission: 0
                }
            })
            .sort({ updated_at: -1 })
            .toArray();

        return res.status(200).json({
            status: "ok",
            count: delegations.length,
            data: delegations
        });
    } catch (error) {
        console.error('Error fetching delegations:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/cancel_delegation', authenticateToken, async (req, res) => {
    try {
        const db = await connectDB();
        const ownerAddress = req.user.address;
        const { _id } = req.body;

        if (!_id) {
            return res.status(400).json({ message: '_id wajib diisi' });
        }
        if (!ObjectId.isValid(_id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }

        const objectId = new ObjectId(_id);
        const result = await db.collection("task").findOneAndUpdate(
            {
                _id: objectId,
                owner_address: ownerAddress.toLowerCase()
            },
            { $set: { status: 'canceled', updated_at: new Date() } },
            { returnDocument: 'after' }
        );

        if (!result) {
            return res.status(404).json({ message: 'Delegation not found for this ownerAddress' });
        }

        return res.status(200).json({
            status: "ok",
            message: "Delegation cancelled",
        });
    } catch (error) {
        console.error('Error cancel delegation:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/send_subscribe_delegation', authenticateToken, async (req, res) => {
    try {
        const db = await connectDB();
        const ownerAddress = req.user.address;
        const subscriptionData = req.body;

        if (ownerAddress.toLowerCase() !== subscriptionData.owner_address.toLowerCase()) {
            return res.status(400).json({ message: 'Address owner not match' });
        }

        const paymentTokenAddress = subscriptionData.paymentToken.address.toLowerCase();
        const targetTokenAddress = subscriptionData.targetToken.address.toLowerCase();

        const existingSubscription = await db.collection("subscriptions").findOne({
            wallet_address: subscriptionData.owner_address.toLowerCase(),
            status: "active",
            $or: [
                {
                    "paymentToken.address": paymentTokenAddress,
                    "targetToken.address": targetTokenAddress
                },
                {
                    "paymentToken.address": targetTokenAddress,
                    "targetToken.address": paymentTokenAddress
                }
            ]
        });

        console.log("Query parameters:");
        console.log("wallet_address:", subscriptionData.owner_address.toLowerCase());
        console.log("paymentTokenAddress (lower):", paymentTokenAddress);
        console.log("targetTokenAddress (lower):", targetTokenAddress);
        console.log(existingSubscription);


        if (existingSubscription) {
            return res.status(400).json({
                status: "error",
                message: "duplicate_pair",
                error: `You already have an active subscription with the token pair ${existingSubscription.paymentToken.symbol} → ${existingSubscription.targetToken.symbol}. Please choose a different token pair.`
            });
        }

        const activeSubscriptionCount = await db.collection("subscriptions").countDocuments({
            wallet_address: ownerAddress.toLowerCase(),
            status: "active"
        });

        if (activeSubscriptionCount >= 5) {
            return res.status(200).json({
                status: "error",
                message: "limit",
                error: 'Max 5 active subscriptions allowed'
            });
        }

        const result = await db.collection("subscriptions").insertOne({
            wallet_address: ownerAddress.toLowerCase(),

            frequency: subscriptionData.frequency,
            frequency_in_second: subscriptionData.frequency_in_second,

            duration: subscriptionData.duration,
            duration_in_second: subscriptionData.duration_in_second,

            amount: subscriptionData.amount,

            paymentToken: {
                ...subscriptionData.paymentToken,
                address: subscriptionData.paymentToken.address.toLowerCase()
            },

            targetToken: {
                ...subscriptionData.targetToken,
                address: subscriptionData.targetToken.address.toLowerCase()
            },

            settings: subscriptionData.settings,

            nextExecution: subscriptionData.nextExecution,
            nextExecutionTimestamp: subscriptionData.nextExecutionTimestamp,

            totalExecutions: subscriptionData.totalExecutions,
            executed: subscriptionData.executed || 0,
            status: subscriptionData.status || "active",

            last_execution: null,
            execution_history: [],

            permission: subscriptionData.permission,

            created_at: Math.floor(Date.now() / 1000),
            updated_at: Math.floor(Date.now() / 1000),
        });


        res.status(200).json({
            status: "ok",
            message: "Subscription succefully created",
            subscription_id: result.insertedId
        });
    } catch (error) {
        console.error('Error creating subscription:', error);
        res.status(500).json({
            status: "error",
            message: 'Internal server error',
            error: error.message
        });
    }
});

app.post('/api/subscriptions', authenticateToken, async (req, res) => {
    try {
        const db = await connectDB();
        const ownerAddress = req.user.address;

        const subscriptions = await db.collection("subscriptions").find({
            wallet_address: ownerAddress.toLowerCase(),
        }).sort({ created_at: -1 }).toArray();

        return res.status(200).json({
            status: "ok",
            count: subscriptions.length,
            data: subscriptions
        });
    } catch (error) {
        console.error('Error fetching subscriptions:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/cancel_subscription', authenticateToken, async (req, res) => {
    try {
        const db = await connectDB();
        const ownerAddress = req.user.address;
        const { _id } = req.body;

        if (!_id) {
            return res.status(400).json({ message: '_id required' });
        }
        if (!ObjectId.isValid(_id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }

        const objectId = new ObjectId(_id);
        const result = await db.collection("subscriptions").findOneAndUpdate(
            {
                _id: objectId,
                wallet_address: ownerAddress.toLowerCase()
            },
            {
                $set: {
                    status: 'canceled',
                    updated_at: new Date()
                }
            },
            { returnDocument: 'after' }
        );

        if (!result) {
            return res.status(404).json({ message: 'Subscription not found' });
        }

        return res.status(200).json({
            status: "ok",
            message: "Subscription cancelled",
            data: result
        });
    } catch (error) {
        console.error('Error canceling subscription:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        activeNonces: nonceStore.size
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Bersihkan nonce yang sudah expired (> 5 menit)
setInterval(() => {
    const now = Date.now();
    for (const [address, data] of nonceStore.entries()) {
        if (now - data.timestamp > 5 * 60 * 1000) {
            nonceStore.delete(address);
        }
    }
}, 60000);

if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}

export default app;