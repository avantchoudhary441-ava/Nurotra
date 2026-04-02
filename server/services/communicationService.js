const OpenAI = require("openai");
const CommunicationFactory = require("./communication/CommunicationFactory");
const Contact = require("../models/Contact");
const CommMessage = require("../models/CommMessage");
const CommRule = require("../models/CommRule");
const Meeting = require("../models/Meeting");
const BulkCampaign = require("../models/BulkCampaign");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── SYSTEM PROMPT ──────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the Communication Agent for Nurotra's AI Workforce Platform.
You act as the user's intelligent communication layer — executing, managing, and optimizing all communication across platforms.

Your core capabilities:
1. SEND MESSAGES: Send emails on behalf of the user via Gmail.
2. AUTO FOLLOW-UPS: Configure automatic follow-ups if recipients don't reply.
3. TASK BROADCASTS: Notify stakeholders when tasks are completed.
4. CONTEXT-AWARE DRAFTS: Generate intelligent, relevant messages using context from other agents.
5. MULTI-PLATFORM ROUTING: Route messages to email or Slack.
6. COMMUNICATION MEMORY: Remember past conversations and patterns.
7. FAILURE HANDLING: Retry failed messages and escalate failures.
8. DAILY DIGEST: Generate summaries of all communication activity.
9. MEETING COMMUNICATION: Send invitations, reminders, and updates for meetings.
10. BULK + PERSONALIZED: Send messages to multiple recipients with personal touches.

CRITICAL INSTRUCTIONS:
- You MUST respond with valid JSON only. No markdown, no code fences, no explanations outside the JSON.
- Classify the user's intent and extract structured data based on the entire conversation history.
- MANDATORY INFORMATION GATHERING: Before executing an intent, you MUST ensure all required parameters are provided. If ANY required parameter is missing, you MUST set "needs_clarification": true and ask a natural, conversational question in "clarification_question" to get the missing info. DO NOT guess or hallucinate missing information.
  * "send_message": REQUIRES "recipients", "body" (or detailed context to auto-generate the body), and "platform". If "platform" is missing, explicitly ask "Which platform should I use to send this (e.g., Email, Slack)?"
  * "draft_message": REQUIRES "context" (what to write), "recipients", and "platform".
  * "setup_followup": REQUIRES "recipients" and "timing".
  * "broadcast_completion" or "meeting_comm": REQUIRES "recipients" and "context".
  * "bulk_send": REQUIRES "recipients" and "body" or "context".
- HIGH-QUALITY DRAFTS: If the user asks you to draft a message, but their context is a vague single word or short phrase (e.g., "life", "update"), you MUST set "needs_clarification": true and ask specific questions (e.g., "What is the goal of the email?", "What tone should I use?", "Any key points to mention?") before creating the draft.
- MEETING LIFECYCLE: When a meeting is mentioned:
  1. PRE-EVENT: Gather "recipients", "startTime" (ask Time Agent or user), and "agenda". Ask if "relatedDocs" (Docs Agent) should be attached.
  2. EXECUTION: Set intent as "meeting_lifecycle". 
  3. POST-EVENT: If a meeting just finished, suggest "meeting_summary" or "task_distribution".
- BULK & PERSONALIZED: When a user wants to send a message to multiple people (e.g., "all investors", "marketing team"):
  1. Determine the RECIPIENTS (lookup groups or contacts).
  2. Identify placeholders for personalization (e.g., "name").
  3. Set intent as "bulk_personalized".
  4. NEVER send BCC; use this intent to trigger individual sends.
- ITERATIVE DRAFTING & VERIFICATION: NEVER auto-send a drafted message unless the user explicitly says "send it" AFTER reviewing the draft. If the user asks for changes (e.g. "make it more formal", "add missing details"), classify the intent as "draft_message" so it can be regenerated based on their feedback. Provide context notes containing their requested changes to the draft logic.

Respond with this exact JSON structure:
{
  "intent": "send_message|setup_followup|broadcast_completion|draft_message|platform_route|recall_history|retry_failed|daily_digest|meeting_comm|bulk_send|manage_contacts|meeting_lifecycle|bulk_personalized|general_chat",
  "needs_clarification": true/false,
  "clarification_question": "question if needs_clarification is true",
  "extracted_data": {
    "recipients": ["email/name array"],
    "group_name": "group name if applicable",
    "subject": "subject",
    "body": "base message body",
    "placeholders": ["name", "company"],
    "context": "project/task context",
    "campaign_title": "title for the campaign",
    "personalize": true
  },
  "response_text": "Your natural language response to the user if needs_clarification is false"
}`;

// ─── INTENT CLASSIFICATION ──────────────────────────────────────────────────
async function classifyIntent(prompt, history = []) {
    try {
        const messages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...history.slice(-10), // Last 10 turns for context
            { role: "user", content: prompt }
        ];

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages,
            temperature: 0.3
        });

        return JSON.parse(response.choices[0].message.content);
    } catch (error) {
        console.error("[CommService] Intent classification failed:", error.message);
        return {
            intent: "general_chat",
            needs_clarification: false,
            extracted_data: {},
            response_text: "I encountered an issue processing your request. Could you try rephrasing?"
        };
    }
}

// ─── §2.1 MESSAGE EXECUTION ────────────────────────────────────────────────
async function executeSendMessage(userId, data) {
    const { recipients = [], subject, body, platform = "email" } = data;

    if (!recipients.length || !body) {
        return {
            success: false,
            message: "I need a recipient and message content. Who should I send this to, and what should I say?"
        };
    }

    const results = [];

    for (const recipient of recipients) {
        try {
            if (platform) {
                // Send dynamically via Factory (Email, WhatsApp, etc)
                const adapter = CommunicationFactory.getService(platform);
                const adapterResult = await adapter.sendMessage(userId, {
                    recipients: [recipient],
                    subject: subject || "Message from Nurotra",
                    body
                });

                if (!adapterResult.success) {
                    throw new Error("Adapter failed to send message.");
                }
            }

            // Find or create contact
            let contact = await Contact.findOne({ userId, email: recipient });
            if (!contact) {
                contact = await Contact.create({
                    userId,
                    name: recipient.split("@")[0],
                    email: recipient,
                    platform
                });
            }

            // Log message
            const msg = await CommMessage.create({
                userId,
                contactId: contact._id,
                direction: "sent",
                platform,
                subject: subject || "",
                body,
                recipientEmail: recipient,
                recipientName: contact.name,
                status: "sent",
                sentAt: new Date()
            });

            // Update contact stats
            await Contact.findByIdAndUpdate(contact._id, {
                $inc: { "metadata.totalMessagesSent": 1 },
                $set: { "metadata.lastContacted": new Date() }
            });

            results.push({ recipient, status: "sent", messageId: msg._id });

        } catch (err) {
            console.error(`[CommService] Email to ${recipient} failed:`, err.message);

            // Log failed message for retry
            await CommMessage.create({
                userId,
                direction: "sent",
                platform,
                subject: subject || "",
                body,
                recipientEmail: recipient,
                status: "failed",
                retry: { lastError: err.message }
            });

            results.push({ recipient, status: "failed", error: err.message });
        }
    }

    const successCount = results.filter(r => r.status === "sent").length;
    const failures = results.filter(r => r.status === "failed");
    let returnMessage = successCount === recipients.length
        ? `✅ Successfully sent ${successCount} message(s).`
        : `Sent ${successCount}/${recipients.length} messages. ${failures.length} failed.`;

    if (failures.length > 0) {
        const errorDetails = failures.map(f => `${f.recipient}: ${f.error}`).join(" | ");
        returnMessage += `\n❌ Reasons: ${errorDetails}`;
    }

    return {
        success: successCount > 0,
        results,
        message: returnMessage
    };
}

// ─── §2.2 AUTO FOLLOW-UP ───────────────────────────────────────────────────
async function configureFollowUp(userId, data) {
    const { recipients = [], timing = 48, maxAttempts = 3, priority = "medium" } = data;

    if (!recipients.length) {
        return {
            success: false,
            message: "Who should I follow up with? Give me an email or contact name."
        };
    }

    const rules = [];
    for (const recipient of recipients) {
        const rule = await CommRule.create({
            userId,
            type: "follow_up",
            name: `Follow-up: ${recipient}`,
            trigger: {
                event: "no_reply",
                condition: `after ${timing} hours`,
                timingHours: timing
            },
            action: {
                template: "Hi, just following up on my previous message. Let me know if you need anything!",
                recipients: [recipient],
                platform: "email"
            }
        });
        rules.push(rule);

        // Mark recent messages to this recipient for follow-up
        await CommMessage.updateMany(
            { userId, recipientEmail: recipient, replyReceived: false, "followUp.enabled": false },
            {
                $set: {
                    "followUp.enabled": true,
                    "followUp.intervalHours": timing,
                    "followUp.maxAttempts": maxAttempts,
                    "followUp.priority": priority,
                    "followUp.nextFollowUpAt": new Date(Date.now() + timing * 3600000)
                }
            }
        );
    }

    return {
        success: true,
        rules,
        message: `🔔 Follow-up configured! I'll automatically follow up with ${recipients.join(", ")} if they don't reply within ${timing} hours. Maximum ${maxAttempts} follow-ups per contact.`
    };
}

// ─── §2.3 TASK BROADCAST ───────────────────────────────────────────────────
async function broadcastUpdate(userId, data) {
    const { recipients = [], context = "", body = "" } = data;

    if (!recipients.length) {
        return {
            success: false,
            message: "Who should I notify? Give me the stakeholder emails or a group name."
        };
    }

    const broadcastBody = body || `Task Update: ${context || "A task has been completed."}`;

    const result = await executeSendMessage(userId, {
        recipients,
        subject: `[Nurotra] Task Update: ${context || "Completed"}`,
        body: broadcastBody,
        platform: "email"
    });

    // Create broadcast rule for future
    await CommRule.create({
        userId,
        type: "broadcast",
        name: `Broadcast: ${context || "Task completion"}`,
        trigger: { event: "task_complete", condition: context },
        action: { template: broadcastBody, recipients, platform: "email" },
        executionCount: 1,
        lastExecutedAt: new Date()
    });

    return {
        success: result.success,
        message: `📢 Broadcast sent to ${recipients.length} stakeholder(s): ${recipients.join(", ")}.`
    };
}

// ─── §2.4 CONTEXT-AWARE DRAFTING ────────────────────────────────────────────
async function draftContextual(userId, data, history = []) {
    const { recipients = [], context = "", body = "" } = data;

    try {
        // Format previous inputs to guide the drafting
        const historyText = history.length 
            ? history.slice(-5).map(m => `${m.role}: ${m.content}`).join('\\n') 
            : "";

        const draftPrompt = `Draft a professional but warm email leveraging the details discussed below. Make sure to apply any specific tone, instructions, or changes the user requested recently.

Current Context/Topic: ${context}
${body ? `User specific instructions: ${body}` : ""}
${recipients.length ? `Recipients: ${recipients.join(", ")}` : ""}

Recent Conversation History (use this for tone, context, and requested edits):
${historyText}

Write ONLY the finalized email body. Keep it structured, action-oriented, and perfectly aligned with the user's constraints.`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: draftPrompt }],
            temperature: 0.7
        });

        const draft = response.choices[0].message.content;

        return {
            success: true,
            draft,
            message: `📝 Here's your draft:\n\n${draft}\n\nWould you like me to send this, or should I adjust anything?`
        };
    } catch (err) {
        return {
            success: false,
            message: "I couldn't generate a draft right now. Please try again."
        };
    }
}

// ─── §2.5 MULTI-PLATFORM ROUTING ───────────────────────────────────────────
async function routeToPlatform(userId, data) {
    const { platform = "email" } = data;

    if (platform === "slack") {
        return {
            success: false,
            message: "🔗 Slack integration is not connected yet. Please connect your Slack workspace in Settings to enable this feature. For now, I can send via email."
        };
    }

    if (platform === "whatsapp") {
        return {
            success: false,
            message: "📱 WhatsApp integration requires account connection. This feature is coming soon! For now, I can send via email."
        };
    }

    // Default to email execution
    return await executeSendMessage(userId, data);
}

// ─── §2.6 COMMUNICATION MEMORY ─────────────────────────────────────────────
async function queryMemory(userId, data) {
    const { recipients = [], context = "" } = data;

    const query = { userId };
    if (recipients.length) {
        query.recipientEmail = { $in: recipients };
    }

    const messages = await CommMessage.find(query)
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

    if (!messages.length) {
        return {
            success: true,
            messages: [],
            message: "📭 No communication history found. Start a conversation and I'll remember everything!"
        };
    }

    const summary = messages.map(m =>
        `[${m.direction.toUpperCase()}] ${m.recipientEmail || "Unknown"} — "${m.subject || m.body.substring(0, 50)}..." (${m.status}, ${new Date(m.sentAt || m.createdAt).toLocaleDateString()})`
    ).join("\n");

    return {
        success: true,
        messages,
        message: `📋 Here's your recent communication history:\n\n${summary}`
    };
}

// ─── §2.7 FAILURE HANDLING & RETRY ──────────────────────────────────────────
async function retryMessage(userId, data) {
    const failedMessages = await CommMessage.find({
        userId,
        status: "failed",
        "retry.attempts": { $lt: 3 }
    }).limit(10);

    if (!failedMessages.length) {
        return {
            success: true,
            message: "✅ No failed messages to retry. All clear!"
        };
    }

    let retried = 0;
    for (const msg of failedMessages) {
        try {
            if (msg.platform && msg.recipientEmail) {
                const adapter = CommunicationFactory.getService(msg.platform);
                await adapter.sendMessage(userId, {
                    recipients: [msg.recipientEmail],
                    subject: msg.subject || "Message from Nurotra",
                    body: msg.body
                });

                msg.status = "sent";
                msg.sentAt = new Date();
                retried++;
            }
        } catch (err) {
            msg.retry.lastError = err.message;
        }

        msg.retry.attempts += 1;
        await msg.save();
    }

    const failedRetries = failedMessages.filter(m => m.status === "failed");
    let returnMessage = `🔄 Retried ${failedMessages.length} message(s). ${retried} succeeded, ${failedMessages.length - retried} still failing.`;

    if (failedRetries.length > 0) {
        const errorDetails = failedRetries.map(f => `${f.recipientEmail}: ${f.retry.lastError}`).join(" | ");
        returnMessage += `\n❌ Reasons: ${errorDetails}`;
    }

    return {
        success: true,
        message: returnMessage
    };
}

// ─── §2.8 DAILY DIGEST ─────────────────────────────────────────────────────
async function generateDigest(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Core aggregates
    const [sentCount, receivedCount, failedCount, pendingFollowUps] = await Promise.all([
        CommMessage.countDocuments({ userId, direction: "sent", sentAt: { $gte: today } }),
        CommMessage.countDocuments({ userId, direction: "received", createdAt: { $gte: today } }),
        CommMessage.countDocuments({ userId, status: "failed" }),
        CommMessage.countDocuments({ userId, "followUp.enabled": true, replyReceived: false })
    ]);

    // 2. Platform breakdown
    const platformStats = await CommMessage.aggregate([
        { $match: { userId, createdAt: { $gte: today } } },
        {
            $group: {
                _id: "$platform",
                sent: { $sum: { $cond: [{ $eq: ["$direction", "sent"] }, 1, 0] } },
                received: { $sum: { $cond: [{ $eq: ["$direction", "received"] }, 1, 0] } }
            }
        }
    ]);

    // 3. Flagged Items
    const flagged = [];

    // Failed messages
    const failures = await CommMessage.find({ userId, status: "failed" })
        .limit(3)
        .lean();
    failures.forEach(f => flagged.push({
        type: "failure",
        text: `Transmission to ${f.recipientEmail} failed`,
        meta: f.retry.lastError
    }));

    // Follow-ups
    const followUps = await CommMessage.find({ userId, "followUp.enabled": true, replyReceived: false })
        .sort({ "followUp.nextFollowUpAt": 1 })
        .limit(3)
        .lean();
    followUps.forEach(f => flagged.push({
        type: "follow_up",
        text: `${f.recipientName || f.recipientEmail} hasn't replied yet`,
        meta: `Follow-up pending`
    }));

    const recentMessages = await CommMessage.find({ userId, sentAt: { $gte: today } })
        .sort({ sentAt: -1 })
        .limit(5)
        .lean();

    const recentSummary = recentMessages.map(m =>
        `• ${m.recipientEmail}: "${m.subject || m.body.substring(0, 40)}..." (${m.status})`
    ).join("\n");

    return {
        success: true,
        digest: {
            sentCount,
            receivedCount,
            failedCount,
            pendingFollowUps,
            platforms: platformStats.reduce((acc, curr) => {
                acc[curr._id] = { sent: curr.sent, received: curr.received };
                return acc;
            }, {}),
            flaggedItems: flagged
        },
        message: `📊 **Daily Communication Digest**\n\n` +
            `📤 Messages Sent Today: **${sentCount}**\n` +
            `📥 Replies Received: **${receivedCount}**\n` +
            `❌ Failed Messages: **${failedCount}**\n` +
            `⏳ Pending Follow-ups: **${pendingFollowUps}**\n` +
            (recentSummary ? `\n**Recent Activity:**\n${recentSummary}` : "\nNo messages sent today yet.")
    };
}

// ─── §2.9 MEETING COMMUNICATION ────────────────────────────────────────────
async function handleMeetingComm(userId, data) {
    const { recipients = [], context = "", timing = "", body = "" } = data;

    if (!recipients.length) {
        return {
            success: false,
            message: "Who's joining this meeting? Give me their emails or names."
        };
    }

    const meetingBody = body || `You're invited to a meeting: ${context}\nTime: ${timing || "TBD"}\n\nPlease confirm your attendance.`;

    const result = await executeSendMessage(userId, {
        recipients,
        subject: `[Nurotra] Meeting Invitation: ${context || "Upcoming Meeting"}`,
        body: meetingBody,
        platform: "email"
    });

    // Create reminder rule
    if (timing) {
        await CommRule.create({
            userId,
            type: "reminder",
            name: `Meeting Reminder: ${context}`,
            trigger: { event: "meeting_start", condition: context, timingHours: 1 },
            action: {
                template: `Reminder: Your meeting "${context}" starts in 1 hour.`,
                recipients,
                platform: "email"
            }
        });
    }

    return {
        success: result.success,
        message: `📅 Meeting invitations sent to ${recipients.length} participant(s). ${timing ? "I'll also send a reminder 1 hour before." : "Let me know the time and I'll set up reminders."}`
    };
}

// ─── §2.10 BULK + PERSONALIZED ──────────────────────────────────────────────
async function executeBulkSend(userId, data) {
    const { recipients = [], body = "", context = "" } = data;

    if (!recipients.length) {
        return {
            success: false,
            message: "Upload or add the list of people you want to message. You can give me emails separated by commas."
        };
    }

    // Generate personalized versions using LLM
    const personalizedMessages = [];
    for (const recipient of recipients) {
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{
                    role: "user",
                    content: `Personalize this message for ${recipient}. Keep it professional but add a personal touch. Original: "${body}". Context: ${context}. Return ONLY the personalized message text.`
                }],
                temperature: 0.7
            });

            personalizedMessages.push({
                recipient,
                body: response.choices[0].message.content
            });
        } catch {
            personalizedMessages.push({ recipient, body }); // Fallback to original
        }
    }

    // Send all
    let successCount = 0;
    for (const pm of personalizedMessages) {
        const result = await executeSendMessage(userId, {
            recipients: [pm.recipient],
            subject: data.subject || `Message from Nurotra`,
            body: pm.body,
            platform: "email"
        });
        if (result.success) successCount++;
    }

    return {
        success: successCount > 0,
        message: `📨 Bulk send complete! ${successCount}/${recipients.length} personalized messages sent successfully.`
    };
}

// ─── CONTACT MANAGEMENT ────────────────────────────────────────────────────
async function manageContacts(userId, data) {
    const { contacts = [], group_name = "" } = data;

    if (!contacts.length) {
        // List existing contacts 
        const existing = await Contact.find({ userId, isArchived: false })
            .sort({ "metadata.lastContacted": -1 })
            .limit(20)
            .lean();

        if (!existing.length) {
            return {
                success: true,
                contacts: [],
                message: "📇 No contacts saved yet. Tell me a name and email, and I'll add them for you!"
            };
        }

        const list = existing.map(c =>
            `• **${c.name}** — ${c.email} (${c.groups.length ? c.groups.join(", ") : "no group"})`
        ).join("\n");

        return {
            success: true,
            contacts: existing,
            message: `📇 Your contacts:\n\n${list}\n\nWant to add someone or create a group?`
        };
    }

    // Add new contacts
    const added = [];
    for (const c of contacts) {
        try {
            const contact = await Contact.findOneAndUpdate(
                { userId, email: c.email },
                {
                    $set: {
                        name: c.name || c.email.split("@")[0],
                        email: c.email,
                        platform: c.platform || "email"
                    },
                    $addToSet: group_name ? { groups: group_name } : {}
                },
                { upsert: true, new: true }
            );
            added.push(contact);
        } catch (err) {
            console.error(`[CommService] Failed to add contact ${c.email}:`, err.message);
        }
    }

    return {
        success: added.length > 0,
        contacts: added,
        message: `✅ Added ${added.length} contact(s)${group_name ? ` to group "${group_name}"` : ""}. ${group_name ? "Should I remember this as your core team?" : ""}`
    };
}

// ─── MEETING LIFECYCLE ───────────────────────────────────────────────────
async function handleMeetingLifecycle(userId, data) {
    const { 
        meeting_id, 
        recipients = [], 
        start_time, 
        agenda = "", 
        context = "" 
    } = data;

    // 1. If existing meeting requested
    if (meeting_id) {
        const meeting = await Meeting.findOne({ _id: meeting_id, userId });
        if (!meeting) return { success: false, message: "Meeting not found." };
        
        // Handle phase transitions or updates here
        return {
            success: true,
            meeting,
            message: `Found meeting: ${meeting.title}. Status: ${meeting.status}.`
        };
    }

    // 2. Create New Meeting (Pre-Event)
    if (recipients.length && start_time) {
        const meeting = await Meeting.create({
            userId,
            title: context || "New Meeting",
            startTime: new Date(start_time),
            participants: recipients.map(r => ({ email: r, status: "invited" })),
            agenda,
            phase: "pre-event",
            status: "scheduled",
            context: { originalPrompt: context }
        });

        // Send Invitations
        const inviteResult = await executeSendMessage(userId, {
            recipients,
            subject: `Invitation: ${meeting.title}`,
            body: `You are invited to ${meeting.title}.\nTime: ${meeting.startTime.toLocaleString()}\nAgenda: ${agenda || "No agenda provided."}\n\nPlease confirm your attendance.`
        });

        // Assign meetingId to these messages
        if (inviteResult.results) {
            const messageIds = inviteResult.results.map(r => r.messageId).filter(Boolean);
            await CommMessage.updateMany({ _id: { $in: messageIds } }, { $set: { meetingId: meeting._id } });
        }

        return {
            success: true,
            meeting,
            message: `📅 Meeting scheduled and invitations sent to ${recipients.length} participants. I am now tracking confirmations.`
        };
    }

    return {
        success: false,
        message: "To schedule a meeting, I need to know who to invite and what time works best."
    };
}

// ─── CONFIRMATION TRACKING ────────────────────────────────────────────────
async function syncMeetingConfirmations(userId) {
    const activeMeetings = await Meeting.find({ userId, status: "scheduled", phase: "pre-event" });
    if (!activeMeetings.length) return { success: true, message: "No active meetings to sync." };

    const emailAdapter = CommunicationFactory.getService("email");
    const incomingMessages = await emailAdapter.readMessages(userId, { maxResults: 20 });

    let updates = 0;
    for (const meeting of activeMeetings) {
        for (const msg of incomingMessages) {
            // Very basic matching: if sender is a participant and mentions meeting title or "confirm/yes"
            const participant = meeting.participants.find(p => msg.sender.includes(p.email));
            if (participant && participant.status === "invited") {
                const text = (msg.subject + " " + msg.message).toLowerCase();
                if (text.includes("confirm") || text.includes("yes") || text.includes("coming") || text.includes("accept")) {
                    participant.status = "confirmed";
                    updates++;
                } else if (text.includes("decline") || text.includes("sorry") || text.includes("cannot")) {
                    participant.status = "declined";
                    updates++;
                }
            }
        }
        if (updates > 0) await meeting.save();
    }

    return { success: true, message: `Synced ${updates} new confirmation(s).` };
}

// ─── PRE-MEETING REMINDERS ────────────────────────────────────────────────
async function sendMeetingReminders(userId) {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    const meetingsToRemind = await Meeting.find({
        userId,
        status: "scheduled",
        startTime: { $gte: now, $lte: oneHourFromNow },
        "automation.reminderSent": false
    });

    let sent = 0;
    for (const meeting of meetingsToRemind) {
        const confirmedEmails = meeting.participants
            .filter(p => p.status === "confirmed")
            .map(p => p.email);
        
        if (confirmedEmails.length > 0) {
            await executeSendMessage(userId, {
                recipients: confirmedEmails,
                subject: `Reminder: ${meeting.title} starting soon`,
                body: `Just a reminder that "${meeting.title}" starts at ${meeting.startTime.toLocaleTimeString()}.\n\nAgenda:\n${meeting.agenda || "No agenda provided."}\n\nSee you there!`
            });
            meeting.automation.reminderSent = true;
            await meeting.save();
            sent++;
        }
    }

    return { success: true, message: `Sent ${sent} pre-meeting reminder(s).` };
}

// ─── LIFECYCLE SYNC ORCHESTRATOR ──────────────────────────────────────────
async function syncMeetingLifecycle(userId) {
    // 1. Sync Confirmations from Inbox
    await syncMeetingConfirmations(userId);
    
    // 2. Check and Send Reminders
    const reminderResult = await sendMeetingReminders(userId);
    
    return reminderResult;
}

// ─── POST-EVENT FOLLOW-UP ────────────────────────────────────────────────
async function postEventFollowUp(userId, meetingId, summary, tasks = []) {
    const meeting = await Meeting.findOne({ _id: meetingId, userId });
    if (!meeting) return { success: false, message: "Meeting not found." };

    const confirmedParticipants = meeting.participants
        .filter(p => p.status === "confirmed")
        .map(p => p.email);

    if (confirmedParticipants.length > 0) {
        // Send Summary
        await executeSendMessage(userId, {
            recipients: confirmedParticipants,
            subject: `Post-Meeting: ${meeting.title} Summary`,
            body: `Thank you for attending "${meeting.title}".\n\nMinutes of Meeting:\n${summary}\n\nTasks Assigned:\n${tasks.map(t => `- [${t.assignee}] ${t.task} (By: ${t.deadline})`).join("\n") || "No immediate tasks assigned."}`
        });

        meeting.phase = "post-event";
        meeting.status = "finished";
        meeting.automation.summarySent = true;
        await meeting.save();
    }

    return { success: true, message: `Post-event summary and tasks sent to ${confirmedParticipants.length} participants.` };
}

// ─── BULK & PERSONALized COMMUNICATION ─────────────────────────────────────
async function handleBulkPersonalized(userId, data) {
    const { 
        recipients = [], 
        group_name, 
        subject, 
        body, 
        campaign_title = "Atomic Outreach",
        personalize = true
    } = data;

    let targetContacts = [];

    // 1. Resolve Contacts
    if (group_name) {
        targetContacts = await Contact.find({ userId, groups: group_name });
    } else if (recipients.length) {
        targetContacts = await Contact.find({ userId, email: { $in: recipients } });
        // If not in contacts, create minimal objects
        const foundEmails = targetContacts.map(c => c.email);
        recipients.forEach(email => {
            if (!foundEmails.includes(email)) {
                targetContacts.push({ email, name: email.split("@")[0] });
            }
        });
    }

    if (!targetContacts.length) {
        return { success: false, message: "No recipients found for this bulk action." };
    }

    // 2. Create Campaign
    const campaign = await BulkCampaign.create({
        userId,
        title: campaign_title,
        baseMessage: body,
        subject,
        totalRecipients: targetContacts.length,
        status: "sending"
    });

    // 3. Execution Loop (Individual & Personalized)
    let successCount = 0;
    const results = [];

    for (const contact of targetContacts) {
        const personalizedBody = personalize 
            ? body.replace(/{name}/gi, contact.name || "there")
                  .replace(/{company}/gi, contact.metadata?.notes?.substring(0, 20) || "your team")
            : body;

        const sendRes = await executeSendMessage(userId, {
            recipients: [contact.email],
            subject: subject || "Update from Nurotra",
            body: personalizedBody
        });

        if (sendRes.success) {
            successCount++;
            const messageId = sendRes.results[0].messageId;
            // Link to campaign
            await CommMessage.updateOne({ _id: messageId }, { $set: { campaignId: campaign._id } });
            results.push({ email: contact.email, status: "sent", messageId });
        } else {
            results.push({ email: contact.email, status: "failed", error: sendRes.message });
        }
    }

    campaign.status = "active";
    campaign.stats.sent = successCount;
    campaign.stats.failed = targetContacts.length - successCount;
    await campaign.save();

    return {
        success: true,
        campaign,
        message: `🚀 Individualized campaign "${campaign_title}" executed. Sent ${successCount}/${targetContacts.length} personalized messages.`
    };
}

// ─── MAIN ENTRY POINT ──────────────────────────────────────────────────────
async function processMessage(userId, prompt, history = []) {
    console.log(`[CommService] Processing: "${prompt.substring(0, 80)}..."`);

    // Step 1: Classify intent
    const classification = await classifyIntent(prompt, history);
    console.log(`[CommService] Intent: ${classification.intent}`);

    // Step 2: If clarification needed, return question
    if (classification.needs_clarification) {
        return {
            intent: classification.intent,
            message: classification.clarification_question || classification.response_text,
            action: null
        };
    }

    // Step 3: Route to handler
    const data = classification.extracted_data || {};
    let actionResult = null;

    switch (classification.intent) {
        case "send_message":
            actionResult = await executeSendMessage(userId, data);
            break;
        case "setup_followup":
            actionResult = await configureFollowUp(userId, data);
            break;
        case "broadcast_completion":
            actionResult = await broadcastUpdate(userId, data);
            break;
        case "draft_message":
            actionResult = await draftContextual(userId, data, history);
            break;
        case "platform_route":
            actionResult = await routeToPlatform(userId, data);
            break;
        case "recall_history":
            actionResult = await queryMemory(userId, data);
            break;
        case "retry_failed":
            actionResult = await retryMessage(userId, data);
            break;
        case "daily_digest":
            actionResult = await generateDigest(userId);
            break;
        case "meeting_comm":
            actionResult = await handleMeetingComm(userId, data);
            break;
        case "bulk_send":
            actionResult = await executeBulkSend(userId, data);
            break;
        case "manage_contacts":
            actionResult = await manageContacts(userId, data);
            break;
        case "meeting_lifecycle":
            actionResult = await handleMeetingLifecycle(userId, data);
            break;
        case "bulk_personalized":
            actionResult = await handleBulkPersonalized(userId, data);
            break;
        default:
            // General conversation — return the LLM's response directly
            return {
                intent: "general_chat",
                message: classification.response_text,
                action: null
            };
    }

    return {
        intent: classification.intent,
        message: actionResult?.message || classification.response_text,
        action: actionResult
    };
}

module.exports = {
    processMessage,
    generateDigest,
    executeSendMessage,
    manageContacts,
    syncMeetingLifecycle,
    postEventFollowUp
};
