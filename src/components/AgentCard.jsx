import { useNavigate } from "react-router-dom";

export default function AgentCard({ agent, onStart }) {
 
  return (
    <div className="agent-card">
      <div className="agent-inner">

        <div className="icon">{agent.icon}</div>
        <h3>{agent.name}</h3>
        <p className="role">{agent.role}</p>
        <p className="skills">{agent.skills}</p>

        <div className="status-row">
          <span className={`status-pill ${agent.status}`}>
            <span className="dot"></span>
            {agent.status === "online" ? "Online" : "Idle"}
          </span>

          <a href="#" className="details-link">
            View profile →
          </a>
        </div>

        {/* IMPORTANT FIX */}
        <button className="btn-secondary" onClick={() => onStart(agent)}>
  Start Task
</button>


      </div>
    </div>
  );
}
