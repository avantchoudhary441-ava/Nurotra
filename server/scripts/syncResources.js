/**
 * Resource Engine Sync Script
 * Populates the Resource Registry from existing Documents and Contacts.
 */

const mongoose = require('mongoose');
const Document = require('../models/Document');
const Contact = require('../models/Contact');
const Resource = require('../models/Resource');

async function syncResources(userId) {
    console.log(`[ResourceSync] Starting sync for user: ${userId}`);

    // 1. Sync Documents
    const docs = await Document.find({ userId });
    for (const doc of docs) {
        await Resource.findOneAndUpdate(
            { userId, refId: doc._id },
            {
                userId,
                title: doc.name,
                type: 'file',
                refId: doc._id,
                tags: [doc.type, 'sync'],
                data: {
                    contentPreview: doc.content ? doc.content.substring(0, 500) : "",
                    docType: doc.type
                }
            },
            { upsert: true, new: true }
        );
    }
    console.log(`[ResourceSync] Synced ${docs.length} documents.`);

    // 2. Sync Contacts
    const contacts = await Contact.find({ userId });
    for (const contact of contacts) {
        await Resource.findOneAndUpdate(
            { userId, refId: contact._id },
            {
                userId,
                title: contact.name,
                type: 'contact',
                refId: contact._id,
                tags: ['contact', contact.preferredPlatform, 'sync'],
                data: {
                    email: contact.email,
                    phone: contact.phone,
                    role: contact.metadata?.relationshipRole
                }
            },
            { upsert: true, new: true }
        );
    }
    console.log(`[ResourceSync] Synced ${contacts.length} contacts.`);

    return { docsSynced: docs.length, contactsSynced: contacts.length };
}

module.exports = { syncResources };
