import React, { useState } from 'react';
import {
    FileText, TrendingUp, Search, Info, CheckCircle, BarChart2,
    AlertTriangle, Shield, Users, MapPin, Calendar, DollarSign,
    Tag, Heart, Lightbulb, Download, ChevronDown, ChevronUp, X
} from 'lucide-react';

const Section = ({ icon, title, children, defaultOpen = true }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="analytics-section-card">
            <button className="analytics-section-header" onClick={() => setOpen(o => !o)}>
                <span className="analytics-section-title">{icon} {title}</span>
                {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {open && <div className="analytics-section-body">{children}</div>}
        </div>
    );
};

const BadgePill = ({ text, color = '#1890ff' }) => (
    <span className="badge-pill" style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>{text}</span>
);

const AnalyticsHub = ({ data, onClose, wordReportBuffer, wordReportName }) => {
    if (!data) return null;

    const meta = data._meta || {};
    const docsAnalyzed = meta.docsAnalyzed || [];
    const analysisType = meta.analysisType || 'DEFAULT';
    const isMultiDoc = docsAnalyzed.length > 1;

    // Download the Word report from the base64 buffer sent by the backend
    const handleDownload = () => {
        if (!wordReportBuffer) return;
        try {
            const byteChars = atob(wordReportBuffer);
            const byteArr = new Uint8Array(byteChars.length).map((_, i) => byteChars.charCodeAt(i));
            const blob = new Blob([byteArr], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = wordReportName || 'Analysis_Report.docx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Download failed:', e);
        }
    };

    const {
        executiveSummary,
        documentOverview = [],
        topicsAndThemes = {},
        keywords = {},
        entities = {},
        sentimentAnalysis,
        informationExtraction,
        comparativeAnalysis,
        riskAndCompliance,
        insights = [],
        patterns = {},
        metadata = []
    } = data;

    return (
        <div className="analytics-hub-container animate-fade-in">
            {/* ── Header ── */}
            <div className="analytics-header">
                <div className="analytics-header-left">
                    <BarChart2 className="analytics-main-icon pulse" size={24} />
                    <div>
                        <h1>Intelligence Report</h1>
                        <p>{isMultiDoc ? `Multi-Document Analysis · ${docsAnalyzed.length} docs` : 'Document Analysis'} · {analysisType}</p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="analytics-badge premium-badge">Intelligence Active</div>
                    {onClose && (
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Source Documents ── */}
            {docsAnalyzed.length > 0 && (
                <div className="analytics-source-docs">
                    <span className="source-docs-label">📂 Analyzed:</span>
                    {docsAnalyzed.map((d, i) => (
                        <span key={i} className="source-doc-chip">
                            <FileText size={11} /> {d.name} <span className="source-tag">{d.source === 'sidebar' ? 'Workspace' : 'Uploaded'}</span>
                        </span>
                    ))}
                </div>
            )}

            <div className="analytics-grid">

                {/* 1. Executive Summary */}
                {executiveSummary && (
                    <Section icon="📋" title="Executive Summary" defaultOpen={true}>
                        <p className="analytics-summary-short">{executiveSummary.short}</p>
                        {(executiveSummary.detailed || []).length > 0 && (
                            <ul className="analytics-bullet-list">
                                {executiveSummary.detailed.map((b, i) => <li key={i}>{b}</li>)}
                            </ul>
                        )}
                    </Section>
                )}

                {/* 2. Document Overview */}
                {documentOverview.length > 0 && (
                    <Section icon="📄" title="Document Overview">
                        {documentOverview.map((doc, i) => (
                            <div key={i} className="analytics-doc-overview-card">
                                <p className="doc-ov-name"><FileText size={12} /> <strong>{doc.name}</strong></p>
                                <p className="doc-ov-meta">{doc.classification} · {doc.language} · ~{doc.estimatedLength || doc.pageEstimate}</p>
                                <p className="doc-ov-purpose">{doc.purpose}</p>
                            </div>
                        ))}
                    </Section>
                )}

                {/* 3. Topics & Themes */}
                {(topicsAndThemes.mainTopics?.length > 0 || topicsAndThemes.keyFindings?.length > 0) && (
                    <Section icon="💡" title="Topics & Themes">
                        {topicsAndThemes.mainTopics?.length > 0 && (
                            <div className="analytics-tag-group">
                                <p className="analytics-sublabel">Main Topics</p>
                                <div className="analytics-tags">
                                    {topicsAndThemes.mainTopics.map((t, i) => <BadgePill key={i} text={t} color="#1890ff" />)}
                                </div>
                            </div>
                        )}
                        {topicsAndThemes.subThemes?.length > 0 && (
                            <div className="analytics-tag-group">
                                <p className="analytics-sublabel">Sub-Themes</p>
                                <div className="analytics-tags">
                                    {topicsAndThemes.subThemes.map((t, i) => <BadgePill key={i} text={t} color="#722ed1" />)}
                                </div>
                            </div>
                        )}
                        {topicsAndThemes.keyFindings?.length > 0 && (
                            <ul className="analytics-bullet-list">
                                {topicsAndThemes.keyFindings.map((f, i) => <li key={i}>{f}</li>)}
                            </ul>
                        )}
                    </Section>
                )}

                {/* 4. Keywords */}
                {(keywords.primary?.length > 0 || keywords.keyPhrases?.length > 0) && (
                    <Section icon="🔑" title="Keyword Analysis">
                        {keywords.primary?.length > 0 && (
                            <div className="analytics-tag-group">
                                <p className="analytics-sublabel">Primary Keywords</p>
                                <div className="analytics-tags">
                                    {keywords.primary.map((k, i) => <BadgePill key={i} text={k} color="#13c2c2" />)}
                                </div>
                            </div>
                        )}
                        {keywords.keyPhrases?.length > 0 && (
                            <div className="analytics-tag-group">
                                <p className="analytics-sublabel">Key Phrases</p>
                                <div className="analytics-tags">
                                    {keywords.keyPhrases.map((k, i) => <BadgePill key={i} text={k} color="#fa8c16" />)}
                                </div>
                            </div>
                        )}
                    </Section>
                )}

                {/* 5. Entity Extraction */}
                {entities && Object.values(entities).some(v => v?.length > 0) && (
                    <Section icon="🏷️" title="Entity Extraction (NER)">
                        <div className="analytics-entity-grid">
                            {entities.people?.length > 0 && (
                                <div className="entity-group">
                                    <p className="entity-group-label"><Users size={12} /> People</p>
                                    {entities.people.map((e, i) => <p key={i} className="entity-item">{e}</p>)}
                                </div>
                            )}
                            {entities.organizations?.length > 0 && (
                                <div className="entity-group">
                                    <p className="entity-group-label">🏢 Organizations</p>
                                    {entities.organizations.map((e, i) => <p key={i} className="entity-item">{e}</p>)}
                                </div>
                            )}
                            {entities.locations?.length > 0 && (
                                <div className="entity-group">
                                    <p className="entity-group-label"><MapPin size={12} /> Locations</p>
                                    {entities.locations.map((e, i) => <p key={i} className="entity-item">{e}</p>)}
                                </div>
                            )}
                            {entities.dates?.length > 0 && (
                                <div className="entity-group">
                                    <p className="entity-group-label"><Calendar size={12} /> Dates</p>
                                    {entities.dates.map((e, i) => <p key={i} className="entity-item">{e}</p>)}
                                </div>
                            )}
                            {entities.financialValues?.length > 0 && (
                                <div className="entity-group">
                                    <p className="entity-group-label"><DollarSign size={12} /> Financial</p>
                                    {entities.financialValues.map((e, i) => <p key={i} className="entity-item">{e}</p>)}
                                </div>
                            )}
                            {entities.technologies?.length > 0 && (
                                <div className="entity-group">
                                    <p className="entity-group-label">⚙️ Technologies</p>
                                    {entities.technologies.map((e, i) => <p key={i} className="entity-item">{e}</p>)}
                                </div>
                            )}
                        </div>
                    </Section>
                )}

                {/* 6. Sentiment */}
                {sentimentAnalysis && (
                    <Section icon="💬" title="Sentiment & Tone Analysis">
                        <div className="sentiment-overview">
                            <div className={`sentiment-badge ${sentimentAnalysis.overall?.toLowerCase()}`}>{sentimentAnalysis.overall}</div>
                            <span className="sentiment-score">Score: {sentimentAnalysis.score}/100</span>
                            <span className="sentiment-tone">Tone: {sentimentAnalysis.tone}</span>
                        </div>
                        {sentimentAnalysis.breakdown && (
                            <div className="sentiment-bar-group">
                                {Object.entries(sentimentAnalysis.breakdown).map(([k, v]) => (
                                    <div key={k} className="sentiment-bar-row">
                                        <span className="sentiment-bar-label">{k}</span>
                                        <div className="sentiment-bar-track">
                                            <div className={`sentiment-bar-fill sb-${k}`} style={{ width: `${v}%` }} />
                                        </div>
                                        <span className="sentiment-bar-pct">{v}%</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Section>
                )}

                {/* 7. Information Extraction */}
                {informationExtraction?.structuredData?.length > 0 && (
                    <Section icon="📊" title="Information Extraction">
                        <table className="analytics-table">
                            <thead><tr><th>Field</th><th>Value</th><th>Confidence</th></tr></thead>
                            <tbody>
                                {informationExtraction.structuredData.map((row, i) => (
                                    <tr key={i}>
                                        <td>{row.field}</td>
                                        <td>{row.value}</td>
                                        <td><BadgePill text={row.confidence} color={row.confidence === 'High' ? '#52c41a' : row.confidence === 'Medium' ? '#fa8c16' : '#ff4d4f'} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Section>
                )}

                {/* 8. Comparative Analysis (multi-doc) */}
                {isMultiDoc && comparativeAnalysis && (
                    <Section icon="⚖️" title="Comparative Analysis">
                        {comparativeAnalysis.similarities?.length > 0 && (
                            <>
                                <p className="analytics-sublabel">✅ Similarities</p>
                                <ul className="analytics-bullet-list">
                                    {comparativeAnalysis.similarities.map((s, i) => <li key={i}>{s}</li>)}
                                </ul>
                            </>
                        )}
                        {comparativeAnalysis.differences?.length > 0 && (
                            <>
                                <p className="analytics-sublabel">🔄 Key Differences</p>
                                <ul className="analytics-bullet-list">
                                    {comparativeAnalysis.differences.map((d, i) => <li key={i}>{d}</li>)}
                                </ul>
                            </>
                        )}
                        {comparativeAnalysis.contradictions?.length > 0 && (
                            <>
                                <p className="analytics-sublabel">⚠️ Contradictions</p>
                                <ul className="analytics-bullet-list">
                                    {comparativeAnalysis.contradictions.map((c, i) => <li key={i}>{c}</li>)}
                                </ul>
                            </>
                        )}
                    </Section>
                )}

                {/* 9. Risks */}
                {(riskAndCompliance?.risks?.length > 0 || riskAndCompliance?.sensitiveData?.length > 0) && (
                    <Section icon="🛡️" title="Risk & Compliance">
                        {riskAndCompliance.risks?.map((r, i) => (
                            <div key={i} className={`risk-card risk-${r.severity?.toLowerCase()}`}>
                                <AlertTriangle size={14} />
                                <div>
                                    <p className="risk-label">[{r.severity}] {r.risk}</p>
                                    {r.location && <p className="risk-context">{r.location}</p>}
                                </div>
                            </div>
                        ))}
                        {riskAndCompliance.sensitiveData?.map((s, i) => (
                            <div key={i} className="risk-card risk-medium">
                                <Shield size={14} />
                                <p className="risk-label">Sensitive: {s}</p>
                            </div>
                        ))}
                    </Section>
                )}

                {/* 10. Key Insights */}
                {insights.length > 0 && (
                    <Section icon="🔍" title="Key Insights" defaultOpen={true}>
                        {insights.map((ins, i) => (
                            <div key={i} className={`insight-card insight-${ins.importance?.toLowerCase()}`}>
                                <Lightbulb size={14} className="insight-icon" />
                                <div>
                                    <p className="insight-type">{ins.type} · <span className="insight-importance">{ins.importance}</span></p>
                                    <p className="insight-text">{ins.insight}</p>
                                </div>
                            </div>
                        ))}
                    </Section>
                )}

                {/* 11. Patterns */}
                {(patterns.recurringKeywords?.length > 0 || patterns.recurringThemes?.length > 0) && (
                    <Section icon="🔄" title="Pattern Detection">
                        {patterns.recurringKeywords?.length > 0 && (
                            <div className="analytics-tag-group">
                                <p className="analytics-sublabel">Recurring Keywords</p>
                                <div className="analytics-tags">
                                    {patterns.recurringKeywords.map((k, i) => <BadgePill key={i} text={k} color="#eb2f96" />)}
                                </div>
                            </div>
                        )}
                        {patterns.recurringThemes?.length > 0 && (
                            <ul className="analytics-bullet-list">
                                {patterns.recurringThemes.map((t, i) => <li key={i}>{t}</li>)}
                            </ul>
                        )}
                    </Section>
                )}

                {/* 12. Metadata */}
                {metadata.length > 0 && (
                    <Section icon="📁" title="Document Metadata" defaultOpen={false}>
                        {metadata.map((m, i) => (
                            <div key={i} className="analytics-meta-row">
                                <strong>{m.docName}</strong> — {m.detectedType} · {m.language} · {m.estimatedLength}
                            </div>
                        ))}
                    </Section>
                )}
            </div>

            {/* Download + timestamp */}
            <div className="analytics-footer">
                {wordReportBuffer && (
                    <button className="analytics-download-btn" onClick={handleDownload}>
                        <Download size={14} />
                        <span>Download Word Report</span>
                        <span className="analytics-download-name">({wordReportName || 'Analysis_Report.docx'})</span>
                    </button>
                )}
                <span className="analytics-timestamp">Report generated at {new Date(meta.timestamp || Date.now()).toLocaleString()}</span>
            </div>
        </div>
    );
};

export default AnalyticsHub;
