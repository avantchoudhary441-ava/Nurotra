import React from 'react';
import PentagonGraph from '../../components/dashboard/PentagonGraph';
import InsightPanel from '../../components/dashboard/InsightPanel';
import ScoreCard from '../../components/dashboard/ScoreCard';
import Sidebar from '../../components/Sidebar';
import '../../styles/dashboard.css';
import '../../styles/overview.css';

export default function Overview() {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

    // Mock Data for "Not Created Yet" state
    const userData = {
        profile: 75,
        professionalism: 88,
        collab: 60,
        reliability: 92,
        growth: 85
    };

    const averageData = {
        profile: 65,
        professionalism: 70,
        collab: 65,
        reliability: 75,
        growth: 60
    };

    const insights = [
        {
            category: 'Profile',
            text: 'Improving your Profile Quality could increase match accuracy by 23%',
            impact: 23,
            actionLabel: 'Enhance Profile'
        },
        {
            category: 'Growth',
            text: 'Your high Reliability score makes you attractive to premium brands.',
            actionLabel: 'View Opportunities'
        },
        {
            category: 'Collab',
            text: 'Uploading past deliverables can boost Collab Performance score.',
            actionLabel: 'Upload Work'
        }
    ];

    const scores = [
        {
            key: 'profile',
            title: 'Profile Quality Score',
            subtitle: 'How clearly your professional identity is defined',
            info: 'Based on profile completeness, clarity of bio, and portfolio quality.',
            history: { trend: 'up', label: '+5% this week' }
        },
        {
            key: 'professionalism',
            title: 'Professionalism Score',
            subtitle: 'Communication maturity & client comfort',
            info: 'Evaluated based on response tone, timeliness, and interaction patterns.',
            history: { trend: 'stable', label: 'Stable' }
        },
        {
            key: 'collab',
            title: 'Collab Performance Score',
            subtitle: 'Execution proof & alignment accuracy',
            info: 'Derived from deliverables quality, feedback loops, and campaign completion.',
            history: { trend: 'down', label: 'Needs attention' }
        },
        {
            key: 'reliability',
            title: 'Reliability Score',
            subtitle: 'Risk level & operational maturity',
            info: 'Reflects consistency in meeting deadlines and availability.',
            history: { trend: 'up', label: 'Reliability improving' }
        },
        {
            key: 'growth',
            title: 'Growth Potential Score',
            subtitle: 'AI-predicted potential',
            info: 'Forward-looking metric predicting future success based on current trajectory.',
            history: { trend: 'up', label: 'High Potential' }
        }
    ];

    return (
        <div className="influencer-dashboard">
            <Sidebar
                role="influencer"
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            <div className="overview-container">
                <header className="overview-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <button
                            className="mobile-menu-btn"
                            onClick={() => setIsSidebarOpen(true)}
                        >
                            ☰
                        </button>
                        <div>
                            <h1>Professional DNA</h1>
                            <p className="overview-subtitle">Your analytical diagnostic scan</p>
                        </div>
                    </div>
                </header>

                <div className="overview-main-grid">
                    {/* Left: Graph & DNA Visualization */}
                    <div className="overview-graph-section">
                        <div className="graph-card">
                            <PentagonGraph userData={userData} averageData={averageData} />
                        </div>
                        {/* Insight Panel under the graph as requested */}
                        <div className="insight-section">
                            <InsightPanel insights={insights} />
                        </div>
                    </div>

                    {/* Right: Detailed Score Cards */}
                    <div className="overview-scores-section">
                        <h3>Dimensions</h3>
                        <div className="scores-list">
                            {scores.map((s, i) => (
                                <ScoreCard
                                    key={s.key}
                                    title={s.title}
                                    subtitle={s.subtitle}
                                    info={s.info}
                                    score={userData[s.key]}
                                    history={s.history}
                                    delay={i * 0.1}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
