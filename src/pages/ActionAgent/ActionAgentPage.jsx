import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Sparkles, Globe, User, ShieldAlert, AlertCircle, RefreshCw, X, Paperclip, CheckCircle2, AlertTriangle, Play, Pause, Activity, Terminal, Menu, Bot, Plus, Mic, MicOff, ExternalLink, Upload } from 'lucide-react';
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
    const [executionLogs, setExecutionLogs] = useState([]); // Live activity logs

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

        if (user?._id) {
            socketRef.current.emit('join-room', user._id);
        }

        socketRef.current.on('browser_frame', (data) => {
            setBrowserFrame(data);
            setMonitorLoadingStart(null);
            setShowMonitorTroubleshoot(false);
            setMonitorVisible(true);
            setIsConnecting(false);
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
            setIsConnecting(false);
            setMonitorLoadingStart(null);
            setExecutionLogs(prev => {
                const updated = [...prev, {
                    ...data,
                    _id: data._id || 'log_' + Date.now()
                }].slice(-50);
                return updated;
            });
            setLastPulse(Date.now());
        });

        socketRef.current.on('chat_update', (data) => {
            if (data?.message) {
                setChatMessages(prev => {
                    // Normalize _id to string to prevent ObjectId vs string mismatch
                    const incomingId = data.message._id?.toString();
                    const exists = prev.some(m =>
                        m._id?.toString() === incomingId ||
                        (m.timestamp === data.message.timestamp && m.content === data.message.content)
                    );
                    if (exists) return prev;
                    return [...prev, data.message];
                });
            } else {
                fetchChat();
            }
            fetchTasks();
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.off('browser_frame');
                socketRef.current.off('browser_block');
                socketRef.current.off('task_update');
                socketRef.current.off('chat_update');
                socketRef.current.off('execution_log');
            }
        };
    }, [globalSocket, user]);

    useEffect(() => {
        const token = (JSON.parse(localStorage.getItem('nurotra_user') || '{}') || {}).token;
        fetchChat(token);
        fetchTasks(token);
        fetchSuggestions(token);
        fetchHistory(token);

        const userData = localStorage.getItem('nurotra_user');
        if (userData) {
            const userObj = JSON.parse(userData);
            if (userObj.name) setUserName(userObj.name.split(' ')[0]);
        }

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
    }, []);

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

    useEffect(() => {
        const pollInterval = setInterval(() => {
            fetchTasks();
        }, 3000);
        return () => clearInterval(pollInterval);
    }, []);

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages]);

    useEffect(() => {
        const timer = setInterval(() => {
            setActiveTasks(prev => prev.map(t => {
                if (['running', 'waiting', 'retrying'].includes(t.status)) {
                    return { ...t, elapsed: t.startTime ? Math.floor((Date.now() - new Date(t.startTime).getTime()) / 1000) : 0 };
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
                setChatMessages(data.logs || []);
            }
            fetchChat();
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

    const sendCommand = async (inputStr, isInterventionInput = false) => {
        const text = typeof inputStr === 'string' ? inputStr : commandInput;
        if (!text.trim()) return;

        setCommandInput('');
        setIsLoading(true);
        setIsConnecting(true);

        const tempUserMsg = {
            _id: 'temp_' + Date.now(),
            role: 'user',
            content: text,
            type: 'text',
            timestamp: new Date().toISOString()
        };
        setChatMessages(prev => [...prev, tempUserMsg]);

        try {
            const token = (JSON.parse(localStorage.getItem('nurotra_user') || '{}') || {}).token;
            const res = await fetch("http://localhost:5000/api/action-agent/execute", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "x-socket-id": socketRef.current?.id
                },
                body: JSON.stringify({ command: text, isIntervention: isInterventionInput === true })
            });

            const data = await res.json();
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

    const resumeIdentity = async (workflowId, email) => {
        if (!workflowId) return alert("System Error: Reference lost. Please try a new command.");
        setIsLoading(true);
        try {
            const token = (JSON.parse(localStorage.getItem('nurotra_user') || '{}') || {}).token;
            const res = await fetch("http://localhost:5000/api/action-agent/resume-identity", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json", 
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ workflowId, email })
            });
            
            if (!res.ok) throw new Error("Handshake failed");
            
            setChatMessages(prev => prev.map(m => 
                (m.workflowId === workflowId || (m.metadata && m.metadata.workflowId === workflowId)) && m.type === 'intervention' 
                ? { ...m, content: `Identity Locked: Using ${email}. Resuming search engine...`, type: 'text' } 
                : m
            ));

            fetchTasks();
            fetchChat();
        } catch (err) {
            console.error("Identity Bridge Error:", err);
            alert("Direct sync failed. Falling back to command entry...");
            sendCommand(`Use email: ${email}`);
        } finally {
            setIsLoading(false);
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
                body: JSON.stringify({ command: link, isIntervention: true, workflowId })
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
                const activeWf = activeWorkflowId || activeTasks[0]?._id;
                await fetch("http://localhost:5000/api/action-agent/execute", {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json", 
                        "Authorization": `Bearer ${token}`,
                        "x-socket-id": socketRef.current?.id
                    },
                    body: JSON.stringify({ command: `I've uploaded my resume: ${data.documentId}`, isIntervention: true, workflowId: activeWf })
                });
            }
        } catch (error) {
            console.error("File Ingestion Error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Render inline markdown: **bold** and plain text mixed
    const renderInline = (text) => {
        const parts = text.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} style={{ color: '#e8e8e8', fontWeight: '600' }}>{part.slice(2, -2)}</strong>;
            }
            return <span key={i}>{part}</span>;
        });
    };

    // Smart prose renderer — handles markdown naturally without forcing structure
    const renderStructuredContent = (text, animate = false) => {
        if (!text) return null;

            const isHeadline = (trimmed === trimmed.toUpperCase() && trimmed.length > 4 && !/^[•\-\*⚠]/.test(trimmed) && !trimmed.includes(':'))
                || trimmed.startsWith('✅') || trimmed.startsWith('📌');
        // Split into paragraphs first (double newline = paragraph break)
        const paragraphs = text.split(/\n{2,}/);

        return paragraphs.map((para, pIdx) => {
            const lines = para.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length === 0) return null;

            // Check if this paragraph is a bullet list
            const isBulletBlock = lines.every(l => /^[•\-\*]/.test(l));

            // Check if it's a section header (✅ 📌 ⚠️ or ALL CAPS short line)
            const isHeader = lines.length === 1 && (
                lines[0].startsWith('✅') ||
                lines[0].startsWith('📌') ||
                lines[0].startsWith('⚠') ||
                (lines[0] === lines[0].toUpperCase() && lines[0].length > 3 && lines[0].length < 60 && !/[a-z]/.test(lines[0]))
            );

            // Check if it's a "Source:" line
            const isSource = lines.length === 1 && /^source:/i.test(lines[0]);

            if (isSource) {
                return (
                    <div key={pIdx} style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid #1e1e1e', fontSize: '11px', color: '#444', letterSpacing: '0.3px' }}>
                        {renderInline(lines[0])}
                    </div>
                );
            }

            if (trimmed.startsWith('⚠')) {
                return <div key={i} style={{ color: '#b8986a', fontSize: '12px', marginBottom: 4 }}>
                    {animate ? <TypewriterText text={trimmed} speed={10} /> : trimmed}
                </div>;
            }

            if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('  •')) {
                const content = trimmed.replace(/^[•\-\*]\s*|^\s+•\s*/, '');
            if (isHeader) {
                return (
                    <div key={pIdx} style={{ fontWeight: '700', fontSize: '13px', color: '#d0d0d0', marginTop: pIdx > 0 ? 18 : 0, marginBottom: 8, letterSpacing: '0.2px' }}>
                        {animate ? <TypewriterText text={lines[0]} speed={10} /> : lines[0]}
                    </div>
                );
            }

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

            if (isBulletBlock) {
                return (
                    <div key={pIdx} style={{ marginBottom: 10 }}>
                        {lines.map((line, lIdx) => {
                            const content = line.replace(/^[•\-\*]\s*/, '');
                            return (
                                <div key={lIdx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 5 }}>
                                    <span style={{ color: '#3d3d3d', fontSize: '14px', lineHeight: '1.5', flexShrink: 0, marginTop: 1 }}>–</span>
                                    <span style={{ fontSize: '14px', color: '#c0c0c0', lineHeight: '1.65' }}>
                                        {animate ? <TypewriterText text={content} speed={12} /> : renderInline(content)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                );
            }

            // Default: render as flowing prose paragraph
            const fullPara = lines.join(' ');
            return (
                <p key={pIdx} style={{ fontSize: '14px', color: '#b8b8b8', lineHeight: '1.75', marginBottom: 14, marginTop: 0 }}>
                    {animate ? <TypewriterText text={fullPara} speed={8} /> : renderInline(fullPara)}
                </p>
            );
        });
    };

    const [clickPulse, setClickPulse] = useState(null);


    // --- Interactive Browser Click Handlers ---
    const handleMonitorClick = (e) => {
        if (!monitorImgRef.current || !socketRef.current || !user?._id) return;
        const rect = monitorImgRef.current.getBoundingClientRect();
        
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const scaleX = 1280 / rect.width;
        const scaleY = 720 / rect.height;
        const finalX = Math.round(x * scaleX);
        const finalY = Math.round(y * scaleY);
        
        setClickPulse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        setTimeout(() => setClickPulse(null), 600);

        socketRef.current.emit("browser_input", { 
            userId: user._id, 
            type: 'click', 
            x: finalX, 
            y: finalY 
        });
    };

    const handleKeyDown = (e) => {
        // Only send if it's not a shortcut we want to keep (like Ctrl+R)
        if (e.ctrlKey || e.metaKey) return;
        
        if (!socketRef.current || !user?._id) return;

        // Prevent default for keys that scroll the page
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Backspace", "Space", "Enter"].includes(e.key)) {
            e.preventDefault();
        }

        socketRef.current.emit("browser_input", {
            userId: user._id,
            type: 'keypress',
            key: e.key
        });
    };

    return (
        <div
            className="action-workspace-container"
            style={{ userSelect: (isResizing || isResizingVert) ? 'none' : 'auto' }}
        >
            <div className="history-sidebar" style={{ width: isSidebarOpen ? 260 : 0 }}>
                <div className="history-header">
                    <Activity size={14} /> Session History
                </div>

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

            <div ref={containerRef} className="action-split-layout">
                <div
                    className="action-left-pane-split"
                    style={{ width: `${leftPaneWidth}%`, display: 'flex' }}
                >
                    <div className={`execution-monitor-section ${activeTasks[0]?.metadata?.continuation ? 'deep-dive' : ''}`} style={{ height: `${topPaneHeight}%`, flex: 'none' }}>
                        <div className="terminal-header">
                            <Activity size={12} /> 
                            <span style={{ marginLeft: 8 }}>
                                {activeTasks[0]?.title || "Active Task Monitor"}
                            </span>
                            {activeTasks[0]?.metadata?.continuation && (
                                <div className="context-badge" style={{ marginLeft: 12, marginBottom: 0 }}>
                                    <div className="pulse-dot" />
                                    CONTEXT MAINTAINED
                                </div>
                            )}
                            {(activeTasks.length > 0 || isConnecting) && (
                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: '9px', color: '#00ff88' }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#00ff88', boxShadow: '0 0 10px #00ff88', animation: 'pulse 1.5s infinite' }} />
                                    LIVE FEED
                                </div>
                            )}
                        </div>
                        <div 
                            style={{ flex: 1, backgroundColor: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'crosshair', outline: 'none' }} 
                            onClick={handleMonitorClick}
                            onKeyDown={handleKeyDown}
                            tabIndex="0"
                        >
                            {browserFrame ? (
                                <>
                                    <img
                                        ref={monitorImgRef}
                                        src={browserFrame.frame}
                                        alt="Browser View"
                                        style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                                        className={activeTasks[0]?.status === 'intervention' ? "monitor-dimmed" : ""}
                                    />
                                    {clickPulse && (
                                        <motion.div
                                            initial={{ scale: 0, opacity: 0.8 }}
                                            animate={{ scale: 2, opacity: 0 }}
                                            style={{
                                                position: 'absolute',
                                                top: clickPulse.y,
                                                left: clickPulse.x,
                                                width: 20,
                                                height: 20,
                                                background: 'rgba(255,255,255,0.4)',
                                                borderRadius: '50%',
                                                pointerEvents: 'none',
                                                zIndex: 5
                                            }}
                                        />
                                    )}
                                    {activeTasks[0]?.status === 'intervention' && (
                                        <div 
                                            style={{ 
                                                position: 'absolute', 
                                                top: 20, left: 20, right: 20,
                                                display: 'flex',
                                                justifyContent: 'center',
                                                pointerEvents: 'none',
                                                zIndex: 10
                                            }}
                                        >
                                            <div style={{ 
                                                background: 'rgba(243, 156, 18, 0.95)', 
                                                backdropFilter: 'blur(10px)',
                                                color: '#000', 
                                                padding: '8px 15px', 
                                                borderRadius: '12px', 
                                                fontSize: '10px', 
                                                fontWeight: '800',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 12,
                                                boxShadow: '0 10px 30px rgba(243,156,18,0.3)',
                                                pointerEvents: 'auto',
                                                border: '1px solid rgba(0,0,0,0.1)'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <AlertTriangle size={12} /> VERIFICATION REQUIRED
                                                </div>
                                                <div style={{ width: 1, height: 15, background: 'rgba(0,0,0,0.1)' }} />
                                                <button
                                                    onClick={() => {
                                                        sendCommand("I have solved the verification. Please continue.", true);
                                                    }}
                                                    style={{
                                                        background: '#000',
                                                        color: '#f39c12',
                                                        border: 'none',
                                                        padding: '5px 12px',
                                                        borderRadius: '6px',
                                                        fontSize: '9px',
                                                        fontWeight: '900',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    RESUME MISSION
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
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
                                        padding: '12px 20px', // Slimmer padding
                                        borderRadius: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 15,
                                        boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 20px rgba(0,255,136,0.1)',
                                        pointerEvents: 'auto'
                                    }}
                                >
                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,255,136,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <CheckCircle2 size={16} color="#00ff88" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ color: '#fff', fontSize: '13px', fontWeight: '700' }}>Task Complete</div>
                                        <div style={{ color: '#666', fontSize: '10px' }}>Final report delivered.</div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            socketRef.current.emit('acknowledge_task', { workflowId: activeTasks[0]._id });
                                            fetchTasks();
                                            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                                        }}
                                        style={{ background: '#00ff88', color: '#000', border: 'none', padding: '6px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}
                                    >
                                        DISMISS
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div
                        className="pane-divider-vert"
                        onMouseDown={() => setIsResizingVert(true)}
                    />

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

                <div
                    className="pane-divider"
                    style={{ display: 'flex' }}
                    onMouseDown={() => setIsResizing(true)}
                />

                <div className="action-right-pane-split">
                    <div className="command-center">
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
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                                                {msg.metadata?.meetingData ? (
                                                    <div className="premium-result-card" style={{ background: '#111', border: '1px solid #222', borderRadius: '16px', overflow: 'hidden' }}>
                                                        <div style={{ padding: '15px 20px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <div style={{ color: '#00ff88', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <CheckCircle2 size={12} /> MEETING SCHEDULED
                                                            </div>
                                                            <div style={{ color: '#444', fontSize: '10px' }}>{new Date(msg.timestamp).toLocaleTimeString()}</div>
                                                        </div>
                                                        <div style={{ padding: '20px' }}>
                                                            <div style={{ color: '#fff', fontSize: '15px', fontWeight: 'bold', marginBottom: '10px' }}>
                                                                {msg.metadata.meetingData.title || "Scheduled Meeting"}
                                                            </div>
                                                            <div style={{ color: '#aaa', fontSize: '13px', marginBottom: '20px' }}>
                                                                Your requested meeting has been automatically set up via {msg.metadata.meetingData.provider === 'zoom' ? 'Zoom' : 'Google Meet'}.
                                                            </div>
                                                            <a href={msg.metadata.meetingData.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                                                                <div style={{ background: '#6c5ce7', color: '#fff', padding: '12px 20px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                                                                    <ExternalLink size={16} /> JOIN {msg.metadata.meetingData.provider === 'zoom' ? 'ZOOM' : 'MEETING'}
                                                                </div>
                                                            </a>
                                                        </div>
                                                    </div>
                                                ) : isResult ? (
                                                    <div className="premium-result-card" style={{ background: '#111', border: '1px solid #222', borderRadius: '16px', overflow: 'hidden' }}>
                                                        <div style={{ padding: '15px 20px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <div style={{ color: msg.metadata?.continuation ? '#00d2ff' : '#00ff88', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                {msg.metadata?.continuation ? <Sparkles size={12} /> : <CheckCircle2 size={12} />} 
                                                                {msg.metadata?.continuation ? 'REFINED INTELLIGENCE' : (msg.content.includes('Complete') || msg.content.includes('Successful') ? 'TASK SUCCESSFUL' : 'UPDATE')}
                                                            </div>
                                                            <div style={{ color: '#444', fontSize: '10px' }}>{new Date(msg.timestamp).toLocaleTimeString()}</div>
                                                        </div>
                                                        <div style={{ padding: '20px' }}>
                                                            {renderStructuredContent(msg.content, isNew)}
                                                            {msg.metadata?.sourceUrl && (
                                                                <div style={{ marginTop: 30, borderTop: '1px solid #222', paddingTop: 20 }}>
                                                                    <div style={{ color: '#555', fontSize: '10px', marginBottom: 12, fontWeight: '800', letterSpacing: '1px' }}>VERIFIED ORIGIN</div>
                                                                    <div 
                                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', padding: '10px 16px', borderRadius: '50px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                                                                        onClick={() => window.open(msg.metadata.sourceUrl, '_blank')}
                                                                    >
                                                                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                                                            <img src={`https://www.google.com/s2/favicons?domain=${msg.metadata.sourceUrl}&sz=64`} style={{ width: 18, height: 18 }} alt="favicon" />
                                                                        </div>
                                                                        <div style={{ color: '#eee', fontSize: '12px', fontWeight: '600' }}>{new URL(msg.metadata.sourceUrl).hostname.replace('www.', '')}</div>
                                                                        <ExternalLink size={12} color="#666" style={{ marginLeft: 4 }} />
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {msg.metadata?.evidenceUrl && (
                                                                <div style={{ marginTop: 20 }}>
                                                                    <div style={{ color: '#555', fontSize: '10px', marginBottom: 10, fontWeight: '800', letterSpacing: '1px' }}>VISUAL EVIDENCE</div>
                                                                    <a href={msg.metadata.evidenceUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', position: 'relative' }}>
                                                                        <img src={msg.metadata.evidenceUrl} alt="Proof" style={{ width: '100%', borderRadius: '12px', border: '1px solid #222', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} />
                                                                    </a>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : isClarification ? (
                                                    <div style={{ background: 'rgba(255, 165, 0, 0.05)', border: '1px solid rgba(255, 165, 0, 0.2)', padding: '16px 20px', borderRadius: '16px 16px 16px 4px', color: '#fff', fontSize: '15px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ffa500', fontSize: '11px', fontWeight: '800', marginBottom: 8, textTransform: 'uppercase' }}>
                                                            <Sparkles size={12} /> Need more clarity
                                                        </div>
                                                        {msg.content}
                                                    </div>
                                                ) : msg.type === 'intervention' ? (
                                                    <div style={{ background: 'rgba(108, 92, 231, 0.05)', border: '1px solid rgba(108, 92, 231, 0.2)', padding: '16px 20px', borderRadius: '16px 16px 16px 4px', color: '#fff', fontSize: '15px', display: 'flex', flexDirection: 'column', gap: 15 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#a29bfe', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }}>
                                                            <Sparkles size={12} /> {msg.metadata?.subtype === 'resume_upload' ? 'Action Required: Resume Missing' : 'Action Required: Identity Locked'}
                                                        </div>
                                                        <div style={{ opacity: 0.9 }}>{msg.content}</div>
                                                        
                                                        {msg.metadata?.subtype === 'resume_upload' && (
                                                            <div style={{ marginTop: 5 }}>
                                                                <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} accept=".pdf,.doc,.docx" />
                                                                <button onClick={() => fileInputRef.current?.click()} className="intervention-primary-btn" style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', cursor: 'pointer' }}>
                                                                    {isLoading ? <Loader2 size={16} className="spin-icon" /> : <Upload size={16} />}
                                                                    UPLOAD RESUME (.PDF, .DOCX)
                                                                </button>
                                                            </div>
                                                        )}

                                                        {msg.metadata?.subtype === 'email_selection' && (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 5 }}>
                                                                <button 
                                                                    disabled={isLoading}
                                                                    className="email-choice-card"
                                                                    style={{ textAlign: 'left', width: '100%', background: 'rgba(255,255,255,0.03)', padding: '12px 18px', border: '1px solid #222', borderRadius: '12px', cursor: isLoading ? 'wait' : 'pointer' }}
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        const workflowId = msg.workflowId || msg.metadata?.workflowId;
                                                                        resumeIdentity(workflowId, msg.metadata.registeredEmail);
                                                                    }}
                                                                >
                                                                    <div style={{ fontSize: '11px', color: '#666', marginBottom: 2, textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span>Registered Nurotra Email</span>
                                                                        {isLoading && <Loader2 size={10} className="spin-icon" />}
                                                                    </div>
                                                                    <div style={{ color: '#fff', fontWeight: '600', fontSize: '14px' }}>{msg.metadata.registeredEmail}</div>
                                                                </button>

                                                                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #333', borderRadius: '12px', padding: '12px 16px' }}>
                                                                    <div style={{ fontSize: '12px', color: '#666', marginBottom: 10 }}>Use a Different Email</div>
                                                                    <div style={{ display: 'flex', gap: 10 }}>
                                                                        <input 
                                                                            type="email" 
                                                                            id={`custom-email-input-${msg._id}`}
                                                                            placeholder="e.g. name@professional.com"
                                                                            className="orchestrator-input"
                                                                            style={{ height: 38, fontSize: '13px', background: '#000', flex: 1, border: '1px solid #222' }}
                                                                        />
                                                                        <button 
                                                                            disabled={isLoading}
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                const inputEl = document.getElementById(`custom-email-input-${msg._id}`);
                                                                                const email = inputEl ? inputEl.value : '';
                                                                                if (!email || !email.includes('@')) return alert("Please enter a valid email");
                                                                                const workflowId = msg.workflowId || msg.metadata?.workflowId;
                                                                                resumeIdentity(workflowId, email);
                                                                            }}
                                                                            style={{ background: '#6c5ce7', color: '#fff', padding: '0 15px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                                                                        >
                                                                            {isLoading ? <Loader2 size={14} className="spin-icon" /> : 'Save'}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {msg.metadata?.subtype === 'link_request' && (
                                                            <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                                                                <input type="text" placeholder="Paste the URL here..." className="intervention-url-input" onKeyDown={(e) => { if (e.key === 'Enter') handleInterventionLink(msg.workflowId, e.target.value); }} />
                                                                <button onClick={(e) => handleInterventionLink(msg.workflowId, e.currentTarget.previousSibling.value)}>SUBMIT</button>
                                                            </div>
                                                        )}

                                                        {(msg.metadata?.type === 'data_request' || msg.type === 'data_request' || (!msg.metadata?.subtype && !msg.metadata?.type)) && (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 5 }}>
                                                                <div style={{ display: 'flex', gap: 10 }}>
                                                                    <input type="text" placeholder="Type your answer here..." className="intervention-url-input" onKeyDown={(e) => { if (e.key === 'Enter') handleInterventionLink(msg.metadata?.workflowId || msg.workflowId, e.target.value); }} />
                                                                    <button onClick={(e) => handleInterventionLink(msg.metadata?.workflowId || msg.workflowId, e.currentTarget.previousSibling.value)}>SUBMIT</button>
                                                                </div>
                                                                {msg.content?.toLowerCase().match(/\b(resume|cv|upload)\b/) && (
                                                                    <div>
                                                                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} accept=".pdf,.doc,.docx" />
                                                                        <button onClick={() => fileInputRef.current?.click()} className="intervention-primary-btn" style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', cursor: 'pointer', background: 'rgba(255, 255, 255, 0.05)', border: '1px dashed rgba(255,255,255,0.2)' }}>
                                                                            {isLoading ? <Loader2 size={16} className="spin-icon" /> : <Upload size={16} />}
                                                                            UPLOAD RESUME DOCUMENTS (.PDF, .DOCX)
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div style={{ color: isUser ? '#fff' : '#ccc', fontSize: '15px', backgroundColor: isUser ? '#181818' : 'transparent', padding: isUser ? '12px 20px' : '0', borderRadius: '16px 4px 16px 16px', border: isUser ? '1px solid #222' : 'none' }}>
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

                        <div style={{ padding: '10px 5% 0 5%', display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
                            {suggestions.map((s, i) => (
                                <button key={i} onClick={() => handleQuickAction(s)} className="suggestion-pill">{s}</button>
                            ))}
                        </div>

                        <div style={{ padding: '20px 5% 40px 5%', background: 'linear-gradient(to top, #080808 80%, transparent)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#111', borderRadius: '24px', padding: '8px 8px 8px 16px', border: '1px solid #222' }}>
                                <Sparkles size={18} color="#6c5ce7" style={{ opacity: 0.5 }} />
                                <button onClick={toggleListening} style={{ background: 'none', border: 'none', color: isListening ? '#ff4757' : '#666', cursor: 'pointer' }}>
                                    {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                                </button>
                                <button onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>
                                    <Paperclip size={18} />
                                </button>
                                <input
                                    type="text"
                                    placeholder={isLoading ? "Nurotra is thinking..." : isConnecting ? "Waiting for engine..." : `Message Nurotra...`}
                                    style={{ flex: 1, background: 'none', border: 'none', color: '#fff', outline: 'none', padding: '10px 0', fontSize: '15px' }}
                                    value={commandInput}
                                    onChange={(e) => setCommandInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') sendCommand(); }}
                                    disabled={isLoading}
                                />
                                {activeTasks.length > 0 && activeTasks[0].status !== 'completed' && (
                                    <div className="execution-controls">
                                        <button onClick={pauseAgent} className="control-btn pause">
                                            {activeTasks[0].status === 'paused' ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
                                        </button>
                                        <button onClick={stopAgent} className="control-btn stop"><X size={16} strokeWidth={3} /></button>
                                    </div>
                                )}
                                <button onClick={(e) => sendCommand(null, e)} disabled={!commandInput.trim() || isLoading} style={{ background: commandInput.trim() ? '#fff' : '#222', color: '#000', border: 'none', width: 40, height: 40, borderRadius: '50%', cursor: 'pointer' }}>
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