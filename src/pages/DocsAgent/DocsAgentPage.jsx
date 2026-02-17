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
    const [projects, setProjects] = useState([]);
    const [standaloneDocs, setStandaloneDocs] = useState([]);
    const [currentDoc, setCurrentDoc] = useState(null); // Active document in editor

    const fetchInitialData = async () => {
        try {
            const [fetchedProjects, fetchedDocs] = await Promise.all([
                docsAgentService.getProjects(),
                docsAgentService.getDocuments()
            ]);
            setProjects(fetchedProjects);
            setStandaloneDocs(fetchedDocs);
        } catch (error) {
            console.error("Failed to load initial data:", error);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

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


    // Helper to log micro-updates
    const addLiveUpdate = (msg) => {
        setExecutionState(prev => ({
            ...prev,
            liveUpdates: [...prev.liveUpdates, msg]
        }));
    };

    // Helper to convert structured AI data to Preview-able Text
    const convertToMarkdown = (generation) => {
        const { type, data } = generation;
        if (type === 'word') {
            let md = `# ${data.title || 'Untitled Document'}\n\n`;
            data.sections?.forEach(sec => {
                md += `## ${sec.heading}\n${sec.content}\n\n`;
            });
            return md;
        }
        if (type === 'excel') {
            let md = `# ${data.fileName}\n\n`;
            data.sheets?.forEach(sheet => {
                md += `### Sheet: ${sheet.name}\n`;
                sheet.rows?.forEach(row => {
                    md += `| ${row.join(' | ')} |\n`;
                });
                md += '\n';
            });
            return md;
        }
        if (type === 'ppt') {
            let md = `# ${data.fileName}\n\n`;
            data.slides?.forEach((slide, i) => {
                md += `--- Slide ${i + 1} ---\n# ${slide.title}\n`;
                slide.bullets?.forEach(b => md += `* ${b}\n`);
                md += '\n';
            });
            return md;
        }
        return 'Empty Content';
    };

    const runDetailedExecution = async (intentData) => {
        setIsSidebarSyncing(true);
        setAgentStatus('Executing');

        // Ensure status is 'executing' and preserve any initial logs (like Analyst output)
        setExecutionState(prev => ({
            ...prev,
            status: 'executing',
            currentStep: 1,
            totalSteps: 5
        }));

        try {
            // Step 1: Logic Mapping
            addLiveUpdate('Mapping logic to expert standards...');
            await new Promise(r => setTimeout(r, 600));
            setExecutionState(prev => ({ ...prev, currentStep: 2 }));

            // Step 2: Querying the Engine
            addLiveUpdate('Querying cognitive engine for implementation data...');
            let response = intentData.payload;

            // If we don't have a payload or it's not a CREATE intent
            if (!response || response.intent !== 'CREATE') {
                response = await docsAgentService.generateResponse(intentData.description, 'CREATE');

                // Explicitly check for rate limit/fallback messages or system alerts
                if (response.intent === 'QUERY' && (response.text.includes('alert') || response.text.includes('unstable'))) {
                    throw new Error(response.text.split(': ')[1] || response.text);
                }
            }

            // Sync metadata if returned by consolidated query
            if (response.metadata) {
                intentData.metadata = { ...intentData.metadata, ...response.metadata };
            }

            addLiveUpdate('Synthesis progress: Constructing internal knowledge graph...');
            setExecutionState(prev => ({ ...prev, currentStep: 3 }));
            await new Promise(r => setTimeout(r, 500));

            // Step 3: Handle Generation Payload
            if (response && response.generation && response.generation.type) {
                const { type, data } = response.generation;
                addLiveUpdate(`Executing synthesis for ${type.toUpperCase()} object...`);
                setExecutionState(prev => ({ ...prev, currentStep: 4 }));

                // Convert to preview content
                const content = convertToMarkdown(response.generation);

                // Step 4: Physical Document Generation
                addLiveUpdate(`Generating binary stream: ${data.fileName}`);
                if (type === 'word') await generateWordDoc(data);
                else if (type === 'excel') await generateExcelSheet(data);
                else if (type === 'ppt') await generatePresentation(data);

                // Step 5: Final Persistance
                addLiveUpdate('Finalizing storage and syncing context boundary...');
                setExecutionState(prev => ({ ...prev, currentStep: 5 }));

                // FINAL: Persist to Backend
                const metadata = intentData.metadata || {};
                const newDoc = await docsAgentService.createDocument({
                    name: data.fileName,
                    type: type,
                    content: content,
                    projectId: intentData.projectId,
                    metadata: {
                        purpose: metadata.purpose || 'Generated Document',
                        category: metadata.category || 'General',
                        entities: metadata.entities || [],
                        confidenceScore: metadata.confidenceScore || 0.9
                    }
                });

                // Update UI state
                if (intentData.projectId) {
                    await fetchInitialData(); // Refresh to get populated list
                } else {
                    setStandaloneDocs(prev => [newDoc, ...prev]);
                }

                setCurrentDoc(newDoc);
                addLiveUpdate('✅ Implementation successful. Document is ready.');
                setAgentStatus('Success!');
            } else {
                // Return to idle but keep the text response visible in chat
                addLiveUpdate('⚠️ Cognitive engine provided insights but no implementation plan.');
                addLiveUpdate(`Response: "${response.text.substring(0, 40)}..."`);
                setAgentStatus('Ready');
            }
        } catch (error) {
            console.error("Execution Failed:", error);
            addLiveUpdate(`❌ Execution failure: ${error.message}`);
            setAgentStatus('Failed');
        } finally {
            setIsSidebarSyncing(false);
            // If it failed, don't auto-reset the logs immediately so user can read them
            const resetDelay = agentStatus === 'Failed' ? 8000 : 4000;
            setTimeout(() => {
                setExecutionState(prev => ({ ...prev, status: 'idle' }));
                setAgentStatus('Ready');
            }, resetDelay);
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
    const handleAgentIntent = async (intentData) => {
        // 1. Give IMMEDIATE feedback
        setAgentStatus('Analyzing...');
        setExecutionState(prev => ({
            ...prev,
            status: executionState.mode === 'fast' ? 'executing' : 'planning',
            liveUpdates: ['Establishing cognitive connection...', 'Analyzing user intent...']
        }));

        try {
            // 2. Extract metadata locally or via AI if in fast mode
            // (Guided mode will now get metadata concurrently with the generation payload later)
            if (!intentData.metadata && intentData.description) {
                if (executionState.mode === 'fast') {
                    const meta = await docsAgentService.extractMetadata(intentData.description);
                    intentData.metadata = meta;
                    addLiveUpdate(`Analysis complete: Targetting ${meta.category} framework.`);
                } else {
                    addLiveUpdate(`Standby: Initializing structural analysis...`);
                }
            }

            // 3. Delegation logic
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
        } catch (error) {
            console.error("Intent Processing Failed:", error);
            addLiveUpdate(`❌ Initialization error: ${error.message}`);
            setAgentStatus('Ready');
            setTimeout(() => setExecutionState(prev => ({ ...prev, status: 'idle' })), 3000);
        }
    };

    const approvePlan = () => {
        runDetailedExecution(executionState.plan.data);
    };

    const handleProjectCreated = async (project) => {
        setIsSidebarSyncing(true);
        try {
            const newProject = await docsAgentService.createProject(project);
            setProjects(prev => [newProject, ...prev]);
            setChatTrigger({
                id: Date.now(),
                text: `create the document under the ${project.name} with the details like-`,
                type: 'project',
                projectId: newProject.id
            });
            setActiveMobileScreen('chat');
        } catch (error) {
            console.error("Failed to create project:", error);
        } finally {
            setIsSidebarSyncing(false);
        }
    };

    const handleDocCreated = async (doc) => {
        // For fast creation, we might want to extract metadata first
        setIsSidebarSyncing(true);
        try {
            const meta = await docsAgentService.extractMetadata(doc.name || 'document creation');
            const newDoc = await docsAgentService.createDocument({
                name: doc.name || meta.name,
                type: doc.type || 'word',
                content: doc.content || '# New Document\nStart typing here...',
                metadata: meta
            });
            setStandaloneDocs(prev => [newDoc, ...prev]);
            setCurrentDoc(newDoc);
            setChatTrigger({
                id: Date.now(),
                text: `create the document with the details like-`,
                type: 'single'
            });
            setActiveMobileScreen('chat');
        } catch (error) {
            console.error("Failed to create document:", error);
        } finally {
            setIsSidebarSyncing(false);
        }
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
