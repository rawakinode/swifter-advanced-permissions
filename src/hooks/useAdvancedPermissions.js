import { getUserWalletClient } from "./walletClientExtended";
import { sepolia as chain } from "viem/chains";
import { parseEther, parseUnits } from "viem";
import { publicClient } from "./useSmartAccount";
import { getSmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

export async function createAdvancedPermissions(token, sessionAddress, amount, duration, startTime, expired, justification, isAdjustmentAllowed = true) {

    try {
        const walletClient = await getUserWalletClient();
        const tokenAddress = token.address;
        const sessionAccountAddress = sessionAddress;

        let permission = '';

        if (tokenAddress.toLowerCase() == '0x0000000000000000000000000000000000000000') {
            permission = {
                type: "native-token-periodic",
                data: {
                    periodAmount: parseUnits(amount, 18),
                    periodDuration: duration,
                    startTime: startTime,
                    justification: justification,
                },
            };
        } else {
            permission = {
                type: "erc20-token-periodic",
                data: {
                    tokenAddress,
                    periodAmount: parseUnits(amount, token.decimals),
                    periodDuration: duration,
                    justification: justification,
                },
            };
        }

        console.log(permission);


        const grantedPermissions = await walletClient.requestExecutionPermissions([{
            chainId: chain.id,
            expiry: expired,
            signer: {
                type: "account",
                data: {
                    address: sessionAccountAddress,
                },
            },
            permission,
            isAdjustmentAllowed: isAdjustmentAllowed,
        }]);

        return grantedPermissions;
    } catch (error) {
        console.log(error);
        throw error;
    }
}

export async function isSmartAccountUpgraded() {
    try {
        const walletClient = await getUserWalletClient();

        const addresses = await walletClient.requestAddresses();
        const address = addresses[0];

        // Get the EOA account code
        const code = await publicClient.getCode({
            address,
        });

        console.log(code);


        if (code) {

            const delegatorAddress = `0x${code.substring(8)}`;
            const statelessDelegatorAddress = getSmartAccountsEnvironment(chain.id).implementations.EIP7702StatelessDeleGatorImpl;
            const isAccountUpgraded = delegatorAddress.toLowerCase() === statelessDelegatorAddress.toLowerCase();

            console.log(delegatorAddress);

            console.log(statelessDelegatorAddress);


            if (isAccountUpgraded) {
                console.log('Account is upgraded to MetaMask Smart Account.');
                return true;
            } else {
                console.log('Account is not upgraded to MetaMask Smart Account.');
                return false;
            }
        }

        console.log('Account code is empty. Wallet might not be connected properly.');
        return false;
    } catch (error) {
        console.error('Error checking smart account:', error);
        return false;
    }

}
