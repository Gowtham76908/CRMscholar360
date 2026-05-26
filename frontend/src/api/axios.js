import axios from "axios";

let isLoggingOut = false;

// Create Axios instance
// withCredentials ensures the httpOnly auth cookie is sent on every request
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

// Response Interceptor: Handle Auth Errors
// Triggers logout on 401 UNLESS it's the login endpoint itself failing.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const code = error.response?.data?.error?.code;
        const is401 = error.response?.status === 401;
        const isLoginRoute = error.config?.url?.includes("/auth/login");
        if (is401 && !isLoginRoute && !isLoggingOut) {
            isLoggingOut = true;
            window.dispatchEvent(new CustomEvent("auth:logout", { detail: { reason: code ?? "unauthorized" } }));
        }
        return Promise.reject(error);
    }
);

export default api;
