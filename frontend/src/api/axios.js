import axios from "axios";

let isLoggingOut = false;

// Create Axios instance
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Request Interceptor: Attach Token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor: Handle Auth Errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401 && !isLoggingOut) {
            isLoggingOut = true;
            window.dispatchEvent(new CustomEvent("auth:logout", { detail: { reason: "unauthorized" } }));
        }
        return Promise.reject(error);
    }
);

export default api;
