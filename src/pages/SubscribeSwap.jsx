import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge";
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
import { useAuth } from "@/context/AuthContext";
import { tokens } from "@/config/tokens";
import { createAdvancedPermissions, isSmartAccountUpgraded } from "@/hooks/useAdvancedPermissions";

// Frequency Options for Auto-Swap
const FREQUENCY_OPTIONS = [
    { label: "Hourly", value: "hourly", description: "Every hour" },
    { label: "Daily", value: "daily", description: "Every day" },
    { label: "Weekly", value: "weekly", description: "Every week" },
    { label: "Biweekly", value: "biweekly", description: "Every 2 weeks" },
    { label: "Monthly", value: "monthly", description: "Every month" },
    { label: "Yearly", value: "yearly", description: "Every year" }
];

// Duration Options (removed indefinite, added 3 years)
const DURATION_OPTIONS = [
    { label: "1 Day", value: "1day", days: 1 },
    { label: "1 Week", value: "1week", days: 7 },
    { label: "2 Weeks", value: "2weeks", days: 14 },
    { label: "1 Month", value: "1month", days: 30 },
    { label: "3 Months", value: "3months", days: 90 },
    { label: "6 Months", value: "6months", days: 180 },
    { label: "1 Year", value: "1year", days: 365 },
    { label: "3 Years", value: "3years", days: 1095 }
];

// 🎯 NEW: Error Popup Component
function PopUpError({ open, onOpenChange, title, description, actionButton }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-card backdrop-blur-md border border-white/10 p-0 gap-0">
                <div className="p-6">
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

// 🎯 NEW: Success Popup Component
function SuccessPopup({ open, onOpenChange, subscriptionData }) {
    // Jika tidak ada data, jangan render apa-apa
    if (!subscriptionData) return null;

    const getFrequencyText = (frequency) => {
        const freq = FREQUENCY_OPTIONS.find(f => f.value === frequency);
        return freq?.label || frequency;
    };

    const getDurationText = (duration) => {
        const durationOpt = DURATION_OPTIONS.find(d => d.value === duration);
        return durationOpt?.label || duration;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-card backdrop-blur-md border border-white/10 p-0 gap-0">
                <div className="p-6">
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

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-center mb-6"
                    >
                        <h2 className="text-2xl font-bold mb-2">Subscription Created!</h2>
                        <p className="text-muted-foreground text-sm">
                            Your auto-buy subscription has been successfully set up
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white/5 rounded-xl p-4 mb-4"
                    >
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Frequency:</span>
                                <span className="font-semibold">{getFrequencyText(subscriptionData.frequency)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Duration:</span>
                                <span className="font-semibold">{getDurationText(subscriptionData.duration)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Each Purchase:</span>
                                <span className="font-semibold">
                                    {subscriptionData.amount} {subscriptionData.fromToken?.symbol} → {subscriptionData.toToken?.symbol}
                                </span>
                            </div>
                            {/* Tambahkan kondisi untuk menampilkan hanya jika data ada */}
                            {subscriptionData.nextExecution && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Next Execution:</span>
                                    <span className="font-semibold">{subscriptionData.nextExecution}</span>
                                </div>
                            )}
                            {subscriptionData.totalExecutions && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total Executions:</span>
                                    <span className="font-semibold">{subscriptionData.totalExecutions}</span>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <Button
                            onClick={() => {
                                onOpenChange(false);
                            }}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                            Create Another Subscription
                        </Button>
                    </motion.div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// 🎯 NEW: Subscription Confirmation Popup Component
function SubscriptionConfirmationPopup({
    open,
    onOpenChange,
    onConfirm,
    fromToken,
    toToken,
    fromAmount,
    selectedFrequency,
    selectedDuration,
    subscriptionSummary,
    isLoading,
    isPermissionLoading
}) {
    const getSubscriptionDescription = () => {
        const getFrequencyText = (frequency) => {
            switch (frequency) {
                case "hourly":
                    return "hourly";
                case "daily":
                    return "daily";
                case "weekly":
                    return "weekly";
                case "biweekly":
                    return "biweekly";
                case "monthly":
                    return "monthly";
                case "yearly":
                    return "yearly";
                default:
                    return frequency;
            }
        };

        const getDurationText = (duration) => {
            const durationOpt = DURATION_OPTIONS.find(d => d.value === duration);
            return durationOpt?.label || duration;
        };

        return `Auto-buy ${toToken?.symbol} with ${fromAmount} ${fromToken?.symbol} ${getFrequencyText(selectedFrequency)} for ${getDurationText(selectedDuration)}.`;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-card backdrop-blur-md border border-white/10 p-0 gap-0">
                <div className="p-6">
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold mb-2">Subscription Confirmation</h2>
                    </div>

                    {(isLoading || isPermissionLoading) && (
                        <div className="mb-4 flex flex-col items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                            <span className="mt-2 text-sm text-muted-foreground">
                                {isPermissionLoading
                                    ? "Creating permissions..."
                                    : "Creating subscription..."}
                            </span>
                        </div>
                    )}

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
                                <span className="font-semibold">{toToken?.symbol}</span>
                            </div>
                        </div>

                        <div className="space-y-2 text-sm mt-3">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Frequency:</span>
                                <span className="font-medium">
                                    {FREQUENCY_OPTIONS.find(f => f.value === selectedFrequency)?.label}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Duration:</span>
                                <span className="font-medium">
                                    {DURATION_OPTIONS.find(d => d.value === selectedDuration)?.label}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Executions:</span>
                                <span className="font-medium">
                                    {subscriptionSummary?.totalExecutions || 1}
                                </span>
                            </div>
                            {subscriptionSummary?.nextExecutionDisplay && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Next Execution:</span>
                                    <span className="font-medium">{subscriptionSummary.nextExecutionDisplay}</span>
                                </div>
                            )}
                        </div>

                        <div className="mt-3 p-3 bg-blue-500/10 rounded-lg">
                            <p className="text-sm text-blue-300">{getSubscriptionDescription()}</p>
                        </div>
                    </div>

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
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            disabled={isLoading || isPermissionLoading}
                        >
                            {isPermissionLoading
                                ? "Creating Permissions..."
                                : isLoading
                                    ? "Creating..."
                                    : "Confirm & Create Subscription"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Reusable Token Select Component (Enhanced with balances)
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

    useEffect(() => {
        const fetchTokenBalances = async () => {
            if (!open || !selectedAddress) {
                setTokensWithBalance(tokens.map(token => ({ ...token, balance: "0", balanceFormatted: "0" })));
                return;
            }

            setLoadingBalances(true);
            try {
                const allBalances = await getBalancesAllToken(selectedAddress);

                const enrichedTokens = tokens.map(token => {
                    const balanceData = allBalances.find(b =>
                        b.address.toLowerCase() === token.address.toLowerCase()
                    );

                    return {
                        ...token,
                        balance: balanceData?.balance || "0",
                        balanceFormatted: balanceData ? formatBalance(balanceData.balance) : "0"
                    };
                });

                const sortedTokens = [...enrichedTokens].sort((a, b) => {
                    const balanceA = parseFloat(a.balance);
                    const balanceB = parseFloat(b.balance);

                    if (balanceA > 0 && balanceB > 0) {
                        return balanceB - balanceA;
                    } else if (balanceA > 0) {
                        return -1;
                    } else if (balanceB > 0) {
                        return 1;
                    } else {
                        return tokens.indexOf(a) - tokens.indexOf(b);
                    }
                });

                setTokensWithBalance(sortedTokens);
            } catch (error) {
                console.error("Failed to fetch token balances:", error);
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

// Settings Modal Component
function SettingsModal({ open, onOpenChange, settings, onSettingsChange }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-90 bg-card backdrop-blur-md border border-white/10">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Swap Settings</h3>
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

// Main SubscribeSwap Component
export default function SubscribeSwap() {
    const defaultFromTo = useMemo(() => {
        const usdtToken = tokens.find(token => token.symbol === 'MON') || tokens.find(token => token.symbol === 'MON') || tokens[0];
        const ethToken = tokens.find(token => token.symbol === 'USDC') || tokens[1];
        return [usdtToken, ethToken];
    }, []);

    const [fromToken, setFromToken] = useState(defaultFromTo[0]);
    const [toToken, setToToken] = useState(defaultFromTo[1]);
    const [fromAmount, setFromAmount] = useState("");
    const [fromBalanceWallet, setFromBalance] = useState("0");
    const [toBalanceWallet, setToBalance] = useState("0");

    // 🎯 PERUBAHAN: Hapus state untuk permission checking
    const [isSmartAccount, setIsSmartAccount] = useState(false);

    const [selectedFrequency, setSelectedFrequency] = useState("weekly");
    const [selectedDuration, setSelectedDuration] = useState("1month");

    // Removed customInterval state

    const [settings, setSettings] = useState({
        slippage: 2,
        deadline: 5
    });
    const [loading, setLoading] = useState(false);
    const [permissionLoading, setPermissionLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // 🎯 NEW: Popup states
    const [showConfirmationPopup, setShowConfirmationPopup] = useState(false);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [showErrorPopup, setShowErrorPopup] = useState(false);
    const [errorData, setErrorData] = useState({ title: "", description: "" });
    
    // 🎯 NEW: State untuk menyimpan data sukses sebelum reset
    const [successData, setSuccessData] = useState(null);

    const { address, isConnected } = useAccount();
    const { postSubscribeDelegationData, getSessionAccountAddress, loggedIn } = useAuth();

    const [durationError, setDurationError] = useState("");

    const subscriptionSummary = useMemo(() => {
        if (!fromAmount || parseFloat(fromAmount) <= 0) return null;

        const amountPerSwap = parseFloat(fromAmount);

        // Calculate frequency in seconds (sama seperti di createPermissionsForSubscription)
        let frequencyInSeconds = 0;
        switch (selectedFrequency) {
            case "hourly":
                frequencyInSeconds = 3600;
                break;
            case "daily":
                frequencyInSeconds = 86400;
                break;
            case "weekly":
                frequencyInSeconds = 604800;
                break;
            case "biweekly":
                frequencyInSeconds = 1209600;
                break;
            case "monthly":
                frequencyInSeconds = 2592000;
                break;
            case "yearly":
                frequencyInSeconds = 31536000;
                break;
            default:
                frequencyInSeconds = 604800;
        }

        // Calculate total duration in seconds
        let totalDurationInSeconds = 0;
        const durationOption = DURATION_OPTIONS.find(d => d.value === selectedDuration);

        if (durationOption) {
            totalDurationInSeconds = 86400 * durationOption.days;
        }

        // Validasi: frequency tidak boleh lebih besar dari total duration
        if (frequencyInSeconds > totalDurationInSeconds) {
            setDurationError(`Frequency interval (${selectedFrequency}) cannot be longer than total duration (${durationOption?.label}). Please select a shorter frequency or longer duration.`);
        } else {
            setDurationError("");
        }

        // Hitung total eksekusi
        let totalExecutions = 0;
        if (frequencyInSeconds > 0 && totalDurationInSeconds > 0) {
            totalExecutions = Math.floor(totalDurationInSeconds / frequencyInSeconds);
            totalExecutions = Math.max(1, totalExecutions);
        } else {
            totalExecutions = 1;
        }

        const totalInvestment = amountPerSwap * totalExecutions;

        const calculateNextExecution = () => {
            const now = new Date();
            let nextDate = new Date(now);

            switch (selectedFrequency) {
                case "hourly":
                    nextDate.setHours(nextDate.getHours() + 1);
                    break;
                case "daily":
                    nextDate.setDate(nextDate.getDate() + 1);
                    break;
                case "weekly":
                    nextDate.setDate(nextDate.getDate() + 7);
                    break;
                case "biweekly":
                    nextDate.setDate(nextDate.getDate() + 14);
                    break;
                case "monthly":
                    nextDate.setMonth(nextDate.getMonth() + 1);
                    break;
                case "yearly":
                    nextDate.setFullYear(nextDate.getFullYear() + 1);
                    break;
                default:
                    nextDate.setDate(nextDate.getDate() + 7);
        }

            return {
                timestamp: Math.floor(nextDate.getTime() / 1000),
                display: nextDate.toLocaleString()
            };
        };

        const nextExecution = calculateNextExecution();

        return {
            totalExecutions,
            totalInvestment,
            nextExecutionTimestamp: nextExecution.timestamp,
            nextExecutionDisplay: nextExecution.display,
            amountPerSwap,
            frequencyInSeconds,
            totalDurationInSeconds
        };
    }, [fromAmount, selectedFrequency, selectedDuration]);

    // 🎯 PERUBAHAN: Check smart account status saja
    const getSmartAccountStatus = async () => {
        try {
            const stats = await isSmartAccountUpgraded();
            setIsSmartAccount(!!stats);
        } catch (error) {
            console.error("Error checking smart account status:", error);
            setIsSmartAccount(false);
        }
    };

    // 🎯 PERUBAHAN: Create permissions for subscription (tetap dipakai saat konfirmasi)
    const createPermissionsForSubscription = async () => {
        try {
            const sessionAccountAddress = await getSessionAccountAddress();
            const token = fromToken;
            const amount = fromAmount;
            const justification = `Permission for subscription to buy ${toToken.symbol} with ${amount} ${token.symbol} ${selectedFrequency}`;

            // Calculate frequency interval in seconds based on selectedFrequency
            let frequencyInSeconds = 0;
            switch (selectedFrequency) {
                case "hourly":
                    frequencyInSeconds = 3600; // 1 hour in seconds
                    break;
                case "daily":
                    frequencyInSeconds = 86400; // 1 day in seconds
                    break;
                case "weekly":
                    frequencyInSeconds = 604800; // 7 days in seconds
                    break;
                case "biweekly":
                    frequencyInSeconds = 1209600; // 14 days in seconds
                    break;
                case "monthly":
                    frequencyInSeconds = 2592000; // 30 days in seconds
                    break;
                case "yearly":
                    frequencyInSeconds = 31536000; // 365 days in seconds
                    break;
                default:
                    frequencyInSeconds = 604800; // default to weekly
            }

            // Calculate total duration in seconds based on selectedDuration
            let totalDurationInSeconds = 0;
            const durationOption = DURATION_OPTIONS.find(d => d.value === selectedDuration);

            if (durationOption && durationOption.days) {
                totalDurationInSeconds = 86400 * durationOption.days; // Convert days to seconds
                console.log(`Setting total duration to: ${durationOption.days} days (${totalDurationInSeconds} seconds)`);
            } else {
                console.warn(`Duration option not found for: ${selectedDuration}, using 30 days as default`);
                totalDurationInSeconds = 86400 * 30;
            }

            const startTime = Math.floor(Date.now() / 1000);
            const expired = startTime + totalDurationInSeconds + 600; // add 10 second expired

            console.log(`Creating permission with frequency: ${selectedFrequency} (${frequencyInSeconds} seconds)`);
            console.log(`Total duration: ${totalDurationInSeconds} seconds (${durationOption?.days || 30} days)`);
            console.log(`Start time: ${startTime}, Expired: ${expired}`);
            console.log(`Selected frequency: ${selectedFrequency}, Selected duration: ${selectedDuration}`);

            const permissions = await createAdvancedPermissions(
                token,
                sessionAccountAddress.address,
                amount,
                frequencyInSeconds, // Parameter ke-4 adalah frequency (interval)
                startTime,
                expired, 
                justification,
                false // isAdjustment: false for subscription
            );

            console.log("Granted Permissions for subscription:", permissions);
            return {
                permissions,
                expired,
                frequencyInSeconds,
                startTime
            };

        } catch (error) {
            console.error("Error creating permissions for subscription:", error);
            return null;
        }
    };

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

    useEffect(() => {
        getSmartAccountStatus();
        fetchBalances();
    }, [fromToken, toToken, address, isConnected, fromAmount]);

    // 🎯 PERUBAHAN: Create subscription delegation dengan permissions
    const createSubscriptionDelegation = async (permissions) => {
        if (!address) return null;

        try {
            const subscriptionData = {
                frequency: selectedFrequency,
                frequency_in_second: permissions.frequencyInSeconds,
                duration: selectedDuration,
                duration_in_second: permissions.expired,
                amount: fromAmount,
                paymentToken: fromToken,
                targetToken: toToken,
                settings: settings,
                nextExecution: subscriptionSummary?.nextExecutionDisplay,
                nextExecutionTimestamp: subscriptionSummary?.nextExecutionTimestamp,
                totalExecutions: subscriptionSummary?.totalExecutions,
                permission: permissions.permissions
            };

            console.log("Creating subscription with data:", {
                frequency: selectedFrequency,
                duration: selectedDuration,
                permissionDuration: permissions?.duration // Jika ada dalam permissions
            });

            const res = await postSubscribeDelegationData({
                owner_address: address,
                ...subscriptionData
            });

            return res;

        } catch (error) {
            console.error("Subscription creation failed:", error);
            throw error;
        }
    };

    // 🎯 PERUBAHAN: Main execution function - langsung buat permission saat konfirmasi
    const executeSubscription = useCallback(async () => {
        if (!address) return;

        setPermissionLoading(true);
        setShowConfirmationPopup(false);

        try {
            // 1. Langsung buat permission
            const permissions = await createPermissionsForSubscription();
            if (!permissions) {
                throw new Error("Failed to create permissions for subscription.");
            }

            setPermissionLoading(false);
            setLoading(true);

            // 2. Buat subscription delegation dengan permissions
            const result = await createSubscriptionDelegation(permissions);

            if (result && result.status === 'ok') {
                // 🎯 PERUBAHAN: Simpan data sukses SEBELUM reset
                const successData = {
                    frequency: selectedFrequency,
                    duration: selectedDuration,
                    fromToken: fromToken,
                    toToken: toToken,
                    amount: fromAmount,
                    nextExecution: subscriptionSummary?.nextExecutionDisplay,
                    totalExecutions: subscriptionSummary?.totalExecutions
                };
                
                // Set success data ke state
                setSuccessData(successData);
                
                // Show success popup
                setShowSuccessPopup(true);
                
                // Reset form
                resetAfterSubscription();
            } else if (result && result.message === 'duplicate_pair') {
                setErrorData({
                    title: "Duplicate Token Pair",
                    description: result.error || `You already have an active subscription with the token pair ${fromToken.symbol} ↔ ${toToken.symbol}. Please choose a different token pair.`
                });
                setShowErrorPopup(true);
            } else if (result && result.message === 'limit') {
                setErrorData({
                    title: "Subscription Limit Reached",
                    description: result.error || "You have reached the maximum limit of 5 active subscriptions per address."
                });
                setShowErrorPopup(true);
            } else {
                setErrorData({
                    title: "Subscription Failed",
                    description: result?.error || result?.message || "Unable to create subscription. Please try again."
                });
                setShowErrorPopup(true);
            }
        } catch (error) {
            console.error("Subscription failed:", error);
            setErrorData({
                title: "Subscription Failed",
                description: error.message || "Failed to create subscription. Please try again."
            });
            setShowErrorPopup(true);
        } finally {
            setLoading(false);
            setPermissionLoading(false);
        }
    }, [
        selectedFrequency,
        selectedDuration,
        fromToken,
        toToken,
        fromAmount,
        settings,
        subscriptionSummary,
        address,
        postSubscribeDelegationData,
        getSessionAccountAddress
    ]);

    const resetAfterSubscription = () => {
        setFromAmount("");
    };

    const handleMax = useCallback((val) => {
        const count = parseFloat(fromBalanceWallet) * val;
        setFromAmount(`${count}`);
    }, [fromBalanceWallet]);

    const swapTokens = useCallback(() => {
        setFromToken(toToken);
        setToToken(fromToken);
        setFromAmount("");
    }, [fromToken, toToken]);

    // 🎯 PERUBAHAN: Check if subscription is disabled - HAPUS pengecekan permission dan saldo
    const subscribeDisabled = useMemo(() => {
        if (!isSmartAccount) return true;
        if (!loggedIn) return true;
        if (!isConnected) return true;
        if (!fromAmount || parseFloat(fromAmount) <= 0) return true;
        if (!address) return true;
        if (loading || permissionLoading) return true;
        if (durationError) return true;

        if (fromToken?.address === toToken?.address) {
            return true;
        }

        return false;
    }, [isSmartAccount, loggedIn, isConnected, fromAmount, address, loading, permissionLoading, durationError, fromToken, toToken]);

    // 🎯 PERUBAHAN: Handle subscription confirmation
    const handleSubscribe = useCallback(() => {
        if (subscribeDisabled) return;
        setShowConfirmationPopup(true);
    }, [subscribeDisabled]);

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-[400px] w-full mx-auto bg-card backdrop-blur-xl rounded-3xl p-6 border-1 border-card shadow-2xl mt-10"
            >
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-md font-semibold">Subscription</h3>
                    </div>
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

                <div className="bg-white/5 rounded-2xl p-4 mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <Label className="text-sm text-muted-foreground">Pay With</Label>
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
                            onChange={setFromToken}
                            disabled={!address}
                            selectedAddress={address}
                        />
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                        Balance: {formatBalance(fromBalanceWallet)} {fromToken?.symbol}
                    </div>
                </div>

                <div className="flex justify-center my-2">
                    <button
                        onClick={swapTokens}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors border-1 border-black/90"
                        disabled={!address}
                    >
                        <ArrowDownUp className="w-4 h-4" />
                    </button>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 mb-4">
                    <Label className="text-sm text-muted-foreground">Auto-Buy</Label>
                    <div className="flex items-center justify-between">
                        <div className="md:text-2xl text-2xl font-semibold border-0 bg-transparent p-0">
                            {toToken?.symbol}
                        </div>
                        <TokenSelect
                            selected={toToken}
                            onChange={setToToken}
                            disabled={!address}
                            selectedAddress={address}
                        />
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                        {address
                            ? `You will receive ${toToken?.symbol} based on market price at execution time`
                            : "Connect wallet to configure auto-buy"
                        }
                    </div>
                </div>

                {/* 🎯 PERUBAHAN: HAPUS tampilan informasi permission */}
                {fromToken?.address === toToken?.address && (
                    <Alert className="mt-2 bg-yellow-500/10 border-yellow-500/20 mb-4">
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                        <AlertTitle className="text-yellow-500 text-sm font-medium">Invalid Token Pair</AlertTitle>
                        <AlertDescription className="text-yellow-400 text-xs">
                            Payment token and target token cannot be the same.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="bg-white/5 rounded-2xl p-4 mb-4">
                    <h3 className="text-sm font-semibold mb-3">Subscription Settings</h3>

                    <div className="mb-4">
                        <Label className="text-xs text-muted-foreground mb-2 block">Frequency</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {FREQUENCY_OPTIONS.map((option) => (
                                <Button
                                    key={option.value}
                                    variant={selectedFrequency === option.value ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setSelectedFrequency(option.value)}
                                    className="text-xs h-8"
                                    disabled={!address}
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <Label className="text-xs text-muted-foreground mb-2 block">Duration</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {DURATION_OPTIONS.map((option) => (
                                <Button
                                    key={option.value}
                                    variant={selectedDuration === option.value ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setSelectedDuration(option.value)}
                                    className="text-xs h-8"
                                    disabled={!address}
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {durationError && (
                        <Alert className="mt-4 bg-red-500/10 border-red-500/20">
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            <AlertTitle className="text-red-500 text-sm font-medium">Invalid Duration</AlertTitle>
                            <AlertDescription className="text-red-400 text-xs">
                                {durationError}
                            </AlertDescription>
                        </Alert>
                    )}
                </div>

                {subscriptionSummary && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className="bg-blue-500/10 rounded-2xl p-4 mb-4 border border-blue-500/20"
                    >
                        <h3 className="text-sm font-semibold mb-2 text-blue-300">Subscription Summary</h3>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Each purchase:</span>
                                <span>{fromAmount} {fromToken?.symbol} → {toToken?.symbol}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Frequency:</span>
                                <span>
                                    {FREQUENCY_OPTIONS.find(f => f.value === selectedFrequency)?.label}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Duration:</span>
                                <span>{DURATION_OPTIONS.find(d => d.value === selectedDuration)?.label}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Next execution:</span>
                                <span>{subscriptionSummary.nextExecutionDisplay}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Total executions:</span>
                                <span>
                                    {subscriptionSummary.totalExecutions}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Total investment:</span>
                                <span className="font-semibold">
                                    {`${subscriptionSummary.totalInvestment.toFixed(2)} ${fromToken?.symbol}`}
                                </span>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* 🎯 PERUBAHAN: HAPUS tombol Grant Permissions terpisah */}
                <Button
                    onClick={handleSubscribe}
                    disabled={subscribeDisabled}
                    className={cn(
                        "w-full py-3 rounded-xl text-md font-semibold transition-all text-foreground",
                        subscribeDisabled
                            ? "bg-gray-600 cursor-not-allowed"
                            : "bg-green-600 hover:bg-green-700"
                    )}
                >
                    <span className="w-full flex items-center justify-center gap-2">
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Creating Subscription...
                            </>
                        ) : permissionLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Creating Permissions...
                            </>
                        ) : !isConnected ? (
                            "Connect Wallet"
                        ) : !loggedIn ? (
                            "Sign In to Subscribe"
                        ) : !isSmartAccount ? (
                            "Upgrade Smart Account"
                        ) : !fromAmount || subscribeDisabled ? (
                            "Enter an amount"
                        ) : (
                            // 🎯 PERUBAHAN: Tombol hanya menampilkan ini
                            "Confirm Permission & Subscribe"
                        )}
                    </span>
                </Button>
            </motion.div>

            <SubscriptionConfirmationPopup
                open={showConfirmationPopup}
                onOpenChange={setShowConfirmationPopup}
                onConfirm={executeSubscription}
                fromToken={fromToken}
                toToken={toToken}
                fromAmount={fromAmount}
                selectedFrequency={selectedFrequency}
                selectedDuration={selectedDuration}
                subscriptionSummary={subscriptionSummary}
                isLoading={loading}
                isPermissionLoading={permissionLoading}
            />

            <SuccessPopup
                open={showSuccessPopup}
                onOpenChange={(open) => {
                    setShowSuccessPopup(open);
                    if (!open) {
                        // Reset success data ketika popup ditutup
                        setSuccessData(null);
                    }
                }}
                subscriptionData={successData}  // Gunakan state successData
            />

            <PopUpError
                open={showErrorPopup}
                onOpenChange={setShowErrorPopup}
                title={errorData.title}
                description={errorData.description}
            />

            <SettingsModal
                open={showSettings}
                onOpenChange={setShowSettings}
                settings={settings}
                onSettingsChange={setSettings}
            />
        </>
    );
}