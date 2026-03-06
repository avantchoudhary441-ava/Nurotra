import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Download, Cloud, FolderOpen, File, RefreshCw, Copy, Edit3, Trash2, Clock } from 'lucide-react';
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
    activeProjectId,
    selectedDocIds = [],
    onToggleDocSelection
}) => {
    const [expandedProjects, setExpandedProjects] = useState([1]);
    const [downloading, setDownloading] = useState(null);
    const [downloadStatus, setDownloadStatus] = useState(null);
    const [deleting, setDeleting] = useState(null); // docId currently being deleted
    const [editingDoc, setEditingDoc] = useState(null);

    // Find the active document object
    const allDocs = [...standaloneDocs, ...projects.flatMap(p => p.documents)];
    const activeDoc = allDocs.find(d => String(d.id) === String(activeDocId));

    // ─── Cloud download handler ─────────────────────────────────────────────
    const handleDownload = async (doc) => {
        if (!doc) return;
        const docId = doc.id || doc._id;
        setDownloading(docId);
        setDownloadStatus(null);
        try {
            await docsAgentService.downloadFile(docId, doc.name);
            setDownloadStatus('success');
        } catch (e) {
            console.error('Download failed:', e);
            setDownloadStatus('error');
        } finally {
            setDownloading(null);
            setTimeout(() => setDownloadStatus(null), 4000);
        }
    };

    // Legacy alias for format chips — always downloads the active doc
    const handleExportWord = () => handleDownload(activeDoc);
    const handleExportXLSX = () => handleDownload(activeDoc);
    const handleExportPPT = () => handleDownload(activeDoc);

    // ─── Delete handler ─────────────────────────────────────────────────────
    const handleDelete = async (doc, e) => {
        e.stopPropagation();
        const docId = doc.id || doc._id;
        if (!window.confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;
        setDeleting(docId);
        try {
            await docsAgentService.deleteDocument(docId);
            // Notify parent to refresh the list
            if (onUpdateDoc) onUpdateDoc(null, docId);
        } catch (err) {
            console.error('Delete failed:', err);
            alert('Failed to delete document. Please try again.');
        } finally {
            setDeleting(null);
        }
    };

    const handleCopyToClipboard = () => {
        if (activeDoc?.content) {
            navigator.clipboard.writeText(activeDoc.content);
            alert("Copied to clipboard! Ready to paste into Google Docs.");
        }
    };

    const handleSync = async () => {
        // Refresh is handled automatically — just give visual feedback
        setDownloadStatus(null);
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
                        className="new-project-btn"
                        onClick={handleSync}
                        title="Sync with cloud"
                    >
                        <RefreshCw size={14} />
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
                                                <input
                                                    type="checkbox"
                                                    className="doc-selector-check"
                                                    checked={selectedDocIds.includes(doc.id)}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        if (onToggleDocSelection) onToggleDocSelection(doc.id);
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <span className="doc-icon">{getFileIcon(doc.type)}</span>
                                                <span className="doc-name">{doc.name}</span>
                                                {doc.isDue && (
                                                    <span className="reval-badge" title="This document is due for revaluation">
                                                        <Clock size={12} />
                                                    </span>
                                                )}
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
                                                        handleDownload(doc);
                                                    }}
                                                    title="Download from Cloud"
                                                    disabled={downloading === (doc.id || doc._id)}
                                                >
                                                    {downloading === (doc.id || doc._id)
                                                        ? <RefreshCw size={12} className="animate-spin" />
                                                        : <Download size={12} />}
                                                </button>
                                                <button
                                                    className="doc-mini-action doc-delete-action"
                                                    onClick={(e) => handleDelete(doc, e)}
                                                    title="Delete Document"
                                                    disabled={deleting === (doc.id || doc._id)}
                                                >
                                                    {deleting === (doc.id || doc._id)
                                                        ? <RefreshCw size={12} className="animate-spin" />
                                                        : <Trash2 size={12} />}
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
                                    <input
                                        type="checkbox"
                                        className="doc-selector-check"
                                        checked={selectedDocIds.includes(doc.id)}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            if (onToggleDocSelection) onToggleDocSelection(doc.id);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <span className="doc-icon">📄</span>
                                    <span className="doc-name">{doc.name}</span>
                                    {doc.isDue && (
                                        <span className="reval-badge" title="This document is due for revaluation">
                                            <Clock size={12} />
                                        </span>
                                    )}
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
                                            handleDownload(doc);
                                        }}
                                        title="Download from Cloud"
                                        disabled={downloading === (doc.id || doc._id)}
                                    >
                                        {downloading === (doc.id || doc._id)
                                            ? <RefreshCw size={12} className="animate-spin" />
                                            : <Download size={12} />}
                                    </button>
                                    <button
                                        className="doc-mini-action doc-delete-action"
                                        onClick={(e) => handleDelete(doc, e)}
                                        title="Delete Document"
                                        disabled={deleting === (doc.id || doc._id)}
                                    >
                                        {deleting === (doc.id || doc._id)
                                            ? <RefreshCw size={12} className="animate-spin" />
                                            : <Trash2 size={12} />}
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

            {/* Export & Sync Actions — temporarily disabled */}
            {false && (
                <div className="export-sync-section">
                    <h3 className="section-title">export &amp; sync</h3>

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

                    {/* Cloud Download Notification */}
                    {downloadStatus && (
                        <div className={`sync-notification sidebar-sync ${downloadStatus}`}>
                            {downloadStatus === 'success' ? (
                                <span>☁️ Downloaded from <strong>cloud workspace</strong></span>
                            ) : (
                                <span>❌ Download failed — try again</span>
                            )}
                        </div>
                    )}
                </div>
            )}
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
