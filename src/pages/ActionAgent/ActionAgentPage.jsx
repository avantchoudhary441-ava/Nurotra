import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    CheckCircle2, CircleDashed, AlertTriangle, Clock, History, Paperclip, 
    Send, Terminal, Loader2, Sparkles, Settings2, HardDrive, 
    Mail, FileSpreadsheet, Activity, Bell, FileText, Database, ShieldAlert
} from 'lucide-react';
import './ActionAgent.css';

// --- MOCK SIMULATION FLOWS ---
const FLOWS = {
    STANDARD: {
        title: "Uploading Report and Sending to Team",
        type: 'active',
        resources: [{ name: "Q4_Final_Report.pdf", source: "Resource Engine" }],
        steps: [
            { id: 1, label: "Generating Report via Docs Agent", status: "pending", icon: 'file', microLogs: ["Generating layout...", "Saving as PDF..."] },
            { id: 2, label: "Uploading to Drive", status: "pending", icon: 'drive', microLogs: ["Authenticating...", "Uploading (2.4MB)...", "Generating link..."] },
            { id: 3, label: "Dispatching via Communication Agent", status: "pending", icon: 'mail', microLogs: ["Drafting email to 'Team'...", "Email sent!"] }
        ]
    },
    INTERVENTION: {
        title: "Fetch Q3 Deck & Compile Stats",
        type: 'active',
        resources: [],
        steps: [
            { id: 1, label: "Searching Financial DB", status: "pending", icon: 'database', microLogs: ["Querying Q3 ledgers..."] },
            { id: 2, label: "Fetching Q3 Deck", status: "pending", icon: 'drive', requiresIntervention: true, interventionMsg: "Cannot find 'Q3_Deck_FINAL.pptx'. Please manually provide the link or file.", microLogs: ["Searching...", "File Not Found. Pausing for human intervention."] },
            { id: 3, label: "Compiling Statistics", status: "pending", icon: 'spreadsheet', microLogs: ["Aggregating metrics...", "Rows added."] }
        ]
    },
    BULK_SCHEDULED: {
        title: "Send Certificates to 50 Students",
        type: 'scheduled',
        scheduledTime: "19:00",
        resources: [{ name: "Student_List_2026.csv", source: "CRM Sync" }, { name: "Certificate_Template.docx", source: "Docs Engine" }],
        steps: [
            { id: 1, label: "Wait for Scheduled Time (7:00 PM)", status: "pending", icon: 'clock', isWait: true, microLogs: ["Monitoring time..."] },
            { id: 2, label: "Generate Personalized Files", status: "pending", icon: 'file', isBulk: true, totalItems: 50, microLogs: [] },
            { id: 3, label: "Distribute via Email", status: "pending", icon: 'mail', isBulk: true, totalItems: 50, microLogs: [] }
        ]
    }
};

const getFlowType = (text) => {
    if (text.toLowerCase().includes("stats") || text.toLowerCase().includes("deck")) return FLOWS.INTERVENTION;
    if (text.toLowerCase().includes("student") || text.toLowerCase().includes("bulk") || text.toLowerCase().includes("certificate")) return FLOWS.BULK_SCHEDULED;
    return FLOWS.STANDARD;
};

const IconHOC = ({ type, size = 16 }) => {
    switch(type) {
        case 'drive': return <HardDrive size={size} className="app-icon drive" />;
        case 'mail': return <Mail size={size} className="app-icon mail" />;
        case 'file': return <FileText size={size} className="app-icon doc" />;
        case 'spreadsheet': return <FileSpreadsheet size={size} className="app-icon sheets" />;
        case 'database': return <Database size={size} className="app-icon db" />;
        case 'clock': return <Clock size={size} className="app-icon time" />;
        default: return <Activity size={size} className="app-icon default" />;
    }
};

const ActionAgentPage = () => {
    const [leftWidth, setLeftWidth] = useState(window.innerWidth * 0.7);
    const isResizing = useRef(false);

    // View States
    const [activeTab, setActiveTab] = useState('active'); // active, scheduled, listening
    const [showHistory, setShowHistory] = useState(false);
    
    // Core Engine State
    const [activeTasks, setActiveTasks] = useState([]);      // Things running right now
    const [scheduledTasks, setScheduledTasks] = useState([]); // Things waiting
    const [taskHistory, setTaskHistory] = useState([]);
    const [commandInput, setCommandInput] = useState('');

    const [interventionInput, setInterventionInput] = useState('');

    // --- Core Simulation Engine ---
    const runSimulation = (input) => {
        const text = typeof input === 'string' ? input : commandInput;
        if (!text.trim()) return;

        const baseFlow = getFlowType(text);
        const newTask = {
            id: Date.now(),
            title: baseFlow.title,
            status: baseFlow.type === 'scheduled' ? 'waiting' : 'running', 
            type: baseFlow.type,
            startTime: Date.now(),
            elapsed: 0,
            currentStepIndex: 0,
            resources: baseFlow.resources,
            steps: JSON.parse(JSON.stringify(baseFlow.steps)),
            activeMicroLog: "Getting everything ready..."
        };

        if (baseFlow.type === 'scheduled') {
            setScheduledTasks(prev => [newTask, ...prev]);
            setActiveTab('scheduled');
        } else {
            setActiveTasks(prev => [newTask, ...prev]);
            setActiveTab('active');
            startTaskExecution(newTask.id, newTask);
        }

        setCommandInput('');
    };

    // Forces a scheduled task to run early
    const forceRunScheduled = (taskId) => {
        setScheduledTasks(prev => prev.filter(t => t.id !== taskId));
        setActiveTasks(prev => {
            const t = scheduledTasks.find(t => t.id === taskId);
            t.status = 'running';
            t.steps[0].status = 'completed'; // skip wait step
            t.currentStepIndex = 1;
            startTaskExecution(taskId, t);
            return [t, ...prev];
        });
        setActiveTab('active');
    };

    // Submits the intervention data and resumes
    const resolveIntervention = (taskId, stepIndex) => {
        if (!interventionInput.trim()) return;
        
        setActiveTasks(prev => prev.map(t => {
            if (t.id === taskId) {
                const updated = {...t};
                updated.steps[stepIndex].status = 'completed';
                updated.steps[stepIndex].activeMicroLog = "Received manual override. Resuming...";
                updated.status = 'running';
                
                // Immediately kick execution back off
                setTimeout(() => startTaskExecution(taskId, updated, stepIndex + 1), 600);
                return updated;
            }
            return t;
        }));
        setInterventionInput('');
    };

    const startTaskExecution = (taskId, task, startAtStep = 0) => {
        let stepIndex = startAtStep;
        let microIndex = 0;
        let bulkCounter = 0;

        const executeStep = () => {
            setActiveTasks(currentTasks => {
                const updatedTasks = [...currentTasks];
                const taskIdx = updatedTasks.findIndex(t => t.id === taskId);
                if (taskIdx === -1) return currentTasks; // Task gone
                const currentTask = updatedTasks[taskIdx];

                if (currentTask.status === 'intervention') return currentTasks; // Halt execution loop

                if (stepIndex >= currentTask.steps.length) {
                    currentTask.status = 'completed';
                    currentTask.activeMicroLog = "All tasks finished successfully!";
                    
                    // Move to history after 3 seconds
                    setTimeout(() => {
                        setActiveTasks(pt => pt.filter(t => t.id !== taskId));
                        setTaskHistory(hist => [currentTask, ...hist]);
                    }, 3000);
                    
                    return updatedTasks;
                }

                const currentStep = currentTask.steps[stepIndex];

                // Handle Bulk processing specific logic
                if (currentStep.isBulk) {
                    if (currentStep.status !== 'running') {
                        currentStep.status = 'running';
                    }
                    if (bulkCounter <= currentStep.totalItems) {
                        currentStep.bulkProgress = bulkCounter;
                        bulkCounter += Math.floor(Math.random() * 5) + 1; // Increment randomly
                        setTimeout(executeStep, 200);
                        return updatedTasks;
                    } else {
                        currentStep.bulkProgress = currentStep.totalItems;
                        currentStep.status = 'completed';
                        bulkCounter = 0;
                        stepIndex++;
                        setTimeout(executeStep, 400);
                        return updatedTasks;
                    }
                }

                // Handle Intervention Halt
                if (currentStep.requiresIntervention && currentStep.status === 'pending') {
                    currentStep.status = 'intervention'; // UI uses this to show input
                    currentTask.status = 'intervention'; // Halts task timer/status
                    currentTask.activeMicroLog = "Paused: Needs your input to continue.";
                    return updatedTasks;
                }

                // Standard Step Logging
                if (microIndex < currentStep.microLogs.length) {
                    currentStep.status = 'running';
                    currentTask.activeMicroLog = currentStep.microLogs[microIndex];
                    microIndex++;
                    setTimeout(executeStep, 800);
                } else {
                    currentStep.status = 'completed';
                    stepIndex++;
                    microIndex = 0;
                    setTimeout(executeStep, 500);
                }

                return updatedTasks;
            });
        };

        // Kickoff
        setTimeout(executeStep, 600);
    };

    // Timer sync for running tasks
    useEffect(() => {
        const timer = setInterval(() => {
            setActiveTasks(prev => prev.map(t => {
                if (t.status === 'running') {
                    return { ...t, elapsed: Math.floor((Date.now() - t.startTime) / 1000) };
                }
                return t;
            }));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // --- Resizing ---
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing.current) return;
            const newWidth = e.clientX;
            if (newWidth > 400 && newWidth < window.innerWidth - 300) {
                setLeftWidth(newWidth);
            }
        };
        const handleMouseUp = () => {
            isResizing.current = false;
            document.body.style.cursor = 'default';
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    // Get current visible task based on tab
    const visibleTasks = activeTab === 'scheduled' ? scheduledTasks : activeTasks;

    return (
        <div className="action-workspace-container">
            {/* --- LEFT: LIVE EXECUTION --- */}
            <div className="action-left-pane" style={{ width: leftWidth }}>
                
                <div className="stage-tabs-header">
                    <div className="stage-tabs">
                        <button className={`stage-tab ${activeTab === 'active' ? 'active' : ''}`} onClick={() => setActiveTab('active')}>
                            <Activity size={14} /> Active ({activeTasks.length})
                        </button>
                        <button className={`stage-tab ${activeTab === 'scheduled' ? 'active' : ''}`} onClick={() => setActiveTab('scheduled')}>
                            <Clock size={14} /> Scheduled ({scheduledTasks.length})
                        </button>
                    </div>
                </div>

                <div className="execution-stage">
                    {visibleTasks.length === 0 ? (
                        <div className="empty-stage-state">
                            <Terminal size={48} className="pulse-icon" />
                            <h2>{activeTab === 'scheduled' ? 'No Scheduled Tasks' : 'System Ready'}</h2>
                            <p>Waiting for your command. Tell me what you need done to start.</p>
                            
                            {/* Removed Connected Ecosystems section as requested */}
                        </div>
                    ) : (
                        <div className="active-execution-scrollable">
                            <AnimatePresence>
                                {visibleTasks.map(task => (
                                    <motion.div 
                                        key={task.id} 
                                        className={`execution-card ${task.status}`}
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, height: 0 }}
                                    >
                                        <div className="execution-header">
                                            <div className="exec-title-row">
                                                <Sparkles size={20} className="sparkle-icon" />
                                                <h2>{task.title}</h2>
                                                <div className={`status-pill ${task.status}`}>
                                                    {task.status === 'running' && <Loader2 size={14} className="spin-icon" />}
                                                    {task.status === 'intervention' && <ShieldAlert size={14} />}
                                                    {task.status === 'completed' && <CheckCircle2 size={14} />}
                                                    {task.status === 'waiting' && <Bell size={14} />}
                                                    {task.status.toUpperCase()}
                                                </div>
                                            </div>
                                            <div className="exec-timer">
                                                <Clock size={16} />
                                                {task.type === 'scheduled' && task.status === 'waiting' 
                                                    ? <span>Expected: {task.scheduledTime}</span>
                                                    : <span>{formatTime(task.elapsed)}</span>
                                                }
                                            </div>
                                        </div>

                                        <div className="timeline-container">
                                            {task.steps.map((step, idx) => {
                                                const isRunning = step.status === 'running';
                                                const isCompleted = step.status === 'completed';
                                                const isIntervention = step.status === 'intervention';
                                                
                                                return (
                                                    <div key={step.id} className={`timeline-step ${step.status}`}>
                                                        <div className="step-indicator">
                                                            {isCompleted ? <CheckCircle2 size={24} className="check-icon" />
                                                            : isIntervention ? <AlertTriangle size={24} className="alert-icon" />
                                                            : isRunning ? (
                                                                <div className="live-dot-container">
                                                                    <div className="live-dot" />
                                                                    <div className="live-dot-pulse" />
                                                                </div>
                                                            ) : <CircleDashed size={24} className="pending-icon" />}
                                                            {idx < task.steps.length - 1 && <div className="step-line" />}
                                                        </div>
                                                        <div className="step-content">
                                                            <div className="step-title-row">
                                                                <h4>{step.label}</h4>
                                                                <IconHOC type={step.icon} />
                                                            </div>
                                                            
                                                            {/* Standard Micro Log */}
                                                            <AnimatePresence>
                                                                {isRunning && !step.isBulk && (
                                                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="micro-log-terminal">
                                                                        <code>&gt; {task.activeMicroLog}</code>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>

                                                            {/* Bulk Progress Ring */}
                                                            {step.isBulk && (isRunning || isCompleted) && (
                                                                <div className="bulk-progress-container">
                                                                    <div className="progress-bar-bg">
                                                                        <div className="progress-bar-fill" style={{ width: `${(step.bulkProgress / step.totalItems) * 100}%` }}></div>
                                                                    </div>
                                                                    <span className="bulk-count">{Math.min(step.bulkProgress || 0, step.totalItems)} / {step.totalItems} Items Processed</span>
                                                                </div>
                                                            )}

                                                            {/* Intervention Interactive UI */}
                                                            <AnimatePresence>
                                                                {isIntervention && (
                                                                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="intervention-box">
                                                                        <p className="intervention-msg">{step.interventionMsg}</p>
                                                                        <div className="intervention-input-row">
                                                                            <input 
                                                                                type="text" 
                                                                                placeholder="Paste URL or ID here..." 
                                                                                value={interventionInput}
                                                                                onChange={(e) => setInterventionInput(e.target.value)}
                                                                            />
                                                                            <button onClick={() => resolveIntervention(task.id, idx)}>Resolve & Resume</button>
                                                                        </div>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>

                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Force Override for scheduled */}
                                        {task.type === 'scheduled' && task.status === 'waiting' && (
                                            <button className="force-run-btn" onClick={() => forceRunScheduled(task.id)}>
                                                Execute Now (Override Time)
                                            </button>
                                        )}

                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>

            <div className="pane-resizer" onMouseDown={() => { isResizing.current = true; document.body.style.cursor = 'col-resize'; }} />

            {/* --- RIGHT: COMMAND CENTER --- */}
            <div className="action-right-pane" style={{ width: `calc(100% - ${leftWidth}px)` }}>
                <div className="command-center-wrapper">
                    
                    <div className="cc-toolbar">
                        <button className={`history-toggle ${showHistory ? 'active' : ''}`} onClick={() => setShowHistory(!showHistory)}>
                            <History size={18} />
                            <span>History</span>
                        </button>
                        <button className="settings-icon-btn"><Settings2 size={18} /></button>
                    </div>

                    <div className="cc-dynamic-area">
                        {showHistory ? (
                            <div className="history-view">
                                <h3>Execution History</h3>
                                <div className="history-list">
                                    {taskHistory.length === 0 ? <p className="no-history">No tasks completed today.</p> : (
                                        taskHistory.map(task => (
                                            <div key={task.id} className="history-card">
                                                <div className="hist-header">
                                                    <span className="hist-title">{task.title}</span>
                                                    <CheckCircle2 size={16} className="hist-icon" />
                                                </div>
                                                <span className="hist-time">Completed in {formatTime(task.elapsed)}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="intent-view">
                                {(activeTasks[0] || scheduledTasks[0]) ? (
                                    <motion.div className="intent-display-card" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                                        <div className="intent-badge">Understood Goal</div>
                                        <h3>{(activeTasks[0] || scheduledTasks[0]).title}</h3>
                                        
                                        {/* Resource Grounding Auto-Fetch Indicator */}
                                        {((activeTasks[0] || scheduledTasks[0]).resources.length > 0) && (
                                            <div className="resource-grounding-section">
                                                <span>Auto-Fetched Resources:</span>
                                                <ul>
                                                    {(activeTasks[0] || scheduledTasks[0]).resources.map((res, i) => (
                                                        <li key={i}><Paperclip size={12}/> {res.name} <span className="res-source">via {res.source}</span></li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        <div className="orchestration-pills">
                                            <span className="agent-pill active">Orchestrator Central</span>
                                            <span className="agent-pill active">Action Agent</span>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <div className="quick-actions-grid">
                                        <h4>Suggested Automations</h4>
                                        <button className="quick-action-btn" onClick={() => runSimulation("Upload report and send to team")}>Upload report & send to team</button>
                                        <button className="quick-action-btn" onClick={() => runSimulation("Fetch Q3 Deck & compile stats")}>Fetch Q3 Deck & compile stats (Test Error State)</button>
                                        <button className="quick-action-btn" onClick={() => runSimulation("Send certificates to 50 students")}>Send certificates to 50 students (Test Bulk & Scheduled)</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="command-input-container">
                        <div className="input-attachments"><button className="attach-btn"><Paperclip size={20} /></button></div>
                        <input 
                            type="text" 
                            className="master-input" 
                            placeholder="Tell me what you need done..."
                            value={commandInput}
                            onChange={(e) => setCommandInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && runSimulation(commandInput)}
                        />
                        <button className="execute-btn" onClick={() => runSimulation(commandInput)} disabled={!commandInput.trim()}>
                            <Send size={18} />
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ActionAgentPage;
