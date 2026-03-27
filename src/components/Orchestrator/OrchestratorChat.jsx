import React, { useState } from 'react';
import { Plus, Mic, ArrowUp, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import LoginModal from '../LoginModal';

const OrchestratorChat = () => {
  const [prompt, setPrompt] = useState("");
  const { user } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleIntentClick = (intentType) => {
    // Check if user is logged in
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    // E.g., user clicks Create, Manage, etc.
    const intentBaseText = `${intentType}: `;
    setPrompt(intentBaseText);
  };

  const handleSend = () => {
    if (!prompt.trim()) return;
    // Check if user is logged in
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    console.log("Submitting orchestrator prompt:", prompt);
    // Submit logic here
    setPrompt("");
  };

  return (
    <div className="orchestrator-chat-area">
      <div className="greeting-container">
        <h1 className="orchestrator-greeting">Hey {user ? user.name.split(' ')[0].charAt(0).toUpperCase() + user.name.split(' ')[0].slice(1).toLowerCase() : 'User'},</h1>
        <h2 className="orchestrator-greeting-sub gradient-text-orchestrator">Ready to Lock In!</h2>
      </div>

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

      <ul className="feature-bullets">
        <li><ArrowRight size={16} /> Create & Track your To Do List with real time.</li>
        <li><ArrowRight size={16} /> Create Documents ppts, reports, docs, pdfs.</li>
        <li><ArrowRight size={16} /> Analyse docs, summarize documents & Export in form of Ms word, Excel.</li>
        <li><ArrowRight size={16} /> Manage Your professional workflow.</li>
        <li><ArrowRight size={16} /> Automate your whole professional world.</li>
      </ul>

      {/* Login Guard Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
};

export default OrchestratorChat;
