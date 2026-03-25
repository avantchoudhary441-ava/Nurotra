import React, { useState, useEffect, useRef } from 'react';
import { 
    Calendar as CalendarIcon, 
    Plus, 
    Settings, 
    Send,
    Mic,
    Cpu,
    ArrowLeft,
    Activity,
    Maximize2,
    Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './TimeAgent.css';

const TimeAgentPage = () => {
    const [command, setCommand] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [calendarWidth, setCalendarWidth] = useState(45);
    const [isResizing, setIsResizing] = useState(false);
    const [selectedDay, setSelectedDay] = useState(25);
    const [isSyncExpanded, setIsSyncExpanded] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const chatEndRef = useRef(null);

    const tasks = [
        { 
            id: 1, 
            agent: 'Docs Agent', 
            name: 'Prepare Q3 Pitch Deck', 
            status: 'running', 
            steps: ['Researching market trends', 'Drafting layout'] 
        },
        { 
            id: 2, 
            agent: 'Comm Agent', 
            name: 'Client Feedback Sync', 
            status: 'pending', 
            steps: ['Scheduling meeting', 'Drafting agenda'] 
        }
    ];

    const logs = [
        { time: '11:52:16', msg: 'System: Heuristic sync complete.' },
        { time: '11:52:09', msg: 'Time Agent: Analyzing temporal drift...' },
        { time: '11:52:00', msg: 'Docs Agent: Research phase initiated.' },
        { time: '11:51:52', msg: 'Comm Agent: Monitoring inbox.' },
        { time: '11:51:46', msg: 'System: Resources optimized.' }
    ];

    const [messages, setMessages] = useState([
        { 
            id: 1, 
            role: 'assistant', 
            text: 'Welcome back, Avant. Autonomous monitoring is active. I have coordinated with the Docs and Comm agents to streamline your Q3 preparations. How would you like to proceed?' 
        },
        { 
            id: 2, 
            role: 'assistant', 
            type: 'execution', 
            content: tasks[0] 
        }
    ]);

    // Clock timer
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Auto scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Resizer logic
    useEffect(() => {
        if (!isResizing) return;
        const handleMouseMove = (e) => {
            const newWidth = (e.clientX / window.innerWidth) * 100;
            if (newWidth > 20 && newWidth < 70) setCalendarWidth(newWidth);
        };
        const handleMouseUp = () => {
            setIsResizing(false);
            document.body.style.cursor = 'default';
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    const handleCommand = () => {
        if (!command.trim()) return;
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: command }]);
        setCommand('');
        setTimeout(() => {
            setMessages(prev => [...prev, { 
                id: Date.now() + 1, 
                role: 'assistant', 
                text: 'Processing your request across the hub... I will update the calendar and notify the relevant agents.' 
            }]);
        }, 800);
    };

    return (
        <div className="ta-root">
            {/* Background Effects */}
            <div className="ta-bg-effects">
                <div className="ta-bg-orb ta-bg-orb--blue" />
                <div className="ta-bg-orb ta-bg-orb--purple" />
            </div>

            {/* Main Workspace */}
            <main className="ta-workspace">

                {/* LEFT PANEL: Calendar */}
                <div className="ta-calendar-panel" style={{ width: `${calendarWidth}%` }}>
                    <div className="ta-calendar-inner">
                        <header className="ta-cal-header">
                            <div>
                                <button className="ta-back-btn" onClick={() => window.history.back()}>
                                    <ArrowLeft size={14} /> Executive Hub
                                </button>
                                <h2 className="ta-cal-title">
                                    <CalendarIcon size={32} strokeWidth={2.5} />
                                    Nurotra <span>Space</span>
                                </h2>
                                <p className="ta-cal-subtitle">
                                    March 2026 <span className="dot" /> <span className="dim">Time Agent Active</span>
                                </p>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <div className="ta-clock-pill">
                                    <span className="ta-clock">
                                        {currentTime.toLocaleTimeString([], { hour12: false })}
                                    </span>
                                </div>
                                <div className="ta-header-actions">
                                    <button className="ta-icon-btn"><Plus size={18} /></button>
                                    <button className="ta-icon-btn"><Settings size={18} /></button>
                                </div>
                            </div>
                        </header>

                        {/* Calendar Grid */}
                        <div className="ta-calendar-grid">
                            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
                                <div key={day} className="ta-day-label">{day}</div>
                            ))}
                            {[...Array(31)].map((_, i) => (
                                <motion.div 
                                    key={i}
                                    whileHover={{ y: -2 }}
                                    onClick={() => setSelectedDay(i + 1)}
                                    className={`ta-day ${selectedDay === i + 1 ? 'ta-day--selected' : ''} ${i + 1 < 25 ? 'ta-day--past' : ''}`}
                                >
                                    <span className="ta-day__num">
                                        {String(i + 1).padStart(2, '0')}
                                    </span>
                                    {i + 1 === 25 && <div className="ta-day__dot" />}
                                    {i + 1 === 27 && (
                                        <div className="ta-day__dots">
                                            <div className="ta-day__mini-dot ta-day__mini-dot--purple" />
                                            <div className="ta-day__mini-dot ta-day__mini-dot--blue" />
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RESIZER */}
                <div 
                    className={`ta-resizer ${isResizing ? 'ta-resizer--active' : ''}`}
                    onMouseDown={() => { setIsResizing(true); document.body.style.cursor = 'col-resize'; }}
                >
                    <div className="ta-resizer__line" />
                </div>

                {/* RIGHT PANEL: Chat */}
                <div className="ta-chat-panel">
                    
                    {/* Chat Header */}
                    <div className="ta-chat-header">
                        <div className="ta-chat-header__left">
                            <div className="ta-chat-header__icon"><Cpu size={18} /></div>
                            <div>
                                <div className="ta-chat-header__title">Time Agent AI</div>
                                <div className="ta-chat-header__status">
                                    <div className="ta-status-dot" /> Neural Status: Optimal
                                </div>
                            </div>
                        </div>
                        <div className="ta-chat-header__right">
                            <span>Encrypted</span>
                            <div className="ta-chat-header__divider" />
                            <Maximize2 size={16} style={{ cursor: 'pointer', opacity: 0.6 }} />
                        </div>
                    </div>

                    {/* Chat Messages */}
                    <div className="ta-chat-messages">
                        <AnimatePresence mode="popLayout">
                            {messages.map((msg) => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`ta-msg-row ta-msg-row--${msg.role}`}
                                >
                                    {msg.type === 'execution' ? (
                                        <div className="ta-exec-card">
                                            <div className="ta-exec-card__glow" />
                                            <div className="ta-exec-header">
                                                <div className="ta-exec-header__left">
                                                    <div className="ta-exec-icon"><Activity size={20} /></div>
                                                    <div>
                                                        <div className="ta-exec-label">Live Task</div>
                                                        <div className="ta-exec-name">{msg.content.name}</div>
                                                    </div>
                                                </div>
                                                <div className="ta-exec-header__right">
                                                    <span className="ta-exec-badge">Running</span>
                                                    <div className="ta-exec-progress">
                                                        <div className="ta-exec-progress__bar" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="ta-exec-steps">
                                                {msg.content.steps.map((step, idx) => (
                                                    <div key={idx} className={`ta-exec-step ta-exec-step--${idx === 0 ? 'active' : 'inactive'}`}>
                                                        <div className={`ta-exec-step__dot ta-exec-step__dot--${idx === 0 ? 'active' : 'inactive'}`} />
                                                        <span>{step}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="ta-msg-wrap">
                                            <div className={`ta-msg-avatar ta-msg-avatar--${msg.role}`}>
                                                {msg.role === 'user' ? <Zap size={14} /> : <Cpu size={14} />}
                                            </div>
                                            <div className={`ta-msg-bubble ta-msg-bubble--${msg.role}`}>
                                                {msg.text}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        <div ref={chatEndRef} />
                    </div>

                    {/* Floating System Monitor */}
                    <div 
                        className={`ta-monitor ${isSyncExpanded ? 'ta-monitor--expanded' : 'ta-monitor--collapsed'}`}
                        onMouseEnter={() => setIsSyncExpanded(true)}
                        onMouseLeave={() => setIsSyncExpanded(false)}
                    >
                        {!isSyncExpanded ? (
                            <div className="ta-monitor__icon"><Activity size={20} /></div>
                        ) : (
                            <div className="ta-monitor__inner">
                                <div className="ta-monitor__header">
                                    <div className="ta-monitor__header-left">
                                        <Activity size={14} style={{ color: 'var(--ta-blue)' }} />
                                        <span className="ta-monitor__title">Neural Sync</span>
                                    </div>
                                    <div className="ta-monitor__ping" />
                                </div>
                                <div className="ta-monitor__logs">
                                    {logs.map((log, i) => (
                                        <div key={i} className="ta-log-entry">
                                            <span className="ta-log-time">[{log.time}]</span>
                                            <span className="ta-log-msg">{log.msg}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Command Bar */}
                    <div className="ta-command-bar">
                        <div className="ta-command-inner">
                            <div className="ta-quick-actions">
                                {['Check Conflicts', 'Optimize Day', 'Sync Hub'].map(btn => (
                                    <button key={btn} className="ta-quick-btn">{btn}</button>
                                ))}
                            </div>
                            <div className="ta-input-wrap">
                                <input 
                                    type="text" 
                                    className="ta-input"
                                    placeholder="Command Time Agent..."
                                    value={command}
                                    onChange={(e) => setCommand(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCommand()}
                                />
                                <div className="ta-input-actions">
                                    <button 
                                        className={`ta-mic-btn ${isListening ? 'ta-mic-btn--active' : ''}`}
                                        onClick={() => setIsListening(!isListening)}
                                    >
                                        <Mic size={20} />
                                    </button>
                                    <button className="ta-send-btn" onClick={handleCommand}>
                                        <Send size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className="ta-brand">Nurotra Neural Engine v4.0</div>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
};

export default TimeAgentPage;
