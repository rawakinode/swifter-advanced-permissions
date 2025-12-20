import { privateKeyToAccount } from "viem/accounts";
import { sepolia as chain } from "viem/chains";
import { createPublicClient, http } from "viem";
import {  erc7710BundlerActions } from "@metamask/smart-accounts-kit/actions";
import { createBundlerClient, createPaymasterClient, entryPoint07Address } from "viem/account-abstraction";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { toMetaMaskSmartAccount, Implementation } from "@metamask/smart-accounts-kit";

export const publicClient = createPublicClient({
    chain,
    transport: http(),
});

export const bundlerClient = createBundlerClient({
    client: publicClient,
    paymaster: true,
    transport: http(`https://api.pimlico.io/v2/${chain.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`)
}).extend(erc7710BundlerActions());

export const paymasterClient = createPaymasterClient({
    transport: http(`https://api.pimlico.io/v2/${chain.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`)
});

export const pimlicoClient = createPimlicoClient({
    chain: chain,
    entryPoint: {
        address: entryPoint07Address,
        version: "0.7",
    },
    transport: http(`https://api.pimlico.io/v2/${chain.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`)
});

export const sessionSmartAccount = async (salt) => {
    const private_key = process.env.SESSION_MANAGER_SECRET_KEY;
    const account = privateKeyToAccount(private_key, { chain });

    const sessionAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [account.address, [], [], []],
        deploySalt: salt,
        signer: { account },
    });
    return sessionAccount;
}