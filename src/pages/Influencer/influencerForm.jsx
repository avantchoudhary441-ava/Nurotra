import "../../styles/influencerForm.css";
import { useState } from "react";
import logo from "../../assets/NurotraLogo.png";
import { useNavigate } from "react-router-dom";

export default function InfluencerForm() {
  const [workedBefore, setWorkedBefore] = useState("No");
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

      {/* CENTERED LOGO */}
      <div className="inf-logo-center">
        <img src={logo} className="inf-logo-big" alt="Logo" />
        <h2 className="inf-logo-title">CollabAI</h2>
      </div>

      {/* HEADER TEXT */}
      <div className="inf-header">
        <h1>
          Set Up Your <span className="gradient-text">Influencer Profile</span>
        </h1>
      </div>

      {/* ⭐ THE ACTUAL FORM (Corrected) ⭐ */}
      <form className="inf-form">

        {/* AUTO-ID */}
        <div className="inf-group">
          <label>Nuro ID</label>
          <input type="text" value="I-001" disabled className="inf-disabled" />
        </div>

        {/* Email */}
        <div className="inf-group">
          <label>Email</label>
          <input type="email" placeholder="you@example.com" required />
        </div>

        {/* Instagram Link */}
        <div className="inf-group">
          <label>Instagram Profile URL</label>
          <input
            type="url"
            placeholder="https://instagram.com/yourprofile"
            className="inf-link"
            required
          />
        </div>

        {/* Followers */}
        <div className="inf-group">
          <label>Follower Count</label>
          <select>
            <option>1k – 10k</option>
            <option>10k – 50k</option>
            <option>50k – 100k</option>
            <option>100k+</option>
          </select>
        </div>

        {/* DP Upload */}
        <div className="inf-group">
          <label>Profile Picture</label>
          <input type="file" accept="image/*" />
        </div>

        {/* Worked Before Toggle */}
        <div className="inf-group">
          <label>Previous Brand Collaboration</label>
          <select
            value={workedBefore}
            onChange={(e) => setWorkedBefore(e.target.value)}
          >
            <option>No</option>
            <option>Yes</option>
          </select>
        </div>

        {/* Show Brand Name if YES */}
        {workedBefore === "Yes" && (
          <div className="inf-group fade-in">
            <label>Brand Name</label>
            <input type="text" placeholder="Eg: Nike" />
          </div>
        )}

        <h2 className="inf-section">Collaboration Preferences</h2>

        {/* Content Type */}
        <div className="inf-group">
          <label>Content Type Offered</label>
          <div className="inf-checkboxes">
            <label><input type="checkbox" /> Reels</label>
            <label><input type="checkbox" /> Posts</label>
            <label><input type="checkbox" /> Stories</label>
            <label><input type="checkbox" /> ALL</label>
          </div>
        </div>

        {/* Budget */}
        <div className="inf-group">
          <label>Minimum Budget Expectation</label>
          <input type="number" placeholder="₹ Enter amount" />
        </div>

        {/* Brand Type */}
        <div className="inf-group">
          <label>Preferred Brand Type</label>
          <select>
            <option>Fitness</option>
            <option>Tech</option>
            <option>Beauty</option>
            <option>Lifestyle</option>
            <option>Fashion</option>
            <option>Food</option>
          </select>
        </div>

        {/* Niche */}
        <div className="inf-group">
          <label>Niche</label>
          <input type="text" placeholder="Fitness, Travel, Tech..." />
        </div>

        <button className="btn-primary inf-submit">Submit Profile</button>
      </form>
    </div>
  );
}
