import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Download, Cloud, FolderOpen, File, RefreshCw, Copy, Edit3 } from 'lucide-react';
import { docsAgentService } from '../../../services/docsAgentService';
import DocEditModal from './DocEditModal';

const ProjectsDocs = ({
    projects,
    standaloneDocs,
    onOpenDoc,
    onOpenProject, // New callback
    onUpdateDoc, // Callback after metadata edit
    isSyncing,
    activeDocId,
    activeProjectId // New prop
}) => {
    const [expandedProjects, setExpandedProjects] = useState([1]);
    const [syncing, setSyncing] = useState(false);
    const [localSyncStatus, setLocalSyncStatus] = useState(null);
    const [editingDoc, setEditingDoc] = useState(null);

    // Find the active document object
    const allDocs = [...standaloneDocs, ...projects.flatMap(p => p.documents)];
    const activeDoc = allDocs.find(d => String(d.id) === String(activeDocId));

    const handleLocalSync = async (doc, type) => {
        if (!doc) return;
        setLocalSyncStatus('syncing');

        try {
            // Find project name for folder nesting
            let projectName = "";
            const project = projects.find(p => p.documents.some(d => d.id === doc.id));
            if (project) projectName = project.name;

            const docToSync = { ...doc, type: type };
            await docsAgentService.automateLocalSave(docToSync, projectName);

            setLocalSyncStatus('success');
            setTimeout(() => setLocalSyncStatus(null), 6000);
        } catch (e) {
            console.error("Workspace Sync failed:", e);
            setLocalSyncStatus('error');
            setTimeout(() => setLocalSyncStatus(null), 4000);
        }
    };

    const handleExportXLSX = (doc = activeDoc) => handleLocalSync(doc, 'excel');
    const handleExportWord = (doc = activeDoc) => handleLocalSync(doc, 'word');
    const handleExportPPT = (doc = activeDoc) => handleLocalSync(doc, 'ppt');

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
                {projects.map((project) => {
                    const isWorkingProject = project.documents.some(d => String(d.id) === String(activeDocId)) || String(project.id) === String(activeProjectId);
                    const isSelected = String(project.id) === String(activeProjectId);

                    return (
                        <div key={project.id} className={`project-item ${isWorkingProject ? 'working-glow' : ''} ${isSelected ? 'selected-context' : ''}`}>
                            <div
                                className="project-header"
                                onClick={() => {
                                    if (onOpenProject) onOpenProject(project);
                                }}
                            >
                                <div className="project-info">
                                    <div
                                        className="project-toggle"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleProject(project.id);
                                        }}
                                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                    >
                                        {expandedProjects.includes(project.id) ? (
                                            <ChevronDown size={16} />
                                        ) : (
                                            <ChevronRight size={16} />
                                        )}
                                    </div>
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
                                            title={`Created on: ${new Date(doc.createdAt).toLocaleDateString()}`}
                                        >
                                            <div className="doc-main-info">
                                                <span className="doc-icon">{getFileIcon(doc.type)}</span>
                                                <span className="doc-name">{doc.name}</span>
                                            </div>
                                            <div className="doc-actions">
                                                <button
                                                    className="doc-mini-action doc-edit-action"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingDoc(doc);
                                                    }}
                                                    title="Edit Details"
                                                >
                                                    <Edit3 size={12} />
                                                </button>
                                                <button
                                                    className="doc-mini-action"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (doc.type === 'excel') handleExportXLSX(doc);
                                                        else if (doc.type === 'word') handleExportWord(doc);
                                                        else if (doc.type === 'ppt') handleExportPPT(doc);
                                                    }}
                                                    title="Quick Export"
                                                >
                                                    <Download size={12} />
                                                </button>
                                                {activeDocId === doc.id && isSyncing && (
                                                    <RefreshCw size={10} className="animate-spin doc-sync-icon" />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

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
                                title={`Created on: ${new Date(doc.createdAt).toLocaleDateString()}`}
                            >
                                <div className="doc-main-info">
                                    <span className="doc-icon">📄</span>
                                    <span className="doc-name">{doc.name}</span>
                                </div>
                                <div className="doc-actions">
                                    <button
                                        className="doc-mini-action doc-edit-action"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingDoc(doc);
                                        }}
                                        title="Edit Details"
                                    >
                                        <Edit3 size={12} />
                                    </button>
                                    <button
                                        className="doc-mini-action"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (doc.type === 'excel') handleExportXLSX(doc);
                                            else if (doc.type === 'word') handleExportWord(doc);
                                            else if (doc.type === 'ppt') handleExportPPT(doc);
                                        }}
                                        title="Export"
                                    >
                                        <Download size={12} />
                                    </button>
                                    {activeDocId === doc.id && isSyncing && (
                                        <RefreshCw size={10} className="animate-spin doc-sync-icon" />
                                    )}
                                </div>
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

                {/* Workspace Sync Notification */}
                {localSyncStatus && (
                    <div className={`sync-notification sidebar-sync ${localSyncStatus}`}>
                        {localSyncStatus === 'syncing' ? (
                            <><RefreshCw size={12} className="animate-spin" /> Syncing...</>
                        ) : localSyncStatus === 'success' ? (
                            <span>Saved to <strong
                                className="clickable-path"
                                onClick={() => {
                                    const activeDoc = allDocs.find(d => String(d.id) === String(activeDocId));
                                    let projectName = "";
                                    if (activeDoc) {
                                        const project = projects.find(p => p.documents.some(d => String(d.id) === String(activeDoc.id)));
                                        if (project) projectName = project.name;
                                    }
                                    console.log("[DocsAgent] Requesting sidebar folder open for project:", projectName || "Standalone");
                                    docsAgentService.openWorkspace(projectName);
                                }}
                                title="Click to open folder"
                            >nurotra workplace</strong></span>
                        ) : (
                            <span>Sync failed</span>
                        )}
                    </div>
                )}
            </div>
            {/* Doc Edit Modal */}
            {editingDoc && (
                <DocEditModal
                    doc={editingDoc}
                    onSave={async (docId, metadata) => {
                        const updated = await docsAgentService.updateDocumentMetadata(docId, metadata);
                        if (onUpdateDoc) onUpdateDoc(updated);
                    }}
                    onClose={() => setEditingDoc(null)}
                />
            )}
        </div>
    );
};

export default ProjectsDocs;
