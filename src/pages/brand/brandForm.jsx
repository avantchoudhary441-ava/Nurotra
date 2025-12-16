import "../../styles/brandForm.css";
import { useState, useEffect } from "react";
import logo from "../../assets/NurotraLogo.png";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function BrandForm() {
  const navigate = useNavigate();
  const { user } = useAuth(); // Get user from context

  // ---------------------------------------
  // FORM STATE (AUTO SAVE)
  // ---------------------------------------
  const [formData, setFormData] = useState({
    website: "",
    companyType: "Startup",
    contact: "",
    industry: "Tech",
    contentType: "Reels",
    budget: "",
    nuroId: "", // Renamed
  });

  // Auto-fill effect
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        contact: prev.contact || user.email || "", // Auto-fill email
        nuroId: user.uniqueId || user._id || "" // Auto-fill Nuro ID
      }));
    }
  }, [user]);

  // Load saved data if exists
  useEffect(() => {
    const saved = localStorage.getItem("brandForm");
    if (saved) setFormData(JSON.parse(saved));
  }, []);

  // Save form data on every change
  useEffect(() => {
    localStorage.setItem("brandForm", JSON.stringify(formData));
  }, [formData]);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Theme Toggle
  const toggleTheme = () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  const submitForm = () => {
    if (!formData.website.startsWith("https://")) {
      alert("Website/Instagram link must start with https://");
      return;
    }

    if (!formData.contact) {
      alert("Please enter a valid email or phone number.");
      return;
    }


    navigate("/brand/dashboard");
  };

  return (
    <div className="brand-wrapper">

      {/* Glow Background */}
      <div className="brand-glow"></div>

      {/* Top Bar */}
      <div className="brand-top">
        <button className="brand-back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>

        <div className="brand-top-right">
          <button className="brand-toggle-btn" onClick={toggleTheme}>🌙</button>
          <div className="brand-profile-icon">🏢</div>
        </div>
      </div>

      {/* Header */}
      <div className="brand-header">
        <img src={logo} alt="Logo" className="brand-logo" />
        <h2 className="brand-title">Collaborator</h2>
        <p className="brand-subtitle">Set up your Brand Profile</p>
      </div>

      {/* Form Card */}
      <div className="brand-card">

        {/* TWO COLUMN FORM */}
        <div className="brand-columns">

          {/* LEFT COLUMN — Basic Info */}
          <div>
            <h3 className="col-heading">Basic Info</h3>

            {/* Nuro ID */}
            <div className="brand-group">
              <label>Nuro ID (Auto-filled)</label>
              <input
                type="text"
                value={formData.nuroId}
                className="brand-disabled"
                readOnly
                style={{ cursor: 'not-allowed', opacity: 0.7 }}
              />
            </div>

            {/* Website / Instagram */}
            <div className="brand-group">
              <label>Website / Instagram Link</label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => updateField("website", e.target.value)}
                placeholder="https://yourbrand.com"
                className="brand-link"
              />
            </div>

            {/* Company Type */}
            <div className="brand-group">
              <label>Company Type</label>
              <select
                value={formData.companyType}
                onChange={(e) => updateField("companyType", e.target.value)}
              >
                <option>Startup</option>
                <option>Small Business</option>
                <option>Medium</option>
                <option>Enterprise</option>
              </select>
            </div>

            {/* Contact Info */}
            <div className="brand-group">
              <label>Email / Phone Number</label>
              <input
                type="text"
                value={formData.contact}
                onChange={(e) => updateField("contact", e.target.value)}
                placeholder="yourmail@company.com / 9876543210"
              />
            </div>
          </div>

          {/* RIGHT COLUMN — Preferences */}
          <div>
            <h3 className="col-heading">Collaboration Preferences</h3>

            {/* Industry / Niche */}
            <div className="brand-group">
              <label>Industry / Niche</label>
              <select
                value={formData.industry}
                onChange={(e) => updateField("industry", e.target.value)}
              >
                <option>Tech</option>
                <option>Fitness</option>
                <option>Fashion</option>
                <option>Beauty</option>
                <option>Food</option>
                <option>Lifestyle</option>
                <option>Other</option>
              </select>
            </div>

            {/* Preferred Content Type */}
            <div className="brand-group">
              <label>Preferred Content Type</label>
              <select
                value={formData.contentType}
                onChange={(e) => updateField("contentType", e.target.value)}
              >
                <option>Reels</option>
                <option>Posts</option>
                <option>Stories</option>
                <option>ALL</option>
              </select>
            </div>

            {/* Budget */}
            <div className="brand-group">
              <label>Budget</label>
              <input
                type="number"
                value={formData.budget}
                onChange={(e) => updateField("budget", e.target.value)}
                placeholder="₹ Enter Budget"
              />
            </div>

          </div>
        </div>

        {/* Submit Button */}
        <div style={{ display: 'flex', justifySelf: 'center', width: '100%', justifyContent: 'center', marginTop: '2rem' }}>
          <button className="btn-primary brand-submit" onClick={submitForm}>
            Submit Brand Profile
          </button>
        </div>

      </div>
    </div>
  );
}
