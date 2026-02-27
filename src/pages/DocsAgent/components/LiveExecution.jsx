import React, { useState } from 'react';
import { CheckCircle, Edit, X, FileText, File, Download, RefreshCw, Copy, Zap, ChevronDown } from 'lucide-react';
import EntryPoint from './EntryPoint';
import FileDashboard from './FileDashboard';
import { docsAgentService } from '../../../services/docsAgentService';

const LiveExecution = ({
    projects = [],
    executionState = { status: 'idle' },
    currentDoc = null,
    liveUpdates = [],
    centerView = 'dashboard',
    currentWorkspace = null,
    onProjectCreated,
    onDocCreated,
    onApprovePlan,
    onUpdateContent,
    onOpenFile,
    onPickWorkspace,
    onCancelExecution
}) => {
    // Verify props at entrance
    if (!onDocCreated) {
        console.warn("[LiveExecution] Warning: onDocCreated prop is missing.");
    }
    const [syncStatus, setSyncStatus] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);

    const handleExport = async (format) => {
        if (!currentDoc) return;
        setShowExportMenu(false);
        setSyncStatus('syncing');

        try {
            let projectName = "";
            if (currentDoc.projectId && projects) {
                const project = projects.find(p => String(p.id) === String(currentDoc.projectId));
                projectName = project ? project.name : "";
            }

            const docToSync = {
                ...currentDoc,
                type: format === 'xlsx' ? 'excel' : format === 'pptx' ? 'ppt' : 'word'
            };

            await docsAgentService.automateLocalSave(docToSync, projectName, format);
            setSyncStatus('success');
            setTimeout(() => setSyncStatus(null), 6000);
        } catch (e) {
            console.error("Workspace Sync failed:", e);
            setSyncStatus('error');
            setTimeout(() => setSyncStatus(null), 4000);
        }
    };

    // 0. Workspace Dashboard (Start Page)
    if (centerView === 'dashboard' && !currentDoc && executionState.status === 'idle') {
        return (
            <div className="live-execution-panel focus-mode">
                <FileDashboard
                    currentWorkspace={currentWorkspace}
                    onOpenFile={onOpenFile}
                    onCreateNew={onDocCreated}
                />
            </div>
        );
    }

    // 1. Idle / Entrance
    if (centerView === 'entry' && !currentDoc && executionState.status === 'idle') {
        return (
            <div className="live-execution-panel">
                <EntryPoint
                    onCreateProject={onProjectCreated}
                    onCreateSingleDoc={onDocCreated}
                />
            </div>
        );
    }

    // 1.5. Awaiting Input
    if (executionState.status === 'awaiting_input' && !currentDoc) {
        return (
            <div className="live-execution-panel workspace-ready-state">
                <div className="status-pulsar">
                    <FileText size={28} />
                </div>
                <h2>Ready for your command.</h2>
                <p>Describe what you need in the chat panel →<br />I'll generate the document for you.</p>
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
        const progress = (executionState.currentStep / (executionState.totalSteps || 1)) * 100;
        return (
            <div className="working-context-glow">
                <div className="live-execution-panel focus-mode">
                    <div className="action-timeline">
                        <div className="timeline-content">
                            <span className="timeline-step">STEP {executionState.currentStep}/{executionState.totalSteps}</span>
                            <span className="timeline-task">Working on your document...</span>
                        </div>
                        <div className="timeline-progress"><div className="timeline-bar" style={{ width: `${progress}%` }} /></div>
                    </div>
                    <div className="execution-activity dynamic-logs">
                        {liveUpdates?.map((log, i) => (
                            <div key={i} className="activity-item active">
                                <div className="activity-dot" />
                                <div className="activity-text">{log}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // 4. Editor / Preview
    if (currentDoc) {
        return (
            <div className="working-context-glow">
                <div className="live-execution-panel editor-mode">
                    <div className="editor-toolbar">
                        <div className="doc-detail-meta"><FileText size={16} /> <span className="doc-name-display">{currentDoc.name}</span></div>
                        <div className="toolbar-actions">
                            <div style={{ position: 'relative' }}>
                                <button className="tool-btn highlight" onClick={() => setShowExportMenu(!showExportMenu)}>
                                    <Download size={14} /> Export <ChevronDown size={14} />
                                </button>
                                {showExportMenu && (
                                    <div className="export-dropdown">
                                        <button className="export-dropdown-item" onClick={() => handleExport('docx')}>Word (.docx)</button>
                                        <button className="export-dropdown-item" onClick={() => handleExport('xlsx')}>Excel (.xlsx)</button>
                                        <button className="export-dropdown-item" onClick={() => handleExport('pptx')}>PowerPoint (.pptx)</button>
                                    </div>
                                )}
                            </div>
                            <button className="tool-btn" onClick={() => { navigator.clipboard.writeText(currentDoc.content); alert("Copied!"); }}>
                                <Copy size={14} /> Copy
                            </button>
                            <button className={`tool-btn ${editMode ? 'active' : ''}`} onClick={() => setEditMode(!editMode)}>
                                <Edit size={14} /> {editMode ? 'Preview' : 'Edit'}
                            </button>
                        </div>
                    </div>
                    <div className="canvas-content-wrapper">
                        {editMode ? (
                            <textarea className="rich-editor" value={currentDoc.content || ''} onChange={(e) => onUpdateContent(e.target.value)} />
                        ) : (
                            <div className="markdown-preview"><pre className="preview-text">{currentDoc.content}</pre></div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

export default LiveExecution;
