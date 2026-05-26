import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [onlineStatus, setOnlineStatus] = useState("OFFLINE");
    const [statusLoading, setStatusLoading] = useState(false);

    // On mount, restore non-sensitive user profile from sessionStorage.
    // The JWT is in an httpOnly cookie — never touches JS.
    useEffect(() => {
        const storedUser = sessionStorage.getItem("user");
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                setUser(parsed);
                setOnlineStatus(parsed.onlineStatus || "OFFLINE");
            } catch {
                sessionStorage.removeItem("user");
            }
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        try {
            const data = await loginApi({ email, password });
            const { user } = data;
            // JWT is stored in httpOnly cookie by the server — not accessible here
            sessionStorage.setItem("user", JSON.stringify(user));
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

    const logout = useCallback(async () => {
        try { await api.post("/auth/logout"); } catch { /* ignore */ }
        sessionStorage.removeItem("user");
        sessionStorage.removeItem("streamToken");
        setUser(null);
        setOnlineStatus("OFFLINE");
        navigate("/login", { replace: true });
    }, [navigate]);

    // Handle 401 responses fired from the axios interceptor
    useEffect(() => {
        const handler = () => logout();
        window.addEventListener("auth:logout", handler);
        return () => window.removeEventListener("auth:logout", handler);
    }, [logout]);

    // Update the user's online presence status
    const updateStatus = useCallback(async (status) => {
        if (statusLoading) return;
        setStatusLoading(true);
        try {
            const res = await api.patch("/user-status/me", { status });
            const updatedUser = { ...user, onlineStatus: status, breakStartedAt: res.data.user.breakStartedAt };
            setUser(updatedUser);
            setOnlineStatus(status);
            sessionStorage.setItem("user", JSON.stringify(updatedUser));
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
        sessionStorage.setItem("user", JSON.stringify(merged));
    }, [user, onlineStatus]);

    const value = {
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
        onlineStatus,
        updateStatus,
        statusLoading,
        refreshUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
