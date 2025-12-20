import { useState } from "react";

import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/auth/login";
import Signup from "./pages/auth/signUp";
import OtpVerify from "./pages/auth/OtpVerify"; // Import OTP Page
import Header from "./components/Header";
import Hero from "./components/Hero";
import Categories from "./components/Categories";
import AgentsGrid from "./components/AgentsGrid";
import Footer from "./components/Footer";
import BackgroundEffects from "./components/BackgroundEffects";
import CollabLanding from "./pages/collabAI/collabLanding";
import InfluencerForm from "./pages/Influencer/influencerForm";
import BrandForm from "./pages/brand/brandForm";

import BrandDashboard from "./pages/brand/brandDashboard";
import UserProfile from "./pages/UserProfile";




import "./styles/global.css";
import "./styles/header.css";
import "./styles/hero.css";
import "./styles/categories.css";
import "./styles/agents.css";
import "./styles/footer.css";
import "./styles/background.css";
import InfluencerDashboard from "./pages/Influencer/InfluencerDashboard.jsx";
import MatchResultPage from "./pages/match/MatchResultPage";
import ChatPage from "./pages/chat/ChatPage"; // Import Match Results
import AdminDashboard from "./pages/admin/AdminDashboard";
import InfluencerMatchingForm from "./pages/Influencer/InfluencerMatchingForm";
import BrandMatchingForm from "./pages/brand/BrandMatchingForm";

export default function App() {
  return (
    <Routes>

      {/* MAIN LANDING PAGE */}
      <Route
        path="/"
        element={
          <>
            <BackgroundEffects />
            <Header />
            <Hero />
            <Categories />
            <AgentsGrid />
            <Footer />

          </>
        }
      />

      {/* COLLBAI AGENT PAGE */}
      <Route path="/collab" element={<CollabLanding />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/verify-otp" element={<OtpVerify />} />
      <Route path="/influencer-form" element={<InfluencerForm />} />
      <Route path="/influencer/dashboard" element={<InfluencerDashboard />} />
      <Route path="/brand-form" element={<BrandForm />} />
      <Route path="/brand/dashboard" element={<BrandDashboard />} />
      <Route path="/brand/matching" element={<BrandMatchingForm />} />
      <Route path="/brand/matching-standards" element={<BrandMatchingForm />} />
      <Route path="/match-results" element={<MatchResultPage />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/influencer/matching" element={<InfluencerMatchingForm />} />
      <Route path="/influencer/matching-standards" element={<InfluencerMatchingForm />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/profile" element={<UserProfile />} />

    </Routes>

  );
}
