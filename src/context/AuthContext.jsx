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
            setUser(userData);
            // localStorage.setItem("nurotra_user", JSON.stringify(userData)); // apiService handles this
            return userData;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Signup failed");
        }
    };

    const logout = () => {
        authService.logout();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, signup, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
