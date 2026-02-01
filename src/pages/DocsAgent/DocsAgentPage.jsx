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
    const runDetailedExecution = (intentData) => {
        const desc = intentData.description.toLowerCase();
        const isExcel = desc.includes('excel') || desc.includes('student') || desc.includes('mark');
        const isPPT = desc.includes('powerpoint') || desc.includes('ppt') || desc.includes('presentation') || desc.includes('slide');
        const isWord = desc.includes('word') || desc.includes('report') || desc.includes('document');

        setIsSidebarSyncing(true);

        // Ensure we have an active document to work with
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

        // Dynamic Metadata Analysis
        const commonVerbs = ['create', 'make', 'generate', 'build', 'start'];
        const promptWords = desc.split(' ').filter(w => w.length > 3 && !commonVerbs.includes(w));
        const mainSubject = promptWords.length > 0 ? promptWords[0].charAt(0).toUpperCase() + promptWords[0].slice(1) : "Document";

        let metadata = {
            name: `${mainSubject} Analysis.docx`,
            summary: `Automated synthesis regarding ${desc.substring(0, 30)}...`,
            type: 'word'
        };

        if (isPPT) {
            metadata = {
                name: `${mainSubject} Presentation.pptx`,
                summary: `Slide deck orchestration for ${desc.substring(0, 40)}.`,
                type: 'ppt'
            };
            steps = [
                "Analyzing presentation intent...",
                "Extracting AI Metadata (Naming/Summary)...",
                "Establishing slide architecture...",
                "Creating Slide 1: Introduction & Context...",
                "Creating Slide 2: Strategic Objectives...",
                "Creating Slide 3: Key Performance Indicators...",
                "Creating Slide 4: Methodology & Execution...",
                "Creating Slide 5: Conclusion & Recommendations...",
                "Finalizing layout and expert standards...",
                "Presentation ready for export."
            ];
        } else if (isExcel) {
            metadata = {
                name: `${mainSubject} Matrix.xlsx`,
                summary: `Structured data grid for ${desc.substring(0, 40)}.`,
                type: 'excel'
            };
            steps = [
                "Analyzing document intent...",
                "Extracting AI Metadata (Naming/Summary)...",
                "Initializing document environment...",
                "Defining grid structure (Students x Years)...",
                "Adding Header: Student ID",
                "Adding Header: Year 1 Marks",
                "Adding Header: Year 2 Marks",
                "Adding Header: Year 3 Marks",
                "Adding Header: Year 4 Marks",
                "Adding Header: Year 5 Marks",
                "Injecting Student 1 data...",
                "Injecting Student 2 data...",
                "Injecting Student 3 data...",
                "Injecting Student 4 data...",
                "Injecting Student 5 data...",
                "Finalizing spreadsheet formatting...",
                "Cloud sync initiated (Expert Standards)..."
            ];
        } else {
            metadata = {
                name: `${mainSubject} Analytics.docx`,
                summary: `Coordinated knowledge draft for ${desc.substring(0, 40)}.`,
                type: 'word'
            };
            steps = [
                "Analyzing document intent...",
                "Extracting AI Metadata (Naming/Summary)...",
                "Setting up connected history...",
                "Drafting executive summary...",
                "Structuring section: Objectives...",
                "Structuring section: Methodology...",
                "Injecting expert standards...",
                "Finalizing draft...",
                "Document execution complete."
            ];
        }

        setExecutionState(prev => ({
            ...prev,
            status: 'executing',
            currentStep: 1,
            totalSteps: steps.length,
            liveUpdates: []
        }));

        let currentContent = isExcel ? "| Student ID | Year 1 | Year 2 | Year 3 | Year 4 | Year 5 |\n|------------|--------|--------|--------|--------|--------|\n" : (isPPT ? "--- SLIDE ---\n# Presentation Title\nAI Generated Strategic Deck\n\n" : "# Draft Document\n\n");

        steps.forEach((step, index) => {
            setTimeout(() => {
                setExecutionState(prev => ({
                    ...prev,
                    currentStep: index + 1,
                    liveUpdates: [...prev.liveUpdates, step]
                }));

                // Phase 1: Metadata Update
                if (step.includes('Extracting AI Metadata')) {
                    setCurrentDoc(prev => ({
                        ...prev,
                        name: metadata.name,
                        summary: metadata.summary
                    }));
                }

                // Phase 2: Content Injection
                if (isExcel && step.includes('Injecting Student')) {
                    const match = step.match(/\d+/);
                    const studentNum = match ? match[0] : (index - 7);
                    currentContent += `| Student ${studentNum} | ${75 + Math.floor(Math.random() * 20)} | ${75 + Math.floor(Math.random() * 20)} | ${75 + Math.floor(Math.random() * 20)} | ${75 + Math.floor(Math.random() * 20)} | ${75 + Math.floor(Math.random() * 20)} |\n`;
                    setCurrentDoc(prev => ({ ...prev, content: currentContent }));
                } else if (!isExcel && !isPPT && step.includes('Structuring section')) {
                    const sectionName = step.split(': ')[1] || "Section";
                    currentContent += `## ${sectionName}\nGenerating detailed methodology based on your input aligned with Expert Standards...\n\n`;
                    setCurrentDoc(prev => ({ ...prev, content: currentContent }));
                } else if (isPPT && step.includes('Creating Slide')) {
                    const slideName = step.split(': ')[1] || "Slide";
                    currentContent += `--- SLIDE ---\n# ${slideName}\nStructured presentation content for ${slideName} aligned with Expert Standards.\n\n`;
                    setCurrentDoc(prev => ({ ...prev, content: currentContent }));
                }
            }, (index + 1) * 800);
        });

        setTimeout(() => {
            setAgentStatus('Ready');
            setExecutionState(prev => ({ ...prev, status: 'idle' }));
            setIsSidebarSyncing(false);

            // Finalize the document in the lists
            setCurrentDoc(prev => {
                const updatedDoc = { ...prev, ...metadata };

                // Sync with Projects
                setProjects(projectsPrev => projectsPrev.map(p => ({
                    ...p,
                    documents: p.documents.map(d => d.id === updatedDoc.id ? updatedDoc : d)
                })));

                // Sync with Standalone
                setStandaloneDocs(standalonePrev => standalonePrev.map(d => d.id === updatedDoc.id ? updatedDoc : d));

                return updatedDoc;
            });
        }, (steps.length + 1) * 800);
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
                />
            </div>
        </div>
    );
};

export default DocsAgentPage;
