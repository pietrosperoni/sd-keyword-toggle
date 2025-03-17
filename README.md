# SD-Keyword-Toggle Extension

A keyword toggle extension for AUTOMATIC1111's Stable Diffusion Web UI that adds clickable keyword management to your prompts.

## Installation

1. Open your Stable Diffusion WebUI directory
2. Clone this repository into the `extensions` folder:
```bash
cd extensions
git clone https://github.com/pietrosperoni/sd-keyword-toggle
```
3. Restart your WebUI

Alternatively, install via the Extensions tab in WebUI:
1. Go to Extensions tab
2. Click "Install from URL"
3. Paste: `https://github.com/pietrosperoni/sd-keyword-toggle`
4. Click Install
5. Apply and restart UI

## Usage

### Basic Usage
- Keywords appear as clickable buttons above the prompt textbox
- Click once: Add to positive prompt
- Click twice: Move to negative prompt
- Click third time: Remove from prompts

### Customizing Keywords
1. Go to Settings tab
2. Find "Keyword Toggle" section
3. Add/edit keywords in the categories provided
4. Click "Save" and restart UI

### Categories
Keywords can be organized into categories. Default categories include:
- Style
- Quality
- Subject
- Lighting
- Custom

## Features
- Preserve cursor position when adding/removing keywords
- Visual indicators for keyword states
- Compatible with both txt2img and img2img interfaces
- Customizable keyword categories
- Import/export keyword settings

## Contributing
Pull requests welcome! Please see CONTRIBUTING.md for guidelines.

## License
MIT License - see LICENSE file for details