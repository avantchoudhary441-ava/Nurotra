import sys
import json
import base64
import io
import pandas as pd
import numpy as np

# Import our custom modules
import text_cleaner
import ner_module
import excel_analyzer
import chunker

def process_request(request_json):
    try:
        data = json.loads(request_json)
        documents = data.get("documents", [])
        user_prompt = data.get("prompt", "")
        analysis_type = data.get("analysisType", "DEFAULT")
        
        results = {
            "processed_docs": [],
            "aggregated_entities": {
                "people": [], "organizations": [], "locations": [], "dates": [], "financialValues": [], "technologies": []
            },
            "dataset_insights": [],
            "overall_summary": "",
            "chunks_count": 0
        }
        
        all_text = ""
        
        for doc in documents:
            name = doc.get("name", "Unknown")
            raw_content = doc.get("content", "")
            doc_type = doc.get("type", "text")
            
            # 1. Text Cleaning
            cleaned = text_cleaner.clean_text(raw_content)
            
            # 2. Chunking
            doc_chunks = chunker.chunk_document(cleaned)
            results["chunks_count"] += len(doc_chunks)
            
            # 3. Specialized Analysis (Excel/Data)
            doc_insight = None
            if doc_type == "spreadsheet" or name.lower().endswith(('.xlsx', '.csv')):
                # Try to parse if we have a base64 buffer or raw string
                # For now assume 'content' is the string representation of csv/xlsx
                try:
                    df = None
                    if "," in cleaned and len(cleaned) < 100000: # heuristic for csv
                        df = pd.read_csv(io.StringIO(cleaned))
                    
                    if df is not None:
                        doc_insight = excel_analyzer.analyze_dataframe(df)
                        results["dataset_insights"].append({
                            "docName": name,
                            "insights": doc_insight
                        })
                except Exception as e:
                    pass

            # 4. Entity Extraction (on cleaned text)
            doc_entities = ner_module.extract_entities(cleaned)
            for key in results["aggregated_entities"]:
                results["aggregated_entities"][key].extend(doc_entities.get(key, []))
            
            results["processed_docs"].append({
                "name": name,
                "cleaned_snippet": cleaned[:1000],
                "entities": doc_entities,
                "chunks": len(doc_chunks)
            })
            
            all_text += "\n" + cleaned

        # Finalize aggregated entities
        for key in results["aggregated_entities"]:
            results["aggregated_entities"][key] = sorted(list(set(results["aggregated_entities"][key])))[:20]

        return results

    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    # Get input from stdin
    if len(sys.argv) > 1:
        # If input is passed as argument (for testing)
        input_data = sys.argv[1]
    else:
        input_data = sys.stdin.read()
        
    if input_data:
        output = process_request(input_data)
        print(json.dumps(output))
    else:
        print(json.dumps({"error": "No input provided"}))
