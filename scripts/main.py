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
        keywords_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "keywords")

        if os.path.exists(keywords_dir) and os.path.isdir(keywords_dir):
            for filename in sorted(os.listdir(keywords_dir)):
                if filename.endswith(".txt"):
                    category_name = filename[:-4]  # Remove .txt extension
                    file_path = os.path.join(keywords_dir, filename)

                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            lines = [
                                line.strip() for line in f.readlines()
                                if line.strip() and not line.strip().startswith('//')
                            ]

                            parsed_keywords = []
                            for line in lines:
                                if ": " in line:
                                    parts = line.split(": ", 1)
                                    button_text = parts[0].strip()
                                    prompt_text = parts[1].strip()
                                    parsed_keywords.append({"button": button_text, "prompt": prompt_text})
                                else:
                                    parsed_keywords.append({"button": line, "prompt": line})
                            keywords[category_name] = parsed_keywords

                    except Exception as e:
                        print(f"Error reading {file_path}: {e}")

        if not keywords:
            print("No keyword files found, using defaults")
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
            with gr.Row():
                order_button = gr.Button("🎲", variant="tool", elem_id="kt_order_mode", scale=0)
                gr.HTML('<button id="kt_new_category" class="lg secondary gradio-button svelte-cmf5ev" style="min-width: auto; max-width: 4em; padding: 5px 10px; cursor: pointer;">📁+</button>')

            with gr.Group() as tabs_container:
                self.render_keyword_tabs()

        return []

    def render_keyword_tabs(self):
        with gr.Tabs() as tabs:
            for category, keywords_list in self.keywords.items():
                with gr.Tab(category):
                    with gr.Row():
                        for keyword_obj in keywords_list:
                            button_text = keyword_obj['button']
                            gr.Button(button_text, elem_id=f"keyword_{button_text.replace(' ', '_')}")
                        # Add [...] button at the end of each category (as raw HTML to avoid shifting Gradio component indices)
                        gr.HTML(f'<button id="kt_add_{category}" class="lg secondary gradio-button svelte-cmf5ev" style="min-width: auto; max-width: 3em; padding: 5px 10px; cursor: pointer;">...</button>')
        return tabs

    def reload_and_render_tabs(self):
        print("Keyword Toggle: Reloading keywords from disk...")
        self.keywords = self.load_keywords()
        with gr.Group() as new_container:
            self.render_keyword_tabs()
        return new_container


def on_app_started(demo, app):
    from starlette.requests import Request
    from starlette.responses import JSONResponse

    script = KeywordToggleScript()
    keywords_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "keywords")

    @app.get("/sd-keyword-toggle/get-keywords")
    def get_keywords():
        try:
            return {"keywords": script.load_keywords()}
        except Exception as e:
            print(f"Error loading keywords: {e}")
            return {"error": str(e)}, 500

    @app.post("/sd-keyword-toggle/add-keyword")
    async def add_keyword(request: Request):
        try:
            body = await request.json()
            category = body.get("category", "")
            button_text = body.get("button_text", "").strip()
            prompt_text = body.get("prompt_text", "").strip()

            if not category or not button_text:
                return JSONResponse({"error": "Category and button text are required"}, status_code=400)

            if not prompt_text:
                prompt_text = button_text

            file_path = os.path.join(keywords_dir, f"{category}.txt")

            if button_text == prompt_text:
                line = button_text
            else:
                line = f"{button_text}: {prompt_text}"

            with open(file_path, 'a', encoding='utf-8') as f:
                f.write(f"\n{line}")

            return {"success": True, "button": button_text, "prompt": prompt_text}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    @app.post("/sd-keyword-toggle/delete-keyword")
    async def delete_keyword(request: Request):
        try:
            body = await request.json()
            category = body.get("category", "")
            button_text = body.get("button_text", "").strip()

            if not category or not button_text:
                return JSONResponse({"error": "Category and button text are required"}, status_code=400)

            file_path = os.path.join(keywords_dir, f"{category}.txt")

            if not os.path.exists(file_path):
                return JSONResponse({"error": "Category file not found"}, status_code=404)

            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            new_lines = []
            for line in lines:
                stripped = line.strip()
                if not stripped or stripped.startswith('//'):
                    new_lines.append(line)
                    continue

                if ": " in stripped:
                    line_button = stripped.split(": ", 1)[0].strip()
                else:
                    line_button = stripped

                if line_button != button_text:
                    new_lines.append(line)

            with open(file_path, 'w', encoding='utf-8') as f:
                f.writelines(new_lines)

            return {"success": True}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    @app.post("/sd-keyword-toggle/edit-keyword")
    async def edit_keyword(request: Request):
        try:
            body = await request.json()
            category = body.get("category", "")
            old_button_text = body.get("old_button_text", "").strip()
            new_button_text = body.get("new_button_text", "").strip()
            new_prompt_text = body.get("new_prompt_text", "").strip()

            if not category or not old_button_text or not new_button_text:
                return JSONResponse({"error": "Category, old and new button text are required"}, status_code=400)

            if not new_prompt_text:
                new_prompt_text = new_button_text

            file_path = os.path.join(keywords_dir, f"{category}.txt")

            if not os.path.exists(file_path):
                return JSONResponse({"error": "Category file not found"}, status_code=404)

            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            new_lines = []
            for line in lines:
                stripped = line.strip()
                if not stripped or stripped.startswith('//'):
                    new_lines.append(line)
                    continue

                if ": " in stripped:
                    line_button = stripped.split(": ", 1)[0].strip()
                else:
                    line_button = stripped

                if line_button == old_button_text:
                    if new_button_text == new_prompt_text:
                        new_lines.append(new_button_text + "\n")
                    else:
                        new_lines.append(f"{new_button_text}: {new_prompt_text}\n")
                else:
                    new_lines.append(line)

            with open(file_path, 'w', encoding='utf-8') as f:
                f.writelines(new_lines)

            return {"success": True, "button": new_button_text, "prompt": new_prompt_text}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    @app.post("/sd-keyword-toggle/create-category")
    async def create_category(request: Request):
        try:
            body = await request.json()
            category_name = body.get("category_name", "").strip()

            if not category_name:
                return JSONResponse({"error": "Category name is required"}, status_code=400)

            safe_name = "".join(c for c in category_name if c.isalnum() or c in (' ', '-', '_')).strip()
            if not safe_name:
                return JSONResponse({"error": "Invalid category name"}, status_code=400)

            file_path = os.path.join(keywords_dir, f"{safe_name}.txt")

            if os.path.exists(file_path):
                return JSONResponse({"error": "Category already exists"}, status_code=409)

            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(f"// Keywords for {safe_name}\n")

            return {"success": True, "category": safe_name}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)


script_callbacks.on_app_started(on_app_started)
