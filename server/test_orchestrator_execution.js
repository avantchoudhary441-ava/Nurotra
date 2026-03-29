async function testOrchestrator(prompt, token) {
  console.log(`\n============= Testing: "${prompt}" =============`);
  
  try {
    // 1. Intent Guard
    const intentRes = await fetch('http://localhost:5000/api/orchestrator/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ prompt })
    });
    const guardDecision = await intentRes.json();
    console.log("Guard Strategy:", guardDecision.response_strategy);

    if (guardDecision.response_strategy !== 'ROUTE_TO_SYSTEM') {
        console.log("Skipped Orchestration (Handled Conversational/Directly)");
        return;
    }
    
    // 2. Execute Orchestration Pipeline
    console.log("Triggering Execution Pipeline...");
    const executeRes = await fetch('http://localhost:5000/api/orchestrator/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ prompt, guardDecision })
    });
    
    const body = await executeRes.text();
    const lines = body.split('\n\n');
    let hasResult = false;

    for (const line of lines) {
      if (line.trim().startsWith('data: ')) {
        const dataStr = line.replace('data: ', '').trim();
        try {
          const data = JSON.parse(dataStr);
          if (data.phase === 'execution') {
             console.log(`[EXECUTION PROGRESS] ${data.status}`);
          }
          if (data.phase === 'complete') {
             hasResult = true;
             console.log("\n✅ [FINAL RESULT SECURED]");
             console.log(`AGENT DISPATCHED: ${data.data?.agent}`);
             if (data.data?.agent === 'docs_agent') {
                 console.log("DOCUMENT GENERATED:");
                 console.log(` - ID: ${data.data?.result?.document?._id || data.data?.result?.id}`);
                 console.log(` - Name: ${data.data?.result?.document?.name || data.data?.result?.fileName}`);
             } else if (data.data?.agent === 'communication_agent') {
                 console.log("MESSAGE DRAFTED:");
                 console.log(`\n"${data.data?.result?.message}"\n`);
             } else if (data.data?.agent === 'time_agent') {
                 console.log("TEMPORAL PLAN CREATED:");
                 console.log(data.data?.result?.message);
                 const msgs = data.data?.result?.planning?.schedule?.slice(0, 3).map(s => ` - ${s.timeLabel}: ${s.title}`);
                 if (msgs) console.log(msgs.join('\n'));
             } else {
                 console.log("RAW RESULT:", JSON.stringify(data.data?.result, null, 2));
             }
          }
        } catch(e) { /* ignore parse errors on fragmented chunks in simple text read */ }
      }
    }

    if (!hasResult) {
        console.log("❌ Pipeline finished but no final result result flag found.");
    }
  } catch (error) {
      console.error("Test failed with error:", error);
  }
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
  
  await testOrchestrator("Create a 5-slide PPT about Quantum Computing for a beginner audience", token);
  await testOrchestrator("Draft a professional message to my boss Alexander about my project status", token);
  await testOrchestrator("Plan my next 3 days for graduation prep goal", token);
}

run();
