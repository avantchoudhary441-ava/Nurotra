import { useState } from "react";

import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/auth/login";
import Signup from "./pages/auth/signUp";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Categories from "./components/Categories";
import AgentsGrid from "./components/AgentsGrid";
import Footer from "./components/Footer";
import BackgroundEffects from "./components/BackgroundEffects";
import CollabLanding from "./pages/collabAI/collabLanding";
import InfluencerForm from "./pages/Influencer/influencerForm";
import BrandForm from "./pages/brand/brandForm";




import "./styles/global.css";
import "./styles/header.css";
import "./styles/hero.css";
import "./styles/categories.css";
import "./styles/agents.css";
import "./styles/footer.css";
import "./styles/background.css";

export default function App() {
  return (
    <Routes>

      {/* MAIN LANDING PAGE */}
      <Route
        path="/"
        element={
          <>
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
  <Route path="/influencer-form" element={<InfluencerForm />} />
  <Route path="/brand-form" element={<BrandForm />} />

    </Routes>
  );
}
