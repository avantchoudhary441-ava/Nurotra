import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    CheckCircle2, CircleDashed, AlertTriangle, Clock, History, Paperclip, 
    Send, Terminal, Loader2, Sparkles, Settings2, HardDrive, 
    Mail, FileSpreadsheet, Activity, Bell, FileText, Database, ShieldAlert,
    Zap, ChevronRight, RotateCcw, Timer, ScrollText, Trash2, 
    ToggleLeft, ToggleRight, Radio, ArrowRight, RefreshCw, Workflow,
    Video, VideoIcon, ExternalLink, Globe
} from 'lucide-react';
import './ActionAgent.css';

// --- MOCK SIMULATION FLOWS ---
const FLOWS = {
    STANDARD: {
        title: "Uploading Report and Sending to Team",
        type: 'active',
        resources: [{ name: "Q4_Final_Report.pdf", source: "Resource Engine" }],
        steps: [
            { id: 1, label: "Generating Report via Docs Agent", status: "pending", icon: 'file', microLogs: ["Generating layout...", "Saving as PDF..."] },
            { id: 2, label: "Uploading to Drive", status: "pending", icon: 'drive', microLogs: ["Authenticating...", "Uploading (2.4MB)...", "Generating link..."] },
            { id: 3, label: "Dispatching via Communication Agent", status: "pending", icon: 'mail', microLogs: ["Drafting email to 'Team'...", "Email sent!"] }
        ]
    },
    INTERVENTION: {
        title: "Fetch Q3 Deck & Compile Stats",
        type: 'active',
        resources: [],
        steps: [
            { id: 1, label: "Searching Financial DB", status: "pending", icon: 'database', microLogs: ["Querying Q3 ledgers..."] },
            { id: 2, label: "Fetching Q3 Deck", status: "pending", icon: 'drive', requiresIntervention: true, interventionMsg: "Cannot find 'Q3_Deck_FINAL.pptx'. Please manually provide the link or file.", microLogs: ["Searching...", "File Not Found. Pausing for human intervention."] },
            { id: 3, label: "Compiling Statistics", status: "pending", icon: 'spreadsheet', microLogs: ["Aggregating metrics...", "Rows added."] }
        ]
    },
    BULK_SCHEDULED: {
        title: "Send Certificates to 50 Students",
        type: 'scheduled',
        scheduledTime: "19:00",
        resources: [{ name: "Student_List_2026.csv", source: "CRM Sync" }, { name: "Certificate_Template.docx", source: "Docs Engine" }],
        steps: [
            { id: 1, label: "Wait for Scheduled Time (7:00 PM)", status: "pending", icon: 'clock', isWait: true, microLogs: ["Monitoring time..."] },
            { id: 2, label: "Generate Personalized Files", status: "pending", icon: 'file', isBulk: true, totalItems: 50, microLogs: [] },
            { id: 3, label: "Distribute via Email", status: "pending", icon: 'mail', isBulk: true, totalItems: 50, microLogs: [] }
        ]
    },
    ZOOM_MEETING: {
        title: "Schedule Zoom Roadmap Review",
        type: 'active',
        resources: [],
        resultData: {
            type: 'meeting',
            provider: 'zoom',
            meetingId: "824 9912 0041",
            joinUrl: "https://zoom.us/j/82499120041",
            passcode: "NURO2026"
        },
        steps: [
            { id: 1, label: "Authenticating with Zoom", status: "pending", icon: 'zoom', microLogs: ["Verifying OAuth token...", "Authenticated as 'Admin'"] },
            { id: 2, label: "Checking Host Availability", status: "pending", icon: 'clock', microLogs: ["Querying calendar...", "Found slot at 4:00 PM."] },
            { id: 3, label: "Generating Meeting Link", status: "pending", icon: 'video', microLogs: ["Requesting Zoom API...", "Meeting Created."] }
        ]
    }
};

const getFlowType = (text) => {
    if (text.toLowerCase().includes("zoom") || text.toLowerCase().includes("meeting")) return FLOWS.ZOOM_MEETING;
    if (text.toLowerCase().includes("stats") || text.toLowerCase().includes("deck")) return FLOWS.INTERVENTION;
    if (text.toLowerCase().includes("student") || text.toLowerCase().includes("bulk") || text.toLowerCase().includes("certificate")) return FLOWS.BULK_SCHEDULED;
    return FLOWS.STANDARD;
};

const IconHOC = ({ type, size = 16 }) => {
    switch(type) {
        case 'drive': return <HardDrive size={size} className="app-icon drive" />;
        case 'mail': return <Mail size={size} className="app-icon mail" />;
        case 'file': return <FileText size={size} className="app-icon doc" />;
        case 'spreadsheet': return <FileSpreadsheet size={size} className="app-icon sheets" />;
        case 'database': return <Database size={size} className="app-icon db" />;
        case 'clock': return <Clock size={size} className="app-icon time" />;
        case 'zoom': return <Video size={size} className="app-icon zoom" />;
        case 'video': return <VideoIcon size={size} className="app-icon meet" />;
        default: return <Activity size={size} className="app-icon default" />;
    }
};


const ActionAgentPage = () => {
    const navigate = useNavigate();
    const [leftWidth, setLeftWidth] = useState(window.innerWidth * 0.68);
    const isResizing = useRef(false);

    // View States
    const [activeTab, setActiveTab] = useState('active');
    const [showHistory, setShowHistory] = useState(false);
    
    // Core Engine State
    const [activeTasks, setActiveTasks] = useState([]);      
    const [scheduledTasks, setScheduledTasks] = useState([]); 
    const [taskHistory, setTaskHistory] = useState([]);
    const [eventRules, setEventRules] = useState([]);
    const [commandInput, setCommandInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [interventionInput, setInterventionInput] = useState('');
    const [integrations, setIntegrations] = useState({ google: false, zoom: false });

    // NLP Preview State
    const [nlpPreview, setNlpPreview] = useState(null);

    // Execution log visibility per task
    const [expandedLogs, setExpandedLogs] = useState({});

    // Fetch integration status on mount
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch('/api/actions/status', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                const data = await res.json();
                if (data.success) setIntegrations(data.status);
            } catch (err) {
                console.error("Failed to fetch integration status");
            }
        };
        fetchStatus();
    }, []);

    const handleAuthRedirect = (tool) => {
        window.location.href = `/api/integrations/${tool === 'meet' || tool === 'sheets' ? 'google' : tool}/auth`;
    };

    // Internal fast frontend simulator for DB OFFLINE mode
    const runMockOfflineSimulation = (mockWf) => {
        let currentStep = 0;
        let microLogIndex = 0;
        const simInterval = setInterval(() => {
            setActiveTasks(prev => {
                const newTasks = [...prev];
                const wfIndex = newTasks.findIndex(t => t._id === mockWf._id);
                if (wfIndex === -1) return prev;
                
                let wf = { ...newTasks[wfIndex] };
                if (currentStep < wf.steps.length) {
                    const currentStepData = wf.steps[currentStep];
                    wf.steps = wf.steps.map((s, idx) => {
                        if (idx < currentStep) return { ...s, status: 'completed' };
                        if (idx === currentStep) return { ...s, status: 'running' };
                        return s;
                    });
                    // Cycle through micro-logs for realism
                    const logs = currentStepData.microLogs || [];
                    wf.activeMicroLog = logs[microLogIndex % logs.length] || `Executing ${currentStepData.label}...`;
                    microLogIndex++;
                    
                    // Move to next step every 2 ticks (so each step takes ~6s visible time)
                    if (microLogIndex % 2 === 0) {
                        currentStep++;
                        microLogIndex = 0;
                    }
                } else if (currentStep === wf.steps.length) {
                    wf.steps = wf.steps.map(s => ({ ...s, status: 'completed' }));
                    wf.status = 'completed';
                    wf.activeMicroLog = "All tasks finished successfully!";
                    clearInterval(simInterval);
                    
                    // Keep completed card visible for 5 seconds before moving to history
                    setTimeout(() => {
                        setActiveTasks(curr => curr.filter(t => t._id !== wf._id));
                        setTaskHistory(curr => [wf, ...curr]);
                    }, 5000);
                }
                newTasks[wfIndex] = wf;
                return newTasks;
            });
        }, 3000);
    };

    // Forces a scheduled task to run early
    const forceRunScheduled = (taskId) => {
        console.log("Force Override for ID", taskId);
    };

    // Submits the intervention data and resumes
    const resolveIntervention = (taskId, stepIndex) => {
        if (!interventionInput.trim()) return;
        setInterventionInput('');
    };

    // --- Data Fetching ---
    const fetchTasks = async () => {
        try {
            const activeRes = await fetch("http://localhost:5000/api/action-agent/active-tasks");
            const activeData = await activeRes.json();
            if (activeData.success && !activeData.dbOffline) {
                const active = activeData.tasks.filter(t => t.type !== 'scheduled');
                const scheduled = activeData.tasks.filter(t => t.type === 'scheduled');
                
                const activeWithElapsed = active.map(t => ({
                    ...t,
                    elapsed: t.startTime ? Math.floor((Date.now() - new Date(t.startTime).getTime()) / 1000) : 0
                }));

                setActiveTasks(activeWithElapsed);
                setScheduledTasks(scheduled);
            }

            const historyRes = await fetch("http://localhost:5000/api/action-agent/history");
            const historyData = await historyRes.json();
            if (historyData.success && !historyData.dbOffline) {
                setTaskHistory(historyData.tasks);
            }
        } catch (error) {
            console.error("Failed to fetch Action Agent tasks:", error);
        }
    };

    const fetchEventRules = async () => {
        try {
            const res = await fetch("http://localhost:5000/api/action-agent/event-rules");
            const data = await res.json();
            if (data.success && !data.dbOffline) {
                setEventRules(data.rules || []);
            }
        } catch (error) {
            console.error("Failed to fetch event rules:", error);
        }
    };

    // Initial Load & Polling
    useEffect(() => {
        fetchTasks();
        fetchEventRules();
        const pollInterval = setInterval(() => {
            fetchTasks();
            if (activeTab === 'automations') fetchEventRules();
        }, 2500);
        return () => clearInterval(pollInterval);
    }, [activeTab]);

    // Timer tick for running tasks
    useEffect(() => {
        const timer = setInterval(() => {
            setActiveTasks(prev => prev.map(t => {
                if (t.status === 'running' || t.status === 'retrying') {
                    return { ...t, elapsed: Math.floor((Date.now() - new Date(t.startTime).getTime()) / 1000) };
                }
                return t;
            }));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // --- Client-side mock workflow generator (works without backend) ---
    const generateClientMockWorkflow = (text) => {
        const lowerText = text.toLowerCase();
        const id = 'mock_' + Date.now();

        // Detect environment control commands (with fuzzy matching for typos)
        const envRoutes = [
            { keys: ['docs', 'dock', 'doc agent', 'docs agent', 'documents', 'open doc', 'open docs', 'open dock'], route: '/docs-agent' },
            { keys: ['communication', 'comm agent', 'messages', 'inbox', 'open comm', 'chat agent'], route: '/communication-agent' },
            { keys: ['time agent', 'calendar', 'time management', 'open time'], route: '/time-agent' },
            { keys: ['dashboard', 'overview', 'open dashboard', 'nuro dashboard'], route: '/nuro-dashboard' },
            { keys: ['lab', 'workspace', 'nuro lab', 'open lab'], route: '/nuro-lab' },
            { keys: ['action agent', 'action', 'automations', 'open action'], route: '/action-agent' },
            { keys: ['orchestrator', 'home', 'main page', 'go home', 'main'], route: '/' },
        ];

        // Check for navigation intent ("open X", "go to X", "navigate to X", "take me to X")
        const navPattern = /\b(open|go to|navigate|take me to|switch to|show|launch|resume)\b/i;
        const isNavIntent = navPattern.test(text);

        for (const er of envRoutes) {
            if (er.keys.some(k => lowerText.includes(k))) {
                // If we have a navigation intent word OR the route keyword is very specific, navigate
                if (isNavIntent || er.keys.some(k => k.includes('agent') && lowerText.includes(k))) {
                    return { intent: 'ENVIRONMENT_CONTROL', navigateTo: er.route };
                }
            }
        }

        // Detect trigger type
        let triggerType = 'manual';
        let triggerSource = 'User command';
        const isEventDriven = /\b(whenever|every time|if .+ then|when .+ happens|auto|automatically)\b/i.test(text);
        if (/\b(message|email|receive|incoming)\b/i.test(lowerText)) { triggerType = 'message_received'; triggerSource = 'Incoming message'; }
        else if (/\b(webhook|api|external)\b/i.test(lowerText)) { triggerType = 'webhook'; triggerSource = 'External webhook'; }
        else if (/\b(schedule|every day|daily|weekly|cron)\b/i.test(lowerText)) { triggerType = 'scheduled'; triggerSource = 'Scheduled timer'; }
        else if (isEventDriven) { triggerType = 'system_state'; triggerSource = 'System state change'; }

        // Extract conditions
        let conditionRawText = '';
        const ifMatch = text.match(/if\s+(.+?)(?:,|\bthen\b|$)/i);
        if (ifMatch) conditionRawText = ifMatch[1].trim();
        const whenMatch = text.match(/when\s+(.+?)(?:,|\bthen\b|$)/i);
        if (!conditionRawText && whenMatch) conditionRawText = whenMatch[1].trim();

        // Generate action steps from the command
        const actionKeywords = [
            { keys: ['send invoice', 'invoice', 'billing'], label: 'Generate Invoice', icon: 'file', logs: ['Loading invoice template...', 'Populating fields...', 'Invoice generated.'] },
            { keys: ['send email', 'email', 'mail', 'notify'], label: 'Send Email Notification', icon: 'mail', logs: ['Drafting email...', 'Connecting to SMTP...', 'Email sent.'] },
            { keys: ['update', 'status', 'database', 'save'], label: 'Update Database Status', icon: 'database', logs: ['Connecting to database...', 'Updating record...', 'Status updated.'] },
            { keys: ['create ticket', 'ticket'], label: 'Create Support Ticket', icon: 'file', logs: ['Building ticket data...', 'Assigning priority...', 'Ticket created.'] },
            { keys: ['compile', 'stats', 'analytics', 'report'], label: 'Compile Analytics Report', icon: 'spreadsheet', logs: ['Fetching data sources...', 'Aggregating metrics...', 'Report compiled.'] },
            { keys: ['fetch', 'download', 'get', 'pull', 'deck'], label: 'Fetch Resource Data', icon: 'drive', logs: ['Searching resources...', 'Downloading files...', 'Data retrieved.'] },
            { keys: ['alert', 'warn', 'flag'], label: 'Send Alert', icon: 'mail', logs: ['Evaluating alert conditions...', 'Sending notification...', 'Alert dispatched.'] },
            { keys: ['approve', 'approval', 'review'], label: 'Process Approval', icon: 'file', logs: ['Checking approval criteria...', 'Routing to approver...', 'Approval processed.'] },
            { keys: ['schedule', 'plan', 'calendar'], label: 'Schedule Task', icon: 'clock', logs: ['Checking availability...', 'Reserving time slot...', 'Task scheduled.'] },
            { keys: ['upload', 'push', 'deploy'], label: 'Upload Data', icon: 'drive', logs: ['Preparing upload package...', 'Transferring files...', 'Upload complete.'] },
        ];

        let steps = [];
        let stepId = 1;
        for (const ak of actionKeywords) {
            if (ak.keys.some(k => lowerText.includes(k))) {
                steps.push({
                    id: stepId++,
                    label: ak.label,
                    icon: ak.icon,
                    status: 'pending',
                    microLogs: ak.logs,
                    delayMs: 0,
                    retryConfig: { maxRetries: ak.icon === 'mail' ? 1 : 0, retryCount: 0, retryDelayMs: 2000 }
                });
            }
        }

        // If no specific actions detected, generate generic ones
        if (steps.length === 0) {
            const words = text.split(/\s+/).filter(w => w.length > 3).slice(0, 2);
            const taskName = words.length > 0 ? words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : 'Task';
            steps = [
                { id: 1, label: `Analyze Request: "${taskName}"`, icon: 'default', status: 'pending', microLogs: ['Parsing command...', 'Understanding intent...'], delayMs: 0, retryConfig: { maxRetries: 0, retryCount: 0, retryDelayMs: 2000 } },
                { id: 2, label: `Process ${taskName}`, icon: 'database', status: 'pending', microLogs: ['Initializing pipeline...', 'Processing data...', 'Pipeline complete.'], delayMs: 0, retryConfig: { maxRetries: 1, retryCount: 0, retryDelayMs: 2000 } },
                { id: 3, label: 'Finalize & Deliver Results', icon: 'file', status: 'pending', microLogs: ['Packaging results...', 'Delivering output...', 'Done.'], delayMs: 0, retryConfig: { maxRetries: 0, retryCount: 0, retryDelayMs: 2000 } },
            ];
        }

        // Build a title
        const titleWords = text.split(/\s+/).slice(0, 6).join(' ');
        const title = titleWords.charAt(0).toUpperCase() + titleWords.slice(1);

        const mockWorkflow = {
            _id: id,
            title: title.length > 50 ? title.slice(0, 50) + '...' : title,
            type: isEventDriven ? 'event_driven' : 'active',
            status: 'running',
            isEventDriven,
            startTime: new Date().toISOString(),
            steps,
            triggerConfig: { type: triggerType, source: triggerSource },
            conditions: conditionRawText ? [{ field: 'message.body', operator: 'contains', value: conditionRawText, raw_text: conditionRawText }] : [],
            conditionLogic: 'AND',
            conditionRawText,
            intentData: {
                trigger: { type: triggerType, source: triggerSource },
                condition: { raw_text: conditionRawText }
            },
            executionLogs: [
                { stepLabel: 'System', message: `Workflow initiated: "${title}"`, timestamp: new Date().toISOString(), level: 'info' }
            ]
        };

        return { intent: 'WORKFLOW_EXECUTION', workflow: mockWorkflow, isEventDriven };
    };

    // --- Core Execution ---
    const sendCommand = async (input) => {
        const text = typeof input === 'string' ? input : commandInput;
        if (!text.trim()) return;

        setCommandInput('');
        setIsLoading(true);
        setNlpPreview(null);

        try {
            const response = await fetch("http://localhost:5000/api/action-agent/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ command: text })
            });

            const data = await response.json();
            if (data.success) {
                handleExecutionResponse(data);
            } else {
                // Backend returned error — fall back to client mock
                runClientMockFallback(text);
            }
        } catch (error) {
            console.warn("Backend unreachable, using client-side mock:", error.message);
            runClientMockFallback(text);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExecutionResponse = (data) => {
        if (data.intent === 'ENVIRONMENT_CONTROL') {
            navigate(data.navigateTo);
        } else if (data.intent === 'WORKFLOW_EXECUTION') {
            if (data.isEventDriven && data.eventRule) {
                setEventRules(prev => [data.eventRule, ...prev]);
                setActiveTab('automations');
                setNlpPreview({
                    type: 'rule_created',
                    rule: data.eventRule,
                    message: data.message
                });
            } else if (data.dbOffline) {
                setActiveTasks(prev => [data.workflow, ...prev]);
                runMockOfflineSimulation(data.workflow);
                setNlpPreview(buildNlpPreview(data.workflow));
                setActiveTab('active');
            } else {
                fetchTasks();
                if (data.workflow) {
                    setNlpPreview(buildNlpPreview(data.workflow));
                }
                setActiveTab('active');
            }
            if (data.isEventDriven) setActiveTab('automations');
        }
    };

    const runClientMockFallback = (text) => {
        const mockResult = generateClientMockWorkflow(text);

        if (mockResult.intent === 'ENVIRONMENT_CONTROL') {
            navigate(mockResult.navigateTo);
            return;
        }

        const wf = mockResult.workflow;

        if (mockResult.isEventDriven) {
            // Create a mock event rule
            const mockRule = {
                _id: 'mock_rule_' + Date.now(),
                name: wf.title,
                enabled: true,
                trigger: wf.triggerConfig,
                conditions: wf.conditions,
                conditionLogic: wf.conditionLogic,
                conditionRawText: wf.conditionRawText,
                actions: wf.steps,
                executionCount: 0,
                lastTriggered: null,
                createdAt: new Date().toISOString()
            };
            setEventRules(prev => [mockRule, ...prev]);
            setActiveTab('automations');
            setNlpPreview({
                type: 'rule_created',
                rule: mockRule,
                message: `Automation rule "${mockRule.name}" created (offline mode). It will fire when the backend connects.`
            });
        } else {
            setActiveTasks(prev => [wf, ...prev]);
            runMockOfflineSimulation(wf);
            setNlpPreview(buildNlpPreview(wf));
            setActiveTab('active');
        }
    };

    // Build NLP preview from workflow data
    const buildNlpPreview = (workflow) => {
        if (!workflow) return null;
        return {
            type: 'workflow',
            title: workflow.title,
            trigger: workflow.triggerConfig || workflow.intentData?.trigger,
            conditionText: workflow.conditionRawText || workflow.intentData?.condition?.raw_text || '',
            conditions: workflow.conditions || workflow.intentData?.conditions || [],
            actions: workflow.steps || [],
            isEventDriven: workflow.isEventDriven || false
        };
    };

    // --- Event Rule Actions ---
    const toggleRule = async (ruleId) => {
        try {
            const res = await fetch(`http://localhost:5000/api/action-agent/event-rules/${ruleId}/toggle`, { method: 'PATCH' });
            const data = await res.json();
            if (data.success) {
                setEventRules(prev => prev.map(r => r._id === ruleId ? data.eventRule : r));
            }
        } catch (e) { console.error(e); }
    };

    const deleteRule = async (ruleId) => {
        try {
            await fetch(`http://localhost:5000/api/action-agent/event-rules/${ruleId}`, { method: 'DELETE' });
            setEventRules(prev => prev.filter(r => r._id !== ruleId));
        } catch (e) { console.error(e); }
    };

    // --- Support UI Triggers ---

    const toggleLogView = (taskId) => {
        setExpandedLogs(prev => ({ ...prev, [taskId]: !prev[taskId] }));
    };

    // --- Resizing ---
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing.current) return;
            const newWidth = e.clientX;
            if (newWidth > 400 && newWidth < window.innerWidth - 300) {
                setLeftWidth(newWidth);
            }
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

    const formatTime = (s) => (s && !isNaN(s)) ? `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}` : '0:00';
    const formatLogTime = (ts) => {
        if (!ts) return '--:--';
        const d = new Date(ts);
        return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
    };

    // Compute visible tasks
    const getVisibleContent = () => {
        if (activeTab === 'scheduled') return scheduledTasks;
        if (activeTab === 'automations') return eventRules;
        return activeTasks;
    };

    const visibleContent = getVisibleContent();
    const topTask = activeTasks[0] || scheduledTasks[0];

    return (
        <div className="action-workspace-container">
            {/* --- LEFT: LIVE EXECUTION --- */}
            <div className="action-left-pane" style={{ width: leftWidth }}>
                
                <div className="stage-tabs-header">
                    <div className="stage-tabs">
                        <button className={`stage-tab ${activeTab === 'active' ? 'active' : ''}`} onClick={() => setActiveTab('active')}>
                            <Activity size={14} /> Active
                            <span className="tab-count">{activeTasks.length}</span>
                        </button>
                        <button className={`stage-tab ${activeTab === 'scheduled' ? 'active' : ''}`} onClick={() => setActiveTab('scheduled')}>
                            <Clock size={14} /> Scheduled
                            <span className="tab-count">{scheduledTasks.length}</span>
                        </button>
                        <button className={`stage-tab ${activeTab === 'automations' ? 'active' : ''}`} onClick={() => { setActiveTab('automations'); fetchEventRules(); }}>
                            <Zap size={14} /> Automations
                            <span className="tab-count">{eventRules.length}</span>
                        </button>
                    </div>
                    
                    <div className="connection-hub-container">
                        <Globe size={14} className={`hub-tool-icon ${integrations.google || integrations.zoom ? 'active' : ''}`} />
                        <div className={`connection-dot ${integrations.google || integrations.zoom ? 'active' : ''}`} />
                        <div className="connection-hub-icons" style={{ display: 'flex', gap: '8px', marginLeft: '4px' }}>
                            <FileSpreadsheet size={14} className={`hub-tool-icon ${integrations.google ? 'active' : ''}`} onClick={() => handleAuthRedirect('sheets')} style={{ cursor: 'pointer' }} />
                            <Mail size={14} className={`hub-tool-icon ${integrations.google ? 'active' : ''}`} onClick={() => handleAuthRedirect('google')} style={{ cursor: 'pointer' }} />
                            <Video size={14} className={`hub-tool-icon ${integrations.zoom ? 'active' : ''}`} onClick={() => handleAuthRedirect('zoom')} style={{ cursor: 'pointer' }} />
                        </div>
                    </div>
                </div>

                <div className="execution-stage">
                    {activeTab === 'automations' ? (
                        /* --- AUTOMATIONS TAB --- */
                        eventRules.length === 0 ? (
                            <div className="empty-automations">
                                <Zap size={48} className="pulse-icon" />
                                <h3>No Automation Rules</h3>
                                <p>Create event-driven rules that fire automatically when conditions are met. Try: "If client approves, send invoice"</p>
                            </div>
                        ) : (
                            <div className="active-execution-scrollable">
                                <div className="automations-list">
                                    <AnimatePresence>
                                        {eventRules.map(rule => (
                                            <motion.div 
                                                key={rule._id}
                                                className={`automation-rule-card ${!rule.enabled ? 'disabled' : ''}`}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, height: 0 }}
                                            >
                                                <div className="rule-header">
                                                    <span className="rule-name">{rule.name}</span>
                                                    <div className="rule-controls">
                                                        <div 
                                                            className={`toggle-switch ${rule.enabled ? 'active' : ''}`}
                                                            onClick={() => toggleRule(rule._id)}
                                                        />
                                                        <button className="rule-delete-btn" onClick={() => deleteRule(rule._id)}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Pipeline Preview */}
                                                <div className="pipeline-flow">
                                                    <div className="pipeline-node trigger-node">
                                                        <Radio size={10} />
                                                        {rule.trigger?.type || 'manual'}
                                                    </div>
                                                    <div className="pipeline-arrow"><ArrowRight size={12} /></div>
                                                    {rule.conditionRawText && (
                                                        <>
                                                            <div className="pipeline-node condition-node">
                                                                <ShieldAlert size={10} />
                                                                {rule.conditionRawText.length > 30 ? rule.conditionRawText.slice(0, 30) + '...' : rule.conditionRawText}
                                                            </div>
                                                            <div className="pipeline-arrow"><ArrowRight size={12} /></div>
                                                        </>
                                                    )}
                                                    <div className="pipeline-node action-node">
                                                        <Zap size={10} />
                                                        {rule.actions?.length || 0} action{(rule.actions?.length || 0) !== 1 ? 's' : ''}
                                                    </div>
                                                </div>

                                                <div className="rule-meta">
                                                    <span className="rule-meta-item">
                                                        <Activity size={11} /> Fired {rule.executionCount || 0}x
                                                    </span>
                                                    {rule.lastTriggered && (
                                                        <span className="rule-meta-item">
                                                            <Clock size={11} /> Last: {new Date(rule.lastTriggered).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                    {rule.trigger?.webhookId && (
                                                        <span className="rule-meta-item">
                                                            <Workflow size={11} /> Webhook
                                                        </span>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )
                    ) : (
                        /* --- ACTIVE / SCHEDULED TABS --- */
                        (activeTab === 'active' ? activeTasks : scheduledTasks).length === 0 ? (
                            <div className="empty-stage-state">
                                <Terminal size={48} className="pulse-icon" />
                                <h2>{activeTab === 'scheduled' ? 'No Scheduled Tasks' : 'System Ready'}</h2>
                                <p>Waiting for your command. Tell me what you need done to start.</p>
                            </div>
                        ) : (
                            <div className="active-execution-scrollable">
                                <AnimatePresence>
                                    {(activeTab === 'active' ? activeTasks : scheduledTasks).map(task => (
                                        <motion.div 
                                            key={task._id || task.id} 
                                            className={`execution-card ${task.status}`}
                                            initial={{ opacity: 0, y: 30 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, height: 0 }}
                                        >
                                            <div className="execution-header">
                                                <div className="exec-title-row">
                                                    <Sparkles size={18} className="sparkle-icon" />
                                                    <h2>{task.title}</h2>
                                                    {task.isEventDriven && (
                                                        <span className="event-driven-indicator">
                                                            <Zap size={10} /> Event-Driven
                                                        </span>
                                                    )}
                                                    <div className={`status-pill ${task.status}`}>
                                                        {task.status === 'running' && <Loader2 size={12} className="spin-icon" />}
                                                        {task.status === 'intervention' && <ShieldAlert size={12} />}
                                                        {task.status === 'completed' && <CheckCircle2 size={12} />}
                                                        {task.status === 'waiting' && <Bell size={12} />}
                                                        {task.status === 'retrying' && <RefreshCw size={12} className="spin-icon" />}
                                                        {task.status === 'delayed' && <Timer size={12} />}
                                                        {task.status === 'failed' && <AlertTriangle size={12} />}
                                                        {task.status === 'recovered' && <Sparkles size={12} />}
                                                        {task.status.toUpperCase()}
                                                    </div>
                                                </div>
                                                <div className="exec-timer">
                                                    <Clock size={14} />
                                                    {task.type === 'scheduled' && task.status === 'waiting' 
                                                        ? <span>Expected: {task.scheduledTime}</span>
                                                        : <span>{formatTime(task.elapsed)}</span>
                                                    }
                                                </div>
                                            </div>

                                            {/* Pipeline Flow Visualization */}
                                            {(task.triggerConfig || task.intentData?.trigger) && (
                                                <div className="pipeline-flow">
                                                    <div className="pipeline-node trigger-node">
                                                        <Radio size={10} />
                                                        {task.triggerConfig?.type || task.intentData?.trigger?.type || 'manual'}
                                                    </div>
                                                    <div className="pipeline-arrow"><ArrowRight size={12} /></div>
                                                    {(task.conditionRawText || task.intentData?.condition?.raw_text) && (
                                                        <>
                                                            <div className="pipeline-node condition-node">
                                                                <ShieldAlert size={10} />
                                                                {(task.conditionRawText || task.intentData?.condition?.raw_text || '').slice(0, 40)}
                                                            </div>
                                                            <div className="pipeline-arrow"><ArrowRight size={12} /></div>
                                                        </>
                                                    )}
                                                    <div className="pipeline-node action-node">
                                                        <Zap size={10} />
                                                        {task.steps?.length || 0} action{(task.steps?.length || 0) !== 1 ? 's' : ''}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Meeting / Tool Specific Results Card */}
                                            <AnimatePresence>
                                                {task.status === 'completed' && task.resultData && (
                                                    <motion.div 
                                                        initial={{ opacity: 0, y: 10 }} 
                                                        animate={{ opacity: 1, y: 0 }} 
                                                        className="execution-result-card"
                                                    >
                                                        {task.resultData.type === 'meeting' && (
                                                            <div className="meeting-result-content">
                                                                <div className="meeting-result-header">
                                                                    <div className={`meeting-brand-icon ${task.resultData.provider}`}>
                                                                        {task.resultData.provider === 'zoom' ? <Video size={20} /> : <VideoIcon size={20} />}
                                                                    </div>
                                                                    <div style={{ flex: 1 }}>
                                                                        <h4>Meeting Scheduled</h4>
                                                                        <p className="meeting-id-text">Join Link Generated</p>
                                                                    </div>
                                                                    <a href={task.resultData.joinUrl} target="_blank" rel="noreferrer" className="join-now-btn">
                                                                        Join Now <ExternalLink size={14} />
                                                                    </a>
                                                                </div>
                                                                {task.resultData.passcode && (
                                                                    <div className="passcode-footer">
                                                                        <span>Meeting ID: <code>{task.resultData.meetingId}</code></span>
                                                                        <span style={{ marginLeft: '1rem' }}>Passcode: <code>{task.resultData.passcode}</code></span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {/* Step Timeline */}
                                            <div className="timeline-container">
                                                {task.steps.map((step, idx) => {
                                                    const isRunning = step.status === 'running';
                                                    const isCompleted = step.status === 'completed';
                                                    const isIntervention = step.status === 'intervention';
                                                    const isRetrying = step.status === 'retrying';
                                                    const isDelayed = step.status === 'delayed';
                                                    
                                                    return (
                                                        <div key={step._id || step.id} className={`timeline-step ${step.status}`}>
                                                            <div className="step-indicator">
                                                                {isCompleted ? <CheckCircle2 size={20} className="check-icon" />
                                                                : isIntervention ? <AlertTriangle size={20} className="alert-icon" />
                                                                : isRetrying ? <RefreshCw size={20} className="spin-icon" style={{color: '#ffc107'}} />
                                                                : isDelayed ? <Timer size={20} style={{color: '#00d2ff'}} />
                                                                : isRunning ? (
                                                                    <div className="live-dot-container">
                                                                        <div className="live-dot" />
                                                                        <div className="live-dot-pulse" />
                                                                    </div>
                                                                ) : <CircleDashed size={20} className="pending-icon" />}
                                                                {idx < task.steps.length - 1 && <div className="step-line" />}
                                                            </div>
                                                            <div className="step-content">
                                                                <div className="step-title-row">
                                                                    <h4>{step.label}</h4>
                                                                    <IconHOC type={step.icon} size={14} />
                                                                </div>


                                                                {/* Step Badges (retry / delay) */}
                                                                {(step.retryConfig?.maxRetries > 0 || step.delayMs > 0) && (
                                                                    <div className="step-badges">
                                                                        {step.retryConfig?.maxRetries > 0 && (
                                                                            <span className="step-badge retry-badge">
                                                                                <RotateCcw size={9} />
                                                                                {step.retryConfig.retryCount || 0}/{step.retryConfig.maxRetries}
                                                                            </span>
                                                                        )}
                                                                        {step.delayMs > 0 && (
                                                                            <span className="step-badge delay-badge">
                                                                                <Timer size={9} />
                                                                                {Math.round(step.delayMs / 1000)}s delay
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                
                                                                <AnimatePresence>
                                                                    {isRunning && !step.isBulk && (
                                                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="micro-log-terminal">
                                                                            <code>&gt; {task.activeMicroLog || step.microLogs?.[0] || '...'}</code>
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>

                                                                {step.isBulk && (isRunning || isCompleted) && (
                                                                    <div className="bulk-progress-container">
                                                                        <div className="progress-bar-bg">
                                                                            <div className="progress-bar-fill" style={{ width: `${(step.bulkProgress / step.totalItems) * 100}%` }}></div>
                                                                        </div>
                                                                        <span className="bulk-count">{Math.min(step.bulkProgress || 0, step.totalItems)} / {step.totalItems} Items Processed</span>
                                                                    </div>
                                                                )}

                                                                <AnimatePresence>
                                                                    {isIntervention && (
                                                                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="intervention-box">
                                                                            <p className="intervention-msg">{step.interventionMsg}</p>
                                                                            <div className="intervention-input-row">
                                                                                <input 
                                                                                    type="text" 
                                                                                    placeholder="Paste URL or ID here..." 
                                                                                    value={interventionInput}
                                                                                    onChange={(e) => setInterventionInput(e.target.value)}
                                                                                />
                                                                                <button onClick={() => resolveIntervention(task.id, idx)}>Resolve</button>
                                                                            </div>
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Execution Log Viewer */}
                                            {task.executionLogs && task.executionLogs.length > 0 && (
                                                <div className="execution-log-section">
                                                    <button 
                                                        className={`log-toggle-btn ${expandedLogs[task._id] ? 'active' : ''}`}
                                                        onClick={() => toggleLogView(task._id)}
                                                    >
                                                        <ScrollText size={12} />
                                                        {expandedLogs[task._id] ? 'Hide Logs' : 'View Logs'} ({task.executionLogs.length})
                                                    </button>
                                                    <AnimatePresence>
                                                        {expandedLogs[task._id] && (
                                                            <motion.div 
                                                                className="log-viewer"
                                                                initial={{ opacity: 0, height: 0 }}
                                                                animate={{ opacity: 1, height: 'auto' }}
                                                                exit={{ opacity: 0, height: 0 }}
                                                            >
                                                                {task.executionLogs.map((log, li) => (
                                                                    <div key={li} className={`log-entry ${log.level}`}>
                                                                        <span className="log-time">{formatLogTime(log.timestamp)}</span>
                                                                        {log.stepLabel && <span className="log-step-label">[{log.stepLabel}]</span>}
                                                                        <span className="log-msg">{log.message}</span>
                                                                    </div>
                                                                ))}
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            )}

                                            {task.type === 'scheduled' && task.status === 'waiting' && (
                                                <button className="force-run-btn" onClick={() => forceRunScheduled(task.id)}>
                                                    Execute Now (Override Time)
                                                </button>
                                            )}
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )
                    )}
                </div>
            </div>

            <div className="pane-resizer" onMouseDown={() => { isResizing.current = true; document.body.style.cursor = 'col-resize'; }} />

            {/* --- RIGHT: COMMAND CENTER --- */}
            <div className="action-right-pane" style={{ width: `calc(100% - ${leftWidth}px)` }}>
                <div className="command-center-wrapper">
                    
                    <div className="cc-toolbar">
                        <button className={`history-toggle ${showHistory ? 'active' : ''}`} onClick={() => setShowHistory(!showHistory)}>
                            <History size={16} />
                            <span>History</span>
                        </button>
                        <button className="settings-icon-btn"><Settings2 size={16} /></button>
                    </div>

                    <div className="cc-dynamic-area">
                        {showHistory ? (
                            <div className="history-view">
                                <h3>Execution History</h3>
                                <div className="history-list">
                                    {taskHistory.length === 0 ? <p className="no-history">No tasks completed yet.</p> : (
                                        taskHistory.map(task => (
                                            <div key={task._id} className="history-card">
                                                <div className="hist-header">
                                                    <span className="hist-title">{task.title}</span>
                                                    {task.status === 'completed' ? 
                                                        <CheckCircle2 size={14} className="hist-icon" /> :
                                                        <AlertTriangle size={14} style={{color:'#ff4757'}} />
                                                    }
                                                </div>
                                                <span className="hist-time">
                                                    {task.status === 'completed' ? 'Completed' : 'Failed'} in {task.endTime && task.startTime ? formatTime(Math.floor((new Date(task.endTime).getTime() - new Date(task.startTime).getTime()) / 1000)) : '0:00'}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="intent-view">
                                {/* NLP Preview Panel */}
                                {nlpPreview && nlpPreview.type === 'workflow' && (
                                    <motion.div className="nlp-preview-panel" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                                        <div className="nlp-preview-header">
                                            <Sparkles size={14} className="sparkle-icon" />
                                            <span className="nlp-preview-badge">Parsed Intent</span>
                                        </div>
                                        <h3 className="nlp-preview-title">{nlpPreview.title}</h3>
                                        <div className="nlp-pipeline-preview">
                                            <div className="nlp-pipeline-row">
                                                <span className="nlp-pipeline-label trigger">Event</span>
                                                <span className="nlp-pipeline-value">{nlpPreview.trigger?.type || 'manual'} {nlpPreview.trigger?.source ? `— ${nlpPreview.trigger.source}` : ''}</span>
                                            </div>
                                            {nlpPreview.conditionText && (
                                                <div className="nlp-pipeline-row">
                                                    <span className="nlp-pipeline-label condition">Condition</span>
                                                    <span className="nlp-pipeline-value">{nlpPreview.conditionText}</span>
                                                </div>
                                            )}
                                            <div className="nlp-pipeline-row">
                                                <span className="nlp-pipeline-label actions">Actions</span>
                                                <div className="nlp-action-chips">
                                                    {nlpPreview.actions.map((action, i) => (
                                                        <React.Fragment key={action.id || i}>
                                                            <span className="nlp-action-chip">
                                                                <IconHOC type={action.icon} size={11} />
                                                                {action.label}
                                                            </span>
                                                            {i < nlpPreview.actions.length - 1 && (
                                                                <span className="nlp-action-chip-arrow">→</span>
                                                            )}
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Rule Created Notification */}
                                {nlpPreview && nlpPreview.type === 'rule_created' && (
                                    <motion.div className="nlp-preview-panel" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                                        <div className="nlp-preview-header">
                                            <Zap size={14} style={{color: '#00d2ff'}} />
                                            <span className="nlp-preview-badge">Automation Created</span>
                                        </div>
                                        <h3 className="nlp-preview-title">{nlpPreview.rule?.name}</h3>
                                        <p style={{color: '#888', fontSize: '0.82rem', margin: 0}}>{nlpPreview.message}</p>
                                    </motion.div>
                                )}

                                {/* Existing intent display or quick actions */}
                                {topTask && !nlpPreview ? (
                                    <motion.div className="intent-display-card" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                                        <div className="intent-badge">Understood Goal</div>
                                        <h3>{topTask.title}</h3>
                                        
                                        {topTask.resources && topTask.resources.length > 0 && (
                                            <div className="resource-grounding-section">
                                                <span>Auto-Fetched Resources:</span>
                                                <ul>
                                                    {topTask.resources.map((res, i) => (
                                                        <li key={i}><Paperclip size={11}/> {res.name} <span className="res-source">via {res.source}</span></li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        <div className="orchestration-pills">
                                            <span className="agent-pill active">Orchestrator Integrated</span>
                                            <span className="agent-pill active">Action Agent</span>
                                            {topTask.isEventDriven && <span className="agent-pill active">Event-Driven</span>}
                                        </div>
                                    </motion.div>
                                ) : !nlpPreview && (
                                    <div className="quick-actions-grid">
                                        <h4>Suggested Automations</h4>
                                        <button className="quick-action-btn" onClick={() => sendCommand("If client approves, send invoice and update status")}>
                                            <Zap size={14} style={{color: '#a29bfe', marginRight: 6, verticalAlign: -2}} />
                                            If client approves, send invoice
                                        </button>
                                        <button className="quick-action-btn" onClick={() => sendCommand("Open docs and continue work")}>
                                            <FileText size={14} style={{color: '#60a5fa', marginRight: 6, verticalAlign: -2}} />
                                            Open docs and continue work
                                        </button>
                                        <button className="quick-action-btn" onClick={() => sendCommand("Whenever I receive an urgent message, create a ticket and notify the team")}>
                                            <Radio size={14} style={{color: '#00d2ff', marginRight: 6, verticalAlign: -2}} />
                                            Auto-create tickets for urgent messages
                                        </button>
                                        <button className="quick-action-btn" onClick={() => sendCommand("Fetch Q3 deck and compile stats")}>
                                            <FileSpreadsheet size={14} style={{color: '#4caf50', marginRight: 6, verticalAlign: -2}} />
                                            Fetch Q3 deck and compile stats
                                        </button>

                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="command-input-container">
                        <div className="input-attachments">
                            <button className="attach-btn"><Paperclip size={18} /></button>
                        </div>
                        <input 
                            type="text" 
                            className="master-input" 
                            placeholder="Tell me what you need done..."
                            value={commandInput}
                            onChange={(e) => setCommandInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendCommand(commandInput)}
                        />
                        <button className="execute-btn" onClick={() => sendCommand(commandInput)} disabled={!commandInput.trim() || isLoading}>
                            {isLoading ? <Loader2 size={16} className="spin-icon" /> : <Send size={16} />}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ActionAgentPage;
