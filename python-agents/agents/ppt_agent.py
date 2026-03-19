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
# MASTER PPT GENERATOR
# ==========================================
def run_ppt_generation(prompt: str, context: str, slide_count: int = 6) -> str:
    model = create_model_instance(temperature=0.4)
    raw_content = """You are an expert PowerPoint slide generator for CAMEL PPTXToolkit. 

**Your job:** Output a single JSON array (no markdown, no commentary) for a presentation on "{topic}" with exactly {slide_count_plus_one} slides (including title). 

**CAMEL PPTXToolkit slide types (choose from these only):**
- **Title slide:** 
  {"title": ..., "subtitle": ...}
- **Bullet slide:** 
  {"heading": ..., "bullet_points": ["...", "...",....], "img_keywords": "..."}
- **Step-by-step slide:** 
  {"heading": ..., "bullet_points": [">> Step 1: ...", ">> Step 2: ...", ">> Step 3: ...",....], "img_keywords": "..."}
  (If a bullet starts with ">>", it's rendered as a pentagon/chevron shape.)
- **Table slide:** 
  {"heading": ..., "table": {"headers": [...], "rows": [[...],[...],[...]]}, "img_keywords": "..."}

**REQUIRED FORMAT:**
[
  {"title": "Title for {topic}", "subtitle": "Subtitle for this topic"},
  {"heading": "...", "bullet_points": ["...", "...",....], "img_keywords": "..."},
  {"heading": "...", "bullet_points": [">> Step 1: ...", ">> Step 2: ...",.....], "img_keywords": "..."},
  {"heading": "...", "table": {"headers": ["Col1", "Col2"], "rows": [["A", "B"], ["C", "D"]]}, "img_keywords": "..."},
  ...
]

**MANDATORY RULES:**
1. The first slide is always a title slide.
2. Include at least one step-by-step slide (with all bullet points starting with ">>").
3. Include at least one table slide.
4. At least TWO slides (not counting the title slide) MUST have non-empty, relevant "img_keywords" (search terms, not URLs) for the image field. Use visually interesting or topic-relevant keywords.
5. For all bullet slides, use Markdown syntax for bold (**text**) and italics (*text*).
6. **All bullet and step-by-step slides must include at least Four bullet points.**
7. Make content clear, concise, and visually engaging. 
8. Do NOT output markdown code fences or commentary—only raw JSON array.

**Styling Note:** Slides will be rendered with a dark background and white text (no need to mention this, just make sure content is readable).

**Example:**
[
  {"title": "AI Agents", "subtitle": "Exploring the world of artificial intelligence agents"},
  {"heading": "Types of AI Agents", "bullet_points": ["Intelligent Virtual Agents", "Autonomous Agents", "Collaborative Agents",....], "img_keywords": "AI, technology"},
  {"heading": "Creating an AI Agent", "bullet_points": [">> Step 1: Define the goal", ">> Step 2: Choose algorithms", ">> Step 3: Implement and test",">> Step 4:......], "img_keywords": "workflow, robotics"},
  {"heading": "Comparison of AI Agents", "table": {"headers": ["Type", "Capabilities", "Examples"], "rows": [["Virtual", "Conversational AI", "Siri"], ["Autonomous", "Self-learning", "Robots"]]}, "img_keywords": "comparison chart, table"},
  ... (add more if needed) ...
]
"""
    # Safe replacement of placeholders
    content = raw_content.replace("{topic}", prompt).replace("{slide_count_plus_one}", str(slide_count + 1))
    
    sys_msg = BaseMessage.make_assistant_message(
        role_name="Expert PPT Generator",
        content=content
    )
    agent = ChatAgent(sys_msg, model=model)
    user_msg = BaseMessage.make_user_message(
        role_name="User",
        content=f"Topic: {prompt}\n\nContext: {context}\n\nGenerate the presentation JSON."
    )
    response = agent.step(user_msg).msg.content
    return response.replace("```json", "").replace("```", "").strip()

def normalize_slides(slides_list: list) -> list:
    new_slides = []
    for i, s in enumerate(slides_list):
        if i == 0:
            new_slides.append({"title": s.get("title", "Presentation"), "subtitle": s.get("subtitle", "")})
        else:
            raw_bullets = s.get("bullet_points", s.get("bullets", []))
            flat_bullets = []
            for b in raw_bullets:
                if isinstance(b, list):
                    flat_bullets.extend(str(sub_b) for sub_b in b)
                else:
                    flat_bullets.append(str(b))
                    
            slide_dict = {
                "heading": s.get("heading", s.get("title", "")),
                "bullet_points": flat_bullets,
                "img_keywords": s.get("img_keywords", s.get("visual", ""))
            }
            if "table" in s:
                slide_dict["table"] = s["table"]
            new_slides.append(slide_dict)
    return new_slides

# ==========================================
# MAIN FASTAPI EXPOSED FUNCTION
# ==========================================
async def generate_ppt(prompt: str, context: str) -> Dict[str, Any]:    
    json_response = run_ppt_generation(prompt, context)
    
    try:
        parsed_data = json.loads(json_response)
        
        # Check if it's wrapped in a "slides" key or bare array
        if isinstance(parsed_data, dict) and "slides" in parsed_data:
            parsed_data = normalize_slides(parsed_data["slides"])
        elif isinstance(parsed_data, list):
            parsed_data = normalize_slides(parsed_data)
        else:
            raise ValueError("LLM returned unexpected JSON structure.")
            
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
