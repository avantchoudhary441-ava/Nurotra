import axios from "axios";

const API_URL = "http://localhost:5000/api/auth";

// Create axios instance
const api = axios.create({
    baseURL: "http://localhost:5000/api",
});

// Add token to headers if it exists
api.interceptors.request.use((config) => {
    const user = JSON.parse(localStorage.getItem("nurotra_user"));
    if (user && user.token) {
        config.headers.Authorization = `Bearer ${user.token}`;
    }
    return config;
});

export const authService = {
    register: async (userData) => {
        const response = await axios.post(`${API_URL}/register`, userData);
        if (response.data) {
            localStorage.setItem("nurotra_user", JSON.stringify(response.data));
        }
        return response.data;
    },

    login: async (userData) => {
        const response = await axios.post(`${API_URL}/login`, userData);
        if (response.data) {
            localStorage.setItem("nurotra_user", JSON.stringify(response.data));
        }
        return response.data;
    },

    logout: () => {
        localStorage.removeItem("nurotra_user");
    }
};

export default api;
