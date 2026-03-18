import asyncio
import base64
import os
from agents.ppt_agent import generate_ppt

async def test_gen():
    prompt = "Create a presentation about AI in Healthcare with 3 slides."
    print("Running generate_ppt...")
    try:
        result = await generate_ppt(prompt, "")
        b64_data = result["base64_file"]
        file_bytes = base64.b64decode(b64_data)
        
        output_path = "debug_output.pptx"
        with open(output_path, "wb") as f:
            f.write(file_bytes)
            
        print(f"SUCCESS! Created {output_path}")
        print(f"File size: {len(file_bytes)} bytes")
        
        # Check if file size is too small (blank PPTs are often < 10KB)
        if len(file_bytes) < 10000:
            print("WARNING: File size seems very small. Might be empty/unstylized.")
        else:
            print("File size looks healthy for a stylized PPT.")
            
    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(test_gen())
