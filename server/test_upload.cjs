const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function testUpload() {
    try {
        fs.writeFileSync('test_resume.pdf', 'dummy content');
        const formData = new FormData();
        formData.append('file', fs.createReadStream('test_resume.pdf'));
        formData.append('purpose', 'resume_ingestion');

        const res = await axios.post('http://localhost:5000/api/upload', formData, {
            headers: {
                ...formData.getHeaders(),
                // Use the test bypass token
                Authorization: 'Bearer DEV_TOKEN'
            }
        });
        console.log("Upload response:", res.data);
    } catch (e) {
        console.log("Upload failed:", e.response ? e.response.status : e.message);
        if (e.response) console.log(e.response.data);
    }
}
testUpload();
