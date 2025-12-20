import { getWalletClient, getAccount, reconnect, getConnections } from '@wagmi/core';
import { config } from "@/wagmi";

export async function getUserWalletClient() {
    try {
        let attempts = 0;
        const maxAttempts = 10; 

        while (attempts < maxAttempts) {
            const account = getAccount(config);
            const connections = getConnections(config);

            if (account.isConnected && connections.length > 0) {
                console.log('✅ Connection ready');
                break;
            }

            console.log(`⏳ Waiting for connection... (${attempts + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }

        const account = getAccount(config);

        if (!account.isConnected) {
            throw new Error('Wallet not connected. Please connect your wallet first.');
        }
        const walletClient = await getWalletClient(config);

        if (!walletClient) {
            throw new Error('Failed to get wallet client');
        }

        console.log('✅ Wallet client ready:', walletClient.account?.address);

        return walletClient
    } catch (error) {
        throw new Error('Failed to get wallet client');
    }
}