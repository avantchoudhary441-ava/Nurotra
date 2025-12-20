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
    },

    getMe: async (token) => {
        // Temporary set header just for this request if needed, 
        // OR rely on interceptor if we saved token to localStorage first
        const config = {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        };
        const response = await axios.get(`${API_URL}/me`, config);
        // Ensure we save the full user data including token to local storage
        if (response.data) {
            const userData = { ...response.data, token };
            localStorage.setItem("nurotra_user", JSON.stringify(userData));
            return userData;
        }
        return null;
    }
};

export const profileService = {
    saveBrand: async (data, token) => {
        console.log("Saving brand...", data); // Debug
        const config = {
            headers: { Authorization: `Bearer ${token}` }
        };
        const response = await axios.post(`${API_URL.replace("/auth", "")}/brand`, data, config);
        return response.data;
    },
    saveInfluencer: async (data, token) => {
        const config = {
            headers: { Authorization: `Bearer ${token}` }
        };
        const response = await axios.post(`${API_URL.replace("/auth", "")}/influencer`, data, config);
        return response.data;
    },
    getBrand: async (token) => {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const response = await axios.get(`${API_URL.replace("/auth", "")}/brand`, config);
        return response.data;
    },
    getInfluencer: async (token) => {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const response = await axios.get(`${API_URL.replace("/auth", "")}/influencer`, config);
        return response.data;
    }
};

export const matchService = {
    getBrandMatches: async (nuroId) => {
        const response = await api.post("/match/brand", { nuroId });
        return response.data;
    },
    getInfluencerMatches: async (nuroId) => {
        const response = await api.post("/match/influencer", { nuroId });
        return response.data;
    }
};


export const chatService = {
    accessChat: async (userId) => {
        const response = await api.post("/chat", { userId });
        return response.data;
    },
    fetchChats: async () => {
        const response = await api.get("/chat");
        return response.data;
    },
    sendMessage: async (content, chatId) => {
        const response = await api.post("/message", { content, chatId });
        return response.data;
    },
    fetchMessages: async (chatId) => {
        const response = await api.get(`/message/${chatId}`);
        return response.data;
    }
};

export default api;
