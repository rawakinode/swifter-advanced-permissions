import { createWalletClient, custom } from "viem";
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";
import { getAccount, getConnections, getWalletClient } from "@wagmi/core";
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

        const wagmiWalletClient = await getWalletClient(config);

        if (!wagmiWalletClient) {
            throw new Error('Failed to get wallet client');
        }

        console.log('✅ Wagmi wallet client:', wagmiWalletClient.account?.address);

        const smartWalletClient = createWalletClient({
            account: wagmiWalletClient.account,
            transport: custom(wagmiWalletClient.transport),   // <-- transport bawaan wagmi
            chain: wagmiWalletClient.chain,
        }).extend(erc7715ProviderActions());

        console.log('🔥 Smart wallet client ready:', smartWalletClient.account.address);

        return smartWalletClient;

    } catch (error) {
        console.error(error)
        throw new Error('Failed to get wallet client');
    }
}
