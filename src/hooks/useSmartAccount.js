import { createPublicClient, http} from "viem";
import { sepolia as chain } from "viem/chains";

/**
 * Public client for blockchain interactions
 */
export const publicClient = createPublicClient({
    chain: chain,
    transport: http('https://eth-sepolia.g.alchemy.com/v2/IyvGVxSapxJbjfOMTByH-')
});

