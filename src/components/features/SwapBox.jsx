import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    RadioGroup,
    RadioGroupItem,
} from "@/components/ui/radio-group"

import { cn } from "@/lib/utils";
import {
    SlidersHorizontal,
    HelpCircle,
    ArrowDownUp,
    Check,
    ChevronDown,
    Search,
    AlertCircle,
    Loader2,
    CheckCircle2,
    Copy,
    ExternalLink,
    X
} from "lucide-react";

import { useAccount } from "wagmi"
import { getSwapQuote, getBalances, getBalancesAllToken } from "@/hooks/useSwapAPI";
import { formatBalance } from "@/lib/formatBalance";

import DateTimePicker from "./DatePicker";
import CooldownTime from "./CooldownTime";
import SwapLimitPrice from "./SwapLimitPrice"

import { tokens } from "@/config/tokens";
import { useAuth } from "@/context/AuthContext";
import { isSmartAccountUpgraded, createAdvancedPermissions } from "@/hooks/useAdvancedPermissions";

const LIMIT_OPTIONS = [
    { label: "1 Day", value: { days: 1 } },
    { label: "1 Week", value: { days: 7 } },
    { label: "2 Week", value: { days: 14 } },
    { label: "1 Month", value: { months: 1 } },
    { label: "6 Month", value: { months: 6 } },
    { label: "1 Year", value: { years: 1 } },
];

// Reusable Error Popup Component
function PopUpError({ open, onOpenChange, title, description, actionButton }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-card backdrop-blur-md border border-white/10 p-0 gap-0">
                <div className="p-6">
                    {/* Error Icon Animation */}
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                            type: "spring",
                            stiffness: 260,
                            damping: 20,
                            delay: 0.1
                        }}
                        className="mb-6 flex justify-center"
                    >
                        <div className="relative">
                            <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping" />
                            <div className="relative bg-red-500/10 p-4 rounded-full">
                                <AlertCircle className="w-12 h-12 text-red-500" />
                            </div>
                        </div>
                    </motion.div>

                    {/* Title */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-center mb-6"
                    >
                        <h2 className="text-2xl font-bold mb-2 text-red-500">{title}</h2>
                        <p className="text-muted-foreground text-sm">
                            {description}
                        </p>
                    </motion.div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <Button
                            onClick={() => onOpenChange(false)}
                            className="flex-1 bg-red-600 hover:bg-red-700"
                        >
                            Close
                        </Button>
                        {actionButton && (
                            <div className="flex-1">
                                {actionButton}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Swap Confirmation Popup Component
function SwapConfirmationPopup({
    open,
    onOpenChange,
    onConfirm,
    swapType,
    fromToken,
    toToken,
    fromAmount,
    toAmount,
    dateScheduled,
    limitPrice,
    isLoading,
    isPermissionLoading
}) {
    const getSwapDescription = () => {
        switch (swapType) {
            case "immediately":
                return `Swap ${fromAmount} ${fromToken?.symbol} to ${toAmount} ${toToken?.symbol} immediately at the current market price.`;
            case "scheduled":
                return `Swap ${fromAmount} ${fromToken?.symbol} to ${toToken?.symbol} scheduled for ${dateScheduled.toLocaleString()}.`;
            case "price":
                return `Swap ${fromAmount} ${fromToken?.symbol} to ${toToken?.symbol} will be executed automatically when the set price reached`;
            default:
                return "";
        }
    };


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-card backdrop-blur-md border border-white/10 p-0 gap-0">
                <div className="p-6">
                    {/* Title */}
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold mb-2">Swap Confirmation</h2>
                    </div>

                    {/* Loading State */}
                    {(isLoading || isPermissionLoading) && (
                        <div className="mb-4 flex flex-col items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                            <span className="mt-2 text-sm text-muted-foreground">
                                {isPermissionLoading
                                    ? "Granting permissions..."
                                    : "Processing swap..."}
                            </span>
                        </div>
                    )}

                    {/* Swap Details */}
                    <div className="bg-white/5 rounded-xl p-4 mb-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
                                    {fromToken?.image_url ? (
                                        <img
                                            src={fromToken.image_url}
                                            alt={fromToken.symbol}
                                            className="w-full h-full rounded-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-xs font-medium">{fromToken?.symbol?.charAt(0)}</span>
                                    )}
                                </div>
                                <span className="font-semibold">{fromAmount} {fromToken?.symbol}</span>
                            </div>
                            <ArrowDownUp className="w-4 h-4 text-muted-foreground" />
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
                                    {toToken?.image_url ? (
                                        <img
                                            src={toToken.image_url}
                                            alt={toToken.symbol}
                                            className="w-full h-full rounded-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-xs font-medium">{toToken?.symbol?.charAt(0)}</span>
                                    )}
                                </div>
                                <span className="font-semibold">{(swapType == 'price' ? limitPrice : toAmount)} {toToken?.symbol}</span>
                            </div>
                        </div>

                        {/* Swap Description */}
                        <div className="mt-3 p-3 bg-blue-500/10 rounded-lg">
                            <p className="text-sm text-blue-300">{getSwapDescription()}</p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <Button
                            onClick={() => onOpenChange(false)}
                            variant="outline"
                            className="flex-1"
                            disabled={isLoading || isPermissionLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={onConfirm}
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                            disabled={isLoading || isPermissionLoading}
                        >
                            {isPermissionLoading
                                ? "Granting Permissions..."
                                : isLoading
                                    ? "Processing..."
                                    : "Confirm"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Success Popup Component
function SuccessPopup({ open, onOpenChange, txHash, fromToken, toToken, fromAmount, toAmount, tipeSwap, limitPrice }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(txHash);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const shortenHash = (hash) => {
        if (!hash) return "";
        return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-card backdrop-blur-md border border-white/10 p-0 gap-0">
                <div className="p-6">
                    {/* Success Icon Animation */}
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                            type: "spring",
                            stiffness: 260,
                            damping: 20,
                            delay: 0.1
                        }}
                        className="mb-6 flex justify-center"
                    >
                        <div className="relative">
                            <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
                            <div className="relative bg-green-500/10 p-4 rounded-full">
                                <CheckCircle2 className="w-12 h-12 text-green-500" />
                            </div>
                        </div>
                    </motion.div>

                    {/* Title */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-center mb-6"
                    >
                        <h2 className="text-2xl font-bold mb-2">Swap Successful!</h2>
                        <p className="text-muted-foreground text-sm">
                            Your transaction has been submitted successfully
                        </p>
                    </motion.div>

                    {/* Swap Details */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white/5 rounded-xl p-4 mb-4"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
                                    {fromToken?.image_url ? (
                                        <img
                                            src={fromToken.image_url}
                                            alt={fromToken.symbol}
                                            className="w-full h-full rounded-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-xs font-medium">{fromToken?.symbol?.charAt(0)}</span>
                                    )}
                                </div>
                                <span className="font-semibold">{(Number(fromAmount)).toFixed(8)} {fromToken?.symbol}</span>
                            </div>
                            <ArrowDownUp className="w-4 h-4 text-muted-foreground" />
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
                                    {toToken?.image_url ? (
                                        <img
                                            src={toToken.image_url}
                                            alt={toToken.symbol}
                                            className="w-full h-full rounded-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-xs font-medium">{toToken?.symbol?.charAt(0)}</span>
                                    )}
                                </div>
                                <span className="font-semibold">{(tipeSwap == 'price' ? limitPrice : toAmount)} {toToken?.symbol}</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Transaction Hash */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-white/5 rounded-xl p-4 mb-6"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Transaction Hash</p>
                                <p className="font-mono text-sm">{shortenHash(txHash)}</p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleCopy}
                                    className="h-8 w-8"
                                >
                                    {copied ? (
                                        <Check className="w-4 h-4 text-green-500" />
                                    ) : (
                                        <Copy className="w-4 h-4" />
                                    )}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    asChild
                                    className="h-8 w-8"
                                >
                                    <a
                                        href={`https://eth-sepolia.blockscout.com/tx/${txHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                </Button>
                            </div>
                        </div>
                    </motion.div>

                    {/* Action Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="flex gap-3"
                    >
                        <Button
                            onClick={() => onOpenChange(false)}
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                        >
                            Make Another Swap
                        </Button>
                    </motion.div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Task Queued Popup Component untuk scheduled dan price swap
function TaskQueuedPopup({
    open,
    onOpenChange,
    swapType,
    fromToken,
    toToken,
    fromAmount,
    toAmount,
    dateScheduled,
    limitPrice,
    exchangeRate
}) {
    const getSwapTypeText = () => {
        switch (swapType) {
            case "scheduled":
                return "Scheduled Swap";
            case "price":
                return "Limit Price Swap";
            default:
                return "Swap Task";
        }
    };

    const getSwapDetails = () => {
        switch (swapType) {
            case "scheduled":
                return `Will execute on: ${dateScheduled.toLocaleString()}`;
            case "price":
                return `Will execute when price reach and you willget minimum: ${limitPrice} ${toToken?.symbol}`;
            default:
                return "";
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-card backdrop-blur-md border border-white/10 p-0 gap-0">
                <div className="p-6">
                    {/* Success Icon */}
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                            type: "spring",
                            stiffness: 260,
                            damping: 20,
                            delay: 0.1
                        }}
                        className="mb-6 flex justify-center"
                    >
                        <div className="relative">
                            <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
                            <div className="relative bg-green-500/10 p-4 rounded-full">
                                <CheckCircle2 className="w-12 h-12 text-green-500" />
                            </div>
                        </div>
                    </motion.div>

                    {/* Title */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-center mb-6"
                    >
                        <h2 className="text-2xl font-bold mb-2">Swap Task Successfully!</h2>
                        <p className="text-muted-foreground text-sm">
                            Swap task has been successfully added to the queue
                        </p>
                    </motion.div>

                    {/* Swap Type Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="flex justify-center mb-4"
                    >
                        <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                            {getSwapTypeText()}
                        </Badge>
                    </motion.div>

                    {/* Swap Details */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-white/5 rounded-xl p-4 mb-4"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
                                    {fromToken?.image_url ? (
                                        <img
                                            src={fromToken.image_url}
                                            alt={fromToken.symbol}
                                            className="w-full h-full rounded-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-xs font-medium">{fromToken?.symbol?.charAt(0)}</span>
                                    )}
                                </div>
                                <span className="font-semibold">{(Number(fromAmount)).toFixed(8)} {fromToken?.symbol}</span>
                            </div>
                            <ArrowDownUp className="w-4 h-4 text-muted-foreground" />
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
                                    {toToken?.image_url ? (
                                        <img
                                            src={toToken.image_url}
                                            alt={toToken.symbol}
                                            className="w-full h-full rounded-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-xs font-medium">{toToken?.symbol?.charAt(0)}</span>
                                    )}
                                </div>
                                <span className="font-semibold">{swapType == 'price' ? (Number(limitPrice)).toFixed(8) : (Number(toAmount)).toFixed(8)} {toToken?.symbol}</span>
                            </div>
                        </div>

                        {/* Additional Details */}
                        <div className="mt-3 p-3 bg-blue-500/10 rounded-lg">
                            <p className="text-sm text-blue-300">{getSwapDetails()}</p>
                        </div>
                    </motion.div>

                    {/* Action Button */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                    >
                        <Button
                            onClick={() => onOpenChange(false)}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                            Close
                        </Button>
                    </motion.div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// 🎯 PERUBAHAN PENTING: TokenSelect dengan saldo dan pengurutan
function TokenSelect({ selected, onChange, disabled, selectedAddress }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [tokensWithBalance, setTokensWithBalance] = useState([]);
    const [loadingBalances, setLoadingBalances] = useState(false);

    const handleSearch = (value) => {
        setSearch(value);
    };

    const handleTokenSelect = (token) => {
        onChange(token);
        setOpen(false);
        setSearch("");
    };

    // 🎯 PERUBAHAN PENTING: Fetch balances ketika popup dibuka
    useEffect(() => {
        const fetchTokenBalances = async () => {
            if (!open || !selectedAddress) {
                // Jika popup tertutup atau tidak ada address, reset ke token list biasa
                setTokensWithBalance(tokens.map(token => ({ ...token, balance: "0", balanceFormatted: "0" })));
                return;
            }

            setLoadingBalances(true);
            try {
                const allBalances = await getBalancesAllToken(selectedAddress);

                // Gabungkan data token dengan balance
                const enrichedTokens = tokens.map(token => {
                    // Cari balance yang sesuai dari API response
                    const balanceData = allBalances.find(b =>
                        b.address.toLowerCase() === token.address.toLowerCase()
                    );

                    return {
                        ...token,
                        balance: balanceData?.balance || "0",
                        balanceFormatted: balanceData ? formatBalance(balanceData.balance) : "0"
                    };
                });

                // 🎯 PERUBAHAN PENTING: Urutkan token berdasarkan balance (yang ada balance di atas)
                const sortedTokens = [...enrichedTokens].sort((a, b) => {
                    const balanceA = parseFloat(a.balance);
                    const balanceB = parseFloat(b.balance);

                    // Token dengan balance > 0 di atas, diurutkan dari balance terbesar ke terkecil
                    if (balanceA > 0 && balanceB > 0) {
                        return balanceB - balanceA;
                    } else if (balanceA > 0) {
                        return -1;
                    } else if (balanceB > 0) {
                        return 1;
                    } else {
                        // Jika kedua token balance 0, pertahankan urutan asli
                        return tokens.indexOf(a) - tokens.indexOf(b);
                    }
                });

                setTokensWithBalance(sortedTokens);
            } catch (error) {
                console.error("Failed to fetch token balances:", error);
                // Jika gagal, tetap tampilkan token list tanpa balance
                setTokensWithBalance(tokens.map(token => ({ ...token, balance: "0", balanceFormatted: "0" })));
            } finally {
                setLoadingBalances(false);
            }
        };

        fetchTokenBalances();
    }, [open, selectedAddress]);

    function TokenItem({ token, onSelect, isSelected }) {
        return (
            <button
                onClick={() => onSelect(token)}
                className="flex items-center justify-between w-full p-3 hover:bg-white/5 transition-colors rounded-lg"
            >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
                        {token?.image_url ? (
                            <img
                                src={token.image_url}
                                alt={token.symbol}
                                className="w-full h-full rounded-full object-cover"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                }}
                            />
                        ) : (
                            <span className="text-xs font-medium text-white">{token?.symbol?.charAt(0) || '?'}</span>
                        )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{token?.symbol}</span>
                            {token?.verified && (
                                <span className="text-xs bg-blue-500 text-white px-1 rounded">✓</span>
                            )}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">{token?.name}</div>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-col items-end">
                    {/* 🎯 PERUBAHAN PENTING: Tampilkan balance */}
                    <span className="text-xs font-medium text-muted-foreground">
                        {parseFloat(token.balance) > 0 ? token.balanceFormatted : ""}
                    </span>
                    <div className="flex items-center gap-2">
                        {isSelected && (
                            <Check className="w-4 h-4 text-green-400" />
                        )}
                    </div>
                </div>
            </button>
        );
    }

    const filteredTokens = tokensWithBalance.filter(token =>
        token?.symbol?.toLowerCase().includes(search.toLowerCase()) ||
        token?.name?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    disabled={disabled}
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10",
                        disabled && "opacity-50 cursor-not-allowed"
                    )}
                >
                    {selected ? (
                        <>
                            <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
                                {selected?.image_url ? (
                                    <img
                                        src={selected.image_url}
                                        alt={selected.symbol || 'token'}
                                        className="w-full h-full rounded-full object-cover"
                                        onError={e => { e.target.style.display = 'none'; }}
                                        title={selected.symbol}
                                    />
                                ) : (
                                    <span className="text-xs font-medium text-white">{selected?.symbol?.charAt(0) || '?'}</span>
                                )}
                            </div>
                            <span className="font-semibold">{selected?.symbol}</span>
                        </>
                    ) : (
                        <span className="font-semibold">-</span>
                    )}
                    <ChevronDown className="w-4 h-4" />
                </button>
            </DialogTrigger>

            <DialogContent className="max-w-90 p-0 gap-0 bg-card backdrop-blur-md border border-white/10 rounded-2xl">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h3 className="font-semibold">Select a token</h3>
                </div>

                <div className="p-4 border-b border-white/10">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Search token"
                            className="pl-10 pr-4 py-2 bg-white/5 border-0 text-white placeholder:text-gray-400"
                            value={search}
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="max-h-96 overflow-y-auto">
                    {loadingBalances ? (
                        <div className="flex justify-center items-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            <span className="ml-2 text-sm text-muted-foreground">Loading balances...</span>
                        </div>
                    ) : filteredTokens.length > 0 ? (
                        <div className="divide-y divide-white/10">
                            {filteredTokens.map((token) => (
                                <TokenItem
                                    key={token.address}
                                    token={token}
                                    onSelect={handleTokenSelect}
                                    isSelected={selected?.address === token.address}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center">
                            <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No tokens found</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function SettingsModal({ open, onOpenChange, settings, onSettingsChange }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-90 bg-card backdrop-blur-md border border-white/10">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Settings</h3>
                </div>

                <div className="space-y-6">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Label className="text-xs font-medium">Slippage tolerance</Label>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="w-64 text-xs">
                                        Your transaction will revert if the price changes unfavorably by more than this percentage.
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <div className="flex gap-2">
                            {[0.5, 1, 2, 5].map((value) => (
                                <Button
                                    key={value}
                                    variant={settings.slippage === value ? "default" : "outline"}
                                    size="sm"
                                    onClick={() =>
                                        onSettingsChange({
                                            ...settings,
                                            slippage: value,
                                            customSlippage: false,
                                        })
                                    }
                                    className="flex-1 text-xs"
                                >
                                    {value}%
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function SwapBox() {
    const defaultFromTo = useMemo(() => {
        const ethToken = tokens.find(token => token.symbol === 'BASE') || tokens[0];
        const usdcToken = tokens.find(token => token.symbol === 'USDC') || tokens[2];
        return [ethToken, usdcToken];
    }, []);

    const [fromToken, setFromToken] = useState(defaultFromTo[0]);
    const [toToken, setToToken] = useState(defaultFromTo[1]);
    const [fromAmount, setFromAmount] = useState("");
    const [toAmount, setToAmount] = useState("");
    const [fromBalanceWallet, setFromBalance] = useState("0");
    const [toBalanceWallet, setToBalance] = useState("0");

    // 🎯 PERUBAHAN PENTING: State baru untuk menyimpan total remaining permission
    const [remainingPermissionAmount, setRemainingPermissionAmount] = useState(0);
    const [loadingRemainingPermission, setLoadingRemainingPermission] = useState(false);

    const [exchangeRate, setExchangeRate] = useState(0);
    const [quoteData, setQuoteData] = useState({});
    const [quoteLoading, setQuoteLoading] = useState(false);

    const [settings, setSettings] = useState({
        slippage: 2
    });

    const [showSettings, setShowSettings] = useState(false);
    const [priceImpact, setPriceImpact] = useState(0.2);
    const [loading, setLoading] = useState(false);
    const [permissionLoading, setPermissionLoading] = useState(false);

    // Success popup state
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [successTxData, setSuccessTxData] = useState({
        txHash: "",
        fromToken: null,
        toToken: null,
        fromAmount: "",
        toAmount: ""
    });

    // Confirmation popup state
    const [showConfirmationPopup, setShowConfirmationPopup] = useState(false);

    // State untuk task queued popup
    const [showTaskQueuedPopup, setShowTaskQueuedPopup] = useState(false);
    const [taskQueuedData, setTaskQueuedData] = useState({
        swapType: "",
        fromToken: null,
        toToken: null,
        fromAmount: "",
        toAmount: "",
        dateScheduled: null,
        limitPrice: ""
    });

    // Error popup state
    const [showErrorPopup, setShowErrorPopup] = useState(false);
    const [errorData, setErrorData] = useState({
        title: "",
        description: ""
    });

    const durationCategories = {
        hour: 3600,
        day: 86400,
        week: 604800,
        twoWeeks: 1209600,
        month: 2592000,
        sixMonths: 15552000,
        year: 31536000
    };

    const normalizeDuration = (rawDuration) => {
        if (rawDuration <= durationCategories.hour) return durationCategories.hour;
        if (rawDuration <= durationCategories.day) return durationCategories.day;
        if (rawDuration <= durationCategories.week) return durationCategories.week;
        if (rawDuration <= durationCategories.twoWeeks) return durationCategories.twoWeeks;
        if (rawDuration <= durationCategories.month) return durationCategories.month;
        if (rawDuration <= durationCategories.sixMonths) return durationCategories.sixMonths;
        return durationCategories.year;
    }

    const { address, isConnected } = useAccount();
    const { loggedIn, postDelegationData, sendSwapToAPI, sendPermissionToAPI, getSessionAccountAddress, getRemainingPermissionTokenAmount } = useAuth();

    const [selectedSwapType, setSelectedSwapType] = useState("immediately");
    const [dateScheduled, setDateScheduled] = useState(new Date());

    const handleSwapTypeChange = (value) => {
        console.log(`Swap type change to ${value}`);
        setSelectedSwapType(value);
    };

    const [selectedLimitOption, setSelectedLimitOption] = useState("1 Month");
    const [swapLimitExpired, setSwapLimitExpired] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date;
    });
    const [swapLimitToAmount, setSwapLimitToAmount] = useState("");
    const [swapLimitPrice, setSwapLimitPrice] = useState(0);

    const calculateNewDate = useCallback((optionValue) => {
        const now = new Date();
        if (optionValue.days) {
            now.setDate(now.getDate() + optionValue.days);
        }
        if (optionValue.months) {
            now.setMonth(now.getMonth() + optionValue.months);
        }
        if (optionValue.years) {
            now.setFullYear(now.getFullYear() + optionValue.years);
        }
        return now;
    }, []);

    useEffect(() => {
        if (selectedSwapType === 'price') {
            const date = new Date();
            date.setDate(date.getDate() + 30);
            setSwapLimitExpired(date);
            setSelectedLimitOption("1 Month");
        }
    }, [selectedSwapType]);

    const handleSelectLimitOption = useCallback((option) => {
        const newDate = calculateNewDate(option.value);
        console.log(newDate);
        setSwapLimitExpired(newDate);
        setSelectedLimitOption(option.label);
    }, [calculateNewDate]);

    // Fetch balances
    const fetchBalances = async () => {
        if (!isConnected || !address) {
            setFromBalance("0");
            setToBalance("0");
            return;
        }

        try {
            const a = await getBalances(address, fromToken.address);
            setFromBalance(a);

            const b = await getBalances(address, toToken.address);
            setToBalance(b);
        } catch (error) {
            console.error(error);
            setFromBalance("0");
            setToBalance("0");
        }
    };

    // isSmartAccountUpgraded
    const [isSmartAccount, setIsSmartAccount] = useState(false);
    const getSmartAccountStatus = async () => {
        const stats = await isSmartAccountUpgraded();
        if (stats) {
            setIsSmartAccount(true);
        }
    }

    // 🎯 PERUBAHAN PENTING: Fungsi untuk fetch remaining permission amount
    const fetchRemainingPermissionAmount = async () => {
        if (!address || !fromToken || !fromAmount || parseFloat(fromAmount) <= 0 || selectedSwapType !== 'immediately') {
            setRemainingPermissionAmount(0);
            return;
        }

        try {
            setLoadingRemainingPermission(true);
            const response = await getRemainingPermissionTokenAmount(fromToken.address);

            if (response.status === "success") {
                setRemainingPermissionAmount(response.total_remaining || 0);
            } else {
                setRemainingPermissionAmount(0);
            }
        } catch (error) {
            console.error("Failed to fetch remaining permission amount:", error);
            setRemainingPermissionAmount(0);
        } finally {
            setLoadingRemainingPermission(false);
        }
    };

    // 🎯 PERUBAHAN PENTING: Panggil fetchRemainingPermissionAmount ketika ada perubahan
    useEffect(() => {
        fetchRemainingPermissionAmount();
    }, [selectedSwapType, fromToken, fromAmount, address]);

    // Create Permissions Advanced
    const createPermissionsAdvanced = async () => {
        try {
            const sessionAccountAddress = await getSessionAccountAddress();
            const token = fromToken;
            const amount = fromAmount;
            const justification = `Permission to transfer or swap max ${amount} ${token.symbol}`;
            let isAdjustment = true;

            let duration = 86400; // default 1 hari
            let startTime = Math.floor(Date.now() / 1000);
            let expired = Math.floor(Date.now() / 1000) + duration;

            if (selectedSwapType === 'price') {
                const now = Math.floor(Date.now() / 1000);
                const exp = Math.floor(swapLimitExpired.getTime() / 1000);

                duration = normalizeDuration(exp - now);

                startTime = now;
                expired = now + duration;
                isAdjustment = false;
            }

            if (selectedSwapType === 'scheduled') {
                const start = Math.floor(dateScheduled.getTime() / 1000);
                startTime = start;
                duration = 3600; // 1 jam
                expired = start + duration;

                isAdjustment = false;
            }

            const permissions = await createAdvancedPermissions(
                token,
                sessionAccountAddress.address,
                amount,
                duration,
                startTime,
                expired,
                justification,
                isAdjustment
            );

            console.log("Granted Permissions:", permissions);
            return permissions;

        } catch (error) {
            console.error("Error creating permissions:", error);
            return null;
        }
    };

    // Send permissions to backend
    const sendPermissionsToBackend = async () => {
        try {
            const sessionAccountAddress = await getSessionAccountAddress();
            const permissions = await createPermissionsAdvanced();
            if (!permissions) {
                throw new Error("Failed to create advanced permissions.");
            }

            const response = await sendPermissionToAPI({
                type: selectedSwapType,
                token: fromToken,
                session_address: sessionAccountAddress.address,
                wallet_address: address,
                permissions: permissions,
            });

            console.log("Permission sent to backend:", response);

            // 🎯 PERUBAHAN PENTING: Setelah berhasil grant permission, fetch ulang remaining amount
            if (selectedSwapType === 'immediately') {
                fetchRemainingPermissionAmount();
            }

            return response;
        } catch (error) {
            console.error("Failed to send permissions to backend:", error);
            return null;
        }
    }

    useEffect(() => {
        getSmartAccountStatus();
        fetchBalances();
    }, [fromToken, toToken, address, isConnected]);

    // Fetch quote - DIPERBARUI untuk menangani format response baru
    useEffect(() => {
        if (!fromAmount || parseFloat(fromAmount) <= 0 || !address) {
            setToAmount("");
            setExchangeRate(0);
            setQuoteData({});
            return;
        }

        let isMounted = true;
        let timeoutId;
        let isRequestInProgress = false;

        const fetchQuote = async () => {
            if (!isMounted || isRequestInProgress) return;

            isRequestInProgress = true;
            setQuoteLoading(true);

            try {
                const quote = await getSwapQuote(
                    fromToken,
                    toToken,
                    fromAmount,
                    settings.slippage * 100,
                    address
                );

                if (!isMounted) return;

                const buyAmountFormatted = (Number(quote.buyAmount) / Math.pow(10, toToken.decimals)).toString();
                const minBuyAmountFormatted = (Number(quote.minBuyAmount) / Math.pow(10, toToken.decimals)).toString();
                const sellAmountFormatted = (Number(quote.sellAmount) / Math.pow(10, fromToken.decimals)).toString();

                // Tambahkan field formatted ke quote data untuk kompatibilitas
                const formattedQuote = {
                    ...quote,
                    output_formatted: buyAmountFormatted,
                    min_output_formatted: minBuyAmountFormatted,
                    sell_amount_formatted: sellAmountFormatted
                };

                const rate = Number(buyAmountFormatted) / Number(fromAmount);
                setQuoteData(formattedQuote);
                setExchangeRate(rate);
                setToAmount(buyAmountFormatted);
            } catch (error) {
                console.error(error);
                if (isMounted) {
                    setQuoteData({});
                    setToAmount("");
                    setExchangeRate(0);
                }
            } finally {
                if (isMounted) {
                    setQuoteLoading(false);
                    isRequestInProgress = false;

                    // Setelah selesai, jadwalkan pemanggilan berikutnya dalam 10 detik
                    if (fromAmount && parseFloat(fromAmount) > 0 && address) {
                        timeoutId = setTimeout(() => {
                            if (isMounted) {
                                fetchQuote();
                            }
                        }, 10000);
                    }
                }
            }
        };

        // Debounce - tunggu 1 detik sebelum pemanggilan pertama
        timeoutId = setTimeout(() => {
            if (isMounted) {
                fetchQuote();
            }
        }, 1000);

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
        };
    }, [fromAmount, fromToken, toToken, settings.slippage, address]);

    // 🎯 PERUBAHAN PENTING: Update swapDisabled dengan kondisi baru
    const swapDisabled = useMemo(() => {
        if (!isSmartAccount) return true;
        if (!loggedIn) return true;
        if (!isConnected) return true;
        if (fromToken?.symbol === toToken?.symbol) return true;
        if (!fromAmount || parseFloat(fromAmount) <= 0) return true;
        if (!toAmount || parseFloat(toAmount) <= 0) return true;
        if (quoteLoading) return true;
        if (!address) return true;
        if (loading) return true;

        // 🎯 PERUBAHAN PENTING: Untuk immediately, cek remaining permission
        if (selectedSwapType === 'immediately' && parseFloat(fromAmount) > parseFloat(remainingPermissionAmount)) {
            return true;
        }

        if (selectedSwapType == 'price') {
            if (Number(swapLimitPrice) < Number(exchangeRate)) return true;
        }
        if (parseFloat(fromAmount) > parseFloat(fromBalanceWallet)) return true;
        return false;
    }, [loggedIn, isConnected, fromToken, toToken, fromAmount, toAmount, quoteLoading, address, loading, fromBalanceWallet, selectedSwapType, swapLimitPrice, exchangeRate, isSmartAccount, remainingPermissionAmount]);

    const shouldShowGrantButton = useMemo(() => {
        return selectedSwapType === 'immediately' &&
            loggedIn &&
            isSmartAccount &&
            parseFloat(fromAmount) > 0 &&
            parseFloat(fromAmount) <= parseFloat(fromBalanceWallet) &&
            parseFloat(fromAmount) > parseFloat(remainingPermissionAmount);
    }, [selectedSwapType, loggedIn, isSmartAccount, fromAmount, fromBalanceWallet, remainingPermissionAmount]);

    // 🎯 PERUBAHAN PENTING: Fungsi executeSwap yang diperbarui
    const executeSwap = useCallback(async () => {
        if (!address) return;

        setLoading(true);
        setShowConfirmationPopup(false);

        try {
            let result = null;

            if (selectedSwapType === 'immediately') {
                // Immediate swap - langsung kirim ke API
                result = await sendSwapToAPI({
                    type: "immediately",
                    user_address: address,
                    from_token: fromToken,
                    to_token: toToken,
                    from_amount: fromAmount,
                    to_amount: toAmount,
                    quote: quoteData
                });

                // Show success popup
                if (result && result.hash) {
                    setSuccessTxData({
                        txHash: result.hash,
                        fromToken: fromToken,
                        toToken: toToken,
                        fromAmount: fromAmount,
                        toAmount: toAmount
                    });
                    setShowSuccessPopup(true);

                    // reset
                    resetafterSwapSuccess();

                    // 🎯 PERUBAHAN PENTING: Update remaining permission setelah swap
                    fetchRemainingPermissionAmount();

                    // Refresh balances after swap
                    setTimeout(async () => {
                        try {
                            const a = await getBalances(address, fromToken.address);
                            setFromBalance(a);
                            const b = await getBalances(address, toToken.address);
                            setToBalance(b);
                        } catch (error) {
                            console.error(error);
                        }
                    }, 2000);
                }
            } else if (selectedSwapType === "scheduled" || selectedSwapType === "price") {
                // 🎯 PERUBAHAN PENTING: Untuk scheduled/price, grant permission dulu baru kirim delegation
                setPermissionLoading(true);

                // 1. Grant permission terlebih dahulu
                const permissions = await createPermissionsAdvanced();
                if (!permissions) {
                    throw new Error("Failed to create advanced permissions.");
                }

                // 2. Kirim delegation data ke API
                const delegationResponse = await postDelegationData({
                    owner_address: address,
                    type: selectedSwapType,
                    from_token: fromToken,
                    to_token: toToken,
                    from_amount: fromAmount,
                    swap_scheduled_execution_time: Math.floor(new Date(dateScheduled).getTime() / 1000),
                    swap_limit_expired: Math.floor(new Date(swapLimitExpired).getTime() / 1000),
                    swap_limit_price: swapLimitPrice,
                    swap_limit_amount: swapLimitToAmount,
                    swap_limit_exchange_rate: exchangeRate,
                    permission: permissions
                });

                setPermissionLoading(false);

                if (delegationResponse.status === 'ok') {
                    // Tampilkan popup task berhasil
                    setTaskQueuedData({
                        swapType: selectedSwapType,
                        fromToken: fromToken,
                        toToken: toToken,
                        fromAmount: fromAmount,
                        toAmount: toAmount,
                        dateScheduled: dateScheduled,
                        limitPrice: swapLimitToAmount
                    });

                    setShowTaskQueuedPopup(true);
                    resetafterSwapSuccess();
                } else if (delegationResponse.message === "limit") {
                    // Handle task limit error
                    setErrorData({
                        title: "Task Limit Reached",
                        description: "You have reached the maximum limit of 10 pending tasks. Please complete or cancel some tasks before creating new ones."
                    });
                    setShowErrorPopup(true);
                } else {
                    // Handle server error
                    setErrorData({
                        title: "Server Error",
                        description: "An unexpected server error occurred. Please try again later."
                    });
                    setShowErrorPopup(true);
                }
            }

        } catch (error) {
            console.error("Swap failed:", error);
            // Handle swap failed error
            setErrorData({
                title: selectedSwapType === 'immediately' ? "Swap Failed" : "Permission Failed",
                description: selectedSwapType === 'immediately'
                    ? "Your swap transaction could not be completed. Please try again."
                    : "Failed to grant permissions or create swap task. Please try again."
            });
            setShowErrorPopup(true);
        } finally {
            setLoading(false);
            setPermissionLoading(false);
            setDateScheduled(new Date());
            fetchBalances();
        }
    }, [
        selectedSwapType,
        toToken,
        fromToken,
        quoteData,
        address,
        fromAmount,
        toAmount,
        dateScheduled,
        swapLimitToAmount,
        swapLimitExpired,
        swapLimitPrice,
        exchangeRate,
        settings,
        sendSwapToAPI,
        sendPermissionsToBackend,
        postDelegationData,
        fetchRemainingPermissionAmount,
        getBalances
    ]);

    const resetafterSwapSuccess = () => {
        // Reset form after successful swap
        setFromAmount("");
        setToAmount("");
        setQuoteData({});
        setExchangeRate(0);
    }

    // 🎯 PERUBAHAN PENTING: Fungsi handleSwap yang baru untuk menangani semua tipe swap
    const handleSwap = useCallback(async () => {
        if (swapDisabled) return;

        // Untuk SEMUA tipe, langsung tampilkan popup konfirmasi
        setShowConfirmationPopup(true);
    }, [swapDisabled]);

    const handleMax = useCallback((val) => {
        const count = parseFloat(fromBalanceWallet) * val;
        setFromAmount(`${count}`);
    }, [fromBalanceWallet]);

    const swapTokens = useCallback(() => {
        setFromToken(toToken);
        setToToken(fromToken);
        setFromAmount(toAmount);
        setToAmount(fromAmount);
    }, [fromToken, toToken, fromAmount, toAmount]);

    const handleSwapLimitPriceChange = (value) => {
        setSwapLimitPrice(value.price);
        setSwapLimitToAmount(value.amount);
    }

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-[400px] w-full mx-auto bg-card backdrop-blur-xl rounded-3xl p-6 border-1 border-card shadow-2xl mt-10"
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold">Swap</h3>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowSettings(true)}
                            className="rounded-full"
                            disabled={!address}
                        >
                            <SlidersHorizontal className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* From Section */}
                <div className="bg-white/5 rounded-2xl p-4 mb-2">
                    <div className="flex justify-between items-center mb-2">
                        <Label className="text-sm text-muted-foreground">From</Label>
                        <div className="flex gap-2">
                            {[0.25, 0.5, 0.75, 1].map((val) => (
                                <button
                                    key={val}
                                    onClick={() => handleMax(val)}
                                    className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded hover:bg-blue-500/30 transition-colors"
                                    disabled={!address}
                                >
                                    {val === 1 ? 'Max' : `${val * 100}%`}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <Input
                            type="number"
                            placeholder="0.0"
                            value={fromAmount}
                            onChange={(e) => setFromAmount(e.target.value)}
                            className="md:text-2xl text-2xl font-semibold border-0 bg-transparent p-0 focus-visible:ring-0 shadow-none"
                            disabled={!address}
                        />
                        <TokenSelect
                            selected={fromToken}
                            onChange={(token) => {
                                if (token.address === toToken.address) {
                                    setToToken(fromToken);
                                    setFromToken(token);
                                    setFromAmount("");
                                    setToAmount("");
                                } else {
                                    setFromToken(token);
                                }
                            }}
                            disabled={!address}
                            selectedAddress={address}
                        />
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                        Balance: {formatBalance(fromBalanceWallet)} {fromToken?.symbol}
                    </div>
                </div>

                {/* Swap Arrow */}
                <div className="flex justify-center my-2">
                    <button
                        onClick={swapTokens}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors border-1 border-black/90"
                        disabled={!address}
                    >
                        <ArrowDownUp className="w-4 h-4" />
                    </button>
                </div>

                {/* To Section */}
                <div className="bg-white/5 rounded-2xl p-4 mb-4">
                    <Label className="text-sm text-muted-foreground">To</Label>
                    <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                            {quoteLoading && fromAmount && parseFloat(fromAmount) > 0 ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-10 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                            ) : (
                                <Input
                                    type="text"
                                    placeholder="0.0"
                                    value={toAmount}
                                    readOnly
                                    className="md:text-2xl text-2xl font-semibold border-0 bg-transparent p-0 focus-visible:ring-0 shadow-none"
                                />
                            )}
                        </div>

                        <TokenSelect
                            selected={toToken}
                            onChange={(token) => {
                                if (token.address === fromToken.address) {
                                    setFromToken(toToken);
                                    setToToken(token);
                                    setToAmount("");
                                    setFromAmount("");
                                } else {
                                    setToToken(token);
                                }
                            }}
                            disabled={!address || quoteLoading}
                            selectedAddress={address}
                        />
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                        Balance: {formatBalance(toBalanceWallet)} {toToken?.symbol}
                    </div>
                </div>

                {/* Exchange Rate */}
                {quoteLoading && fromAmount && parseFloat(fromAmount) > 0 ? (
                    <div className="flex justify-between text-xs text-muted-foreground mb-4">
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-3 w-36" />
                    </div>
                ) : exchangeRate > 0 ? (
                    <div className="flex justify-between text-xs text-muted-foreground mb-4">
                        <span>Price</span>
                        <span>
                            1 {fromToken?.symbol} = {exchangeRate.toFixed(6)} {toToken?.symbol}
                        </span>
                    </div>
                ) : null}

                {/* 🎯 PERUBAHAN PENTING: Tampilkan informasi remaining permission */}
                {selectedSwapType === 'immediately' && parseFloat(fromAmount) > 0 && address && (
                    <div className="mb-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-blue-300 text-xs">Available Permission:</span>
                            {loadingRemainingPermission ? (
                                <Loader2 className="w-4 h-4 animate-spin text-blue-300" />
                            ) : (
                                <span className={`font-semibold text-xs ${parseFloat(fromAmount) > parseFloat(remainingPermissionAmount) ? 'text-red-400' : 'text-green-400'}`}>
                                    {remainingPermissionAmount} {fromToken?.symbol}
                                </span>
                            )}
                        </div>
                        {parseFloat(fromAmount) > parseFloat(remainingPermissionAmount) && (
                            <div className="mt-2 text-xs text-yellow-300">
                                Insufficient permission. You need to grant additional permissions to swap.
                            </div>
                        )}
                    </div>
                )}

                {/* Transaction Details */}
                <AnimatePresence>
                    {Object.keys(quoteData).length > 0 && parseFloat(fromAmount) > 0 && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-white/5 rounded-2xl p-4 mb-4 border-1 border-blue-400"
                        >
                            <h3 className="text-[13px] font-bold text-muted-foreground mb-3">
                                When will the swap execute?
                            </h3>
                            <div>
                                <RadioGroup defaultValue={selectedSwapType} onValueChange={handleSwapTypeChange}>
                                    <div className="flex items-center gap-3">
                                        <RadioGroupItem value="immediately" id="r1" />
                                        <Label htmlFor="r1" className="text-xs text-muted-foreground">
                                            Swap immediately
                                        </Label>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <RadioGroupItem value="scheduled" id="r2" />
                                        <Label htmlFor="r2" className="text-xs text-muted-foreground">
                                            At scheduled time
                                        </Label>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <RadioGroupItem value="price" id="r3" />
                                        <Label htmlFor="r3" className="text-xs text-muted-foreground">
                                            When price target is reached
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>
                        </motion.div>
                    )}

                    {Object.keys(quoteData).length > 0 && parseFloat(fromAmount) > 0 && selectedSwapType === 'scheduled' && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-white/5 rounded-2xl p-4 mb-4"
                        >
                            <h3 className="text-[12px] font-bold text-muted-foreground mb-3">
                                Select time
                            </h3>
                            <DateTimePicker value={dateScheduled} onChange={setDateScheduled} />
                            <h3 className="text-[12px] font-bold text-muted-foreground my-3">
                                Remaining time
                            </h3>

                            {dateScheduled <= new Date() ? (
                                <Alert variant="destructive">
                                    <AlertTitle className="text-xs font-bold">Attention!</AlertTitle>
                                    <AlertDescription className="text-xs">
                                        The selected time is either the current time or has already passed. The swap will be executed immediately.
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <Button className="w-full text-xs bg-card hover:bg-card text-white">
                                    <CooldownTime dateScheduled={dateScheduled} />
                                </Button>
                            )}

                        </motion.div>
                    )}

                    {Object.keys(quoteData).length > 0 && parseFloat(fromAmount) > 0 && selectedSwapType === 'price' && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-background rounded-2xl p-4 mb-4"
                        >
                            <SwapLimitPrice
                                fromAmount={fromAmount}
                                toToken={toToken}
                                exchangeRate={exchangeRate}
                                onChange={handleSwapLimitPriceChange}
                            />

                            <h3 className="text-[12px] font-bold text-muted-foreground my-3">
                                You will get:
                            </h3>
                            <div
                                className={`text-2xl text-center font-bold my-3 p-4 bg-card border ${swapLimitToAmount < toAmount ? "text-red-500" : "text-green-700"
                                    }`}
                            >
                                {swapLimitToAmount} {toToken.symbol}
                            </div>

                            <Alert variant="default" className="bg-card border-0">
                                <AlertTitle className="text-xs font-bold"></AlertTitle>
                                <AlertDescription className="text-xs">
                                    The {fromToken.symbol} to {toToken.symbol} swap will execute once your limit price reached giving you <span className="font-bold">{swapLimitToAmount}</span> {toToken.symbol}.
                                </AlertDescription>
                            </Alert>

                            <h3 className="text-[12px] font-bold text-muted-foreground my-3">
                                Expired in
                            </h3>
                            <div className="grid grid-cols-3 gap-2 w-full">
                                {LIMIT_OPTIONS.map((option) => (
                                    <Button
                                        key={option.label}
                                        variant="outline"
                                        onClick={() => handleSelectLimitOption(option)}
                                        className={cn(
                                            "relative h-7 text-xs",
                                            selectedLimitOption === option.label
                                                ? "bg-gray-800 text-white"
                                                : "bg-background"
                                        )}
                                    >
                                        {option.label}
                                        {selectedLimitOption === option.label && (
                                            <Check className="absolute top-1 right-1 h-4 w-4 text-green-500" />
                                        )}
                                    </Button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {Object.keys(quoteData).length > 0 && parseFloat(fromAmount) > 0 && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-white/5 rounded-2xl p-4 mb-4"
                        >
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Minimum received</span>
                                    {selectedSwapType != 'price' && (
                                        <span>{quoteData?.min_output_formatted || 0} {toToken?.symbol}</span>
                                    )}
                                    {selectedSwapType == 'price' && (
                                        <span>N/A</span>
                                    )}
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Slippage tolerance</span>
                                    <span>{settings.slippage}%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Network fee</span>
                                    <span><Badge variant="secondary" className="text-[10px] bg-blue-500 text-white dark:bg-green-800">Free</Badge></span>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {Object.keys(quoteData).length > 0 && parseFloat(fromAmount) > 0 && selectedSwapType === 'scheduled' && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-white/5 rounded-2xl p-4 mb-4"
                        >
                            <Alert variant="default">
                                <AlertDescription className="text-xs">
                                    The minimum amount you will receive is <span className="font-bold text-yellow-300">{quoteData?.min_output_formatted || 0}</span>. If the swap results in an amount below this, the swap will be canceled. Adjust the slippage to change the minimum amount of tokens you will receive.
                                </AlertDescription>
                            </Alert>
                        </motion.div>
                    )}

                </AnimatePresence>

                {/* 🎯 PERUBAHAN PENTING: Logika tombol yang diperbarui */}
                {/* Tombol Grant Advanced Permissions - hanya tampil jika shouldShowGrantButton true */}
                {shouldShowGrantButton && (
                    <Button
                        onClick={sendPermissionsToBackend}
                        className="w-full py-3 rounded-xl text-md font-semibold transition-all bg-green-800 hover:bg-green-600 text-white mb-2"
                        disabled={permissionLoading}
                    >
                        {permissionLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Granting Permissions...
                            </>
                        ) : (
                            "Grant Permissions"
                        )}
                    </Button>
                )}

                {/* Tombol utama swap - dengan logika yang diperbarui */}
                <Button
                    onClick={handleSwap}
                    disabled={swapDisabled}
                    className={cn(
                        "w-full py-3 rounded-xl text-md font-semibold transition-all text-foreground",
                        swapDisabled
                            ? "bg-gray-600 cursor-not-allowed"
                            : "bg-blue-900 hover:bg-blue-600"
                    )}
                >
                    <span className="w-full flex items-center justify-center gap-2">
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {selectedSwapType === 'immediately' ? 'Swapping...' : 'Processing...'}
                            </>
                        ) : permissionLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Granting Permissions...
                            </>
                        ) : !isConnected ? (
                            // 1. Belum connect wallet
                            "Connect Wallet"
                        ) : !loggedIn ? (
                            // 2. Sudah connect tapi BELUM Sign In -> PRIORITAS
                            "Sign In to Swap"
                        ) : !isSmartAccount ? (
                            // 3. Smart Account belum diupgrade
                            "Upgrade Smart Account"
                        ) : !fromAmount || swapDisabled ? (
                            // 4. Setelah login → baru boleh cek amount
                            "Enter an amount"
                        ) : parseFloat(fromAmount) > parseFloat(fromBalanceWallet) ? (
                            // 5. Cek balance
                            "Insufficient Balance"
                        ) : selectedSwapType === 'immediately' && parseFloat(fromAmount) > parseFloat(remainingPermissionAmount) ? (
                            // 6. Untuk immediately dengan insufficient permission, tombol akan disable
                            "Insufficient Permission"
                        ) : (
                            // 7. Siap swap
                            selectedSwapType === 'immediately' ? "Confirm Swap" : "Confirm Permission & Swap"
                        )}
                    </span>
                </Button>

                {/* Settings Modal */}
                <SettingsModal
                    open={showSettings}
                    onOpenChange={setShowSettings}
                    settings={settings}
                    onSettingsChange={setSettings}
                />
            </motion.div>

            {/* Success Popup */}
            <SuccessPopup
                open={showSuccessPopup}
                onOpenChange={setShowSuccessPopup}
                txHash={successTxData.txHash}
                fromToken={successTxData.fromToken}
                toToken={successTxData.toToken}
                fromAmount={successTxData.fromAmount}
                toAmount={successTxData.toAmount}
                tipeSwap={selectedSwapType}
                limitPrice={swapLimitToAmount}
            />

            {/* Swap Confirmation Popup */}
            <SwapConfirmationPopup
                open={showConfirmationPopup}
                onOpenChange={setShowConfirmationPopup}
                onConfirm={executeSwap}
                swapType={selectedSwapType}
                fromToken={fromToken}
                toToken={toToken}
                fromAmount={fromAmount}
                toAmount={toAmount}
                dateScheduled={dateScheduled}
                limitPrice={swapLimitToAmount}
                isLoading={loading}
                isPermissionLoading={permissionLoading}
            />

            {/* Task Queued Popup */}
            <TaskQueuedPopup
                open={showTaskQueuedPopup}
                onOpenChange={setShowTaskQueuedPopup}
                swapType={taskQueuedData.swapType}
                fromToken={taskQueuedData.fromToken}
                toToken={taskQueuedData.toToken}
                fromAmount={taskQueuedData.fromAmount}
                toAmount={taskQueuedData.toAmount}
                dateScheduled={taskQueuedData.dateScheduled}
                limitPrice={taskQueuedData.limitPrice}
                exchangeRate={exchangeRate}
            />

            {/* Error Popup */}
            <PopUpError
                open={showErrorPopup}
                onOpenChange={setShowErrorPopup}
                title={errorData.title}
                description={errorData.description}
            />
        </>
    );
}