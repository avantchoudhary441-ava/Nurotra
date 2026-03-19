import asyncio
import traceback
import json
from camel.toolkits import PPTXToolkit

def test_toolkit():
    try:
        toolkit = PPTXToolkit()
        data = [
            {"title": "Impulse Buying", "subtitle": "A Deep Dive"},
            {"heading": "Why We Buy", "bullet_points": ["Reason 1: Emotions", "Reason 2: Sales", "Reason 3: Scarcity"]}
        ]
        toolkit.create_presentation(content=json.dumps(data), filename="test_output.pptx")
        print("Successfully generated test_output.pptx")
    except Exception as e:
        print('ERROR:', e)
        traceback.print_exc()

if __name__ == '__main__':
    test_toolkit()
