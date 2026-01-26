import React, { useEffect, useState, useCallback } from "react";
import Sidebar from "../../components/Sidebar";
import "../../styles/dashboard.css";
import "../../styles/admin.css"; // Specialized styles
import BackgroundEffects from "../../components/BackgroundEffects";
import { useAuth } from "../../context/AuthContext";
import { adminService } from "../../services/apiService";
import { useLocation, useNavigate } from "react-router-dom";

export default function AdminDashboard() {
    const { logout } = useAuth();
    const location = useLocation();

    // Determine active panel from route
    const pathParts = location.pathname.split('/');
    const subRoute = pathParts[2] || "influencers";
    const activeTab = subRoute;

    const [stats, setStats] = useState({ funnel: {}, atRiskCount: 0, onboardingFunnel: [] });
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [showAtRiskOnly, setShowAtRiskOnly] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userTimeline, setUserTimeline] = useState([]);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [newNote, setNewNote] = useState("");
    const [globalStats, setGlobalStats] = useState({ onboardingFunnel: [] });

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const role = activeTab === "influencers" ? "influencer" : activeTab === "brands" ? "brand" : "";
            const [statsRes, usersRes, globalRes] = await Promise.all([
                adminService.getStats({ role }),
                adminService.getUsers({
                    status: filterStatus,
                    atRisk: showAtRiskOnly,
                    search,
                    role
                }),
                adminService.getStats({}) // Get everything (influencers + brands)
            ]);
            setStats(statsRes);
            setUsers(usersRes);
            setGlobalStats(globalRes);
        } catch (error) {
            console.error("Failed to fetch admin data:", error);
        } finally {
            setLoading(false);
        }
    }, [filterStatus, showAtRiskOnly, search, activeTab]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleFetchTimeline = async (user) => {
        setSelectedUser(user);
        setTimelineLoading(true);
        try {
            const timeline = await adminService.getUserTimeline(user._id);
            setUserTimeline(timeline);
        } catch (error) {
            console.error("Failed to fetch timeline");
        } finally {
            setTimelineLoading(false);
        }
    };

    const handleUpdateStatus = async (userId, newStatus) => {
        try {
            await adminService.updateUser(userId, { lifecycleStatus: newStatus });
            fetchData();
        } catch (error) {
            alert("Failed to update status");
        }
    };

    const getInactivityDays = (lastActivity) => {
        const diff = Date.now() - new Date(lastActivity).getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    };

    const handleSaveIntervention = async () => {
        try {
            if (newNote.trim()) {
                await adminService.addNote(selectedUser._id, { text: newNote, adminName: "Admin" });
            }
            await adminService.updateUser(selectedUser._id, {
                internalScores: selectedUser.internalScores
            });
            setNewNote("");
            setSelectedUser(null);
            fetchData();
        } catch (error) {
            alert("Failed to save changes");
        }
    };

    const FunnelDisplay = ({ data, title }) => {
        if (!data || data.length === 0) {
            return <div className="no-data-msg">Gathering live data for {title}...</div>;
        }

        return (
            <div className="onboarding-funnel">
                {data.map((step, i) => (
                    <div key={i} className="funnel-step">
                        <div className="step-bar" style={{
                            height: `${Math.max(4, (step.count / (data[0]?.count || 1)) * 180)}px`,
                            opacity: step.count === 0 ? 0.3 : 1
                        }}>
                            <span className="step-count">{step.count}</span>
                        </div>
                        <span className="step-label">{step.label}</span>
                        {i < data.length - 1 && step.count > 0 && (
                            <span className="drop-off">
                                ↓ {Math.round((1 - (data[i + 1].count / step.count)) * 100)}%
                            </span>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="influencer-dashboard">
            <BackgroundEffects />
            <Sidebar role="admin" />

            <div className="influencer-main no-header">
                {/* Header is now in Sidebar. Navbar removed to maximize space. */}

                <div className="admin-dashboard-container">
                    <div className="admin-view-header">
                        <h1>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Control Room</h1>
                        <p className="text-gray">Real-time monitoring and intervention engine</p>
                    </div>

                    {activeTab !== "analytics" ? (
                        <>
                            {/* Lifecycle Funnel */}
                            <div className="lifecycle-funnel-grid">
                                {Object.entries(stats.funnel).map(([label, count]) => (
                                    <div key={label} className="funnel-card" onClick={() => setFilterStatus(label === filterStatus ? "" : label)}>
                                        <span className={`count ${label === filterStatus ? "text-accent" : ""}`}>{count}</span>
                                        <span className="label">{label.replace("_", " ")}</span>
                                    </div>
                                ))}
                            </div>

                            {/* At Risk Banner */}
                            {stats.atRiskCount > 0 && (
                                <div className="at-risk-banner">
                                    <span>🚨 <strong>{stats.atRiskCount} Users At Risk</strong> (Dropout or Inactive)</span>
                                    <button
                                        className={`btn-small ${showAtRiskOnly ? "btn-active" : ""}`}
                                        onClick={() => setShowAtRiskOnly(!showAtRiskOnly)}
                                    >
                                        {showAtRiskOnly ? "Show All Users" : "Intervene Now"}
                                    </button>
                                </div>
                            )}

                            {/* Filters & Search */}
                            <div className="admin-controls-row">
                                <div className="search-box">
                                    <input
                                        type="text"
                                        placeholder={`Search ${activeTab}...`}
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                                    <option value="">All Stages</option>
                                    <option value="applied">Applied</option>
                                    <option value="onboarded">Onboarded</option>
                                    <option value="activated">Activated</option>
                                    <option value="brand_viewed">Brand Viewed</option>
                                    <option value="outreach_sent">Outreach Sent</option>
                                    <option value="brand_responded">Brand Replied</option>
                                    <option value="collab_in_progress">Active Collab</option>
                                    <option value="collab_completed">Completed</option>
                                </select>
                            </div>

                            {/* User Table */}
                            <div className="admin-table-container">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>User</th>
                                            <th>Stage</th>
                                            <th>Onboarding</th>
                                            <th>Last Activity</th>
                                            <th>Quality Index</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((u, i) => (
                                            <tr key={u._id}> <td>{i + 1}</td>
                                                <td>
                                                    <div className="user-info-cell">
                                                        <img src={u.profileImg || "/default-avatar.png"} alt="" className="avatar-small" />
                                                        <div>
                                                            <strong>{u.name}</strong>
                                                            <span className="text-gray">{u.email}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`status-badge status-${u.lifecycleStatus}`}>
                                                        {u.lifecycleStatus.replace("_", " ")}
                                                    </span>
                                                    {getInactivityDays(u.lastActivityAt) >= 2 && <span className="risk-tag">At Risk</span>}
                                                </td>
                                                <td>
                                                    <div className="onboarding-dots">
                                                        {Object.entries(u.onboardingProgress || {}).map(([step, done]) => (
                                                            <span key={step} className={`dot ${done ? "done" : ""}`} title={step} />
                                                        ))}
                                                    </div>
                                                </td>
                                                <td>{getInactivityDays(u.lastActivityAt)}d ago</td>
                                                <td>
                                                    <div className="score-stack">
                                                        <span className="score-label">REL: {u.internalScores?.reliability || 0}</span>
                                                        <div className="score-bar"><div style={{ width: `${u.internalScores?.reliability || 0}%` }} /></div>
                                                        <span className="score-label">RES: {u.internalScores?.responsiveness || 0}</span>
                                                        <div className="score-bar"><div style={{ width: `${u.internalScores?.responsiveness || 0}%` }} /></div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <button className="btn-icon" title="View Timeline" onClick={() => handleFetchTimeline(u)}>🕒</button>
                                                    <button className="btn-icon" title="Add Note" onClick={() => setSelectedUser(u)}>📝</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <div className="analytics-view">
                            <div className="analytics-grid-three">
                                <div className="analytics-card full-width combined-card">
                                    <h3>Total Platform Lifecycle (Combined)</h3>
                                    <FunnelDisplay data={globalStats.combinedFunnel} title="Total Platform" />
                                </div>
                                <div className="analytics-card brand-card">
                                    <h3>Brand Lifecycle Funnel</h3>
                                    <FunnelDisplay data={globalStats.brandFunnel} title="Brands" />
                                </div>
                                <div className="analytics-card influencer-card">
                                    <h3>Influencer Lifecycle Funnel</h3>
                                    <FunnelDisplay data={globalStats.influencerFunnel} title="Influencers" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Intervention & Timeline Modal */}
                    {selectedUser && (
                        <div className="admin-modal-overlay">
                            <div className="admin-modal wide-modal">
                                <div className="modal-header">
                                    <h3>Intervene: {selectedUser.name}</h3>
                                    <button className="close-btn" onClick={() => { setSelectedUser(null); setUserTimeline([]); }}>×</button>
                                </div>
                                <div className="modal-content-grid">
                                    <div className="intervention-panel">
                                        <div className="score-inputs">
                                            <label>Reliability Score (0-100)
                                                <input
                                                    type="number"
                                                    value={selectedUser.internalScores?.reliability || 0}
                                                    onChange={(e) => setSelectedUser({ ...selectedUser, internalScores: { ...selectedUser.internalScores, reliability: e.target.value } })}
                                                />
                                            </label>
                                            <label>Responsiveness (0-100)
                                                <input
                                                    type="number"
                                                    value={selectedUser.internalScores?.responsiveness || 0}
                                                    onChange={(e) => setSelectedUser({ ...selectedUser, internalScores: { ...selectedUser.internalScores, responsiveness: e.target.value } })}
                                                />
                                            </label>
                                        </div>
                                        <div className="notes-section">
                                            <h4>Admin Notes</h4>
                                            <div className="notes-list">
                                                {(selectedUser.adminNotes || []).map((n, i) => (
                                                    <div key={i} className="note-card">
                                                        <p>{n.text}</p>
                                                        <small>{new Date(n.createdAt).toLocaleDateString()} - {n.adminName}</small>
                                                    </div>
                                                ))}
                                            </div>
                                            <textarea
                                                placeholder="Add a private internal note..."
                                                value={newNote}
                                                onChange={(e) => setNewNote(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="timeline-panel">
                                        <h4>Activity Timeline</h4>
                                        {timelineLoading ? (
                                            <div className="loader-small">Loading timeline...</div>
                                        ) : (
                                            <div className="timeline-list">
                                                {userTimeline.length > 0 ? userTimeline.map((log, i) => (
                                                    <div key={i} className="timeline-item">
                                                        <span className="time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                                        <span className={`event-badge ${log.eventType}`}>{log.eventType.replace("_", " ")}</span>
                                                        <p className="meta">{JSON.stringify(log.metadata)}</p>
                                                    </div>
                                                )) : <p>No events logged yet.</p>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button onClick={() => { setSelectedUser(null); setUserTimeline([]); }}>Cancel</button>
                                    <button className="btn-primary" onClick={handleSaveIntervention}>Save Changes</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
