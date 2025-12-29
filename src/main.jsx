import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "./context/AuthContext";
import "./styles/global.css";
import App from "./App.jsx";
import { HashRouter } from "react-router-dom";


// 🔥 Load saved theme BEFORE React renders (important for no flash)
const savedTheme = localStorage.getItem("theme") || "light";
document.documentElement.setAttribute("data-theme", savedTheme);

import { NuroProvider } from "./context/NuroContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <NuroProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </NuroProvider>
    </AuthProvider>
  </StrictMode>
);
