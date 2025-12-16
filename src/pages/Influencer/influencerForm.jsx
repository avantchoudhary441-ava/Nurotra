import "../../styles/influencerForm.css";
import { useState, useEffect } from "react";
import logo from "../../assets/NurotraLogo.png";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function InfluencerForm() {
  const navigate = useNavigate();
  const { user } = useAuth(); // Get user from context

  // -----------------------------
  // FORM STATE + LOCAL STORAGE
  // -----------------------------
  const [formData, setFormData] = useState({
    email: "",
    instagram: "",
    followers: "1k – 10k",
    workedBefore: "No",
    brandName: "",
    contentTypes: [],
    budget: "",
    brandType: "Fitness",
    niche: "",
    profileImg: "",
    nuroId: "", // Renamed
  });

  // Auto-fill effect
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        email: user.email || "", // Auto-fill email
        nuroId: user.uniqueId || user._id || "" // Auto-fill Nuro ID
      }));
    }
  }, [user]);

  useEffect(() => {
    const saved = localStorage.getItem("influencerForm");
    if (saved) setFormData(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("influencerForm", JSON.stringify(formData));
  }, [formData]);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleContentType = (type) => {
    setFormData((prev) => {
      const exists = prev.contentTypes.includes(type);
      const list = exists
        ? prev.contentTypes.filter((x) => x !== type)
        : [...prev.contentTypes, type];

      return { ...prev, contentTypes: list };
    });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    updateField("profileImg", url);
  };

  const toggleTheme = () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  const submitForm = () => {
    if (!formData.email.includes("@")) return alert("Please enter a valid email.");
    if (!formData.instagram.startsWith("https://"))
      return alert("Instagram URL must start with https://");
    if (formData.workedBefore === "Yes" && !formData.brandName)
      return alert("Please enter the brand name.");


    localStorage.setItem("influencerForm", JSON.stringify(formData));

    //  Go to Dashboard
    navigate("/influencer/dashboard");
  };

  return (
    <div className="inf-page">

      {/* Background Glow */}
      <div className="inf-glow"></div>

      {/* Top Bar */}
      <div className="inf-top">
        <button onClick={() => navigate(-1)} className="inf-back-btn">← Back</button>

        <div className="inf-top-right">
          <button onClick={toggleTheme} className="inf-toggle-btn">🌙</button>
          <div className="inf-profile-icon">👤</div>
        </div>
      </div>

      {/* Header Section */}
      <div className="inf-header">
        <img src={logo} className="inf-header-logo" />
        <h2 className="inf-header-title">Collaborator</h2>
        <p className="inf-header-subtitle">Set up your Influencer Profile</p>
      </div>

      {/* FORM CARD */}
      <div className="inf-card">

        {/* Profile Image */}
        <div className="inf-card-left">
          <div className="inf-photo-box">
            {formData.profileImg ? (
              <img src={formData.profileImg} className="inf-photo-preview" />
            ) : (
              <span className="inf-photo-placeholder">👤</span>
            )}
          </div>

          <label className="inf-upload-label">
            Upload Profile Photo
            <input type="file" accept="image/*" onChange={handleImageUpload} />
          </label>
        </div>

        {/* Two Columns */}
        <div className="inf-card-right">

          <div className="inf-two-columns">

            {/* BASIC INFO */}
            <div className="inf-left-column">
              <h3 className="inf-section-title">Basic Info</h3>

              <div className="inf-group">
                <label>Nuro ID (Auto-filled)</label>
                <input
                  type="text"
                  value={formData.nuroId}
                  className="inf-disabled"
                  readOnly
                  style={{ opacity: 0.7, cursor: 'not-allowed' }}
                />
              </div>

              <div className="inf-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div className="inf-group">
                <label>Instagram URL</label>
                <input
                  type="url"
                  value={formData.instagram}
                  onChange={(e) => updateField("instagram", e.target.value)}
                  placeholder="https://instagram.com/yourprofile"
                />
              </div>

              <div className="inf-group">
                <label>Follower Count</label>
                <select
                  value={formData.followers}
                  onChange={(e) => updateField("followers", e.target.value)}
                >
                  <option>1k – 10k</option>
                  <option>10k - 50k</option>
                  <option>50k – 100k</option>
                  <option>100k+</option>
                </select>
              </div>

              <div className="inf-group">
                <label>Previous Brand Collaboration</label>
                <select
                  value={formData.workedBefore}
                  onChange={(e) => updateField("workedBefore", e.target.value)}
                >
                  <option>No</option>
                  <option>Yes</option>
                </select>
              </div>

              {formData.workedBefore === "Yes" && (
                <div className="inf-group fade-in">
                  <label>Brand Name</label>
                  <input
                    type="text"
                    value={formData.brandName}
                    onChange={(e) => updateField("brandName", e.target.value)}
                    placeholder="Eg: Nike"
                  />
                </div>
              )}
            </div>

            {/* PREFERENCES */}
            <div className="inf-right-column">
              <h3 className="inf-section-title">Collaboration Preferences</h3>

              <div className="inf-group">
                <label>Content Offered</label>
                <div className="inf-checkboxes">
                  {["Reels", "Posts", "Stories", "ALL"].map((t) => (
                    <label key={t}>
                      <input
                        type="checkbox"
                        checked={formData.contentTypes.includes(t)}
                        onChange={() => toggleContentType(t)}
                      />
                      {t}
                    </label>
                  ))}
                </div>
              </div>

              <div className="inf-group">
                <label>Minimum Budget</label>
                <input
                  type="number"
                  value={formData.budget}
                  onChange={(e) => updateField("budget", e.target.value)}
                  placeholder="₹ Enter amount"
                />
              </div>

              <div className="inf-group">
                <label>Preferred Brand Type</label>
                <select
                  value={formData.brandType}
                  onChange={(e) => updateField("brandType", e.target.value)}
                >
                  <option>Fitness</option>
                  <option>Tech</option>
                  <option>Beauty</option>
                  <option>Lifestyle</option>
                  <option>Fashion</option>
                  <option>Food</option>
                </select>
              </div>

              <div className="inf-group">
                <label>Niche</label>
                <input
                  type="text"
                  value={formData.niche}
                  onChange={(e) => updateField("niche", e.target.value)}
                  placeholder="Fitness, Tech, Travel..."
                />
              </div>
            </div>

          </div>

          {/* Submit Button */}
          <button className="btn-primary inf-submit" onClick={submitForm}>
            Submit Profile
          </button>

        </div>
      </div>
    </div>
  );
}
