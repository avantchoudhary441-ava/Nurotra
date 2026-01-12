import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { chatService } from "../../services/apiService";
import BackgroundEffects from "../../components/BackgroundEffects";
import "../../styles/global.css";

export default function CollabConclusionPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { chatId } = location.state || {}; // Expecting chatId passed in state

    const [loading, setLoading] = useState(false);

    const handleConclusion = async (status) => {
        if (!chatId) {
            alert("Error: No chat context found.");
            return;
        }

        setLoading(true);
        try {
            await chatService.recordCollaboration(chatId, status);
            alert(status === 'success' ? "Collaboration Marked as Started! 🎉" : "Collaboration Marked as Not Started.");
            navigate('/influencer/dashboard'); // Or back to chat
        } catch (error) {
            console.error("Failed to record collaboration", error);
            alert("Failed to update status. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            textAlign: 'center',
            padding: '20px',
            color: 'white',
            position: 'relative',
            zIndex: 10
        }}>
            <BackgroundEffects />

            <div style={{
                maxWidth: '600px',
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                padding: '40px',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
            }}>
                <h1 style={{ marginBottom: '20px', fontSize: '2rem' }}>Collaboration Decision</h1>
                <p style={{ fontSize: '1.2rem', marginBottom: '40px', lineHeight: '1.6', color: '#e0e0e0' }}>
                    If you want to make your collaboration successful or not, click the buttons accordingly.
                </p>

                <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => handleConclusion('success')}
                        disabled={loading}
                        style={{
                            padding: '15px 30px',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            borderRadius: '12px',
                            border: 'none',
                            cursor: 'pointer',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: 'white',
                            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
                            transition: 'transform 0.2s',
                            opacity: loading ? 0.7 : 1
                        }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        {loading ? "Processing..." : "Collaboration Started ✅"}
                    </button>

                    <button
                        onClick={() => handleConclusion('failed')}
                        disabled={loading}
                        style={{
                            padding: '15px 30px',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            borderRadius: '12px',
                            border: '1px solid rgba(239, 68, 68, 0.5)',
                            cursor: 'pointer',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#fca5a5',
                            transition: 'all 0.2s',
                            opacity: loading ? 0.7 : 1
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                            e.currentTarget.style.transform = 'scale(1.05)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                    >
                        Not Started ❌
                    </button>
                </div>
            </div>
        </div>
    );
}
