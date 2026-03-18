from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from agents.ppt_agent import generate_ppt
import traceback
import sys
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = FastAPI(title="Nurotra Python Agents Microservice")

class AgentRequest(BaseModel):
    prompt: str
    context_data: Optional[str] = ""

@app.get("/")
def read_root():
    return {"status": "ok", "service": "Nurotra Python Agents Microservice"}

@app.post("/api/agents/ppt")
async def run_ppt_agent(request: AgentRequest):
    try:
        print(f"Starting PPT Generation for prompt: {request.prompt[:50]}...", file=sys.stderr)
        # The agent logic returns both the slide JSON and the Base64 file
        result = await generate_ppt(request.prompt, request.context_data)
        return {
            "success": True,
            "slides": result["slides"],
            "base64_file": result["base64_file"]
        }
    except Exception as e:
        print(f"PPT Generation Failed: {e}", file=sys.stderr)
        print(traceback.format_exc(), file=sys.stderr)
        raise HTTPException(status_code=500, detail=str(e))
