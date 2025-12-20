import { API_URL } from "@/config/api";
import axios from "axios";
import { parseUnits, zeroAddress } from "viem";

export async function getSwapQuote(from, to, amount, slippage, sender) {
    try {
        if (Number(amount) <= 0) return {};

        let sellToken = from.address;
        let buyToken = to.address;
        let sellAmount = amount.toString();

        if (to.address == zeroAddress) {
            buyToken = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
        }

        if (from.address == zeroAddress) {
            sellToken = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
        }

        let url = `${API_URL}/get_quote?from=${sellToken}&to=${buyToken}&amount=${sellAmount}&slippage=${slippage}`;
        if (sender) {
            url += `&sender=${sender}`;
        }

        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error(error);
        return {};
    }
}

export async function getBalancesAllToken(address) {
    try {
        const response = await axios.get(`${API_URL}/all_balance_wallet/${address}`);
        return response.data;
    } catch (error) {
        console.log(error);
        return [];
    }
}

export async function getBalances(address, token) {
    try {
        const response = await axios.get(`${API_URL}/balance/${address}?token=${token}`);
        const item = response.data;
        return item ? item.balance : "0";
    } catch (error) {
        console.log(error);
        return "0";
    }
}