import React, { useState, useEffect, useRef } from "react";
import { 
  Zap, 
  Menu, 
  LayoutDashboard, 
  Inbox, 
  Users, 
  ShieldCheck, 
  Settings,
  CheckCircle2,
  RotateCw,
  SendHorizontal,
  Mail,
  MessageSquare,
  History,
  Info,
  AlertTriangle,
  Flame,
  Globe,
  ChevronLeft,
  Calendar,
  Clock,
  FileText,
  UserCheck,
  Megaphone,
  BarChart3,
  Target
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAgentChat } from "../../hooks/useAgentChat";
import "../../styles/communication_agent.css";

const DigestDashboard = ({ data }) => {
  const { sentCount, receivedCount, failedCount, pendingFollowUps, platforms = {}, flaggedItems = [] } = data;
  
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  });

  return (
    <div className="digest-container">
      {/* Internal header removed */}


      <div className="digest-grid">
        <div className="stat-card card-sent">
          <div className="stat-value">{sentCount}</div>
          <div className="stat-label">Messages Sent</div>
        </div>
        <div className="stat-card card-received">
          <div className="stat-value">{receivedCount}</div>
          <div className="stat-label">Received</div>
        </div>
        <div className="stat-card card-unread">
          <div className="stat-value">{failedCount}</div>
          <div className="stat-label">Failures</div>
        </div>
        <div className="stat-card card-reply">
          <div className="stat-value">{pendingFollowUps}</div>
          <div className="stat-label">Needs Reply</div>
        </div>
      </div>

      <div className="platform-row">
        <div className="platform-card">
          <div className="platform-header">
            <div className="platform-icon" style={{ background: '#ea4335' }}>
              <Mail size={16} color="white" />
            </div>
            <span className="platform-name">Gmail</span>
          </div>
          <div className="platform-stats">
            <div className="platform-stat-item">
              <span className="ps-value">{platforms.email?.sent || 0}</span>
              <span className="ps-label">Sent</span>
            </div>
            <div className="platform-stat-item">
              <span className="ps-value">{platforms.email?.received || 0}</span>
              <span className="ps-label">Received</span>
            </div>
          </div>
        </div>

        <div className="platform-card">
          <div className="platform-header">
            <div className="platform-icon" style={{ background: '#4a154b' }}>
              <MessageSquare size={16} color="white" />
            </div>
            <span className="platform-name">Slack</span>
          </div>
          <div className="platform-stats">
            <div className="platform-stat-item">
              <span className="ps-value">{platforms.slack?.sent || 0}</span>
              <span className="ps-label">Sent</span>
            </div>
            <div className="platform-stat-item">
              <span className="ps-value">{platforms.slack?.received || 0}</span>
              <span className="ps-label">Received</span>
            </div>
          </div>
        </div>
      </div>

      {flaggedItems.length > 0 && (
        <div className="flagged-section">
          <div className="flagged-title">
            <AlertTriangle size={16} />
            <span>FLAGGED ITEMS</span>
          </div>
          <div className="flagged-list">
            {flaggedItems.map((item, idx) => (
              <div key={idx} className="flagged-item">
                <span className="fi-text">{item.text}</span>
                <span className="fi-meta">{item.meta}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const CommunicationAgentPage = () => {
  const navigate = useNavigate();
  const { messages, send, loading, error } = useAgentChat();
  const [inputText, setInputText] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const chatScrollRef = useRef(null);
  
  // Real dynamic states for the 10 capabilities
  const [serviceStatus, setServiceStatus] = useState({
    email: 'connected',
    slack: 'disconnected',
    whatsapp: 'disconnected'
  });

  const [liveExecutions, setLiveExecutions] = useState([
    {
      id: 1,
      type: 'BROADCAST',
      title: "Broadcast Task Completion?",
      description: "Document 'Q1 Strategy' updated. Notify 4 stakeholders?",
      status: 'pending'
    },
    {
      id: 2,
      type: 'FOLLOW_UP',
      title: "Pending Follow-up",
      description: "No reply from 'anuj@example.com'. Send a 48h nudge?",
      status: 'pending'
    }
  ]);

  const [executionHistory, setExecutionHistory] = useState([]);

  const [digestData, setDigestData] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [meetingSyncing, setMeetingSyncing] = useState(false);
  const [campaigns, setCampaigns] = useState([]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Fetch real data on mount
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const storedUser = localStorage.getItem('nurotra_user');
        if (!storedUser) return;
        const token = JSON.parse(storedUser).token;
        if (!token) return;

        // 1. Fetch History (§2.6)
        const historyRes = await fetch('http://localhost:5000/api/communication/history?limit=10', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (historyRes.ok) {
          const historyData = await historyRes.json();
          if (historyData.messages) {
            setExecutionHistory(historyData.messages.map(m => ({
              id: m._id,
              text: `${m.direction === 'sent' ? 'Sent' : 'Received'} ${m.platform}: ${m.subject || m.body.substring(0, 30)}...`,
              status: m.status === 'sent' ? 'success' : 'active',
              time: new Date(m.sentAt || m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            })));
          }
        }

        // 2. Fetch Direct Digest Analytic (§2.3)
        const digestRes = await fetch('http://localhost:5000/api/communication/digest', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (digestRes.ok) {
          const digestData = await digestRes.json();
          if (digestData.success) {
            setDigestData(digestData);
          }
        }

        // 3. Scan for Failures (§2.7)
        const chatRes = await fetch('http://localhost:5000/api/communication/chat', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: "Do I have any failed messages?" })
        });
        
        if (chatRes.ok) {
          const chatData = await chatRes.json();
          if (chatData.action?.messages?.length > 0) {
            const count = chatData.action.messages.length;
            setLiveExecutions(prev => [
              { id: 'retry-fail', type: 'RETRY', title: 'Transmission Failure', description: `I found ${count} failed messages. Should I retry?`, status: 'warning' },
              ...prev
            ]);
          }
        }

        // 4. Fetch Meetings Loop
        const meetingsRes = await fetch('http://localhost:5000/api/communication/meetings', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (meetingsRes.ok) {
          const mData = await meetingsRes.json();
          if (mData.success) {
             setMeetings(mData.meetings);
          }
        }

        // 5. Fetch Bulk Campaigns
        const campaignsRes = await fetch('http://localhost:5000/api/communication/campaigns', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (campaignsRes.ok) {
          const cData = await campaignsRes.json();
          if (cData.success) {
            setCampaigns(cData.campaigns);
          }
        }

      } catch (err) {
        console.error("Dashboard data fetch failed:", err);
      }
    };

    fetchDashboardData();
  }, []);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || loading) return;
    
    const prompt = inputText;
    setInputText("");
    const response = await send(prompt);
    
    // Auto-switch to overview if digest is requested in chat
    if (response?.intent === 'daily_digest' && response?.action?.digest) {
      setDigestData(response.action.digest);
      setActiveTab('overview');
    }
  };

  const dismissExecution = (id) => {
    setLiveExecutions(prev => prev.filter(e => e.id !== id));
  };

  // ─── MEETINGS VIEW ────────────────────────────────────────────────────────
  const renderMeetings = () => (
    <div className="comm-view-container meetings-view anim-fade-in">
      <div className="view-header">
        <div>
          <h3>Meeting Lifecycle Loop</h3>
          <p className="subtitle">Tracking Pre-Event, Execution, and Post-Event follow-ups.</p>
        </div>
        <button 
          className={`btn-sync ${meetingSyncing ? 'loading' : ''}`}
          onClick={async () => {
            setMeetingSyncing(true);
            const token = localStorage.getItem('token');
            await fetch('http://localhost:5000/api/communication/meetings/sync', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            // Re-fetch
            const res = await fetch('http://localhost:5000/api/communication/meetings', {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
              const data = await res.json();
              if (data.success) setMeetings(data.meetings);
            }
            setMeetingSyncing(false);
          }}
        >
          <RotateCw size={16} className={meetingSyncing ? 'spin' : ''} />
          {meetingSyncing ? 'Syncing...' : 'Sync Loop'}
        </button>
      </div>

      <div className="meetings-grid">
        {meetings.length === 0 ? (
          <div className="empty-state">
            <Calendar size={48} className="icon-muted" />
            <p>No active meeting loops found.</p>
            <span>Ask me to "Schedule a meeting" to start a cycle.</span>
          </div>
        ) : (
          meetings.map(meeting => (
            <div key={meeting._id} className="meeting-card glass-panel">
              <div className="meeting-tag" data-phase={meeting.phase}>
                {meeting.phase.toUpperCase()}
              </div>
              <h4 className="meeting-name">{meeting.title}</h4>
              <div className="meeting-meta">
                <span><Clock size={14} /> {new Date(meeting.startTime).toLocaleString()}</span>
                <span><Users size={14} /> {meeting.participants.length} Participants</span>
              </div>
              
              <div className="participant-tracker">
                <div className="tracker-header">
                  <span>RSVP TRACKING</span>
                  <span className="count">{meeting.participants.filter(p => p.status === 'confirmed').length}/{meeting.participants.length}</span>
                </div>
                <div className="participant-mini-list">
                  {meeting.participants.map((p, idx) => (
                    <div key={idx} className="p-item">
                      <span className="p-email">{p.email}</span>
                      <span className={`p-badge ${p.status}`}>
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {meeting.agenda && (
                <div className="meeting-agenda-box">
                  <p><strong><FileText size={14} /> Agenda:</strong> {meeting.agenda}</p>
                </div>
              )}

              <div className="meeting-actions">
                <button className="btn-tiny primary">Nudge All</button>
                <button className="btn-tiny secondary">Details</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // ─── CAMPAIGNS VIEW ───────────────────────────────────────────────────────
  const renderCampaigns = () => (
    <div className="comm-view-container campaigns-view anim-fade-in">
      <div className="view-header">
        <div>
          <h3>Bulk Outreach Campaigns</h3>
          <p className="subtitle">Individualized messaging loops with atomic tracking.</p>
        </div>
        <button 
          className="btn-sync"
          onClick={async () => {
            const token = localStorage.getItem('token');
            const res = await fetch('http://localhost:5000/api/communication/campaigns', {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
              const data = await res.json();
              if (data.success) setCampaigns(data.campaigns);
            }
          }}
        >
          <RotateCw size={16} />
          Refresh
        </button>
      </div>

      <div className="campaign-stats-overview">
         <div className="mini-stat glass-panel">
            <Target size={20} className="text-blue" />
            <div className="val">{campaigns.length}</div>
            <div className="lab">Active Campaigns</div>
         </div>
         <div className="mini-stat glass-panel">
            <UserCheck size={20} className="text-green" />
            <div className="val">{campaigns.reduce((acc, c) => acc + (c.stats?.sent || 0), 0)}</div>
            <div className="lab">Total Personalized Sends</div>
         </div>
         <div className="mini-stat glass-panel">
            <BarChart3 size={20} className="text-purple" />
            <div className="val">{campaigns.reduce((acc, c) => acc + (c.stats?.replied || 0), 0)}</div>
            <div className="lab">Total Replies</div>
         </div>
      </div>

      <div className="campaigns-grid">
        {campaigns.length === 0 ? (
          <div className="empty-state">
            <Megaphone size={48} className="icon-muted" />
            <p>No outreach campaigns found.</p>
            <span>Try: "Send a pitch to my investor group"</span>
          </div>
        ) : (
          campaigns.map(campaign => (
            <div key={campaign._id} className="campaign-card glass-panel">
              <div className="campaign-header">
                 <h4 className="campaign-title">{campaign.title}</h4>
                 <div className={`campaign-status-pill ${campaign.status}`}>{campaign.status}</div>
              </div>
              
              <div className="campaign-subject">"{campaign.subject}"</div>

              <div className="campaign-progress">
                 <div className="progress-label">
                    <span>Performance</span>
                    <span>{Math.round(((campaign.stats?.sent || 0) / campaign.totalRecipients) * 100)}% Execution</span>
                 </div>
                 <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${((campaign.stats?.sent || 0) / campaign.totalRecipients) * 100}%` }}></div>
                 </div>
              </div>

              <div className="campaign-mini-stats">
                 <div className="c-stat">
                    <span className="c-val">{campaign.stats?.sent}</span>
                    <span className="c-lab">Sent</span>
                 </div>
                 <div className="c-stat">
                    <span className="c-val text-green">{campaign.stats?.replied}</span>
                    <span className="c-lab">Replies</span>
                 </div>
                 <div className="c-stat">
                    <span className="c-val text-red">{campaign.stats?.failed}</span>
                    <span className="c-lab">Failed</span>
                 </div>
              </div>

              <div className="campaign-actions">
                 <button className="btn-tiny primary">View Recipients</button>
                 <button className="btn-tiny secondary">Draft Nudges</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className={`comm-agent-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Sidebar - MONOCHROMATIC STYLE */}
      <aside className={`comm-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <button className="menu-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            <Menu size={20} />
          </button>
        </div>
        
        <nav className="comm-sidebar-nav">
          <div className="nav-section">
            <span className="nav-label">General</span>
            <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
              <span className="nav-icon"><LayoutDashboard size={18} /></span>
              <span className="nav-text">Dashboard</span>
            </button>
            <button className={`nav-item ${activeTab === 'inbox' ? 'active' : ''}`} onClick={() => setActiveTab('inbox')}>
              <span className="nav-icon"><Inbox size={18} /></span>
              <span className="nav-text">Inbox Hub</span>
            </button>
            <button className={`nav-item ${activeTab === 'contacts' ? 'active' : ''}`} onClick={() => setActiveTab('contacts')}>
              <span className="nav-icon"><Users size={18} /></span>
              <span className="nav-text">Directory</span>
            </button>
            <button className={`nav-item ${activeTab === 'meetings' ? 'active' : ''}`} onClick={() => setActiveTab('meetings')}>
              <span className="nav-icon"><Calendar size={18} /></span>
              <span className="nav-text">Meetings Loop</span>
            </button>
            <button className={`nav-item ${activeTab === 'campaigns' ? 'active' : ''}`} onClick={() => setActiveTab('campaigns')}>
              <span className="nav-icon"><Megaphone size={18} /></span>
              <span className="nav-text">Bulk Outreach</span>
            </button>
          </div>

          <div className="nav-section">
            <span className="nav-label">Cloud Sync</span>
            <button className={`nav-item ${activeTab === 'gmail' ? 'active' : ''}`} onClick={() => setActiveTab('gmail')}>
              <span className="nav-icon"><div className="status-dot connected"></div></span>
              <span className="nav-text">Gmail Workspace</span>
            </button>
            {!sidebarCollapsed && (
              <>
                <button className={`nav-item ${activeTab === 'slack' ? 'active' : ''}`} onClick={() => setActiveTab('slack')}>
                  <span className="nav-icon"><div className="status-dot"></div></span>
                  <span className="nav-text">Slack Cloud</span>
                </button>
                <button className={`nav-item ${activeTab === 'mobile' ? 'active' : ''}`} onClick={() => setActiveTab('mobile')}>
                  <span className="nav-icon"><div className="status-dot"></div></span>
                  <span className="nav-text">Mobile Outreach</span>
                </button>
              </>
            )}
          </div>
        </nav>

        <div className="sidebar-footer">
          <button className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            <span className="nav-icon"><History size={18} /></span>
            <span className="nav-text">Overview</span>
          </button>
          <button className="nav-item">
            <span className="nav-icon"><Settings size={18} /></span>
            <span className="nav-text">Settings</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="comm-main">
        <header className="comm-header">
          <h2 className="title-execution">
            <Zap size={28} className="icon-lightning" /> 
            {activeTab === 'overview' ? (
              <>
                Daily Analytics 
                <span className="header-date"> — {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              </>
            ) : 'Live Status'}
          </h2>
        </header>

        {activeTab === 'dashboard' ? (
          <>
            <section className="live-execution">
              {liveExecutions.length > 0 ? (
                liveExecutions.map(exec => (
                  <div key={exec.id} className={`comm-card ${exec.status || ''}`}>
                    <div className="card-badge">{exec.type}</div>
                    <h4>{exec.title}</h4>
                    <p>{exec.description}</p>
                    <div className="card-actions">
                      <button className="btn-approve" onClick={() => send(`Approve ${exec.type}: ${exec.title}`)}>
                        {exec.type === 'RETRY' ? 'Retry All' : 'Approve'}
                      </button>
                      <button className="btn-dismiss" onClick={() => dismissExecution(exec.id)}>Dismiss</button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <CheckCircle2 size={40} />
                  <p>All scheduled transmissions completed.</p>
                </div>
              )}
            </section>

            <section className="execution-history">
              <div className="comm-section-title">LOG HISTORY</div>
              <div className="history-list">
                {executionHistory.length > 0 ? (
                  executionHistory.map(item => (
                    <div key={item.id} className="history-item">
                      <span className={`history-status-icon ${item.status === 'active' ? 'active' : ''}`}>
                        {item.status === 'success' ? <CheckCircle2 size={14} /> : <RotateCw size={14} />}
                      </span>
                      <div className="history-content">
                        <span className="history-text">{item.text}</span>
                        <span className="history-time">{item.time}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="history-empty">No activity logs recorded today.</div>
                )}
              </div>
            </section>
          </>
        ) : activeTab === 'gmail' ? (
          <div className="comm-view-container sync-view">
             <div className="sync-header">
                <h3>Gmail Sync Detail</h3>
                <div className="sync-status">ACTIVE</div>
             </div>
             
             <div className="sync-stats-grid">
                <div className="sync-stat-card">
                   <span className="label">Mail Sent</span>
                   <span className="value">142</span>
                   <div className="trend">+12% vs yesterday</div>
                </div>
                <div className="sync-stat-card">
                   <span className="label">Mail Received</span>
                   <span className="value">284</span>
                   <div className="trend">+5% vs yesterday</div>
                </div>
             </div>

             <div className="nurotra-briefing">
                <h4><Zap size={18} /> NUROTRA BRIEFING</h4>
                <div className="brief-content">
                   <div className="brief-item">
                      <p><strong>Urgent Focus:</strong> I found 3 high-priority emails from 'Venture Partners' regarding the new strategy. They are waiting for your approval.</p>
                   </div>
                   <div className="brief-item">
                      <p><strong>Missed Follow-up:</strong> No reply from 'Marketing Team' for the last 48 hours on the Q3 brief. Suggested action: Send a nudge.</p>
                   </div>
                   <div className="brief-item">
                      <p><strong>Pattern Spotted:</strong> Meeting requests are increasing on Fridays. Should I block the morning for deep work?</p>
                   </div>
                </div>
             </div>
          </div>
        ) : activeTab === 'overview' ? (
          <div className="comm-view-container">
            {digestData ? (
              <DigestDashboard data={digestData} />
            ) : (
              <div className="empty-state">
                <RotateCw size={40} className="spin" />
                <p>Generating daily insights...</p>
              </div>
            )}
          </div>
        ) : activeTab === 'inbox' ? (
          <div className="comm-view-container">
            <h3>Inbox Hub</h3>
            <p className="subtitle">Contextual messaging from all integrated platforms.</p>
            <div className="inbox-placeholder">
              <Mail size={48} className="icon-muted" />
              <p>Scanning accounts... No active threads.</p>
            </div>
          </div>
        ) : activeTab === 'contacts' ? (
          <div className="comm-view-container">
            <h3>User Directory</h3>
            <p className="subtitle">Manage stakeholders, teams, and bulk lists.</p>
            <button className="btn-action-primary" onClick={() => send("Show me my contacts")} style={{ marginTop: '20px' }}>
              Fetch Contact List
            </button>
          </div>
        ) : activeTab === 'meetings' ? (
           renderMeetings()
        ) : activeTab === 'campaigns' ? (
           renderCampaigns()
        ) : null}
      </main>

      {/* Right Chat Panel */}
      <div className="comm-chat-panel">
        <div className="chat-header">
           <div className="chat-header-left">
             <Zap size={18} className="icon-brand" />
             <span>Nurotra Outreach Agent</span>
           </div>
           <button className="back-to-agents" onClick={() => navigate('/agents')}>
             <ChevronLeft size={16} />
             <span>Back to Agents</span>
           </button>
        </div>
        <div className="chat-messages" ref={chatScrollRef}>
          {messages.length === 0 ? (
            <div className="chat-empty-state">
              <Info size={32} />
              <p>I'm ready to manage your communications. Try: <i>"Send an email to John"</i> or <i>"Show follow-up rules"</i></p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`msg-wrapper ${msg.role}`}>
                <div className={`chat-bubble ${msg.role}`}>
                  {msg.message || msg.content}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="msg-wrapper assistant">
              <div className="msg-bubble assistant loading">
                <RotateCw size={16} className="spin" /> Thinking...
              </div>
            </div>
          )}
          {error && (
            <div className="msg-wrapper system">
              <div className="msg-bubble error">
                {error}
              </div>
            </div>
          )}
        </div>

        <form className="chat-input-area" onSubmit={handleSend}>
          <input 
            type="text" 
            placeholder="Type a command or message..." 
            className="chat-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn-send" disabled={!inputText.trim() || loading}>
            <SendHorizontal size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default CommunicationAgentPage;

