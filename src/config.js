// Centralized configuration for the application

// API Base URL
// In production (Vercel/Render), VITE_API_URL should be set in environment variables
// In development, it falls back to localhost:5000
export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

export const GOOGLE_AUTH_URL = `${API_BASE_URL}/api/auth/google`;
