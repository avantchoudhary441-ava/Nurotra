import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Paperclip,
    Mic,
    ArrowRight,
    History,
    Pause,
    Play,
    X,
    RotateCcw,
    Undo,
    Search,
    FileText,
    FolderOpen,
    Edit3,
    Clock
} from 'lucide-react';
import { docsAgentService } from '../../../services/docsAgentService';
import { generateWordDoc, generateExcelSheet, generatePresentation } from '../../../services/generatorService';
import ThinkingIndicator from './ThinkingIndicator';

const DocsChat = ({
    initialTrigger,
    executionMode,
    liveUpdates,
    onSetMode,
    onAgentIntent,
    isPaused,
    onTogglePause,
    onUndo,
    onRollback,
    pastConversations,
    onSelectHistory,
    currentDoc,
    currentProject,
    allDocs,
    onOpenDoc,
    onOpenProject,
    onExitEditMode,   // ← clears the active doc (exit edit mode)
    revalReminders,   // ← array of overdue doc names
    onDismissRevalReminder // ← callback to dismiss reminders
}) => {
    const [prompt, setPrompt] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [isAutoTyping, setIsAutoTyping] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [showPastConversations, setShowPastConversations] = useState(false);
    const [structuredVoiceResult, setStructuredVoiceResult] = useState(null);
    const [isStructuring, setIsStructuring] = useState(false);
    const recognitionRef = useRef(null);
    const silenceTimerRef = useRef(null);
    const transcriptAccumulatorRef = useRef('');
    const [strategyMessages, setStrategyMessages] = useState([
        {
            id: 1,
            type: 'info',
            text: 'Ready to assist. Upload files or describe what you need.'
        }
    ]);

    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const messagesEndRef = useRef(null);
    const searchTimerRef = useRef(null);

    // Keyword search suggestions state
    const [searchSuggestions, setSearchSuggestions] = useState({ documents: [], projects: [] });
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Debounced search — client-side matching against allDocs + server fallback
    const performSearch = useCallback((query) => {
        if (!query || query.trim().length < 2) {
            setSearchSuggestions({ documents: [], projects: [] });
            setShowSuggestions(false);
            return;
        }

        const q = query.trim().toLowerCase();

        // Client-side matching first (instant)
        if (allDocs && allDocs.length > 0) {
            const matchedDocs = allDocs.filter(doc => {
                const nameMatch = doc.name?.toLowerCase().includes(q);
                const descMatch = doc.description?.toLowerCase().includes(q);
                const kwMatch = Array.isArray(doc.keywords) && doc.keywords.some(kw => kw.toLowerCase().includes(q));
                return nameMatch || descMatch || kwMatch;
            }).slice(0, 8);

            if (matchedDocs.length > 0) {
                setSearchSuggestions({ documents: matchedDocs, projects: [] });
                setShowSuggestions(true);
                return;
            }
        }

        // Server-side fallback for deeper search (projects + docs)
        // Cap query to 100 chars to prevent 500 when full doc content is in the prompt
        const serverQuery = query.trim().substring(0, 100);
        docsAgentService.searchDocuments(serverQuery).then(results => {
            if (results.documents.length > 0 || results.projects.length > 0) {
                setSearchSuggestions(results);
                setShowSuggestions(true);
            } else {
                setShowSuggestions(false);
            }
        });
    }, [allDocs]);

    // Watch prompt changes for search
    useEffect(() => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            performSearch(prompt);
        }, 300);
        return () => {
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        };
    }, [prompt, performSearch]);

    const lastTriggerIdRef = useRef(null);

    useEffect(() => {
        // Only fire when a genuinely new trigger arrives (guard by id)
        if (!initialTrigger || initialTrigger.id === lastTriggerIdRef.current) return;
        lastTriggerIdRef.current = initialTrigger.id;

        const text = initialTrigger.text || '';

        // For empty-text triggers (standalone doc flow), just clear the prompt — no typing effect
        if (!text.trim()) {
            setPrompt('');
            setIsAutoTyping(false);
            return;
        }

        setPrompt('');
        setIsAutoTyping(true);
        let i = 0;
        const typingTimer = setInterval(() => {
            if (i < text.length) {
                setPrompt(text.substring(0, i + 1));
                i++;
            } else {
                clearInterval(typingTimer);
                setIsAutoTyping(false);
            }
        }, 30);
        return () => clearInterval(typingTimer);
    }, [initialTrigger]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [strategyMessages, isThinking, liveUpdates]);

    // Antigravity-style Auto-expand Logic
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const newHeight = Math.min(textareaRef.current.scrollHeight, 200);
            textareaRef.current.style.height = `${newHeight}px`;
        }
    }, [prompt]);

    const handleFileUpload = (e) => {
        const files = Array.from(e.target.files);
        setUploadedFiles(prev => [...prev, ...files.map(f => ({ id: Date.now(), name: f.name }))]);
    };

    const handleExecute = async () => {
        if (isListening) {
            stopVoiceCapture();
            return;
        }
        if (!prompt.trim()) return;
        if (isThinking) return; // Prevent double-submission while AI is processing

        const userPrompt = prompt.trim();
        setPrompt('');
        setShowSuggestions(false);

        const userMsg = {
            id: Date.now(),
            type: 'user',
            text: userPrompt,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setStrategyMessages(prev => [...prev, userMsg]);

        setIsThinking(true);

        try {
            const intent = docsAgentService.parseIntent(userPrompt);
            // Pass history context from strategyMessages
            const historyContext = strategyMessages
                .filter(m => m.type === 'user' || m.type === 'agent_answer')
                .slice(-5)
                .map(m => ({ role: m.type === 'user' ? 'user' : 'assistant', content: m.text }));

            const response = await docsAgentService.generateResponse(userPrompt, intent, {
                history: historyContext,
                currentDoc: currentDoc
            });

            setIsThinking(false);

            const agentMsg = {
                id: Date.now() + 1,
                type: response.intent === 'CREATE' ? 'narration' : 'agent_answer',
                text: response?.text || response?.message || "Processing your request...",
                clarification: response.clarification,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setStrategyMessages(prev => [...prev, agentMsg]);

            // DELEGATE EXECUTION to parent page with the FULL response payload
            if (onAgentIntent) {
                onAgentIntent({
                    description: userPrompt,
                    type: 'TASK_EXECUTION',
                    payload: response
                });
            }
        } catch (error) {
            console.error("Docs Agent Error:", error);
            setIsThinking(false);
            setStrategyMessages(prev => [...prev, {
                id: Date.now() + 1,
                type: 'error',
                text: `❌ An error occurred: ${error.message || 'Unable to process your request. Please try again.'}`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleExecute();
        }
    };

    const toggleVoice = () => {
        if (isListening) {
            stopVoiceCapture();
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setStrategyMessages(prev => [...prev, {
                id: Date.now(),
                type: 'error',
                text: '❌ Speech recognition is not supported in this browser.',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        transcriptAccumulatorRef.current = '';

        recognition.onstart = () => {
            setIsListening(true);
            setPrompt('');
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (finalTranscript) {
                transcriptAccumulatorRef.current += finalTranscript + ' ';
            }

            setPrompt(transcriptAccumulatorRef.current + interimTranscript);

            // Silence Detection: If user stops for 2 seconds, auto-stop and process
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
                stopVoiceCapture();
            }, 10000);
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error !== 'no-speech') {
                setIsListening(false);
                setPrompt('');
            }
        };

        recognition.onend = () => {
            // Note: Don't set isListening false here if we want to handle internal stops vs manual
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    const stopVoiceCapture = () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        setIsListening(false);

        const finalOutput = transcriptAccumulatorRef.current.trim();
        if (finalOutput) {
            handleVoiceProcess(finalOutput);
        }
    };

    const handleVoiceProcess = async (transcript) => {
        setIsStructuring(true);
        setStrategyMessages(prev => [...prev, {
            id: Date.now(),
            type: 'system',
            text: 'Designing structured prompt from voice...',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);

        try {
            const result = await docsAgentService.structureVoicePrompt(transcript);
            setIsStructuring(false);
            setStructuredVoiceResult(result);

            if (result.clarificationNeeded) {
                setStrategyMessages(prev => [...prev, {
                    id: Date.now(),
                    type: 'agent_answer',
                    text: result.clarificationNeeded,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }]);
                return;
            }

            if (result.isHighRisk) {
                setStrategyMessages(prev => [...prev, {
                    id: Date.now(),
                    type: 'system',
                    text: `⚠️ High-risk action detected: ${result.structuredPrompt}. Please confirm execution.`,
                    confirmation: true,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }]);
            } else {
                // Auto-execute for low risk
                executeStructuredPrompt(result);
            }
        } catch (error) {
            setIsStructuring(false);
            setStrategyMessages(prev => [...prev, {
                id: Date.now(),
                type: 'error',
                text: `❌ Failed to structure voice: ${error.message}`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        }
    };

    const executeStructuredPrompt = async (result) => {
        const finalPrompt = result.structuredPrompt;
        setPrompt(finalPrompt);
        setStructuredVoiceResult(null);

        // Use existing handleExecute logic but with the structured prompt
        const userMsg = {
            id: Date.now(),
            type: 'user',
            text: finalPrompt,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setStrategyMessages(prev => [...prev, userMsg]);
        setIsThinking(true);

        try {
            const intent = docsAgentService.parseIntent(finalPrompt);
            const historyContext = strategyMessages
                .filter(m => m.type === 'user' || m.type === 'agent_answer')
                .slice(-5)
                .map(m => ({ role: m.type === 'user' ? 'user' : 'assistant', content: m.text }));

            const response = await docsAgentService.generateResponse(finalPrompt, intent, {
                history: historyContext,
                currentDoc: currentDoc
            });
            setIsThinking(false);

            const agentMsg = {
                id: Date.now() + 1,
                type: response.intent === 'CREATE' ? 'narration' : 'agent_answer',
                text: response?.text || response?.message || "Applying structural changes...",
                clarification: response.clarification,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setStrategyMessages(prev => [...prev, agentMsg]);

            if (onAgentIntent) {
                onAgentIntent({
                    description: finalPrompt,
                    type: 'TASK_EXECUTION',
                    payload: response
                });
            }
            setPrompt('');
        } catch (error) {
            setIsThinking(false);
            setStrategyMessages(prev => [...prev, {
                id: Date.now() + 1,
                type: 'error',
                text: `❌ Error: ${error.message}`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        }
    };

    return (
        <div className="docs-chat-panel">
            <div className="panel-header">
                <div className="chat-header-info">
                    <h2>Nurotra docs chat</h2>
                    <div className="mode-toggle">
                        <button
                            className={`mode-btn ${executionMode === 'guided' ? 'active' : ''}`}
                            onClick={() => onSetMode('guided')}
                        >
                            Guided
                        </button>
                        <button
                            className={`mode-btn ${executionMode === 'fast' ? 'active' : ''}`}
                            onClick={() => onSetMode('fast')}
                        >
                            Direct
                        </button>
                    </div>
                </div>
                <div className="header-controls">
                    <button className={`pause-btn ${showPastConversations ? 'active' : ''}`} onClick={() => setShowPastConversations(!showPastConversations)}>
                        <History size={16} />
                    </button>
                    <button className={`pause-btn ${isPaused ? 'paused' : ''}`} onClick={onTogglePause}>
                        {isPaused ? <Play size={16} /> : <Pause size={16} />}
                    </button>
                </div>
            </div>

            {showPastConversations && (
                <div className="history-overlay">
                    <div className="history-header">
                        <h3>Past Conversations</h3>
                        <button onClick={() => setShowPastConversations(false)}><X size={16} /></button>
                    </div>
                    <div className="history-list">
                        {pastConversations?.map(conv => (
                            <div key={conv.id} className="history-item" onClick={() => {
                                onSelectHistory(conv);
                                setShowPastConversations(false);
                            }}>
                                <History size={14} />
                                <div className="history-item-info">
                                    <span className="history-title">{conv.title}</span>
                                    <span className="history-date">{conv.date}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="strategy-feed">
                {/* Revaluation Reminders */}
                {revalReminders && revalReminders.length > 0 && (
                    <div className="reval-reminder-msg">
                        <Clock size={14} />
                        <span>
                            <strong>{revalReminders.length} document{revalReminders.length > 1 ? 's' : ''}</strong> due for revaluation: {revalReminders.slice(0, 3).join(', ')}{revalReminders.length > 3 ? ` +${revalReminders.length - 3} more` : ''}. Would you like to update {revalReminders.length > 1 ? 'them' : 'it'}?
                        </span>
                        <button
                            onClick={onDismissRevalReminder}
                            style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', marginLeft: 'auto', padding: '2px' }}
                        >
                            <X size={12} />
                        </button>
                    </div>
                )}
                {strategyMessages.map((msg) => (
                    <div key={msg.id} className={`strategy-message ${msg.type}`}>
                        {msg.type === 'system' ? (
                            <span>{msg.text} • {msg.time}</span>
                        ) : (
                            <div className="message-content">
                                <p>{msg.text}</p>
                                {msg.clarification && (
                                    <div className="clarification-options">
                                        {msg.clarification.options.map((opt, i) => (
                                            <button
                                                key={i}
                                                className="clarify-btn"
                                                onClick={() => onAgentIntent({ description: opt.label, type: 'TASK_EXECUTION' })}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {msg.confirmation && structuredVoiceResult && (
                                    <div className="clarification-options" style={{ marginTop: '10px' }}>
                                        <button
                                            className="confirm-voice-btn"
                                            onClick={() => executeStructuredPrompt(structuredVoiceResult)}
                                            style={{
                                                padding: '6px 12px',
                                                borderRadius: '6px',
                                                fontSize: '12px',
                                                background: 'rgba(74, 222, 128, 0.1)',
                                                border: '1px solid #4ade80',
                                                color: '#4ade80',
                                                marginRight: '8px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Proceed
                                        </button>
                                        <button
                                            className="cancel-voice-btn"
                                            onClick={() => {
                                                setStructuredVoiceResult(null);
                                                setStrategyMessages(prev => [...prev, {
                                                    id: Date.now(),
                                                    type: 'system',
                                                    text: 'Action cancelled.',
                                                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                }]);
                                            }}
                                            style={{
                                                padding: '6px 12px',
                                                borderRadius: '6px',
                                                fontSize: '12px',
                                                background: 'rgba(248, 113, 113, 0.1)',
                                                border: '1px solid #f87171',
                                                color: '#f87171',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
                {isThinking && <ThinkingIndicator />}

                {liveUpdates && liveUpdates.length > 0 && (
                    <div className="micro-logs-container">
                        {liveUpdates.map((log, i) => (
                            <div key={i} className="micro-log-item animate-log">
                                <span className="log-bullet">🔹</span>
                                <span className="log-text">{log}</span>
                            </div>
                        ))}
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="chat-controls">
                <button className="control-btn" onClick={onUndo}><Undo size={14} /> <span>Undo</span></button>
                <button className="control-btn" onClick={onRollback}><RotateCcw size={14} /> <span>Rollback</span></button>
            </div>

            <div className="input-section">
                {/* ── Edit Mode Banner ─────────────────────────────────────── */}
                {currentDoc && (
                    <div className="edit-mode-banner">
                        <div className="edit-mode-info">
                            <Edit3 size={13} className="edit-mode-icon" />
                            <span className="edit-mode-label">Editing:</span>
                            <span className="edit-mode-filename" title={currentDoc.name}>
                                {currentDoc.name?.length > 30
                                    ? currentDoc.name.substring(0, 30) + '...'
                                    : currentDoc.name}
                            </span>
                        </div>
                        <button
                            className="edit-mode-exit"
                            onClick={onExitEditMode}
                            title="Exit edit mode (create a new document instead)"
                        >
                            <X size={12} />
                        </button>
                    </div>
                )}
                {/* Keyword Search Suggestions */}
                {showSuggestions && (searchSuggestions.documents.length > 0 || searchSuggestions.projects.length > 0) && (
                    <div className="doc-search-suggestions">
                        <div className="suggestions-header">
                            <Search size={12} />
                            <span>Matching docs & projects</span>
                            <button className="suggestions-close" onClick={() => setShowSuggestions(false)}>
                                <X size={12} />
                            </button>
                        </div>
                        <div className="suggestions-list">
                            {searchSuggestions.documents.map((doc) => (
                                <button
                                    key={`doc-${doc.id || doc._id}`}
                                    className="suggestion-chip doc-chip"
                                    onClick={() => {
                                        if (onOpenDoc) onOpenDoc(doc);
                                        setShowSuggestions(false);
                                        setPrompt('');
                                    }}
                                    title={doc.description || doc.name}
                                >
                                    <FileText size={12} />
                                    <span className="chip-name">{doc.name}</span>
                                    {doc.keywords && doc.keywords.length > 0 && (
                                        <span className="chip-keywords">{doc.keywords.slice(0, 2).join(', ')}</span>
                                    )}
                                </button>
                            ))}
                            {searchSuggestions.projects.map((project) => (
                                <button
                                    key={`proj-${project.id || project._id}`}
                                    className="suggestion-chip project-chip"
                                    onClick={() => {
                                        if (onOpenProject) onOpenProject(project);
                                        setShowSuggestions(false);
                                        setPrompt('');
                                    }}
                                    title={project.motive || project.name}
                                >
                                    <FolderOpen size={12} />
                                    <span className="chip-name">{project.name}</span>
                                    <span className="chip-type">Project</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <div className="prompt-box">
                    <textarea
                        ref={textareaRef}
                        value={prompt}
                        onChange={(e) => {
                            // If user starts typing manually, cancel any auto-typing
                            if (isAutoTyping) setIsAutoTyping(false);
                            setPrompt(e.target.value);
                        }}
                        onKeyPress={handleKeyPress}
                        placeholder={isListening ? "Listening..." : isStructuring ? "Structuring..." : currentDoc ? "Describe the changes you want to make..." : "Describe what you want to create..."}
                        className={`prompt-textarea ${isAutoTyping ? 'auto-typing' : ''} ${isListening ? 'listening' : ''}`}
                        rows={1}
                        disabled={isStructuring}
                    />
                    <div className="prompt-actions">
                        <div className="left-actions">
                            <button className="action-btn" onClick={() => fileInputRef.current.click()}><Paperclip size={18} /></button>
                            <button className={`action-btn ${isListening ? 'listening' : ''}`} onClick={toggleVoice}><Mic size={18} /></button>
                        </div>
                        <button className="execute-btn" onClick={handleExecute}><ArrowRight size={18} /></button>
                    </div>
                </div>
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
            </div>
        </div>
    );
};

export default DocsChat;
