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

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing.current) return;
            const newWidth = Math.max(300, Math.min(window.innerWidth - 300, e.clientX));
            setLeftWidth(newWidth);
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
        <div className="h-screen flex flex-col bg-[#050510] text-white overflow-hidden">
            <BackgroundEffects />
            <Header />
            
            <main className="flex-1 min-h-0 bg-[#050510] relative">
                <div className="time-agent-container absolute inset-0 flex overflow-hidden">
                    {/* LEFT PANEL: CALENDAR (The Execution Field) */}
                    <div 
                        className="agent-panel calendar-panel" 
                        style={{ width: `${leftWidth}px`, flexShrink: 0 }}
                    >
                        <div className="calendar-header flex justify-between items-start mb-6">
                            <div>
                                <button 
                                    onClick={() => navigate('/')}
                                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors group text-[10px] uppercase tracking-widest font-bold mb-2"
                                >
                                    <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
                                    Back to Hub
                                </button>
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <Calendar className="text-blue-400" size={20} />
                                    Nurotra Calendar
                                </h2>
                                <p className="text-xs text-gray-500">March 2026</p>
                            </div>
                            <div className="real-time-clock text-blue-400/80 font-mono text-lg">
                                {currentTime.toLocaleTimeString([], { hour12: false })}
                            </div>
                        </div>

                        <div className="calendar-grid grid grid-cols-7 gap-3 flex-1 overflow-hidden">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                <div key={day} className="text-center text-[10px] font-bold text-blue-400/50 uppercase tracking-widest mb-1">
                                    {day}
                                </div>
                            ))}
                            {calendarDays.map((d, i) => (
                                <motion.div
                                    key={i}
                                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(59, 130, 246, 0.15)' }}
                                    onClick={() => d.day > 0 && setSelectedDay(d.day)}
                                    className={`calendar-day relative aspect-[1/0.8] p-2 rounded-lg border transition-all cursor-pointer ${
                                        selectedDay === d.day ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'border-white/10 bg-white/5'
                                    } ${d.day === 24 ? 'border-blue-400/50 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : ''}`}
                                >
                                    <span className="text-[10px] font-bold text-gray-400">{d.day > 0 ? d.day : ''}</span>
                                    {d.day === 24 && (
                                        <div className="absolute bottom-2 left-2 right-2 space-y-1">
                                            <div className="h-1 w-full bg-blue-500/20 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-400 animate-pulse" style={{ width: '65%' }}></div>
                                            </div>
                                            <div className="flex gap-1">
                                                <div className="w-1 h-1 rounded-full bg-blue-400 shadow-[0_0_5px_rgba(59,130,246,0.5)]"></div>
                                                <div className="w-1 h-1 rounded-full bg-blue-400/50"></div>
                                            </div>
                                        </div>
                                    )}
                                    {d.day === 26 && (
                                        <div className="absolute top-2 right-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping"></div>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* DRAGGABLE RESIZER */}
                    <div 
                        className="resizer-handle w-1 h-full cursor-col-resize hover:bg-purple-500/50 transition-colors z-10"
                        onMouseDown={() => { isResizing.current = true; document.body.style.cursor = 'col-resize'; }}
                    >
                        <div className="w-[1px] h-full bg-white/10 mx-auto" />
                    </div>

                    {/* RIGHT PANEL: COMMAND CENTER (The Brain) */}
                    <div className="agent-panel command-panel flex-1 flex flex-col bg-[#08081a]">
                        <div className="parsing-header p-6 border-b border-white/5">
                            <div className="relative group">
                                <input 
                                    type="text" 
                                    placeholder="Give an intent (e.g. Schedule a pitch meeting)"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-all pr-12"
                                    value={command}
                                    onChange={(e) => setCommand(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleCommand()}
                                />
                                <Send className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 group-hover:text-blue-400 cursor-pointer transition-colors" size={18} />
                            </div>
                            <div className="flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide">
                                <button className="flex-none flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"><Play size={12} /> Schedule Task</button>
                                <button className="flex-none flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"><Calendar size={12} /> Set Goal</button>
                                <button className="flex-none flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"><Cpu size={12} /> Execute Now</button>
                                <button className="flex-none bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg transition-all"><Mic size={12} /></button>
                            </div>
                        </div>

                        {/* SCROLLABLE FEED AREA */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-white/10">
                            <div>
                                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Active Executions</h3>
                                <div className="space-y-3">
                                    <AnimatePresence mode="popLayout">
                                        {tasks.map(task => (
                                            <motion.div 
                                                key={task.id}
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                className={`p-4 rounded-xl border bg-white/2 transition-all ${
                                                    task.status === 'running' ? 'border-blue-500/30 bg-blue-500/5 shadow-[0_0_20px_rgba(59,130,246,0.1)]' : 'border-white/5'
                                                }`}
                                            >
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <span className="text-[10px] font-bold text-blue-400/80 uppercase tracking-tighter">{task.agent}</span>
                                                        <h4 className="font-bold text-sm">{task.name}</h4>
                                                    </div>
                                                    <div className="p-1.5 rounded-lg bg-black/40">
                                                        {task.status === 'running' ? <CheckCircle2 className="text-blue-400 animate-pulse" size={16} /> : <CheckCircle2 className="text-gray-600" size={16} />}
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    {task.steps.map((step, idx) => (
                                                        <div key={idx} className="flex items-center gap-3 text-xs text-gray-400">
                                                            <Settings size={12} className={task.status === 'running' && idx === 0 ? "animate-spin-slow text-blue-400" : ""} />
                                                            {step}
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-white/5">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Autonomous Sync</h3>
                                    <button 
                                        onClick={() => setIsAutoMode(!isAutoMode)}
                                        className={`text-[9px] px-2 py-0.5 rounded border transition-all font-bold ${
                                            isAutoMode ? 'bg-blue-900/40 text-blue-400 border-blue-400/50' : 'bg-gray-800/40 text-gray-500 border-gray-700'
                                        }`}
                                    >
                                        {isAutoMode ? 'ACTIVE' : 'STANDBY'}
                                    </button>
                                </div>
                                <div className="font-mono text-[11px] space-y-1.5 opacity-60">
                                    {logs.map((log, i) => (
                                        <div key={i} className="flex gap-3">
                                            <span className="text-blue-400/50">[{log.time}]</span>
                                            <span className="text-gray-300">{log.msg}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default TimeAgentPage;
