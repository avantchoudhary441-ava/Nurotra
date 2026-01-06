import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import FileUploadModal from "../components/FileUploadModal";
import api from "../services/apiService";
import "../styles/deliverables.css";

export default function DeliverablesDashboard({ role }) {
    const [deliverables, setDeliverables] = useState([]);
    const [isModalOpen, setModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [lastImpact, setLastImpact] = useState(null);

    useEffect(() => {
        fetchDeliverables();
    }, []);

    const fetchDeliverables = async () => {
        try {
            const res = await api.get("/deliverables");
            setDeliverables(Array.isArray(res.data) ? res.data : []);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching deliverables", err);
            setLoading(false);
        }
    };

    const handleUploadSuccess = (newDoc, impact) => {
        setDeliverables([newDoc, ...deliverables]);
        setLastImpact(impact);
        // Clear impact notification after 5 seconds
        setTimeout(() => setLastImpact(null), 5000);
    };

    const getFileIcon = (type) => {
        if (type?.includes("pdf")) return "📄";
        if (type?.includes("image")) return "🖼️";
        if (type?.includes("video")) return "🎬";
        if (type?.includes("spreadsheet") || type?.includes("excel") || type?.includes("csv")) return "📊";
        if (type?.includes("presentation") || type?.includes("powerpoint")) return "🧠";
        return "📁";
    };

    const handleFileClick = (doc) => {
        window.open(doc.fileUrl, "_blank");
    };

    return (
        <div className="deliverables-container">
            <Sidebar role={role} />

            <main className="deliverables-main">
                <header className="deliverables-header">
                    <div>
                        <h1>Deliverables</h1>
                        <p style={{ color: '#888' }}>Upload proof-of-work to build your AI reputation.</p>
                    </div>
                    <button className="btn-upload" onClick={() => setModalOpen(true)}>
                        <span>+</span> Upload Proof
                    </button>
                </header>

                {lastImpact && (
                    <div className="impact-notification" style={{
                        background: 'rgba(76, 175, 80, 0.1)',
                        border: '1px solid #4caf50',
                        padding: '1rem',
                        borderRadius: '12px',
                        marginBottom: '2rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div>
                            <strong style={{ color: '#4caf50' }}>🚀 Reputation Boosted!</strong>
                            <div style={{ fontSize: '0.85rem', marginTop: '0.3rem', display: 'flex', gap: '1rem' }}>
                                {lastImpact.trust > 0 && <span>+ {lastImpact.trust} Trust</span>}
                                {lastImpact.experience > 0 && <span>+ {lastImpact.experience} Experience</span>}
                                {lastImpact.compatibility > 0 && <span>+ {lastImpact.compatibility} Compatibility</span>}
                            </div>
                        </div>
                        <span className="impact-pop">💎</span>
                    </div>
                )}

                {loading ? (
                    <div className="deliverables-empty">Loading your vault...</div>
                ) : deliverables.length === 0 ? (
                    <div className="deliverables-empty">
                        <span>📭</span>
                        <p>No proof of work yet. Upload your first deliverable to get started.</p>
                    </div>
                ) : (
                    <div className="deliverables-grid">
                        {deliverables.map((doc) => (
                            <div
                                key={doc._id}
                                className="deliverable-card"
                                onClick={() => handleFileClick(doc)}
                            >
                                <div className="score-impact-badge">
                                    +{Math.max(...Object.values(doc.aiAnalysis?.scoreImpact || { v: 0 }))} Impact
                                </div>
                                <div className="deliverable-icon">{getFileIcon(doc.fileType)}</div>
                                <div className="deliverable-info">
                                    <h3>{doc.fileName}</h3>
                                    <span className="deliverable-category">{doc.category}</span>
                                    <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.8rem' }}>
                                        {doc.aiAnalysis?.summary || "Analyzing contents..."}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {isModalOpen && (
                <FileUploadModal
                    onClose={() => setModalOpen(false)}
                    onUploadSuccess={handleUploadSuccess}
                />
            )}
        </div>
    );
}
