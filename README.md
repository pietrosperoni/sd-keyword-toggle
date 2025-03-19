# SD-Keyword-Toggle Extension

A simple, file-based keyword toggle extension for AUTOMATIC1111's Stable Diffusion Web UI that adds clickable keyword management to your prompts.
The keywords use the same structure than wildcards,
so you can simply copy wildcards files and use them. 
You can refer to for an explanation on them here: 
https://github.com/mattjaybe/sd-wildcards

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
- Keywords appear as clickable buttons organized by category
- Click once: Add to positive prompt (green button)
- Click twice: Move to negative prompt (red button)
- Click third time: Remove from prompts (gray button)
- The extension automatically updates your prompt textboxes

### Customizing Keywords
Simply add text files to the keywords directory:

1. Navigate to the extension folder: extensions/sd-keyword-toggle/keywords/
2. Create or edit .txt files with one keyword per line
3. The filename (without extension) becomes the category name
4. Restart UI or refresh page to see your changes

Example files:

human.txt -> Human category (person, woman, man, ...)
styles.txt -> Styles category (anime, photorealistic, oil painting...)
quality.txt -> Quality category (masterpiece, best quality...)

Example Format
Each text file should contain one keyword per line:

```
woman
man
elderly
teenager
```

## Features
- Simple file-based organization with plain text files
- Visual indicators for keyword states (green/red/gray)
- Click to toggle between positive/negative/disabled states
- Compatible with both txt2img and img2img interfaces
- Clean visual design that integrates with WebUI
- Remembers your base prompt while adding/removing keywords

## Contributing
Pull requests welcome!

## License
MIT License - see LICENSE file for details