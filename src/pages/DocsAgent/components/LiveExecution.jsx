import React, { useState } from 'react';
import { CheckCircle, Edit, X, FileText, File, Download, RefreshCw, Copy, Zap, ChevronDown } from 'lucide-react';
import EntryPoint from './EntryPoint';
import { exportToExcel } from '../../../services/excelService';
import { exportToWord } from '../../../services/wordService';
import { exportToPPT } from '../../../services/pptService';
import { generateWordDoc, generateExcelSheet, generatePresentation } from '../../../services/generatorService';

const LiveExecution = ({
    executionState,
    currentDoc,
    liveUpdates,
    onProjectCreated,
    onDocCreated,
    onApprovePlan,
    onUpdateContent,
    onCancelExecution
}) => {
    // ... (existing state)
    const [editMode, setEditMode] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);

    const handleExport = async (format) => {
        if (!currentDoc) return;
        setShowExportMenu(false);
        const name = currentDoc.name.replace(/\.[^/.]+$/, ""); // Strip existing extension if any

        try {
            if (format === 'xlsx') {
                // Try generic export if strict data isn't available, or use excelService fallback
                await exportToExcel(name, currentDoc.content);
            } else if (format === 'docx') {
                await exportToWord(name, currentDoc.content);
            } else if (format === 'pptx') {
                await exportToPPT(name, currentDoc.content);
            }
        } catch (e) {
            console.error("Export failed:", e);
            alert("Export failed. Please try again.");
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
            <div className="live-execution-panel focus-mode">
                <div className="action-timeline">
                    <div className="timeline-content">
                        <span className="timeline-step">STEP {executionState.currentStep}/{executionState.totalSteps}</span>
                        <span className="timeline-task">Executing Document Intent...</span>
                    </div>
                    <div className="timeline-progress">
                        <div
                            className="timeline-bar"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                <div className="execution-activity dynamic-logs">
                    {liveUpdates && liveUpdates.length > 0 ? (
                        liveUpdates.slice(-3).map((log, i) => (
                            <div key={i} className={`activity-item ${i === liveUpdates.slice(-3).length - 1 ? 'active' : 'historical'}`}>
                                <div className="activity-dot"></div>
                                <div className="activity-text">{log}</div>
                            </div>
                        ))
                    ) : (
                        <div className="activity-item active">
                            <div className="activity-dot"></div>
                            <div className="activity-text">Initializing cognitive execution...</div>
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
        );
    }

    // 4. Content Viewer / Editor
    if (currentDoc) {
        return (
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
                                    <button className="dropdown-item" onClick={() => handleExport('docx')} style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#d1d5db',
                                        padding: '0.5rem',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}>
                                        <FileText size={14} /> As Word (.docx)
                                    </button>
                                    <button className="dropdown-item" onClick={() => handleExport('xlsx')} style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#d1d5db',
                                        padding: '0.5rem',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}>
                                        <FileText size={14} /> As Excel (.xlsx)
                                    </button>
                                    <button className="dropdown-item" onClick={() => handleExport('pptx')} style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#d1d5db',
                                        padding: '0.5rem',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}>
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
        );
    }

    return null;
};

export default LiveExecution;
