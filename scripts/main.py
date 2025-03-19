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
                            # Read lines and filter out empty lines and comments
                            keywords[category_name] = [
                                line.strip() for line in f.readlines()
                                if line.strip() and not line.strip().startswith('//')
                            ]
                    except Exception as e:
                        print(f"Error reading {file_path}: {e}")
        
        if not keywords:
            print("No keyword files found, using defaults")
            return {"Example": ["keyword1", "keyword2"], "Quality": ["masterpiece", "best quality"]}
        
        return keywords
    
    def title(self):
        return "Keyword Toggle"
    
    def show(self, is_img2img):
        return scripts.AlwaysVisible
    
    def ui(self, is_img2img):
        with gr.Accordion("Keyword Toggle", open=False):
            with gr.Tabs():
                for category, keywords in self.keywords.items():
                    with gr.Tab(category):
                        with gr.Row():
                            for keyword in keywords:
                                gr.Button(keyword, elem_id=f"keyword_{keyword.replace(' ', '_')}")
        return []

# Fix the API route function to accept the request parameter

def on_app_started(demo, app):
    script = KeywordToggleScript()
    
    # Add a route to get keywords - Fix: add request parameter
    @app.get("/sd-keyword-toggle/get-keywords")
    def get_keywords(request):  # Added request parameter here
        try:
            return {"keywords": script.load_keywords()}
        except Exception as e:
            print(f"Error loading keywords: {e}")
            return {"error": str(e)}, 500

# Register the callback
script_callbacks.on_app_started(on_app_started)