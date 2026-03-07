import re

class RecursiveCharacterTextSplitter:
    def __init__(self, chunk_size=1000, chunk_overlap=200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = ["\n\n", "\n", " ", ""]

    def split_text(self, text):
        return self._recursive_split(text, self.separators)

    def _recursive_split(self, text, separators):
        final_chunks = []
        separator = separators[-1]
        for s in separators:
            if s == "":
                separator = s
                break
            if s in text:
                separator = s
                break
        
        splits = text.split(separator) if separator != "" else list(text)
        
        current_chunk = ""
        for s in splits:
            if len(current_chunk) + len(s) + len(separator) <= self.chunk_size:
                current_chunk += (separator if current_chunk else "") + s
            else:
                if current_chunk:
                    final_chunks.append(current_chunk)
                
                # If the split itself is too big, recursion
                if len(s) > self.chunk_size:
                    new_separators = separators[separators.index(separator) + 1:]
                    final_chunks.extend(self._recursive_split(s, new_separators))
                    current_chunk = ""
                else:
                    current_chunk = s
        
        if current_chunk:
            final_chunks.append(current_chunk)
            
        return final_chunks

def chunk_document(text):
    # Detect logical sections first (e.g. Title, Intro, etc.)
    # For now, use recursive splitter
    splitter = RecursiveCharacterTextSplitter(chunk_size=2000, chunk_overlap=300)
    return splitter.split_text(text)

if __name__ == "__main__":
    test_text = "Section 1: Introduction\n\n" + "Word " * 1000 + "\n\nSection 2: Market"
    chunks = chunk_document(test_text)
    print(f"Divided into {len(chunks)} chunks.")
    for i, c in enumerate(chunks):
        print(f"Chunk {i+1}: {len(c)} chars")
