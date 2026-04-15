import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Sparkles, Globe, User, ShieldAlert, AlertCircle, RefreshCw, X, Paperclip, CheckCircle2, AlertTriangle, Play, Pause, Activity } from 'lucide-react';
import { 
    CheckCircle2, CircleDashed, AlertTriangle, Clock, History, Paperclip, 
    Send, Terminal, Loader2, Sparkles, Settings2, HardDrive, 
    Mail, FileSpreadsheet, Activity, Bell, FileText, Database, ShieldAlert,
    Zap, ChevronRight, RotateCcw, Timer, ScrollText, Trash2, 
    ToggleLeft, ToggleRight, Radio, ArrowRight, RefreshCw, Workflow,
    ChevronDown, ChevronUp
} from 'lucide-react';
import SyncMonitor from './SyncMonitor';
import './ActionAgent.css';
import { io } from "socket.io-client";

// --- Typewriter Animation Component ---
const TypewriterText = ({ text, speed = 18 }) => {
    const [displayed, setDisplayed] = useState('');
    const idx = useRef(0);
    useEffect(() => {
        idx.current = 0;
        setDisplayed('');
        const iv = setInterval(() => {
            if (idx.current < text.length) {
                setDisplayed(text.slice(0, idx.current + 1));
                idx.current++;
            } else {
                clearInterval(iv);
            }
        }, speed);
        return () => clearInterval(iv);
    }, [text, speed]);
    return <span>{displayed}</span>;
};

const ActionAgentPage = () => {
    const navigate = useNavigate();

    // Core Engine State
    const [activeTasks, setActiveTasks] = useState([]);
    const [commandInput, setCommandInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [interventionInput, setInterventionInput] = useState('');

    // NLP Preview State
    const [nlpPreview, setNlpPreview] = useState(null);

    // Execution log visibility per task
    const [expandedLogs, setExpandedLogs] = useState({});
    const [expandedHistory, setExpandedHistory] = useState({});

    // Internal fast frontend simulator for DB OFFLINE mode
    const runMockOfflineSimulation = (mockWf) => {
        let currentStep = 0;
        let microLogIndex = 0;
        const simInterval = setInterval(() => {
            setActiveTasks(prev => {
                const newTasks = [...prev];
                const wfIndex = newTasks.findIndex(t => t._id === mockWf._id);
                if (wfIndex === -1) return prev;
                
                let wf = { ...newTasks[wfIndex] };
                if (currentStep < wf.steps.length) {
                    const currentStepData = wf.steps[currentStep];
                    wf.steps = wf.steps.map((s, idx) => {
                        if (idx < currentStep) return { ...s, status: 'completed' };
                        if (idx === currentStep) return { ...s, status: 'running' };
                        return s;
                    });
                    // Cycle through micro-logs for realism
                    const logs = currentStepData.microLogs || [];
                    wf.activeMicroLog = logs[microLogIndex % logs.length] || `Executing ${currentStepData.label}...`;
                    microLogIndex++;
                    
                    // Move to next step every 2 ticks (so each step takes ~6s visible time)
                    if (microLogIndex % 2 === 0) {
                        currentStep++;
                        microLogIndex = 0;
                    }
                } else if (currentStep === wf.steps.length) {
                    wf.steps = wf.steps.map(s => ({ ...s, status: 'completed' }));
                    wf.status = 'completed';
                    wf.activeMicroLog = "All tasks finished successfully!";
                    clearInterval(simInterval);
                }
                newTasks[wfIndex] = wf;
                return newTasks;
            });
        }, 3000);
    };

    // Layout State (Split Screen)
    const [leftWidth, setLeftWidth] = useState(window.innerWidth * 0.4);
    const isResizing = useRef(false);

    // Chat History State
    const [chatMessages, setChatMessages] = useState([]);
    const chatEndRef = useRef(null);

    // Browser Monitor State (Execution Screen)
    const [browserFrame, setBrowserFrame] = useState(null);
    const [monitorVisible, setMonitorVisible] = useState(true);
    const [monitorLoadingStart, setMonitorLoadingStart] = useState(null);
    const [showMonitorTroubleshoot, setShowMonitorTroubleshoot] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const monitorImgRef = useRef(null);
    const socketRef = useRef(null);

    // Initialization & Socket setup
    useEffect(() => {
        const socketUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin;
        socketRef.current = io(socketUrl, { withCredentials: true });

        socketRef.current.on('browser_frame', (data) => {
            setBrowserFrame(data);
            setMonitorLoadingStart(null);
            setShowMonitorTroubleshoot(false);
            setMonitorVisible(true);
            setIsConnecting(false); // Woke up!
        });

        socketRef.current.on('browser_block', (data) => {
            setMonitorVisible(true);
            setIsConnecting(false);
        });

        socketRef.current.on('chat_update', () => {
            fetchChat();
            fetchTasks();
        });

        fetchChat();
        fetchTasks();
        fetchSuggestions();

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    // Resizing Logic
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing.current) return;
            const newWidth = e.clientX;
            // Constrain width
            if (newWidth > 300 && newWidth < window.innerWidth - 300) {
                setLeftWidth(newWidth);
            }
        };
        const handleMouseUp = () => {
            if (isResizing.current) {
                isResizing.current = false;
                document.body.style.cursor = 'default';
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    // Polling Active Tasks
    useEffect(() => {
        const pollInterval = setInterval(() => {
            fetchTasks();
        }, 3000);
        return () => clearInterval(pollInterval);
    }, []);

    // Scroll chat to bottom
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages]);

    // Track active runs for timer
    useEffect(() => {
        const timer = setInterval(() => {
            setActiveTasks(prev => prev.map(t => {
                if (['running', 'waiting', 'retrying'].includes(t.status)) {
                    return { ...t, elapsed: Math.floor((Date.now() - new Date(t.startTime).getTime()) / 1000) };
                }
                return t;
            }));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchTasks = async () => {
        try {
            const activeRes = await fetch("http://localhost:5000/api/action-agent/active-tasks");
            const activeData = await activeRes.json();
            if (activeData.success) {
                const activeWithElapsed = activeData.tasks.filter(t => t.type !== 'scheduled').map(t => ({
                    ...t,
                    elapsed: t.startTime ? Math.floor((Date.now() - new Date(t.startTime).getTime()) / 1000) : 0
                }));
                setActiveTasks(activeWithElapsed);
            }
        } catch (error) {
            console.error("Failed to fetch tasks", error);
        }
    };

    const fetchChat = async () => {
        try {
            const res = await fetch("http://localhost:5000/api/action-agent/chat");
            const data = await res.json();
            if (data.success) {
                setChatMessages(data.messages || []);
            }
        } catch (error) {
            console.error("Failed to fetch chat history");
        }
    };

    const fetchSuggestions = async () => {
        try {
            const res = await fetch("http://localhost:5000/api/action-agent/suggestions");
            const data = await res.json();
            if (data.success && Array.isArray(data.suggestions)) {
                setSuggestions(data.suggestions);
            }
        } catch (error) {
            // Fail silently — fallback suggestions shown
            setSuggestions([
                "Search for current IPL scores",
                "Generate a weekly report",
                "What happened in tech news today?"
            ]);
        }
    };

    const sendCommand = async (inputStr) => {
        const text = typeof inputStr === 'string' ? inputStr : commandInput;
        if (!text.trim()) return;

        setCommandInput('');
        setIsLoading(true);
        setIsConnecting(true); // Wake up monitor

        try {
            const response = await fetch("http://localhost:5000/api/action-agent/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ command: text })
            });

            const data = await response.json();
            if (data.success) {
                fetchChat();
                fetchTasks();
                if (data.intent === 'WORKFLOW_EXECUTION' || data.workflow) {
                    setMonitorVisible(true);
                    setMonitorLoadingStart(Date.now());
                } else {
                    setIsConnecting(false);
                }
            } else {
                setIsConnecting(false);
                setChatMessages(prev => [...prev, {
                    _id: 'err_' + Date.now(),
                    role: 'system',
                    content: data.message || 'Could not start a new task.',
                    type: 'text',
                    timestamp: new Date().toISOString()
                }]);
            }
        } catch (error) {
            console.error("Execute command failed", error);
            setIsConnecting(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickAction = (actionText) => {
        setCommandInput(actionText);
        sendCommand(actionText);
    };

    // Smart renderer for structured AI output — muted, human-designed
    const renderStructuredContent = (text, animate = false) => {
        if (!text) return null;
        const lines = text.split('\n');
        return lines.map((line, i) => {
            const trimmed = line.trim();
            if (!trimmed) return <div key={i} style={{ height: 6 }} />;

            // Headlines (ALL CAPS or Task Complete)
            const isHeadline = (trimmed === trimmed.toUpperCase() && trimmed.length > 4 && !/^[•\-\*⚠]/.test(trimmed) && !trimmed.includes(':'))
                || trimmed.startsWith('✅') || trimmed.startsWith('📌');

            if (isHeadline) {
                return (
                    <div key={i} style={{ fontWeight: '600', fontSize: '13px', color: '#d0d0d0', marginBottom: 6, marginTop: i > 0 ? 12 : 0 }}>
                        {animate ? <TypewriterText text={trimmed} speed={10} /> : trimmed}
                    </div>
                );
            }

            // Warning
            if (trimmed.startsWith('⚠')) {
                return <div key={i} style={{ color: '#b8986a', fontSize: '12px', marginBottom: 4 }}>
                    {animate ? <TypewriterText text={trimmed} speed={10} /> : trimmed}
                </div>;
            }
    const deleteRule = async (ruleId) => {
        try {
            await fetch(`http://localhost:5000/api/action-agent/event-rules/${ruleId}`, { method: 'DELETE' });
            setEventRules(prev => prev.filter(r => r._id !== ruleId));
        } catch (e) { console.error(e); }
    };

    // --- Support UI Triggers ---
    const forceRunScheduled = (taskId) => {
        console.log("Force Override for ID", taskId);
    };

    const confirmAction = async (taskId) => {
        try {
            await fetch(`http://localhost:5000/api/action-agent/confirm/${taskId}`, { method: 'POST' });
            fetchTasks();
        } catch (e) { console.error(e); }
    };

    const resolveIntervention = async (taskId, field) => {
        if (!interventionInput.trim()) return;
        try {
            await fetch(`http://localhost:5000/api/action-agent/intervention/${taskId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ field, value: interventionInput })
            });
            setInterventionInput('');
            fetchTasks();
        } catch (e) { console.error(e); }
    };

            // Bullet points
            if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('  •')) {
                const content = trimmed.replace(/^[•\-\*]\s*|^\s+•\s*/, '');
                return (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 4, paddingLeft: trimmed.startsWith('  ') ? 12 : 0 }}>
                        <span style={{ color: '#555', fontSize: '12px', lineHeight: '1.5', flexShrink: 0, marginTop: 1 }}>—</span>
                        <span style={{ fontSize: '13px', color: '#bbb', lineHeight: '1.5' }}>
                            {animate ? <TypewriterText text={content} speed={15} /> : content}
                        </span>
                    </div>
                );
            }

            // Key: Value pair
            if (trimmed.includes(':') && !trimmed.startsWith('Source')) {
                const colonIdx = trimmed.indexOf(':');
                const key = trimmed.substring(0, colonIdx).trim();
                const value = trimmed.substring(colonIdx + 1).trim();
                if (key && value) {
                    return (
                        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, flexWrap: 'wrap', alignItems: 'baseline' }}>
                            <span style={{ color: '#666', fontWeight: '500', fontSize: '11px', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{key}</span>
                            <span style={{ color: '#e0e0e0', fontSize: '13px' }}>
                                {animate ? <TypewriterText text={value} speed={15} /> : value}
                            </span>
                        </div>
                    );
                }
    const toggleHistoryView = (taskId) => {
        setExpandedHistory(prev => ({ ...prev, [taskId]: !prev[taskId] }));
    };

    const dismissWorkflow = async (workflowId) => {
        // Handle local mock tasks (if ID starts with 'mock_')
        if (typeof workflowId === 'string' && workflowId.startsWith('mock_')) {
            setActiveTasks(prev => prev.filter(t => t._id !== workflowId));
            return;
        }

        try {
            const res = await fetch(`http://localhost:5000/api/action-agent/acknowledge/${workflowId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                fetchTasks();
            }
        } catch (error) {
            console.error("Failed to dismiss workflow:", error);
            // Fallback: remove locally if API fails
            setActiveTasks(prev => prev.filter(t => t._id !== workflowId));
        }
    };

    // --- Resizing ---
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing.current) return;
            const newWidth = e.clientX;
            if (newWidth > 400 && newWidth < window.innerWidth - 300) {
                setLeftWidth(newWidth);
            }

            // Default
            return (
                <div key={i} style={{ fontSize: '13px', color: '#aaa', lineHeight: '1.6', marginBottom: 2 }}>
                    {animate ? <TypewriterText text={trimmed} speed={10} /> : trimmed}
                </div>
            );
        });
    };

    // --- Interactive Browser Click Handlers ---
    const handleMonitorClick = (e) => {
        if (!monitorImgRef.current || !socketRef.current) return;
        const rect = monitorImgRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const scaleX = 1280 / rect.width;
        const scaleY = 720 / rect.height;
        const finalX = Math.round(x * scaleX);
        const finalY = Math.round(y * scaleY);
        const storedUser = localStorage.getItem('nurotra_user');
        const userId = storedUser ? JSON.parse(storedUser).userId || '000000000000000000000001' : '000000000000000000000001';
        socketRef.current.emit("browser_input", { userId, type: 'click', x: finalX, y: finalY });
    };

    const handleMonitorKeyDown = (e) => {
        if (!socketRef.current) return;
        if (['Backspace', 'Enter', 'Tab', 'Escape'].includes(e.key)) e.preventDefault();
        const storedUser = localStorage.getItem('nurotra_user');
        const userId = storedUser ? JSON.parse(storedUser).userId || '000000000000000000000001' : '000000000000000000000001';
        socketRef.current.emit("browser_input", { userId, type: 'keypress', key: e.key });
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'row',
            width: '100vw',
            height: '100vh',
            overflow: 'hidden',
            backgroundColor: '#000',
            color: '#fff'
        }}>

            {/* --- LEFT PANE (EXECUTION MONITOR) --- */}
            <div style={{
                width: leftWidth,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#080808',
                borderRight: '2px solid #1a1a1a',
                height: '100%'
            }}>
                {/* Header for Left Pane */}
                <div style={{
                    padding: '16px 20px',
                    backgroundColor: '#111',
                    borderBottom: '1px solid #222',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#888', fontWeight: '600', fontSize: '12px', letterSpacing: '0.5px' }}>
                        <Globe size={14} /> Execution Monitor
        <div className="action-workspace-container">
            {/* --- LEFT: LIVE EXECUTION --- */}
            <div className="action-left-pane" style={{ width: leftWidth }}>
                
                <div className="stage-tabs-header">
                    <div className="stage-tabs">
                        <button className={`stage-tab ${activeTab === 'active' ? 'active' : ''}`} onClick={() => setActiveTab('active')}>
                            <Activity size={14} /> Active
                            <span className="tab-count">{activeTasks.length}</span>
                        </button>
                        <button className={`stage-tab ${activeTab === 'scheduled' ? 'active' : ''}`} onClick={() => setActiveTab('scheduled')}>
                            <Clock size={14} /> Scheduled
                            <span className="tab-count">{scheduledTasks.length}</span>
                        </button>
                        <button className={`stage-tab ${activeTab === 'automations' ? 'active' : ''}`} onClick={() => { setActiveTab('automations'); fetchEventRules(); }}>
                            <Zap size={14} /> Automations
                            <span className="tab-count">{eventRules.length}</span>
                        </button>
                        <button className={`stage-tab ${activeTab === 'sync' ? 'active' : ''}`} onClick={() => setActiveTab('sync')}>
                            <RefreshCw size={14} /> Sync Monitor
                            <div className="live-pulse" />
                        </button>
                    </div>
                    {(activeTasks.length > 0 || isConnecting) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#666', fontSize: '11px' }}>
                            <div style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: isConnecting ? '#888' : '#aaa',
                                animation: 'pulse 2s infinite'
                            }} /> {isConnecting ? 'connecting' : 'active'}
                        </div>
                    )}
                </div>

                {/* Browser Viewport Area */}
                <div style={{
                    flex: '0 0 auto',
                    width: '100%',
                    aspectRatio: '16/9',
                    backgroundColor: '#000',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottom: '1px solid #1a1a1a',
                    borderLeft: (activeTasks.length > 0 || isConnecting) ? '2px solid #6c5ce7' : 'none'
                }}>
                    {browserFrame ? (
                        <img
                            ref={monitorImgRef}
                            src={browserFrame.frame}
                            alt="Browser View"
                            onClick={handleMonitorClick}
                            style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'crosshair' }}
                        />
                    ) : isConnecting ? (
                        <div style={{ textAlign: 'center', color: '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                            <Loader2 size={28} className="spin-icon" style={{ opacity: 0.5 }} />
                            <div style={{ fontSize: '12px', fontWeight: '500', color: '#555' }}>Starting agent session...</div>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', color: '#2a2a2a' }}>
                            <Globe size={36} style={{ opacity: 0.15, marginBottom: 10 }} />
                            <div style={{ fontSize: '12px', color: '#333' }}>Idle — awaiting command</div>
                        </div>
                    )}
                </div>

                {/* Execution Logs Area */}
                <div style={{ flex: 1, padding: '20px', overflowY: 'auto', backgroundColor: '#050505' }}>
                    <div style={{ color: '#444', fontSize: '10px', fontWeight: '800', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '1px' }}>System Logs</div>
                    {activeTasks.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {activeTasks[0].executionLogs?.map((log, i) => (
                                <div key={i} style={{ fontSize: '12px', fontFamily: 'monospace', color: log.level === 'error' ? '#ff4757' : log.level === 'success' ? '#7bed9f' : '#888' }}>
                                    <span style={{ color: '#6c5ce7', marginRight: 8 }}>&gt;</span> {log.message}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ color: '#222', fontSize: '12px', fontFamily: 'monospace' }}>Awaiting tasks...</div>
                            </div>
                        )
                    ) : activeTab === 'sync' ? (
                        /* --- SYNC MONITOR TAB --- */
                        <SyncMonitor />
                    ) : (
                        /* --- ACTIVE / SCHEDULED TABS --- */
                        (activeTab === 'active' ? activeTasks : scheduledTasks).length === 0 ? (
                            <div className="empty-stage-state">
                                <Terminal size={48} className="pulse-icon" />
                                <h2>{activeTab === 'scheduled' ? 'No Scheduled Tasks' : 'System Ready'}</h2>
                                <p>Waiting for your command. Tell me what you need done to start.</p>
                            </div>
                        ) : (
                            <div className="active-execution-scrollable">
                                <AnimatePresence>
                                    {(activeTab === 'active' ? activeTasks : scheduledTasks).map(task => (
                                        <motion.div 
                                            key={task._id || task.id} 
                                            className={`execution-card ${task.status}`}
                                            initial={{ opacity: 0, y: 30 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, height: 0 }}
                                        >
                                            <div className="execution-header">
                                                <div className="exec-title-row">
                                                    <Sparkles size={18} className="sparkle-icon" />
                                                    <h2>{task.title}</h2>
                                                    {task.isEventDriven && (
                                                        <span className="event-driven-indicator">
                                                            <Zap size={10} /> Event-Driven
                                                        </span>
                                                    )}
                                                    <div className={`status-pill ${task.status}`}>
                                                        {task.status === 'running' && <Loader2 size={12} className="spin-icon" />}
                                                        {task.status === 'intervention' && <ShieldAlert size={12} />}
                                                        {task.status === 'completed' && <CheckCircle2 size={12} />}
                                                        {task.status === 'waiting' && <Bell size={12} />}
                                                        {task.status === 'retrying' && <RefreshCw size={12} className="spin-icon" />}
                                                        {task.status === 'delayed' && <Timer size={12} />}
                                                        {task.status === 'failed' && <AlertTriangle size={12} />}
                                                        {task.status.toUpperCase()}
                                                    </div>
                                                    {task.executionMode === 'background' && task.status !== 'completed' && (
                                                        <span className="background-badge">
                                                            <ShieldAlert size={10} /> Autonomous
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="exec-timer-block">
                                                    {task.deadline && (
                                                        <div className="deadline-timer">
                                                            <Clock size={12} />
                                                            Due: {new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    )}
                                                    <Clock size={14} />
                                                    {task.type === 'scheduled' && task.status === 'waiting' 
                                                        ? <span>Expected: {task.scheduledTime}</span>
                                                        : <span>{formatTime(task.elapsed)}</span>
                                                    }
                                                </div>
                                                {task.status === 'waiting' && task.autoAcceptAt && (
                                                    <div className="auto-accept-countdown">
                                                        <Timer size={14} className="pulse-timer" />
                                                        <div className="countdown-info">
                                                            <span className="countdown-label">Auto-accepting in:</span>
                                                            <span className="countdown-value">
                                                                {formatTime(Math.max(0, Math.floor((new Date(task.autoAcceptAt).getTime() - Date.now()) / 1000)))}
                                                            </span>
                                                        </div>
                                                        <button className="confirm-now-btn" onClick={() => confirmAction(task._id)}>
                                                            Confirm Now
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Pipeline Flow Visualization */}
                                            {(task.triggerConfig || task.intentData?.trigger) && (
                                                <div className="pipeline-flow">
                                                    <div className="pipeline-node trigger-node">
                                                        <Radio size={10} />
                                                        {task.triggerConfig?.type || task.intentData?.trigger?.type || 'manual'}
                                                    </div>
                                                    <div className="pipeline-arrow"><ArrowRight size={12} /></div>
                                                    {(task.conditionRawText || task.intentData?.condition?.raw_text) && (
                                                        <>
                                                            <div className="pipeline-node condition-node">
                                                                <ShieldAlert size={10} />
                                                                {(task.conditionRawText || task.intentData?.condition?.raw_text || '').slice(0, 40)}
                                                            </div>
                                                            <div className="pipeline-arrow"><ArrowRight size={12} /></div>
                                                        </>
                                                    )}
                                                    <div className="pipeline-node action-node">
                                                        <Zap size={10} />
                                                        {task.steps?.length || 0} action{(task.steps?.length || 0) !== 1 ? 's' : ''}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Step Timeline */}
                                            <div className="timeline-container">
                                                {task.steps.map((step, idx) => {
                                                    const isRunning = step.status === 'running';
                                                    const isCompleted = step.status === 'completed';
                                                    const isIntervention = step.status === 'intervention';
                                                    const isRetrying = step.status === 'retrying';
                                                    const isDelayed = step.status === 'delayed';
                                                    
                                                    return (
                                                        <div key={step._id || step.id} className={`timeline-step ${step.status}`}>
                                                            <div className="step-indicator">
                                                                {isCompleted ? <CheckCircle2 size={20} className="check-icon" />
                                                                : isIntervention ? <AlertTriangle size={20} className="alert-icon" />
                                                                : isRetrying ? <RefreshCw size={20} className="spin-icon" style={{color: '#ffc107'}} />
                                                                : isDelayed ? <Timer size={20} style={{color: '#00d2ff'}} />
                                                                : isRunning ? (
                                                                    <div className="live-dot-container">
                                                                        <div className="live-dot" />
                                                                        <div className="live-dot-pulse" />
                                                                    </div>
                                                                ) : <CircleDashed size={20} className="pending-icon" />}
                                                                {idx < task.steps.length - 1 && <div className="step-line" />}
                                                            </div>
                                                            <div className="step-content">
                                                                <div className="step-title-row">
                                                                    <h4>{step.label}</h4>
                                                                    <IconHOC type={step.icon} size={14} />
                                                                </div>

                                                                {/* Step Badges (retry / delay) */}
                                                                {(step.retryConfig?.maxRetries > 0 || step.delayMs > 0) && (
                                                                    <div className="step-badges">
                                                                        {step.retryConfig?.maxRetries > 0 && (
                                                                            <span className="step-badge retry-badge">
                                                                                <RotateCcw size={9} />
                                                                                {step.retryConfig.retryCount || 0}/{step.retryConfig.maxRetries}
                                                                            </span>
                                                                        )}
                                                                        {step.delayMs > 0 && (
                                                                            <span className="step-badge delay-badge">
                                                                                <Timer size={9} />
                                                                                {Math.round(step.delayMs / 1000)}s delay
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                
                                                                <AnimatePresence>
                                                                    {(isRunning || isCompleted) && !step.isBulk && (
                                                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="micro-log-terminal">
                                                                            <code>&gt; {isRunning ? (task.activeMicroLog || step.microLogs?.[0] || '...') : (step.resultData ? 'Process completed. Viewing data below:' : 'Action completed successfully.')}</code>
                                                                                                                                                        {isCompleted && step.resultData && (
                                                                                <div className="step-result-display">
                                                                                    {step.metadata?.source && (
                                                                                        <div className="data-source-tag">
                                                                                            <Database size={10} />
                                                                                            Source: {step.metadata.source}
                                                                                        </div>
                                                                                    )}
                                                                                    {typeof step.resultData === 'string' ? (
                                                                                        <p>{step.resultData}</p>
                                                                                    ) : Array.isArray(step.resultData) ? (
                                                                                        <div className="result-data-grid">
                                                                                            {step.resultData.map((item, i) => (
                                                                                                <div key={i} className="result-data-item">
                                                                                                    {Object.entries(item).map(([k, v]) => (
                                                                                                        <div key={k} className="result-field">
                                                                                                            <span className="field-key">{k}:</span>
                                                                                                            <span className="field-val">{String(v)}</span>
                                                                                                        </div>
                                                                                                    ))}
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    ) : (
                                                                                        <pre className="result-json-pre">
                                                                                            {JSON.stringify(step.resultData, null, 2)}
                                                                                        </pre>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                                
                                                                {isCompleted && !task.isAcknowledged && (
                                                                    <div className="dismiss-action-row">
                                                                        <button className="dismiss-active-btn" onClick={() => dismissWorkflow(task._id)}>
                                                                            <CheckCircle2 size={12} />
                                                                            Dismiss & Archive to History
                                                                        </button>
                                                                    </div>
                                                                )}

                                                                {step.isBulk && (isRunning || isCompleted) && (
                                                                    <div className="bulk-progress-container">
                                                                        <div className="progress-bar-bg">
                                                                            <div className="progress-bar-fill" style={{ width: `${(step.bulkProgress / step.totalItems) * 100}%` }}></div>
                                                                        </div>
                                                                        <span className="bulk-count">{Math.min(step.bulkProgress || 0, step.totalItems)} / {step.totalItems} Items Processed</span>
                                                                    </div>
                                                                )}

                                                                <AnimatePresence>
                                                                    {isIntervention && (
                                                                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="intervention-box">
                                                                            <ShieldAlert size={18} className="intervention-icon" />
                                                                            <div className="intervention-content">
                                                                                <p className="intervention-msg">{step.interventionMsg}</p>
                                                                                <div className="intervention-input-row">
                                                                                    <input 
                                                                                        type="text" 
                                                                                        placeholder={`Enter ${step.missingData?.find(m => m.criticality === 'critical')?.field || 'value'}...`}
                                                                                        value={interventionInput}
                                                                                        onChange={(e) => setInterventionInput(e.target.value)}
                                                                                    />
                                                                                    <button onClick={() => resolveIntervention(task._id, step.missingData?.find(m => m.criticality === 'critical')?.field)}>
                                                                                        Submit & Resume
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Execution Log Viewer */}
                                            {task.executionLogs && task.executionLogs.length > 0 && (
                                                <div className="execution-log-section">
                                                    <button 
                                                        className={`log-toggle-btn ${expandedLogs[task._id] ? 'active' : ''}`}
                                                        onClick={() => toggleLogView(task._id)}
                                                    >
                                                        <ScrollText size={12} />
                                                        {expandedLogs[task._id] ? 'Hide Logs' : 'View Logs'} ({task.executionLogs.length})
                                                    </button>
                                                    <AnimatePresence>
                                                        {expandedLogs[task._id] && (
                                                            <motion.div 
                                                                className="log-viewer"
                                                                initial={{ opacity: 0, height: 0 }}
                                                                animate={{ opacity: 1, height: 'auto' }}
                                                                exit={{ opacity: 0, height: 0 }}
                                                            >
                                                                {task.executionLogs.map((log, li) => (
                                                                    <div key={li} className={`log-entry ${log.level}`}>
                                                                        <span className="log-time">{formatLogTime(log.timestamp)}</span>
                                                                        {log.stepLabel && <span className="log-step-label">[{log.stepLabel}]</span>}
                                                                        <span className="log-msg">{log.message}</span>
                                                                    </div>
                                                                ))}
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            )}

                                            {task.type === 'scheduled' && task.status === 'waiting' && (
                                                <button className="force-run-btn" onClick={() => forceRunScheduled(task.id)}>
                                                    Execute Now (Override Time)
                                                </button>
                                            )}
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* --- VISIBLE RESIZER --- */}
            <div
                onMouseDown={() => { isResizing.current = true; document.body.style.cursor = 'col-resize'; }}
                style={{
                    width: '10px',
                    cursor: 'col-resize',
                    backgroundColor: '#151515',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderLeft: '1px solid #222',
                    borderRight: '1px solid #222',
                    zIndex: 10
                }}
            >
                <div style={{ width: '2px', height: '30px', backgroundColor: '#333', borderRadius: '2px' }} />
            </div>

            {/* --- RIGHT PANE (PROMPTING AREA) --- */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#0a0a0a',
                height: '100%'
            }}>
                {/* Header for Right Pane */}
                <div style={{
                    padding: '16px 20px',
                    backgroundColor: '#0d0d0d',
                    borderBottom: '1px solid #1a1a1a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10
                }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#6c5ce7' }} />
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#eee', letterSpacing: '0.5px' }}>COMMAND CENTER</div>
                </div>

                {/* Messages Timeline area */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '30px' }}>
                    {chatMessages.length === 0 ? (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
                            <Sparkles size={48} />
                            <p style={{ marginTop: 12, fontSize: '14px' }}>How can Nurotra assist you today?</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {chatMessages.map((msg, idx) => {
                                const isExecStep = msg.role === 'system' && msg.type === 'text' && msg.content?.startsWith('Executing:');
                                const isResult = msg.type === 'browser_result' || msg.type === 'result';
                                const isUser = msg.role === 'user';
                                const isNew = idx === chatMessages.length - 1;

                                return (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2 }}
                                        style={{
                                            display: 'flex',
                                            gap: 10,
                                            flexDirection: isUser ? 'row-reverse' : 'row',
                                            maxWidth: '88%',
                                            alignSelf: isUser ? 'flex-end' : 'flex-start'
                                        }}
                                    >
                                        {/* Avatar */}
                                        <div style={{
                                            width: 28, height: 28, borderRadius: '50%',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            backgroundColor: isUser ? '#1a1a1a' : '#111',
                                            border: '1px solid #222',
                                            marginTop: 2, flexShrink: 0
                                        }}>
                                            {isUser
                                                ? <User size={13} color="#666" />
                                                : <Sparkles size={13} color="#555" />
                                            }
                    <div className="cc-dynamic-area">
                        {showHistory ? (
                            <div className="history-view">
                                <h3>Execution History</h3>
                                <div className="history-list">
                                    {taskHistory.length === 0 ? <p className="no-history">No tasks completed yet.</p> : (
                                        taskHistory.map(task => {
                                            const isExpanded = expandedHistory[task._id];
                                            return (
                                                <div key={task._id} className={`history-card ${isExpanded ? 'expanded' : ''}`}>
                                                    <div className="hist-header" onClick={() => toggleHistoryView(task._id)}>
                                                        <span className="hist-title">{task.title}</span>
                                                        <div className="hist-status-group">
                                                            {task.status === 'completed' ? 
                                                                <CheckCircle2 size={14} className="hist-icon success" /> :
                                                                <AlertTriangle size={14} className="hist-icon error" />
                                                            }
                                                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                        </div>
                                                    </div>
                                                    <span className="hist-time">
                                                        {task.status === 'completed' ? 'Completed' : 'Failed'} in {task.endTime && task.startTime ? formatTime(Math.floor((new Date(task.endTime).getTime() - new Date(task.startTime).getTime()) / 1000)) : '0:00'}
                                                    </span>

                                                    <AnimatePresence>
                                                        {isExpanded && (
                                                            <motion.div 
                                                                className="hist-expanded-detail"
                                                                initial={{ opacity: 0, height: 0 }}
                                                                animate={{ opacity: 1, height: 'auto' }}
                                                                exit={{ opacity: 0, height: 0 }}
                                                            >
                                                                <div className="hist-timeline-mini">
                                                                    {task.steps.map((step, sidx) => (
                                                                        <div key={step._id || sidx} className={`hist-step-row ${step.status}`}>
                                                                            <div className="hist-step-head">
                                                                                <div className="hist-step-dot" />
                                                                                <span className="hist-step-label">{step.label}</span>
                                                                                <IconHOC type={step.icon} size={12} />
                                                                                {step.resultData && <span className="res-available-badge">Results Received</span>}
                                                                            </div>
                                                                            
                                                                            {step.resultData && (
                                                                                <div className="hist-step-result animate-in">
                                                                                    {typeof step.resultData === 'string' ? (
                                                                                        <p className="res-str">{step.resultData}</p>
                                                                                    ) : (Array.isArray(step.resultData) && step.resultData.length > 0) ? (
                                                                                        <div className="hist-result-grid">
                                                                                            {step.resultData.map((item, ii) => (
                                                                                                <div key={ii} className="hist-result-item">
                                                                                                    {Object.entries(item).map(([k, v]) => (
                                                                                                        <div key={k} className="hist-result-field">
                                                                                                            <span className="f-k">{k}:</span>
                                                                                                            <span className="f-v">{String(v)}</span>
                                                                                                        </div>
                                                                                                    ))}
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    ) : (
                                                                                        <pre className="hist-result-pre">
                                                                                            {JSON.stringify(step.resultData, null, 2)}
                                                                                        </pre>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                
                                                                {task.executionLogs && task.executionLogs.length > 0 && (
                                                                    <div className="hist-log-brief">
                                                                        <span className="log-count">+{task.executionLogs.length} execution logs</span>
                                                                    </div>
                                                                )}
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="intent-view">
                                {/* NLP Preview Panel */}
                                {nlpPreview && nlpPreview.type === 'workflow' && (
                                    <motion.div className="nlp-preview-panel" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                                        <div className="nlp-preview-header">
                                            <Sparkles size={14} className="sparkle-icon" />
                                            <span className="nlp-preview-badge">Parsed Intent</span>
                                        </div>
                                        <h3 className="nlp-preview-title">{nlpPreview.title}</h3>
                                        <div className="nlp-pipeline-preview">
                                            <div className="nlp-pipeline-row">
                                                <span className="nlp-pipeline-label trigger">Event</span>
                                                <span className="nlp-pipeline-value">{nlpPreview.trigger?.type || 'manual'} {nlpPreview.trigger?.source ? `— ${nlpPreview.trigger.source}` : ''}</span>
                                            </div>
                                            {nlpPreview.conditionText && (
                                                <div className="nlp-pipeline-row">
                                                    <span className="nlp-pipeline-label condition">Condition</span>
                                                    <span className="nlp-pipeline-value">{nlpPreview.conditionText}</span>
                                                </div>
                                            )}
                                            <div className="nlp-pipeline-row">
                                                <span className="nlp-pipeline-label actions">Actions</span>
                                                <div className="nlp-action-chips">
                                                    {nlpPreview.actions.map((action, i) => (
                                                        <React.Fragment key={action.id || i}>
                                                            <span className="nlp-action-chip">
                                                                <IconHOC type={action.icon} size={11} />
                                                                {action.label}
                                                            </span>
                                                            {i < nlpPreview.actions.length - 1 && (
                                                                <span className="nlp-action-chip-arrow">→</span>
                                                            )}
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Rule Created Notification */}
                                {nlpPreview && nlpPreview.type === 'rule_created' && (
                                    <motion.div className="nlp-preview-panel" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                                        <div className="nlp-preview-header">
                                            <Zap size={14} style={{color: '#00d2ff'}} />
                                            <span className="nlp-preview-badge">Automation Created</span>
                                        </div>

                                        {/* Bubble */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
                                            <div style={{
                                                padding: isExecStep ? '6px 0' : '0',
                                                color: '#ccc',
                                                fontSize: '13px',
                                                lineHeight: '1.7',
                                            }}>
                                                {/* Execution step — typewriter */}
                                                {isExecStep ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <span style={{ color: '#333', fontSize: '11px' }}>›</span>
                                                        <span style={{ color: '#555', fontSize: '12px', fontFamily: 'monospace' }}>
                                                            {isNew ? <TypewriterText text={msg.content} speed={20} /> : msg.content}
                                                        </span>
                                                    </div>
                                                ) : isResult ? (
                                                    /* Result — flat, no box, structured typewriter */
                                                    <div style={{ padding: '8px 0' }}>
                                                        {renderStructuredContent(msg.content, isNew)}
                                                        {msg.metadata?.sourceUrl && (
                                                            <div style={{ marginTop: 12, fontSize: '11px', color: '#333' }}>
                                                                <a href={msg.metadata.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#444', textDecoration: 'none' }}>
                                                                    {msg.metadata.provider || 'Web'} ↗
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : isUser ? (
                                                    /* User message — subtle pill */
                                                    <div style={{
                                                        display: 'inline-block',
                                                        padding: '8px 14px',
                                                        borderRadius: '16px 4px 16px 16px',
                                                        backgroundColor: '#161616',
                                                        border: '1px solid #1e1e1e',
                                                        color: '#ccc',
                                                        fontSize: '13px'
                                                    }}>
                                                        {msg.content}
                                                    </div>
                                                ) : (
                                                    /* System/AI message — no box, just text */
                                                    <span style={{ color: '#888', fontSize: '13px' }}>{msg.content}</span>
                                                )}
                                            </div>
                                            <span style={{ fontSize: '10px', color: '#2a2a2a', alignSelf: isUser ? 'flex-end' : 'flex-start', paddingLeft: 2 }}>
                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </motion.div>
                                );
                            })}
                            <div ref={chatEndRef} />
                        </div>
                    )}
                </div>

                {/* Input Bar area at the bottom */}
                <div style={{ padding: '12px 30px 28px 30px', borderTop: '1px solid #1a1a1a', backgroundColor: '#080808' }}>

                    {/* --- Dynamic Suggestion Chips --- */}
                    {suggestions.length > 0 && !isLoading && (
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => sendCommand(s)}
                                    style={{
                                        background: 'rgba(108, 92, 231, 0.1)',
                                        border: '1px solid rgba(108, 92, 231, 0.25)',
                                        borderRadius: '20px',
                                        padding: '6px 14px',
                                        color: '#a29bfe',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = 'rgba(108, 92, 231, 0.25)';
                                        e.currentTarget.style.borderColor = '#6c5ce7';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = 'rgba(108, 92, 231, 0.1)';
                                        e.currentTarget.style.borderColor = 'rgba(108, 92, 231, 0.25)';
                                    }}
                                >
                                    ⚡ {s}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* --- Text Input --- */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: '#111',
                        borderRadius: '20px',
                        padding: '10px 15px',
                        border: isLoading ? '1px solid #6c5ce755' : '1px solid #222',
                        boxShadow: isLoading ? '0 0 20px rgba(108,92,231,0.15)' : '0 4px 20px rgba(0,0,0,0.3)',
                        transition: 'box-shadow 0.3s, border 0.3s'
                    }}>
                        <button style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '8px' }}>
                            <Paperclip size={20} />
                        </button>
                        <input
                            type="text"
                            placeholder={isConnecting ? 'Agent is initializing...' : "Type a command (e.g., 'What is the IPL score?')"}
                            style={{ flex: 1, background: 'none', border: 'none', color: isConnecting ? '#6c5ce7' : '#fff', padding: '10px 15px', outline: 'none', fontSize: '15px' }}
                            value={commandInput}
                            onChange={(e) => setCommandInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendCommand()}
                            disabled={isLoading}
                        />
                        <button
                            onClick={sendCommand}
                            disabled={!commandInput.trim() || isLoading}
                            style={{
                                background: commandInput.trim() ? '#6c5ce7' : '#222',
                                color: '#fff',
                                border: 'none',
                                padding: '10px 20px',
                                borderRadius: '15px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                transition: '0.3s'
                            }}
                        >
                            {isLoading ? <Loader2 size={16} className="spin-icon" /> : <><Send size={16} /> EXECUTE</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ActionAgentPage;


// hi 