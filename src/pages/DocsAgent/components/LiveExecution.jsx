import React, { useState } from 'react';
import { CheckCircle, Edit, X, FileText, File, Download, RefreshCw, Copy, Zap } from 'lucide-react';
import EntryPoint from './EntryPoint';
import { exportToExcel } from '../../../services/excelService';
import { exportToWord } from '../../../services/wordService';
import { exportToPPT } from '../../../services/pptService';

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

    const handleExport = () => {
        if (!currentDoc) return;
        const name = currentDoc.name.toLowerCase();
        if (name.includes('.xlsx')) exportToExcel(currentDoc.name, currentDoc.content);
        else if (name.includes('.docx')) exportToWord(currentDoc.name, currentDoc.content);
        else if (name.includes('.pptx')) exportToPPT(currentDoc.name, currentDoc.content);
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
                        {(currentDoc?.name?.toLowerCase().includes('.xlsx') ||
                            currentDoc?.name?.toLowerCase().includes('.docx') ||
                            currentDoc?.name?.toLowerCase().includes('.pptx')) && (
                                <button className="tool-btn highlight" onClick={handleExport}>
                                    <Download size={14} />
                                    {currentDoc.name.toLowerCase().includes('.xlsx') ? 'Export XLSX' :
                                        currentDoc.name.toLowerCase().includes('.docx') ? 'Export DOCX' : 'Export PPTX'}
                                </button>
                            )}
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
