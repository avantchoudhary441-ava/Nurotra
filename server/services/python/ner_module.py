import spacy

try:
    nlp = spacy.load("en_core_web_sm")
except ImportError:
    # Fallback if the user hasn't downloaded the model or there's a path issue
    nlp = None

def extract_entities(text):
    if not nlp or not text:
        return {
            "people": [],
            "organizations": [],
            "locations": [],
            "dates": [],
            "financialValues": [],
            "technologies": []
        }
    
    # Increase max length for very large docs if needed
    # nlp.max_length = 2000000 
    
    doc = nlp(text)
    entities = {
        "people": [],
        "organizations": [],
        "locations": [],
        "dates": [],
        "financialValues": [],
        "technologies": []
    }
    
    # Common tech keywords for special detection
    tech_keywords = {"AI", "ML", "EV", "IoT", "blockchain", "cloud", "Python", "JavaScript", "Tesla", "BYD"}

    for ent in doc.ents:
        label = ent.label_
        text = ent.text.strip()
        
        if label == "PERSON":
            entities["people"].append(text)
        elif label in ["ORG", "NORP"]:
            entities["organizations"].append(text)
        elif label in ["GPE", "LOC"]:
            entities["locations"].append(text)
        elif label in ["DATE", "TIME"]:
            entities["dates"].append(text)
        elif label in ["MONEY", "QUANTITY", "PERCENT"]:
            entities["financialValues"].append(text)
        
        # Overlay tech detection
        if any(tk.lower() in text.lower() for tk in tech_keywords):
            entities["technologies"].append(text)

    # De-duplicate and limit
    for key in entities:
        entities[key] = sorted(list(set(entities[key])))[:15]
        
    return entities

if __name__ == "__main__":
    test_text = "Elon Musk is the CEO of Tesla. They reported high EV sales in the USA on January 20, 2024. Revenue was $25 billion."
    print(extract_entities(test_text))
