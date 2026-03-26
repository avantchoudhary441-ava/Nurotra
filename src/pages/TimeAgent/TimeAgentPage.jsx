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
    Play,
    LayoutDashboard,
    Trello,
    Download,
    FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { timeAgentService } from '../../services/apiService';
import './TimeAgent.css';

const TimeAgentPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const userName = user?.name ? user.name.split(' ')[0] : 'User';

    // UI State
    const [command, setCommand] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [calendarWidth, setCalendarWidth] = useState(50);
    const [isResizing, setIsResizing] = useState(false);
    const [selectedDay, setSelectedDay] = useState(new Date().getDate());
    const [isSyncExpanded, setIsSyncExpanded] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isAutoMode, setIsAutoMode] = useState(true);
    const [isTodoView, setIsTodoView] = useState(false);
    const [lastPlanning, setLastPlanning] = useState(null);
    const [leftView, setLeftView] = useState('calendar'); // 'calendar' or 'tracker'
    const [trackerSubView, setTrackerSubView] = useState('agents'); // 'agents' or 'users'

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
        { time: new Date().toLocaleTimeString([], { hour12: false }), msg: `System: Neural Engine initialized for ${userName}.` },
        { time: new Date(Date.now() - 60000).toLocaleTimeString([], { hour12: false }), msg: 'Time Agent: Calibrating temporal nexus...' },
        { time: new Date(Date.now() - 120000).toLocaleTimeString([], { hour12: false }), msg: 'Docs Agent: Syncing project manifest.' },
        { time: new Date(Date.now() - 180000).toLocaleTimeString([], { hour12: false }), msg: 'Comm Agent: Monitoring encrypted channels.' }
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
            text: `Welcome back, ${userName}. Autonomous monitoring is active. I have coordinated with the Docs and Comm agents to streamline your schedule. How would you like to proceed?`
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
    const handleCommand = async () => {
        if (!command.trim()) return;

        const userMsg = command.trim();
        setCommand('');

        // 1. Instantly update UI with user message
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: userMsg }]);

        const addLog = (msgText) => {
            setLogs(prev => [{
                time: new Date().toLocaleTimeString([], { hour12: false }),
                msg: msgText
            }, ...prev]);
        };

        addLog(`User: "${userMsg}"`);

        try {
            // 2. Call Plan API
            const response = await timeAgentService.planTask(command);

            if (response.success) {
                // Add coordination logs if triggered
                if (response.document) {
                    setLogs(prev => [
                        { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), msg: "Docs Agent Handover: Initializing 14-stage pipeline" },
                        { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), msg: `Docs Agent: ${response.document.type.toUpperCase()} generation synchronized` },
                        ...prev
                    ]);
                }

                const { intent, planning } = response;
                setLastPlanning(intent);

                // 3. Add Assistant Message
                const assistantMsg = {
                    id: Date.now() + 1,
                    role: 'assistant',
                    text: response.message,
                    document: response.document
                };
                setMessages(prev => [...prev, assistantMsg]);

                // 4. Update Objectives (Calendar Dots)
                if (planning.schedule) {
                    const newObjectives = planning.schedule.map((s, i) => ({
                        id: Date.now() + i + 100,
                        targetDay: s.targetDay,
                        title: s.title,
                        status: 'pending'
                    }));
                    setObjectives(prev => [...prev, ...newObjectives]);

                    // 5. Update Todos (Sidebar List)
                    const newTodos = planning.schedule.map((s, i) => ({
                        id: Date.now() + i + 1000,
                        text: `${s.timeLabel}: ${s.title}`,
                        completed: false,
                        priority: intent.urgency === 'high' || intent.urgency === 'critical' ? 'high' : 'medium'
                    }));
                    setTodos(prev => [...newTodos, ...prev]);
                }

                addLog(`Time Agent: Scaling intensity to ${planning.intensity || 'optimal'} level.`);
            }
        } catch (err) {
            console.error("Planning failed:", err);
            addLog("System Error: Temporal planning engine offline.");
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                text: "I encountered an error while planning your schedule. Please try again with a more specific deadline."
            }]);
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
        const todayNum = new Date().getDate();
        const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay();
        const day = i - (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1) + 1; // Simplified grid offset

        return {
            day,
            status: day === todayNum ? 'active' : (day < todayNum && day > 0) ? 'past' : 'future'
        };
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
                                <div className="ta-header-toggle">
                                    <button
                                        className={`ta-header-btn ${leftView === 'calendar' ? 'ta-header-btn--active' : ''}`}
                                        onClick={() => setLeftView('calendar')}
                                    >
                                        <CalendarIcon size={32} strokeWidth={2.5} />
                                        Nurotra <span>Space</span>
                                    </button>
                                    <div className="ta-header-divider" />
                                    <button
                                        className={`ta-header-btn ${leftView === 'tracker' ? 'ta-header-btn--active' : ''}`}
                                        onClick={() => setLeftView('tracker')}
                                    >
                                        <LayoutDashboard size={32} strokeWidth={2.5} />
                                        Progress <span>Tracker</span>
                                    </button>
                                </div>
                                <p className="ta-cal-subtitle">
                                    {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} <span className="dot" /> <span className="dim">Time Agent Active</span>
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

                        <AnimatePresence mode="wait">
                            {leftView === 'calendar' ? (
                                <motion.div
                                    key="calendar"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="ta-calendar-grid"
                                >
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
                                                {d.day === new Date().getDate() && <div className="ta-day__dot" />}
                                            </motion.div>
                                        );
                                    })}
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="tracker"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="ta-tracker-container"
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="ta-subview-selector">
                                            <button
                                                className={`ta-subview-btn ${trackerSubView === 'agents' ? 'ta-subview-btn--active' : ''}`}
                                                onClick={() => setTrackerSubView('agents')}
                                            >
                                                Agent's Tasks
                                            </button>
                                            <button
                                                className={`ta-subview-btn ${trackerSubView === 'users' ? 'ta-subview-btn--active' : ''}`}
                                                onClick={() => setTrackerSubView('users')}
                                            >
                                                User's Tasks
                                            </button>
                                        </div>
                                        <div className="ta-stat-label" style={{ fontSize: '9px' }}>
                                            {trackerSubView === 'agents' ? `${tasks.length} Active System Threads` : `${todos.length} Personal Items`}
                                        </div>
                                    </div>

                                    {trackerSubView === 'agents' ? (
                                        <>
                                            <div className="ta-tracker-stats">
                                                <div className="ta-stat-card">
                                                    <span className="ta-stat-val">
                                                        {Math.round((objectives.filter(o => o.status === 'completed').length / (objectives.length || 1)) * 100)}%
                                                    </span>
                                                    <span className="ta-stat-label">Agent Efficiency</span>
                                                </div>
                                                <div className="ta-stat-card">
                                                    <span className="ta-stat-val">{tasks.length}</span>
                                                    <span className="ta-stat-label">Active Agents</span>
                                                </div>
                                                <div className="ta-stat-card">
                                                    <span className="ta-stat-val">
                                                        {objectives.filter(o => o.status === 'completed').length}
                                                    </span>
                                                    <span className="ta-stat-label">Objectives Met</span>
                                                </div>
                                            </div>

                                            <div className="ta-task-list">
                                                {tasks.map(task => {
                                                    const progress = task.status === 'running' ? 65 : task.status === 'completed' ? 100 : 0;
                                                    return (
                                                        <div key={task.id} className="ta-task-card">
                                                            <div className="ta-task-header">
                                                                <div className="flex items-center gap-2">
                                                                    <Trello size={14} className="text-blue-400" />
                                                                    <span className="ta-task-name">{task.name}</span>
                                                                </div>
                                                                <span className="ta-task-percentage">{progress}%</span>
                                                            </div>
                                                            <div className="ta-progress-track">
                                                                <motion.div
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${progress}%` }}
                                                                    className="ta-progress-fill"
                                                                />
                                                            </div>
                                                            <div className="ta-objective-grid">
                                                                {objectives.filter(o => o.title.includes(task.name.split(' ').pop())).map(obj => (
                                                                    <div key={obj.id} className="ta-obj-item">
                                                                        <div className={`ta-obj-status ${obj.status === 'completed' ? 'bg-green-500' : obj.status === 'running' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                                                                        <span className="ta-obj-text">{obj.title}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="ta-task-list">
                                            {todos.map(todo => (
                                                <div key={todo.id} className="ta-task-card" style={{ padding: '16px' }}>
                                                    <div className="ta-task-header" style={{ marginBottom: '8px' }}>
                                                        <div className="flex items-center gap-3">
                                                            <div className={`ta-obj-status ${todo.completed ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: '10px', height: '10px' }} />
                                                            <span className="ta-task-name" style={{ opacity: todo.completed ? 0.5 : 1 }}>{todo.text}</span>
                                                        </div>
                                                        {todo.priority === 'high' && <div className="todo-urgent-badge">Urgent</div>}
                                                    </div>
                                                    <div className="ta-stat-label" style={{ fontSize: '9px', marginLeft: '26px' }}>
                                                        Target: March 2026
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
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
                                    <div className="ta-status-dot" />
                                    {isTodoView
                                        ? `${todos.filter(t => !t.completed).length} Pending`
                                        : lastPlanning
                                            ? `Deadline: ${lastPlanning.deadline} | ${lastPlanning.urgency.toUpperCase()}`
                                            : 'Neural Status: Optimal'
                                    }
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
                                                    {msg.document && (
                                                        <div className="ta-document-card">
                                                            <div className="ta-doc-icon">
                                                                <FileText size={18} />
                                                            </div>
                                                            <div className="ta-doc-info">
                                                                <div className="ta-doc-name">{msg.document.name}</div>
                                                                <div className="ta-doc-type">{msg.document.type.toUpperCase()} ready</div>
                                                            </div>
                                                            <button
                                                                className="ta-doc-download"
                                                                onClick={() => window.open(`/api/workspace/download/${msg.document.id}`, '_blank')}
                                                            >
                                                                <Download size={16} />
                                                            </button>
                                                        </div>
                                                    )}
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
