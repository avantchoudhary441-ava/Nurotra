const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('http://localhost:5000/api/action-agent/test-execute', { 
        command: "I've uploaded my resume: 60a0f443b2f8a400155b9e0f",
        isIntervention: true
    });
    console.log("STATUS:", res.status);
    console.log(res.data);
  } catch (error) {
    if (error.response) {
      console.log("STATUS:", error.response.status);
      console.log("DATA:", error.response.data);
    } else {
      console.log(error.message);
    }
  }
}
test();
