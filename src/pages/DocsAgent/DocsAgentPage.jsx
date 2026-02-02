import React, { useState, useRef, useEffect } from 'react';
import { docsAgentService } from '../../services/docsAgentService';
import { generateWordDoc, generateExcelSheet, generatePresentation } from '../../services/generatorService';
import ProjectsDocs from './components/ProjectsDocs';
import LiveExecution from './components/LiveExecution';
import DocsChat from './components/DocsChat';
import './DocsAgent.css';

const DocsAgentPage = () => {
    const [leftWidth, setLeftWidth] = useState(window.innerWidth * 0.25);
    const [rightWidth, setRightWidth] = useState(window.innerWidth * 0.30);
    const [activeMobileScreen, setActiveMobileScreen] = useState('chat');
    const [agentStatus, setAgentStatus] = useState('Ready');

    // Data State
    const [projects, setProjects] = useState([
        {
            id: 1,
            name: 'Marketing Campaign Q1',
            status: 'Active',
            docCount: 4,
            lastModified: '2 hours ago',
            summary: 'Active campaign focusing on Q1 conversion targets and brand awareness.',
            documents: [
                { id: 1, name: 'Campaign Proposal.docx', type: 'word', content: '# Campaign Proposal\n\nThis is the initial draft for the Q1 Marketing Campaign...' },
                { id: 2, name: 'Budget Analysis.xlsx', type: 'excel', content: 'Budget Data' },
                { id: 3, name: 'Presentation Deck.pptx', type: 'ppt', content: 'Slides' },
                { id: 4, name: 'Final Report.pdf', type: 'pdf', content: 'PDF' },
            ]
        }
    ]);
    const [standaloneDocs, setStandaloneDocs] = useState([]);
    const [currentDoc, setCurrentDoc] = useState(null); // Active document in editor

    // Execution State Machine
    const [executionState, setExecutionState] = useState({
        mode: 'guided', // 'guided' (Plan first) or 'fast' (Direct)
        status: 'idle', // idle, planning, executing
        activeObject: null, // project or doc
        currentStep: 0,
        totalSteps: 0,
        liveUpdates: [] // Array of strings for micro-logs
    });

    const [isSidebarSyncing, setIsSidebarSyncing] = useState(false);
    const [chatTrigger, setChatTrigger] = useState(null);
    const [isPaused, setIsPaused] = useState(false);
    const isPausedRef = useRef(false);

    useEffect(() => {
        isPausedRef.current = isPaused;
    }, [isPaused]);

    const [historyStack, setHistoryStack] = useState([]); // Array of { content, messages }
    const [pastConversations, setPastConversations] = useState([
        { id: 1, title: 'Q1 Marketing Strategy', date: 'Yesterday' },
        { id: 2, title: 'Budget Allocation Plan', date: '2 days ago' }
    ]);

    const containerRef = useRef(null);
    const isResizingLeft = useRef(false);
    const isResizingRight = useRef(false);

    const [statusPos, setStatusPos] = useState(null); // {x, y} or null
    const isDraggingStatus = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isResizingLeft.current) {
                const newWidth = e.clientX;
                if (newWidth > 250 && newWidth < window.innerWidth / 2) {
                    setLeftWidth(newWidth);
                }
            }
            if (isResizingRight.current) {
                const newWidth = window.innerWidth - e.clientX;
                if (newWidth > 250 && newWidth < window.innerWidth / 2) {
                    setRightWidth(newWidth);
                }
            }
            if (isDraggingStatus.current) {
                setStatusPos({
                    x: e.clientX - dragOffset.current.x,
                    y: e.clientY - dragOffset.current.y
                });
            }
        };

        const handleMouseUp = () => {
            isResizingLeft.current = false;
            isResizingRight.current = false;
            isDraggingStatus.current = false;
            document.body.style.cursor = 'default';
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const handleStatusMouseDown = (e) => {
        isDraggingStatus.current = true;
        const rect = e.currentTarget.getBoundingClientRect();
        dragOffset.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        document.body.style.cursor = 'grabbing';

        // If starting from default centered position, verify coordinates
        if (!statusPos) {
            setStatusPos({ x: rect.left, y: rect.top });
        }
    };


    // Orchestrator for Real Content & Granular Updates
    // Orchestrator for Real Content - REPLACEMENT FOR FAKE SIMULATION
    const runDetailedExecution = async (intentData) => {
        setIsSidebarSyncing(true);
        setAgentStatus('Generating...');
        console.log("Starting Real Generation for:", intentData.description);

        try {
            // 1. Call AI to get structured data
            const response = await docsAgentService.generateResponse(intentData.description, 'CREATE');

            // 2. Generate File
            if (response && response.generation && response.generation.type) {
                const { type, data } = response.generation;
                console.log(`Generating ${type}...`);

                if (type === 'word') await generateWordDoc(data);
                else if (type === 'excel') await generateExcelSheet(data);
                else if (type === 'ppt') await generatePresentation(data);

                // 3. Update UI
                handleDocCreated({ name: data.fileName, type: type });
                setAgentStatus('Success!');
            } else {
                console.warn("AI returned text but no generation payload:", response);
                setAgentStatus('Text Only');
            }
        } catch (error) {
            console.error("Generation Failed:", error);
            setAgentStatus('Failed');
        } finally {
            setIsSidebarSyncing(false);
            setExecutionState(prev => ({ ...prev, status: 'idle', plan: null }));
            setTimeout(() => setAgentStatus('Ready'), 3000);
        }
    };

    const handleUndo = () => {
        if (historyStack.length === 0) return;
        const lastState = historyStack[historyStack.length - 1];
        setCurrentDoc(prev => ({ ...prev, content: lastState.content }));
        setHistoryStack(prev => prev.slice(0, -1));
    };

    const handleRollback = () => {
        // Simple rollback: clear current doc content if it was started in this session
        setCurrentDoc(prev => ({ ...prev, content: '' }));
        setHistoryStack([]);
        setExecutionState(prev => ({ ...prev, status: 'idle', liveUpdates: [] }));
    };

    const handleSelectHistory = (conv) => {
        // Simulation of restoring a past conversation
        setAgentStatus('Restoring...');
        setTimeout(() => {
            const mockDoc = {
                id: Date.now(),
                name: `${conv.title}.docx`,
                type: 'word',
                content: `# ${conv.title}\n\nThis document was restored from your history dated ${conv.date}.\n\nIt contains the previously executed expert standards and optimized logic.`
            };
            setCurrentDoc(mockDoc);
            setStandaloneDocs(prev => [...prev, mockDoc]);
            setAgentStatus('Ready');
        }, 1000);
    };

    // Intent Management (The Brain)
    const handleAgentIntent = (intentData) => {
        // This is called when the chat parses a significant intent
        if (executionState.mode === 'guided') {
            setExecutionState(prev => ({
                ...prev,
                status: 'planning',
                activeObject: intentData.object || prev.activeObject,
                plan: {
                    goal: `Execute: ${intentData.description}`,
                    steps: [
                        { label: 'Analyze context and data points', status: 'pending' },
                        { label: 'Architect document structure', status: 'pending' },
                        { label: 'Populate granular data (cell/row level)', status: 'pending' },
                        { label: 'Verify Expert Standards sync', status: 'pending' }
                    ],
                    data: intentData
                }
            }));
            setAgentStatus('Planning');
        } else {
            // Direct Execution Flow
            // runDetailedExecution(intentData); // DISABLE FAKE SIMULATION
            console.log("Intepreted Intent:", intentData);
        }
    };

    const approvePlan = () => {
        runDetailedExecution(executionState.plan.data);
    };

    const handleProjectCreated = (project) => {
        const newProject = {
            ...project,
            id: Date.now(),
            status: 'Active',
            docCount: 0,
            lastModified: 'Just now',
            summary: `New project: ${project.name}. Awaiting document execution.`,
            documents: []
        };
        setProjects(prev => [...prev, newProject]);
        setChatTrigger({
            id: Date.now(),
            text: `create the document under the ${project.name} with the details like-`,
            type: 'project'
        });
        setActiveMobileScreen('chat');
    };

    const handleDocCreated = (doc) => {
        const newDoc = {
            id: Date.now(),
            name: (doc && typeof doc === 'object' && doc.name) ? doc.name : 'New Document.docx',
            type: (doc && typeof doc === 'object' && doc.type) ? doc.type : 'word',
            lastModified: 'Just now',
            content: '# New Document\nStart typing here...'
        };
        setStandaloneDocs(prev => [...prev, newDoc]);
        setCurrentDoc(newDoc);
        setChatTrigger({
            id: Date.now(),
            text: `create the document with the details like-`,
            type: 'single'
        });
        setActiveMobileScreen('chat');
    };

    const openDocument = (doc) => {
        setCurrentDoc(doc);
        // Switch to editor view if we were idle
        if (executionState.status === 'idle') {
            setAgentStatus('Viewing');
        }
    };

    const startResizingLeft = () => {
        isResizingLeft.current = true;
        document.body.style.cursor = 'col-resize';
    };

    const startResizingRight = () => {
        isResizingRight.current = true;
        document.body.style.cursor = 'col-resize';
    };

    return (
        <div className="docs-agent-container" ref={containerRef}>
            {/* Global Status Indicator */}
            <div
                className="global-status"
                onMouseDown={handleStatusMouseDown}
                style={{
                    ...(statusPos ? {
                        left: `${statusPos.x}px`,
                        top: `${statusPos.y}px`,
                        transform: 'none',
                        position: 'fixed', /* Use fixed to stay relative to window */
                        cursor: 'grabbing'
                    } : { cursor: 'grab' })
                }}
            >
                <span className="status-dot"></span>
                <span className="status-text">{agentStatus}</span>
            </div>

            {/* Mobile Navigation */}
            <div className="mobile-nav">
                <button
                    onClick={() => setActiveMobileScreen('projects')}
                    className={`mobile-nav-btn ${activeMobileScreen === 'projects' ? 'active' : ''}`}
                >
                    Projects
                </button>
                <button
                    onClick={() => setActiveMobileScreen('execution')}
                    className={`mobile-nav-btn ${activeMobileScreen === 'execution' ? 'active' : ''}`}
                >
                    Work
                </button>
                <button
                    onClick={() => setActiveMobileScreen('chat')}
                    className={`mobile-nav-btn ${activeMobileScreen === 'chat' ? 'active' : ''}`}
                >
                    Chat
                </button>
            </div>

            {/* Left Panel: Projects & Docs */}
            <div
                className={`docs-panel left-panel ${activeMobileScreen === 'projects' ? 'active-mobile' : ''}`}
                style={{ width: window.innerWidth > 768 ? `${leftWidth}px` : '100%' }}
            >
                <ProjectsDocs
                    projects={projects}
                    standaloneDocs={standaloneDocs}
                    onOpenDoc={openDocument}
                    isSyncing={isSidebarSyncing}
                    activeDocId={currentDoc?.id}
                />
            </div>

            <div className="docs-divider" onMouseDown={startResizingLeft} />

            {/* Center Panel: Live Execution */}
            <div
                className={`docs-panel center-panel ${activeMobileScreen === 'execution' ? 'active-mobile' : ''}`}
            >
                <LiveExecution
                    executionState={executionState}
                    currentDoc={currentDoc}
                    liveUpdates={executionState.liveUpdates}
                    onProjectCreated={handleProjectCreated}
                    onDocCreated={handleDocCreated}
                    onApprovePlan={approvePlan}
                    onUpdateContent={(content) => setCurrentDoc(prev => ({ ...prev, content }))}
                    onCancelExecution={() => {
                        setExecutionState(prev => ({ ...prev, status: 'idle', plan: null }));
                        setAgentStatus('Ready');
                    }}
                />
            </div>

            <div className="docs-divider" onMouseDown={startResizingRight} />

            {/* Right Panel: Nurotra Docs Chat */}
            <div
                className={`docs-panel right-panel ${activeMobileScreen === 'chat' ? 'active-mobile' : ''}`}
                style={{ width: window.innerWidth > 768 ? `${rightWidth}px` : '100%' }}
            >
                <DocsChat
                    initialTrigger={chatTrigger}
                    executionMode={executionState.mode}
                    liveUpdates={executionState.liveUpdates}
                    onSetMode={(mode) => setExecutionState(prev => ({ ...prev, mode }))}
                    onAgentIntent={handleAgentIntent}
                    isPaused={isPaused}
                    onTogglePause={() => {
                        setIsPaused(prev => {
                            const next = !prev;
                            isPausedRef.current = next;
                            console.log("Pause toggled to:", next);
                            return next;
                        });
                    }}
                    onUndo={handleUndo}
                    onRollback={handleRollback}
                    pastConversations={pastConversations}
                    onSelectHistory={handleSelectHistory}
                />
            </div>
        </div>
    );
};

export default DocsAgentPage;
