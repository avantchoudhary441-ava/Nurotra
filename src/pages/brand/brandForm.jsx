import "../../styles/brandForm.css";
import { useState, useEffect } from "react";
import logo from "../../assets/NurotraLogo.png";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { profileService, chatService } from "../../services/apiService";
import { useCurrency } from "../../context/CurrencyContext";
import CurrencySelector from "../../components/CurrencySelector";

export default function BrandForm() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth(); // Get user from context
  const { currency } = useCurrency();
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  // ---------------------------------------
  // FORM STATE (AUTO SAVE)
  // ---------------------------------------
  const [formData, setFormData] = useState({
    brandName: "",
    website: "",
    companyType: "Direct-to-Consumer (DTC)",
    contact: "",
    industry: "",
    contentTypes: [],
    // budget removed
    profileImg: "",
    nuroId: "",
    campaignGoal: "Brand Awareness",
    influencerCategory: "Nano (1k-10k)", // Fixed: Matches Brand.js Enum
    minEngagement: "1-3%", // Fixed: Matches Brand.js Enum
    platform: "Instagram",
    collabDuration: "1 week", // Fixed: Matches Brand.js Enum
    noteToInfluencer: ""
  });


  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  // Auto-fill effect (Enforces User Data)
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        // Prioritize User Identity Data
        // Only auto-fill if currently empty
        contact: prev.contact || user.email || "",
        nuroId: user.uniqueId || user._id || "",
      }));
    }
  }, [user]);

  // Fetch Existing Profile if editing
  useEffect(() => {
    const fetchProfile = async () => {
      if (user?.token && user?.role === "brand") {
        try {
          setLoading(true);
          const existingProfile = await profileService.getBrand(user.token);
          if (existingProfile) {
            setFormData(prev => ({
              ...prev,
              ...existingProfile,
              // contentType is a single select in form, but contentTypes is array in DB
              contentType: existingProfile.contentTypes?.[0] || prev.contentType,
            }));
            setIsEdit(true);
          }
        } catch (err) {
          console.error("No existing brand profile found", err);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchProfile();
  }, [user]);

  // Load saved draft if NOT editing existing profile
  useEffect(() => {
    if (!isEdit) {
      const saved = localStorage.getItem("brandForm");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (user) {
          parsed.contact = parsed.contact || user.email || "";
          parsed.nuroId = user.uniqueId || user._id || "";
        }
        setFormData(parsed);
      }
    }
  }, [user, isEdit]);

  // Save form data draft on every change
  useEffect(() => {
    if (!isEdit) {
      localStorage.setItem("brandForm", JSON.stringify(formData));
    }
  }, [formData, isEdit]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const response = await chatService.uploadFile(file);
      if (response && response.url) {
        updateField("profileImg", response.url);
      }
    } catch (error) {
      console.error("Image upload failed", error);
      alert("Failed to upload image.");
    } finally {
      setUploading(false);
    }
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Theme Toggle
  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
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
      console.log("Error Response:", error.response?.data); // Added detailed logging
      const msg = error.response?.data?.message || "Failed to create profile. Please try again.";
      alert(msg);
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
          <div className="brand-header-actions" style={{ position: 'absolute', right: '20px', top: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CurrencySelector />
            <button className="brand-toggle-btn" onClick={toggleTheme}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
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
        <p className="brand-subtitle">{isEdit ? "Update your Brand Profile" : "Set up your Brand Profile"}</p>
      </div>

      {/* Form Card */}
      <div className="brand-card">
        {/* Profile Image Section */}
        <div className="brand-photo-section">
          <div className="brand-photo-box">
            {formData.profileImg ? (
              <img src={formData.profileImg} className="brand-photo-preview" />
            ) : (
              <span className="brand-photo-placeholder">🏢</span>
            )}
            {uploading && <div className="photo-loader">...</div>}
          </div>
          <label className="brand-upload-btn">
            {uploading ? "Uploading..." : "Change Profile Photo"}
            <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
          </label>
        </div>

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

            {/* Brand Name */}
            <div className="brand-group">
              <label>Brand Name</label>
              <input
                type="text"
                value={formData.brandName}
                onChange={(e) => updateField("brandName", e.target.value)}
                placeholder="Nurotra Corp"
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
              <label>Contact Email</label>
              <input
                type="text"
                value={formData.contact}
                onChange={(e) => updateField("contact", e.target.value)}
                placeholder="yourmail@company.com"
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


          </div>
        </div>

        {/* Submit Button */}
        <div className="brand-submit-wrapper">
          <button className="btn-primary brand-submit" onClick={submitForm}>
            {isEdit ? "Update Brand Profile" : "Submit Brand Profile"}
          </button>
        </div>

      </div>
    </div>
  );
}
