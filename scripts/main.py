import os
import json
import gradio as gr
from modules import script_callbacks, scripts

class KeywordToggleScript(scripts.Script):
    def __init__(self):
        super().__init__()
        self.keywords = self.load_keywords()

    def load_keywords(self):
        """Load keywords from keywords.json or use defaults"""
        keywords_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "keywords.json")
        if os.path.exists(keywords_path):
            with open(keywords_path, 'r') as f:
                return json.load(f)
        return {"Animals": ["cat", "dog", "bird"], "Styles": ["anime", "photorealistic", "oil painting"]}
    
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

# Use try/except for compatibility with different WebUI versions
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

# No longer call ui_settings directly
script_callbacks.on_ui_settings(on_ui_settings)