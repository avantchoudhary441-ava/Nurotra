import { useNavigate } from "react-router-dom";
import AgentCard from "./AgentCard";

export default function AgentsGrid() {
  const navigate = useNavigate();
  const agents = [
    {
      id: 1,
      name: "CollabAI",
      role: "Brand ↔ Influencer Collaboration AI",
      icon: "🤝",
      skills: "Influencer matching • Brand linking",
      status: "online",
      
       route: "/collab", 
    },
    {
      id: 2,
      name: "Code Engineer AI",
      role: "Senior Developer",
      icon: "👨‍💻",
      skills: "Bug fixing • Code generation",
      status: "online",
       route: "coming-soon" , 
    },
    {
      id: 3,
      name: "Marketing Expert AI",
      role: "Brand Strategist",
      icon: "📣",
      skills: "Ads • Reels • Branding",
      status: "online",
       route: "coming-soon" , 
    },
    {
      id: 4,
      name: "Research Analyst AI",
      role: "Problem Solver",
      icon: "🔍",
      skills: "Insights • Summaries",
      status: "idle",
       route: "coming-soon" , 
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
    navigate(agent.route);
  }}
        />
      ))}
    </section>
  );
}
