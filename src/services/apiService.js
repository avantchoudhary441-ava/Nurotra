import axios from "axios";

import { API_BASE_URL } from "../config";

const BASE_URL = API_BASE_URL;
const API_URL = `${BASE_URL}/api/auth`;

// Create axios instance
const api = axios.create({
    baseURL: `${BASE_URL}/api`,
    timeout: 600000, // 10 minutes for long AI generation tasks
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
        return response.data;
    },

    login: async (userData) => {
        const response = await axios.post(`${API_URL}/login`, userData);
        if (response.data) {
            localStorage.setItem("nurotra_user", JSON.stringify(response.data));
        }
        return response.data;
    },

    verifyOtp: async (email, otp) => {
        const response = await axios.post(`${API_URL}/verify-otp`, { email, otp });
        if (response.data && response.data.token) {
            localStorage.setItem("nurotra_user", JSON.stringify(response.data));
        }
        return response.data;
    },

    logout: () => {
        localStorage.removeItem("nurotra_user");
    },

    resendOtp: async (email) => {
        const response = await axios.post(`${API_URL}/resend-otp`, { email });
        return response.data;
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
        // Saving brand...
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
    },
    getInfluencerById: async (userId) => {
        const response = await api.get(`/influencer/${userId}`);
        return response.data;
    },
    getBrandById: async (userId) => {
        const response = await api.get(`/brand/${userId}`);
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
    sendMessage: async (content, chatId, attachments = [], type = "text") => {
        const response = await api.post("/message", { content, chatId, attachments, type });
        return response.data;
    },
    fetchMessages: async (chatId) => {
        const response = await api.get(`/message/${chatId}`);
        return response.data;
    },
    uploadFile: async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        const response = await api.post("/upload", formData);
        return response.data;
    },
    recordCollaboration: async (chatId, status) => {
        const response = await api.post("/chat/collab/record", { chatId, status });
        return response.data;
    }
};


export const aiService = {
    suggestReplies: async (chatId) => {
        const response = await api.post("/chat/ai/suggest", { chatId });
        return response.data.suggestions;
    },
    generateOpener: async (matchContext) => {
        const response = await api.post("/chat/ai/opener", { matchContext });
        return response.data.opener;
    },
    enhanceText: async (text) => {
        const response = await api.post("/chat/ai/enhance", { text });
        return response.data.enhancedText;
    },
    summarizeChat: async (chatId) => {
        const response = await api.post("/chat/ai/summarize", { chatId });
        return response.data;
    },
    analyzeProfile: async (profileData) => {
        const response = await api.post("/chat/ai/analyze-profile", { profileData });
        return response.data;
    }
};

export const nuroService = {
    getMemory: async () => {
        const response = await api.get("/nuro/memory");
        return response.data;
    },
    getPublicMemory: async (userId) => {
        const response = await api.get(`/nuro/memory/${userId}`);
        return response.data;
    },
    saveFeedback: async (response, context) => {
        const res = await api.post("/nuro/feedback", { response, context });
        return res.data;
    },
    markGuideSeen: async (guideId) => {
        const res = await api.post("/nuro/guide-seen", { guideId });
        return res.data;
    }
};

export const adminService = {
    getStats: async (params) => {
        const response = await api.get("/admin/stats", { params });
        return response.data;
    },
    getUsers: async (params) => {
        const response = await api.get("/admin/users", { params });
        return response.data;
    },
    updateUser: async (userId, data) => {
        const response = await api.patch(`/admin/users/${userId}`, data);
        return response.data;
    },
    addNote: async (userId, data) => {
        const response = await api.post(`/admin/users/${userId}/notes`, data);
        return response.data;
    },
    getUserTimeline: async (userId) => {
        const response = await api.get(`/admin/users/${userId}/timeline`);
        return response.data;
    },
    triggerBulkAction: async (data) => {
        const response = await api.post(`/admin/bulk-action`, data);
        return response.data;
    }
};

export const timeAgentService = {
    planTask: async (prompt) => {
        const response = await api.post("/time-agent/plan", { prompt });
        return response.data;
    }
};

export default api;
