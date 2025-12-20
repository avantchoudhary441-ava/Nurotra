import "../../styles/brandForm.css";
import { useState, useEffect } from "react";
import logo from "../../assets/NurotraLogo.png";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { profileService } from "../../services/apiService";

export default function BrandForm() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth(); // Get user from context

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
    profileImg: "", // Added for Google Auth Profile Pic
  });

  // Auto-fill effect (Enforces User Data)
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        // Prioritize User Identity Data
        contact: (prev.contact && prev.contact !== user.email) ? prev.contact : (user.email || ""),
        nuroId: user.uniqueId || user._id || "",
        // profileImg: Manually uploaded only (Requested by user)
      }));
    }
  }, [user]);

  // Load saved data if exists
  useEffect(() => {
    const saved = localStorage.getItem("brandForm");
    if (saved) {
      const parsed = JSON.parse(saved);
      // Smart Merge: Don't overwrite identity with empty saved data
      if (user) {
        parsed.contact = (parsed.contact && parsed.contact !== user.email) ? parsed.contact : (user.email || "");
        parsed.nuroId = user.uniqueId || user._id || "";
      }
      setFormData(parsed);
    }
  }, [user]);

  // Save form data on every change
  useEffect(() => {
    // console.log("Saving form data:", formData); // Commented out to avoid spam
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

  const submitForm = async () => {
    if (!formData.website.startsWith("https://")) {
      alert("Website/Instagram link must start with https://");
      return;
    }

    if (!formData.contact) {
      alert("Please enter a valid email or phone number.");
      return;
    }


    try {
      console.log("Submitting Brand Profile...", formData);

      const payload = { ...formData, contentTypes: [formData.contentType] };
      // Call API
      await profileService.saveBrand(payload, user.token);

      // Update Local User Role so they can access dashboard immediately
      updateUser({ role: "brand" });

      // Clear Form Draft
      localStorage.removeItem("brandForm");

      alert("Profile Created Successfully! Welcome to Nurotra.");
      navigate("/brand/dashboard");

    } catch (error) {
      console.error("Brand Creation Error:", error);
      alert("Failed to create profile. Please try again.");
    }
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
          {formData.profileImg && (
            <div className="brand-profile-icon">
              <img
                src={formData.profileImg}
                alt="Profile"
                className="brand-profile-img-inner"
              />
            </div>
          )}
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
              <label>Email (Auto-filled)</label>
              <input
                type="text"
                value={formData.contact}
                onChange={(e) => !user && updateField("contact", e.target.value)}
                placeholder="yourmail@company.com"
                readOnly={!!user}
                className={user ? "brand-disabled" : ""}
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
        <div className="brand-submit-wrapper">
          <button className="btn-primary brand-submit" onClick={submitForm}>
            Submit Brand Profile
          </button>
        </div>

      </div>
    </div>
  );
}
