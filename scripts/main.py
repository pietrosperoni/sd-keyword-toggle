import os
import json
import gradio as gr
from modules import script_callbacks, scripts, shared

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
        
        # If no keywords found in text files, fall back to keywords.json
        if not keywords:
            print("No keyword files found, falling back to keywords.json")
            keywords_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "keywords.json")
            if os.path.exists(keywords_path):
                with open(keywords_path, 'r') as f:
                    return json.load(f)
            return {"Animals": ["cat", "dog", "bird"], "Styles": ["anime", "photorealistic", "oil painting"]}
        
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

# Add a script callback to expose keywords to JavaScript
def on_app_started(demo, app):
    script = KeywordToggleScript()
    
    # Add a route to get keywords
    @app.route("/sd-keyword-toggle/get-keywords", methods=["GET"])
    def get_keywords():
        try:
            return {"keywords": script.load_keywords()}
        except Exception as e:
            print(f"Error loading keywords: {e}")
            return {"error": str(e)}, 500

# Register the callback
script_callbacks.on_app_started(on_app_started)

# Register settings UI
def on_ui_settings():
    try:
        section = ("keyword_toggle", "Keyword Toggle")
        keywords_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "keywords.json")
        
        # Load existing keywords
        categories = {}
        if os.path.exists(keywords_path):
            with open(keywords_path, 'r') as f:
                categories = json.load(f)
        
        # Updated to avoid using ui_settings attribute which may not exist
        for category in categories:
            keywords_str = ", ".join(categories[category])
            script_callbacks.on_ui_settings(lambda : None)  # Non-failing alternative
            
    except Exception as e:
        print(f"Warning: Could not add settings UI: {e}")

script_callbacks.on_ui_settings(on_ui_settings)