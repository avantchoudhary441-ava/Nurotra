import logo from "../assets/NurotraLogo.png";

export default function Hero() {
  return (
    <>
      <div className="hero-logo-wrap">
        <div className="logo-bg-glow"></div>
        <img src={logo} className="hero-logo" alt="Nurotra Logo" />
      </div>

      <section className="hero">
        <h1>
          Meet Your <span className="gradient-text">AI Workforce</span>
        </h1>
        <p>Specialized AI agents ready to work for you.</p>

        <div className="search-wrapper">
          <input
            className="search-bar"
            type="text"
            placeholder="Search your agents..."
          />
        </div>
      </section>
    </>
  );
}
