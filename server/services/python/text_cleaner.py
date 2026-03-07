import re
import html

def clean_text(text):
    if not text:
        return ""
    
    # 1. Decode HTML entities and URL encoding
    text = html.unescape(text)
    text = re.sub(r'%[0-9a-fA-F]{2}', ' ', text)
    
    # 2. Remove broken formatting / common artifacts
    # Remove multiple dots or dashes used as separators
    text = re.sub(r'\.{3,}', ' ', text)
    text = re.sub(r'-{3,}', ' ', text)
    
    # 3. Handle line breaks and whitespace
    text = text.replace('\r', '\n')
    # Remove empty lines / excessive whitespace
    text = re.sub(r'\n\s*\n', '\n\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    
    # 4. Remove obvious duplicated sections (consecutive)
    lines = text.split('\n')
    cleaned_lines = []
    if lines:
        cleaned_lines.append(lines[0])
        for i in range(1, len(lines)):
            if lines[i].strip() != lines[i-1].strip() or not lines[i].strip():
                cleaned_lines.append(lines[i])
    
    text = '\n'.join(cleaned_lines)
    
    # 5. Final trim
    return text.strip()

if __name__ == "__main__":
    test_text = "Hello%20World... This is a test---with artifacts. \n\n\n Duplicated line.\n Duplicated line."
    print(clean_text(test_text))
