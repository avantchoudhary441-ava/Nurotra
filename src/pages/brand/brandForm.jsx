import "../../styles/influencerForm.css"; // reusing same premium styling
import { useNavigate } from "react-router-dom";
import logo from "../../assets/NurotraLogo.png";
import { useState } from "react";

export default function BrandForm() {
  const navigate = useNavigate();

  // 🌗 Theme Toggle
  const toggleTheme = () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  return (
    <div className="inf-wrapper">

      {/* Glow Background */}
      <div className="inf-glow"></div>

      {/* TOP BAR */}
      <div className="inf-top">
        <button onClick={() => navigate(-1)} className="inf-back-btn">← Back</button>

        <div className="inf-top-right">
          <button onClick={toggleTheme} className="inf-toggle-btn">🌙</button>

          <div className="inf-profile-icon">
            <span>👤</span>
          </div>
        </div>
      </div>

      {/* CENTER LOGO */}
      <div className="inf-logo-center">
        <img src={logo} className="inf-logo-big" alt="Logo" />
        <h2 className="inf-logo-title">CollabAI</h2>
      </div>

      {/* HEADER TEXT */}
      <div className="inf-header">
        <h1>
          Brand <span className="gradient-text">Collaboration Profile</span>
        </h1>
        <p>Help CollabAI find influencers that match your brand perfectly.</p>
      </div>

      {/* BRAND FORM */}
      <form className="inf-form">

        {/* Auto ID */}
        <div className="inf-group">
          <label>Nuro ID</label>
          <input type="text" value="B-001" disabled className="inf-disabled" />
        </div>

        {/* Website / Instagram */}
        <div className="inf-group">
          <label>Website / Instagram Link</label>
          <input
            type="url"
            placeholder="https://yourbrand.com or https://instagram.com/brand"
            className="inf-link"
            required
          />
        </div>

        {/* Company Type */}
        <div className="inf-group">
          <label>Company Type</label>
          <select>
            <option>Startup</option>
            <option>Small Business</option>
            <option>Medium</option>
            <option>Enterprise</option>
          </select>
        </div>

        {/* Email or phone */}
        <div className="inf-group">
          <label>Contact Info</label>
          <input type="text" placeholder="Email or mobile number" required />
        </div>

        <h2 className="inf-section">Collaboration Preferences</h2>

        {/* Industry / Niche */}
        <div className="inf-group">
          <label>Industry / Niche</label>
          <select>
            <option>Fitness</option>
            <option>Tech</option>
            <option>Beauty</option>
            <option>Lifestyle</option>
            <option>Fashion</option>
            <option>Food</option>
            <option>Gaming</option>
            <option>Education</option>
          </select>
        </div>

        {/* Preferred Content Type */}
        <div className="inf-group">
          <label>Preferred Content Type</label>
          <div className="inf-checkboxes">
            <label><input type="checkbox" /> Reels</label>
            <label><input type="checkbox" /> Posts</label>
            <label><input type="checkbox" /> Stories</label>
            <label><input type="checkbox" /> ALL</label>
          </div>
        </div>

        {/* Budget */}
        <div className="inf-group">
          <label>Budget</label>
          <input type="number" placeholder="₹ Enter budget amount" required />
        </div>

        <button className="btn-primary inf-submit">Submit Profile</button>
      </form>
    </div>
  );
}
