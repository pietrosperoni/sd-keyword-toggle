# SD-Keyword-Toggle: Guide for AI Assistance

This document helps AI coding assistants understand this extension's architecture and provide better guidance. If you're using GitHub Copilot, Claude, or similar AI coding assistants, this will help them respond more accurately.

## Project Overview

SD-Keyword-Toggle is a Stable Diffusion WebUI extension that lets users toggle keywords between positive prompts, negative prompts, or disabled state via clickable buttons. Keywords are loaded from plain text files.

## Key Files and Their Purpose

- **`/scripts/main.py`**: Core Python file that:
  - Loads keywords from text files in the `/keywords` directory
  - Creates the Gradio UI components for the keyword buttons
  - Provides API endpoint for the JavaScript to fetch keywords

- **`/javascript/keyword-toggle-new.js`**: Main JavaScript that:
  - Controls button click behavior (toggle between positive/negative/neutral)
  - Updates the prompt textareas based on button states
  - Handles the state management of keywords

- **`/preload.py`**: Injects the JavaScript into the WebUI

- **`/keywords/*.txt`**: Text files containing keywords, one per line
  - Filename (without extension) becomes the category name
  - Contents become the individual keyword buttons

- **`/scripts/__init__.py`**: Empty file that marks the directory as a Python package (don't delete!)

## Code Flow and Architecture

1. `preload.py` loads the JavaScript into the WebUI
2. `main.py` reads keywords from text files and creates the UI
3. `keyword-toggle-new.js` handles button interactions and prompt updates

## Common Edit Scenarios

### Adding New Features
- Extend `main.py` for Python/backend changes
- Modify `keyword-toggle-new.js` for UI behavior changes

### Fixing Keywords
- Just edit the text files in `/keywords/` directory

### Styling Adjustments
- Modify the `addGlobalStyles()` function in `keyword-toggle-new.js`
- Or update the inline styles in the `toggleKeyword()` function

## Tips for AI Code Suggestions

- Keep changes minimal and focused on specific functions
- Maintain the simple file-based approach for keywords
- Remember that `keywords` directory contains text files, not a directory listing
- Preserve the toggle behavior (neutral -> positive -> negative -> neutral)
- Maintain compatibility with both txt2img and img2img interfaces

## Testing Recommendations

After making changes, suggest these tests:
1. Check if keywords load from text files
2. Verify button state transitions work correctly
3. Confirm prompt textareas update properly
4. Test with both txt2img and img2img

## Specific Guidance for AI

- Don't over-engineer; this is meant to be a simple extension
- Don't suggest JSON-based configuration (we moved away from that)
- Maintain the MIT license compliance
- Keep backward compatibility with existing keyword files