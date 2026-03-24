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
    const [tasks, setTasks] = useState([
        { id: 1, name: 'Prepare Q3 Pitch Deck', agent: 'Docs Agent', status: 'running', steps: ['Researching market trends', 'Drafting layout'] },
        { id: 2, name: 'Client Feedback Sync', agent: 'Comm Agent', status: 'pending', steps: ['Scheduling meeting', 'Drafting agenda'] },
        { id: 3, name: 'Budget Review', agent: 'Time Agent', status: 'completed', steps: ['Analyzed sheets', 'Generated report'] }
    ]);

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
        }, 8000);
        return () => clearInterval(simulation);
    }, []);

    const handleCommand = () => {
        if (!command.trim()) return;
        
        const newLog = {
            time: new Date().toLocaleTimeString([], { hour12: false }),
            msg: `User intent: "${command}"`
        };
        setLogs(prev => [newLog, ...prev]);

        // Simulating Agent Response
        setTimeout(() => {
            const agentLog = {
                time: new Date().toLocaleTimeString([], { hour12: false }),
                msg: 'Time Agent: Intent recognized. Decomposing task...'
            };
            setLogs(prev => [agentLog, ...prev]);
            
            const newTask = {
                id: Date.now(),
                name: command,
                agent: 'Time Agent',
                status: 'running',
                steps: ['Analyzing requirements', 'Allocating resources']
            };
            setTasks(prev => [newTask, ...prev]);
            setCommand('');
        }, 1200);
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
                            {calendarDays.map((d, i) => (
                                <motion.div 
                                    key={i} 
                                    whileHover={{ scale: 1.02 }}
                                    onClick={() => d.day > 0 && setSelectedDay(d)}
                                    className={`day-cell ${d.status} ${selectedDay?.day === d.day ? 'ring-2 ring-blue-500' : ''}`}
                                >
                                    <span className="day-number">{d.day > 0 ? d.day : ''}</span>
                                    {d.day === 24 && (
                                        <div className="mt-2 space-y-1">
                                            <div className="h-1.5 w-full bg-blue-500/30 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500 animate-pulse" style={{ width: '70%' }}></div>
                                            </div>
                                            <div className="flex gap-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                            </div>
                                        </div>
                                    )}
                                    {d.day === 26 && (
                                        <div className="absolute top-1 right-1">
                                            <AlertCircle size={12} className="text-red-500 animate-bounce" />
                                        </div>
                                    )}
                                </motion.div>
                            ))}
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
                                    <button className="action-btn"><Mic size={12} /></button>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Task Breakdown */}
                        <div className="breakdown-feed scrollbar-hide">
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
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default TimeAgentPage;
