import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Mic, ArrowUp, ArrowRight, Loader2, Bot, User, CheckCircle2, ChevronDown, ChevronUp, Sparkles, FileText, Globe, Clock, Send, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import LoginModal from '../LoginModal';
import '../../styles/orchestra_v2.css';

// --- Typewriter Component ---
const TypewriterText = ({ text, speed = 15, onComplete, className }) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

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
        if (onCompleteRef.current) onCompleteRef.current();
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

// --- Agent Execution Card Component ---
const AgentExecutionBlock = ({ agent, action, status, subSteps = [], isComplete, result, liveLogs = [] }) => {
  const [isExpanded, setIsExpanded] = useState(!isComplete);
  
  useEffect(() => {
    if (!isComplete) setIsExpanded(true);
  }, [isComplete]);

  const getAgentIcon = (name) => {
    switch (name) {
      case 'docs_agent': return <FileText size={18} />;
      case 'action_agent': return <Globe size={18} />;
      case 'time_agent': return <Clock size={18} />;
      case 'communication_agent': return <Send size={18} />;
      default: return <Bot size={18} />;
    }
  };

  return (
    <motion.div 
      className="execution-block"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ padding: '15px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="block-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setIsExpanded(!isExpanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ color: 'var(--accent-primary)', opacity: 0.8 }}>{getAgentIcon(agent)}</div>
          <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'white', letterSpacing: '0.5px' }}>
            {(agent || 'orchestrator').toUpperCase().replace('_', ' ')}
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>— {action || 'Executing Task'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {!isComplete && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.65rem', fontWeight: '900', color: '#ef4444', letterSpacing: '1px' }}>
              <div className="pulse-dot" style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ef4444' }} />
              LIVE
            </div>
          )}
          {isComplete ? <CheckCircle2 size={16} color="var(--accent-primary)" /> : <Loader2 size={16} className="animate-spin text-blue-500" />}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden', paddingLeft: '30px', marginTop: '10px' }}
          >
            {/* INTEGRATED LIVE ENVIRONMENT */}
            <div className="agent-terminal" style={{ 
              marginTop: '10px', 
              background: 'rgba(255,255,255,0.02)', 
              borderRadius: '8px', 
              border: '1px solid rgba(255,255,255,0.03)',
              padding: '12px',
              fontFamily: 'monospace',
              fontSize: '0.8rem'
            }}>
              {liveLogs.length > 0 ? (
                liveLogs.map((log, i) => (
                  <div key={i} style={{ color: log.type === 'error' ? '#ef4444' : 'rgba(255,255,255,0.5)', marginBottom: '3px' }}>
                    <span style={{ opacity: 0.3 }}>&gt;</span>
                    <span style={{ marginLeft: '8px' }}>{log.message}</span>
                  </div>
                ))
              ) : (
                <div style={{ opacity: 0.3 }}>Establishing workspace uplink...</div>
              )}
            </div>

            <div style={{ marginTop: '12px' }}>
              {subSteps.map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '3px 0', fontSize: '0.8rem', opacity: 0.6 }}>
                  <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent-primary)' }} />
                  <span>{step}</span>
                </div>
              ))}
            </div>
            
            {result && (
              <div style={{ marginTop: '15px', padding: '15px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--accent-primary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Mission Result Preview</div>
                <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '5px' }}>
                  <ReactMarkdown>
                    {result.message || result.document?.content || result.content || "Operation successful. Deliverable generated."}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// --- Team Lineup Component ---
const TeamLineup = ({ agents }) => {
  if (!agents || agents.length === 0) return null;
  
  return (
    <motion.div 
      className="team-lineup-container"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <div className="lineup-label">Mission Workforce</div>
      <div className="agent-chips">
        {agents.map((a, i) => (
          <div key={i} className={`agent-chip ${a.status}`}>
            <span className="chip-dot"></span>
            <span className="chip-name">{(a.agent || 'Unknown Agent').replace('_', ' ')}</span>
            <span className="chip-status">{a.status}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

const OrchestratorChat = ({ activeChatId, setActiveChatId, onChatCreated }) => {
  const { user } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [stream, setStream] = useState([]); // Unified Stream: { type, content, data }
  const [lineup, setLineup] = useState([]); // [{ agent, status }]
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  
  const incomingBuffer = useRef([]);
  const [isProcessingBuffer, setIsProcessingBuffer] = useState(false);

  const processDataChunk = (data) => {
    if (data.phase === 'mapping' && data.data) {
      // data.data can be an array of tasks OR an object keyed by agent name
      let agentList = [];
      if (Array.isArray(data.data)) {
        agentList = data.data.filter(t => t.suggested_agent).map(t => t.suggested_agent);
      } else if (typeof data.data === 'object') {
        agentList = Object.keys(data.data);
      }
      const uniqueAgents = [...new Set(agentList)];
      const initialLineup = uniqueAgents.map(agent => ({ agent, status: 'pending' }));
      setLineup(initialLineup);
      setStream(prev => [...prev, { type: 'lineup', agents: initialLineup }]);
    }
    else if (data.phase === 'thought') {
      setStream(prev => [...prev, { type: 'thought', content: data.status, agent: data.data?.agent }]);
    } 
    else if (data.phase === 'narrative') {
      setStream(prev => [...prev, { type: 'narrative', content: data.status, agent: data.data?.agent }]);
    }
    else if (data.phase === 'execution') {
      if (!data.complete) {
        const cardId = `card_${data.data?.step}`;
        setLineup(prev => prev.map(a => 
          a.agent === data.data?.agent ? { ...a, status: 'executing' } : a
        ));

        setStream(prev => {
          if (prev.find(i => i.id === cardId)) return prev;
          return [...prev, {
            id: cardId,
            type: 'execution_card',
            agent: data.data?.agent || 'orchestrator',
            action: data.status.split(':')[0],
            status: data.status.split(':')[1] || 'Executing...',
            subSteps: [],
            isComplete: false
          }];
        });
      } else {
        setLineup(prev => prev.map(a => 
          a.agent === data.data?.agent ? { ...a, status: 'done' } : a
        ));
        setStream(prev => prev.map(item => 
          item.id === `card_${data.data?.step}` 
            ? { ...item, isComplete: true, status: 'Finalized', result: data.data?.result } 
            : item
        ));
      }
    }
    else if (data.phase === 'agent_live_update') {
      const cardId = `card_${data.data?.step}`;
      setStream(prev => prev.map(item => 
        item.id === cardId 
          ? { ...item, liveLogs: [...(item.liveLogs || []), { message: data.status, type: data.data?.type || 'info' }] } 
          : item
      ));
    }
    else if (data.phase === 'sub_step') {
      setStream(prev => {
        const lastExecIdx = [...prev].reverse().findIndex(i => i.type === 'execution_card');
        if (lastExecIdx === -1) return prev;
        const actualIdx = prev.length - 1 - lastExecIdx;
        const newStream = [...prev];
        newStream[actualIdx] = { 
          ...newStream[actualIdx], 
          subSteps: [...(newStream[actualIdx].subSteps || []), data.status] 
        };
        return newStream;
      });
    }
    else if (data.phase === 'chatter') {
      setStream(prev => [...prev, { 
        type: 'chatter', 
        content: data.status, 
        agent: data.data?.agent, 
        role: data.data?.role 
      }]);
    }
    else if (data.phase === 'complete') {
      setIsExecuting(false);
      setStream(prev => [...prev, { 
        type: 'completion', 
        content: 'Mission Successful', 
        deliverables: data.data?.deliverables || [] 
      }]);
    }
  };

  useEffect(() => {
    let interval;
    if (isProcessingBuffer) {
      interval = setInterval(() => {
        if (incomingBuffer.current.length > 0) {
          const next = incomingBuffer.current.shift();
          processDataChunk(next);
        } else if (!isExecuting) {
          // Buffer empty and execution complete — stop processing
          setIsProcessingBuffer(false);
        }
        // If buffer empty but still executing — keep waiting for more SSE data (do nothing)
      }, 600);
    }
    return () => clearInterval(interval);
  }, [isProcessingBuffer, isExecuting]);
  
  const scrollRef = useRef(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => { scrollToBottom(); }, [stream]);

  // Load history into stream
  useEffect(() => {
    if (activeChatId) {
      setStream([]);
      setIsLoading(true);
      const fetchMessages = async () => {
        try {
          const res = await fetch(`/api/orchestrator/chat/${activeChatId}`, {
            headers: { 'Authorization': `Bearer ${user.token}` }
          });
          if (res.ok) {
            const data = await res.json();
            const mapped = data.map(m => ({
              type: m.sender ? 'user' : 'orchestrator',
              content: m.content
            }));
            setStream(mapped);
          }
        } catch (err) { console.error(err); }
        finally { setIsLoading(false); }
      };
      fetchMessages();
    } else {
      setStream([]);
    }
  }, [activeChatId, user?.token]);

  const executePrompt = async (payloadPrompt) => {
    if (!payloadPrompt.trim() || isLoading || isExecuting) return;
    if (!user) { setShowLoginModal(true); return; }

    setPrompt("");
    setStream(prev => [...prev, { type: 'user', content: payloadPrompt }]);
    setIsLoading(true);
    setIsExecuting(true);
    setIsProcessingBuffer(true);
    incomingBuffer.current = [];

    // Safety timeout: force-reset stuck state after 3 minutes
    const safetyTimer = setTimeout(() => {
      setIsExecuting(false);
      setIsLoading(false);
      setIsProcessingBuffer(false);
      setStream(prev => [
        ...prev,
        { type: 'orchestrator', content: "Request timed out. Please try again.", isError: true }
      ]);
    }, 180000);

    try {
      const response = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/orchestrator/execute', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ prompt: payloadPrompt, history: stream.slice(-10), chatId: activeChatId })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      setIsLoading(false);
      
      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) {
          streamDone = true;
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              incomingBuffer.current.push(data);
              // If complete phase received, mark stream as finishing
              if (data.phase === 'complete' || data.phase === 'error') {
                streamDone = true;
              }
            } catch (e) { /* ignore parse errors */ }
          }
        }
      }

      // Wait for buffer to finish processing then clean up
      const waitForBuffer = () => {
        if (incomingBuffer.current.length === 0) {
          clearTimeout(safetyTimer);
          setIsExecuting(false);
        } else {
          setTimeout(waitForBuffer, 300);
        }
      };
      setTimeout(waitForBuffer, 300);

    } catch (e) {
      console.error('[Orchestrator] Fetch error:', e);
      clearTimeout(safetyTimer);
      setStream(prev => [...prev, { type: 'orchestrator', content: `Error: ${e.message || 'Unable to connect to server.'}`, isError: true }]);
      setIsExecuting(false);
      setIsProcessingBuffer(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => {
    const p = prompt.trim();
    if (!p || isLoading || isExecuting) return;
    executePrompt(p);
  };

  const handleSendWithPrompt = (p) => {
    if (!p.trim() || isLoading || isExecuting) return;
    executePrompt(p);
  };

  return (
    <div className="orchestrator-chat-area interacted" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--orchestra-bg)', color: 'white' }}>
      
      {/* Unified Stream Area */}
      <div className="chat-history-scroll-area unified-orchestra-stream" ref={scrollRef} style={{ flexGrow: 1, overflowY: 'auto' }}>
        
        {stream.length === 0 && !isLoading && (
           <div className="orchestrator-empty-state" style={{ margin: 'auto', textAlign: 'left', maxWidth: '800px', padding: '40px' }}>
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6 }}>
                <h1 className="hero-greeting" style={{ fontSize: '2.5rem', fontWeight: '400', marginBottom: '10px', color: 'white' }}>
                  Hey {user?.name || 'there'},
                </h1>
                <h2 className="hero-sub" style={{ fontSize: '3.5rem', fontWeight: '800', marginBottom: '40px', letterSpacing: '-1.5px', background: 'linear-gradient(to right, #a855f7, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Ready to Lock In!
                </h2>
                
                <ul className="feature-roadmap" style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {[
                    { label: "Create a professional project report on The Holy Book Bhagavat Gita", prompt: "Create a professional project report on The Holy Book Bhagavat Gita" },
                    { label: "Analyse and summarize my workspace documents.", prompt: "Analyse and summarize my workspace documents" },
                    { label: "Schedule my professional workflow for tomorrow.", prompt: "Schedule my professional workflow for tomorrow" },
                    { label: "Draft a professional email/outreach to my team.", prompt: "Draft a professional email to my team" },
                    { label: "Automate my daily task list and tracking.", prompt: "Automate my daily task list and tracking" }
                  ].map((feature, i) => (
                    <li 
                      key={i} 
                      onClick={() => {
                        setPrompt(feature.prompt);
                        // Auto-send after brief delay so state updates first
                        setTimeout(() => {
                          handleSendWithPrompt(feature.prompt);
                        }, 50);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '15px', color: 'rgba(255,255,255,0.7)', fontSize: '1.1rem', cursor: 'pointer', transition: 'all 0.2s ease' }}
                      className="feature-item-link"
                    >
                      <span style={{ color: '#a855f7', fontWeight: 'bold' }}>→</span>
                      {feature.label}
                    </li>
                  ))}
                </ul>
              </motion.div>
           </div>
        )}

        {stream.map((item, index) => {
          if (item.type === 'user') return (
            <div key={index} className="stream-msg user" style={{ marginBottom: '10px' }}>{item.content}</div>
          );
          
          if (item.type === 'orchestrator') return (
            <div key={index} className="stream-msg orchestrator" style={{ display: 'flex', gap: '15px' }}>
              <div className="msg-icon" style={{ minWidth: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={18} color="var(--accent-primary)" />
              </div>
              <div className="msg-text" style={{ paddingTop: '5px' }}>
                <ReactMarkdown>{item.content}</ReactMarkdown>
              </div>
            </div>
          );
          
          if (item.type === 'lineup') return <TeamLineup key={index} agents={lineup} />;
          
          if (item.type === 'thought') return (
            <motion.div key={index} className="agent-thought" style={{ marginLeft: '47px' }}>
              <Sparkles size={14} color="var(--thought-text)" />
              <span>{item.content}</span>
            </motion.div>
          );
          
          if (item.type === 'chatter') {
            const AgentIcon = {
              docs_agent: FileText,
              action_agent: Globe,
              time_agent: Clock,
              communication_agent: MessageSquare,
              orchestrator: Bot
            }[item.agent] || Bot;

            const agentColor = item.agent === 'docs_agent' ? '#3b82f6' : (item.agent === 'action_agent' ? '#10e3b2' : (item.agent === 'time_agent' ? '#a855f7' : '#ec4899'));

            return (
              <motion.div 
                key={index} 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ 
                  marginLeft: '47px', 
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AgentIcon size={14} style={{ color: agentColor }} />
                  <div style={{ 
                    fontSize: '0.7rem', 
                    fontWeight: '900', 
                    color: agentColor,
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}>
                    {item.agent?.replace('_', ' ')}
                  </div>
                </div>
                <div style={{ 
                  background: 'rgba(255,255,255,0.03)', 
                  padding: '4px 12px', 
                  borderRadius: '12px', 
                  fontSize: '0.85rem', 
                  color: 'rgba(255,255,255,0.8)',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  {item.content}
                </div>
              </motion.div>
            );
          }

          if (item.type === 'narrative') {
            // Find if this is the absolute latest narrative in the stream
            const narrativeIndices = stream.map((it, idx) => it.type === 'narrative' ? idx : -1).filter(idx => idx !== -1);
            const isLatest = index === narrativeIndices[narrativeIndices.length - 1];
            const isActive = isLatest && isExecuting;
            const cleanContent = item.content.replace(/\.\.\.$/, '');

            return (
              <motion.div 
                key={index} 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="narrative-note" 
                style={{ marginLeft: '47px' }}
              >
                {isActive ? (
                  <Loader2 size={14} className="animate-spin" style={{ color: 'inherit' }} />
                ) : (
                  <CheckCircle2 size={14} style={{ color: 'var(--accent-primary)' }} />
                )}
                <TypewriterText 
                  text={cleanContent} 
                  className={isActive ? "pulsing-dots" : ""} 
                  speed={10}
                />
              </motion.div>
            );
          }
          
          if (item.type === 'execution_card') return (
            <div key={item.id} style={{ marginLeft: '47px' }}>
              <AgentExecutionBlock {...item} />
            </div>
          );
          
          if (item.type === 'completion') return (
            <motion.div key={index} className="completion-block" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="completion-title">Mission Accomplished</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '20px' }}>The requested task has been finalized and verified by the Nurotra Workforce.</p>
              
              {item.result?.message && (
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  border: '1px solid rgba(255, 255, 255, 0.05)', 
                  borderRadius: '16px', 
                  padding: '24px',
                  marginBottom: '24px',
                  fontSize: '1rem',
                  lineHeight: '1.6',
                  color: 'rgba(255, 255, 255, 0.9)'
                }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--accent-primary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Final Mission Summary</div>
                  <ReactMarkdown>{item.result.message}</ReactMarkdown>
                </div>
              )}

              {item.deliverables && item.deliverables.length > 0 && (
                <>
                  <style>{`
                    .export-dropdown-container:hover .export-menu {
                      display: block !important;
                      animation: slideUp 0.2s ease-out;
                    }
                    @keyframes slideUp {
                      from { opacity: 0; transform: translateY(10px); }
                      to { opacity: 1; transform: translateY(0); }
                    }
                  `}</style>
                  <div className="deliverables-grid" style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                    gap: '20px', 
                    marginTop: '24px' 
                  }}>
                    {item.deliverables.map((doc, dIdx) => (
                      <motion.div 
                        key={dIdx}
                        className="deliverable-card"
                        whileHover={{ y: -5, boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}
                        style={{ 
                          background: 'rgba(255, 255, 255, 0.03)', 
                          border: '1px solid rgba(255, 255, 255, 0.08)', 
                          borderRadius: '24px', 
                          padding: '24px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '16px',
                          backdropFilter: 'blur(10px)',
                          position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ 
                            padding: '12px', 
                            background: 'rgba(59, 130, 246, 0.1)', 
                            borderRadius: '16px', 
                            color: '#3b82f6',
                            boxShadow: '0 8px 16px rgba(59, 130, 246, 0.1)'
                          }}>
                            <FileText size={28} />
                          </div>
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ color: 'white', fontWeight: '700', fontSize: '1.05rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>{doc.type || 'Document'} • Finalized</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', marginTop: '8px' }}>
                          <button 
                            onClick={() => window.open(`/api/workspace/download/${doc.id}`, '_blank')}
                            style={{
                              flex: 1,
                              padding: '14px',
                              borderRadius: '16px',
                              background: 'var(--accent-primary)',
                              color: '#000',
                              border: 'none',
                              fontSize: '0.9rem',
                              fontWeight: '800',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '10px',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                          >
                            <ArrowUp size={18} style={{ transform: 'rotate(180deg)' }} />
                            Download Report
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          );
          return null;
        })}

        {isLoading && (
          <div style={{ alignSelf: 'flex-start', padding: '20px 44px' }}>
            <Loader2 size={28} className="animate-spin text-gray-600" />
          </div>
        )}
      </div>

      {/* Floating Input Area */}
      <div className="master-input-wrapper" style={{ padding: '20px', background: 'transparent' }}>
        <div className="master-input-container" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)' }}>
          <div className="master-input-inner" style={{ padding: '12px 20px' }}>
            <textarea
              className="master-textarea"
              placeholder="What are we Executing today with Nurotra..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isLoading || isExecuting}
              style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', resize: 'none', minHeight: '60px', outline: 'none', fontSize: '1.1rem', fontFamily: 'inherit' }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button className="icon-btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', padding: '8px', borderRadius: '12px', cursor: 'pointer' }}><Plus size={20} /></button>
                <div style={{ height: '20px', width: '1px', background: 'var(--card-border)' }} />
                <button className="intent-btn" onClick={() => setPrompt('Create a ')} style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', fontSize: '0.85rem', cursor: 'pointer', padding: '6px 14px', borderRadius: '18px' }}>Create</button>
                <button className="intent-btn" onClick={() => setPrompt('Manage ')} style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', fontSize: '0.85rem', cursor: 'pointer', padding: '6px 14px', borderRadius: '18px' }}>Manage</button>
                <button className="intent-btn" onClick={() => setPrompt('Communicate ')} style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', fontSize: '0.85rem', cursor: 'pointer', padding: '6px 14px', borderRadius: '18px' }}>Communicate</button>
              </div>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <Mic size={20} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} />
                <button 
                  className="send-btn" 
                  onClick={handleSend}
                  disabled={!prompt.trim() || isLoading || isExecuting}
                  style={{ 
                    background: (prompt.trim() && !isLoading && !isExecuting) ? '#a855f7' : 'rgba(255,255,255,0.1)', 
                    color: '#fff', border: 'none', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s ease', cursor: 'pointer', boxShadow: (prompt.trim() && !isLoading && !isExecuting) ? '0 0 15px rgba(168, 85, 247, 0.4)' : 'none' 
                  }}
                >
                  {isLoading || isExecuting ? <Loader2 size={20} className="animate-spin" /> : <ArrowUp size={20} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
};

export default OrchestratorChat;
