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

    useEffect(() => {
        if (doc) {
            setName(doc.name || '');
            setDescription(doc.description || '');
            setKeywordsText(
                Array.isArray(doc.keywords) ? doc.keywords.join(', ') : ''
            );
        }
    }, [doc]);

    const handleSave = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            const keywords = keywordsText
                .split(',')
                .map(k => k.trim())
                .filter(Boolean);

            await onSave(doc.id, { name: name.trim(), description: description.trim(), keywords });
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
