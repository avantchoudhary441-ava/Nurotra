const { Client } = require("@notionhq/client");

// Initialize Notion client
// This will automatically pick up NOTION_API_KEY from environment variables
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

/**
 * Sends data to a Notion Page by appending text blocks.
 * @param {Object} data - The data payload to send
 * @param {String} targetPageId - The ID of the page to append to
 * @returns {Promise<Object>} The API response from Notion
 */
const sendDataToNotionPage = async (data, targetPageId) => {
  if (!process.env.NOTION_API_KEY) {
    throw new Error("NOTION_API_KEY is not defined in the environment.");
  }

  const pageId = targetPageId || process.env.NOTION_TARGET_PAGE_ID;
  if (!pageId) {
    throw new Error("No target Page ID provided for Notion integration.");
  }

  try {
    // Format the incoming data into a readable Notion block
    const dataString = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
    
    const response = await notion.blocks.children.append({
      block_id: pageId,
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: `Nurotra Action Data [${new Date().toLocaleString()}]:\n`,
                },
                annotations: {
                  bold: true,
                }
              },
            ],
          },
        },
        {
          object: "block",
          type: "code",
          code: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: dataString,
                },
              },
            ],
            language: "json",
          },
        },
      ],
    });

    return response;
  } catch (error) {
    console.error("[NotionService] Error sending data to Notion:", error.message);
    throw error;
  }
};

module.exports = {
  sendDataToNotionPage,
  notionClient: notion
};
