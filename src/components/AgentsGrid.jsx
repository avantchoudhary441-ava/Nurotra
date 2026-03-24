import { useNavigate } from "react-router-dom";
import AgentCard from "./AgentCard";
import { useAuth } from "../context/AuthContext";
import { useState } from "react";
import LoginModal from "./LoginModal";

export default function AgentsGrid() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const agents = [
    {
      id: 1,
      name: "Collaborator Agent",
      role: "Brand ↔ Influencer Collaboration Agent",
      icon: "🤝",
      skills: "Influencer matching • Brand linking",
      status: "online",
      route: "/collab",
    },
    {
      id: 2,
      name: "Docs Agent",
      role: "Bored of creating & maintaining docs?",
      icon: "📄",
      skills: "This is the right place",
      status: "online",
      route: "/docs-agent",
    },
    {
      id: 3,
      name: "Time Agent",
      role: "AI Scheduling Assistant",
      icon: "🕐",
      skills: "Task Planning • Calendar Sync • Reminders",
      status: "online",
      route: "/time-agent",
    },
    {
      id: 4,
      name: "Research Analyst AI",
      role: "Problem Solver",
      icon: "🔍",
      skills: "Insights • Summaries",
      status: "idle",
      route: "coming-soon",
    },
  ];

  return (
    <section className="agents-grid">
      {agents.map((agent) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          onStart={() => {
            if (agent.route === "coming-soon") {
              return alert("This AI agent is coming soon!");
            }
            // Check if user is logged in
            if (!user) {
              setShowLoginModal(true);
              return;
            }

            // Smart Routing: Skip Landing if already onboarded
            if (agent.route === "/collab") {
              if (user.role === "brand") {
                navigate("/brand/dashboard");
                return;
              }
              if (user.role === "influencer") {
                navigate("/influencer/dashboard");
                return;
              }
            }

            navigate(agent.route);
          }}
        />
      ))}

      {/* Login Guard Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </section>
  );
}
