import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Zap, Activity, Database, CheckCircle2, AlertTriangle, 
    RefreshCw, ArrowRight, ShieldCheck, Globe, Cpu,
    Layers, Link2, Ghost
} from 'lucide-react';
import io from 'socket.io-client';
import api from '../../services/apiService';

const PLATFORM_ICONS = {
    "WhatsApp": <Globe size={14} className="plat-icon wa" />,
    "Google Sheets": <Database size={14} className="plat-icon sheets" />,
    "CRM": <Layers size={14} className="plat-icon crm" />,
    "Notion": <CheckCircle2 size={14} className="plat-icon notion" />,
    "Slack": <Zap size={14} className="plat-icon slack" />,
    "System": <Cpu size={14} className="plat-icon system" />,
    "User": <ShieldCheck size={14} className="plat-icon user" />
};

const SyncMonitor = () => {
    const [synclogs, setSyncLogs] = useState([]);
    const [stats, setStats] = useState({
        totalSyncs: 0,
        activeMappings: 0,
        conflictsResolved: 0,
        avgLatency: 0
    });
    const [platforms, setPlatforms] = useState([
        { id: 'WA', name: 'WhatsApp', status: 'active', load: 12 },
        { id: 'GT', name: 'Google Sheets', status: 'active', load: 45 },
        { id: 'CRM', name: 'CRM', status: 'idle', load: 0 },
        { id: 'NT', name: 'Notion', status: 'active', load: 8 }
    ]);

    useEffect(() => {
        // Initial Fetch
        const fetchInitialData = async () => {
            try {
                const [activityRes, mappingRes] = await Promise.all([
                    api.get('/integrations/sync/activity'),
                    api.get('/integrations/sync/mappings')
                ]);
                const activityData = activityRes.data;
                const mappingData = mappingRes.data;
                setLoading(true);
                const response = await api.get('/integrations/sync/activity');
                if (response.data.success) {
                    setSyncLogs(response.data.logs);
                    setStats(response.data.stats);
                }
            } catch (error) {
                console.error('Error fetching sync activity:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();

        // Socket Integration with Auth Handshake
        const socketUrl = window.location.origin.includes('localhost') 
            ? 'http://localhost:5000' 
            : window.location.origin.replace('//www.', '//'); 
        
        const token = localStorage.getItem('token');
        const socket = io(socketUrl, {
            withCredentials: true,
            transports: ['websocket', 'polling'],
            auth: { token }
        });
        socket.on('sync_activity', (newLog) => {
            setSyncLogs(prev => [newLog, ...prev.slice(0, 19)]);
            setStats(prev => ({
                ...prev,
                totalSyncs: prev.totalSyncs + 1,
                conflictsResolved: newLog.status === 'resolved' ? prev.conflictsResolved + 1 : prev.conflictsResolved
            }));
        });

        return () => socketInstance.disconnect();
    }, []);

    return (
        <div className="sync-monitor-container">
            {/* --- STATS OVERVIEW --- */}
            <div className="sync-stats-grid">
                <div className="sync-stat-card glass">
                    <span className="stat-label">Total Syncs</span>
                    <span className="stat-value">{stats.totalSyncs}</span>
                </div>
                <div className="sync-stat-card glass">
                    <span className="stat-label">Active Mappings</span>
                    <span className="stat-value">{stats.activeMappings}</span>
                </div>
                <div className="sync-stat-card glass">
                    <span className="stat-label">Avg Latency</span>
                    <span className="stat-value">{stats.avgLatency}ms</span>
                </div>
                <div className="sync-stat-card glass simulation-card" onClick={() => {
                    const mockPlatforms = ["Google Sheets", "CRM", "Notion", "Slack"];
                    const p = mockPlatforms[Math.floor(Math.random() * mockPlatforms.length)];
                    socket?.emit('test_sync', {
                        platform: p,
                        action: 'simulated_sync',
                        status: 'completed',
                        payload: { note: 'Demo Mode Sync' }
                    });
                }}>
                    <span className="stat-label">Simulate Activity</span>
                    <RefreshCw size={18} className="sim-icon" />
                </div>
                <div className="sync-stat-card">
                    <ShieldCheck size={18} className="stat-icon" />
                    <div className="stat-content">
                        <span className="stat-value">{stats.conflictsResolved}</span>
                        <span className="stat-label">Conflicts Resolved</span>
                    </div>
                </div>
                <div className="sync-stat-card">
                    <Zap size={18} className="stat-icon" />
                    <div className="stat-content">
                        <span className="stat-value">{stats.avgLatency}ms</span>
                        <span className="stat-label">Avg. Latency</span>
                    </div>
                </div>
            </div>

            <div className="sync-main-layout">
                {/* --- ACTIVITY LOG --- */}
                <div className="sync-activity-pane">
                    <div className="pane-header">
                        <h3>Real-Time Sync Stream</h3>
                        <div className="live-indicator">
                            <div className="live-dot" /> LIVE
                        </div>
                    </div>
                    <div className="sync-log-stream">
                        <AnimatePresence initial={false}>
                            {synclogs.length === 0 ? (
                                <div className="no-sync-data">
                                    <Ghost size={40} />
                                    <p>No sync activity detected yet.</p>
                                </div>
                            ) : (
                                synclogs.map((log) => (
                                    <motion.div 
                                        key={log._id}
                                        className={`sync-log-entry ${log.status}`}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                    >
                                        <div className="log-icon-wrap">
                                            {log.status === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                                        </div>
                                        <div className="log-details">
                                            <div className="log-main-row">
                                                <span className="log-entity">{log.entity}</span>
                                                <ArrowRight size={10} className="arrow" />
                                                <div className="log-platforms">
                                                    {log.platforms.map(p => (
                                                        <div key={p} className="plat-pill">
                                                            {PLATFORM_ICONS[p] || <Link2 size={10} />}
                                                            {p}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="log-sub-row">
                                                <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                                <span className="log-latency">{log.latencyMs}ms</span>
                                                {log.error && <span className="log-error">{log.error}</span>}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* --- PLATFORM MESH --- */}
                <div className="platform-mesh-pane">
                    <div className="pane-header">
                        <h3>Integration Fabric</h3>
                    </div>
                    <div className="mesh-visualization">
                        <div className="mesh-grid">
                            {platforms.map(p => (
                                <div key={p.id} className={`mesh-node ${p.status}`}>
                                    <div className="node-glow" />
                                    {PLATFORM_ICONS[p.name] || <Globe size={20} />}
                                    <span className="node-name">{p.name}</span>
                                    <div className="node-status-ring" />
                                </div>
                            ))}
                            {/* SVG connections could go here for extra WOW factor */}
                        </div>
                        <div className="mesh-background">
                            {[...Array(20)].map((_, i) => <div key={i} className="mesh-line" />)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SyncMonitor;
