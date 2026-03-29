const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true
    },
    phone: {
        type: String,
        trim: true
    },
    platform: {
        type: String,
        enum: ["email", "slack", "whatsapp"],
        default: "email"
    },
    preferredPlatform: {
        type: String,
        enum: ["email", "slack", "whatsapp"],
        default: "email"
    },
    groups: [{
        type: String,
        trim: true
    }],
    metadata: {
        notes: { type: String, default: "" },
        lastContacted: { type: Date },
        responseRate: { type: Number, default: 0 }, // 0-100 percentage
        totalMessagesSent: { type: Number, default: 0 },
        totalReplies: { type: Number, default: 0 },
        relationshipRole: { type: String, default: "" }, // e.g. "Boss", "Professor", "Client"
        relationshipContext: { type: String, default: "" } // extra context about this person
    },
    isArchived: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Compound index for fast lookups
contactSchema.index({ userId: 1, email: 1 }, { unique: true, sparse: true });
contactSchema.index({ userId: 1, groups: 1 });

module.exports = mongoose.model("Contact", contactSchema);
