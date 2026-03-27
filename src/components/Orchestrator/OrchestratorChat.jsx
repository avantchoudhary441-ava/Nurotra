import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Mic, ArrowUp, ArrowRight, Loader2, CheckCircle2, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Typewriter Hook/Component ---
// Dynamically slice strings and emulate human terminal generation
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
          onCompleteRef.current(); // Unlocks next item in the DOM queue
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
  const [prompt, setPrompt] = useState("");
  const [activeUserPrompt, setActiveUserPrompt] = useState("");
  const [hasInteracted, setHasInteracted] = useState(false);
  
  // Strict Execution UI Queue States
  const [executionUpdates, setExecutionUpdates] = useState([]);
  const [visibleExecutionIndex, setVisibleExecutionIndex] = useState(-1); // -1 = Wait for user prompt to finish typing
  const [isExecuting, setIsExecuting] = useState(false);
  
  const scrollRef = useRef(null);

  // Auto-scroll dynamically as updates sequence through the typewriters
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [executionUpdates, visibleExecutionIndex]);

  const handleIntentClick = (intentType) => {
    setPrompt(`${intentType}: `);
  };

  const unlockNextExecution = useCallback((idx) => {
    setVisibleExecutionIndex((prev) => (prev === idx ? prev + 1 : prev));
  }, []);

  const handleSend = async () => {
    if (!prompt.trim()) return;
    
    setHasInteracted(true);
    setActiveUserPrompt(prompt);
    
    const payloadPrompt = prompt;
    setPrompt("");
    
    // Hard reset the sequencing array loops
    setExecutionUpdates([]);
    setVisibleExecutionIndex(-1); // Halts execution logs until prompt bubble finishes reading
    setIsExecuting(true);
    
    const guardDecision = { response_strategy: 'ROUTE_TO_SYSTEM' };

    try {
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
            } catch(e) {}
          }
        }
      }
    } catch (e) {
      console.error("Orchestrator Backend Streaming Error:", e);
      setIsExecuting(false);
    }
  };

  return (
    <div className={`orchestrator-chat-area ${hasInteracted ? 'interacted' : 'centered'}`}>
      
      {/* 1. Dynamic Chat History Area (Above Input) */}
      {hasInteracted && (
        <div className="chat-history-scroll-area" ref={scrollRef}>
          
          {/* User Bubble with strict Typewriter lead block */}
          <motion.div 
            className="user-prompt-bubble"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="user-prompt-header">
              <User size={16} /> <span>You</span>
            </div>
            <div className="user-prompt-text">
              <TypewriterText 
                text={activeUserPrompt} 
                speed={15} 
                onComplete={() => setVisibleExecutionIndex(0)} 
              />
            </div>
          </motion.div>

          {/* Execution Stream Logs - Artificially buffered by visibleExecutionIndex */}
          <div className="execution-list">
            <AnimatePresence>
              {executionUpdates.map((update, idx) => {
                if (idx > visibleExecutionIndex) return null; // Strictly blocks future SSE elements until typing flag clears

                return (
                  <motion.div 
                    key={idx} 
                    className={`execution-item ${update.complete ? 'complete' : 'active'}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {update.complete ? <CheckCircle2 size={20} className="text-green" /> : <Loader2 size={20} className="spin text-purple" />}
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
        </div>
      )}

      {/* 2. Floating Centered Logic (Only visible before first interaction) */}
      <AnimatePresence>
        {!hasInteracted && (
          <motion.div 
            key="greeting"
            className="greeting-container"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <h1 className="orchestrator-greeting">Hey Avant,</h1>
            <h2 className="orchestrator-greeting-sub gradient-text-orchestrator">Ready to Lock In!</h2>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. The Core Master Input Box */}
      <motion.div layout className="master-input-wrapper">
        <div className="master-input-container">
          <div className="master-input-inner">
            <textarea
              className="master-textarea"
              placeholder="What are we Executing today with Nurotra..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            
            <div className="master-input-actions">
              <div className="action-row-left">
                <button className="icon-btn" title="Attach Resources">
                  <Plus size={20} />
                </button>
                <button className="intent-btn" onClick={() => handleIntentClick('Create')}>
                  Create
                </button>
                <button className="intent-btn" onClick={() => handleIntentClick('Manage')}>
                  Manage
                </button>
                <button className="intent-btn" onClick={() => handleIntentClick('Communicate')}>
                  Communicate
                </button>
              </div>
              
              <div className="action-row-right">
                <button className="icon-btn" title="Voice Input">
                  <Mic size={20} />
                </button>
                <button className="send-btn" title="Send" onClick={handleSend}>
                  <ArrowUp size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 4. Initial Landing Bullets */}
      <AnimatePresence>
        {!hasInteracted && (
          <motion.ul 
            key="features"
            className="feature-bullets"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <li><ArrowRight size={16} /> Create & Track your To Do List with real time.</li>
            <li><ArrowRight size={16} /> Create Documents ppts, reports, docs, pdfs.</li>
            <li><ArrowRight size={16} /> Analyse docs, summarize documents & Export in form of Ms word, Excel.</li>
            <li><ArrowRight size={16} /> Manage Your professional workflow.</li>
            <li><ArrowRight size={16} /> Automate your whole professional world.</li>
          </motion.ul>
        )}
      </AnimatePresence>

    </div>
  );
};

export default OrchestratorChat;
