import axios from 'axios';
import fs from 'fs';

const testFastAPI = async () => {
    try {
        console.log("Sending request to FastAPI Agent...");
        const response = await axios.post('http://localhost:8000/api/agents/ppt', {
            prompt: "Create a 3-slide presentation about the future of AI in healthcare, including bullet points on diagnostics and personalized medicine."
        });

        console.log("Success! Received response.");
        console.log("Slides Data:", JSON.stringify(response.data.slides, null, 2));

        const base64Data = response.data.base64_file;
        const buffer = Buffer.from(base64Data, 'base64');
        
        fs.writeFileSync('test_fastapi_output.pptx', buffer);
        console.log("Saved test presentation to test_fastapi_output.pptx");

    } catch (error) {
        console.error("Test failed:");
        if (error.response) {
            console.error(error.response.data);
        } else {
            console.error(error.message);
        }
    }
};

testFastAPI();
