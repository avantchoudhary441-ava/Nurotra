import os
import json
import base64
import tempfile
import sys
from typing import Dict, Any, List

# Import CAMEL dependencies
from camel.agents import ChatAgent
from camel.messages import BaseMessage
from camel.models import ModelFactory
from camel.types import ModelPlatformType, ModelType
from camel.configs import ChatGPTConfig

# Import user requested toolkit
from camel.toolkits import PPTXToolkit

# ==========================================
# AGENT CONFIGURATION
# ==========================================
def create_model_instance(temperature: float = 0.2):
    config = ChatGPTConfig(temperature=temperature)
    config_dict = {k: v for k, v in config.__dict__.items() if v is not None}
    if "reasoning_effort" in config_dict:
        del config_dict["reasoning_effort"]
        
    return ModelFactory.create(
        model_platform=ModelPlatformType.OPENAI,
        model_type=ModelType.GPT_4O_MINI,
        model_config_dict=config_dict,
    )

# ==========================================
# STAGE 1: OUTLINE PLANNER
# ==========================================
def run_stage_1_planner(prompt: str, context: str) -> str:
    model = create_model_instance(temperature=0.3)
    sys_msg = BaseMessage.make_assistant_message(
        role_name="Presentation Strategist",
        content="""You are an elite Presentation Strategist.
Your goal is to design the narrative structure (10-15 slides) for a PowerPoint based on the user's topic.
Create a logical flow: Hook -> Problem/Background -> Core Concepts -> Deep Insights -> Case Study -> Data/Evidence -> Solutions -> Conclusion.
Output ONLY the structural outline. No JSON yet."""
    )
    agent = ChatAgent(sys_msg, model=model)
    user_msg = BaseMessage.make_user_message(
        role_name="User",
        content=f"Topic: {prompt}\n\nContext: {context}\n\nPlan the structure."
    )
    return agent.step(user_msg).msg.content

# ==========================================
# STAGE 2: CONTENT GENERATOR
# ==========================================
def run_stage_2_content_generator(outline: str) -> str:
    model = create_model_instance(temperature=0.4)
    sys_msg = BaseMessage.make_assistant_message(
        role_name="Content Expert",
        content="""You are a brilliant Content Expert for presentations.
Based on the provided outline, generate the exact slide content.
Rules:
- NO generic phrases (e.g. "improve efficiency").
- 3-5 sharp, specific bullets per slide (under 12 words each).
- Provide visual keywords if applicable.
Output your draft content clearly (it does not have to be JSON yet, focus on quality)."""
    )
    agent = ChatAgent(sys_msg, model=model)
    user_msg = BaseMessage.make_user_message(
        role_name="User",
        content=f"Outline:\n{outline}\n\nGenerate the rich slide content."
    )
    return agent.step(user_msg).msg.content

# ==========================================
# STAGE 3: REVIEWER & JSON FORMATTER
# ==========================================
def run_stage_3_reviewer(draft_content: str) -> str:
    model = create_model_instance(temperature=0.1)
    sys_msg = BaseMessage.make_assistant_message(
        role_name="JSON Formatter",
        content="""You are a STRICT JSON Formatter.
Convert the presentation content into a specific JSON array format required by PPTXToolkit.
Note that the schema structure MUST exactly be an array of dictionaries representing the slides.

Rules:
1. The FIRST dict must represent the title slide and have strictly these keys:
   {"title": "String", "subtitle": "String"}
   
2. The OTHER dicts represent content slides and must have these keys:
   {"heading": "String", "bullet_points": ["String", "String"], "img_keywords": "Optional search keywords for image (String)"}
   
DO NOT include any nested lists in `bullet_points`. It MUST be a flat list of strings.
If you need to show hierarchy or step-by-step process, start the bullet point with '>> '.

DO NOT include any markdown formatting or ticks. ONLY output a raw JSON array.
"""
    )
    agent = ChatAgent(sys_msg, model=model)
    user_msg = BaseMessage.make_user_message(
        role_name="User",
        content=f"Draft:\n{draft_content}\n\nOutput STRICT JSON array matching the required schema."
    )
    response = agent.step(user_msg).msg.content
    return response.replace("```json", "").replace("```", "").strip()

# ==========================================
# MAIN FASTAPI EXPOSED FUNCTION
# ==========================================
async def generate_ppt(prompt: str, context: str) -> Dict[str, Any]:    
    # 1. Plan Outline
    outline = run_stage_1_planner(prompt, context)
    
    # 2. Generate Content
    draft_content = run_stage_2_content_generator(outline)
    
    # 3. Review & Format to PPTXToolkit schema
    json_response = run_stage_3_reviewer(draft_content)
    
    try:
        parsed_data = json.loads(json_response)
        
        # In case the model responds with an object containing "slides": [...]
        if isinstance(parsed_data, dict) and "slides" in parsed_data:
            slides = parsed_data["slides"]
            new_slides = []
            for i, s in enumerate(slides):
                if i == 0:
                    new_slides.append({"title": s.get("title", "Presentation"), "subtitle": s.get("subtitle", "")})
                else:
                    raw_bullets = s.get("bullet_points", s.get("bullets", []))
                    flat_bullets = []
                    # Safely flatten any nested lists the LLM might have generated
                    for b in raw_bullets:
                        if isinstance(b, list):
                            flat_bullets.extend(str(sub_b) for sub_b in b)
                        else:
                            flat_bullets.append(str(b))
                            
                    new_slides.append({
                        "heading": s.get("heading", s.get("title", "")),
                        "bullet_points": flat_bullets,
                        "img_keywords": s.get("img_keywords", s.get("visual", ""))
                    })
            parsed_data = new_slides
            json_response = json.dumps(parsed_data)
        
    except json.JSONDecodeError as e:
        print(f"Failed to parse LLM JSON: {json_response}")
        raise ValueError(f"Agent failed to return valid JSON format: {e}")
        
    # 4. Generate PPTX Using Camel's PPTXToolkit
    fd, file_path = tempfile.mkstemp(suffix=".pptx")
    os.close(fd)
    
    toolkit = PPTXToolkit()
    # The toolkit parses the JSON string and creates a PPTX using our custom dark template
    template_path = os.path.join(os.path.dirname(__file__), '..', 'nurotra_template.pptx')
    
    print(f"DEBUG: JSON sent to toolkit: {json_response[:500]}...", file=sys.stderr)
    toolkit.create_presentation(content=json_response, filename=file_path, template=template_path)
    
    # 5. Base64 Encode
    with open(file_path, "rb") as f:
        file_buffer = f.read()
    
    print(f"DEBUG: Generated PPTX buffer size: {len(file_buffer)} bytes", file=sys.stderr)
    b64_string = base64.b64encode(file_buffer).decode('utf-8')
    
    # Cleanup
    try:
        os.remove(file_path)
    except:
        pass
        
    return {
        "slides": parsed_data,
        "base64_file": b64_string
    }
