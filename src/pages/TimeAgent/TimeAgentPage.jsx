import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar as CalendarIcon,
    Clock,
    Send,
    Mic,
    Zap,
    Activity,
    Cpu,
    CheckCircle2,
    Settings,
    ArrowLeft,
    Maximize2,
    Plus,
    Play
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './TimeAgent.css';

const TimeAgentPage = () => {
    const navigate = useNavigate();

    // UI State
    const [command, setCommand] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [calendarWidth, setCalendarWidth] = useState(50);
    const [isResizing, setIsResizing] = useState(false);
    const [selectedDay, setSelectedDay] = useState(25);
    const [isSyncExpanded, setIsSyncExpanded] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isAutoMode, setIsAutoMode] = useState(true);
    const [isTodoView, setIsTodoView] = useState(false);

    // Data State
    const [tasks, setTasks] = useState([
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
    ]);

    const [logs, setLogs] = useState([
        { time: '11:52:16', msg: 'System: Heuristic sync complete.' },
        { time: '11:52:09', msg: 'Time Agent: Analyzing temporal drift...' },
        { time: '11:52:00', msg: 'Docs Agent: Research phase initiated.' },
        { time: '11:51:52', msg: 'Comm Agent: Monitoring inbox.' },
        { time: '11:51:46', msg: 'System: Resources optimized.' }
    ]);

    const [chatStage, setChatStage] = useState(0);
    const [pendingTask, setPendingTask] = useState(null);
    const [taskContext, setTaskContext] = useState('');
    const [objectives, setObjectives] = useState([]);

    const [todos, setTodos] = useState([
        { id: 1, text: 'Review Docs Agent draft', completed: false, priority: 'high' },
        { id: 2, text: 'Sync calendar with pitch deadline', completed: true, priority: 'medium' },
        { id: 3, text: 'Finalize Nurotra Landing Page', completed: false, priority: 'low' },
        { id: 4, text: 'Prepare weekly tech report', completed: false, priority: 'medium' },
        { id: 5, text: 'Research Vector DB integration', completed: false, priority: 'high' },
        { id: 6, text: 'Team sync at 4 PM', completed: false, priority: 'medium' },
        { id: 7, text: 'Update system dependencies', completed: true, priority: 'low' },
        { id: 8, text: 'Design new Time Agent icons', completed: false, priority: 'medium' },
        { id: 9, text: 'Test multimodal PPT export', completed: false, priority: 'high' }
    ]);
    const [newTodo, setNewTodo] = useState('');

    const [messages, setMessages] = useState([
        {
            id: 1,
            role: 'assistant',
            text: 'Welcome back, Avant. Autonomous monitoring is active. I have coordinated with the Docs and Comm agents to streamline your Q3 preparations. How would you like to proceed?'
        }
    ]);

    const chatEndRef = useRef(null);

    // Effects
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTodoView]);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing) return;
            const percentage = (e.clientX / window.innerWidth) * 100;
            if (percentage > 20 && percentage < 80) {
                setCalendarWidth(percentage);
            }
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

    // Handlers
    const handleCommand = () => {
        if (!command.trim()) return;

        const userMsg = command;
        setCommand('');
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: userMsg }]);

        const addLog = (msgText) => {
            setLogs(prev => [{
                time: new Date().toLocaleTimeString([], { hour12: false }),
                msg: msgText
            }, ...prev]);
        };

        if (chatStage === 0) {
            addLog(`User: "${userMsg}"`);
            setPendingTask(userMsg);
            setTaskContext(userMsg);
            setChatStage(1);

            setTimeout(() => {
                const hasDeadline = userMsg.match(/(\d+)(st|nd|rd|th)?/i) || userMsg.toLowerCase().includes('tomorrow') || userMsg.toLowerCase().includes('today');
                const question = hasDeadline
                    ? 'Time Agent: I see the deadline. Could you specify any additional constraints or who the target audience is?'
                    : 'Time Agent: Need details. What is the deadline for this task and who is the audience?';

                setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', text: question }]);
                addLog(question);
            }, 1000);
        } else if (chatStage === 1) {
            addLog(`User: "${userMsg}"`);
            setTaskContext(prev => prev + " | " + userMsg);
            setChatStage(2);

            setTimeout(() => {
                const text = 'Time Agent: Are there any specific themes, tools, or formats I should use?';
                setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', text }]);
                addLog(text);
            }, 1000);
        } else if (chatStage === 2) {
            addLog(`User: "${userMsg}"`);
            setTaskContext(prev => prev + " | " + userMsg);
            setChatStage(0);

            setTimeout(() => {
                addLog('Time Agent: Perfect. I have enough context. Decomposing task into daily objectives...');
                generateTasks(pendingTask, taskContext + " | " + userMsg);

                setMessages(prev => [...prev, {
                    id: Date.now(),
                    role: 'assistant',
                    text: 'Perfect. I have enough context. I have decomposed the task and updated your calendar.'
                }]);
                handleAddTodo(`Execute: ${pendingTask}`);
            }, 1000);
        }
    };

    const generateTasks = (taskName, timeContext) => {
        const today = new Date().getDate();
        const newObjectives = [
            { id: Date.now(), targetDay: today, title: `Initialize: ${taskName}`, status: 'completed' },
            { id: Date.now() + 1, targetDay: today + 1, title: `Drafting: ${taskName}`, status: 'running' },
            { id: Date.now() + 2, targetDay: today + 2, title: `Review: ${taskName}`, status: 'pending' }
        ];
        setObjectives(prev => [...prev, ...newObjectives]);
    };

    const handleAddTodo = (customText = null) => {
        const text = customText || newTodo;
        if (!text.trim()) return;

        const priority = text.toLowerCase().includes('#urgent') ? 'high' : 'medium';
        const cleanText = text.replace('#urgent', '').trim();

        const newTask = {
            id: Date.now(),
            text: cleanText,
            completed: false,
            priority: priority
        };

        setTodos(prev => [newTask, ...prev]);
        setNewTodo('');
    };

    const toggleTodo = (id) => {
        setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    };

    const calendarDays = Array.from({ length: 35 }, (_, i) => {
        const day = i - 3; // Mocking March
        return { day, status: day === 25 ? 'active' : (day < 25 && day > 0) ? 'past' : 'future' };
    });

    return (
        <div className="ta-root">
            <div className="ta-bg-effects">
                <div className="ta-bg-orb ta-bg-orb--blue" />
                <div className="ta-bg-orb ta-bg-orb--purple" />
            </div>

            <main className="ta-workspace">
                {/* LEFT PANEL: Calendar */}
                <div className="ta-calendar-panel" style={{ width: `${calendarWidth}%` }}>
                    <div className="ta-calendar-inner">
                        <header className="ta-cal-header">
                            <div>
                                <button className="ta-back-btn" onClick={() => navigate('/')}>
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

                        <div className="ta-calendar-grid">
                            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
                                <div key={day} className="ta-day-label">{day}</div>
                            ))}
                            {calendarDays.map((d, i) => {
                                const dayObjectives = objectives.filter(obj => obj.targetDay === d.day);
                                return (
                                    <motion.div
                                        key={i}
                                        whileHover={{ y: -2 }}
                                        onClick={() => d.day > 0 && setSelectedDay(d.day)}
                                        className={`ta-day ${selectedDay === d.day ? 'ta-day--selected' : ''} ${d.status === 'past' ? 'ta-day--past' : ''}`}
                                    >
                                        <span className="ta-day__num">
                                            {d.day > 0 ? String(d.day).padStart(2, '0') : ''}
                                        </span>

                                        {d.day > 0 && dayObjectives.length > 0 && (
                                            <div className="ta-day__dots">
                                                {dayObjectives.map(obj => (
                                                    <div key={obj.id} className={`ta-day__mini-dot ${obj.status === 'completed' ? 'ta-day__mini-dot--green' : obj.status === 'running' ? 'ta-day__mini-dot--yellow' : 'ta-day__mini-dot--blue'}`} />
                                                ))}
                                            </div>
                                        )}
                                        {d.day === 25 && <div className="ta-day__dot" />}
                                    </motion.div>
                                );
                            })}
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

                {/* RIGHT PANEL */}
                <div className="ta-chat-panel">
                    <div className="ta-chat-header">
                        <div className="ta-chat-header__left">
                            <div className="ta-chat-header__icon">
                                {isTodoView ? <CheckCircle2 size={18} /> : <Cpu size={18} />}
                            </div>
                            <div>
                                <div className="ta-chat-header__title">{isTodoView ? 'Grounded To-Do' : 'Time Agent AI'}</div>
                                <div className="ta-chat-header__status">
                                    <div className="ta-status-dot" /> {isTodoView ? `${todos.filter(t => !t.completed).length} Pending` : 'Neural Status: Optimal'}
                                </div>
                            </div>
                        </div>
                        <div className="ta-chat-header__right">
                            <button
                                className={`action-btn ${isTodoView ? 'active' : ''}`}
                                onClick={() => setIsTodoView(!isTodoView)}
                                style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
                            >
                                {isTodoView ? 'Back to Chat' : 'My To-Dos'}
                            </button>
                            <div className="ta-chat-header__divider" />
                            <Maximize2 size={16} style={{ cursor: 'pointer', opacity: 0.6 }} />
                        </div>
                    </div>

                    <div className="ta-chat-messages">
                        <AnimatePresence mode="wait">
                            {!isTodoView ? (
                                <motion.div
                                    key="chat"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="flex-1 flex flex-col gap-6"
                                >
                                    {messages.map((msg) => (
                                        <div key={msg.id} className={`ta-msg-row ta-msg-row--${msg.role}`}>
                                            <div className="ta-msg-wrap">
                                                <div className={`ta-msg-avatar ta-msg-avatar--${msg.role}`}>
                                                    {msg.role === 'user' ? <Zap size={14} /> : <Cpu size={14} />}
                                                </div>
                                                <div className={`ta-msg-bubble ta-msg-bubble--${msg.role}`}>
                                                    {msg.text}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={chatEndRef} />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="todos"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="flex-1 overflow-y-auto pr-2"
                                >
                                    <div className="todo-input-container mb-6 mt-2">
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={newTodo}
                                                onChange={(e) => setNewTodo(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                                                placeholder="Add a new task..."
                                                className="todo-main-input"
                                                style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '12px', borderRadius: '12px' }}
                                            />
                                            <button onClick={() => handleAddTodo()} className="todo-add-btn" style={{ background: 'var(--ta-blue)', color: 'white', padding: '12px', borderRadius: '12px' }}>
                                                <Send size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {todos.map(todo => (
                                            <motion.div
                                                key={todo.id}
                                                layout
                                                className={`todo-premium-item ${todo.completed ? 'completed' : ''} ${todo.priority === 'high' ? 'priority-high' : ''}`}
                                                onClick={() => toggleTodo(todo.id)}
                                            >
                                                <div className="todo-check-circle">
                                                    {todo.completed && <CheckCircle2 size={14} className="text-green-500" />}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="todo-text">{todo.text}</p>
                                                    <span className="todo-meta">Added {new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                                                </div>
                                                {todo.priority === 'high' && !todo.completed && (
                                                    <div className="todo-urgent-badge">Urgent</div>
                                                )}
                                            </motion.div>
                                        ))}
                                    </div>
                                    <div ref={chatEndRef} />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="ta-command-bar">
                        <div className="ta-command-inner">
                            {!isTodoView && (
                                <div className="ta-quick-actions">
                                    {['Conflicts', 'Optimize', 'Sync Hub'].map(btn => (
                                        <button key={btn} className="ta-quick-btn">{btn}</button>
                                    ))}
                                </div>
                            )}
                            <div className="ta-input-wrap">
                                <input
                                    type="text"
                                    className="ta-input"
                                    placeholder={isTodoView ? "Quick task entry..." : "Command Time Agent..."}
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

                {/* MONITOR */}
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
            </main>
        </div>
    );
};

export default TimeAgentPage;
