import { useState } from "react";
import { BrowserRouter, Routes, Route, useLocation, useParams } from "react-router-dom";
import Login from "./pages/auth/login";
import Signup from "./pages/auth/signUp";
import OtpVerify from "./pages/auth/OtpVerify";
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
import ChatPage from "./pages/chat/ChatPage";
import CollabConclusionPage from "./pages/chat/CollabConclusionPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import InfluencerMatchingForm from "./pages/Influencer/InfluencerMatchingForm";
import BrandMatchingForm from "./pages/brand/BrandMatchingForm";

import NuroOrb from "./components/Nuro/NuroOrb";
import NuroLab from "./pages/Nuro/NuroLab";
import NuroInterrupt from "./components/Nuro/NuroInterrupt";
import DeliverablesDashboard from "./pages/DeliverablesDashboard";
import Overview from "./pages/dashboard/Overview";
import CollabInsights from "./pages/CollabInsights";
import History from "./pages/History";
import SafetyTrust from "./pages/SafetyTrust";
import DocsAgentPage from "./pages/DocsAgent/DocsAgentPage";
import TimeAgentPage from "./pages/TimeAgent/TimeAgentPage";
import NuroDashboard from "./components/Nuro/NuroDashboard";
import CommunicationAgentPage from "./pages/CommunicationAgent/CommunicationAgentPage";
import OrchestratorLayout from "./components/Orchestrator/OrchestratorLayout";


import { NuroCoreProvider } from "./context/NuroCoreContext";
import { SocketProvider } from "./context/SocketContext";
import { CurrencyProvider } from "./context/CurrencyContext";



export default function App() {
  const location = useLocation();
  const isCollabRoute =
    location.pathname.startsWith('/influencer') ||
    location.pathname.startsWith('/brand') ||
    location.pathname.startsWith('/collab') ||
    location.pathname.startsWith('/chat') ||
    location.pathname.startsWith('/match-results');

  return (
    <NuroCoreProvider>
      <CurrencyProvider>
        <SocketProvider>
          {isCollabRoute && <NuroOrb />}
          <NuroInterrupt />
          <Routes>

            {/* MAIN LANDING PAGE */}
            <Route path="/influencer/overview" element={<Overview />} />
            <Route path="/brand/overview" element={<Overview />} />



            <Route path="/" element={<OrchestratorLayout />} />

            <Route
              path="/agents"
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
            {/* If userId is present, an Influencer is inspecting a Brand */}
            <Route path="/influencer/profile/:userId?" element={<InspectionRoute owner={<InfluencerDashboard />} target={<BrandDashboard />} />} />

            <Route path="/brand-form" element={<BrandForm />} />
            <Route path="/brand/dashboard" element={<BrandDashboard />} />
            {/* If userId is present, a Brand is inspecting an Influencer */}
            <Route path="/brand/profile/:userId?" element={<InspectionRoute owner={<BrandDashboard />} target={<InfluencerDashboard />} />} />
            <Route path="/brand/matching" element={<BrandMatchingForm />} />
            <Route path="/brand/matching-standards/:userId?" element={<InspectionRoute owner={<BrandMatchingForm />} target={<InfluencerMatchingForm />} />} />
            <Route path="/match-results" element={<MatchResultPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/collab-conclusion" element={<CollabConclusionPage />} />
            <Route path="/influencer/matching" element={<InfluencerMatchingForm />} />
            <Route path="/influencer/matching-standards/:userId?" element={<InspectionRoute owner={<InfluencerMatchingForm />} target={<BrandMatchingForm />} />} />
            <Route path="/admin/*" element={<AdminDashboard />} />
            <Route path="/profile" element={<UserProfile />} />

            <Route path="/influencer/deliverables/:userId?" element={<InspectionRoute owner={<DeliverablesDashboard role="influencer" />} target={<DeliverablesDashboard role="brand" />} />} />
            <Route path="/brand/deliverables/:userId?" element={<InspectionRoute owner={<DeliverablesDashboard role="brand" />} target={<DeliverablesDashboard role="influencer" />} />} />

            <Route path="/influencer/collab-insights" element={<CollabInsights role="influencer" />} />
            <Route path="/brand/collab-insights" element={<CollabInsights role="brand" />} />
            <Route path="/influencer/history" element={<History role="influencer" />} />
            <Route path="/brand/history" element={<History role="brand" />} />
            <Route path="/influencer/safety/:userId?" element={<InspectionRoute owner={<SafetyTrust role="influencer" />} target={<SafetyTrust role="brand" />} />} />
            <Route path="/brand/safety/:userId?" element={<InspectionRoute owner={<SafetyTrust role="brand" />} target={<SafetyTrust role="influencer" />} />} />


            <Route path="/nuro-lab" element={<NuroLab />} />
            <Route path="/docs-agent" element={<DocsAgentPage />} />
            <Route path="/time-agent" element={<TimeAgentPage />} />
            <Route path="/nuro-dashboard" element={<NuroDashboard />} />
            <Route path="/communication-agent" element={<CommunicationAgentPage />} />

            {/* 404 Debug Catch-all */}
            <Route path="*" element={
              <div style={{ color: 'white', padding: '50px', marginLeft: '250px' }}>
                <h1>404 - Page Not Found</h1>
                <p>Current Location: {location.pathname}</p>
              </div>
            } />

          </Routes>
        </SocketProvider>
      </CurrencyProvider>
    </NuroCoreProvider>
  );
}

// Helper to handle inspection mode swapping
function InspectionRoute({ owner, target }) {
  const { userId } = useParams();
  // If we have a userId param, show the target (inspection view)
  // Otherwise show the owner view (dashboard)
  return userId ? target : owner;
}




