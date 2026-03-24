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

    // Resize Logic
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing.current) return;
            const newWidth = e.clientX;
            if (newWidth > 300 && newWidth < window.innerWidth - 300) {
                setLeftWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            isResizing.current = false;
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const handleMouseDown = () => {
        isResizing.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    // Simulation for "Autonomous Feel"
    useEffect(() => {
        const simulation = setInterval(() => {
            if (!isAutoMode) return;
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
    }, [isAutoMode]);

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

    return (
        <div className="h-screen flex flex-col bg-[#000] text-white overflow-hidden">
            <BackgroundEffects />
            <Header />

            <div className="time-agent-container flex-1">
                {/* LEFT SIDE: CALENDAR */}
                <div 
                    className="agent-panel calendar-panel"
                    style={{ width: `${leftWidth}px` }}
                >
                    <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/[0.02]">
                        <button 
                            onClick={() => navigate('/agents')}
                            className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors group"
                        >
                            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                            <span>Back to Agents</span>
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Temporal Node Active</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
                        <div className="flex justify-between items-end mb-8">
                            <div>
                                <h1 className="text-2xl font-bold flex items-center gap-3">
                                    <Calendar className="text-purple-400" />
                                    Nurotra Calendar
                                </h1>
                                <p className="text-sm text-gray-500 mt-1">March 2026</p>
                            </div>
                            <div className="text-right">
                                <div className="text-3xl font-mono text-purple-400 tabular-nums">
                                    {currentTime.toLocaleTimeString([], { hour12: false })}
                                </div>
                                <div className="text-[10px] text-gray-600 font-mono uppercase">System Time</div>
                            </div>
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-px bg-white/5 rounded-xl overflow-hidden border border-white/10">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                <div key={day} className="p-3 text-center text-[10px] font-bold text-gray-500 bg-black/40 uppercase tracking-widest">
                                    {day}
                                </div>
                            ))}
                            {Array.from({ length: 35 }).map((_, i) => {
                                const dayNum = i - 3; // Mocking start of month
                                const isActive = dayNum === 24;
                                return (
                                    <motion.div
                                        key={i}
                                        whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
                                        onClick={() => dayNum > 0 && setSelectedDay(dayNum)}
                                        className={`aspect-square p-3 border-t border-l border-white/5 cursor-pointer relative transition-colors bg-black/20
                                            ${selectedDay === dayNum ? 'bg-purple-500/5' : ''}`}
                                    >
                                        <span className={`text-sm ${dayNum > 0 ? (isActive ? 'text-purple-400 font-bold' : 'text-gray-400') : 'opacity-0'}`}>
                                            {dayNum > 0 ? dayNum : ''}
                                        </span>
                                        {isActive && (
                                            <div className="absolute inset-x-2 bottom-3">
                                                <div className="h-1 w-full bg-purple-500/30 rounded-full overflow-hidden">
                                                    <div className="h-full bg-purple-500 animate-pulse" style={{ width: '70%' }} />
                                                </div>
                                            </div>
                                        )}
                                        {dayNum > 0 && (dayNum % 7 === 0 || dayNum % 10 === 0) && (
                                            <div className="absolute top-3 right-3 flex gap-1">
                                                <div className="w-1 h-1 rounded-full bg-blue-500/50" />
                                                {dayNum === 26 && <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />}
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* RESIZER */}
                <div 
                    className="resizer-handle"
                    onMouseDown={handleMouseDown}
                />

                {/* RIGHT SIDE: COMMAND CENTER */}
                <div className="agent-panel command-panel">
                    <div className="flex-1 flex flex-col p-8 overflow-hidden">
                        {/* Command Input Area */}
                        <div className="mb-10">
                            <div className="relative group">
                                <input
                                    type="text"
                                    value={command}
                                    onChange={(e) => setCommand(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCommand()}
                                    placeholder="Give an intent (e.g. Schedule a pitch meeting)"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-6 pl-14 text-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all placeholder:text-gray-600 font-medium"
                                />
                                <Send className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors" size={20} />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                                    <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
                                        <Mic size={18} />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="flex gap-2 mt-4">
                                {['Schedule Task', 'Set Goal', 'Execute Now'].map((btn) => (
                                    <button key={btn} className="text-[10px] font-bold px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg hover:border-purple-500/50 hover:bg-purple-500/10 transition-all flex items-center gap-2 text-gray-400 hover:text-white">
                                        {btn === 'Schedule Task' && <Play size={11} />}
                                        {btn === 'Set Goal' && <Calendar size={11} />}
                                        {btn === 'Execute Now' && <Settings size={11} />}
                                        {btn}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Activity Feeds */}
                        <div className="flex-1 overflow-y-auto pr-2 space-y-10 scrollbar-hide">
                            <section>
                                <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Active Executions</h3>
                                    <span className="text-[10px] font-mono text-purple-500/70">N=3</span>
                                </div>
                                <div className="space-y-4">
                                    {tasks.map(task => (
                                        <motion.div 
                                            key={task.id}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="bg-white/[0.03] border border-white/10 rounded-xl p-5 hover:bg-white/[0.05] transition-all relative group"
                                        >
                                            <div className="absolute top-0 left-0 w-1 h-full bg-purple-500/30 group-hover:bg-purple-500 transition-colors" />
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <span className="text-[9px] font-mono text-purple-400 uppercase tracking-wider block mb-0.5">{task.agent}</span>
                                                    <h4 className="font-bold text-gray-200">{task.name}</h4>
                                                </div>
                                                {task.status === 'running' ? (
                                                    <Settings size={14} className="text-purple-400 animate-spin" />
                                                ) : (
                                                    <CheckCircle2 size={14} className="text-blue-500" />
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                {task.steps.map((step, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 text-[11px] text-gray-500">
                                                        <div className={`w-1 h-1 rounded-full ${idx === 0 && task.status === 'running' ? 'bg-purple-500 animate-pulse' : 'bg-gray-700'}`} />
                                                        {step}
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </section>

                            <section>
                                <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">System Protocol Log</h3>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[9px] font-bold text-gray-600 uppercase">Auto Mode</span>
                                        <button 
                                            onClick={() => setIsAutoMode(!isAutoMode)}
                                            className={`w-7 h-3.5 rounded-full transition-all relative ${isAutoMode ? 'bg-purple-500' : 'bg-gray-800'}`}
                                        >
                                            <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all ${isAutoMode ? 'right-0.5' : 'left-0.5'}`} />
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-black/60 rounded-xl border border-white/5 font-mono text-[10px] p-4 h-48 overflow-y-auto scrollbar-hide">
                                    {logs.map((log, i) => (
                                        <div key={i} className="mb-1.5 flex gap-3 text-gray-400">
                                            <span className="text-purple-500/50">[{log.time}]</span>
                                            <span className={i === 0 ? 'text-gray-200' : ''}>{log.msg}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimeAgentPage;
