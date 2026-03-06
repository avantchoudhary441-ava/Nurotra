import React from 'react';
import { FileText, TrendingUp, Search, Info, CheckCircle, BarChart2 } from 'lucide-react';
import DynamicGraph from './DynamicGraph';
import ReactMarkdown from 'react-markdown';

const AnalyticsHub = ({ data }) => {
    if (!data) return null;

    const {
        text,
        documentSummaries = [],
        keyInsights = {},
        comparativeAnalysis = {},
        dataTrends = {},
        generation = {},
        finalOutcome = {}
    } = data;

    const graph_config = generation.graph_config;

    return (
        <div className="analytics-hub-container animate-fade-in">
            <div className="analytics-header">
                <div className="analytics-header-left">
                    <BarChart2 className="analytics-main-icon pulse" size={24} />
                    <div>
                        <h1>Intelligence Report</h1>
                        <p>Advanced Multi-Document Synthesis & Insights</p>
                    </div>
                </div>
                <div className="analytics-badge premium-badge">Intelligence Active</div>
            </div>

            <div className="analytics-grid">
                {/* 1. Executive Narrative */}
                <div className="analytics-card main-narrative full-width">
                    <h3><Search size={16} /> Executive Narrative</h3>
                    <div className="narrative-content">
                        <ReactMarkdown>{text || "Analyzing documents..."}</ReactMarkdown>
                    </div>
                </div>

                {/* 2. Document Summaries */}
                <div className="analytics-card summaries-card">
                    <h3><FileText size={16} /> Document Summaries</h3>
                    <div className="summaries-list">
                        {documentSummaries.map((s, idx) => (
                            <div key={idx} className="summary-item-premium">
                                <div className="summary-doc-header">
                                    <FileText size={14} className="text-primary" />
                                    <strong>{s.name}</strong>
                                </div>
                                <p className="short-summary">{s.short}</p>
                                <ul className="detailed-bullets">
                                    {s.detailed?.map((bullet, bidx) => (
                                        <li key={bidx}>{bullet}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. Key Insights (Badges/Sentiment) */}
                <div className="analytics-card key-insights-card">
                    <h3><TrendingUp size={16} /> Intelligent Key Insights</h3>
                    <div className="insights-content">
                        <div className="insight-section">
                            <span className="insight-label">Sentiment Analysis</span>
                            <div className={`sentiment-badge ${keyInsights.sentiment?.toLowerCase()}`}>
                                {keyInsights.sentiment || "Neutral"}
                            </div>
                        </div>
                        <div className="insight-section">
                            <span className="insight-label">Key Themes & Topics</span>
                            <div className="keyword-cloud">
                                {keyInsights.keywords?.map((k, idx) => (
                                    <span key={idx} className="keyword-tag">{k}</span>
                                ))}
                                {keyInsights.topicClustering?.map((t, idx) => (
                                    <span key={idx} className="topic-tag">{t}</span>
                                ))}
                            </div>
                        </div>
                        {keyInsights.importantSections?.length > 0 && (
                            <div className="insight-section">
                                <span className="insight-label">Crucial Sections</span>
                                <ul className="section-list">
                                    {keyInsights.importantSections.map((sec, idx) => (
                                        <li key={idx}>{sec}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. Comparative Analysis (Table) */}
                {(comparativeAnalysis.similarities?.length > 0 || comparativeAnalysis.comparisonTable) && (
                    <div className="analytics-card comparative-card full-width">
                        <h3><Search size={16} /> Comparative Analysis</h3>
                        <div className="comp-grid">
                            <div className="sim-diff-box">
                                <strong>Similarities</strong>
                                <ul>{comparativeAnalysis.similarities?.map((s, i) => <li key={i}>{s}</li>)}</ul>
                            </div>
                            <div className="sim-diff-box">
                                <strong>Key Differences</strong>
                                <ul>{comparativeAnalysis.differences?.map((d, i) => <li key={i}>{d}</li>)}</ul>
                            </div>
                        </div>
                        {comparativeAnalysis.comparisonTable && (
                            <div className="comparison-table-wrapper">
                                <table className="premium-table">
                                    <thead>
                                        <tr>
                                            {comparativeAnalysis.comparisonTable.headers.map((h, i) => <th key={i}>{h}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {comparativeAnalysis.comparisonTable.rows.map((row, ri) => (
                                            <tr key={ri}>
                                                {row.map((cell, ci) => <td key={ci}>{cell}</td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* 5. Data Trends & Visualization */}
                <div className="analytics-card data-trends-card">
                    <h3><TrendingUp size={16} /> Data Trends & Metrics</h3>
                    <div className="metrics-grid-modern">
                        {Object.entries(dataTrends.metrics || {}).map(([l, v]) => (
                            <div key={l} className="metric-box-modern">
                                <span className="m-val">{v}</span>
                                <span className="m-label">{l}</span>
                            </div>
                        ))}
                    </div>
                    <ul className="trends-list">
                        {dataTrends.trends?.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                </div>

                {graph_config && (
                    <div className="analytics-card visualization-card">
                        <h3><BarChart2 size={16} /> Insights Visualization</h3>
                        <DynamicGraph config={graph_config} />
                    </div>
                )}
            </div>

            {/* Final Outcome HERO Section */}
            {finalOutcome.verdict && (
                <div className="final-outcome-hero">
                    <div className="outcome-icon">
                        <CheckCircle size={32} />
                    </div>
                    <div className="outcome-content">
                        <h2>Final Strategic Verdict</h2>
                        <p className="verdict-p">{finalOutcome.verdict}</p>
                        {finalOutcome.bestOption && (
                            <div className="best-option-box">
                                <strong>BEST OUTCOME / KEY INSIGHT:</strong>
                                <span>{finalOutcome.bestOption}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalyticsHub;
