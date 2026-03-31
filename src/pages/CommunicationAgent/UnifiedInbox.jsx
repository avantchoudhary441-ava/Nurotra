import React, { useState, useEffect } from "react";
import { Mail, MessageSquare, Phone, RotateCw, Search, ArrowRightLeft, Clock, User, Reply, AlertCircle, RefreshCw, Instagram, Monitor } from "lucide-react";
import "../../styles/communication_agent.css";

const UnifiedInbox = ({ onReply }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all"); // 'all', 'email', 'slack', 'whatsapp', 'received', 'sent'

  const fetchMessages = async () => {
    setLoading(true);
    setError(null);
    try {
      const storedUser = localStorage.getItem('nurotra_user');
      if (!storedUser) throw new Error("Not authenticated");
      const token = JSON.parse(storedUser).token;
      
      const res = await fetch('http://localhost:5000/api/communication/history?limit=50', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const data = await res.json();
      
      if (data.success && data.messages) {
        setMessages(data.messages);
      } else {
        throw new Error(data.message || "Invalid responseFormat");
      }
    } catch (err) {
      console.error("Error fetching inbox:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const getPlatformIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'slack': return <MessageSquare size={16} />;
      case 'whatsapp': return <Phone size={16} />;
      case 'instagram': return <Instagram size={16} />;
      case 'msteams': return <Monitor size={16} />;
      case 'email': default: return <Mail size={16} />;
    }
  };

  const getPlatformColor = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'slack': return '#eab308'; // Yellow/Gold for slack here to fit theme
      case 'whatsapp': return '#22c55e'; // Green
      case 'instagram': return '#ec4899'; // Pink
      case 'msteams': return '#6366f1'; // Indigo
      case 'email': default: return '#ef4444'; // Red for Gmail
    }
  };

  const handleReplyClick = (msg) => {
    const contact = msg.recipientName || msg.recipientEmail || msg.contactId?.name || "them";
    const platform = msg.platform || "email";
    const action = msg.direction === 'received' ? 'reply' : 'follow-up';
    
    // Send immediate action to orchestrator
    onReply(`I need to send a ${action} to ${contact} on ${platform} regarding "${msg.subject || msg.body.substring(0, 20)}". However, before you draft the exact message, please ask me what specific details, points, or tone I want to include.`);
  };

  // Filter messages
  const displayMessages = messages.filter(m => {
    if (filter === "all") return true;
    if (filter === "sent") return m.direction === "sent";
    if (filter === "received") return m.direction === "received";
    return m.platform === filter;
  });

  return (
    <div className="unified-inbox-container">
      <div className="inbox-header-area">
        <div className="inbox-title-wrap">
          <h3>Inbox Hub</h3>
          <p className="subtitle">Consolidated communications across all channels.</p>
        </div>
        
        <div className="inbox-controls">
           <button className="btn-refresh" onClick={fetchMessages} disabled={loading} title="Refresh Inbox">
             <RefreshCw size={16} className={loading ? "spin" : ""} />
           </button>
           <select 
             className="inbox-filter" 
             value={filter} 
             onChange={(e) => setFilter(e.target.value)}
           >
             <option value="all">All Messages</option>
             <option value="received">Received Only</option>
             <option value="sent">Sent Only</option>
             <option value="email">Email</option>
             <option value="slack">Slack</option>
             <option value="whatsapp">WhatsApp</option>
             <option value="instagram">Instagram</option>
             <option value="msteams">MS Teams</option>
           </select>
        </div>
      </div>

      <div className="inbox-message-list">
        {loading && messages.length === 0 ? (
          <div className="inbox-empty-state">
            <RotateCw size={40} className="spin icon-muted" />
            <p>Syncing channels...</p>
          </div>
        ) : error ? (
          <div className="inbox-empty-state">
             <AlertCircle size={40} color="#ef4444" />
             <p>Error loading inbox: {error}</p>
             <button onClick={fetchMessages} className="btn-retry">Try Again</button>
          </div>
        ) : displayMessages.length === 0 ? (
          <div className="inbox-empty-state">
            <Mail size={40} className="icon-muted" />
            <p>No messages match your criteria.</p>
          </div>
        ) : (
          displayMessages.map(msg => (
            <div key={msg._id} className={`inbox-card ${msg.direction === 'received' ? 'received-card' : 'sent-card'}`}>
               <div className="inbox-card-left">
                  <div 
                    className="platform-avatar" 
                    style={{ background: `${getPlatformColor(msg.platform)}22`, color: getPlatformColor(msg.platform) }}
                    title={msg.platform}
                  >
                    {getPlatformIcon(msg.platform)}
                  </div>
               </div>
               
               <div className="inbox-card-content">
                  <div className="inbox-card-header">
                     <span className="inbox-contact">
                       {msg.direction === 'received' ? 'From: ' : 'To: '} 
                       <span className="contact-name">{msg.recipientName || msg.recipientEmail || msg.contactId?.name || "Unknown"}</span>
                     </span>
                     <span className="inbox-time">
                       {new Date(msg.sentAt || msg.createdAt).toLocaleString(undefined, { 
                         month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                       })}
                     </span>
                  </div>
                  
                  {msg.subject && <div className="inbox-subject">{msg.subject}</div>}
                  
                  <div className="inbox-body-preview">
                    {msg.body}
                  </div>
                  
                  <div className="inbox-card-footer">
                     <div className="status-badge">
                        <span className={`status-dot ${msg.status}`}></span>
                        {msg.direction === 'sent' ? `Sent via ${msg.platform || 'email'}` : `Received via ${msg.platform || 'email'}`}
                     </div>
                     <button className="btn-reply-inline" onClick={() => handleReplyClick(msg)}>
                       <Reply size={14} />
                       {msg.direction === 'received' ? 'Reply' : 'Follow Up'}
                     </button>
                  </div>
               </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default UnifiedInbox;
