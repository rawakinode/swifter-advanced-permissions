// src/components/features/MySubscription.jsx
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreVertical, AlertCircle, Unplug, Loader2, X, CheckCircle, XCircle, Calendar, Clock, Repeat, RefreshCcw, Link2, History, ExternalLink } from "lucide-react";
import { useAccount } from "wagmi";
import { useAuth } from "@/context/AuthContext";

// ✅ IMPORT ACCORDION COMPONENTS
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

const statusColor = {
    active: "bg-green-600",
    failed: "bg-red-600",
    canceled: "bg-gray-600",
    completed: "bg-blue-600",
    expired: "bg-orange-600"
};

const frequencyLabels = {
    "1hour": "Every 1 hour",
    "12hours": "Every 12 hours",
    "daily": "Every day",
    "3days": "Every 3 days",
    "weekly": "Every week",
    "biweekly": "Every 2 weeks",
    "monthly": "Every month",
    "custom": "Custom interval"
};

const durationLabels = {
    "1day": "1 Day",
    "1week": "1 Week",
    "2weeks": "2 Weeks",
    "1month": "1 Month",
    "3months": "3 Months",
    "6months": "6 Months",
    "1year": "1 Year",
    "indefinite": "Indefinite"
};

// Items per page
const ITEMS_PER_PAGE = 3;

// Fungsi untuk memformat timestamp
const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    
    // Handle MongoDB ObjectId timestamp or regular timestamp
    let timestampValue;
    if (typeof timestamp === 'object' && timestamp.$date) {
        timestampValue = new Date(timestamp.$date);
    } else if (typeof timestamp === 'object' && timestamp.$numberLong) {
        timestampValue = new Date(parseInt(timestamp.$numberLong));
    } else {
        // Convert seconds to milliseconds if needed
        timestampValue = new Date(timestamp * 1000 || timestamp);
    }
    
    return timestampValue.toLocaleString();
};

// Fungsi untuk menghitung waktu sampai next execution
const calculateTimeUntilNextExecution = (nextExecutionTimestamp) => {
    if (!nextExecutionTimestamp) return "N/A";

    let timestampValue;
    if (typeof nextExecutionTimestamp === 'object' && nextExecutionTimestamp.$date) {
        timestampValue = new Date(nextExecutionTimestamp.$date).getTime() / 1000;
    } else if (typeof nextExecutionTimestamp === 'object' && nextExecutionTimestamp.$numberLong) {
        timestampValue = parseInt(nextExecutionTimestamp.$numberLong);
    } else {
        timestampValue = nextExecutionTimestamp;
    }

    const now = Math.floor(Date.now() / 1000);
    const executeTime = timestampValue;
    const diff = executeTime - now;

    if (diff <= 0) return "Now";

    const days = Math.floor(diff / (24 * 60 * 60));
    const hours = Math.floor((diff % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((diff % (60 * 60)) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
};

// Confirmation Dialog Component
const ConfirmationDialog = ({ isOpen, onClose, onConfirm, subscription, loading }) => {
    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-card rounded-2xl p-6 max-w-md w-full border border-border shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">Cancel Subscription</h3>
                    <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="space-y-4 mb-6">
                    <p className="text-sm text-muted-foreground">
                        Are you sure you want to cancel this subscription? This action cannot be undone.
                    </p>

                    {/* Subscription Data Display */}
                    {subscription && (
                        <Card className="p-3 bg-muted/20">
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between">
                                    <span className="font-semibold">Subscription:</span>
                                    <span>{subscription.from} → {subscription.to}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold">Amount per swap:</span>
                                    <span>{subscription.amount} {subscription.from}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold">Frequency:</span>
                                    <span>{subscription.frequencyLabel}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold">Duration:</span>
                                    <span>{subscription.durationLabel}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold">Executions:</span>
                                    <span>{subscription.executed}/{subscription.totalExecutions === 999 ? "∞" : subscription.totalExecutions}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold">Next execution:</span>
                                    <span>{subscription.nextExecutionTime}</span>
                                </div>
                            </div>
                        </Card>
                    )}
                </div>

                <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Keep Subscription
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={onConfirm}
                        disabled={loading}
                        className="flex items-center gap-2"
                    >
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {loading ? "Cancelling..." : "Cancel Subscription"}
                    </Button>
                </div>
            </motion.div>
        </motion.div>
    );
};

// Result Popup Component
const ResultPopup = ({ isOpen, onClose, isSuccess, message }) => {
    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-card rounded-2xl p-6 max-w-sm w-full border border-border shadow-2xl text-center"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-center mb-4">
                    {isSuccess ? (
                        <CheckCircle className="h-12 w-12 text-green-500" />
                    ) : (
                        <XCircle className="h-12 w-12 text-red-500" />
                    )}
                </div>

                <h3 className={`text-lg font-bold mb-2 ${isSuccess ? 'text-green-500' : 'text-red-500'}`}>
                    {isSuccess ? 'Subscription Cancelled' : 'Cancellation Failed'}
                </h3>

                <p className="text-sm text-muted-foreground mb-4">
                    {message}
                </p>

                <Button onClick={onClose} className="w-full">
                    Close
                </Button>
            </motion.div>
        </motion.div>
    );
};

// Subscription Detail Popup Component
const SubscriptionDetailPopup = ({ isOpen, onClose, subscription }) => {
    if (!isOpen || !subscription) return null;

    const executionHistory = subscription.originalData?.execution_history || [];
    const historyCount = executionHistory.length;

    // Format status badge color
    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'success': return 'bg-green-100 text-green-800';
            case 'failed': return 'bg-red-100 text-red-800';
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-card rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-border shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-xl font-bold">Subscription Details</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            {subscription.from} → {subscription.to} • {subscription.amount} {subscription.from} per swap
                        </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: Subscription Details */}
                    <div className="space-y-6">
                        <Card className="p-5">
                            <h4 className="font-semibold text-md mb-4 flex items-center gap-2">
                                <History className="h-5 w-5" />
                                Subscription Information
                            </h4>
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Status</span>
                                    <Badge className={`${statusColor[subscription.status] || statusColor.active} text-white`}>
                                        {subscription.status.toUpperCase()}
                                    </Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Frequency</span>
                                    <span className="font-medium">{subscription.frequencyLabel}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Duration</span>
                                    <span className="font-medium">{subscription.durationLabel}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Next Execution</span>
                                    <span className="font-medium text-green-500">
                                        {subscription.status === 'active' ? subscription.nextExecutionTime : "-"}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Progress</span>
                                    <span className="font-medium">
                                        {subscription.executed}/{subscription.totalExecutions === 999 ? "∞" : subscription.totalExecutions}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Created</span>
                                    <span className="font-medium">{subscription.createdTime}</span>
                                </div>
                                {subscription.settings && (
                                    <>
                                        <div className="pt-3 border-t">
                                            <h5 className="font-semibold mb-2">Transaction Settings</h5>
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground">Slippage Tolerance</span>
                                                <span className="font-medium">{subscription.settings.slippage || 2}%</span>
                                            </div>
                                            <div className="flex justify-between items-center mt-2">
                                                <span className="text-muted-foreground">Transaction Deadline</span>
                                                <span className="font-medium">{subscription.settings.deadline || 5} minutes</span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </Card>

                        {/* Token Information */}
                        <Card className="p-5">
                            <h4 className="font-semibold text-md mb-4">Token Details</h4>
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <span className="text-muted-foreground block">From Token</span>
                                        <span className="font-medium">{subscription.from}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-muted-foreground block">To Token</span>
                                        <span className="font-medium">{subscription.to}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <span className="text-muted-foreground block">Amount per Swap</span>
                                        <span className="font-medium">{subscription.amount} {subscription.from}</span>
                                    </div>
                                </div>
                                {subscription.originalData?.paymentToken && (
                                    <div className="pt-3 border-t">
                                        <h5 className="font-semibold mb-2">Payment Token Info</h5>
                                        <div className="text-sm space-y-1">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Name:</span>
                                                <span>{subscription.originalData.paymentToken.name}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Decimals:</span>
                                                <span>{subscription.originalData.paymentToken.decimals}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>

                    {/* Right Column: Execution History */}
                    <div className="space-y-6">
                        <Card className="p-5">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-semibold text-md flex items-center gap-2">
                                    <History className="h-5 w-5" />
                                    Execution History
                                </h4>
                                <Badge variant="outline">
                                    {historyCount} {historyCount === 1 ? 'Execution' : 'Executions'}
                                </Badge>
                            </div>

                            {historyCount > 0 ? (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-12">#</TableHead>
                                                <TableHead>Time</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Amount</TableHead>
                                                <TableHead>Hash</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {executionHistory.map((execution, index) => (
                                                <TableRow key={index}>
                                                    <TableCell className="font-medium text-xs">
                                                        {index+1}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-xs">
                                                            {formatTimestamp(execution.timestamp)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={`${getStatusColor(execution.status)} px-2 py-1 text-xs`}>
                                                            {execution.status || 'Unknown'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">
                                                            {execution.executedAmount || subscription.amount} {execution.fromToken || subscription.from}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            → {execution.toToken || subscription.to}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {execution.transactionHash ? (
                                                            <a
                                                                href={`https://eth-sepolia.blockscout.com/tx/${execution.transactionHash}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-600 hover:underline text-sm"
                                                            >
                                                                View
                                                                <ExternalLink className="h-3 w-3" />
                                                            </a>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">No hash</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="text-center py-8 border rounded-lg bg-muted/20">
                                    <History className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                                    <p className="text-muted-foreground font-medium">No execution history yet</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        This subscription hasn't been executed yet
                                    </p>
                                </div>
                            )}

                            {historyCount > 0 && (
                                <div className="mt-4 pt-4 border-t">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-muted-foreground">Total Executions:</span>
                                        <span className="font-medium">{historyCount}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs mt-1">
                                        <span className="text-muted-foreground">Last Execution:</span>
                                        <span className="font-medium">
                                            {executionHistory.length > 0 
                                                ? formatTimestamp(executionHistory[0].timestamp)
                                                : 'Never'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </Card>

                        {/* Summary Card */}
                        <Card className="p-5">
                            <h4 className="font-semibold text-md mb-4">Summary</h4>
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Subscription ID</span>
                                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                                        {subscription.id.slice(0, 8)}...{subscription.id.slice(-8)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Wallet Address</span>
                                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                                        {subscription.originalData?.wallet_address?.slice(0, 6)}...{subscription.originalData?.wallet_address?.slice(-4)}
                                    </span>
                                </div>
                                {subscription.lastExecutionHash && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Last Transaction</span>
                                        <a
                                            href={`https://eth-sepolia.blockscout.com/tx/${subscription.lastExecutionHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-600 hover:underline text-xs"
                                        >
                                            {`${subscription.lastExecutionHash.slice(0, 8)}...${subscription.lastExecutionHash.slice(-8)}`}
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t flex justify-end">
                    <Button onClick={onClose} className="px-6">
                        Close Details
                    </Button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default function MySubscription() {
    const [activeStatus, setActiveStatus] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [subscriptionsData, setSubscriptionsData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // State untuk cancellation functionality
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [selectedSubscription, setSelectedSubscription] = useState(null);
    const [cancelling, setCancelling] = useState(false);
    const [resultPopup, setResultPopup] = useState({
        open: false,
        success: false,
        message: ""
    });

    // State untuk detail popup
    const [detailPopupOpen, setDetailPopupOpen] = useState(false);
    const [selectedSubscriptionDetail, setSelectedSubscriptionDetail] = useState(null);

    const statuses = ["all", "active", "canceled", "completed", "expired"];

    const { getSubscriptionDataFromAPI, cancelSubscription } = useAuth();

    // wagmi
    const { address, isConnected } = useAccount();

    // Fetch subscription data when wallet is connected
    const fetchSubscriptionData = useCallback(async () => {
        if (!isConnected || !address) return;

        setLoading(true);
        setError("");
        try {
            const response = await getSubscriptionDataFromAPI();
            
            // Handle response based on structure (similar to Task.js)
            let subscriptions = [];
            
            if (Array.isArray(response)) {
                // Filter subscriptions for current user based on wallet_address
                subscriptions = response.filter(sub => 
                    sub.wallet_address?.toLowerCase() === address.toLowerCase()
                );
            } else if (response && response.data && Array.isArray(response.data)) {
                subscriptions = response.data.filter(sub => 
                    sub.wallet_address?.toLowerCase() === address.toLowerCase()
                );
            } else if (response && response.status === 'ok' && Array.isArray(response.data)) {
                subscriptions = response.data.filter(sub => 
                    sub.wallet_address?.toLowerCase() === address.toLowerCase()
                );
            } else if (response && response.status === 'ok' && typeof response.data === 'object') {
                // If it's a single object, convert to array
                if (response.data.wallet_address?.toLowerCase() === address.toLowerCase()) {
                    subscriptions = [response.data];
                }
            }
            
            setSubscriptionsData(subscriptions);
        } catch (err) {
            console.error("Failed to fetch subscription data:", err);
            setError("Failed to load subscription data");
            setSubscriptionsData([]);
        } finally {
            setTimeout(() => setLoading(false), 1000);
        }
    }, [isConnected, address, getSubscriptionDataFromAPI]);

    useEffect(() => {
        if (isConnected && address) {
            fetchSubscriptionData();
        }
    }, [isConnected, address, fetchSubscriptionData]);

    // Map data from API to required format
    const mappedSubscriptions = useMemo(() => {
        const subscriptions = subscriptionsData.map(sub => {
            // Extract values
            const frequency = sub.frequency || "weekly";
            const duration = sub.duration || "1month";
            const amount = sub.amount || "0";
            const totalExecutions = sub.totalExecutions || 0;
            const executed = sub.executed || 0;
            const nextExecutionTimestamp = sub.nextExecutionTimestamp;
            const nextExecution = sub.nextExecution || formatTimestamp(nextExecutionTimestamp);
            
            // Format amount
            const amountFormatted = parseFloat(amount).toFixed(6);
            
            // Generate frequency and duration labels
            const frequencyLabel = frequencyLabels[frequency] || frequency;
            const durationLabel = durationLabels[duration] || duration;
            
            // Calculate next execution time
            const nextExecutionTime = calculateTimeUntilNextExecution(nextExecutionTimestamp);

            return {
                id: sub._id?.$oid || sub._id || Math.random().toString(),
                status: sub.status || "active",
                from: sub.paymentToken?.symbol || "ETH",
                to: sub.targetToken?.symbol || "USDC",
                amount: amountFormatted,
                frequency: frequency,
                frequencyLabel,
                duration: duration,
                durationLabel,
                totalExecutions: totalExecutions,
                executed: executed,
                nextExecution: nextExecution,
                nextExecutionTime,
                lastExecutionHash: sub.lastExecutionHash || sub.execution_history?.[0]?.transactionHash || null,
                createdTime: formatTimestamp(sub.created_at),
                settings: sub.settings || {},
                originalData: sub
            };
        });

        // Sort by created_at (newest first)
        return subscriptions.sort((a, b) => {
            const timeA = a.originalData.created_at;
            const timeB = b.originalData.created_at;
            return new Date(timeB).getTime() - new Date(timeA).getTime();
        });
    }, [subscriptionsData]);

    // Filter subscriptions based on activeStatus
    const filteredSubscriptions = useMemo(() => {
        if (activeStatus === "all") return mappedSubscriptions;
        return mappedSubscriptions.filter(sub => sub.status === activeStatus);
    }, [mappedSubscriptions, activeStatus]);

    // Pagination logic
    const totalPages = Math.ceil(filteredSubscriptions.length / ITEMS_PER_PAGE);

    // Get subscriptions for current page
    const currentSubscriptions = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return filteredSubscriptions.slice(startIndex, endIndex);
    }, [filteredSubscriptions, currentPage]);

    // Handler to open cancel confirmation dialog
    const handleOpenCancelDialog = (subscription) => {
        setSelectedSubscription(subscription);
        setCancelDialogOpen(true);
    };

    // Handler to close cancel dialog
    const handleCloseCancelDialog = () => {
        if (!cancelling) {
            setCancelDialogOpen(false);
            setSelectedSubscription(null);
        }
    };

    // Handler to confirm cancellation
    const handleConfirmCancel = async () => {
        if (!selectedSubscription || !address) return;

        setCancelling(true);
        try {
            const response = await cancelSubscription(selectedSubscription.originalData._id);

            if (response.status === 'ok' || response.success) {
                setResultPopup({
                    open: true,
                    success: true,
                    message: "The subscription has been successfully cancelled."
                });

                // Refresh subscription list
                await fetchSubscriptionData();
            } else {
                throw new Error(response.message || "Failed to cancel subscription");
            }
        } catch (err) {
            console.error("Failed to cancel subscription:", err);
            setResultPopup({
                open: true,
                success: false,
                message: err.message || "Failed to cancel subscription. Please try again."
            });
        } finally {
            setCancelling(false);
            setCancelDialogOpen(false);
            setSelectedSubscription(null);
        }
    };

    // Handler to close result popup
    const handleCloseResultPopup = () => {
        setResultPopup(prev => ({ ...prev, open: false }));
    };

    // Handler to open detail popup
    const handleOpenDetailPopup = (subscription) => {
        setSelectedSubscriptionDetail(subscription);
        setDetailPopupOpen(true);
    };

    // Handler to close detail popup
    const handleCloseDetailPopup = () => {
        setDetailPopupOpen(false);
        setSelectedSubscriptionDetail(null);
    };

    // Generate pagination links with ellipsis
    const generatePaginationLinks = () => {
        const pages = [];
        const maxVisiblePages = 3;

        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(
                    <PaginationItem key={i}>
                        <PaginationLink
                            href="#"
                            isActive={currentPage === i}
                            onClick={(e) => {
                                e.preventDefault();
                                setCurrentPage(i);
                            }}
                        >
                            {i}
                        </PaginationLink>
                    </PaginationItem>
                );
            }
        } else {
            if (currentPage > 2) {
                pages.push(<PaginationEllipsis key="ellipsis-start" />);
            }

            const startPage = Math.max(1, currentPage - 1);
            const endPage = Math.min(totalPages, currentPage + 1);

            for (let i = startPage; i <= endPage; i++) {
                pages.push(
                    <PaginationItem key={i}>
                        <PaginationLink
                            href="#"
                            isActive={currentPage === i}
                            onClick={(e) => {
                                e.preventDefault();
                                setCurrentPage(i);
                            }}
                        >
                            {i}
                        </PaginationLink>
                    </PaginationItem>
                );
            }

            if (currentPage < totalPages - 1) {
                pages.push(<PaginationEllipsis key="ellipsis-end" />);
            }
        }

        return pages;
    };

    const handlePreviousPage = (e) => {
        e.preventDefault();
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    const handleNextPage = (e) => {
        e.preventDefault();
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    const handleStatusChange = (status) => {
        setActiveStatus(status);
        setCurrentPage(1);
    };

    return (
        <div className="w-full p-2">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-[400px] w-full mx-auto bg-card backdrop-blur-xl rounded-3xl p-6 border border-card shadow-2xl mt-10"
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold">My Subscriptions</h3>
                    {isConnected && !loading && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={fetchSubscriptionData}
                            className="h-8 w-8 p-0"
                        >
                            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    )}
                </div>

                {/* Status Selection */}
                {isConnected && (
                    <div className="mb-6">
                        <div className="space-y-2">
                            <label className="text-xs text-muted-foreground">Status</label>
                            <Select onValueChange={handleStatusChange} value={activeStatus}>
                                <SelectTrigger className="w-full text-xs">
                                    <SelectValue placeholder="Select Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {statuses.map((status) => (
                                        <SelectItem key={status} value={status} className="text-xs">
                                            {status.charAt(0).toUpperCase() + status.slice(1)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {isConnected && loading && (
                    <div className="flex flex-col space-y-3">
                        <Skeleton className="h-[120px] w-full rounded-xl" />
                        <Skeleton className="h-[120px] w-full rounded-xl" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-[250px]" />
                        </div>
                    </div>
                )}

                {/* Error State */}
                {isConnected && error && !loading && (
                    <div className="flex flex-col items-center justify-center p-6 border rounded-2xl bg-red-500/10 text-center mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                        <p className="text-sm font-medium text-red-500">{error}</p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={fetchSubscriptionData}
                        >
                            Retry
                        </Button>
                    </div>
                )}

                {/* Subscription List */}
                {isConnected && !loading && (
                    <div className="space-y-3 mb-6">
                        {currentSubscriptions.length > 0 ? (
                            currentSubscriptions.map((subscription) => (
                                <Card key={subscription.id} className="relative p-3 text-sm border-border/50">
                                    <CardHeader className="flex flex-row justify-between items-center p-0 pb-2">
                                        <div className="flex items-center gap-2">
                                            <Badge className={`${statusColor[subscription.status] || statusColor.active} text-white text-xs`}>
                                                {subscription.status.toUpperCase()}
                                            </Badge>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Repeat className="h-3 w-3" />
                                                <span>Auto Buy</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {subscription.status === "active" && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                                            <MoreVertical className="h-3 w-3" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem
                                                            className="text-xs"
                                                            onClick={() => handleOpenDetailPopup(subscription)}
                                                        >
                                                            View Details & History
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-xs"
                                                            onClick={() => handleOpenCancelDialog(subscription)}
                                                        >
                                                            Cancel Subscription
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                            {subscription.status !== "active" && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0"
                                                    onClick={() => handleOpenDetailPopup(subscription)}
                                                >
                                                    <History className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0 space-y-3">
                                        {/* Main Swap Info */}
                                        <div className="flex justify-between items-center mb-0">
                                            <div className="text-lg font-bold">
                                                {subscription.from} → {subscription.to}
                                            </div>
                                            <div className="text-right">
                                                <div className="font-semibold">{subscription.amount} {subscription.from}</div>
                                                <div className="text-xs text-muted-foreground">per swap</div>
                                            </div>
                                        </div>

                                        {/* ✅ ACCORDION UNTUK DETAILS */}
                                        <Accordion type="single" collapsible className="w-full">
                                            <AccordionItem value="details" className="border-none">
                                                <AccordionTrigger className="text-xs py-2 hover:no-underline">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">Subscription Details</span>
                                                        {subscription.originalData?.execution_history?.length > 0 && (
                                                            <Badge variant="outline" className="h-4 px-1 text-[10px]">
                                                                {subscription.originalData.execution_history.length} exec
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="pb-0">
                                                    <div className="space-y-3">
                                                        {/* Frequency */}
                                                        <div className="flex justify-between items-center mb-0">
                                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                                <Repeat className="h-3 w-3" />
                                                                <span className="text-xs font-medium">Frequency:</span>
                                                            </div>
                                                            <span className="text-xs font-semibold">{subscription.frequencyLabel}</span>
                                                        </div>

                                                        {/* Duration */}
                                                        <div className="flex justify-between items-center mb-0">
                                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                                <Calendar className="h-3 w-3" />
                                                                <span className="text-xs font-medium">Duration:</span>
                                                            </div>
                                                            <span className="text-xs font-semibold">{subscription.durationLabel}</span>
                                                        </div>

                                                        {/* Next Execution */}
                                                        <div className="flex justify-between items-center mb-0">
                                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                                <Clock className="h-3 w-3" />
                                                                <span className="text-xs font-medium">Next in:</span>
                                                            </div>
                                                            <span className="text-xs font-semibold text-green-500">
                                                                {subscription.status === 'active' ? subscription.nextExecutionTime : "-"}
                                                            </span>
                                                        </div>

                                                        {/* Progress */}
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                                <RefreshCcw className="h-3 w-3" />
                                                                <span className="text-xs font-medium">Progress:</span>
                                                            </div>
                                                            <span className="text-xs font-semibold">
                                                                {subscription.executed}/{subscription.totalExecutions === 999 ? "∞" : subscription.totalExecutions}
                                                            </span>
                                                        </div>

                                                        {subscription.lastExecutionHash && (
                                                            <div className="flex justify-between items-center">
                                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                                    <Link2 className="h-3 w-3" />
                                                                    <span className="text-xs font-medium">Last Transaction:</span>
                                                                </div>
                                                                <a
                                                                    href={`https://eth-sepolia.blockscout.com/tx/${subscription.lastExecutionHash}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-xs font-semibold text-blue-500 hover:underline"
                                                                >
                                                                    {`${subscription.lastExecutionHash.slice(0, 8)}...${subscription.lastExecutionHash.slice(-8)}`}
                                                                </a>
                                                            </div>
                                                        )}

                                                        {/* Settings */}
                                                        {subscription.settings && (
                                                            <div className="pt-2 border-t border-border/50">
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className="text-xs text-muted-foreground">Slippage:</span>
                                                                    <span className="text-xs font-semibold">{subscription.settings.slippage || 2}%</span>
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-xs text-muted-foreground">Deadline:</span>
                                                                    <span className="text-xs font-semibold">{subscription.settings.deadline || 5} minutes</span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Created Time */}
                                                        <div className="flex justify-between items-center pt-2 border-t border-border/50">
                                                            <span className="text-xs text-muted-foreground">Created:</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {subscription.createdTime}
                                                            </span>
                                                        </div>

                                                        {/* View Details Button */}
                                                        <div className="pt-3 border-t border-border/50">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="w-full text-xs h-7"
                                                                onClick={() => handleOpenDetailPopup(subscription)}
                                                            >
                                                                <History className="h-3 w-3 mr-1" />
                                                                View Full Details & Execution History
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>
                                    </CardContent>
                                </Card>
                            ))
                        ) : !error && (
                            <div className="flex flex-col items-center justify-center p-6 border rounded-2xl bg-muted/40 text-center">
                                <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
                                <p className="text-sm font-medium text-muted-foreground">
                                    No subscriptions found
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Create your first autobuy subscription to get started
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Pagination Component - hanya tampil jika ada lebih dari 1 page */}
                {isConnected && !loading && totalPages > 1 && (
                    <Pagination>
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious
                                    href="#"
                                    onClick={handlePreviousPage}
                                    className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                                />
                            </PaginationItem>

                            {generatePaginationLinks()}

                            <PaginationItem>
                                <PaginationNext
                                    href="#"
                                    onClick={handleNextPage}
                                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                )}

                {/* Info pagination */}
                {isConnected && !loading && filteredSubscriptions.length > 0 && (
                    <div className="text-center text-xs text-muted-foreground mt-2">
                        Page {currentPage} of {totalPages} • {filteredSubscriptions.length} subscriptions total
                    </div>
                )}

                {!isConnected && (
                    <div className="flex flex-col items-center justify-center p-6 border rounded-2xl bg-muted/40 text-center">
                        <Unplug className="w-8 h-8 text-muted-foreground my-4" />
                        <p className="text-sm font-medium text-muted-foreground">
                            Please connect wallet first
                        </p>
                    </div>
                )}
            </motion.div>

            {/* Confirmation Dialog */}
            <ConfirmationDialog
                isOpen={cancelDialogOpen}
                onClose={handleCloseCancelDialog}
                onConfirm={handleConfirmCancel}
                subscription={selectedSubscription}
                loading={cancelling}
            />

            {/* Result Popup */}
            <ResultPopup
                isOpen={resultPopup.open}
                onClose={handleCloseResultPopup}
                isSuccess={resultPopup.success}
                message={resultPopup.message}
            />

            {/* Subscription Detail Popup */}
            <SubscriptionDetailPopup
                isOpen={detailPopupOpen}
                onClose={handleCloseDetailPopup}
                subscription={selectedSubscriptionDetail}
            />
        </div>
    );
}