async function testMultiTurn(token) {
  const history = [];

  async function sendTurn(prompt) {
    console.log(`\n👤 USER: "${prompt}"`);

    // Build history in OpenAI format
    const msgHistory = history.map(m => ({ role: m.role, content: m.content }));

    // 1. Intent Guard with history
    const intentRes = await fetch('http://localhost:5000/api/orchestrator/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ prompt, history: msgHistory })
    });
    const guardDecision = await intentRes.json();
    console.log(`🛡️ Guard Strategy: ${guardDecision.response_strategy}`);

    if (guardDecision.response_strategy !== 'ROUTE_TO_SYSTEM') {
      console.log(`🤖 AGENT: ${guardDecision.response}`);
      history.push({ role: 'user', content: prompt });
      history.push({ role: 'assistant', content: guardDecision.response });
      return;
    }

    // 2. Execute with history
    const executeRes = await fetch('http://localhost:5000/api/orchestrator/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ prompt, guardDecision, history: msgHistory })
    });

    const body = await executeRes.text();
    const lines = body.split('\n\n');

    let agentReply = null;
    for (const line of lines) {
      if (line.trim().startsWith('data: ')) {
        try {
          const data = JSON.parse(line.replace('data: ', '').trim());
          if (data.phase === 'complete' && data.data?.result) {
            agentReply = data.data.result.message;
            const clarification = data.data.result.needs_clarification;
            if (clarification) {
              console.log(`❓ AGENT [CLARIFICATION]: "${agentReply}"`);
            } else {
              console.log(`✅ AGENT [RESULT]: "${agentReply?.substring(0, 150)}..."`);
            }
          }
        } catch(e) {}
      }
    }

    history.push({ role: 'user', content: prompt });
    if (agentReply) history.push({ role: 'assistant', content: agentReply });
  }

  console.log('\n══════════════════════════════════════════');
  console.log('  TEST: Multi-Turn Conversation Flow');
  console.log('══════════════════════════════════════════');

  console.log('\n--- 3-Turn Conversation Test ---');
  // Turn 1: Vague — agent asks for recipient, body, platform
  await sendTurn("send an email");
  
  // Turn 2: Add recipient and body detail and platform
  await sendTurn("to alexander@company.com, tell him the project deadline is being pushed by 2 weeks due to API integration issues. Maintain a professional tone. Send via email.");
  
  // Turn 3 (bonus): One more follow-up to refine
  await sendTurn("also add that we'll have a status update call on Thursday");
  // --- Hinglish Test Case ---
  console.log('\n--- Hinglish Multi-Turn Test ---');
  await sendTurn("mail bhej de");
  await sendTurn("Alexander ko, project status ke baare mein");
}

async function run() {
  console.log("Logging in...");
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'akshatsharma31109@gmail.com', password: '311109' })
  });
  
  const loginData = await loginRes.json();
  const token = loginData.token;
  
  if (!token) {
    console.error("Login failed:", loginData);
    return;
  }
  
  console.log("Login successful! Token acquired.");
  await testMultiTurn(token);
}

run();
