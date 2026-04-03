const mongoose = require("mongoose");

const MeetingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    title: { type: String, required: true },
    startTime: { type: Date, required: true },
    participants: [{
        email: String,
        status: { type: String, enum: ["invited", "confirmed", "declined"], default: "invited" }
    }],
    agenda: { type: String },
    phase: { type: String, enum: ["pre-event", "post-event"], default: "pre-event" },
    status: { type: String, enum: ["scheduled", "ongoing", "finished", "cancelled"], default: "scheduled" },
    context: {
        originalPrompt: String
    },
    automation: {
        reminderSent: { type: Boolean, default: false },
        summarySent: { type: Boolean, default: false }
    }
}, { timestamps: true });

module.exports = mongoose.model("Meeting", MeetingSchema);
