import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../../styles/auth.css";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";

export default function OtpVerify() {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth(); // We might use this to manually set user state if context allows, or just redirect to login

    // Get email from query params
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [error, setError] = useState("");
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const emailParam = params.get("email");
        if (emailParam) {
            setEmail(emailParam);
        } else {
            // Redirect if no email provided
            navigate("/signup");
        }
    }, [location, navigate]);

    const handleChange = (element, index) => {
        if (isNaN(element.value)) return;

        setOtp([...otp.map((d, idx) => (idx === index ? element.value : d))]);

        // Focus next input
        if (element.nextSibling && element.value) {
            element.nextSibling.focus();
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        const code = otp.join("");
        if (code.length !== 6) {
            setError("Please enter a 6-digit code");
            return;
        }

        setLoading(true);
        setError("");
        setMsg("");

        try {
            const { data } = await axios.post("http://localhost:5000/api/auth/verify-otp", {
                email,
                otp: code
            });

            // Login success
            setMsg("Verification Successful! Logging in...");

            // Store token (mimic login)
            if (data.token) {
                localStorage.setItem("user", JSON.stringify(data));
                // Refresh page or context to sync
                setTimeout(() => {
                    window.location.href = "/"; // Force reload/redirect to dashboard
                }, 1000);
            }

        } catch (err) {
            setError(err.response?.data?.message || "Verification failed");
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setError("");
        setMsg("Sending code...");
        try {
            await axios.post("http://localhost:5000/api/auth/resend-otp", { email });
            setMsg("New code sent to your email.");
        } catch (err) {
            setError(err.response?.data?.message || "Failed to resend");
            setMsg("");
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-glow"></div>
            <div className="auth-card" style={{ maxWidth: '400px' }}>
                <h2 className="auth-title">Verify Email ✉️</h2>
                <p style={{ textAlign: 'center', marginBottom: '20px', color: '#ccc' }}>
                    We sent a code to <br /> <strong>{email}</strong>
                </p>

                {error && <p className="auth-error-msg">{error}</p>}
                {msg && <p className="auth-success-msg" style={{ color: '#4ade80', textAlign: 'center' }}>{msg}</p>}

                <form onSubmit={handleVerify}>
                    <div className="otp-input-group" style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
                        {otp.map((data, index) => {
                            return (
                                <input
                                    className="auth-input"
                                    style={{ width: '40px', textAlign: 'center', padding: '10px' }}
                                    type="text"
                                    name="otp"
                                    maxLength="1"
                                    key={index}
                                    value={data}
                                    onChange={(e) => handleChange(e.target, index)}
                                    onFocus={(e) => e.target.select()}
                                />
                            );
                        })}
                    </div>

                    <button type="submit" className="btn-primary auth-btn" disabled={loading}>
                        {loading ? "Verifying..." : "Verify Code"}
                    </button>
                </form>

                <p className="auth-switch" style={{ marginTop: '20px' }}>
                    Didn't receive it? <span onClick={handleResend}>Resend Code</span>
                </p>
                <p className="auth-switch">
                    <span onClick={() => navigate("/signup")}>Change Email</span>
                </p>
            </div>
        </div>
    );
}
