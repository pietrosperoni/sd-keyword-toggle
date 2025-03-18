import os
import json
import gradio as gr
from modules import script_callbacks, scripts

class KeywordToggleScript(scripts.Script):
    def __init__(self):
        super().__init__()
        self.categories = {}
        self.load_keywords()

    def load_keywords(self):
        """Load keywords from keywords.json file"""
        keywords_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "keywords.json")
        if os.path.exists(keywords_path):
            with open(keywords_path, 'r') as f:
                self.categories = json.load(f)
        
    def title(self):
        return "Keyword Toggle"
    
    def show(self, is_img2img):
        return scripts.AlwaysVisible
    
    def ui(self, is_img2img):
        with gr.Accordion("Keyword Toggle", open=False):
            with gr.Tabs():
                for category, keywords in self.categories.items():
                    with gr.Tab(category):
                        with gr.Row():
                            for keyword in keywords:
                                gr.Button(keyword, elem_id=f"keyword_{keyword.replace(' ', '_')}")
        
        # Load custom JS
        js_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "javascript", "keyword-toggle.js")
        if os.path.exists(js_path):
            with open(js_path, 'r') as f:
                js_code = f.read()
            gr.HTML(f"<script>{js_code}</script>")
        
        return []
    
    def after_component(self, component, **kwargs):
        """Add keyword toggle UI after prompt textboxes"""
        if kwargs.get("elem_id") == "txt2img_prompt" or kwargs.get("elem_id") == "img2img_prompt":
            with gr.Row():
                keyword_container = gr.HTML('<div id="keyword-container-{}" class="keyword-container"></div>'.format(
                    "txt2img" if kwargs.get("elem_id") == "txt2img_prompt" else "img2img"
                ))
            
            # Initialize keywords for this prompt
            js_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "javascript", "initialize-keywords.js")
            if os.path.exists(js_path):
                with open(js_path, 'r') as f:
                    js_code = f.read()
                gr.HTML(f"<script>{js_code}</script>")

def on_ui_settings():
    """Add settings for the extension"""
    section = ("keyword_toggle", "Keyword Toggle")
    keywords_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "keywords.json")
    
    # Load existing keywords
    categories = {}
    if os.path.exists(keywords_path):
        with open(keywords_path, 'r') as f:
            categories = json.load(f)
    
    # Create settings fields for each category
    for category in categories:
        # Convert list to comma-separated string
        keywords_str = ", ".join(categories[category])
        script_callbacks.ui_settings.add_option(
            f"keyword_toggle_category_{category.lower()}",
            gr.Textbox, 
            {"label": f"{category} Keywords", "value": keywords_str},
            section=section
        )
    
    # Option to add new category
    script_callbacks.ui_settings.add_option(
        "keyword_toggle_new_category", 
        gr.Textbox, 
        {"label": "Add New Category", "placeholder": "Category Name"}, 
        section=section
    )

# Register UI callbacks
script_callbacks.on_ui_settings(on_ui_settings)