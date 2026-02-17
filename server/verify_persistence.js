require('dotenv').config();
const mongoose = require('mongoose');
const Project = require('./models/Project');
const Document = require('./models/Document');
const connectDB = require('./config/db');

async function verifyPersistence() {
    await connectDB();
    const mockUserId = new mongoose.Types.ObjectId(); // Simulation

    console.log("--- Testing Persistence ---");

    try {
        // 1. Create Project
        const project = new Project({
            name: "Test Strategy",
            motive: "Verify backend",
            userId: mockUserId
        });
        await project.save();
        console.log("✅ Project Created:", project.name);

        // 2. Create Document
        const doc = new Document({
            name: "Execution Plan.docx",
            type: "word",
            content: "# Verification Plan\nPersistent storage works.",
            projectId: project._id,
            userId: mockUserId,
            metadata: { purpose: "Testing", category: "Dev" }
        });
        await doc.save();
        console.log("✅ Document Created:", doc.name);

        // 3. Fetch Projects
        const projects = await Project.find({ userId: mockUserId });
        const docs = await Document.find({ projectId: project._id });

        console.log(`✅ Retrieval: Found ${projects.length} projects and ${docs.length} documents for that project.`);

        // Clean up
        await Project.deleteOne({ _id: project._id });
        await Document.deleteOne({ _id: doc._id });
        console.log("🧹 Cleanup successful.");

    } catch (e) {
        console.error("❌ Verification Failed:", e);
    } finally {
        mongoose.connection.close();
    }
}

verifyPersistence();
