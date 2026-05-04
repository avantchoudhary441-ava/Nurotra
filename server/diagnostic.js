const routes = [
    "./routes/authRoutes",
    "./routes/brandRoutes",
    "./routes/influencerRoutes",
    "./routes/matchRoutes",
    "./routes/chatRoutes",
    "./routes/messageRoutes",
    "./routes/uploadRoutes",
    "./routes/nuroRoutes",
    "./routes/docsAgentRoutes",
    "./routes/workspaceRoutes",
    "./routes/deliverableRoutes",
    "./routes/healthRoutes",
    "./routes/adminRoutes",
    "./routes/timeAgentRoutes",
    "./routes/orchestratorRoutes",
    "./routes/communicationRoutes",
    "./routes/integrationRoutes"
];

require("dotenv").config();

console.log("Checking dependencies...");
try {
    require("./config/db");
    require("./config/passport");
    require("./models/User");
    console.log("✅ Core configs and User model loaded.");
} catch (err) {
    console.error("❌ Core Load Error:", err.message);
    process.exit(1);
}

routes.forEach(route => {
    try {
        console.log(`Loading ${route}...`);
        require(route);
        console.log(`✅ ${route} loaded.`);
    } catch (err) {
        console.error(`❌ Error loading ${route}:`, err.message);
        console.error(err.stack);
    }
});
