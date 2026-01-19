import { createContext, useContext, useState, useEffect } from "react";
import { authService } from "../services/apiService";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Load session on mount
    useEffect(() => {
        const storedUser = localStorage.getItem("nurotra_user");
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        try {
            const userData = await authService.login({ email, password });
            setUser(userData);
            // localStorage.setItem("nurotra_user", JSON.stringify(userData)); // apiService handles this
            return userData;
        } catch (error) {
            // Re-throw with message
            throw new Error(error.response?.data?.message || "Login failed");
        }
    };

    const signup = async (data) => {
        try {
            const userData = await authService.register(data);
            // We do NOT setUser here because they are not verified yet.
            // verifyOtp will call setUser once they enter the code.
            return userData;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Signup failed");
        }
    };

    const loginWithToken = async (token) => {
        try {
            const userData = await authService.getMe(token);
            setUser(userData);
            return userData;
        } catch (error) {
            console.error("Token login failed", error);
            throw error;
        }
    };

    const logout = () => {
        authService.logout();
        setUser(null);
    };

    const updateUser = (updates) => {
        setUser(prev => {
            const updated = { ...prev, ...updates };
            localStorage.setItem("nurotra_user", JSON.stringify(updated));
            return updated;
        });
    };

    return (
        <AuthContext.Provider value={{ user, token: user?.token, login, signup, logout, loginWithToken, updateUser, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
