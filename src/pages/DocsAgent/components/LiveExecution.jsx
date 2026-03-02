import React, { useState } from 'react';
import { CheckCircle, Edit, X, FileText, File, Download, RefreshCw, Copy, Zap, ChevronDown } from 'lucide-react';
import EntryPoint from './EntryPoint';
import { generateWordDoc, generateExcelSheet, generatePresentation } from '../../../services/generatorService';
import { docsAgentService } from '../../../services/docsAgentService';

const LiveExecution = ({
    projects,
    executionState,
    currentDoc,
    liveUpdates,
    onProjectCreated,
    onDocCreated,
    onApprovePlan,
    onUpdateContent,
    onCancelExecution
}) => {
    const [syncStatus, setSyncStatus] = useState(null);
    // ... (existing state)
    const [editMode, setEditMode] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);

    const handleExport = async (format) => {
        if (!currentDoc) return;
        setShowExportMenu(false);
        setSyncStatus('syncing');

        try {
            // Find project name for folder nesting
            let projectName = "";
            if (currentDoc.projectId && projects) {
                const project = projects.find(p => p.id === currentDoc.projectId);
                projectName = project ? project.name : "";
            }

            // TRIGGER BACKEND SYNC (Saves to 'nurotra workplace')
            const docToSync = {
                ...currentDoc,
                type: format === 'xlsx' ? 'excel' : format === 'pptx' ? 'ppt' : 'word'
            };

            const result = await docsAgentService.automateLocalSave(docToSync, projectName, format);
            if (!result) throw new Error("Backend returned empty response");

            setSyncStatus('success');
            setTimeout(() => setSyncStatus(null), 6000);
        } catch (e) {
            console.error("Workspace Sync failed:", e);
            setSyncStatus('error');
            setTimeout(() => setSyncStatus(null), 4000);
        }
    };

    // 1. Idle / Entrance
    if (executionState.status === 'idle' && !currentDoc) {
        return (
            <div className="live-execution-panel">
                <EntryPoint
                    onCreateProject={onProjectCreated}
                    onCreateSingleDoc={onDocCreated}
                />
            </div>
        );
    }

    // 1.5. Awaiting Input (User clicked Single Doc or created a Project — waiting for prompt)
    if (executionState.status === 'awaiting_input' && !currentDoc) {
        return (
            <div className="live-execution-panel" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1.5rem',
                padding: '3rem'
            }}>
                <div style={{
                    width: '60px', height: '60px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(147,51,234,0.3) 0%, transparent 70%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'pulse 2s ease-in-out infinite'
                }}>
                    <FileText size={28} style={{ color: 'rgba(147,51,234,0.9)' }} />
                </div>
                <h2 style={{
                    fontSize: '1.4rem', fontWeight: '600',
                    color: 'rgba(255,255,255,0.9)',
                    margin: 0
                }}>
                    Ready for your command.
                </h2>
                <p style={{
                    fontSize: '0.9rem',
                    color: 'rgba(255,255,255,0.5)',
                    textAlign: 'center',
                    maxWidth: '320px',
                    lineHeight: '1.6',
                    margin: 0
                }}>
                    Describe what you need in the chat panel →<br />
                    I'll generate the document for you.
                </p>
            </div>
        );
    }

    // 2. Planning Phase
    if (executionState.status === 'planning') {
        return (
            <div className="live-execution-panel planning-mode">
                <div className="plan-header">
                    <h2>IMPLEMENTATION PLAN</h2>
                    <p>I've analyzed your request. Here is how I plan to proceed:</p>
                </div>

                <div className="plan-card">
                    <h3 className="plan-goal">{executionState.plan?.goal}</h3>
                    <div className="plan-steps">
                        {executionState.plan?.steps.map((step, idx) => (
                            <div key={idx} className="plan-step-item">
                                <span className="step-num">{idx + 1}</span>
                                <span className="step-label">{step.label}</span>
                            </div>
                        ))}
                    </div>

                    <div className="plan-risks">
                        <h4><Zap size={14} style={{ marginRight: '8px' }} /> Potential Optimization</h4>
                        <p>I will use Smart Memory to ensure this aligns with your previous Expert Standards.</p>
                    </div>

                    <div className="plan-actions">
                        <button className="plan-btn secondary" onClick={onCancelExecution}>
                            <X size={16} /> Cancel
                        </button>
                        <button className="plan-btn primary" onClick={onApprovePlan}>
                            <CheckCircle size={16} /> Approve & Execute
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // 3. Execution Phase
    if (executionState.status === 'executing') {
        const progress = (executionState.currentStep / executionState.totalSteps) * 100;
        return (
            <div className="working-context-glow">
                <div className="live-execution-panel focus-mode">
                    <div className="action-timeline">
                        <div className="timeline-content">
                            <span className="timeline-step">STEP {executionState.currentStep}/{executionState.totalSteps}</span>
                            <span className="timeline-task">Working on your document...</span>
                        </div>
                        <div className="timeline-progress">
                            <div
                                className="timeline-bar"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    <div className="execution-activity dynamic-logs" ref={el => { if (el) el.scrollTop = el.scrollHeight; }}>
                        {liveUpdates && liveUpdates.length > 0 ? (
                            liveUpdates.map((log, i) => (
                                <div
                                    key={`log-${i}-${log.substring(0, 10)}`}
                                    className={`activity-item ${i === liveUpdates.length - 1 ? 'active' : 'historical'}`}
                                    style={{ animationDelay: `${i * 0.08}s` }}
                                >
                                    <div className="activity-dot"></div>
                                    <div className="activity-text">{log}</div>
                                </div>
                            ))
                        ) : (
                            <div className="activity-item active">
                                <div className="activity-dot"></div>
                                <div className="activity-text">Getting things started...</div>
                            </div>
                        )}
                    </div>

                    <div className="mini-canvas-preview">
                        <div className="preview-header">
                            <FileText size={14} />
                            <span>Live Preview</span>
                        </div>
                        <div className="preview-snippet">
                            {currentDoc?.content ? (
                                <pre>{currentDoc.content}</pre>
                            ) : (
                                <p>Building real-time content...</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // 4. Editor / Preview Canvas (When a doc is open)
    if (currentDoc) {
        return (
            <div className="working-context-glow">
                <div className="live-execution-panel editor-mode">
                    <div className="editor-toolbar">
                        <div className="doc-detail-meta">
                            <FileText size={16} />
                            <span className="doc-name-display">{currentDoc.name}</span>
                        </div>
                        <div className="toolbar-actions">

                            <div style={{ position: 'relative' }}>
                                <button
                                    className="tool-btn highlight"
                                    onClick={() => setShowExportMenu(!showExportMenu)}
                                >
                                    <Download size={14} /> Export <ChevronDown size={14} />
                                </button>
                                {showExportMenu && (
                                    <div className="export-dropdown" style={{
                                        position: 'absolute',
                                        top: '100%',
                                        right: 0,
                                        marginTop: '0.5rem',
                                        background: '#000000',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        borderRadius: '8px',
                                        padding: '0.5rem',
                                        zIndex: 50,
                                        minWidth: '160px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.25rem',
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                                    }}>
                                        <button
                                            className="export-dropdown-item export-item-word"
                                            onClick={() => handleExport('docx')}
                                        >
                                            <FileText size={14} /> As Word (.docx)
                                        </button>
                                        <button
                                            className="export-dropdown-item export-item-excel"
                                            onClick={() => handleExport('xlsx')}
                                        >
                                            <FileText size={14} /> As Excel (.xlsx)
                                        </button>
                                        <button
                                            className="export-dropdown-item export-item-ppt"
                                            onClick={() => handleExport('pptx')}
                                        >
                                            <FileText size={14} /> As PowerPoint (.pptx)
                                        </button>
                                    </div>
                                )}
                            </div>
                            <button className="tool-btn" onClick={() => {
                                navigator.clipboard.writeText(currentDoc.content);
                                alert("Copied to clipboard! Ready to paste into Google Docs.");
                            }}>
                                <Copy size={14} /> Copy for G-Docs
                            </button>
                            <button
                                className={`tool-btn ${editMode ? 'active' : ''}`}
                                onClick={() => setEditMode(!editMode)}
                            >
                                <Edit size={14} /> {editMode ? 'Preview' : 'Edit'}
                            </button>
                        </div>

                        {/* Workspace Sync Notification */}
                        {syncStatus === 'syncing' && (
                            <div className="sync-notification info">
                                <RefreshCw size={14} className="animate-spin" /> Synchronizing to Workspace...
                            </div>
                        )}
                        {syncStatus === 'success' && (
                            <div className="sync-notification success">
                                <CheckCircle size={14} />
                                <span>File exported to <strong
                                    className="clickable-path"
                                    onClick={() => {
                                        let projectName = "";
                                        if (currentDoc.projectId && projects) {
                                            const project = projects.find(p => String(p.id) === String(currentDoc.projectId));
                                            projectName = project ? project.name : "";
                                        }
                                        console.log("[DocsAgent] Requesting to open workspace for project:", projectName || "Standalone");
                                        docsAgentService.openWorkspace(projectName);
                                    }}
                                    title="Click to open in File Explorer"
                                > nurotra workplace</strong></span>
                            </div>
                        )}
                        {syncStatus === 'error' && (
                            <div className="sync-notification error">
                                <X size={14} /> Failed to sync. Check server logs.
                            </div>
                        )}
                    </div>

                    <div className="canvas-content-wrapper">
                        {editMode ? (
                            <textarea
                                className="rich-editor"
                                value={currentDoc.content || ''}
                                onChange={(e) => onUpdateContent(e.target.value)}
                                placeholder="Begin your masterpiece..."
                            />
                        ) : (
                            <div className="markdown-preview">
                                {currentDoc.content ? (
                                    <pre className="preview-text">{currentDoc.content}</pre>
                                ) : (
                                    <div className="empty-canvas">
                                        <File size={40} className="empty-icon" />
                                        <p>No content available to preview.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

export default LiveExecution;
