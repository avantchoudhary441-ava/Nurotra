import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Mic, ArrowUp, ArrowRight, Loader2, Bot, User, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import LoginModal from '../LoginModal';

// --- Typewriter Hook/Component ---
const TypewriterText = ({ text, speed = 20, onComplete, className }) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!text) return;

    let i = 0;
    setDisplayedText("");
    setIsTyping(true);

    const timer = setInterval(() => {
      if (i < text.length - 1) {
        setDisplayedText(text.substring(0, i + 1));
        i++;
      } else {
        setDisplayedText(text);
        clearInterval(timer);
        setIsTyping(false);
        if (onCompleteRef.current) {
          onCompleteRef.current();
        }
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <span className={className}>
      {displayedText}
      {isTyping && <span className="typing-cursor">▋</span>}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// AgentResultCard — renders the correct deliverable card per agent type
// ─────────────────────────────────────────────────────────────────────────────
const AGENT_META = {
  docs_agent:          { label: 'Docs Agent',          color: '#10e3b2', emoji: '📄' },
  action_agent:        { label: 'Action Agent',         color: '#a78bfa', emoji: '⚡' },
  time_agent:          { label: 'Time Agent',           color: '#60a5fa', emoji: '🕐' },
  communication_agent: { label: 'Communication Agent',  color: '#f59e0b', emoji: '💬' },
};

const cardBase = {
  padding: '20px',
  borderRadius: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
};

const AgentResultCard = ({ entry }) => {
  const { agent, task, result } = entry;
  const { user } = useAuth(); // Needed to send token in download request
  const meta = AGENT_META[agent] || { label: agent, color: '#9ca3af', emoji: '🤖' };

  const headerStyle = {
    fontSize: '0.82rem',
    fontWeight: '700',
    color: meta.color,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const handleDownload = async (docId, docName) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/workspace/download/${docId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = docName || 'document';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error("Download Error:", error);
      alert("Failed to download document. Please ensure you are authenticated.");
    }
  };

  // ── Clarification state (any agent) ──────────────────────────────────────
  if (result?.needs_clarification || result?.intent === 'CLARIFICATION') {
    const question = result.message || result.question || 'Please clarify your request.';
    return (
      <motion.div style={{ ...cardBase, border: '1px solid rgba(250,204,21,0.3)' }}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div style={{ ...headerStyle, color: '#facc15' }}>
          {meta.emoji} {meta.label} — Clarification Needed
        </div>
        <p style={{ color: '#f3f4f6', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{question}</p>
      </motion.div>
    );
  }

  // ── Docs Agent ────────────────────────────────────────────────────────────
  if (agent === 'docs_agent') {
    const doc = result?.document;
    const docId = doc?._id || result?.id;
    const docName = doc?.name || result?.fileName || 'Untitled Document';
    return (
      <motion.div style={cardBase} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div style={headerStyle}>{meta.emoji} {meta.label} — Document Generated</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: '8px' }}>
          <span style={{ color: '#f3f4f6', fontSize: '0.9rem' }}>{docName}</span>
          {docId && (
            <button
              onClick={() => handleDownload(docId, docName)}
              style={{ background: '#10e3b2', color: '#000', padding: '6px 18px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: '700', border: 'none', cursor: 'pointer' }}
            >
              Download
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  // ── Action Agent ──────────────────────────────────────────────────────────
  if (agent === 'action_agent') {
    const workflow = result?.workflow;
    const actions = workflow?.actions || [];
    const intent = result?.intent || 'WORKFLOW_EXECUTION';
    return (
      <motion.div style={{ ...cardBase, border: '1px solid rgba(167,139,250,0.25)' }}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div style={headerStyle}>{meta.emoji} {meta.label} — {workflow?.title || intent}</div>
        {actions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {actions.map((action, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(167,139,250,0.06)', padding: '8px 12px', borderRadius: '8px' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(167,139,250,0.2)', color: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: '700', flexShrink: 0 }}>
                  {i + 1}
                </span>
                <span style={{ color: '#e5e7eb', fontSize: '0.88rem' }}>{action.label}</span>
              </div>
            ))}
          </div>
        )}
        {result?.message && (
          <p style={{ color: '#9ca3af', margin: 0, fontSize: '0.82rem', whiteSpace: 'pre-wrap' }}>{result.message}</p>
        )}
      </motion.div>
    );
  }

  // ── Time Agent ────────────────────────────────────────────────────────────
  if (agent === 'time_agent') {
    const schedule = result?.planning?.schedule || [];
    return (
      <motion.div style={{ ...cardBase, border: '1px solid rgba(96,165,250,0.25)' }}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div style={headerStyle}>{meta.emoji} {meta.label} — Schedule Generated</div>
        {result?.message && (
          <p style={{ color: '#f3f4f6', margin: 0, lineHeight: 1.6, fontSize: '0.9rem' }}>{result.message}</p>
        )}
        {schedule.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
            {schedule.slice(0, 4).map((s, i) => (
              <div key={i} style={{ fontSize: '0.78rem', background: 'rgba(96,165,250,0.1)', color: '#93c5fd', padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(96,165,250,0.2)' }}>
                <strong>{s.timeLabel}:</strong> {s.title}
              </div>
            ))}
          </div>
        )}
      </motion.div>
    );
  }

  // ── Communication Agent ───────────────────────────────────────────────────
  if (agent === 'communication_agent') {
    const msg = result?.message || '';
    return (
      <motion.div style={{ ...cardBase, border: '1px solid rgba(245,158,11,0.25)' }}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div style={headerStyle}>{meta.emoji} {meta.label} — Message Drafted</div>
        <div style={{ background: 'rgba(255,255,255,0.04)', padding: '14px', borderRadius: '8px', position: 'relative' }}>
          <p style={{ color: '#f3f4f6', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.9rem' }}>{msg}</p>
          {msg && (
            <button
              onClick={() => { navigator.clipboard.writeText(msg); }}
              style={{ position: 'absolute', top: '8px', right: '8px', color: '#f59e0b', fontSize: '0.7rem', background: 'rgba(245,158,11,0.1)', border: '1px solid currentColor', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' }}
            >
              Copy
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  return (
    <motion.div style={cardBase} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div style={headerStyle}>{meta.emoji} {meta.label}</div>
      <p style={{ color: '#9ca3af', margin: 0, fontSize: '0.85rem' }}>
        {result?.message || 'Task completed.'}
      </p>
    </motion.div>
  );
};

const OrchestratorChat = ({ activeChatId, setActiveChatId, onChatCreated }) => {
  const { user } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [prompt, setPrompt] = useState("");

  // Chat History State
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // SSE Execution State
  const [hasInteracted, setHasInteracted] = useState(false);
  const [activeUserPrompt, setActiveUserPrompt] = useState("");
  const [executionUpdates, setExecutionUpdates] = useState([]);
  const [visibleExecutionIndex, setVisibleExecutionIndex] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);
  // Multi-agent results array — each entry: { agent, task, result }
  const [agentResults, setAgentResults] = useState([]);
  // Legacy single-result kept for backward compat
  const [executionResult, setExecutionResult] = useState(null);

  const scrollRef = useRef(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, executionUpdates, visibleExecutionIndex]);

  // Load messages when activeChatId changes
  useEffect(() => {
    if (activeChatId) {
      // Clear current UI states
      setHasInteracted(true);
      setExecutionUpdates([]);
      setExecutionResult(null);
      setIsExecuting(false);
      setIsLoading(true);

      const fetchMessages = async () => {
        try {
          const res = await fetch(`/api/orchestrator/chat/${activeChatId}`, {
            headers: { 'Authorization': `Bearer ${user.token}` }
          });
          if (res.ok) {
            const data = await res.json();
            // Map backend messages to local format
            const mapped = data.map(m => ({
              role: m.sender ? 'user' : 'agent',
              content: m.content,
              type: m.type === 'CLARIFICATION' ? 'CLARIFICATION' : null
            }));
            setMessages(mapped);
          }
        } catch (err) {
          console.error('Failed to load chat messages:', err);
        } finally {
          setIsLoading(false);
        }
      };
      fetchMessages();
    } else {
      // Reset for "New Chat"
      setHasInteracted(false);
      setMessages([]);
      setExecutionUpdates([]);
      setExecutionResult(null);
      setActiveUserPrompt("");
      setIsLoading(false);
    }
  }, [activeChatId, user?.token]);

  const unlockNextExecution = useCallback((idx) => {
    setVisibleExecutionIndex((prev) => (prev === idx ? prev + 1 : prev));
  }, []);

  const handleIntentClick = (intentType) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    setPrompt(`${intentType}: `);
  };

  const handleConnectGmail = async () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    try {
      const userData = JSON.parse(localStorage.getItem('nurotra_user') || '{}');
      const token = userData.token;
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const res = await axios.get('/api/integrations/google/auth', config);
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (e) {
      console.error("Gmail Auth Error", e);
      alert("Failed to start Gmail connection. Make sure backend is running.");
    }
  };

  const handleSend = async () => {
    if (!prompt.trim()) return;
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    const payloadPrompt = prompt.trim();
    setPrompt("");
    setHasInteracted(true);

    // Add to static chat history
    setMessages(prev => [...prev, { role: 'user', content: payloadPrompt }]);
    setIsLoading(true);

    // Reset SSE blocks
    setExecutionUpdates([]);
    setVisibleExecutionIndex(-1);
    setIsExecuting(false);
    setExecutionResult(null);
    setAgentResults([]);
    setActiveUserPrompt("");

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      };

      // Build conversation history from existing messages (last 10 turns)
      const history = messages.slice(-10).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }));

      // 1. Pass through Conversational Guard (with history for context)
      const intentRes = await axios.post('/api/orchestrator/intent', {
        prompt: payloadPrompt,
        history,
        chatId: activeChatId
      }, config);
      const guardDecision = intentRes.data;

      // Update activeChatId if the intent route created/identified one
      if (!activeChatId && guardDecision.chatId) {
        setActiveChatId(guardDecision.chatId);
        if (onChatCreated) onChatCreated(); // Refresh sidebar title
      }

      // 2. Direct Response Routing
      if (guardDecision.response_strategy === 'DIRECT_RESPONSE' || guardDecision.response_strategy === 'REDIRECT_WITH_CAPABILITIES') {
        setMessages(prev => [...prev, {
          role: 'agent',
          content: guardDecision.response,
          type: guardDecision.classification
        }]);
        setIsLoading(false);
        return;
      }

      // 3. Task Request Routing (pass to Execution Stream)
      setMessages(prev => [...prev, {
        role: 'agent',
        content: "Processing task handoff to execution system...",
        type: guardDecision.classification,
        isSystem: true
      }]);
      setIsLoading(false);

      setActiveUserPrompt(payloadPrompt);
      setIsExecuting(true);

      const response = await fetch('/api/orchestrator/execute', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ 
          prompt: payloadPrompt, 
          guardDecision, 
          history,
          chatId: activeChatId 
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              setExecutionUpdates(prev => [...prev, data]);
              
              if (data.phase === 'complete') {
                setIsExecuting(false);
                if (data.data) {
                  // ── Multi-agent results (new shape) ──
                  if (Array.isArray(data.data.results) && data.data.results.length > 0) {
                    setAgentResults(data.data.results);
                    // Also set legacy single result for backward compat
                    const primary = { ...data.data.result, agent: data.data.agent };
                    setExecutionResult(primary);
                    // Clarification from primary agent
                    if (primary.needs_clarification && primary.message) {
                      setMessages(prev => [...prev, {
                        role: 'agent',
                        content: primary.message,
                        type: 'CLARIFICATION'
                      }]);
                    }
                  } else if (data.data.result) {
                    // Legacy single-result fallback
                    const result = { ...data.data.result, agent: data.data.agent };
                    setExecutionResult(result);
                    setAgentResults([{ agent: data.data.agent, result }]);
                    if (result.needs_clarification && result.message) {
                      setMessages(prev => [...prev, {
                        role: 'agent',
                        content: result.message,
                        type: 'CLARIFICATION'
                      }]);
                    }
                  }
                  // Update chatId if new chat was created
                  if (!activeChatId && data.data?.chatId) {
                    setActiveChatId(data.data.chatId);
                    if (onChatCreated) onChatCreated();
                  }
                }
              } else if (data.phase === 'error' || data.bypassed) {
                setIsExecuting(false);
              }
            } catch (e) { }
          }
        }
      }
    } catch (e) {
      console.error("Orchestrator Routing/Streaming Error:", e);
      setMessages(prev => [...prev, { role: 'agent', content: "System error: Unable to process request.", isError: true }]);
      setIsExecuting(false);
      setIsLoading(false);
    }
  };

  return (
    <div className={`orchestrator-chat-area ${hasInteracted ? 'interacted' : 'centered'}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Scrollable Chat History & Execution Area */}
      {hasInteracted && (
        <div className="chat-history-scroll-area" ref={scrollRef} style={{ flexGrow: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>

          {/* Render past chat history */}
          {messages.map((msg, index) => (
            <div key={index} style={{
              display: 'flex', gap: '12px',
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%'
            }}>
              {msg.role === 'agent' && (
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #10e3b2 0%, #00bfff 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bot size={20} color="white" />
                </div>
              )}

              <div className="markdown-content" style={{
                background: msg.role === 'user' ? '#1f2937' : (msg.isSystem ? 'rgba(16, 227, 178, 0.1)' : 'transparent'),
                color: msg.isSystem ? '#10e3b2' : msg.isError ? '#ef4444' : '#f3f4f6',
                padding: '16px 20px', borderRadius: '16px',
                border: msg.role === 'agent' && !msg.isSystem ? '1px solid rgba(255,255,255,0.1)' : 'none',
                lineHeight: '1.6',
                borderTopRightRadius: msg.role === 'user' ? '4px' : '16px',
                borderTopLeftRadius: msg.role === 'agent' ? '4px' : '16px',
              }}>
                <ReactMarkdown>
                  {msg.content.replace(/(\d+\.\s+\*\*)/g, '\n$1')}
                </ReactMarkdown>
                {msg.type && (
                  <div style={{ fontSize: '0.7em', marginTop: '12px', opacity: 0.5, textTransform: 'uppercase', fontStyle: 'italic' }}>
                    [Label: {msg.type}]
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <User size={20} color="#9ca3af" />
                </div>
              )}
            </div>
          ))}

          {/* Render loading state for intent routing gap */}
          {isLoading && (
            <div style={{ display: 'flex', gap: '12px', alignSelf: 'flex-start' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #10e3b2 0%, #00bfff 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={20} color="white" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', padding: '16px' }}>
                <Loader2 size={18} className="animate-spin text-gray-400" />
                <span style={{ marginLeft: '10px', fontSize: '14px', color: '#9ca3af' }}>Routing Intent...</span>
              </div>
            </div>
          )}

          {/* Render Active Execution Task System */}
          {(activeUserPrompt || executionUpdates.length > 0) && (
            <motion.div
              style={{
                alignSelf: 'flex-start',
                width: '100%',
                background: 'rgba(0,0,0,0.2)',
                padding: '24px',
                borderRadius: '16px',
                border: '1px solid rgba(16, 227, 178, 0.2)',
                marginTop: '10px'
              }}
              initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
            >
              <div className="user-prompt-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#9ca3af' }}>
                <User size={16} /> <span style={{ fontWeight: '500' }}>Active Task Scope</span>
              </div>
              <div className="user-prompt-text" style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '24px' }}>
                <TypewriterText
                  text={activeUserPrompt}
                  speed={15}
                  onComplete={() => setVisibleExecutionIndex(0)}
                />
              </div>

              {/* Execution Stream Logs */}
              <div className="execution-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <AnimatePresence>
                  {executionUpdates.map((update, idx) => {
                    if (idx > visibleExecutionIndex) return null;

                    return (
                      <motion.div
                        key={idx}
                        className={`execution-item ${update.complete ? 'complete' : 'active'}`}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', color: update.complete ? '#10e3b2' : '#a78bfa' }}
                        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}
                      >
                        <div style={{ marginTop: '2px' }}>
                          {update.complete ? <CheckCircle2 size={18} /> : <Loader2 size={18} className="animate-spin" />}
                        </div>
                        <TypewriterText
                          text={update.status}
                          speed={20}
                          onComplete={() => unlockNextExecution(idx)}
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* ── Multi-Agent Result Cards ── */}
              {agentResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
                  {agentResults.map((entry, idx) => (
                    <AgentResultCard key={idx} entry={entry} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

        </div>
      )}

      {/* Floating Centered Logic (Only visible before first interaction) */}
      <AnimatePresence>
        {!hasInteracted && (
          <motion.div
            key="greeting"
            className="greeting-container"
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -20 }} transition={{ duration: 0.4, ease: "easeOut" }}
            style={{ margin: 'auto', textAlign: 'center' }}
          >
            <h1 className="orchestrator-greeting">Hey {user ? user.name.split(' ')[0] : 'User'},</h1>
            <h2 className="orchestrator-greeting-sub gradient-text-orchestrator">Ready to Lock In!</h2>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div layout className="master-input-wrapper" style={{ marginTop: 'auto' }}>
        <div className="master-input-container">
          <div className="master-input-inner">
            <textarea
              className="master-textarea"
              placeholder="What are we Executing today with Nurotra..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isLoading || isExecuting}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />

            <div className="master-input-actions">
              <div className="action-row-left">
                <button className="icon-btn" title="Attach Resources" disabled={isLoading || isExecuting}><Plus size={20} /></button>
                <button className="intent-btn" onClick={() => handleIntentClick('Create')} disabled={isLoading || isExecuting}>Create</button>
                <button className="intent-btn" onClick={() => handleIntentClick('Manage')} disabled={isLoading || isExecuting}>Manage</button>
                <button className="intent-btn" onClick={() => handleIntentClick('Communicate')} disabled={isLoading || isExecuting}>Communicate</button>
                {user?.gmailEmail ? (
                  <button className="intent-btn" style={{ background: 'rgba(16, 227, 178, 0.1)', color: '#10e3b2', border: '1px solid rgba(16, 227, 178, 0.3)', cursor: 'default' }}>
                    Linked: {user.gmailEmail}
                  </button>
                ) : (
                  <button className="intent-btn" onClick={handleConnectGmail} style={{ background: 'rgba(16, 227, 178, 0.1)', color: '#10e3b2', border: '1px solid currentColor' }} disabled={isLoading || isExecuting}>
                    Connect Gmail
                  </button>
                )}
              </div>

              <div className="action-row-right">
                <button className="icon-btn" title="Voice Input" disabled={isLoading || isExecuting}><Mic size={20} /></button>
                <button className="send-btn" title="Send" onClick={handleSend} disabled={isLoading || isExecuting || !prompt.trim()}><ArrowUp size={20} /></button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {!hasInteracted && (
          <motion.ul
            key="features"
            className="feature-bullets"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }}
            style={{ margin: '0 auto 40px auto' }}
          >
            <li><ArrowRight size={16} /> Create & Track your To Do List with real time.</li>
            <li><ArrowRight size={16} /> Create Documents ppts, reports, docs, pdfs.</li>
            <li><ArrowRight size={16} /> Analyse docs, summarize documents & Export in form of Ms word, Excel.</li>
            <li><ArrowRight size={16} /> Manage Your professional workflow.</li>
          </motion.ul>
        )}
      </AnimatePresence>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
};

export default OrchestratorChat;
