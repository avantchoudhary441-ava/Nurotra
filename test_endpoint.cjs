const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('http://localhost:5000/api/action-agent/test-execute', { command: "Find latest news" });
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
