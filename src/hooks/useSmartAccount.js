import { createPublicClient, http, zeroAddress, parseEther } from "viem";
import { createBundlerClient, createPaymasterClient, entryPoint07Address } from "viem/account-abstraction";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { sepolia as chain } from "viem/chains";

/**
 * Public client for blockchain interactions
 */
export const publicClient = createPublicClient({
    chain: chain,
    transport: http('https://eth-sepolia.g.alchemy.com/v2/IyvGVxSapxJbjfOMTByH-')
});

/**
 * Bundler client for user operation handling
 */
export const bundlerClient = createBundlerClient({
    client: publicClient,
    paymaster: true,
    transport: http("https://api.pimlico.io/v2/10143/rpc?apikey=pim_iYGAe4x4v8AvhBDiCNmaS2")
});

/**
 * Paymaster client for gas sponsorship
 */
export const paymasterClient = createPaymasterClient({
    transport: http("https://api.pimlico.io/v2/10143/rpc?apikey=pim_iYGAe4x4v8AvhBDiCNmaS2")
});

/**
 * Pimlico client for account abstraction services
 */
export const pimlicoClient = createPimlicoClient({
    chain: chain,
    entryPoint: {
        address: entryPoint07Address,
        version: "0.7",
    },
    transport: http("https://api.pimlico.io/v2/10143/rpc?apikey=pim_iYGAe4x4v8AvhBDiCNmaS2"),
});
