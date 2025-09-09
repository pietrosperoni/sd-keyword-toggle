import os
import gradio as gr
from modules import script_callbacks, scripts, shared

# This may appear as an unresolved import error in IDEs, but it works correctly at runtime
# because the WebUI adds its modules directory to Python's path when loading extensions

class KeywordToggleScript(scripts.Script):
    def __init__(self):
        super().__init__()
        self.keywords = self.load_keywords()

    def load_keywords(self):
        """Load keywords from text files in the keywords directory"""
        keywords = {}
        # Get the keywords directory
        keywords_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "keywords")
        
        # If keywords directory exists, read all .txt files
        if os.path.exists(keywords_dir) and os.path.isdir(keywords_dir):
            for filename in os.listdir(keywords_dir):
                if filename.endswith(".txt"):
                    category_name = filename[:-4]  # Remove .txt extension
                    file_path = os.path.join(keywords_dir, filename)
                    
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            lines = [
                                line.strip() for line in f.readlines()
                                if line.strip() and not line.strip().startswith('//')
                            ]
                            
                            # Parse lines for the "Button Text: Prompt Text" format
                            parsed_keywords = []
                            for line in lines:
                                if ": " in line:
                                    parts = line.split(": ", 1)
                                    button_text = parts[0].strip()
                                    prompt_text = parts[1].strip()
                                    parsed_keywords.append({"button": button_text, "prompt": prompt_text})
                                else:
                                    # If format is not used, button and prompt text are the same
                                    parsed_keywords.append({"button": line, "prompt": line})
                            keywords[category_name] = parsed_keywords

                    except Exception as e:
                        print(f"Error reading {file_path}: {e}")
        
        if not keywords:
            print("No keyword files found, using defaults")
            # Update default keywords to new structure
            return {
                "Example": [{"button": "keyword1", "prompt": "keyword1"}, {"button": "keyword2", "prompt": "keyword2"}],
                "Quality": [{"button": "masterpiece", "prompt": "masterpiece"}, {"button": "best quality", "prompt": "best quality"}]
            }
        
        return keywords
    
    def title(self):
        return "Keyword Toggle"
    
    def show(self, is_img2img):
        return scripts.AlwaysVisible
    
    def ui(self, is_img2img):
        with gr.Accordion("Keyword Toggle", open=False):
            with gr.Tabs():
                for category, keywords_list in self.keywords.items():
                    with gr.Tab(category):
                        with gr.Row():
                            for keyword_obj in keywords_list:
                                button_text = keyword_obj['button']
                                gr.Button(button_text, elem_id=f"keyword_{button_text.replace(' ', '_')}")
        return []

# Fix the API route function to accept the request parameter

def on_app_started(demo, app):
    script = KeywordToggleScript()
    
    # Add a route to get keywords
    @app.get("/sd-keyword-toggle/get-keywords")
    def get_keywords():
        try:
            return {"keywords": script.load_keywords()}
        except Exception as e:
            print(f"Error loading keywords: {e}")
            return {"error": str(e)}, 500

# Register the callback
script_callbacks.on_app_started(on_app_started)