import React, { useState } from "react";
import api from "../services/apiService";

export default function FileUploadModal({ onClose, onUploadSuccess }) {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState(null);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        setError(null);

        try {
            // 1. Upload to Cloudinary (using api instance which handles baseURL/proxy)
            const formData = new FormData();
            formData.append("file", file);

            const uploadRes = await api.post("/upload", formData, {
                onUploadProgress: (progressEvent) => {
                    const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(progress);
                },
            });

            const { url, filename } = uploadRes.data;

            // 2. Register as Deliverable + AI Analysis
            const deliverableRes = await api.post("/deliverables/upload", {
                fileUrl: url,
                fileName: file.name,
                fileType: file.type,
                tags: []
            });

            onUploadSuccess(deliverableRes.data.deliverable, deliverableRes.data.scoreImpact);
            onClose();
        } catch (err) {
            console.error("Upload failed", err);
            setError(err.response?.data?.message || "Upload failed. Please try again.");
            setIsUploading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <button className="modal-close" onClick={onClose}>×</button>
                <h2>Upload Deliverable</h2>
                <p style={{ color: '#888', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    Upload proof of work (PDF, XLSX, PPT, MP4, etc.) to boost your Nuro scores.
                </p>

                {!isUploading ? (
                    <div className="upload-dropzone" onClick={() => document.getElementById('file-input').click()}>
                        <span style={{ fontSize: '3rem' }}>☁️</span>
                        <p>Drag & drop or Click to browse</p>
                        <input
                            id="file-input"
                            type="file"
                            hidden
                            onChange={handleFileChange}
                        />
                    </div>
                ) : (
                    <div className="upload-loading">
                        <div className="spinner"></div>
                        <p>Nuro is analyzing your work... {uploadProgress}%</p>
                        <div style={{ width: '100%', background: '#222', height: '4px', borderRadius: '2px' }}>
                            <div style={{ width: `${uploadProgress}%`, background: '#4A90E2', height: '100%', borderRadius: '2px', transition: 'width 0.3s' }}></div>
                        </div>
                    </div>
                )}

                {error && <p style={{ color: '#ff4d4d', marginTop: '1rem', textAlign: 'center' }}>{error}</p>}
            </div>
        </div>
    );
}
