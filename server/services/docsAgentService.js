const Project = require("../models/Project");
const Document = require("../models/Document");
const WorkspaceFile = require("../models/WorkspaceFile");
const axios = require("axios");
const intentAnalyzer = require("./agents/intentAnalyzer");
const classifier = require("./agents/classifier");
const structurePlanner = require("./agents/structurePlanner");
const contentGenerator = require("./agents/contentGenerator");
const designEngine = require("./agents/designEngine");
const renderingEngine = require("./agents/renderingEngine");
const { getTemporalContext } = require("../utils/timeHelper");
const { runDocumentAnalysis } = require("./documentAnalysisService");
const NuroMemory = require("../models/NuroMemory");
const Contact = require("../models/Contact");

/**
 * Docs Agent Service
 * Encapsulates the 14-stage document generation pipeline.
 */
const docsAgentService = {
    /**
     * Core generation pipeline
     * @param {Object} req - Express request or mock req
     * @param {Object} options - { prompt, docIds, links, uploadedFiles, history, currentDoc }
     */
    generateFullDocument: async (user, options) => {
        const { prompt, docIds = [], links = [], uploadedFiles = [], history = [], currentDoc = null } = options;

        try {
            console.log(`[DocsAgentService] Starting Pipeline for: "${prompt.substring(0, 50)}..."`);

            // 1. Ingest Sources
            let sourceContent = "";
            if (docIds.length > 0) {
                const docs = await Document.find({ _id: { $in: docIds } });
                sourceContent += docs.map(d => `SOURCE [DOC: ${d.name}]:\n${d.content}`).join("\n\n");
            }

            if (links.length > 0) {
                for (const link of links) {
                    try {
                        const response = await axios.get(link, { timeout: 10000 });
                        const cleanText = response.data.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
                        sourceContent += `\n\nSOURCE [LINK: ${link}]:\n${cleanText.substring(0, 15000)}`;
                    } catch (e) {
                        console.warn(`[DocsAgentService] Failed to fetch link ${link}:`, e.message);
                    }
                }
            }

            if (uploadedFiles.length > 0) {
                try {
                    const { buildDocumentSet } = require("./documentAnalysisService");
                    const extractedDocs = await buildDocumentSet([], uploadedFiles);
                    sourceContent += `\n\n### CRITICAL GROUNDING SOURCE (UPLOADED FILES):\n`;
                    sourceContent += extractedDocs.map(d => `[FILE: ${d.name}]\n${d.content || "EMPTY_FILE_CONTENT"}`).join("\n\n");
                } catch (extErr) {
                    console.warn("[DocsAgentService] Text extraction failed:", extErr.message);
                }
            }

            const multimediaContext = uploadedFiles
                .filter(f => /\.pdf$/i.test(f.originalname) || (f.mimetype && f.mimetype.includes('pdf')))
                .map(f => ({
                    mimeType: 'application/pdf',
                    data: f.buffer.toString('base64'),
                    fileName: f.originalname
                }));

            // [NEW] Extract Previous Document State from history for Revisions
            let previousState = "";
            if (Array.isArray(history)) {
                const lastDocMsg = [...history].reverse().find(m => m.document || m.content?.includes('###'));
                if (lastDocMsg) {
                    previousState = `\n\n### [CURRENT DOCUMENT STATE - FOR REVISION]:\n${lastDocMsg.text || lastDocMsg.content || ""}`;
                }
            }
            sourceContent += previousState;

            const multimediaBrief = multimediaContext.map(mm => ({
                fileName: mm.fileName,
                mimeType: mm.mimeType,
                hint: `Multimodal context from PDF file: ${mm.fileName} is attached.`
            }));

            const temporalContext = getTemporalContext();

            // 1.5 Fetch Memory Context
            const memory = await NuroMemory.findOne({ userId: user._id }).lean();
            
            // Heuristic for high-stakes person detection in prompt
            const words = prompt.split(/\s+/);
            let relationshipContext = "";
            for (const word of words) {
                const cleanWord = word.replace(/[^\w]/g, "");
                if (cleanWord.length > 2) {
                    const contact = await Contact.findOne({ userId: user._id, name: new RegExp('^' + cleanWord + '$', 'i') }).lean();
                    if (contact && contact.metadata?.relationshipRole) {
                        relationshipContext += `\nHigh-stakes role detected: ${contact.name} is the user's ${contact.metadata.relationshipRole}. `;
                    }
                }
            }

            // 2. Stages 1 & 2: Intent & Classification
            const intentData = await intentAnalyzer.analyzeIntent(prompt, sourceContent, multimediaBrief, temporalContext, memory, relationshipContext);
            const classification = await classifier.classifyType(prompt, intentData, multimediaBrief, temporalContext);

            // 3. Stage 2.5: Python PPT Interception
            if (intentData.output_format === 'ppt' || intentData.output_format === 'pptx') {
                try {
                    console.log(`[DocsAgentService] Routing to Python Agent...`);
                    const fastApiResponse = await axios.post('http://localhost:8000/api/agents/ppt', {
                        prompt: prompt,
                        context_data: sourceContent,
                        user_memory: memory // Pass memory to Python agent
                    }, { timeout: 120000 });

                    const agentData = fastApiResponse.data;
                    const pptBuffer = Buffer.from(agentData.base64_file, 'base64');
                    const fileName = (intentData.topic || 'Presentation').replace(/[<>:"/\\|?*]/g, '_').trim() + '.pptx';

                    const docContent = agentData.slides.map(s => `### ${s.heading || s.title}\n${(s.bullet_points || []).join('\n')}`).join('\n\n');

                    const document = new Document({
                        name: fileName,
                        type: 'ppt',
                        content: docContent,
                        rawStructure: { slides: agentData.slides, intent: intentData, classification },
                        userId: user._id,
                        status: 'draft'
                    });
                    await document.save();

                    await WorkspaceFile.findOneAndUpdate(
                        { userId: user._id, documentId: document._id },
                        { userId: user._id, documentId: document._id, fileName, fileType: 'pptx', fileData: pptBuffer, size: pptBuffer.length },
                        { upsert: true, new: true }
                    );

                    return { success: true, document, intent: intentData, type: 'ppt', fileName };
                } catch (agentErr) {
                    console.warn("[DocsAgentService] Python Agent fallback...");
                }
            }

            // 4. Normal Pipeline (Word/Website)
            const structure = await structurePlanner.generateStructure(prompt, intentData, classification, sourceContent, multimediaContext, temporalContext);
            const content = await contentGenerator.generateContent(prompt, intentData, structure, sourceContent, multimediaContext);
            const processedSlides = designEngine.processDesign(content.slides);

            const finalOutput = await renderingEngine.renderOutput({
                ...intentData,
                slides: processedSlides,
                topic: intentData.topic
            }, intentData.output_format);

            const displayContent = processedSlides.map(s => `### ${s.title}\n${s.bullets.join('\n')}`).join('\n\n');

            const document = new Document({
                name: (finalOutput && finalOutput.fileName) || intentData.topic || 'Generated_Document',
                type: ['website', 'ppt', 'pptx', 'docx', 'excel', 'xlsx'].includes(intentData.output_format)
                    ? intentData.output_format
                    : (['word', 'doc', 'report'].includes(intentData.output_format) ? 'docx' : 'generic'),
                content: displayContent,
                rawStructure: { slides: processedSlides, intent: intentData, classification, sections: structure.sections },
                userId: user._id,
                status: 'draft'
            });
            await document.save();

            // 5. Persistent Sync: Save the binary buffer to the Workspace for instant download
            if (finalOutput && finalOutput.buffer) {
                const ext = intentData.output_format === 'website' ? 'html' : (intentData.output_format === 'ppt' ? 'pptx' : 'docx');
                await WorkspaceFile.findOneAndUpdate(
                    { userId: user._id, documentId: document._id },
                    {
                        userId: user._id,
                        documentId: document._id,
                        fileName: finalOutput.fileName || document.name,
                        fileType: ext,
                        fileData: finalOutput.buffer,
                        size: finalOutput.buffer.length
                    },
                    { upsert: true, new: true }
                );
            }

            return {
                success: true,
                document,
                intent: intentData,
                type: intentData.output_format,
                fileName: finalOutput?.fileName
            };

        } catch (error) {
            console.error("[DocsAgentService] Pipeline Error:", error);
            throw error;
        }
    }
};

module.exports = docsAgentService;
