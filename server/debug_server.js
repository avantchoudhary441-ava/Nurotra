require("dotenv").config();
const express = require("express");
const app = express();
const PORT = 5001; // Use a different port to avoid conflict

app.get("/ping", (req, res) => res.send("pong"));

console.log("Attempting to start debug server...");
app.listen(PORT, () => {
    console.log(`Debug server running on port ${PORT}`);
});
