require('dotenv').config();
const aiService = require('./services/aiService');

async function debugQuery() {
    const prompt = "create the document with the details like- Create an MS Excel spreadsheet to manage student marks with the following details: Columns: Student Name English Marks Math Marks Science Marks Total Marks Average Marks Enter data for 5 students. Use formulas to: Calculate Total Marks for each student. Calculate Average Marks for each student. Format the spreadsheet by: Making the header row bold. Applying borders to the table. Highlighting the highest Total Marks.";
    const userContext = { name: "User", role: "Brand", niche: "Education" };

    console.log("Calling aiService.processDocsAgentQuery...");
    try {
        const response = await aiService.processDocsAgentQuery(prompt, userContext, []);
        console.log("Response:", JSON.stringify(response, null, 2));
    } catch (e) {
        console.error("Caught Error:", e);
    }
}

debugQuery();
