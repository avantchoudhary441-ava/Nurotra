import React from 'react';
import PentagonGraph from '../../components/dashboard/PentagonGraph';
import InsightPanel from '../../components/dashboard/InsightPanel';
import ScoreCard from '../../components/dashboard/ScoreCard';
import Sidebar from '../../components/Sidebar';
import MobileNav from '../../components/MobileNav';
import MobileInsightCard from '../../components/mobile/MobileInsightCard'; // New Import
import '../../styles/dashboard.css';
import '../../styles/overview.css';

export default function Overview() {
    // Mock Data for "Not Created Yet" state
    const userData = {
        profile: 75,
        professionalism: 88,
        collab: 60,
        reliability: 92,
        growth: 85
    };

    const overallScore = Math.round(
        (userData.profile + userData.professionalism + userData.collab + userData.reliability + userData.growth) / 5
    );

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

    // Identify Top Insight for Mobile Hero
    const topInsight = insights[0];

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

    // Theme State
    const [theme, setTheme] = React.useState(localStorage.getItem('theme') || 'dark');

    React.useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    return (
        <div className="influencer-dashboard">
            <Sidebar role="influencer" />

            <div className="overview-container">
                <header className="overview-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div>
                            <h1>Professional DNA</h1>
                            <p className="overview-subtitle">Your analytical diagnostic scan</p>
                        </div>
                    </div>

                    <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle Theme">
                        {theme === 'light' ? '🌙' : '☀️'}
                    </button>
                </header>

                {/* Responsive Layout Strategy: 
                    2. Hero Insight (Always visible or adaptive)
                    3. Graph Section (Stacked on mobile)
                    4. Score List (Adaptive)
                */}

                <div className="dashboard-content-wrapper">
                    {/* Mobile Hero - Excellent summary, keep it but let it flow */}
                    <div className="mobile-hero-wrapper">
                        <MobileInsightCard overallScore={overallScore} topInsight={topInsight} />
                    </div>

                    <div className="overview-main-grid">
                        {/* Left: Graph & DNA Visualization */}
                        <div className="overview-graph-section">
                            <div className="graph-card">
                                <PentagonGraph userData={userData} averageData={averageData} />
                            </div>
                            <div className="insight-section">
                                <InsightPanel insights={insights} />
                            </div>
                        </div>

                        {/* Right: Detailed Score Cards */}
                        <div className="overview-scores-section">
                            <h3>Dimensions</h3>
                            {/* Detailed Cards for larger screens */}
                            <div className="scores-list desktop-scores">
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

                            {/* Compact List for smaller screens (Better UX but same data) */}
                            <div className="mobile-score-list mobile-scores">
                                {scores.map((s) => {
                                    const val = userData[s.key];
                                    let statusColor = val >= 80 ? '#4ade80' : val >= 60 ? '#facc15' : '#f87171';
                                    return (
                                        <div key={s.key} className="mobile-score-row">
                                            <div className="ms-icon" style={{ backgroundColor: `${statusColor}20`, color: statusColor }}>●</div>
                                            <div className="ms-content">
                                                <div className="ms-title">{s.title.replace(' Score', '')}</div>
                                                <div className="ms-sub">{s.history.label}</div>
                                            </div>
                                            <div className="ms-val">{val}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
