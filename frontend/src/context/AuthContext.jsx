import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { login as loginApi } from "../api/auth";
import api from "../api/axios";

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem("token"));
    const [loading, setLoading] = useState(true);
    const [onlineStatus, setOnlineStatus] = useState("OFFLINE");
    const [statusLoading, setStatusLoading] = useState(false);

    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        const tokenExpiry = localStorage.getItem("tokenExpiry");

        if (token && tokenExpiry) {
            const now = new Date().getTime();
            if (now > parseInt(tokenExpiry)) {
                console.log("Token expired, logging out");
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                localStorage.removeItem("tokenExpiry");
                setToken(null);
                setUser(null);
                setLoading(false);
                return;
            }
        }

        if (token && storedUser) {
            const parsed = JSON.parse(storedUser);
            setUser(parsed);
            setOnlineStatus(parsed.onlineStatus || "OFFLINE");
        }
        setLoading(false);
    }, [token]);

    const login = async (email, password) => {
        try {
            const data = await loginApi({ email, password });
            const { token, user } = data;

            const expiryTime = new Date().getTime() + (7 * 24 * 60 * 60 * 1000);

            localStorage.setItem("token", token);
            localStorage.setItem("user", JSON.stringify(user));
            localStorage.setItem("tokenExpiry", expiryTime.toString());

            setToken(token);
            setUser(user);
            setOnlineStatus(user.onlineStatus || "OFFLINE");
            return { success: true };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || "Login failed",
            };
        }
    };

    const logout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("tokenExpiry");
        localStorage.removeItem("streamToken");
        setToken(null);
        setUser(null);
        setOnlineStatus("OFFLINE");
        window.location.href = "/login";
    };

    // Update the user's online presence status
    const updateStatus = useCallback(async (status) => {
        if (statusLoading) return;
        setStatusLoading(true);
        try {
            const res = await api.patch("/user-status/me", { status });
            const updatedUser = { ...user, onlineStatus: status, breakStartedAt: res.data.user.breakStartedAt };
            setUser(updatedUser);
            setOnlineStatus(status);
            localStorage.setItem("user", JSON.stringify(updatedUser));
        } catch (error) {
            console.error("Failed to update status:", error);
        } finally {
            setStatusLoading(false);
        }
    }, [user, statusLoading]);

    // Expose a way for other parts of the app to sync user object (e.g. after profile update)
    const refreshUser = useCallback((updatedUser) => {
        const merged = { ...user, ...updatedUser };
        setUser(merged);
        setOnlineStatus(merged.onlineStatus || onlineStatus);
        localStorage.setItem("user", JSON.stringify(merged));
    }, [user, onlineStatus]);

    const value = {
        user,
        token,
        loading,
        login,
        logout,
        isAuthenticated: !!token,
        onlineStatus,
        updateStatus,
        statusLoading,
        refreshUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
