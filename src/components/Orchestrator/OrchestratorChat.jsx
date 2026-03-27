import React, { useState, useRef, useEffect } from 'react';
import { Plus, Mic, ArrowUp, ArrowRight, Loader2, Bot, User } from 'lucide-react';
import axios from 'axios';

const OrchestratorChat = () => {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleIntentClick = (intentType) => {
    const intentBaseText = `${intentType}: `;
    setPrompt(intentBaseText);
  };

  const handleSend = async () => {
    if (!prompt.trim()) return;

    const userMessage = prompt.trim();
    setPrompt("");

    // Add user message to UI
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Call the Intent Routing Guard Layer
      // We assume the backend is running on the same domain or proxied. 
      // Using full URL for local dev safety, adjust if proxy is set.
      const response = await axios.post('http://localhost:5000/api/orchestrator/intent', {
        prompt: userMessage
      });

      const { classification, response_strategy, response: agentResponse, confidence } = response.data;

      console.log(`[Intent Router Log]`, { classification, response_strategy, confidence });

      // Handle the strict Routing Behavior Rules
      switch (response_strategy) {
        case 'DIRECT_RESPONSE':
        case 'REDIRECT_WITH_CAPABILITIES':
          // The guard handles this directly without involving the orchestrator
          setMessages(prev => [...prev, {
            role: 'agent',
            content: agentResponse,
            type: classification // SMALL_TALK, BASIC_QA, or OUT_OF_SCOPE
          }]);
          break;

        case 'ROUTE_TO_SYSTEM':
          // This is a TASK_REQUEST. The guard acknowledges passing it to the Orchestrator.
          // The agentResponse is expected to be empty as per rules, so we generate a loading/handoff message.
          setMessages(prev => [...prev, {
            role: 'agent',
            content: "Task request recognized. Forwarding to the Nurotra execution system...",
            type: classification,
            isSystem: true
          }]);

          // TODO: Actually trigger the main orchestrator agent workflow here
          // e.g. dispatch(runOrchestrator(userMessage))

          break;

        default:
          setMessages(prev => [...prev, { role: 'agent', content: "I encountered an error understanding how to route this.", isError: true }]);
      }

    } catch (error) {
      console.error("Intent Routing Error:", error);
      setMessages(prev => [...prev, { role: 'agent', content: "System error: Unable to reach the conversational guard.", isError: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="orchestrator-chat-area" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Scrollable Message History Area */}
      <div className="chat-history-container" style={{ flexGrow: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {messages.length === 0 ? (
          <div className="greeting-container" style={{ marginTop: 'auto', marginBottom: 'auto', textAlign: 'center' }}>
            <h1 className="orchestrator-greeting">Hey Avant,</h1>
            <h2 className="orchestrator-greeting-sub gradient-text-orchestrator">Ready to Lock In!</h2>

            <ul className="feature-bullets" style={{ marginTop: '40px' }}>
              <li><ArrowRight size={16} /> Create & Track your To Do List with real time.</li>
              <li><ArrowRight size={16} /> Create Documents ppts, reports, docs, pdfs.</li>
              <li><ArrowRight size={16} /> Analyse docs, summarize documents & Export.</li>
              <li><ArrowRight size={16} /> Manage Your professional workflow.</li>
            </ul>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} style={{
              display: 'flex',
              gap: '12px',
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
                padding: '16px 20px',
                borderRadius: '16px',
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
          ))
        )}

        {isLoading && (
          <div style={{ display: 'flex', gap: '12px', alignSelf: 'flex-start' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #10e3b2 0%, #00bfff 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={20} color="white" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px' }}>
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="master-input-container" style={{ flexShrink: 0, paddingBottom: '20px' }}>
        <div className="master-input-inner">
          <textarea
            className="master-textarea"
            placeholder="What are we Executing today with Nurotra..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />

          <div className="master-input-actions">
            <div className="action-row-left">
              <button className="icon-btn" title="Attach Resources" disabled={isLoading}>
                <Plus size={20} />
              </button>
              <button className="intent-btn" onClick={() => handleIntentClick('Create')} disabled={isLoading}>
                Create
              </button>
              <button className="intent-btn" onClick={() => handleIntentClick('Manage')} disabled={isLoading}>
                Manage
              </button>
              <button className="intent-btn" onClick={() => handleIntentClick('Communicate')} disabled={isLoading}>
                Communicate
              </button>
            </div>

            <div className="action-row-right">
              <button className="icon-btn" title="Voice Input" disabled={isLoading}>
                <Mic size={20} />
              </button>
              <button className="send-btn" title="Send" onClick={handleSend} disabled={isLoading || !prompt.trim()}>
                <ArrowUp size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default OrchestratorChat;
