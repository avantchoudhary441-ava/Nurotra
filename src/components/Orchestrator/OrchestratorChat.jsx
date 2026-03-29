import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Mic, ArrowUp, ArrowRight, Loader2, Bot, User, CheckCircle2 } from 'lucide-react';
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

const OrchestratorChat = () => {
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

  const scrollRef = useRef(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, executionUpdates, visibleExecutionIndex]);

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
      const res = await axios.get('http://localhost:5000/api/integrations/gmail/auth', config);
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
    setActiveUserPrompt("");

    try {
      // 1. Pass through Conversational Guard
      const intentRes = await axios.post('http://localhost:5000/api/orchestrator/intent', {
        prompt: payloadPrompt
      });
      const guardDecision = intentRes.data;

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

      const response = await fetch('http://localhost:5000/api/orchestrator/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: payloadPrompt, guardDecision })
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
              if (data.phase === 'complete' || data.phase === 'error' || data.bypassed) {
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

              <div style={{
                background: msg.role === 'user' ? '#1f2937' : (msg.isSystem ? 'rgba(16, 227, 178, 0.1)' : 'transparent'),
                color: msg.isSystem ? '#10e3b2' : msg.isError ? '#ef4444' : '#f3f4f6',
                padding: '16px 20px', borderRadius: '16px',
                border: msg.role === 'agent' && !msg.isSystem ? '1px solid rgba(255,255,255,0.1)' : 'none',
                lineHeight: '1.6',
                borderTopRightRadius: msg.role === 'user' ? '4px' : '16px',
                borderTopLeftRadius: msg.role === 'agent' ? '4px' : '16px',
              }}>
                {msg.content}
                {msg.type && (
                  <div style={{ fontSize: '0.7em', marginTop: '8px', opacity: 0.5, textTransform: 'uppercase' }}>
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
                <button className="intent-btn" onClick={handleConnectGmail} style={{ background: 'rgba(16, 227, 178, 0.1)', color: '#10e3b2', border: '1px solid currentColor' }} disabled={isLoading || isExecuting}>Connect Gmail</button>
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
