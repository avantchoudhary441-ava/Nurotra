import React, { useState, useRef, useEffect } from 'react';
import {
    Paperclip,
    Mic,
    ArrowRight,
    History,
    Pause,
    Play,
    X,
    RotateCcw,
    Undo
} from 'lucide-react';
import { docsAgentService } from '../../../services/docsAgentService';
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
    onSelectHistory
}) => {
    const [prompt, setPrompt] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [isAutoTyping, setIsAutoTyping] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [showPastConversations, setShowPastConversations] = useState(false);
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

    useEffect(() => {
        if (initialTrigger) {
            setIsAutoTyping(true);
            let i = 0;
            const text = initialTrigger.text;
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
        }
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
        if (!prompt.trim()) return;
        const userPrompt = prompt.trim();
        setPrompt('');

        const userMsg = {
            id: Date.now(),
            type: 'user',
            text: userPrompt,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setStrategyMessages(prev => [...prev, userMsg]);

        if (onAgentIntent) {
            onAgentIntent({ description: userPrompt, type: 'TASK_EXECUTION' });
        }

        setIsThinking(true);
        setTimeout(async () => {
            setIsThinking(false);
            const intent = docsAgentService.parseIntent(userPrompt);
            const response = await docsAgentService.generateResponse(userPrompt, intent);

            const agentMsg = {
                id: Date.now() + 1,
                type: response.intent === 'CREATE' ? 'narration' : 'agent_answer',
                text: response.text,
                clarification: response.clarification,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setStrategyMessages(prev => [...prev, agentMsg]);
        }, 1500);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleExecute();
        }
    };

    const toggleVoice = () => {
        setIsListening(!isListening);
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
                <div className="prompt-box">
                    <textarea
                        ref={textareaRef}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Describe what you want to create..."
                        className={`prompt-textarea ${isAutoTyping ? 'auto-typing' : ''}`}
                        rows={1}
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
