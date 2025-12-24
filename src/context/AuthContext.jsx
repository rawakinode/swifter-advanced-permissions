// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState, useRef } from "react";
import axios from "axios";
import { API_URL } from "@/config/api";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";

const API_BASE = API_URL;
const STORAGE_KEY = "jwt_token";
const AuthContext = createContext();

export function AuthProvider({ children }) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();

  const [tokenData, setTokenData] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : { token: null, expiresAt: 0 };
  });

  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);

  const [loggedIn, setLoggedIn] = useState(false);

  const { token, expiresAt } = tokenData;
  const previousAddressRef = useRef(null);

  // auto-update token di ref
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
    isLogged();
  }, [token]);

  // Auto-remove token kalau expired
  useEffect(() => {
    if (!token) return;
    const now = Date.now();
    if (expiresAt <= now) return logout();

    const timeout = setTimeout(() => logout(), expiresAt - now);
    return () => clearTimeout(timeout);
  }, [token, expiresAt]);

  // Fungsi API dasar
  const getNonce = async (address) => {
    const res = await axios.post(`${API_BASE}/api/auth/nonce`, { address });
    return res.data;
  };

  const login = async ({ address, signature, nonce }) => {
    const res = await axios.post(`${API_BASE}/api/auth`, { address, signature, nonce });
    const token = res.data.token;
    const expiresAt = Date.now() + (res.data.expiresIn || 3600000);

    const newData = { token, expiresAt };
    setTokenData(newData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    return { token, expiresAt, ...res.data };
  };

  const logout = () => {
    setTokenData({ token: null, expiresAt: 0 });
    setUserData(null);
    localStorage.removeItem(STORAGE_KEY);
    disconnect();
    console.log("🧹 Logged out");
  };

  // Ambil user data
  const getUserData = async (overrideToken) => {
    const authToken = overrideToken || token;
    if (!authToken) throw new Error("User not authenticated");

    const res = await axios.get(`${API_BASE}/api/userdata`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    return res.data;
  };

  // Send swap to API
  const sendSwapToAPI = async (swapData) => {
    if (!token) throw new Error("User not authenticated");
    const res = await axios.post(`${API_BASE}/api/swap`, swapData, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    return res.data;
  }

  // Send permission granted data to API
  const sendPermissionToAPI = async (permissionData) => {
    if (!token) throw new Error("User not authenticated");
    const res = await axios.post(`${API_BASE}/api/permissions`, permissionData, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    return res.data;
  };

  // Get permission data from API
  const getPermissionDataFromAPI = async (address) => {
    if (!token) throw new Error("User not authenticated");
    const res = await axios.post(`${API_BASE}/api/permissions`, { address }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  };

  // Get active permission by token address
  const getRemainingPermissionTokenAmount = async (token_address) => {
    if (!token) throw new Error("User not authenticated");
    const res = await axios.get(`${API_BASE}/api/remain_token_permission?token_address=${token_address}`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    return res.data;
  };

  // Get session account address
  const getSessionAccountAddress = async () => {
    if (!token) throw new Error("User not authenticated");
    const res = await axios.get(`${API_BASE}/api/get_session_account`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    return res.data;
  };

  // Post delegation data ke API
  const postDelegationData = async (delegationData) => {
    if (!token) throw new Error("User not authenticated");
    const res = await axios.post(`${API_BASE}/api/send_delegation`, delegationData, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    return res.data;
  };

  // Ambil delegation data dari API
  const getDelegationDataFromAPI = async () => {
    if (!token) throw new Error("User not authenticated");
    const res = await axios.post(`${API_BASE}/api/delegations`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  };

  // Batalkan delegation task
  const cancelDelegationTask = async (_id) => {
    if (!token) throw new Error("User not authenticated");
    const res = await axios.post(`${API_BASE}/api/cancel_delegation`, { _id }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  };

  // Post subscribe delegation data ke API - DIPERBAIKI: handle error response dengan baik
  const postSubscribeDelegationData = async (delegationData) => {
    if (!token) throw new Error("User not authenticated");
    try {
      const res = await axios.post(`${API_BASE}/api/send_subscribe_delegation`, delegationData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      return res.data;
    } catch (error) {
      // Lempar error response dari server agar bisa ditangani di component
      if (error.response && error.response.data) {
        throw error.response.data;
      }
      throw error;
    }
  };

  // Ambil subscription data dari API
  const getSubscriptionDataFromAPI = async () => {
    if (!token) throw new Error("User not authenticated");
    const res = await axios.post(`${API_BASE}/api/subscriptions`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  };

  // Batalkan subscription
  const cancelSubscription = async (_id) => {
    if (!token) throw new Error("User not authenticated");
    const res = await axios.post(`${API_BASE}/api/cancel_subscription`, { _id }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  };

  // Health check
  const getHealth = async () => {
    const res = await axios.get(`${API_BASE}/api/health`);
    return res.data;
  };

  // isLogged check from API
  const isLogged = async () => {
    if (!token) return false;
    try {
      const res = await axios.get(`${API_BASE}/api/is_logged`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.loggedIn) {
        setLoggedIn(true);
      } else {
        setLoggedIn(false);
      }
    } catch (error) {
      setLoggedIn(false);
    }
  };

  // Otentikasi otomatis jika wallet connect
  useEffect(() => {
    const authenticate = async () => {
      try {
        console.log("Authenticating user...");
        await authenticateUser();
      } catch (e) {
        console.error(e);
      }
    };

    if (isConnected && address) {
      const addressChanged =
        previousAddressRef.current && previousAddressRef.current !== address;

      if (!token || addressChanged) {
        authenticate();
      }

      previousAddressRef.current = address;
    }
  }, [isConnected, address, token]);

  // Logout otomatis saat wallet disconnect
  useEffect(() => {
    if (!isConnected) logout();
  }, [isConnected]);

  // Fungsi untuk autentikasi user (nonce + sign)
  const authenticateUser = async () => {
    if (!address) return;
    try {
      setLoading(true);
      const { nonce, message } = await getNonce(address);
      const signature = await signMessageAsync({ message });
      const loginRes = await login({ address, signature, nonce });
      const user = await getUserData(loginRes.token);
      setUserData(user);
    } catch (err) {
      console.error("Authentication failed:", err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        tokenData,
        userData,
        loading,
        isConnected,
        isLogged,
        loggedIn,
        authenticateUser,
        logout,
        getNonce,
        getUserData,
        postDelegationData,
        postSubscribeDelegationData,
        getDelegationDataFromAPI,
        cancelDelegationTask,
        getHealth,
        getSubscriptionDataFromAPI,
        cancelSubscription,
        sendSwapToAPI,
        sendPermissionToAPI,
        getPermissionDataFromAPI,
        getSessionAccountAddress,
        getRemainingPermissionTokenAmount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
