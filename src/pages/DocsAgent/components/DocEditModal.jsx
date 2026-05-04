import React, { useState, useEffect } from 'react';
import { X, Info } from 'lucide-react';

const FIELD_TOOLTIPS = {
    name: {
        heading: 'Document Name',
        description: 'The title shown in your sidebar. Type this name in chat to quickly find and open your doc.'
    },
    description: {
        heading: 'Description',
        description: 'A short summary of your document. Helps you remember what it\'s about and find it by typing in chat.'
    },
    keywords: {
        heading: 'Keywords',
        description: 'Tags to quickly recall this doc from chat. Type any keyword and matching docs will appear as suggestions.'
    }
};

const DocEditModal = ({ doc, onSave, onClose }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [keywordsText, setKeywordsText] = useState('');
    const [saving, setSaving] = useState(false);
    const [hoveredField, setHoveredField] = useState(null);
    const [revalEnabled, setRevalEnabled] = useState(false);
    const [revalInterval, setRevalInterval] = useState('monthly');

    useEffect(() => {
        if (doc) {
            setName(doc.name || '');
            setDescription(doc.description || '');
            setKeywordsText(
                Array.isArray(doc.keywords) ? doc.keywords.join(', ') : ''
            );
            const hasReval = doc.revaluation?.interval;
            setRevalEnabled(!!hasReval);
            setRevalInterval(hasReval || 'monthly');
        }
    }, [doc]);

    const computeNextDate = (interval) => {
        const d = new Date();
        switch (interval) {
            case 'weekly': d.setDate(d.getDate() + 7); break;
            case 'biweekly': d.setDate(d.getDate() + 14); break;
            case 'monthly': d.setDate(d.getDate() + 30); break;
            case 'quarterly': d.setDate(d.getDate() + 90); break;
            default: return null;
        }
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            const keywords = keywordsText
                .split(',')
                .map(k => k.trim())
                .filter(Boolean);

            const revaluation = revalEnabled
                ? { interval: revalInterval }
                : { interval: null };

            await onSave(doc.id, { name: name.trim(), description: description.trim(), keywords, revaluation });
            onClose();
        } catch (err) {
            console.error('Failed to save doc metadata:', err);
        } finally {
            setSaving(false);
        }
    };

    if (!doc) return null;

    return (
        <div className="doc-edit-modal-overlay" onClick={onClose}>
            <div className="doc-edit-modal" onClick={(e) => e.stopPropagation()}>
                {/* Close Button */}
                <button className="doc-edit-close" onClick={onClose}>
                    <X size={18} />
                </button>

                {/* Guidance Banner */}
                <div className="doc-edit-guidance">
                    <Info size={14} />
                    <span>Use these details to quickly find and open your docs from the chat.</span>
                </div>

                <h3 className="doc-edit-title">Edit Document Details</h3>

                {/* Name Field */}
                <div className="doc-edit-field">
                    <label
                        className="doc-edit-label"
                        onMouseEnter={() => setHoveredField('name')}
                        onMouseLeave={() => setHoveredField(null)}
                    >
                        Name
                        <span className="doc-edit-label-hint">ⓘ</span>
                        {hoveredField === 'name' && (
                            <div className="doc-edit-tooltip">
                                <strong>{FIELD_TOOLTIPS.name.heading}</strong>
                                <p>{FIELD_TOOLTIPS.name.description}</p>
                            </div>
                        )}
                    </label>
                    <input
                        type="text"
                        className="doc-edit-input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter document name..."
                    />
                </div>

                {/* Description Field */}
                <div className="doc-edit-field">
                    <label
                        className="doc-edit-label"
                        onMouseEnter={() => setHoveredField('description')}
                        onMouseLeave={() => setHoveredField(null)}
                    >
                        Description
                        <span className="doc-edit-label-hint">ⓘ</span>
                        {hoveredField === 'description' && (
                            <div className="doc-edit-tooltip">
                                <strong>{FIELD_TOOLTIPS.description.heading}</strong>
                                <p>{FIELD_TOOLTIPS.description.description}</p>
                            </div>
                        )}
                    </label>
                    <textarea
                        className="doc-edit-textarea"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief summary of this document..."
                        rows={3}
                    />
                </div>

                {/* Keywords Field */}
                <div className="doc-edit-field">
                    <label
                        className="doc-edit-label"
                        onMouseEnter={() => setHoveredField('keywords')}
                        onMouseLeave={() => setHoveredField(null)}
                    >
                        Keywords
                        <span className="doc-edit-label-hint">ⓘ</span>
                        {hoveredField === 'keywords' && (
                            <div className="doc-edit-tooltip">
                                <strong>{FIELD_TOOLTIPS.keywords.heading}</strong>
                                <p>{FIELD_TOOLTIPS.keywords.description}</p>
                            </div>
                        )}
                    </label>
                    <input
                        type="text"
                        className="doc-edit-input"
                        value={keywordsText}
                        onChange={(e) => setKeywordsText(e.target.value)}
                        placeholder="budget, finance, Q3 report..."
                    />
                    <span className="doc-edit-hint">Separate keywords with commas</span>
                </div>

                {/* Preview Tags */}
                {keywordsText.trim() && (
                    <div className="doc-edit-keywords-preview">
                        {keywordsText.split(',').map((kw, i) => (
                            kw.trim() && (
                                <span key={i} className="keyword-tag">{kw.trim()}</span>
                            )
                        ))}
                    </div>
                )}

                {/* ─── Revaluation Schedule ─────────────────────────────── */}
                <div className="doc-edit-field reval-section">
                    <label className="doc-edit-label">
                        ⏱ Revaluation Schedule
                        <span className="doc-edit-label-hint">ⓘ</span>
                    </label>

                    <div className="reval-toggle-row">
                        <label className="reval-toggle-label">
                            <input
                                type="checkbox"
                                className="reval-checkbox"
                                checked={revalEnabled}
                                onChange={(e) => setRevalEnabled(e.target.checked)}
                            />
                            <span className="reval-toggle-text">
                                {revalEnabled ? 'Enabled' : 'Disabled'}
                            </span>
                        </label>
                    </div>

                    {revalEnabled && (
                        <div className="reval-config">
                            <select
                                className="reval-select"
                                value={revalInterval}
                                onChange={(e) => setRevalInterval(e.target.value)}
                            >
                                <option value="weekly">Weekly (every 7 days)</option>
                                <option value="biweekly">Bi-Weekly (every 14 days)</option>
                                <option value="monthly">Monthly (every 30 days)</option>
                                <option value="quarterly">Quarterly (every 90 days)</option>
                            </select>
                            <span className="reval-next-date">
                                Next revaluation: {computeNextDate(revalInterval)}
                            </span>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="doc-edit-actions">
                    <button className="doc-edit-btn cancel" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className="doc-edit-btn save"
                        onClick={handleSave}
                        disabled={saving || !name.trim()}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DocEditModal;
