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
    FileText,
    Plus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { timeAgentService, workspaceService } from '../../services/apiService';
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
    const [hoveredDay, setHoveredDay] = useState(null);
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
        const timer = setInterval(() => {
            const now = new Date();
            setCurrentTime(now);

            // Check for scheduled documents that are ready to be delivered
            setMessages(prev => {
                let changed = false;
                const next = prev.map(msg => {
                    if (msg.scheduledDocument && new Date(msg.scheduledDocument.deliverAt) <= now) {
                        changed = true;
                        return {
                            ...msg,
                            document: msg.scheduledDocument,
                            scheduledDocument: null,
                            text: msg.text + "\n\n**UPDATE:** The deadline has arrived. Your document has been securely delivered below!"
                        };
                    }
                    return msg;
                });

                if (changed) {
                    setLogs(l => [{
                        time: now.toLocaleTimeString([], { hour12: false }),
                        msg: "System: Deadline reached. Scheduled file delivery executed."
                    }, ...l]);
                }

                return changed ? next : prev;
            });
        }, 1000);
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

        // Check for Auth session
        if (!user || (!user.token && !localStorage.getItem('nurotra_user'))) {
            const errorMsg = "Your session has expired. Please log in again to use the Time Agent.";
            const assistantMsg = { id: Date.now(), role: 'assistant', text: errorMsg };
            setMessages(prev => [...prev, assistantMsg]);
            addLog(`Error: ${errorMsg}`);
            return;
        }

        try {
            // 2. Call Plan API with current message history for context
            const response = await timeAgentService.planTask(userMsg, messages);

            if (response.success) {
                // Add coordination logs if triggered
                if (response.document) {
                    const docType = response.document.type || 'document';
                    setLogs(prev => [
                        { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), msg: "Docs Agent Handover: Initializing 14-stage pipeline" },
                        { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), msg: `Docs Agent: ${(response.document?.type || 'DOC').toUpperCase()} generation synchronized` },
                        ...prev
                    ]);
                }

                const { intent, planning } = response;
                if (intent) setLastPlanning(intent);

                // Check for existing tasks with similar topics to allow "refinement"
                let existingTaskIndex = -1;
                let activeTaskId = Date.now();
                const safeTopic = (intent?.topic || "").toLowerCase();

                if (safeTopic && Array.isArray(tasks)) {
                    existingTaskIndex = tasks.findIndex(t => {
                        const safeName = (t.name || "").toLowerCase();
                        return safeName && (safeName.includes(safeTopic) || safeTopic.includes(safeName));
                    });
                    if (existingTaskIndex !== -1) {
                        activeTaskId = tasks[existingTaskIndex].id;
                    }
                }

                // 3. Add Assistant Message
                const assistantMsg = {
                    id: Date.now() + 1,
                    role: 'assistant',
                    text: response.message,
                    document: response.document,
                    scheduledDocument: response.scheduledDocument
                };

                // If planning has a schedule, we also add a task breakdown visual
                if (planning && planning.schedule) {
                    const newTasksFromSchedule = planning.schedule.map((s, i) => ({
                        id: Date.now() + i + 500,
                        targetDay: s.targetDay,
                        timeString: s.timeLabel,
                        title: s.title,
                        status: i === 0 ? 'completed' : i === 1 ? 'running' : 'pending'
                    }));

                    const newObjectives = planning.schedule.map((s, i) => ({
                        id: Date.now() + i + 100,
                        taskId: activeTaskId,
                        targetDay: s.targetDay,
                        timeString: s.timeLabel,
                        title: s.title,
                        status: i === 0 ? 'completed' : i === 1 ? 'running' : 'pending'
                    }));

                    const newTodos = planning.schedule.map((s, i) => ({
                        id: Date.now() + i + 1000,
                        taskId: activeTaskId,
                        text: `${s.timeLabel}: ${s.title}`,
                        completed: false,
                        priority: (intent.urgency === 'high' || intent.urgency === 'critical') ? 'high' : 'medium'
                    }));

                    if (existingTaskIndex !== -1) {
                        // REFINEMENT LOGIC: Replace old objectives/todos for this topic
                        const oldTaskName = tasks[existingTaskIndex].name;

                        setTasks(prev => {
                            const updated = [...prev];
                            updated[existingTaskIndex] = {
                                ...updated[existingTaskIndex],
                                name: intent.topic,
                                status: 'running',
                                steps: planning.schedule.slice(0, 2).map(s => s.title)
                            };
                            return updated;
                        });

                        setObjectives(prev => [
                            ...prev.filter(obj => obj.taskId !== activeTaskId),
                            ...newObjectives
                        ]);

                        setTodos(prev => [
                            ...newTodos,
                            ...prev.filter(t => t.taskId !== activeTaskId)
                        ]);

                        addLog(`Time Agent: Refined execution path for "${intent.topic}". Deadlines shifted.`);
                    } else {
                        // NEW TASK LOGIC
                        setTasks(prev => [{
                            id: activeTaskId,
                            agent: intent.requires_docs ? 'Docs Agent' : 'Time Agent',
                            name: intent.topic,
                            status: 'running',
                            steps: planning.schedule.slice(0, 2).map(s => s.title)
                        }, ...prev]);

                        setObjectives(prev => [...prev, ...newObjectives]);
                        setTodos(prev => [...newTodos, ...prev]);
                    }

                    setMessages(prev => [
                        ...prev,
                        assistantMsg,
                        {
                            id: Date.now() + 2,
                            role: 'system',
                            type: 'task_breakdown',
                            text: 'Updated Task Execution Path',
                            tasks: newTasksFromSchedule
                        }
                    ]);
                } else {
                    setMessages(prev => [...prev, assistantMsg]);
                }

                if (planning) {
                    addLog(`Time Agent: Scaling intensity to ${planning.intensity || 'optimal'} level.`);
                }
            }
        } catch (err) {
            console.error("Planning failed:", err);

            let errorMsg = "I encountered an error while planning your schedule. Please try again with a more specific deadline.";

            if (err.response?.status === 401) {
                errorMsg = "Your session has expired. Please refresh the page and log in again to continue.";
                addLog("Security Alert: Session expired. Authorization required.");
            } else {
                addLog("System Error: Temporal planning engine encountered an exception.");
            }

            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                text: errorMsg
            }]);
        }
    };

    // Keep generateTasks as a fallback or for other UI parts if needed
    const generateTasks = (taskName, timeContext) => {
        const todayStr = 25; // Still mocking day 25 internally to match the active UI calendar
        let now = new Date();
        now.setDate(todayStr); // Sync internal Date to the mock calendar date for consistent rendering

        const contextStr = (timeContext || "").toLowerCase();

        let deadline = new Date(now.getTime()); // Copy current mocked time

        // 1. Check relative times (e.g. "in 10 min", "in 10 sec")
        const relMatch = contextStr.match(/in\s+(\d+)\s*(min|minute|sec|second)s?/i);
        if (relMatch) {
            const amount = parseInt(relMatch[1], 10);
            const unit = relMatch[2];
            if (unit.startsWith('min')) deadline.setMinutes(deadline.getMinutes() + amount);
            if (unit.startsWith('sec')) deadline.setSeconds(deadline.getSeconds() + amount);
        } else {
            // 2. Check absolute times (e.g. "10:30 am", "2pm")
            const timeMatch = contextStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
            if (timeMatch) {
                let hours = parseInt(timeMatch[1], 10);
                const isPM = timeMatch[3] === 'pm';
                if (isPM && hours < 12) hours += 12;
                if (!isPM && hours === 12) hours = 0;
                let minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
                deadline.setHours(hours, minutes, 0);
            } else {
                deadline.setHours(23, 59, 59); // Default end of day
            }

            // 3. Check absolute dates (e.g. "27 march")
            const dateMatch = contextStr.match(/(\d{1,2})(st|nd|rd|th)?/i);
            if (dateMatch && parseInt(dateMatch[1], 10) > 0) {
                deadline.setDate(parseInt(dateMatch[1], 10));
            } else {
                deadline.setDate(todayStr + 2); // Default fallback: +2 days
            }
        }

        // Calculate milestones by interpolating time between 'now' and 'deadline'
        const totalMs = deadline.getTime() - now.getTime();

        // If deadline is somehow in the past relative to mock, shift it forward arbitrarily (fallback)
        const validTotalMs = totalMs > 0 ? totalMs : 60000;

        const draftTime = new Date(now.getTime() + validTotalMs * 0.33);
        const reviewTime = new Date(now.getTime() + validTotalMs * 0.66);

        const formatTime = (dateObj) => {
            return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };

        const newObjectives = [
            { id: Date.now(), targetDay: now.getDate(), timeString: formatTime(now), title: `Collecting resources for: ${taskName}`, status: 'completed' },
            { id: Date.now() + 1, targetDay: draftTime.getDate(), timeString: formatTime(draftTime), title: `Initiating execution on: ${taskName}`, status: 'running' },
            { id: Date.now() + 2, targetDay: deadline.getDate(), timeString: formatTime(deadline), title: `Finalizing: ${taskName}`, status: 'pending' }
        ];

        setObjectives(prev => [...prev, ...newObjectives]);
        return newObjectives;
    };

    const handleAddTodo = (customText = null) => {
        const text = customText || newTodo;
        if (!text.trim()) return;

        const priority = (text || "").toLowerCase().includes('#urgent') ? 'high' : 'medium';
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
                                        const isHovered = hoveredDay === d.day;
                                        return (
                                            <motion.div
                                                key={i}
                                                whileHover={{ y: -2 }}
                                                onClick={() => d.day > 0 && setSelectedDay(d.day)}
                                                onMouseEnter={() => d.day > 0 && setHoveredDay(d.day)}
                                                onMouseLeave={() => setHoveredDay(null)}
                                                className={`ta-day ${selectedDay === d.day ? 'ta-day--selected' : ''} ${d.status === 'past' ? 'ta-day--past' : ''}`}
                                                style={{ position: 'relative' }}
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

                                                {/* Hover Tooltip rendered contextually inside the relatively-positioned grid item */}
                                                <AnimatePresence>
                                                    {isHovered && dayObjectives.length > 0 && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                                            exit={{ opacity: 0, y: 5, scale: 0.95 }}
                                                            transition={{ duration: 0.15 }}
                                                            className="ta-day-tooltip"
                                                            style={{ pointerEvents: 'none', zIndex: 100 }}
                                                        >
                                                            <div className="ta-day-tooltip__header">
                                                                <span>March {d.day}</span> Schedule
                                                            </div>
                                                            <div className="ta-day-tooltip__list">
                                                                {dayObjectives.map(obj => (
                                                                    <div key={obj.id} className="ta-day-tooltip__item">
                                                                        <div className={`ta-tooltip-status-dot ta-tooltip-status-dot--${obj.status}`} />
                                                                        <span className="ta-tooltip-time">{obj.timeString || 'Anytime'}</span>
                                                                        <span className="ta-tooltip-title">{obj.title}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
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
                                                                {objectives.filter(o => {
                                                                    const namePart = (task.name || "").split(' ').pop() || "";
                                                                    return namePart && o.title.includes(namePart);
                                                                }).map(obj => (
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
                                            ? `Deadline: ${lastPlanning.deadline} | ${(lastPlanning.urgency || "optimal").toUpperCase()}`
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
                                                    {msg.role === 'user' ? <Zap size={14} /> : msg.role === 'system' ? <Settings size={14} /> : <Cpu size={14} />}
                                                </div>
                                                <div className={`ta-msg-bubble ta-msg-bubble--${msg.role}`}>
                                                    {msg.type === 'task_breakdown' ? (
                                                        <div className="ta-task-breakdown">
                                                            <p className="ta-task-breakdown-title">Decomposed Task Execution Path</p>
                                                            <div className="ta-task-breakdown-list">
                                                                {msg.tasks.map((task, idx) => (
                                                                    <motion.div
                                                                        key={task.id}
                                                                        initial={{ opacity: 0, x: -10 }}
                                                                        animate={{ opacity: 1, x: 0 }}
                                                                        transition={{ delay: idx * 0.4, duration: 0.3 }}
                                                                        className="ta-task-step"
                                                                    >
                                                                        <div className={`ta-task-step-icon ta-task-step-icon--${task.status}`}>
                                                                            {task.status === 'completed' ? <CheckCircle2 size={12} /> :
                                                                                task.status === 'running' ? <Play size={12} /> :
                                                                                    <Clock size={12} />}
                                                                        </div>
                                                                        <div className="ta-task-step-content">
                                                                            <span className="ta-task-step-day">
                                                                                Mar {task.targetDay} <span className="ta-task-step-time">• {task.timeString}</span>
                                                                            </span>
                                                                            <span className="ta-task-step-title">{task.title}</span>
                                                                        </div>
                                                                    </motion.div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {msg.text}
                                                            {msg.document && (
                                                                <div className="ta-document-card">
                                                                    <div className="ta-doc-icon">
                                                                        <FileText size={18} />
                                                                    </div>
                                                                    <div className="ta-doc-info">
                                                                        <div className="ta-doc-name">{msg.document.name}</div>
                                                                        <div className="ta-doc-type">{(msg.document.type || "document").toUpperCase()} ready</div>
                                                                        <div className="ta-doc-type">{(msg.document?.type || 'DOC').toUpperCase()} ready</div>
                                                                    </div>
                                                                    <button
                                                                        className="ta-doc-download"
                                                                        onClick={() => workspaceService.downloadFile(msg.document.id, msg.document.name)}
                                                                    >
                                                                        <Download size={16} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div >
                                        </div >
                                    ))}
                                    <div ref={chatEndRef} />
                                </motion.div >
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
                        </AnimatePresence >
                    </div >

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
                </div >

                {/* MONITOR */}
                < div
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
                </div >
            </main >
        </div >
    );
};

export default TimeAgentPage;
