import {
  parseUnits,
  formatUnits,
  isAddress,
  zeroAddress,
  getAddress,
  encodeFunctionData
} from 'viem';
import { erc20Abi } from 'viem';
import { sepolia } from 'viem/chains';

/* ================= CONFIG ================= */

export const CONTRACTS = {
  FACTORY: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c',
  QUOTER_V2: '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3',
  SWAP_ROUTER: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
  WETH: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14'
};

export const NATIVE_ETH = {
  address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  decimals: 18,
  symbol: 'ETH',
  isNative: true
};

/* ================= CONSTANTS ================= */

export const FEE_TIERS = [100, 500, 3000, 10000]; // 0.01%, 0.05%, 0.30%, 1%
export const DEFAULT_FEE_TIERS = [3000, 500, 10000, 100]; // Prioritas default

/* ================= ABI ================= */

export const FACTORY_ABI = [
  {
    name: 'getPool',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'fee', type: 'uint24' }
    ],
    outputs: [{ name: 'pool', type: 'address' }]
  }
];

export const QUOTER_ABI = [
  {
    name: 'quoteExactInputSingle',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      {
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' }
        ],
        type: 'tuple'
      }
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' }
    ]
  }
];

export const SWAP_ROUTER_ABI = [
  {
    name: 'exactInputSingle',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' }
        ],
        name: 'params',
        type: 'tuple'
      }
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }]
  },
  {
    name: 'unwrapWETH9',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'amountMinimum', type: 'uint256' },
      { name: 'recipient', type: 'address' }
    ],
    outputs: []
  },
  {
    name: 'multicall',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'data', type: 'bytes[]' }
    ],
    outputs: [
      { name: 'results', type: 'bytes[]' }
    ]
  },
  {
    name: 'refundETH',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: []
  }
];

/* ================= ERROR TYPES ================= */

export class SwapError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'SwapError';
    this.code = code;
    this.details = details;
  }
}

export const ERROR_CODES = {
  INVALID_INPUT: 'INVALID_INPUT',
  NO_POOL_AVAILABLE: 'NO_POOL_AVAILABLE',
  QUOTE_FAILED: 'QUOTE_FAILED',
  INSUFFICIENT_LIQUIDITY: 'INSUFFICIENT_LIQUIDITY',
  TOKEN_NOT_FOUND: 'TOKEN_NOT_FOUND',
  NETWORK_ERROR: 'NETWORK_ERROR'
};

/* ================= HELPERS ================= */

export const isNativeETH = (address) => {
  if (!address) return false;
  const addr = address.toLowerCase();
  return (
    addr === zeroAddress.toLowerCase() ||
    addr === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
    addr === NATIVE_ETH.address.toLowerCase()
  );
};

const getTokenDecimals = async (publicClient, token, isNative) => {
  try {
    if (isNative) return 18;

    const decimals = await publicClient.readContract({
      address: getAddress(token),
      abi: erc20Abi,
      functionName: 'decimals'
    });
    return Number(decimals);
  } catch (error) {
    throw new SwapError(
      `Failed to get decimals for token ${token}`,
      ERROR_CODES.TOKEN_NOT_FOUND,
      { token, error: error.message }
    );
  }
};

const getTokenSymbol = async (publicClient, token, isNative) => {
  try {
    if (isNative) return 'ETH';

    const symbol = await publicClient.readContract({
      address: getAddress(token),
      abi: erc20Abi,
      functionName: 'symbol'
    });
    return symbol;
  } catch (error) {
    return 'UNKNOWN';
  }
};

const validateInputs = (tokenIn, tokenOut, amountIn, fee) => {
  if (!tokenIn || !tokenOut) {
    throw new SwapError(
      'Token addresses are required',
      ERROR_CODES.INVALID_INPUT,
      { tokenIn, tokenOut }
    );
  }

  if (!amountIn || Number(amountIn) <= 0) {
    throw new SwapError(
      'Amount must be greater than 0',
      ERROR_CODES.INVALID_INPUT,
      { amountIn }
    );
  }

  if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
    throw new SwapError(
      'Token addresses must be different',
      ERROR_CODES.INVALID_INPUT,
      { tokenIn, tokenOut }
    );
  }

  if (fee && ![100, 500, 3000, 10000].includes(fee)) {
    throw new SwapError(
      'Invalid fee tier. Allowed values: 100, 500, 3000, 10000',
      ERROR_CODES.INVALID_INPUT,
      { fee }
    );
  }
};

/* ================= POOL AVAILABILITY CHECK ================= */

export const checkPoolAvailability = async (publicClient, tokenIn, tokenOut, fee) => {
  try {
    const isInETH = isNativeETH(tokenIn);
    const isOutETH = isNativeETH(tokenOut);

    const tokenInForContract = isInETH ? CONTRACTS.WETH : getAddress(tokenIn);
    const tokenOutForContract = isOutETH ? CONTRACTS.WETH : getAddress(tokenOut);

    // Sort tokens as required by Uniswap V3 factory
    const [tokenA, tokenB] = tokenInForContract.toLowerCase() < tokenOutForContract.toLowerCase()
      ? [tokenInForContract, tokenOutForContract]
      : [tokenOutForContract, tokenInForContract];

    const poolAddress = await publicClient.readContract({
      address: CONTRACTS.FACTORY,
      abi: FACTORY_ABI,
      functionName: 'getPool',
      args: [tokenA, tokenB, fee]
    });

    return poolAddress !== zeroAddress;
  } catch (error) {
    console.warn(`Failed to check pool availability for fee ${fee}:`, error);
    return false;
  }
};

/* ================= FEE TIER OPTIMIZATION ================= */

export const findBestFeeTier = async ({
  publicClient,
  tokenIn,
  tokenOut,
  amountIn,
  feeTiers = DEFAULT_FEE_TIERS,
  returnAllResults = false
}) => {
  const isInETH = isNativeETH(tokenIn);
  const isOutETH = isNativeETH(tokenOut);

  const tokenInForContract = isInETH ? CONTRACTS.WETH : getAddress(tokenIn);
  const tokenOutForContract = isOutETH ? CONTRACTS.WETH : getAddress(tokenOut);

  const decimalsIn = await getTokenDecimals(publicClient, tokenIn, isInETH);
  const decimalsOut = await getTokenDecimals(publicClient, tokenOut, isOutETH);
  const amountInWei = parseUnits(amountIn.toString(), decimalsIn);

  const results = [];
  let bestResult = null;

  for (const fee of feeTiers) {
    try {
      // Check pool availability first
      const poolExists = await checkPoolAvailability(publicClient, tokenIn, tokenOut, fee);
      if (!poolExists) {
        console.log(`No pool available for fee ${fee}`);
        continue;
      }

      // Get quote
      const [amountOut, , , gasEstimate] = await publicClient.readContract({
        address: CONTRACTS.QUOTER_V2,
        abi: QUOTER_ABI,
        functionName: 'quoteExactInputSingle',
        args: [{
          tokenIn: tokenInForContract,
          tokenOut: tokenOutForContract,
          amountIn: amountInWei,
          fee,
          sqrtPriceLimitX96: 0n
        }]
      });

      if (amountOut > 0n) {
        const result = {
          fee,
          amountOut,
          amountOutFormatted: formatUnits(amountOut, decimalsOut),
          gasEstimate: gasEstimate?.toString() || '0',
          poolAvailable: true
        };

        results.push(result);

        // Update best result
        if (!bestResult || amountOut > bestResult.amountOut) {
          bestResult = { ...result, index: results.length - 1 };
        }
      }
    } catch (error) {
      console.warn(`Failed to get quote for fee ${fee}:`, error.message);
      results.push({
        fee,
        amountOut: 0n,
        amountOutFormatted: '0',
        gasEstimate: '0',
        poolAvailable: false,
        error: error.message
      });
    }
  }

  if (returnAllResults) {
    return {
      best: bestResult,
      allResults: results
    };
  }

  if (!bestResult) {
    throw new SwapError(
      'No available pools found for any fee tier',
      ERROR_CODES.NO_POOL_AVAILABLE,
      { tokenIn, tokenOut, feeTiers }
    );
  }

  return bestResult;
};

/* =========================================================
   🔵 getSwapQuoteData() - OPTIMIZED
========================================================= */

export async function getSwapQuoteData({
  publicClient,
  tokenIn,
  tokenOut,
  amountIn,
  recipient = zeroAddress,
  fee = null,
  feeTiers = DEFAULT_FEE_TIERS,
  slippage = 2,
  deadline = Math.floor(Date.now() / 1000) + 600,
  returnAllOptions = false
}) {
  try {
    validateInputs(tokenIn, tokenOut, amountIn, fee || 3000);

    if (slippage < 0 || slippage > 100) {
      throw new SwapError(
        'Slippage must be between 0 and 100',
        ERROR_CODES.INVALID_INPUT,
        { slippage }
      );
    }

    if (!isAddress(recipient) && !isNativeETH(recipient)) {
      throw new SwapError(
        'Invalid recipient address',
        ERROR_CODES.INVALID_INPUT,
        { recipient }
      );
    }

    const isInETH = isNativeETH(tokenIn);
    const isOutETH = isNativeETH(tokenOut);

    let bestFeeResult;
    let allFeeOptions;

    // Jika fee ditentukan, gunakan itu
    if (fee !== null) {
      const poolExists = await checkPoolAvailability(publicClient, tokenIn, tokenOut, fee);
      if (!poolExists) {
        throw new SwapError(
          `No pool available for ${tokenIn}/${tokenOut} with fee ${fee}`,
          ERROR_CODES.NO_POOL_AVAILABLE,
          { tokenIn, tokenOut, fee }
        );
      }

      const tokenInForContract = isInETH ? CONTRACTS.WETH : getAddress(tokenIn);
      const tokenOutForContract = isOutETH ? CONTRACTS.WETH : getAddress(tokenOut);

      const decimalsIn = await getTokenDecimals(publicClient, tokenIn, isInETH);
      const decimalsOut = await getTokenDecimals(publicClient, tokenOut, isOutETH);
      const sellTokenSymbol = await getTokenSymbol(publicClient, tokenIn, isInETH);
      const buyTokenSymbol = await getTokenSymbol(publicClient, tokenOut, isOutETH);
      const amountInWei = parseUnits(amountIn.toString(), decimalsIn);

      let amountOut, gasEstimate;
      try {
        [amountOut, , , gasEstimate] = await publicClient.readContract({
          address: CONTRACTS.QUOTER_V2,
          abi: QUOTER_ABI,
          functionName: 'quoteExactInputSingle',
          args: [{
            tokenIn: tokenInForContract,
            tokenOut: tokenOutForContract,
            amountIn: amountInWei,
            fee,
            sqrtPriceLimitX96: 0n
          }]
        });
      } catch (error) {
        if (error.message?.includes('No liquidity') || error.message?.includes('insufficient liquidity')) {
          throw new SwapError(
            'Insufficient liquidity for this trade',
            ERROR_CODES.INSUFFICIENT_LIQUIDITY,
            { tokenIn, tokenOut, fee }
          );
        }
        throw error;
      }

      bestFeeResult = {
        fee,
        amountOut,
        amountOutFormatted: formatUnits(amountOut, decimalsOut),
        gasEstimate: gasEstimate?.toString() || '0',
        poolAvailable: true,
        tokenInForContract,
        tokenOutForContract,
        decimalsIn,
        decimalsOut,
        sellTokenSymbol,
        buyTokenSymbol,
        amountInWei
      };
    } else {
      // Cari fee tier terbaik
      const result = await findBestFeeTier({
        publicClient,
        tokenIn,
        tokenOut,
        amountIn,
        feeTiers,
        returnAllResults: returnAllOptions
      });

      if (returnAllOptions && result.allResults) {
        allFeeOptions = result.allResults;
      }

      if (!result || !result.amountOut) {
        throw new SwapError(
          'No available pools found for any fee tier',
          ERROR_CODES.NO_POOL_AVAILABLE,
          { tokenIn, tokenOut, feeTiers }
        );
      }

      // Dapatkan detail tambahan untuk best result
      const tokenInForContract = isInETH ? CONTRACTS.WETH : getAddress(tokenIn);
      const tokenOutForContract = isOutETH ? CONTRACTS.WETH : getAddress(tokenOut);
      const decimalsIn = await getTokenDecimals(publicClient, tokenIn, isInETH);
      const decimalsOut = await getTokenDecimals(publicClient, tokenOut, isOutETH);
      const sellTokenSymbol = await getTokenSymbol(publicClient, tokenIn, isInETH);
      const buyTokenSymbol = await getTokenSymbol(publicClient, tokenOut, isOutETH);
      const amountInWei = parseUnits(amountIn.toString(), decimalsIn);

      bestFeeResult = {
        ...result,
        tokenInForContract,
        tokenOutForContract,
        decimalsIn,
        decimalsOut,
        sellTokenSymbol,
        buyTokenSymbol,
        amountInWei
      };
    }

    // Hitung amountOutMinimum dengan slippage
    const slippageMultiplier = (100 - slippage) / 100;
    const amountOutMin = (bestFeeResult.amountOut * BigInt(Math.floor(slippageMultiplier * 1000000))) / 1000000n;

    // Dapatkan data blockchain
    const blockNumber = await publicClient.getBlockNumber();
    const gasPrice = await publicClient.getGasPrice();

    // Hitung total network fee
    const gasEstimateBigInt = BigInt(bestFeeResult.gasEstimate || 0);
    const totalNetworkFee = gasEstimateBigInt * gasPrice;

    // Siapkan route object
    const route = {
      fills: [
        {
          from: bestFeeResult.tokenInForContract,
          to: bestFeeResult.tokenOutForContract
        }
      ],
      tokens: [
        {
          address: bestFeeResult.tokenInForContract,
          symbol: bestFeeResult.sellTokenSymbol
        },
        {
          address: bestFeeResult.tokenOutForContract,
          symbol: bestFeeResult.buyTokenSymbol
        }
      ]
    };

    // Bangun response utama
    const mainResponse = {
      allowanceTarget: CONTRACTS.SWAP_ROUTER,
      blockNumber: blockNumber.toString(),
      buyAmount: bestFeeResult.amountOut.toString(),
      buyToken: isOutETH ? NATIVE_ETH.address : getAddress(tokenOut),
      fees: {
        integratorFee: null,
        integratorFees: null,
        zeroExFee: {
          amount: "0",
          token: isOutETH ? NATIVE_ETH.address : getAddress(tokenOut),
          type: "volume"
        },
        gasFee: null
      },
      gas: bestFeeResult.gasEstimate,
      gasPrice: gasPrice.toString(),
      issues: {
        allowance: null,
        balance: null,
        simulationIncomplete: false,
        invalidSourcesPassed: []
      },
      liquidityAvailable: true,
      minBuyAmount: amountOutMin.toString(),
      route,
      sellAmount: bestFeeResult.amountInWei.toString(),
      sellToken: isInETH ? NATIVE_ETH.address : getAddress(tokenIn),
      tokenMetadata: {
        buyToken: {
          buyTaxBps: "0",
          sellTaxBps: "0",
          transferTaxBps: "0"
        },
        sellToken: {
          buyTaxBps: "0",
          sellTaxBps: "0",
          transferTaxBps: "0"
        }
      },
      totalNetworkFee: totalNetworkFee.toString(),
      usedFeeTier: bestFeeResult.fee,
      optimizationType: fee !== null ? 'fixed_fee' : 'auto_optimized',
      isOutputETH: isOutETH
    };

    // Jika diminta semua opsi, tambahkan ke response
    if (returnAllOptions && allFeeOptions) {
      return {
        ...mainResponse,
        allFeeOptions: allFeeOptions.map(option => ({
          fee: option.fee,
          buyAmount: option.amountOut.toString(),
          buyAmountFormatted: option.amountOutFormatted,
          poolAvailable: option.poolAvailable,
          gasEstimate: option.gasEstimate
        }))
      };
    }

    return mainResponse;

  } catch (error) {
    if (error instanceof SwapError) {
      throw error;
    }
    throw new SwapError(
      'Unexpected error in getSwapQuote',
      ERROR_CODES.NETWORK_ERROR,
      { originalError: error.message }
    );
  }
}

/* =========================================================
   🔵 getSwap() - OPTIMIZED dengan dukungan semua tipe swap
========================================================= */

export async function getSwap({
  publicClient,
  tokenIn,
  tokenOut,
  amountIn,
  recipient = zeroAddress,
  fee = null,
  feeTiers = DEFAULT_FEE_TIERS,
  slippage = 2,
  deadline = Math.floor(Date.now() / 1000) + 600,
  returnAllOptions = false
}) {
  try {
    validateInputs(tokenIn, tokenOut, amountIn, fee || 3000);

    if (slippage < 0 || slippage > 100) {
      throw new SwapError(
        'Slippage must be between 0 and 100',
        ERROR_CODES.INVALID_INPUT,
        { slippage }
      );
    }

    if (!isAddress(recipient) && !isNativeETH(recipient)) {
      throw new SwapError(
        'Invalid recipient address',
        ERROR_CODES.INVALID_INPUT,
        { recipient }
      );
    }

    const isInETH = isNativeETH(tokenIn);
    const isOutETH = isNativeETH(tokenOut);

    let bestFeeResult;
    let allFeeOptions;

    // Jika fee ditentukan, gunakan itu
    if (fee !== null) {
      const poolExists = await checkPoolAvailability(publicClient, tokenIn, tokenOut, fee);
      if (!poolExists) {
        throw new SwapError(
          `No pool available for ${tokenIn}/${tokenOut} with fee ${fee}`,
          ERROR_CODES.NO_POOL_AVAILABLE,
          { tokenIn, tokenOut, fee }
        );
      }

      const tokenInForContract = isInETH ? CONTRACTS.WETH : getAddress(tokenIn);
      const tokenOutForContract = isOutETH ? CONTRACTS.WETH : getAddress(tokenOut);

      const decimalsIn = await getTokenDecimals(publicClient, tokenIn, isInETH);
      const decimalsOut = await getTokenDecimals(publicClient, tokenOut, isOutETH);
      const amountInWei = parseUnits(amountIn.toString(), decimalsIn);

      let amountOut, gasEstimate;
      try {
        [amountOut, , , gasEstimate] = await publicClient.readContract({
          address: CONTRACTS.QUOTER_V2,
          abi: QUOTER_ABI,
          functionName: 'quoteExactInputSingle',
          args: [{
            tokenIn: tokenInForContract,
            tokenOut: tokenOutForContract,
            amountIn: amountInWei,
            fee,
            sqrtPriceLimitX96: 0n
          }]
        });
      } catch (error) {
        if (error.message?.includes('No liquidity') || error.message?.includes('insufficient liquidity')) {
          throw new SwapError(
            'Insufficient liquidity for this trade',
            ERROR_CODES.INSUFFICIENT_LIQUIDITY,
            { tokenIn, tokenOut, fee }
          );
        }
        throw error;
      }

      bestFeeResult = {
        fee,
        amountOut,
        amountOutFormatted: formatUnits(amountOut, decimalsOut),
        gasEstimate: gasEstimate?.toString() || '0',
        tokenInForContract,
        tokenOutForContract,
        decimalsIn,
        decimalsOut,
        amountInWei
      };
    } else {
      // Cari fee tier terbaik
      const result = await findBestFeeTier({
        publicClient,
        tokenIn,
        tokenOut,
        amountIn,
        feeTiers,
        returnAllResults: returnAllOptions
      });

      if (returnAllOptions && result.allResults) {
        allFeeOptions = result.allResults;
      }

      if (!result || !result.amountOut) {
        throw new SwapError(
          'No available pools found for any fee tier',
          ERROR_CODES.NO_POOL_AVAILABLE,
          { tokenIn, tokenOut, feeTiers }
        );
      }

      // Dapatkan detail tambahan untuk best result
      const tokenInForContract = isInETH ? CONTRACTS.WETH : getAddress(tokenIn);
      const tokenOutForContract = isOutETH ? CONTRACTS.WETH : getAddress(tokenOut);
      const decimalsIn = await getTokenDecimals(publicClient, tokenIn, isInETH);
      const decimalsOut = await getTokenDecimals(publicClient, tokenOut, isOutETH);
      const amountInWei = parseUnits(amountIn.toString(), decimalsIn);

      bestFeeResult = {
        ...result,
        tokenInForContract,
        tokenOutForContract,
        decimalsIn,
        decimalsOut,
        amountInWei
      };
    }

    // Hitung amountOutMinimum dengan slippage
    const slippageMultiplier = (100 - slippage) / 100;
    const amountOutMin = (bestFeeResult.amountOut * BigInt(Math.floor(slippageMultiplier * 1000000))) / 1000000n;

    const txDeadline = deadline > Math.floor(Date.now() / 1000)
      ? BigInt(deadline)
      : BigInt(Math.floor(Date.now() / 1000) + 600);

    // =============== PERBAIKAN UTAMA ===============
    // Handle 3 kasus:
    // 1. ERC20 -> ETH: swap + unwrap
    // 2. ETH -> ERC20: wrap + swap + refund
    // 3. ERC20 -> ERC20: swap biasa

    let callData;
    let value = isInETH ? bestFeeResult.amountInWei.toString() : '0';
    let additionalGas = 0n;

    if (isOutETH) {
      // Kasus 1: ERC20 -> ETH (swap + unwrap)
      const swapCalldata = encodeFunctionData({
        abi: SWAP_ROUTER_ABI,
        functionName: 'exactInputSingle',
        args: [{
          tokenIn: bestFeeResult.tokenInForContract,
          tokenOut: CONTRACTS.WETH,
          fee: bestFeeResult.fee,
          recipient: CONTRACTS.SWAP_ROUTER,
          amountIn: bestFeeResult.amountInWei,
          amountOutMinimum: amountOutMin,
          sqrtPriceLimitX96: 0n
        }]
      });

      const unwrapCalldata = encodeFunctionData({
        abi: SWAP_ROUTER_ABI,
        functionName: 'unwrapWETH9',
        args: [amountOutMin, getAddress(recipient)]
      });

      callData = encodeFunctionData({
        abi: SWAP_ROUTER_ABI,
        functionName: 'multicall',
        args: [[swapCalldata, unwrapCalldata]]
      });

      additionalGas = 50000n; // Gas untuk unwrap
    } else if (isInETH) {
      // Kasus 2: ETH -> ERC20 (Router akan otomatis wrap ETH)
      // Uniswap V3 Router mendukung ETH input langsung di exactInputSingle
      callData = encodeFunctionData({
        abi: SWAP_ROUTER_ABI,
        functionName: 'exactInputSingle',
        args: [{
          tokenIn: CONTRACTS.WETH, // Router akan wrap ETH menjadi WETH
          tokenOut: bestFeeResult.tokenOutForContract,
          fee: bestFeeResult.fee,
          recipient: getAddress(recipient),
          amountIn: bestFeeResult.amountInWei,
          amountOutMinimum: amountOutMin,
          sqrtPriceLimitX96: 0n
        }]
      });

      // Router akan otomatis handle ETH wrapping, jadi tidak perlu multicall
      // Tetapi kita perlu mengirim ETH bersama transaksi (value sudah di-set di atas)
      additionalGas = 30000n; // Gas untuk wrapping ETH
    } else {
      // Kasus 3: ERC20 -> ERC20 (swap biasa)
      callData = encodeFunctionData({
        abi: SWAP_ROUTER_ABI,
        functionName: 'exactInputSingle',
        args: [{
          tokenIn: bestFeeResult.tokenInForContract,
          tokenOut: bestFeeResult.tokenOutForContract,
          fee: bestFeeResult.fee,
          recipient: getAddress(recipient),
          amountIn: bestFeeResult.amountInWei,
          amountOutMinimum: amountOutMin,
          sqrtPriceLimitX96: 0n
        }]
      });
    }

    // Update gas estimate dengan additional gas
    const baseGas = BigInt(bestFeeResult.gasEstimate || 0);
    bestFeeResult.gasEstimate = (baseGas + additionalGas).toString();

    const response = {
      quote: {
        amountIn: bestFeeResult.amountInWei.toString(),
        amountOut: bestFeeResult.amountOutFormatted,
        amountOutMinimum: formatUnits(amountOutMin, bestFeeResult.decimalsOut),
        gasEstimate: bestFeeResult.gasEstimate,
        fee: bestFeeResult.fee,
        slippage,
        optimizationType: fee !== null ? 'fixed_fee' : 'auto_optimized',
        swapType: isInETH && isOutETH ? 'ETH → ETH (invalid)' :
          isInETH ? 'ETH → ERC20' :
            isOutETH ? 'ERC20 → ETH' : 'ERC20 → ERC20'
      },
      transaction: {
        to: CONTRACTS.SWAP_ROUTER,
        data: callData,
        value: value,
        chainId: sepolia.id,
        type: '0x2',
        gas: bestFeeResult.gasEstimate ? (BigInt(bestFeeResult.gasEstimate) * 120n / 100n).toString() : undefined
      },
      metadata: {
        tokenIn,
        tokenOut,
        recipient,
        deadline: txDeadline.toString(),
        usedFeeTier: bestFeeResult.fee,
        isInputETH: isInETH,
        isOutputETH: isOutETH,
        // Info tambahan untuk debugging
        swapPath: isInETH && !isOutETH ? `ETH → WETH → ${tokenOut}` :
          !isInETH && isOutETH ? `${tokenIn} → WETH → ETH` :
            `${tokenIn} → ${tokenOut}`
      }
    };

    // Jika diminta semua opsi, tambahkan ke response
    if (returnAllOptions && allFeeOptions) {
      return {
        ...response,
        allFeeOptions: allFeeOptions.map(option => ({
          fee: option.fee,
          amountOut: option.amountOutFormatted,
          amountOutWei: option.amountOut.toString(),
          poolAvailable: option.poolAvailable,
          gasEstimate: option.gasEstimate
        }))
      };
    }

    return response;

  } catch (error) {
    if (error instanceof SwapError) {
      throw error;
    }
    throw new SwapError(
      'Unexpected error in getSwap',
      ERROR_CODES.NETWORK_ERROR,
      { originalError: error.message }
    );
  }
}

/* =========================================================
   🔵 Fungsi khusus untuk swap ke ETH
========================================================= */

export async function getSwapToETH({
  publicClient,
  tokenIn,
  amountIn,
  recipient,
  fee = null,
  feeTiers = DEFAULT_FEE_TIERS,
  slippage = 2,
  deadline = Math.floor(Date.now() / 1000) + 600
}) {
  // Gunakan getSwap dengan tokenOut sebagai ETH
  return getSwap({
    publicClient,
    tokenIn,
    tokenOut: NATIVE_ETH.address,
    amountIn,
    recipient,
    fee,
    feeTiers,
    slippage,
    deadline
  });
}

/* =========================================================
   🔵 Fungsi khusus untuk swap dari ETH
========================================================= */

export async function getSwapFromETH({
  publicClient,
  tokenOut,
  amountIn,
  recipient,
  fee = null,
  feeTiers = DEFAULT_FEE_TIERS,
  slippage = 2,
  deadline = Math.floor(Date.now() / 1000) + 600
}) {
  // Gunakan getSwap dengan tokenIn sebagai ETH
  return getSwap({
    publicClient,
    tokenIn: NATIVE_ETH.address,
    tokenOut,
    amountIn,
    recipient,
    fee,
    feeTiers,
    slippage,
    deadline
  });
}

/* =========================================================
   🔵 Fungsi dengan refundETH untuk ETH -> ERC20 (opsional)
========================================================= */

export async function getSwapFromETHWithRefund({
  publicClient,
  tokenOut,
  amountIn,
  recipient,
  fee = null,
  feeTiers = DEFAULT_FEE_TIERS,
  slippage = 2,
  deadline = Math.floor(Date.now() / 1000) + 600
}) {
  try {
    const isInETH = true;
    const isOutETH = false;

    // Get quote terlebih dahulu
    const quoteData = await getSwapQuoteData({
      publicClient,
      tokenIn: NATIVE_ETH.address,
      tokenOut,
      amountIn,
      recipient,
      fee,
      feeTiers,
      slippage,
      deadline
    });

    // Hitung amountOutMinimum dengan slippage
    const slippageMultiplier = (100 - slippage) / 100;
    const amountOut = BigInt(quoteData.buyAmount);
    const amountOutMin = (amountOut * BigInt(Math.floor(slippageMultiplier * 1000000))) / 1000000n;

    // Buat calldata untuk ETH -> ERC20 dengan refund
    const swapCalldata = encodeFunctionData({
      abi: SWAP_ROUTER_ABI,
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: CONTRACTS.WETH,
        tokenOut: getAddress(tokenOut),
        fee: quoteData.usedFeeTier,
        recipient: getAddress(recipient),
        amountIn: BigInt(quoteData.sellAmount),
        amountOutMinimum: amountOutMin,
        sqrtPriceLimitX96: 0n
      }]
    });

    const refundETHCalldata = encodeFunctionData({
      abi: SWAP_ROUTER_ABI,
      functionName: 'refundETH',
      args: []
    });

    const callData = encodeFunctionData({
      abi: SWAP_ROUTER_ABI,
      functionName: 'multicall',
      args: [[swapCalldata, refundETHCalldata]]
    });

    return {
      ...quoteData,
      transaction: {
        to: CONTRACTS.SWAP_ROUTER,
        data: callData,
        value: quoteData.sellAmount,
        chainId: sepolia.id,
        type: '0x2',
        gas: quoteData.gas ? (BigInt(quoteData.gas) * 120n / 100n).toString() : undefined
      },
      metadata: {
        ...quoteData.metadata,
        swapPath: `ETH → WETH → ${tokenOut}`,
        hasRefund: true
      }
    };
  } catch (error) {
    if (error instanceof SwapError) {
      throw error;
    }
    throw new SwapError(
      'Unexpected error in getSwapFromETHWithRefund',
      ERROR_CODES.NETWORK_ERROR,
      { originalError: error.message }
    );
  }
}

/* =========================================================
   🔍 Utilitas tambahan
========================================================= */

export async function findAvailableRoute({
  publicClient,
  tokenIn,
  tokenOut,
  amountIn,
  feeTiers = DEFAULT_FEE_TIERS
}) {
  try {
    const result = await findBestFeeTier({
      publicClient,
      tokenIn,
      tokenOut,
      amountIn,
      feeTiers,
      returnAllResults: true
    });

    if (!result.best) {
      throw new SwapError(
        'No available route found for the specified tokens',
        ERROR_CODES.NO_POOL_AVAILABLE,
        { tokenIn, tokenOut, feeTiers }
      );
    }

    return {
      best: { ...result.best, amountIn },
      allOptions: result.allResults
    };
  } catch (error) {
    if (error instanceof SwapError) {
      throw error;
    }
    throw new SwapError(
      'Unexpected error in findAvailableRoute',
      ERROR_CODES.NETWORK_ERROR,
      { originalError: error.message }
    );
  }
}

/* =========================================================
   🔵 Fungsi untuk mendapatkan informasi token
========================================================= */

export async function getTokenInfo(publicClient, tokenAddress) {
  try {
    const isNative = isNativeETH(tokenAddress);

    if (isNative) {
      return {
        address: NATIVE_ETH.address,
        decimals: 18,
        symbol: 'ETH',
        isNative: true,
        name: 'Ethereum'
      };
    }

    const address = getAddress(tokenAddress);

    const [decimals, symbol, name] = await Promise.all([
      publicClient.readContract({
        address,
        abi: erc20Abi,
        functionName: 'decimals'
      }),
      publicClient.readContract({
        address,
        abi: erc20Abi,
        functionName: 'symbol'
      }),
      publicClient.readContract({
        address,
        abi: erc20Abi,
        functionName: 'name'
      }).catch(() => 'Unknown Token')
    ]);

    return {
      address,
      decimals: Number(decimals),
      symbol,
      name,
      isNative: false
    };
  } catch (error) {
    throw new SwapError(
      `Failed to get token info for ${tokenAddress}`,
      ERROR_CODES.TOKEN_NOT_FOUND,
      { tokenAddress, error: error.message }
    );
  }
}

/* =========================================================
   🔵 Fungsi untuk mendapatkan swap type berdasarkan token
========================================================= */

export function getSwapType(tokenIn, tokenOut) {
  const isInETH = isNativeETH(tokenIn);
  const isOutETH = isNativeETH(tokenOut);

  if (isInETH && isOutETH) return 'ETH → ETH (invalid)';
  if (isInETH && !isOutETH) return 'ETH → ERC20';
  if (!isInETH && isOutETH) return 'ERC20 → ETH';
  return 'ERC20 → ERC20';
}