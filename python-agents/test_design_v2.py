import requests
import json

url = "http://localhost:8000/api/agents/ppt"
payload = {
    "prompt": "The History of Ancient Rome and its Architecture",
    "context_data": "Talk about Colosseum, Aqueducts, and the Fall of Rome."
}

try:
    print("Testing PPT Generation for 'Ancient Rome'...")
    response = requests.post(url, json=payload, timeout=60)
    data = response.json()
    if data.get("success") or data.get("slides"):
        print("SUCCESS! Generated slides with design:")
        # Show first slide design if available
        # The new prompt returns a 'design' object in the blueprint inside slides or separately
        if "slides" in data:
            # Note: My new generate_ppt returns {"slides": slides, "base64_file": "... "}
            print(f"Total Slides: {len(data['slides'])}")
            print("First 2 slides preview:")
            for s in data['slides'][:2]:
                print(f" - Layout: {s.get('layout')}, Heading: {s.get('heading', s.get('title'))}")
    else:
        print(f"FAILED: {data}")
except Exception as e:
    print(f"ERROR: {e}")
