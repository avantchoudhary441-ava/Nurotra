import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Download, Cloud, FolderOpen, File, RefreshCw, Copy } from 'lucide-react';
import { exportToExcel } from '../../../services/excelService';
import { exportToWord } from '../../../services/wordService';
import { exportToPPT } from '../../../services/pptService';

const ProjectsDocs = ({ projects, standaloneDocs, onOpenDoc, isSyncing, activeDocId }) => {
    const [expandedProjects, setExpandedProjects] = useState([1]);
    const [syncing, setSyncing] = useState(false);

    // Find the active document object
    const allDocs = [...standaloneDocs, ...projects.flatMap(p => p.documents)];
    const activeDoc = allDocs.find(d => d.id === activeDocId);

    const handleExportXLSX = () => {
        if (activeDoc) exportToExcel(activeDoc.name, activeDoc.content || "");
    };

    const handleExportWord = () => {
        if (activeDoc) exportToWord(activeDoc.name, activeDoc.content || "");
    };

    const handleExportPPT = () => {
        if (activeDoc) exportToPPT(activeDoc.name, activeDoc.content || "");
    };

    const handleCopyToClipboard = () => {
        if (activeDoc?.content) {
            navigator.clipboard.writeText(activeDoc.content);
            alert("Copied to clipboard! Ready to paste into Google Docs.");
        }
    };

    const handleSync = () => {
        setSyncing(true);
        setTimeout(() => setSyncing(false), 2000);
    };

    const toggleProject = (projectId) => {
        setExpandedProjects(prev =>
            prev.includes(projectId)
                ? prev.filter(id => id !== projectId)
                : [...prev, projectId]
        );
    };

    const getFileIcon = (type) => {
        switch (type) {
            case 'word': return '📝';
            case 'excel': return '📊';
            case 'ppt': return '📽️';
            case 'pdf': return '📄';
            default: return '📄';
        }
    };

    return (
        <div className="projects-docs-panel">
            {/* Header */}
            <div className="panel-header">
                <h2>Projects & Docs</h2>
                <div className="header-controls">
                    <button
                        className={`new-project-btn ${syncing ? 'spinning' : ''}`}
                        onClick={handleSync}
                        title="Sync with cloud"
                    >
                        <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                    </button>
                    <button className="new-project-btn">
                        <FolderOpen size={14} />
                    </button>
                </div>
            </div>

            {/* Projects List */}
            <div className={`projects-list ${isSyncing ? 'panel-pulsing' : ''}`}>
                {projects.map((project) => (
                    <div key={project.id} className="project-item">
                        <div
                            className="project-header"
                            onClick={() => toggleProject(project.id)}
                        >
                            <div className="project-info">
                                {expandedProjects.includes(project.id) ? (
                                    <ChevronDown size={16} />
                                ) : (
                                    <ChevronRight size={16} />
                                )}
                                <span className="project-name">{project.name}</span>
                            </div>
                            <span className={`project-status ${project.status.toLowerCase()}`}>
                                {project.status}
                            </span>
                        </div>

                        <div className="project-meta">
                            <span className="doc-count">{project.docCount} docs</span>
                            <span className="last-modified">{project.lastModified}</span>
                        </div>

                        {project.summary && (
                            <p className="project-summary-text">{project.summary}</p>
                        )}

                        {/* Documents Tree */}
                        {expandedProjects.includes(project.id) && (
                            <div className="documents-tree">
                                {project.documents.map((doc) => (
                                    <div
                                        key={doc.id}
                                        className={`document-item ${activeDocId === doc.id ? 'active' : ''} ${activeDocId === doc.id && isSyncing ? 'syncing-doc' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (onOpenDoc) onOpenDoc(doc);
                                        }}
                                    >
                                        <span className="doc-icon">{getFileIcon(doc.type)}</span>
                                        <span className="doc-name">{doc.name}</span>
                                        {activeDocId === doc.id && isSyncing && (
                                            <RefreshCw size={10} className="animate-spin doc-sync-icon" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {/* Standalone Documents */}
                {standaloneDocs && standaloneDocs.length > 0 && (
                    <div className="standalone-docs-section">
                        <h4 className="section-subtitle">Single Docs</h4>
                        {standaloneDocs.map((doc) => (
                            <div
                                key={doc.id}
                                className={`document-item standalone ${activeDocId === doc.id ? 'active' : ''} ${activeDocId === doc.id && isSyncing ? 'syncing-doc' : ''}`}
                                onClick={() => {
                                    if (onOpenDoc) onOpenDoc(doc);
                                }}
                            >
                                <span className="doc-icon">📄</span>
                                <span className="doc-name">{doc.name}</span>
                                <span className="doc-time">
                                    {activeDocId === doc.id && isSyncing ? (
                                        <RefreshCw size={10} className="animate-spin doc-sync-icon" />
                                    ) : doc.lastModified}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Export & Sync Actions */}
            <div className="export-sync-section">
                <h3 className="section-title">export & sync</h3>

                <div className="export-buttons">
                    <button className="export-btn" onClick={handleCopyToClipboard}>
                        <Copy size={14} />
                        <span>Copy for G-Docs</span>
                    </button>
                    <button className="export-btn">
                        <Cloud size={14} />
                        <span>Sync to Drive</span>
                    </button>
                </div>

                <div className="export-formats">
                    <span className="format-label">Export as:</span>
                    <div className="format-chips">
                        <button className="format-chip">PDF</button>
                        <button
                            className={`format-chip ${activeDoc?.type === 'word' ? 'active-action' : ''}`}
                            onClick={handleExportWord}
                        >
                            DOCX
                        </button>
                        <button
                            className={`format-chip ${activeDoc?.type === 'ppt' ? 'active-action' : ''}`}
                            onClick={handleExportPPT}
                        >
                            PPTX
                        </button>
                        <button
                            className={`format-chip ${activeDoc?.type === 'excel' ? 'active-action' : ''}`}
                            onClick={handleExportXLSX}
                        >
                            XLSX
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectsDocs;
