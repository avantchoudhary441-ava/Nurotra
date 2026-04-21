import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Sparkles, Globe, User, ShieldAlert, AlertCircle, RefreshCw, X, Paperclip, CheckCircle2, AlertTriangle, Play, Pause, Activity, Terminal, Menu, Bot, Plus, Mic, MicOff } from 'lucide-react';
import './ActionAgent.css';

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
    const { user } = useAuth();
    const { socket: globalSocket } = useSocket();

    // Core Engine State
    const [activeTasks, setActiveTasks] = useState([]);
    const [commandInput, setCommandInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [suggestions, setSuggestions] = useState([]);



    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [pastWorkflows, setPastWorkflows] = useState([]);
    const [activeWorkflowId, setActiveWorkflowId] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const chatEndRef = useRef(null);
    const logsEndRef = useRef(null);

    // Browser Monitor State (Execution Screen)
    const [browserFrame, setBrowserFrame] = useState(null);
    const [monitorVisible, setMonitorVisible] = useState(true);
    const [monitorLoadingStart, setMonitorLoadingStart] = useState(null);
    const [showMonitorTroubleshoot, setShowMonitorTroubleshoot] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [leftPaneWidth, setLeftPaneWidth] = useState(40); // Percentage
    const [isResizing, setIsResizing] = useState(false);
    const [userName, setUserName] = useState('there');
    const socketRef = useRef(null);
    const containerRef = useRef(null);
    const fileInputRef = useRef(null);
    const [topPaneHeight, setTopPaneHeight] = useState(60); // Percentage
    const [isResizingVert, setIsResizingVert] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);
    const monitorImgRef = useRef(null);
    const [lastPulse, setLastPulse] = useState(null);
    const [expandedMessages, setExpandedMessages] = useState({}); // Tracking expanded cards
    const [activeTasks, setActiveTasks] = useState([]);
    const [suggestions, setSuggestions] = useState([]);

    // Vertical Resizing Logic
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizingVert || !containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            const newHeight = ((e.clientY - containerRect.top) / containerRect.height) * 100;
            if (newHeight > 20 && newHeight < 80) {
                setTopPaneHeight(newHeight);
            }
        };
        const handleMouseUp = () => setIsResizingVert(false);
        if (isResizingVert) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizingVert]);

    const fetchTasks = async (customToken) => {
        try {
            const token = customToken || (JSON.parse(localStorage.getItem('nurotra_user') || '{}') || {}).token;
            const activeRes = await fetch("http://localhost:5000/api/action-agent/active-tasks", {
                headers: { "Authorization": `Bearer ${token}` }
            });
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

    const fetchChat = async (customToken) => {
        try {
            const userData = localStorage.getItem('nurotra_user');
            const token = customToken || (userData ? JSON.parse(userData).token : null);
            if (!token) return;

            const res = await fetch("http://localhost:5000/api/action-agent/chat", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setChatMessages(data.messages || []);
            }
        } catch (error) {
            console.error("Failed to fetch chat history");
        }
    };

    const fetchSuggestions = async (customToken) => {
        try {
            const token = customToken || (JSON.parse(localStorage.getItem('nurotra_user') || '{}') || {}).token;
            const res = await fetch("http://localhost:5000/api/action-agent/suggestions", {
                headers: { "Authorization": `Bearer ${token}` }
            });
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

    const fetchHistory = async (customToken) => {
        try {
            const token = customToken || (JSON.parse(localStorage.getItem('nurotra_user') || '{}') || {}).token;
            const res = await fetch("http://localhost:5000/api/action-agent/history", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setPastWorkflows(data.workflows || []);
        } catch (e) {
            console.error(e);
        }
    };



    useEffect(() => {
        if (!globalSocket) return;
        socketRef.current = globalSocket;

        // Explicitly join the execution room for this user to ensure monitor sync
        if (user?._id) {
            socketRef.current.emit('join-room', user._id);
        }

        socketRef.current.on('browser_frame', (data) => {
            setBrowserFrame(data);
            setMonitorLoadingStart(null);
            setShowMonitorTroubleshoot(false);
            setMonitorVisible(true);
            setIsConnecting(false);

            // Move to running state if we were connecting
            setIsConnecting(false);
            setMonitorLoadingStart(null);
            
            // Pulse the activity indicator to show it's alive
            setLastPulse(Date.now());
        });

        socketRef.current.on('browser_block', (data) => {
            setMonitorVisible(true);
            setIsConnecting(false);
        });

        socketRef.current.on('task_update', (data) => {
            if (data.userId === user?._id) {
                fetchTasks();
            }
        });

        socketRef.current.on('execution_log', (data) => {
            // Move to running state if we were connecting
            setIsConnecting(false);
            setMonitorLoadingStart(null);
            
            // Update the live feed with the latest granular log
            setExecutionLogs(prev => {
                const updated = [...prev, {
                    ...data,
                    _id: data._id || 'log_' + Date.now()
                }].slice(-50); // Keep last 50 for performance
                return updated;
            });
            setLastPulse(Date.now());
        });

        socketRef.current.on('chat_update', (data) => {
            if (data?.message) {
                setChatMessages(prev => {
                    const exists = prev.some(m => m._id === data.message._id || (m.timestamp === data.message.timestamp && m.content === data.message.content));
                    if (exists) return prev;
                    return [...prev, data.message];
                });
            } else {
                fetchChat();
            }
            fetchTasks();
        });

        // Cleanup listeners on unmount
        return () => {
            if (socketRef.current) {
                socketRef.current.off('browser_frame');
                socketRef.current.off('browser_block');
                socketRef.current.off('task_update');
                socketRef.current.off('chat_update');
            }
        };
    }, [globalSocket, user]);

    useEffect(() => {
        const token = (JSON.parse(localStorage.getItem('nurotra_user') || '{}') || {}).token;
        fetchChat(token);
        fetchTasks(token);
        fetchSuggestions(token);
        fetchHistory(token);

        // Load User Name
        const userData = localStorage.getItem('nurotra_user');
        if (userData) {
            const user = JSON.parse(userData);
            if (user.name) setUserName(user.name.split(' ')[0]);
        }

        // Initialize Speech Recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setCommandInput(transcript);
                setIsListening(false);
            };

            recognitionRef.current.onerror = (event) => {
                console.error("Speech Recognition Error:", event.error);
                setIsListening(false);
            };

            recognitionRef.current.onend = () => setIsListening(false);
        }

        return () => {
            // Do NOT disconnect global socket here
        };
    }, []);

    // Draggable Resizer Logic
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing || !containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
            if (newWidth > 15 && newWidth < 70) {
                setLeftPaneWidth(newWidth);
            }
        };
        const handleMouseUp = () => setIsResizing(false);

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);



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

    const loadWorkflow = async (id) => {
        setActiveWorkflowId(id);
        try {
            const token = (JSON.parse(localStorage.getItem('nurotra_user') || '{}') || {}).token;
            const res = await fetch(`http://localhost:5000/api/action-agent/logs/${id}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setChatMessages(data.logs || []); // Use logs as history if needed
            }
            fetchChat(); // Also get actual chat
        } catch (e) {
            console.error(e);
        }
    };

    const handleNewChat = async (silent = false) => {
        if (!silent && !window.confirm("Start a new session? Current progress will be archived.")) return;
        try {
            const token = (JSON.parse(localStorage.getItem('nurotra_user') || '{}') || {}).token;
            await fetch("http://localhost:5000/api/action-agent/chat", {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            setChatMessages([]);
            setActiveWorkflowId(null);
            if (!silent) fetchHistory();
        } catch (e) {
            console.error(e);
        }
    };

    const sendCommand = async (inputStr) => {
        const text = typeof inputStr === 'string' ? inputStr : commandInput;
        if (!text.trim()) return;

        setCommandInput('');
        setIsLoading(true);
        setIsConnecting(true); // Wake up monitor

        try {
            const token = (JSON.parse(localStorage.getItem('nurotra_user') || '{}') || {}).token;
            const response = await fetch("http://localhost:5000/api/action-agent/execute", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "x-socket-id": socketRef.current?.id || ""
                },
                body: JSON.stringify({ command: text })
            });

            const data = await response.json();
            if (data.success) {
                fetchChat();
                fetchTasks();
                setMonitorVisible(true);
                setMonitorLoadingStart(Date.now());
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

    const stopAgent = async () => {
        const taskId = activeTasks[0]?._id;
        if (!taskId) return;
        try {
            const token = (JSON.parse(localStorage.getItem('nurotra_user') || '{}') || {}).token;
            await fetch(`http://localhost:5000/api/action-agent/stop/${taskId}`, {
                method: 'POST',
                headers: { "Authorization": `Bearer ${token}` }
            });
            fetchTasks();
            fetchChat();
        } catch (e) {
            console.error("Stop failed", e);
        }
    };

    const pauseAgent = async () => {
        const taskId = activeTasks[0]?._id;
        if (!taskId) return;
        try {
            const token = (JSON.parse(localStorage.getItem('nurotra_user') || '{}') || {}).token;
            await fetch(`http://localhost:5000/api/action-agent/pause/${taskId}`, {
                method: 'POST',
                headers: { "Authorization": `Bearer ${token}` }
            });
            fetchTasks();
            fetchChat();
        } catch (e) {
            console.error("Pause failed", e);
        }
    };

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert("Speech recognition is not supported in this browser.");
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    const handleQuickAction = (actionText) => {
        setCommandInput(actionText);
        sendCommand(actionText);
    };

    const handleInterventionLink = async (workflowId, link) => {
        if (!link.trim()) return;
        setIsLoading(true);
        try {
            const token = (JSON.parse(localStorage.getItem('nurotra_user') || '{}') || {}).token;
            const res = await fetch("http://localhost:5000/api/action-agent/execute", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "x-socket-id": socketRef.current?.id
                },
                body: JSON.stringify({ command: link, isIntervention: true })
            });
            const data = await res.json();
            if (data.success) {
                setCommandInput('');
            }
        } catch (error) {
            console.error("Intervention Link Error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('purpose', 'resume_ingestion');

        try {
            const token = (JSON.parse(localStorage.getItem('nurotra_user') || '{}') || {}).token;
            const res = await fetch("http://localhost:5000/api/upload", {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData
            });
            const data = await res.json();
            
            if (data.documentId) {
                // Resume the task with the document ID
                await fetch("http://localhost:5000/api/action-agent/execute", {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json", 
                        "Authorization": `Bearer ${token}`,
                        "x-socket-id": socketRef.current?.id
                    },
                    body: JSON.stringify({ command: `I've uploaded my resume: ${data.documentId}`, isIntervention: true })
                });
            }
        } catch (error) {
            console.error("File Ingestion Error:", error);
        } finally {
            setIsLoading(false);
        }
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

    return (
        <div
            className="action-workspace-container"
            style={{ userSelect: (isResizing || isResizingVert) ? 'none' : 'auto' }}
        >
            {/* --- HISTORY SIDEBAR (Collapsible Push) --- */}
            <div className="history-sidebar" style={{ width: isSidebarOpen ? 260 : 0 }}>
                <div className="history-header">
                    <Activity size={14} /> Session History
                </div>

                {/* --- Sidebar Actions --- */}
                <div style={{ padding: '16px 12px 10px 12px' }}>
                    <button
                        onClick={() => { handleNewChat(); setIsSidebarOpen(false); }}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            padding: '10px',
                            background: 'rgba(108, 92, 231, 0.1)',
                            border: '1px solid rgba(108, 92, 231, 0.2)',
                            borderRadius: '8px',
                            color: '#a29bfe',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(108, 92, 231, 0.2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(108, 92, 231, 0.1)'}
                    >
                        <Plus size={14} /> START NEW CHAT
                    </button>
                </div>

                <div className="history-list">
                    {pastWorkflows.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center', opacity: 0.3, fontSize: 11 }}>No past sessions found</div>
                    ) : (
                        pastWorkflows.map(wf => (
                            <div
                                key={wf._id}
                                className={`history-item ${activeWorkflowId === wf._id ? 'active' : ''}`}
                                onClick={() => loadWorkflow(wf._id)}
                            >
                                <span className="history-item-title">{wf.title || 'Automated Task'}</span>
                                <span className="history-item-date">{new Date(wf.createdAt).toLocaleDateString()}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* --- SPLIT LAYOUT CONTENT --- */}
            <div ref={containerRef} className="action-split-layout">

                {/* --- LEFT SIDE: EXECUTION STAGE --- */}
                <div
                    className="action-left-pane-split"
                    style={{ width: `${leftPaneWidth}%`, display: 'flex' }}
                >
                    {/* Upper Half: Execution Monitor */}
                    <div className="execution-monitor-section" style={{ height: `${topPaneHeight}%`, flex: 'none' }}>
                        <div className="terminal-header">
                            <Activity size={12} /> Active Task Monitor
                            {(activeTasks.length > 0 || isConnecting) && (
                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: '9px', color: '#00ff88' }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#00ff88', boxShadow: '0 0 10px #00ff88', animation: 'pulse 1.5s infinite' }} />
                                    LIVE FEED
                                </div>
                            )}
                        </div>
                        <div style={{ flex: 1, backgroundColor: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {browserFrame ? (
                                <img
                                    ref={monitorImgRef}
                                    src={browserFrame.frame}
                                    alt="Browser View"
                                    onClick={handleMonitorClick}
                                    style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'crosshair' }}
                                />
                            ) : (isConnecting || (activeTasks.length > 0 && activeTasks[0].status === 'running')) && !browserFrame ? (
                                <div style={{ textAlign: 'center', color: '#444' }}>
                                    <Loader2 size={30} className="spin-icon" style={{ marginBottom: 15, color: '#6c5ce7' }} />
                                    <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '2px', color: '#666' }}>
                                        {activeTasks[0]?.activeMicroLog || "Preparing your secure environment..."}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ opacity: 0.1, textAlign: 'center' }}>
                                    <Globe size={48} />
                                    <div style={{ fontSize: '12px', marginTop: 10 }}>Standby</div>
                                </div>
                            )}
                        </div>

                        {/* Success Celebration Overlay */}
                        <AnimatePresence>
                            {activeTasks[0]?.status === 'completed' && !activeTasks[0]?.isAcknowledged && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 1.1 }}
                                    style={{
                                        position: 'absolute',
                                        bottom: 20,
                                        left: 20,
                                        right: 20,
                                        zIndex: 100,
                                        background: 'linear-gradient(135deg, #111 0%, #000 100%)',
                                        border: '1px solid #00ff88',
                                        padding: '20px 25px',
                                        borderRadius: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 20,
                                        boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 20px rgba(0,255,136,0.1)'
                                    }}
                                >
                                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,255,136,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <CheckCircle2 size={20} color="#00ff88" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ color: '#fff', fontSize: '15px', fontWeight: '700', marginBottom: 2 }}>Task Complete</div>
                                        <div style={{ color: '#888', fontSize: '11px' }}>Results and evidence delivered to chat.</div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            socketRef.current.emit('acknowledge_task', { workflowId: activeTasks[0]._id });
                                            fetchTasks();
                                        }}
                                        style={{ background: '#fff', color: '#000', border: 'none', padding: '8px 18px', borderRadius: '10px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                                    >
                                        View Report
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* --- VERTICAL DIVIDER --- */}
                    <div
                        className="pane-divider-vert"
                        onMouseDown={() => setIsResizingVert(true)}
                    />

                    {/* Lower Half: Micro-logs Terminal */}
                    <div className="micro-logs-section" style={{ flex: 1 }}>
                        <div className="terminal-header">
                            <Terminal size={12} /> Task Activity Feed
                        </div>
                        <div className="terminal-body" ref={logsEndRef}>
                            {activeTasks.length > 0 && activeTasks[0].executionLogs?.map((log, i) => (
                                <div key={i} style={{ marginBottom: 4, opacity: 0.8 }}>
                                    <span style={{ color: '#333' }}>[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                                    <span style={{ color: log.level === 'error' ? '#ff4757' : log.level === 'success' ? '#00ff88' : '#666', margin: '0 8px' }}>
                                        {log.level === 'error' ? 'Error' : log.level === 'success' ? 'Done ' : 'Info '}
                                    </span>
                                    <span style={{ color: '#aaa' }}>{log.message}</span>
                                </div>
                            ))}
                            {activeTasks[0]?.activeMicroLog && (
                                <div style={{ color: '#6c5ce7', fontStyle: 'italic', marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Loader2 size={12} className="spin-icon" />
                                    {activeTasks[0].activeMicroLog}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- DRAGGABLE RESIZER --- */}
                <div
                    className="pane-divider"
                    style={{ display: 'flex' }}
                    onMouseDown={() => setIsResizing(true)}
                />

                {/* --- RIGHT SIDE: COMMAND CENTER --- */}
                <div className="action-right-pane-split">
                    <div className="command-center">
                        {/* Header */}
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <button className="hamburger-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                                <Menu size={18} style={{ color: isSidebarOpen ? '#a29bfe' : '#666' }} />
                            </button>
                            <span style={{ fontSize: '13px', fontWeight: '800', letterSpacing: '1px', color: '#fff' }}>COMMAND CENTER</span>
                            {activeTasks.length > 0 && (
                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div className={`status-pill ${activeTasks[0].status}`}>
                                        {activeTasks[0].status.toUpperCase()}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Chat Timeline */}
                        <div className="chat-timeline" style={{ paddingBottom: suggestions.length > 0 ? 40 : 100 }}>
                            {chatMessages.length === 0 ? (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.1 }}>
                                    <Sparkles size={64} />
                                    <p style={{ marginTop: 20, fontSize: '18px', fontWeight: '300' }}>Welcome, {userName}. How can I assist you today?</p>
                                </div>
                            ) : (
                                chatMessages.filter(m => m.type !== 'execution_step').map((msg, idx) => {
                                    const isUser = msg.role === 'user';
                                    const isResult = msg.type === 'result' || msg.type === 'browser_result';
                                    const isClarification = msg.type === 'clarification';
                                    const isMilestone = msg.type === 'milestone';
                                    const isNew = (Date.now() - new Date(msg.timestamp).getTime()) < 5000;

                                    return (
                                        <motion.div
                                            key={msg._id || idx}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            style={{ display: 'flex', gap: 20, alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '85%' }}
                                        >
                                            {!isUser && (
                                                <div style={{ width: 32, height: 32, borderRadius: '8px', background: isClarification ? 'rgba(255, 165, 0, 0.1)' : 'rgba(108, 92, 231, 0.1)', border: `1px solid ${isClarification ? 'rgba(255, 165, 0, 0.2)' : 'rgba(108, 92, 231, 0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    {isClarification ? <AlertCircle size={18} color="#ffa500" /> : <Bot size={18} color="#a29bfe" />}
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: isUser ? 'flex-                                                {isResult ? (
                                                    <div className="premium-result-card" style={{ background: '#111', border: '1px solid #222', borderRadius: '16px', overflow: 'hidden' }}>
                                                        <div style={{ padding: '15px 20px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <div style={{ color: '#00ff88', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <CheckCircle2 size={12} /> {msg.content.includes('Complete') || msg.content.includes('Successful') ? 'TASK SUCCESSFUL' : 'UPDATE'}
                                                            </div>
                                                            <div style={{ color: '#444', fontSize: '10px' }}>{new Date(msg.timestamp).toLocaleTimeString()}</div>
                                                        </div>
                                                        <div style={{ padding: '20px' }}>
                                                            {renderStructuredContent(msg.content, isNew)}
                                                            
                                                            <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                                                                <button 
                                                                    className="expand-report-btn"
                                                                    onClick={() => setExpandedMessages(prev => ({ ...prev, [msg._id || idx]: !prev[msg._id || idx] }))}
                                                                    style={{
                                                                        background: 'rgba(108, 92, 231, 0.1)',
                                                                        border: '1px solid rgba(108, 92, 231, 0.3)',
                                                                        borderRadius: '8px',
                                                                        padding: '6px 12px',
                                                                        color: '#a29bfe',
                                                                        fontSize: '11px',
                                                                        fontWeight: '700',
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: 6
                                                                    }}
                                                                >
                                                                    {expandedMessages[msg._id || idx] ? <X size={12} /> : <Activity size={12} />}
                                                                    {expandedMessages[msg._id || idx] ? 'HIDE LOGS' : 'VIEW EXECUTION SUMMARY'}
                                                                </button>
                                                                
                                                                {msg.metadata?.sourceUrl && (
                                                                    <button 
                                                                        onClick={() => window.open(msg.metadata.sourceUrl, '_blank')}
                                                                        style={{
                                                                            background: 'rgba(255, 255, 255, 0.05)',
                                                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                                                            borderRadius: '8px',
                                                                            padding: '6px 12px',
                                                                            color: '#999',
                                                                            fontSize: '11px',
                                                                            fontWeight: '700',
                                                                            cursor: 'pointer',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: 6
                                                                        }}
                                                                    >
                                                                        <ExternalLink size={12} /> SOURCE
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {expandedMessages[msg._id || idx] && (
                                                            <motion.div 
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                style={{ borderTop: '1px solid #222', background: '#0a0a0a' }}
                                                            >
                                                                <div style={{ padding: '20px' }}>
                                                                    <div style={{ color: '#555', fontSize: '10px', marginBottom: 15, fontWeight: '800', letterSpacing: '1px' }}>INTERNAL EXECUTION LOGS</div>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 25 }}>
                                                                        <div style={{ fontSize: '11px', color: '#888', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '8px', borderLeft: '3px solid #6c5ce7' }}>
                                                                            <span style={{ color: '#6c5ce7', fontWeight: 'bold' }}>INFO:</span> Target resolved at {msg.metadata?.sourceUrl || 'verified domain'}.
                                                                        </div>
                                                                        <div style={{ fontSize: '11px', color: '#888', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '8px', borderLeft: '3px solid #6c5ce7' }}>
                                                                            <span style={{ color: '#6c5ce7', fontWeight: 'bold' }}>INFO:</span> Autonomous data extraction completed successfully.
                                                                        </div>
                                                                        {msg.metadata?.evidenceUrl && (
                                                                            <div style={{ fontSize: '11px', color: '#00ff88', background: 'rgba(0,255,136,0.05)', padding: '8px 12px', borderRadius: '8px', borderLeft: '3px solid #00ff88' }}>
                                                                                <span style={{ color: '#00ff88', fontWeight: 'bold' }}>SUCCESS:</span> Visual proof captured and verified.
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {msg.metadata?.evidenceUrl && (
                                                                        <>
                                                                            <div style={{ color: '#555', fontSize: '10px', marginBottom: 10, fontWeight: '800', letterSpacing: '1px' }}>VISUAL EVIDENCE</div>
                                                                            <a href={msg.metadata.evidenceUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', position: 'relative' }}>
                                                                                <img src={msg.metadata.evidenceUrl} alt="Proof" style={{ width: '100%', borderRadius: '12px', border: '1px solid #222', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} />
                                                                                <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.7)', padding: '4px 8px', borderRadius: '4px', color: '#fff', fontSize: '10px' }}>
                                                                                    CLICK TO EXPAND
                                                                                </div>
                                                                            </a>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </div>
                                                ) : isClarification ? (  ) : isClarification ? (
                                                    <div style={{
                                                        background: 'rgba(255, 165, 0, 0.05)',
                                                        border: '1px solid rgba(255, 165, 0, 0.2)',
                                                        padding: '16px 20px',
                                                        borderRadius: '16px 16px 16px 4px',
                                                        color: '#fff',
                                                        fontSize: '15px',
                                                        lineHeight: '1.6',
                                                        maxWidth: '600px'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ffa500', fontSize: '11px', fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>
                                                            <Sparkles size={12} /> Need more clarity
                                                        </div>
                                                        {msg.content}
                                                    </div>
                                                ) : msg.type === 'intervention' ? (
                                                    <div style={{
                                                        background: 'rgba(108, 92, 231, 0.05)',
                                                        border: '1px solid rgba(108, 92, 231, 0.2)',
                                                        padding: '16px 20px',
                                                        borderRadius: '16px 16px 16px 4px',
                                                        color: '#fff',
                                                        fontSize: '15px',
                                                        lineHeight: '1.6',
                                                        maxWidth: '600px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: 15
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#a29bfe', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                                            <Sparkles size={12} /> {msg.metadata?.subtype === 'resume_upload' ? 'Action Required: Resume Missing' : 'Action Required: Link Needed'}
                                                        </div>
                                                        <div style={{ opacity: 0.9 }}>{msg.content}</div>
                                                        
                                                        {msg.metadata?.subtype === 'resume_upload' && (
                                                            <div style={{ marginTop: 5 }}>
                                                                <input 
                                                                    type="file" 
                                                                    ref={fileInputRef} 
                                                                    onChange={handleFileUpload} 
                                                                    style={{ display: 'none' }} 
                                                                    accept=".pdf,.doc,.docx"
                                                                />
                                                                <button 
                                                                    onClick={() => fileInputRef.current?.click()}
                                                                    disabled={isLoading}
                                                                    style={{ 
                                                                        width: '100%', 
                                                                        padding: '12px', 
                                                                        background: 'rgba(108, 92, 231, 0.2)', 
                                                                        border: '1px solid #6c5ce7', 
                                                                        borderRadius: '12px', 
                                                                        color: '#a29bfe', 
                                                                        fontSize: '13px', 
                                                                        fontWeight: '600', 
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        gap: 10
                                                                    }}
                                                                >
                                                                    {isLoading ? <Loader2 size={16} className="spin-icon" /> : <Paperclip size={16} />}
                                                                    UPLOAD RESUME (.PDF, .DOCX)
                                                                </button>
                                                            </div>
                                                        )}

                                                        {msg.metadata?.subtype === 'link_request' && (
                                                            <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                                                                <input 
                                                                    type="text" 
                                                                    placeholder="Paste the URL here..."
                                                                    className="intervention-url-input"
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') handleInterventionLink(msg.workflowId, e.target.value);
                                                                    }}
                                                                    style={{
                                                                        flex: 1,
                                                                        background: 'rgba(0,0,0,0.3)',
                                                                        border: '1px solid rgba(108, 92, 231, 0.3)',
                                                                        borderRadius: '10px',
                                                                        padding: '10px 15px',
                                                                        color: '#fff',
                                                                        fontSize: '13px',
                                                                        outline: 'none'
                                                                    }}
                                                                />
                                                                <button 
                                                                    onClick={(e) => {
                                                                        const input = e.currentTarget.previousSibling;
                                                                        handleInterventionLink(msg.workflowId, input.value);
                                                                    }}
                                                                    style={{
                                                                        background: '#6c5ce7',
                                                                        color: '#fff',
                                                                        border: 'none',
                                                                        borderRadius: '10px',
                                                                        padding: '0 20px',
                                                                        fontSize: '12px',
                                                                        fontWeight: '600',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    SUBMIT
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : isMilestone ? (
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 12,
                                                        padding: '10px 15px',
                                                        background: 'rgba(255,255,255,0.02)',
                                                        borderRadius: '12px',
                                                        color: '#666',
                                                        fontSize: '12px',
                                                        fontStyle: 'italic',
                                                        border: '1px dashed rgba(255,255,255,0.05)',
                                                        margin: '4px 0'
                                                    }}>
                                                        <Loader2 size={10} className="spin-icon" style={{ color: '#6c5ce7' }} />
                                                        {msg.content}
                                                    </div>
                                                ) : (
                                                    <div style={{
                                                        color: isUser ? '#fff' : '#ccc',
                                                        fontSize: '15px',
                                                        lineHeight: '1.6',
                                                        backgroundColor: isUser ? '#181818' : 'transparent',
                                                        padding: isUser ? '12px 20px' : '0',
                                                        borderRadius: '16px 4px 16px 16px',
                                                        border: isUser ? '1px solid #222' : 'none'
                                                    }}>
                                                        {msg.content}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Suggestions Carousel */}
                        <div style={{ padding: '10px 5% 0 5%', display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleQuickAction(s)}
                                    style={{
                                        flexShrink: 0,
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: '12px',
                                        padding: '8px 16px',
                                        color: '#aaa',
                                        fontSize: '12px',
                                        fontWeight: '500',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#fff'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#aaa'; }}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>

                        {/* Input Bar */}
                        <div style={{ padding: '20px 5% 40px 5%', background: 'linear-gradient(to top, #080808 80%, transparent)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#111', borderRadius: '24px', padding: '8px 8px 8px 16px', border: '1px solid #222', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <Sparkles size={18} color="#6c5ce7" style={{ opacity: 0.5 }} />
                                    <button
                                        onClick={toggleListening}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: isListening ? '#ff4757' : '#666',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: 0,
                                            position: 'relative'
                                        }}
                                    >
                                        {isListening && (
                                            <motion.div
                                                layoutId="mic-pulse"
                                                initial={{ scale: 0.8, opacity: 0.5 }}
                                                animate={{ scale: 1.5, opacity: 0 }}
                                                transition={{ duration: 1, repeat: Infinity }}
                                                style={{ position: 'absolute', width: 18, height: 18, borderRadius: '50%', background: '#ff4757' }}
                                            />
                                        )}
                                        {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                                    </button>
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        title="Attach file for ingestion"
                                        style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                                    >
                                        <Paperclip size={18} />
                                    </button>
                                    <button 
                                        className="link-icon-btn"
                                        style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, position: 'relative' }}
                                        title="Attach URL for processing"
                                        onClick={() => {
                                            const url = prompt("Enter the URL of the form, quiz, or task you want me to solve:");
                                            if (url && url.trim()) {
                                                const command = `Please go to ${url.trim()} and fill out the form or solve the quiz using my profile data.`;
                                                setCommandInput(command);
                                                // We can't directly call sendCommand here because it relies on the state which hasn't updated yet.
                                                // Instead, we manually trigger the API call or simulate the form submission if possible.
                                                // Easiest is to just set it and let the user hit enter, OR we can call the handler directly.
                                                handleQuickAction(command);
                                            }
                                        }}
                                    >
                                        <Globe size={18} />
                                        <div className="icon-tooltip">Direct Link Mode: Attach a URL for specific form filling or research.</div>
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    placeholder={isLoading ? "Nurotra is thinking..." : isConnecting ? "Waiting for engine..." : `Message Nurotra...`}
                                    style={{ flex: 1, background: 'none', border: 'none', color: '#fff', outline: 'none', padding: '10px 0', fontSize: '15px' }}
                                    value={commandInput}
                                    onChange={(e) => setCommandInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && sendCommand()}
                                    disabled={isLoading}
                                />

                                {activeTasks.length > 0 && activeTasks[0].status !== 'completed' && (
                                    <div className="execution-controls">
                                        <button
                                            onClick={pauseAgent}
                                            className="control-btn pause"
                                            title={activeTasks[0].status === 'paused' ? "Resume" : "Pause"}
                                        >
                                            {activeTasks[0].status === 'paused' ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
                                        </button>
                                        <button
                                            onClick={stopAgent}
                                            className="control-btn stop"
                                            title="Stop Execution"
                                        >
                                            <X size={16} strokeWidth={3} />
                                        </button>
                                    </div>
                                )}

                                <button
                                    onClick={sendCommand}
                                    disabled={!commandInput.trim() || isLoading}
                                    style={{ background: commandInput.trim() ? '#fff' : '#222', color: '#000', border: 'none', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: '0.2s' }}
                                >
                                    {isLoading ? <Loader2 size={18} className="spin-icon" /> : <Send size={18} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ActionAgentPage;