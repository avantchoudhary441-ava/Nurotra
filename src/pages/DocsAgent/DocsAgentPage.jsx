import React, { useState, useRef, useEffect } from 'react';
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
        };

        const handleMouseUp = () => {
            isResizingLeft.current = false;
            isResizingRight.current = false;
            document.body.style.cursor = 'default';
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    // Orchestrator for Real Content & Granular Updates
    const runDetailedExecution = async (intentData) => {
        const desc = intentData.description.toLowerCase();
        const isExcel = desc.includes('excel') || desc.includes('student') || desc.includes('mark');
        const isPPT = desc.includes('powerpoint') || desc.includes('ppt') || desc.includes('presentation') || desc.includes('slide');

        setIsSidebarSyncing(true);
        setIsPaused(false);
        isPausedRef.current = false;
        console.log("Execution started - Pause reset to false");

        // Snapshot current state for rollback
        const initialSnapshot = {
            docId: currentDoc?.id,
            content: currentDoc?.content || '',
            name: currentDoc?.name || 'New Document'
        };

        if (!currentDoc) {
            const initialDoc = {
                id: Date.now(),
                name: "Drafting...",
                type: isPPT ? 'ppt' : (isExcel ? 'excel' : 'word'),
                lastModified: 'Just now',
                content: ''
            };
            setCurrentDoc(initialDoc);
            setStandaloneDocs(prev => [...prev, initialDoc]);
        }

        let steps = [];
        const mainSubject = desc.split(' ').filter(w => w.length > 3)[0] || "Document";

        let metadata = {
            name: `${mainSubject.charAt(0).toUpperCase() + mainSubject.slice(1)} Analysis.${isExcel ? 'xlsx' : (isPPT ? 'pptx' : 'docx')}`,
            summary: `Automated synthesis for ${desc.substring(0, 30)}...`,
            type: isExcel ? 'excel' : (isPPT ? 'ppt' : 'word')
        };

        if (isPPT) {
            steps = ["Analyzing presentation intent...", "Extracting AI Metadata...", "Creating Slide 1...", "Creating Slide 2...", "Creating Slide 3...", "Finalizing layout..."];
        } else if (isExcel) {
            steps = ["Analyzing document intent...", "Extracting AI Metadata...", "Defining grid structure...", "Adding Headers...", "Injecting data rows...", "Finalizing formatting..."];
        } else {
            steps = ["Analyzing document intent...", "Extracting AI Metadata...", "Drafting summary...", "Structuring sections...", "Injecting expert standards...", "Finalizing draft..."];
        }

        setExecutionState(prev => ({
            ...prev,
            status: 'executing',
            currentStep: 1,
            totalSteps: steps.length,
            liveUpdates: []
        }));

        let currentContent = isExcel ? "| Header | Data |\n|---|---|\n" : (isPPT ? "# Slide 1\n" : "# Draft\n");

        // Execution Loop with Pause check
        for (let i = 0; i < steps.length; i++) {
            // Wait for unpause if needed
            if (isPausedRef.current) {
                console.log(`Execution paused at step ${i + 1}: ${steps[i]}`);
                while (isPausedRef.current) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
                console.log(`Execution resumed at step ${i + 1}`);
            }

            await new Promise(resolve => setTimeout(resolve, 800));

            setExecutionState(prev => ({
                ...prev,
                currentStep: i + 1,
                liveUpdates: [...prev.liveUpdates, steps[i]]
            }));

            if (steps[i].includes('Metadata')) {
                setCurrentDoc(prev => ({ ...prev, name: metadata.name, summary: metadata.summary }));
            }

            // Simulate content growth
            if (i > 1) {
                currentContent += `> Added granular logic for step: ${steps[i]}\n`;
                setCurrentDoc(prev => {
                    // Save history before update
                    setHistoryStack(h => [...h, { docId: prev.id, content: prev.content, time: Date.now() }].slice(-10));
                    return { ...prev, content: currentContent };
                });
            }
        }

        setAgentStatus('Ready');
        setExecutionState(prev => ({ ...prev, status: 'idle' }));
        setIsSidebarSyncing(false);
        console.log("Execution complete");
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
            runDetailedExecution(intentData);
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
            <div className="global-status">
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
