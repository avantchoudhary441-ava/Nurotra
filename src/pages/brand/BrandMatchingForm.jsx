import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { profileService, matchService } from "../../services/apiService";
import BrandMatchResults from "./BrandMatchResults";
import CurrencySelector from "../../components/CurrencySelector";
import BackgroundEffects from "../../components/BackgroundEffects";
import { localizeText } from "../../utils/textUtils";

export default function BrandMatchingForm() {
    const navigate = useNavigate();
    const location = useLocation();
    const { userId } = useParams(); // Get target userId for inspection
    const { user } = useAuth();

    // Determine mode based on URL
    const isStandardsMode = location.pathname.includes("matching-standards");

    // Default explicit logic for view vs edit
    // FORCE FALSE if inspecting
    const [isEditing, setIsEditing] = useState(userId ? false : !isStandardsMode);

    const [matches, setMatches] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isCustomIndustry, setIsCustomIndustry] = useState(false);
    const industryInputRef = useRef(null);

    // ... existing state and effects ...
    const [formData, setFormData] = useState({
        // 1. Brand Info
        brandName: "",
        website: "",

        // 2. Core Matching
        industry: "", // Niche
        contentTypes: [], // Multi
        budget: "₹500–₹5,000",

        // 3. Matching Objective
        campaignGoal: "Brand Awareness",

        // 4. Influencer Requirements
        influencerCategory: "Nano (1k–10k)",
        minEngagement: "1–3%",
        platform: "Instagram",

        // 5. Budget & Timeline
        collabDuration: "Immediate (24 hours)",
        noteToInfluencer: "" // Optional
    });

    const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
    const toggleTheme = () => {
        const next = theme === "light" ? "dark" : "light";
        setTheme(next);
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("theme", next);
    };

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                let data = null;
                if (userId) {
                    // INSPECTION MODE
                    data = await profileService.getBrandById(userId);
                } else if (user?.token) {
                    // OWNER MODE
                    data = await profileService.getBrand(user.token);
                }

                if (data) {
                    setFormData(prev => ({
                        ...prev,
                        brandName: data.brandName || (userId ? data.userId?.name : user.name) || "",
                        website: data.website || "",
                        industry: data.industry || "",
                        contentTypes: data.contentTypes || [],
                        budget: data.budget || "₹500–₹5,000",
                        campaignGoal: data.campaignGoal || "Brand Awareness",
                        influencerCategory: data.influencerCategory || "Nano (1k–10k)",
                        minEngagement: data.minEngagement || "1–3%",
                        platform: data.platform || "Instagram",
                        collabDuration: data.collabDuration || "Immediate (24 hours)",
                        noteToInfluencer: data.noteToInfluencer || ""
                    }));

                    // Detect if industry is custom
                    if (data.industry && !industries.includes(data.industry)) {
                        setIsCustomIndustry(true);
                    }
                } else if (!userId) {
                    // No data? Always edit mode
                    setIsEditing(true);
                }
            } catch (err) {
                console.log("No existing profile");
                if (!userId) setIsEditing(true);
            }
        };
        fetchProfile();
    }, [user, userId]);

    // Focus custom input when toggled
    useEffect(() => {
        if (isCustomIndustry && industryInputRef.current) {
            industryInputRef.current.focus();
        }
    }, [isCustomIndustry]);

    const updateField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const toggleArrayItem = (field, item) => {
        setFormData(prev => {
            const list = prev[field] || [];
            if (list.includes(item)) {
                return { ...prev, [field]: list.filter(x => x !== item) };
            } else {
                return { ...prev, [field]: [...list, item] };
            }
        });
    };

    const handleSubmit = async () => {
        if (
            !formData.brandName ||
            !formData.website ||
            !formData.industry ||
            formData.contentTypes.length === 0 ||
            !formData.budget ||
            !formData.campaignGoal ||
            !formData.influencerCategory ||
            !formData.minEngagement ||
            !formData.platform ||
            !formData.collabDuration
        ) {
            alert("Please fill all essential fields.");
            return;
        }

        try {
            setLoading(true);
            // 1. Save preferences
            await profileService.saveBrand({ ...formData, nuroId: user.uniqueId || "BRAND-TEMP" }, user.token);

            // If we are just updating standards, we stop here (unless user wants to match immediately?)
            // User requirement: "after filling that form when user click on the matching standards this open will open with same ui and data"
            // And: "save and find matches button that form go and save in that side bar"

            if (isStandardsMode) {
                // Just Save
                setLoading(false);
                setIsEditing(false); // Switch back to view mode
                alert("Matching Standards Updated Successfully!");
            } else {
                // Find Matches
                // 2. Fetch Matches
                // We pass the nuroId (assuming backend uses it to find the saved profile)
                const results = await matchService.getBrandMatches(user.uniqueId || "BRAND-TEMP");
                setMatches(results);
                setLoading(false);
            }

        } catch (err) {
            console.error(err);
            setLoading(false);
            alert("Failed to save/match. Please try again.");
        }
    };

    const startOver = () => {
        setMatches(null);
    };

    // Constants
    const industries = ["Tech", "Fashion", "Fitness", "Beauty", "Food", "Lifestyle", "Education", "Finance", "Home & Living", "Other"];
    const contentOpts = ["Reel / Video", "Post", "Story", "Unboxing", "Review", "Carousel", "Live Interaction", "UGC Content"];
    const budgetRanges = ["₹500-₹5,000", "₹5,000-₹20,000", "₹20,000-₹50,000", "₹50,000+"];
    const goals = ["Brand Awareness", "Product Promotion", "Event Promotion", "App Installs", "UGC Content", "Community Building", "Product Launch", "Product Awareness", "Other"];
    const categories = ["Nano (1k-10k)", "Micro (10k-100k)", "Macro (100k-1M)", "Celebrity (1M+)"];
    const engagementRates = ["1-3%", "3-5%", "5-10%", "10%+"];
    const platforms = ["Instagram", "YouTube", "TikTok", "X (Twitter)", "Facebook", "Other"];
    const durations = ["Immediate (24 hours)", "2-3 days", "1 week", "1-4 weeks"];

    return (
        <div className="inf-page">
            <BackgroundEffects />
            <div className="inf-glow"></div>

            {/* Results Overlay */}
            {matches && <BrandMatchResults matches={matches} onClose={startOver} />}

            <div className="inf-top">
                <button onClick={() => navigate(-1)} className="inf-back-btn">← Back</button>
                <div style={{ display: "flex", gap: "10px" }}>
                    {/* Render Edit Button in Standards Mode */}
                    {isStandardsMode && !isEditing && !userId && (
                        <button onClick={() => setIsEditing(true)} className="inf-theme-toggle" title="Edit Standards">
                            ✏️
                        </button>
                    )}
                    {/* Render Cancel Edit Button */}
                    {isStandardsMode && isEditing && !userId && (
                        <button onClick={() => setIsEditing(false)} className="inf-theme-toggle" title="Cancel Edit">
                            ❌
                        </button>
                    )}
                    <CurrencySelector />
                    <button onClick={toggleTheme} className="inf-theme-toggle">
                        {theme === "dark" ? "☀️" : "🌙"}
                    </button>
                </div>
            </div>

            <div className="inf-header">
                <h2 className="inf-header-title">
                    {localizeText(isStandardsMode ? "Matching Standards" : "Brand Matching Details", formData.brandName, userId)}
                </h2>
                <p className="inf-header-subtitle">
                    {userId
                        ? localizeText("Viewing your default preferences for automated matching.", formData.brandName, true)
                        : (isStandardsMode
                            ? "Configure your default preferences for automated matching."
                            : "Find the perfect influencers for your campaign.")}
                </p>
            </div>

            {/* Apply disabled class or attribute to container or inputs if !isEditing */}
            <div className={`inf-card ${!isEditing ? "form-disabled" : ""}`}>

                {/* 1. Brand Information */}
                <h3 className="inf-section-title">Brand Information</h3>
                <div className="inf-two-columns">
                    <div className="inf-group">
                        <label>Brand Name</label>
                        <input type="text" value={formData.brandName} disabled={!isEditing} onChange={e => updateField("brandName", e.target.value)} />
                    </div>
                    <div className="inf-group">
                        <label>Brand Website</label>
                        <input type="url" value={formData.website} disabled={!isEditing} onChange={e => updateField("website", e.target.value)} placeholder="https://..." />
                    </div>
                </div>

                {/* 2. Core Matching Information */}
                <h3 className="inf-section-title mt-large">Core Matching Information</h3>
                <div className="inf-two-columns">
                    <div className="inf-group">
                        <label className="flex-between">
                            <span>Brand's Industry / Niche</span>
                            {isCustomIndustry && isEditing && (
                                <span
                                    className="text-primary pointer"
                                    style={{ fontSize: "11px", textDecoration: "underline" }}
                                    onClick={() => {
                                        setIsCustomIndustry(false);
                                        updateField("industry", "");
                                    }}
                                >
                                    Back to list
                                </span>
                            )}
                        </label>
                        {isCustomIndustry ? (
                            <input
                                ref={industryInputRef}
                                type="text"
                                value={formData.industry === "Other" ? "" : formData.industry}
                                placeholder="Type your industry..."
                                disabled={!isEditing}
                                onChange={e => updateField("industry", e.target.value)}
                            />
                        ) : (
                            <select
                                value={formData.industry}
                                disabled={!isEditing}
                                onChange={e => {
                                    const val = e.target.value;
                                    if (val === "Other") {
                                        setIsCustomIndustry(true);
                                        updateField("industry", "");
                                    } else {
                                        updateField("industry", val);
                                    }
                                }}
                            >
                                <option value="">Select Industry</option>
                                {industries.map(i => <option key={i}>{i}</option>)}
                            </select>
                        )}
                    </div>
                    <div className="inf-group">
                        <label>Budget Range</label>
                        <select value={formData.budget} disabled={!isEditing} onChange={e => updateField("budget", e.target.value)}>
                            {budgetRanges.map(b => <option key={b}>{b}</option>)}
                        </select>
                    </div>
                </div>
                <div className="inf-group mb-large">
                    <label className="block-mb">Required Content Type</label>
                    <div className="inf-checkboxes-grid">
                        {contentOpts.map(c => (
                            <label key={c} className={`inf-checkbox-card ${!isEditing ? "disabled-card" : ""}`}>
                                <input type="checkbox" disabled={!isEditing} checked={formData.contentTypes.includes(c)} onChange={() => toggleArrayItem("contentTypes", c)} />
                                {c}
                            </label>
                        ))}
                    </div>
                </div>

                {/* 3. Matching Objective */}
                <h3 className="inf-section-title mt-large">Matching Objective</h3>
                <div className="inf-group mb-large">
                    <label>Campaign Goal</label>
                    <select value={formData.campaignGoal} disabled={!isEditing} onChange={e => updateField("campaignGoal", e.target.value)}>
                        {goals.map(g => <option key={g}>{g}</option>)}
                    </select>
                </div>

                {/* 4. Influencer Requirements */}
                <h3 className="inf-section-title mt-large">Influencer Requirements</h3>
                <div className="inf-two-columns">
                    <div className="inf-group">
                        <label>Influencer Category</label>
                        <select value={formData.influencerCategory} disabled={!isEditing} onChange={e => updateField("influencerCategory", e.target.value)}>
                            {categories.map(c => <option key={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="inf-group">
                        <label>Minimum Engagement Rate</label>
                        <select value={formData.minEngagement} disabled={!isEditing} onChange={e => updateField("minEngagement", e.target.value)}>
                            {engagementRates.map(r => <option key={r}>{r}</option>)}
                        </select>
                    </div>
                </div>
                <div className="inf-group mb-large">
                    <label>Platform for Targeted Influencers</label>
                    <select value={formData.platform} disabled={!isEditing} onChange={e => updateField("platform", e.target.value)}>
                        {platforms.map(p => <option key={p}>{p}</option>)}
                    </select>
                </div>

                {/* 5. Budget & Timeline */}
                <h3 className="inf-section-title mt-large">Budget & Timeline</h3>
                <div className="inf-group mb-large">
                    <label>Collaboration Duration</label>
                    <div className="inf-checkboxes-flex">
                        {durations.map(d => (
                            <label key={d} className={`inf-checkbox-pill ${!isEditing ? "disabled-pill" : ""}`}>
                                <input type="radio" name="dur" disabled={!isEditing} checked={formData.collabDuration === d} onChange={() => updateField("collabDuration", d)} />
                                {d}
                            </label>
                        ))}
                    </div>
                </div>

                <div className="inf-group mb-large">
                    <label>Optional Note to Influencers</label>
                    <textarea
                        value={formData.noteToInfluencer}
                        disabled={!isEditing}
                        onChange={e => updateField("noteToInfluencer", e.target.value)}
                        placeholder="Any specific requirement? (Optional)"
                        rows={4}
                    />
                </div>

                {/* Submit Button Logic */}
                {isEditing && (
                    <div className="inf-footer">
                        <button className="inf-submit large" onClick={handleSubmit} disabled={loading}>
                            {loading
                                ? "Saving..."
                                : (isStandardsMode ? "Update Standards" : "Save & Find Matches")}
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}
