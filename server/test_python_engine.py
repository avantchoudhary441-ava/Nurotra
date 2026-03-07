import json
import subprocess
import os

def test_orchestrator():
    # Setup sample data
    test_data = {
        "prompt": "Analyze these ev sales documents and tell me the trends.",
        "analysisType": "DEFAULT",
        "documents": [
            {
                "name": "ev_sales.csv",
                "content": "Year,Sales,Company\n2018,100,Tesla\n2019,200,Tesla\n2020,400,Tesla\n2021,800,BYD",
                "type": "spreadsheet"
            },
            {
                "name": "market_notes.txt",
                "content": "Elon Musk mentioned that Tesla is growing rapidly in the USA. New battery technology is being developed in Germany.",
                "type": "text"
            }
        ]
    }
    
    # Path to orchestrator
    script_path = r"c:\Users\hp\OneDrive\Desktop\Nurotra\server\services\python\analysis_orchestrator.py"
    
    # Run via subprocess
    process = subprocess.Popen(
        ['python', script_path],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    stdout, stderr = process.communicate(input=json.dumps(test_data))
    
    print("STDOUT:", stdout)
    print("STDERR:", stderr)
    
    if stdout:
        try:
            result = json.loads(stdout)
            print("SUCCESS! Output summary:")
            print(f"Docs processed: {len(result['processed_docs'])}")
            print(f"Chunks: {result['chunks_count']}")
            print(f"Entities found: {len(result['aggregated_entities']['people'])} people, {len(result['aggregated_entities']['organizations'])} orgs")
            print(f"Dataset insights: {len(result['dataset_insights'])}")
            if result['dataset_insights']:
                print("Trend example:", result['dataset_insights'][0]['insights']['trends'])
        except Exception as e:
            print("Failed to parse JSON:", e)
    else:
        print("No output from orchestrator.")

if __name__ == "__main__":
    test_orchestrator()
