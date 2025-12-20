import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { profileService, matchService } from "../../services/apiService";
import "../../styles/matchingForms.css";
import BackgroundEffects from "../../components/BackgroundEffects";
import InfluencerMatchResults from "./InfluencerMatchResults";

export default function InfluencerMatchingForm() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    // Determine mode based on URL
    const isStandardsMode = location.pathname.includes("matching-standards");

    // Default explicit logic for view vs edit
    const [isEditing, setIsEditing] = useState(!isStandardsMode);

    const [matches, setMatches] = useState(null);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        // Basic
        fullName: "",
        contactNumber: "",
        email: "",
        profileUrl: "", // same as platformUrl

        // Social
        primaryPlatform: "Instagram",
        socialHandle: "",
        followers: "Nano (1k–10k)",
        engagementRate: 2.5,

        // Audience
        audienceAge: [], // Multi select
        targetingLocation: [], // Multi select

        // Preferences (existing but refined)
        niche: "",
        contentTypes: [],
        budget: "₹500–₹5,000",

        // Performance
        collabExperience: "New to collaborations",
        noteToBrand: ""
    });

    // Pre-fill from existing profile if available
    useEffect(() => {
        const fetchProfile = async () => {
            if (user?.token) {
                try {
                    const data = await profileService.getInfluencer(user.token);
                    if (data) {
                        setFormData(prev => ({
                            ...prev,
                            fullName: data.fullName || user.name || "",
                            email: data.email || user.email || "",
                            contactNumber: data.contactNumber || "",
                            profileUrl: data.platformUrl || "",
                            primaryPlatform: data.primaryPlatform || "Instagram",
                            socialHandle: data.socialHandle || "",
                            followers: data.followers || "Nano (1k–10k)",
                            engagementRate: data.engagementRate || 2.5,
                            audienceAge: data.audienceAge || [],
                            targetingLocation: data.targetingLocation || [],
                            niche: data.niche || "",
                            contentTypes: data.contentTypes || [],
                            budget: data.budget || "₹500–₹5,000",
                            collabExperience: data.collabExperience || "New to collaborations",
                            noteToBrand: data.noteToBrand || ""
                        }));
                    } else {
                        // No data? Force edit mode
                        setIsEditing(true);
                    }
                } catch (err) {
                    console.log("No existing profile or error fetching");
                    setIsEditing(true);
                }
            }
        };
        fetchProfile();
    }, [user]);

    const updateField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Helper for multi-select arrays (toggle)
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
        // Validation: All fields mandatory except noteToBrand
        if (
            !formData.fullName ||
            !formData.contactNumber ||
            !formData.email ||
            !formData.profileUrl ||
            !formData.primaryPlatform ||
            !formData.socialHandle ||
            !formData.followers ||
            formData.audienceAge.length === 0 ||
            formData.targetingLocation.length === 0 ||
            !formData.niche ||
            !formData.budget ||
            formData.contentTypes.length === 0 ||
            !formData.collabExperience
        ) {
            alert("Please fill all essential fields. Only 'Note to Brand' is optional.");
            return;
        }

        try {
            setLoading(true);
            // Map 'profileUrl' back to 'platformUrl' for backend
            const payload = {
                ...formData,
                platformUrl: formData.profileUrl
            };
            // 1. Save Profile
            await profileService.saveInfluencer(payload, user.token);

            if (isStandardsMode) {
                // Just Save
                setLoading(false);
                setIsEditing(false); // Switch to View Mode
                alert("Matching Standards Updated Successfully!");
            } else {
                // Find Matches
                // 2. Fetch Matches
                // We pass nuroId implicit in token mostly, or pass explicit
                const results = await matchService.getInfluencerMatches(user.uniqueId || "INF-TEMP");
                setMatches(results);
                setLoading(false);
            }

        } catch (err) {
            console.error(err);
            setLoading(false);
            alert("Failed to save or find details.");
        }
    };

    const startOver = () => {
        setMatches(null);
    };

    // Options
    const platforms = ["Instagram", "YouTube", "TikTok", "X (Twitter)", "Facebook", "Other"];
    const followerRanges = ["Nano (1k–10k)", "Micro (10k–100k)", "Macro (100k–1M)", "Celebrity (1M+)"];
    const ageRanges = ["10-18", "18-25", "25-30", "30-65"];
    const niches = ["Fitness", "Fashion", "Tech", "Beauty", "Lifestyle", "Food", "Travel", "Gaming", "Education", "Finance", "Home & Living", "Others"];
    const contentOpts = ["Reel / Short Video", "Post", "Story", "Unboxing", "Review Video", "Carousel", "Live Session", "UGC Content Only"];
    const budgetRanges = ["₹500–₹5,000", "₹5,000–₹20,000", "₹20,000–₹50,000", "₹50,000+"];
    const expOpts = ["New to collaborations", "Barter experience", "Paid experience", "Both"];

    // Location handling (Select + Add)
    const [selectedCountry, setSelectedCountry] = useState("");
    const addLocation = (e) => {
        const val = e.target.value;
        if (val && !formData.targetingLocation.includes(val)) {
            toggleArrayItem("targetingLocation", val);
        }
        setSelectedCountry(""); // Reset
    };

    // Theme Toggle
    const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
    const toggleTheme = () => {
        const next = theme === "light" ? "dark" : "light";
        setTheme(next);
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("theme", next);
    };

    return (
        <div className="inf-page">
            <BackgroundEffects />
            <div className="inf-glow"></div>

            {/* Match Results Overlay */}
            {matches && <InfluencerMatchResults matches={matches} onClose={startOver} />}

            <div className="inf-top">
                <button onClick={() => navigate(-1)} className="inf-back-btn">← Back to Dashboard</button>
                <div style={{ display: "flex", gap: "10px" }}>
                    {/* Render Edit Button in Standards Mode */}
                    {isStandardsMode && !isEditing && (
                        <button onClick={() => setIsEditing(true)} className="inf-theme-toggle" title="Edit Standards">
                            ✏️
                        </button>
                    )}
                    {/* Render Cancel Edit Button */}
                    {isStandardsMode && isEditing && (
                        <button onClick={() => setIsEditing(false)} className="inf-theme-toggle" title="Cancel Edit">
                            ❌
                        </button>
                    )}
                    <button onClick={toggleTheme} className="inf-theme-toggle">
                        {theme === "dark" ? "☀️" : "🌙"}
                    </button>
                </div>
            </div>

            <div className="inf-header">
                <h2 className="inf-header-title">{isStandardsMode ? "Matching Standards" : "Matching Details"}</h2>
                <p className="inf-header-subtitle">
                    {isStandardsMode
                        ? "Configure your default profile for automated matching."
                        : "Complete your profile to get the best brand matches."}
                </p>
            </div>

            <div className={`inf-card ${!isEditing ? "form-disabled" : ""}`}>

                {/* SECTION 1: BASIC INFO */}
                <h3 className="inf-section-title">Basic Information</h3>
                <div className="inf-two-columns">
                    <div className="inf-group">
                        <label>Full Name</label>
                        <input type="text" value={formData.fullName} disabled={!isEditing} onChange={e => updateField("fullName", e.target.value)} />
                    </div>
                    <div className="inf-group">
                        <label>Contact No.</label>
                        <input type="text" value={formData.contactNumber} disabled={!isEditing} onChange={e => updateField("contactNumber", e.target.value)} />
                    </div>
                    <div className="inf-group">
                        <label>Email Address</label>
                        <input type="email" value={formData.email} disabled={!isEditing} onChange={e => updateField("email", e.target.value)} />
                    </div>
                    <div className="inf-group">
                        <label>Profile URL</label>
                        <input type="url" value={formData.profileUrl} disabled={!isEditing} onChange={e => updateField("profileUrl", e.target.value)} placeholder="https://..." />
                    </div>
                </div>

                {/* SECTION 2: SOCIAL MEDIA */}
                <h3 className="inf-section-title mt-large">Social Media Presence</h3>
                <div className="inf-two-columns">
                    <div className="inf-group">
                        <label>Platform</label>
                        <select value={formData.primaryPlatform} disabled={!isEditing} onChange={e => updateField("primaryPlatform", e.target.value)}>
                            {platforms.map(p => <option key={p}>{p}</option>)}
                        </select>
                    </div>
                    <div className="inf-group">
                        <label>Social Media Handle</label>
                        <input type="text" value={formData.socialHandle} disabled={!isEditing} onChange={e => updateField("socialHandle", e.target.value)} placeholder="@username" />
                    </div>
                    <div className="inf-group">
                        <label>Total Followers</label>
                        <select value={formData.followers} disabled={!isEditing} onChange={e => updateField("followers", e.target.value)}>
                            {followerRanges.map(f => <option key={f}>{f}</option>)}
                        </select>
                    </div>
                    <div className="inf-group">
                        <label className="flex-between">
                            <span>Engagement Rate</span>
                            <span className="text-primary">{formData.engagementRate}%</span>
                        </label>
                        <input
                            type="range" min="0" max="10" step="0.1"
                            value={formData.engagementRate}
                            disabled={!isEditing}
                            onChange={e => updateField("engagementRate", parseFloat(e.target.value))}
                            className="inf-range-input"
                        />
                    </div>
                </div>

                {/* SECTION 3: AUDIENCE */}
                <h3 className="inf-section-title mt-large">Audience & Targeting</h3>
                <div className="inf-group mb-large">
                    <label className="block-mb">Audience Age Range (Select all that apply)</label>
                    <div className="inf-checkboxes-flex">
                        {ageRanges.map(a => (
                            <label key={a} className={`inf-checkbox-pill ${!isEditing ? "disabled-pill" : ""}`}>
                                <input type="checkbox" checked={formData.audienceAge.includes(a)} disabled={!isEditing} onChange={() => toggleArrayItem("audienceAge", a)} />
                                {a}
                            </label>
                        ))}
                    </div>
                </div>
                <div className="inf-group mb-large">
                    <label>Best Targeting Location (Add countries)</label>
                    <select
                        value={selectedCountry}
                        onChange={addLocation}
                        disabled={!isEditing}
                        className="mb-1rem"
                    >
                        <option value="">Select a Country to Add...</option>
                        {countries.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    {formData.targetingLocation.length > 0 && (
                        <div className="inf-tags-container">
                            {formData.targetingLocation.map(loc => (
                                <span key={loc} className={`inf-tag-item ${!isEditing ? "disabled-tag" : ""}`} onClick={() => !isEditing ? null : toggleArrayItem("targetingLocation", loc)}>
                                    {loc} {isEditing && "×"}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* SECTION 4: MATCH PREFERENCES */}
                <h3 className="inf-section-title mt-large"> Match Preferences</h3>
                <div className="inf-two-columns">
                    <div className="inf-group">
                        <label>Niche / Industry</label>
                        <select value={formData.niche} disabled={!isEditing} onChange={e => updateField("niche", e.target.value)}>
                            <option value="">Select Niche</option>
                            {niches.map(n => <option key={n}>{n}</option>)}
                        </select>
                    </div>
                    <div className="inf-group">
                        <label>Minimum Budget Expectation</label>
                        <select value={formData.budget} disabled={!isEditing} onChange={e => updateField("budget", e.target.value)}>
                            {budgetRanges.map(b => <option key={b}>{b}</option>)}
                        </select>
                    </div>
                </div>
                <div className="inf-group mb-large">
                    <label className="block-mb">Preferred Content Type</label>
                    <div className="inf-checkboxes-grid">
                        {contentOpts.map(c => (
                            <label key={c} className={`inf-checkbox-card ${!isEditing ? "disabled-card" : ""}`}>
                                <input type="checkbox" checked={formData.contentTypes.includes(c)} disabled={!isEditing} onChange={() => toggleArrayItem("contentTypes", c)} />
                                {c}
                            </label>
                        ))}
                    </div>
                </div>

                {/* SECTION 5: PERFORMANCE & EXPECTATIONS */}
                <h3 className="inf-section-title mt-large">Performance & Expectations</h3>
                <div className="inf-group mb-large">
                    <label className="block-mb">Collab Experience</label>
                    <div className="inf-checkboxes-flex">
                        {expOpts.map(ex => (
                            <label key={ex} className={`inf-checkbox-pill ${!isEditing ? "disabled-pill" : ""}`}>
                                <input type="radio" name="exp" checked={formData.collabExperience === ex} disabled={!isEditing} onChange={() => updateField("collabExperience", ex)} />
                                {ex}
                            </label>
                        ))}
                    </div>
                </div>
                <div className="inf-group mb-large">
                    <label>Note to Brand (Optional)</label>
                    <textarea
                        value={formData.noteToBrand}
                        disabled={!isEditing}
                        onChange={e => updateField("noteToBrand", e.target.value)}
                        placeholder="Describe your style, what you are looking for, etc."
                        rows={5}
                    />
                </div>

                {/* Submit Button (Only show in Edit Mode) */}
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

// Full Country List
const countries = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
    "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
    "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo (Congo-Brazzaville)", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia (Czech Republic)",
    "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic",
    "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
    "Fiji", "Finland", "France",
    "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
    "Haiti", "Honduras", "Hungary",
    "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
    "Jamaica", "Japan", "Jordan",
    "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan",
    "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
    "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar (formerly Burma)",
    "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
    "Oman",
    "Pakistan", "Palau", "Palestine State", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
    "Qatar",
    "Romania", "Russia", "Rwanda",
    "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
    "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
    "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States of America", "Uruguay", "Uzbekistan",
    "Vanuatu", "Venezuela", "Vietnam",
    "Yemen",
    "Zambia", "Zimbabwe"
];
