import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNuroCore } from '../../context/NuroCoreContext';
import { profileService, nuroService } from '../../services/apiService';
import PentagonGraph from '../../components/dashboard/PentagonGraph';
import InsightPanel from '../../components/dashboard/InsightPanel';
import ScoreCard from '../../components/dashboard/ScoreCard';
import Sidebar from '../../components/Sidebar';
import MobileInsightCard from '../../components/mobile/MobileInsightCard';
import ProfileEnhancer from '../../components/ProfileEnhancer';
import MatchFlowModal from '../../components/dashboard/MatchFlowModal';
import CurrencySelector from '../../components/CurrencySelector';
import ErrorBoundary from '../../components/ErrorBoundary';
import '../../styles/dashboard.css';
import '../../styles/overview.css';

export default function Overview() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { memory, loading: nuroLoading } = useNuroCore();
    const role = location.pathname.includes('/influencer') ? 'influencer' : 'brand';

    // Map Real Data from Nuro Memory
    const userData = React.useMemo(() => {
        if (!memory?.metrics) {
            return {
                profile: 50,
                professionalism: 50,
                collab: 50,
                reliability: 50,
                growth: 50
            };
        }
        return {
            profile: Math.round(memory.metrics.trustIndex || 50),
            professionalism: Math.round(memory.metrics.communicationClarity || 50),
            collab: Math.round(memory.metrics.experienceIndex || 50),
            reliability: Math.round(memory.metrics.reliabilityScore || 50),
            growth: Math.round(memory.metrics.compatibilityScore || 50)
        };
    }, [memory]);

    const averageData = {
        profile: 65,
        professionalism: 70,
        collab: 65,
        reliability: 75,
        growth: 60
    };

    // -----------------------------------
    // ROLE-SPECIFIC CONFIGURATION
    // -----------------------------------
    const dashboardConfig = {
        influencer: {
            title: "Professional DNA",
            subtitle: "Your analytical diagnostic scan",
            metrics: [
                {
                    key: 'profile',
                    title: 'Profile Quality Score',
                    subtitle: 'How clearly your professional identity is defined',
                    info: 'Based on profile completeness, clarity of bio, and portfolio quality.',
                    history: { trend: 'up', label: '+12% growth' }
                },
                {
                    key: 'professionalism',
                    title: 'Professionalism Score',
                    subtitle: 'Communication maturity & client comfort',
                    info: 'Evaluated based on response tone, timeliness, and interaction patterns.',
                    history: { trend: 'stable', label: 'Very Stable' }
                },
                {
                    key: 'collab',
                    title: 'Collab Performance Score',
                    subtitle: 'Execution proof & alignment accuracy',
                    info: 'Derived from deliverables quality, feedback loops, and campaign completion.',
                    history: { trend: 'up', label: '+8% improvement' }
                },
                {
                    key: 'reliability',
                    title: 'Reliability Score',
                    subtitle: 'Risk level & operational maturity',
                    info: 'Reflects consistency in meeting deadlines and availability.',
                    history: { trend: 'up', label: 'Risk level: Low' }
                },
                {
                    key: 'growth',
                    title: 'Growth Potential Score',
                    subtitle: 'AI-predicted potential',
                    info: 'Forward-looking metric predicting future success based on current trajectory.',
                    history: { trend: 'up', label: 'High Potential' }
                }
            ],
            insights: [
                {
                    category: 'Strength',
                    text: 'Your high Reliability score makes you extremely attractive to premium brands.',
                    impact: 15,
                    actionLabel: 'Match Flow'
                },
                {
                    category: 'Weakness',
                    text: 'Lower Collab Performance detected. Uploading recent deliverables will boost this.',
                    impact: 22,
                    actionLabel: 'Upload Work'
                },
                {
                    category: 'Improvement',
                    text: 'Refining your Profile Bio could increase match accuracy by 18%.',
                    impact: 18,
                    actionLabel: 'Enhance Profile'
                }
            ]
        },
        brand: {
            title: "Brand Authority Scan",
            subtitle: "Strategic analytical footprint",
            metrics: [
                {
                    key: 'profile',
                    title: 'Brand Identity Score',
                    subtitle: 'Clarity of mission & market positioning',
                    info: 'Based on brand story, website clarity, and consistency of messaging.',
                    history: { trend: 'up', label: 'Strong Presence' }
                },
                {
                    key: 'professionalism',
                    title: 'Communication Maturity',
                    subtitle: 'Brief clarity & partner management',
                    info: 'Evaluated based on the clarity of your campaign briefs and response times.',
                    history: { trend: 'stable', label: 'Professional' }
                },
                {
                    key: 'collab',
                    title: 'Partner Synergy Score',
                    subtitle: 'Relationship health & collab success',
                    info: 'Derived from past influencer interactions and successful campaign closures.',
                    history: { trend: 'up', label: 'Highly Synergistic' }
                },
                {
                    key: 'reliability',
                    title: 'Operational Maturity',
                    subtitle: 'Payment timeliness & project pacing',
                    info: 'Reflects consistency in honoring contract terms and scheduling.',
                    history: { trend: 'up', label: 'Efficient' }
                },
                {
                    key: 'growth',
                    title: 'Market Impact Score',
                    subtitle: 'AI-predicted campaign reach',
                    info: 'Predicts the potential success of your future campaigns based on current metrics.',
                    history: { trend: 'up', label: 'High Potential' }
                }
            ],
            insights: [
                {
                    category: 'Strength',
                    text: 'Strong Brand Identity detected. This attracts high-tier professional creators.',
                    impact: 20,
                    actionLabel: 'Match Flow'
                },
                {
                    category: 'Weakness',
                    text: 'Communication Maturity is lower than average. Clearer briefs shorten lead times.',
                    impact: 12,
                    actionLabel: 'Enhance Briefs'
                },
                {
                    category: 'Improvement',
                    text: 'Improving Operational Maturity (response speed) will increase partner trust.',
                    impact: 25,
                    actionLabel: 'Review Settings'
                }
            ]
        }
    };

    const currentConfig = dashboardConfig[role] || dashboardConfig.influencer;
    const scores = currentConfig.metrics;
    const insights = currentConfig.insights;

    const overallScore = memory?.trustSnapshot?.compositeScore || Math.round(
        (userData.profile + userData.professionalism + userData.collab + userData.reliability + userData.growth) / 5
    );

    const topInsight = insights[0];

    // Theme State
    const [theme, setTheme] = React.useState(localStorage.getItem('theme') || 'dark');
    const [profile, setProfile] = React.useState(null);
    const [showEnhancer, setShowEnhancer] = React.useState(false);
    const [showMatchFlow, setShowMatchFlow] = React.useState(false);

    React.useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    // Fetch Profile for Enhancer context
    React.useEffect(() => {
        const fetchProfile = async () => {
            if (user?.token) {
                try {
                    const data = role === 'influencer'
                        ? await profileService.getInfluencer(user.token)
                        : await profileService.getBrand(user.token);
                    setProfile(data);
                } catch (err) {
                    console.error("Failed to fetch profile for DNA", err);
                }
            }
        };
        fetchProfile();
    }, [user, role]);

    if (nuroLoading) {
        return (
            <div className="influencer-dashboard" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white' }}>
                <div className="nuro-loader">Scanning Neural Patterns...</div>
            </div>
        );
    }

    return (
        <div className="influencer-dashboard">
            {/* PROFILE ENHANCER MODAL */}
            {showEnhancer && (
                <ErrorBoundary>
                    <ProfileEnhancer
                        profileData={profile || user}
                        onClose={() => setShowEnhancer(false)}
                    />
                </ErrorBoundary>
            )}

            {/* MATCH FLOW MODAL */}
            <MatchFlowModal
                isOpen={showMatchFlow}
                onClose={() => setShowMatchFlow(false)}
                role={role}
            />

            <Sidebar role={role} />

            <div className="overview-container">
                <header className="overview-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div>
                            <h1>{currentConfig.title}</h1>
                            <p className="overview-subtitle">{currentConfig.subtitle}</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <CurrencySelector />
                        <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle Theme">
                            {theme === 'light' ? '🌙' : '☀️'}
                        </button>
                    </div>
                </header>

                <div className="dashboard-content-wrapper">
                    {/* Mobile Hero */}
                    <div className="mobile-hero-wrapper">
                        <MobileInsightCard
                            overallScore={overallScore}
                            topInsight={topInsight}
                            role={role}
                            onEnhance={() => setShowEnhancer(true)}
                        />
                    </div>

                    <div className="overview-main-grid">
                        {/* Left: Graph & DNA Visualization */}
                        <div className="overview-graph-section">
                            <div className="graph-card">
                                <PentagonGraph userData={userData} averageData={averageData} />
                            </div>
                            <div className="insight-section">
                                <InsightPanel
                                    role={role}
                                    insights={insights}
                                    onAction={(label) => {
                                        if (label.includes("Enhance")) setShowEnhancer(true);
                                        else if (label.includes("Upload")) navigate(`/${role}/deliverables`);
                                        else if (label.includes("Match")) setShowMatchFlow(true);
                                    }}
                                />
                            </div>
                        </div>

                        {/* Right: Detailed Score Cards */}
                        <div className="overview-scores-section">
                            <h3>Dimensions</h3>
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

                            <div className="mobile-score-list mobile-scores">
                                {scores.map((s) => {
                                    const val = userData[s.key];
                                    let statusColor = val >= 80 ? '#4ade80' : val >= 60 ? '#facc15' : '#f87171';
                                    return (
                                        <div key={s.key} className="mobile-score-row">
                                            <div className="ms-icon" style={{ backgroundColor: `${statusColor}20`, color: statusColor }}>●</div>
                                            <div className="ms-content">
                                                <div className="ms-title">{s.title.replace(' Score', '').replace(' Maturity', '')}</div>
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
