import os
import json
import gradio as gr
from modules import script_callbacks, scripts, shared

# This may appear as an unresolved import error in IDEs, but it works correctly at runtime
# because the WebUI adds its modules directory to Python's path when loading extensions
#
# ARCHITECTURE: Two-level randomization system for Dynamic Prompts
#
# Each keyword tab can be "free" or "bound":
#   - FREE: keywords are individual elements in the global random pool
#   - BOUND: all keywords in the tab become ONE element with {N$, $kw1|kw2|...} syntax
#            and an optional prefix (e.g. "by " for artists)
#
# The global dice controls the outer pool: {globalN$, $elem1|elem2|...}
# BREAK mode separates tab outputs with SD's BREAK token instead of commas.
#
# Settings are persisted in keywords/config.json via GET/POST /sd-keyword-toggle/config
# UI controls (bound toggle, N, prefix) are rendered as raw HTML to avoid Gradio index shifting.

class KeywordToggleScript(scripts.Script):
    def __init__(self):
        super().__init__()
        self.keywords_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "keywords")
        self.config = self._load_config()
        self.keywords = self.load_keywords()

    def _load_config(self):
        config_path = os.path.join(self.keywords_dir, "config.json")
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    def load_keywords(self, include_hidden=False):
        """Load keywords from text files in the keywords directory.
        Respects tabOrder and hiddenTabs from config.json."""
        keywords = {}
        keywords_dir = self.keywords_dir
        tab_order = self.config.get("tabOrder", [])
        hidden_tabs = set(self.config.get("hiddenTabs", []))

        if os.path.exists(keywords_dir) and os.path.isdir(keywords_dir):
            # First, load all available categories
            available = {}
            for filename in os.listdir(keywords_dir):
                if filename.endswith(".txt"):
                    category_name = filename[:-4]
                    available[category_name] = os.path.join(keywords_dir, filename)

            # Build ordered list: config order first, then any new files alphabetically
            ordered_categories = []
            for cat in tab_order:
                if cat in available:
                    ordered_categories.append(cat)
            for cat in sorted(available.keys()):
                if cat not in ordered_categories:
                    ordered_categories.append(cat)

            for category_name in ordered_categories:
                if not include_hidden and category_name in hidden_tabs:
                    continue
                file_path = available[category_name]

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
            # Global controls row: dice with N input, BREAK toggle, new category button
            # All utility buttons use raw HTML to avoid shifting Gradio component indices
            gr.HTML('''
                <div class="kt-global-controls" style="display:flex; gap:8px; align-items:center; padding:4px 0; flex-wrap:wrap;">
                    <span class="kt-checkbox-wrap" title="Enable/disable keyword injection into prompt">
                        <input type="checkbox" id="kt_master_toggle" checked /> <span class="kt-master-label" style="font-size:12px; color:#aaa;">ON</span>
                    </span>
                    <button id="kt_order_mode" class="lg secondary gradio-button svelte-cmf5ev"
                        style="min-width:auto; max-width:3em; padding:5px 10px; cursor:pointer;">🎲</button>
                    <span style="font-size:12px; color:#aaa;">N:</span>
                    <input type="number" id="kt_global_random_n" min="0" value="0"
                        style="width:50px; padding:4px; background:#2a2a3e; color:#eee; border:1px solid #555; border-radius:4px; font-size:13px;" />
                    <span id="kt_global_count" style="font-size:12px; color:#888;">/ 0</span>
                    <span class="kt-checkbox-wrap" title="Auto N=M (shuffle all)">
                        <input type="checkbox" id="kt_global_useAll" /> <span style="font-size:11px; color:#aaa;">all</span>
                    </span>
                    <span style="border-left:1px solid #555; height:20px; margin:0 4px;"></span>
                    <button id="kt_break_add" class="lg secondary gradio-button svelte-cmf5ev"
                        style="min-width:auto; padding:5px 10px; cursor:pointer; font-size:12px;"
                        title="Add a new subject (BREAK section)">BREAK++</button>
                    <span style="font-size:12px; color:#aaa;">Subj:</span>
                    <span id="kt_subject_display" style="font-size:13px; color:#eee; font-weight:bold;">1</span>
                    <button id="kt_subject_prev" class="lg secondary gradio-button svelte-cmf5ev"
                        style="min-width:auto; padding:2px 6px; cursor:pointer; font-size:11px;">▲</button>
                    <button id="kt_subject_next" class="lg secondary gradio-button svelte-cmf5ev"
                        style="min-width:auto; padding:2px 6px; cursor:pointer; font-size:11px;">▼</button>
                    <span id="kt_subject_total" style="font-size:12px; color:#888;">on 1</span>
                    <button id="kt_reset_all" class="lg secondary gradio-button svelte-cmf5ev"
                        style="min-width:auto; padding:5px 10px; cursor:pointer;" title="Reset current subject / delete if empty">🔄</button>
                    <button id="kt_new_category" class="lg secondary gradio-button svelte-cmf5ev"
                        style="min-width:auto; max-width:4em; padding:5px 10px; cursor:pointer;">📁+</button>
                    <button id="kt_reorder_tabs" class="lg secondary gradio-button svelte-cmf5ev"
                        style="min-width:auto; padding:5px 10px; cursor:pointer; font-size:12px;"
                        title="Toggle tab reorder mode (drag & drop)">↔️</button>
                    <button id="kt_show_hidden" class="lg secondary gradio-button svelte-cmf5ev"
                        style="min-width:auto; padding:5px 10px; cursor:pointer; font-size:12px;"
                        title="Show/manage hidden tabs">👁</button>
                </div>
            ''')

            with gr.Group() as tabs_container:
                self.render_keyword_tabs()

        return []

    @staticmethod
    def _safe_id(name):
        """Convert category name to a safe HTML ID (no spaces or special chars)"""
        return name.replace(' ', '_').replace("'", '').replace('"', '')

    def render_keyword_tabs(self):
        with gr.Tabs() as tabs:
            for category, keywords_list in self.keywords.items():
                sid = self._safe_id(category)  # Safe ID for HTML attributes
                with gr.Tab(category):
                    gr.HTML(f'''
                        <div class="kt-tab-controls" data-category="{category}" data-polarity="pos"
                             style="display:flex; gap:6px; align-items:center; padding:2px 0; flex-wrap:wrap;">
                            <span class="kt-checkbox-wrap" title="Enable/disable this tab">
                                <input type="checkbox" id="kt_tab_enabled_{sid}" checked />
                            </span>
                            <button id="kt_tab_toggle_all_{sid}" class="kt-small-btn"
                                style="min-width:auto; padding:1px 5px; cursor:pointer; background:#444; color:#aaa;
                                       border:1px solid #555; border-radius:3px; font-size:10px;"
                                title="Cycle all: neutral → positive → negative → neutral">⊕</button>
                            <button id="kt_copy_active_{sid}" class="kt-small-btn"
                                style="min-width:auto; padding:2px 6px; cursor:pointer; background:#444; color:#aaa;
                                       border:1px solid #555; border-radius:3px; font-size:13px;"
                                title="Copy active (green) buttons to another tab">📋</button>
                            <button id="kt_delete_active_{sid}" class="kt-small-btn"
                                style="min-width:auto; padding:2px 6px; cursor:pointer; background:#444; color:#f66;
                                       border:1px solid #555; border-radius:3px; font-size:13px;"
                                title="Delete active (green) buttons from this tab permanently">🗑</button>
                            <span style="font-size:11px; color:#6f6;">+</span>
                            <button id="kt_bound_{sid}" class="kt-bound-toggle"
                                style="min-width:auto; padding:2px 6px; cursor:pointer; background:#555; color:#aaa;
                                       border:1px solid #666; border-radius:4px; font-size:11px;"
                                title="Toggle: free / bound">free</button>
                            <span class="kt-bound-fields" style="display:none; gap:6px; align-items:center;">
                                <span style="font-size:11px; color:#aaa;">N:</span>
                                <input type="number" id="kt_randomN_{sid}" min="0" value="0"
                                    style="width:45px; padding:2px; background:#2a2a3e; color:#eee; border:1px solid #555;
                                           border-radius:4px; font-size:11px;" />
                                <span id="kt_count_{sid}" style="font-size:11px; color:#888;">/ 0</span>
                                <span class="kt-checkbox-wrap" title="Auto N=M (shuffle all)">
                                    <input type="checkbox" id="kt_useAll_{sid}" /> <span style="font-size:10px; color:#aaa;">all</span>
                                </span>
                                <span style="font-size:11px; color:#aaa;">Pfx:</span>
                                <input type="text" id="kt_prefix_{sid}" value="" placeholder="prefix..."
                                    style="width:80px; padding:2px; background:#2a2a3e; color:#eee; border:1px solid #555;
                                           border-radius:4px; font-size:11px;" />
                            </span>
                        </div>
                        <div class="kt-tab-controls" data-category="{category}" data-polarity="neg"
                             style="display:flex; gap:6px; align-items:center; padding:2px 0; margin-bottom:4px; flex-wrap:wrap;">
                            <span style="font-size:11px; color:#f66;">-</span>
                            <button id="kt_neg_bound_{sid}" class="kt-bound-toggle"
                                style="min-width:auto; padding:2px 6px; cursor:pointer; background:#555; color:#aaa;
                                       border:1px solid #666; border-radius:4px; font-size:11px;"
                                title="Toggle: free / bound (negative)">free</button>
                            <span class="kt-bound-fields" style="display:none; gap:6px; align-items:center;">
                                <span style="font-size:11px; color:#aaa;">N:</span>
                                <input type="number" id="kt_neg_randomN_{sid}" min="0" value="0"
                                    style="width:45px; padding:2px; background:#2a2a3e; color:#eee; border:1px solid #555;
                                           border-radius:4px; font-size:11px;" />
                                <span id="kt_neg_count_{sid}" style="font-size:11px; color:#888;">/ 0</span>
                                <span class="kt-checkbox-wrap" title="Auto N=M (shuffle all)">
                                    <input type="checkbox" id="kt_neg_useAll_{sid}" /> <span style="font-size:10px; color:#aaa;">all</span>
                                </span>
                                <span style="font-size:11px; color:#aaa;">Pfx:</span>
                                <input type="text" id="kt_neg_prefix_{sid}" value="" placeholder="prefix..."
                                    style="width:80px; padding:2px; background:#2a2a3e; color:#eee; border:1px solid #555;
                                           border-radius:4px; font-size:11px;" />
                            </span>
                        </div>
                    ''')
                    with gr.Row():
                        for keyword_obj in keywords_list:
                            button_text = keyword_obj['button']
                            gr.Button(button_text, elem_id=f"keyword_{button_text.replace(' ', '_')}")
                        gr.HTML(f'<button id="kt_add_{sid}" class="lg secondary gradio-button svelte-cmf5ev" style="min-width: auto; max-width: 3em; padding: 5px 10px; cursor: pointer;">...</button>')
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
            return {"keywords": script.load_keywords(include_hidden=False)}
        except Exception as e:
            print(f"Error loading keywords: {e}")
            return {"error": str(e)}, 500

    @app.get("/sd-keyword-toggle/get-all-categories")
    def get_all_categories():
        """Returns all category names including hidden ones, for tab management"""
        try:
            all_keywords = script.load_keywords(include_hidden=True)
            hidden_tabs = script.config.get("hiddenTabs", [])
            return {
                "categories": list(all_keywords.keys()),
                "hiddenTabs": hidden_tabs
            }
        except Exception as e:
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

    @app.post("/sd-keyword-toggle/rename-category")
    async def rename_category(request: Request):
        try:
            body = await request.json()
            old_name = body.get("old_name", "").strip()
            new_name = body.get("new_name", "").strip()

            if not old_name or not new_name:
                return JSONResponse({"error": "Old and new names are required"}, status_code=400)

            safe_new = "".join(c for c in new_name if c.isalnum() or c in (' ', '-', '_')).strip()
            if not safe_new:
                return JSONResponse({"error": "Invalid new name"}, status_code=400)

            old_path = os.path.join(keywords_dir, f"{old_name}.txt")
            new_path = os.path.join(keywords_dir, f"{safe_new}.txt")

            if not os.path.exists(old_path):
                return JSONResponse({"error": "Category file not found"}, status_code=404)
            if os.path.exists(new_path):
                return JSONResponse({"error": "A category with that name already exists"}, status_code=409)

            os.rename(old_path, new_path)
            return {"success": True, "old_name": old_name, "new_name": safe_new}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    @app.post("/sd-keyword-toggle/delete-category")
    async def delete_category(request: Request):
        try:
            body = await request.json()
            category = body.get("category", "").strip()

            if not category:
                return JSONResponse({"error": "Category name is required"}, status_code=400)

            file_path = os.path.join(keywords_dir, f"{category}.txt")

            if not os.path.exists(file_path):
                return JSONResponse({"error": "Category file not found"}, status_code=404)

            # Move to Trash folder instead of deleting permanently
            trash_dir = os.path.join(keywords_dir, "Trash")
            os.makedirs(trash_dir, exist_ok=True)
            trash_path = os.path.join(trash_dir, f"{category}.txt")
            # If already exists in trash, add a number
            n = 2
            while os.path.exists(trash_path):
                trash_path = os.path.join(trash_dir, f"{category}({n}).txt")
                n += 1
            os.rename(file_path, trash_path)
            return {"success": True}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    # === Config persistence ===
    # Stores per-tab settings (bound/free, randomN, prefix) and global settings
    # (globalRandomN, useBreakSeparator) in a JSON file alongside the keyword files.

    config_path = os.path.join(keywords_dir, "config.json")

    @app.get("/sd-keyword-toggle/get-config")
    def get_config():
        try:
            if os.path.exists(config_path):
                with open(config_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            return {"globalRandomN": 0, "useBreakSeparator": False, "tabs": {}}
        except Exception as e:
            print(f"Error loading config: {e}")
            return {"globalRandomN": 0, "useBreakSeparator": False, "tabs": {}}

    @app.post("/sd-keyword-toggle/save-config")
    async def save_config(request: Request):
        try:
            body = await request.json()
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(body, f, indent=2, ensure_ascii=False)
            return {"success": True}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)


script_callbacks.on_app_started(on_app_started)
