import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import BackgroundEffects from '../../components/BackgroundEffects';
import { Clock, Calendar, Bell, ArrowLeft, Send, Mic, Play, Settings, CheckCircle2, AlertCircle, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './TimeAgent.css';
import '../../styles/global.css';

const TimeAgentPage = () => {
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [command, setCommand] = useState('');
    const [isAutoMode, setIsAutoMode] = useState(true);
    const [selectedDay, setSelectedDay] = useState(null);
    const [leftWidth, setLeftWidth] = useState(window.innerWidth * 0.6); // 60% default
    const isResizing = React.useRef(false);

    // Mock Data for "Living" System
    const [tasks, setTasks] = useState([]);

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
        { id: 9, text: 'Test multimodal PPT export', completed: false, priority: 'high' },
        { id: 10, text: 'Client follow-up: Project Nexus', completed: false, priority: 'medium' },
        { id: 11, text: 'Organize workspace assets', completed: false, priority: 'low' }
    ]);
    const [showTodoInput, setShowTodoInput] = useState(false);
    const [isTodoView, setIsTodoView] = useState(false);
    const [newTodo, setNewTodo] = useState('');

    const [logs, setLogs] = useState([
        { time: '21:05:10', msg: 'System initialization complete.' },
        { time: '21:05:42', msg: 'Syncing with Nurotra Core...' },
        { time: '21:06:01', msg: 'Docs Agent: Started working on Pitch Deck.' }
    ]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Simulation for "Autonomous Feel"
    useEffect(() => {
        const simulation = setInterval(() => {
            const newLog = {
                time: new Date().toLocaleTimeString([], { hour12: false }),
                msg: [
                    'Analyzing temporal patterns...',
                    'Optimizing schedule for tomorrow...',
                    'Deadline risk check complete: No issues.',
                    'Syncing with Docs Agent...',
                    'Communication Agent: Update pending.'
                ][Math.floor(Math.random() * 5)]
            };
            setLogs(prev => [newLog, ...prev.slice(0, 15)]);
        }, 30000); // reduced spam frequency
        return () => clearInterval(simulation);
    }, []);

    const generateTasks = (taskName, timeContext) => {
        const today = new Date().getDate(); // mocking with current date
        let targetEnd = today + 4 <= 31 ? today + 4 : 28;

        const match = timeContext.match(/(\d+)(st|nd|rd|th)?/i);
        if (match) {
            const parsedDay = parseInt(match[1], 10);
            if (parsedDay >= today && parsedDay <= 31) {
                targetEnd = parsedDay;
            }
        } else if (timeContext.toLowerCase().includes('tomorrow') || timeContext.toLowerCase().includes('tommorow')) {
            targetEnd = today + 1;
        } else if (timeContext.toLowerCase().includes('today')) {
            targetEnd = today;
        }

        const newObjs = [];
        const numDays = targetEnd - today + 1;

        for (let i = 0; i < numDays; i++) {
            const currentDay = today + i;
            let status = 'pending';
            if (i === 0) status = 'completed';
            else if (i === 1) status = 'running';

            let title = `Execute Phase ${i + 1}`;
            if (i === 0) title = 'Analyse requirements';
            if (i === numDays - 1) title = 'Finalize execution';

            newObjs.push({
                id: Date.now() + i,
                title: title,
                targetDay: currentDay,
                status: status
            });
        }

        setObjectives(prev => [...newObjs, ...prev]);

        const newTask = {
            id: Date.now(),
            name: taskName,
            agent: 'Time Agent',
            status: 'running',
            steps: newObjs.map(o => o.title)
        };
        setTasks(prev => [newTask, ...prev]);

        setChatStage('idle');
        setPendingTask(null);
    };

    const handleAddTodo = (text = newTodo) => {
        if (!text.trim()) return;
        const todo = {
            id: Date.now(),
            text: text,
            completed: false,
            priority: text.toLowerCase().includes('urgent') || text.toLowerCase().includes('high') ? 'high' : 'medium'
        };
        setTodos(prev => [todo, ...prev]);
        setNewTodo('');
        setShowTodoInput(false);

        // Make Time Agent "aware"
        setLogs(prev => [{
            time: new Date().toLocaleTimeString([], { hour12: false }),
            msg: `System: New To-Do captured: "${text}". Monitoring for temporal alignment...`
        }, ...prev]);
    };

    const toggleTodo = (id) => {
        setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    };

    const handleCommand = () => {
        if (!command.trim()) return;

        const userMsg = command;
        setCommand('');

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
                const hasDeadline = userMsg.match(/(\d+)(st|nd|rd|th)?/i) || userMsg.toLowerCase().includes('tomorrow') || userMsg.toLowerCase().includes('tommorow') || userMsg.toLowerCase().includes('today');
                const question = hasDeadline
                    ? 'Time Agent: I see the deadline. Could you specify any additional constraints or who the target audience is?'
                    : 'Time Agent: Need details. What is the deadline for this task and who is the audience?';
                addLog(question);
            }, 1000);
        } else if (chatStage === 1) {
            addLog(`User: "${userMsg}"`);
            setTaskContext(prev => prev + " | " + userMsg);
            setChatStage(2);

            setTimeout(() => {
                addLog('Time Agent: Are there any specific themes, tools, or formats I should use?');
            }, 1000);
        } else if (chatStage === 2) {
            addLog(`User: "${userMsg}"`);
            setTaskContext(prev => prev + " | " + userMsg);
            setChatStage(0);

            setTimeout(() => {
                addLog('Time Agent: Perfect. I have enough context. Decomposing task into daily objectives...');
                generateTasks(pendingTask, taskContext + " | " + userMsg);

                // Also add as a high-level To-Do
                handleAddTodo(`Execute: ${pendingTask}`);
            }, 1000);
        }
    };

    const calendarDays = Array.from({ length: 35 }, (_, i) => {
        const day = i - 3; // Mocking current month
        return { day, status: day === 24 ? 'active' : day < 24 ? 'past' : 'future' };
    });

    return (
        <div className="min-h-screen bg-[#050510] text-white">
            <BackgroundEffects />
            <Header />

            <main className="pt-24 h-screen flex flex-col">
                <div className="px-6 py-2">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group text-sm"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Back to Agents
                    </button>
                </div>

                <div className="time-agent-container" style={{ display: 'flex' }}>
                    {/* LEFT SIDE: CALENDAR (The Execution Field) */}
                    <div className="agent-panel calendar-panel" style={{ width: leftWidth, flexShrink: 0 }}>
                        <div className="calendar-header">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <Calendar className="text-blue-400" size={20} />
                                    Nurotra Calendar
                                </h2>
                                <p className="text-xs text-gray-500">March 2026</p>
                            </div>
                            <div className="real-time-clock">
                                {currentTime.toLocaleTimeString([], { hour12: false })}
                            </div>
                        </div>

                        <div className="calendar-grid">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                                <div key={d} className="text-center text-[10px] font-bold text-blue-400/50 uppercase tracking-widest mb-2">
                                    {d}
                                </div>
                            ))}
                            {calendarDays.map((d, i) => {
                                const dayObjectives = objectives.filter(obj => obj.targetDay === d.day);
                                return (
                                    <motion.div
                                        key={i}
                                        initial="initial"
                                        whileHover="hover"
                                        onClick={() => d.day > 0 && setSelectedDay(d)}
                                        className={`day-cell ${d.status} ${selectedDay?.day === d.day ? 'ring-2 ring-blue-500' : ''}`}
                                    >
                                        <span className="day-number">{d.day > 0 ? d.day : ''}</span>

                                        {/* Inline dots indicator for objectives */}
                                        {dayObjectives.length > 0 && (
                                            <div className="mt-2 space-y-1">
                                                <div className="flex gap-1 flex-wrap">
                                                    {dayObjectives.map(obj => (
                                                        <div key={obj.id} className={`w-2 h-2 rounded-full shadow-md ${obj.status === 'completed' ? 'bg-green-500 shadow-green-500/50' : obj.status === 'running' ? 'bg-yellow-500 shadow-yellow-500/50' : 'bg-blue-500 shadow-blue-500/50'}`}></div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}



                                        {/* Hover Expansion Card */}
                                        {d.day > 0 && dayObjectives.length > 0 && (
                                            <motion.div
                                                variants={{
                                                    hover: { opacity: 1, scale: 1, y: 0, pointerEvents: 'auto' },
                                                    initial: { opacity: 0, scale: 0.95, y: -5, pointerEvents: 'none' }
                                                }}
                                                transition={{ duration: 0.2 }}
                                                className="calendar-hover-card"
                                            >
                                                <h4 className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">Day {d.day} Objectives</h4>
                                                <div className="space-y-2">
                                                    {dayObjectives.map(obj => (
                                                        <div key={obj.id} className="flex flex-col gap-1 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span className="text-xs font-semibold text-white leading-tight">{obj.title}</span>
                                                                {obj.status === 'completed' ? <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" /> : obj.status === 'running' ? <Settings size={14} className="text-yellow-500 animate-spin flex-shrink-0" /> : <Clock size={14} className="text-blue-500 flex-shrink-0" />}
                                                            </div>
                                                            <span className={`text-[9px] uppercase tracking-wider font-bold ${obj.status === 'completed' ? 'text-green-400' : obj.status === 'running' ? 'text-yellow-400' : 'text-blue-400'}`}>
                                                                {obj.status}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>

                    {/* RESIZER HANDLE */}
                    <div
                        className="resizer-handle"
                        onMouseDown={(e) => {
                            isResizing.current = true;
                            document.body.style.cursor = 'col-resize';
                            document.body.style.userSelect = 'none';
                        }}
                    >
                        <div className="resizer-line"></div>
                    </div>

                    {/* RIGHT SIDE: COMMAND PANEL (The Brain) */}
                    <div className="agent-panel command-panel" style={{ flex: 1 }}>
                        {/* Section 1: Input */}
                        <div className="panel-section">
                            <div className="command-input-container">
                                <div className="input-wrapper">
                                    <input
                                        type="text"
                                        value={command}
                                        onChange={(e) => setCommand(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleCommand()}
                                        placeholder="Give an intent (e.g. Schedule a pitch meeting)"
                                        className="main-input"
                                    />
                                    <button
                                        onClick={handleCommand}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-400 hover:text-blue-300"
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                                <div className="quick-actions">
                                    <button className="action-btn flex items-center gap-1"><Play size={12} /> Schedule Task</button>
                                    <button className="action-btn flex items-center gap-1"><Calendar size={12} /> Set Goal</button>
                                    <button className="action-btn flex items-center gap-1"><Cpu size={12} /> Execute Now</button>
                                    <button
                                        className={`action-btn flex items-center gap-1 ${isTodoView ? 'active' : ''}`}
                                        onClick={() => setIsTodoView(!isTodoView)}
                                    >
                                        <CheckCircle2 size={12} /> {isTodoView ? 'Back to Logs' : 'My To-Dos'}
                                    </button>
                                    <button className="action-btn"><Mic size={12} /></button>
                                </div>
                            </div>
                        </div>

                        {/* Side Panel Content: Toggle between Breakdown/Logs and Full-Height To-Do List */}
                        <div className="side-panel-content flex-1 relative overflow-hidden">
                            <AnimatePresence mode="wait">
                                {!isTodoView ? (
                                    <motion.div
                                        key="breakdown"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="flex-1 min-h-0"
                                        style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                                    >
                                        {/* Section 2: Task Breakdown */}
                                        <div className="breakdown-feed scrollbar-hide flex-1">
                                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 px-1">Active Executions</h3>
                                            <AnimatePresence initial={false}>
                                                {tasks.map(task => (
                                                    <motion.div
                                                        key={task.id}
                                                        initial={{ opacity: 0, x: 20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, x: -20 }}
                                                        className={`task-step ${task.status === 'running' ? 'border-yellow-500 bg-yellow-500/5' : ''}`}
                                                    >
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div>
                                                                <span className={`text-[10px] font-bold uppercase tracking-tighter ${task.status === 'running' ? 'text-yellow-400' : 'text-blue-400'}`}>
                                                                    {task.agent}
                                                                </span>
                                                                <h4 className="text-sm font-semibold">{task.name}</h4>
                                                            </div>
                                                            {task.status === 'running' ? (
                                                                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                                                                    <Settings size={14} className="text-yellow-500" />
                                                                </motion.div>
                                                            ) : (
                                                                <CheckCircle2 size={14} className="text-green-500" />
                                                            )}
                                                        </div>
                                                        <div className="space-y-1">
                                                            {task.steps.map((step, i) => (
                                                                <div key={i} className="flex items-center gap-2 text-[11px] text-gray-400">
                                                                    <div className={`w-1 h-1 rounded-full ${task.status === 'running' && i === 1 ? 'bg-yellow-500' : 'bg-gray-600'}`}></div>
                                                                    {step}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>
                                        </div>

                                        {/* Section 3: Control & Logs */}
                                        <div className="panel-section bg-black/20">
                                            <div className="flex justify-between items-center mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${isAutoMode ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                                                    <span className="text-xs font-bold uppercase tracking-widest">{isAutoMode ? 'Auto Mode' : 'Manual Mode'}</span>
                                                </div>
                                                <button
                                                    onClick={() => setIsAutoMode(!isAutoMode)}
                                                    className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded border border-white/10 transition-colors"
                                                >
                                                    Toggle
                                                </button>
                                            </div>
                                            <div className="execution-log scrollbar-hide">
                                                {logs.map((log, i) => (
                                                    <div key={i} className="log-entry">
                                                        <span className="log-time">[{log.time}]</span>
                                                        {log.msg}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="todos"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="flex-1 min-h-0 p-6"
                                        style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                                    >
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                                <CheckCircle2 className="text-blue-400" size={20} />
                                                Grounded To-Do List
                                            </h3>
                                            <span className="text-xs bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full font-bold uppercase tracking-widest">
                                                {todos.filter(t => !t.completed).length} Pending
                                            </span>
                                        </div>

                                        <div className="todo-input-container mb-6">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={newTodo}
                                                    onChange={(e) => setNewTodo(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                                                    placeholder="Add a new task... (use #urgent for high priority)"
                                                    className="todo-main-input"
                                                />
                                                <button
                                                    onClick={() => handleAddTodo()}
                                                    className="todo-add-btn"
                                                >
                                                    <Send size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="todo-list-container flex-1 overflow-y-auto">
                                            <AnimatePresence mode="popLayout">
                                                {todos.map(todo => (
                                                    <motion.div
                                                        key={todo.id}
                                                        layout
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.95 }}
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
                                            </AnimatePresence>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default TimeAgentPage;
