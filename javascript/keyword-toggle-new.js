// === State Variables ===
//
// ARCHITECTURE OVERVIEW - Two-level randomization system:
//
// Each keyword tab can be in one of two modes:
//   - FREE ("libero"): its active keywords become individual elements in the global pool
//   - BOUND ("legato"): all active keywords in the tab are grouped into a single
//     Dynamic Prompts expression {N$, $kw1|kw2|...} with an optional prefix.
//     The entire expression becomes ONE element in the global pool.
//
// The global dice (🎲) controls the outer randomization:
//   - globalRandomN = 0: elements are joined with ", " (or BREAK)
//   - globalRandomN > 0: elements are wrapped in {globalN$, $elem1|elem2|...}
//
// Example with 2 bound tabs and 1 free tab:
//   Tab "Artists" BOUND, N=3, prefix="by " → 1 element: "by {3$, $artist1|artist2|artist3}"
//   Tab "Quality" FREE, keywords: masterpiece, detailed → 2 elements
//   Tab "Background" BOUND, N=2, prefix="in " → 1 element: "in {2$, $forest|castle|clouds}"
//   Global pool = 4 elements. With dice N=4:
//   {4$, $by {3$, $artist1|artist2|artist3}|masterpiece|detailed|in {2$, $forest|castle|clouds}}
//

// Keyword states per tab, per context. Structure: { category: { promptText: state } }
// This allows the same keyword to appear in multiple tabs with independent states.
// State values: 0=neutral (gray), 1=positive (green), 2=negative (red)
const txt2imgKeywordStates = {};
const img2imgKeywordStates = {};

// Separate base text for each interface
let txt2imgBasePositiveText = "";
let txt2imgBaseNegativeText = "";
let img2imgBasePositiveText = "";
let img2imgBaseNegativeText = "";

let hasInitializedTxt2img = false;
let hasInitializedImg2img = false;
let knownKeywords = new Set(); // Will store prompt texts
let buttonToPromptMap = {}; // Maps button text to prompt text

// Per-tab settings: maps category name to {bound: bool, randomN: int, prefix: string}
// - bound: if true, tab keywords are grouped as one element; if false, each keyword is separate
// - randomN: for bound tabs, how many keywords to randomly pick (0 = all, stable order)
// - prefix: text prepended to the tab's output (e.g. "by " for artists)
let tabSettings = {};

// Maps each prompt text back to its category, so updatePrompts() can group by tab
let promptToCategoryMap = {};

// Ordered list of category names, matching the visual tab order
let categoryOrder = [];

// Global dice: how many elements to pick from the global pool (0 = no global random)
let globalRandomN = 0;

// When true, tab outputs are separated by "\nBREAK\n" instead of ", "
let useBreakSeparator = false;

// When true, globalRandomN auto-tracks the pool size (shuffle all)
let globalUseAll = false;

// Master toggle: when false, keywords are not injected into the prompt
let keywordToggleEnabled = true;

// === Core Functions ===

function toggleKeyword(button) {
    const tabId = button.closest('#tab_img2img') ? "img2img" : "txt2img";
    const isImg2img = tabId === "img2img";
    const keywordStates = isImg2img ? img2imgKeywordStates : txt2imgKeywordStates;

    const buttonText = button.textContent.trim().replace(/^[+\-] /, '');
    const promptText = buttonToPromptMap[buttonText] || buttonText;
    const category = getCategoryForButton(button);

    if (!category) {
        console.error("Could not determine category for button:", buttonText);
        return;
    }

    // Ensure nested structure exists
    if (!keywordStates[category]) keywordStates[category] = {};
    if (keywordStates[category][promptText] === undefined) {
        keywordStates[category][promptText] = 0;
    }

    keywordStates[category][promptText] = (keywordStates[category][promptText] + 1) % 3;
    const newState = keywordStates[category][promptText];

    // Only update THIS button's appearance (not other buttons with the same text in other tabs)
    updateButtonAppearance(button, newState, buttonText);

    updatePrompts(isImg2img);
}

function updateButtonAppearance(button, state, buttonText) {
    button.dataset.kwState = state;
    button.setAttribute("style", "");

    if (state === 1) { // positive - green
        button.textContent = "+ " + buttonText;
        button.style.cssText = `
            background: #00ff00 !important;
            color: black !important;
            font-weight: 900 !important;
            margin: 2px !important;
            padding: 5px 10px !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            border: 5px solid lime !important;
            box-shadow: 0 0 10px lime !important;
            text-shadow: 1px 1px 0 white !important;
            outline: none !important;
            position: relative !important;
            z-index: 100 !important;
        `;
    } else if (state === 2) { // negative - red
        button.textContent = "- " + buttonText;
        button.style.cssText = `
            background: #ff0000 !important;
            color: white !important;
            font-weight: 900 !important;
            margin: 2px !important;
            padding: 5px 10px !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            border: 5px solid yellow !important;
            box-shadow: 0 0 10px red !important;
            text-shadow: 1px 1px 0 black !important;
            outline: none !important;
            position: relative !important;
            z-index: 100 !important;
        `;
    } else { // neutral - gray
        button.textContent = buttonText;
        button.style.cssText = `
            background: #555555 !important;
            color: white !important;
            margin: 2px !important;
            padding: 5px 10px !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            border: none !important;
            outline: none !important;
            position: relative !important;
            z-index: 100 !important;
        `;
    }
}

function cleanUserText(text) {
    if (!text) return "";

    let cleanedText = text;

    knownKeywords.forEach(keyword => {
        const escapedKeyword = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const keywordPattern = new RegExp(`(^|,\\s*)${escapedKeyword}(\\s*,|$)`, 'gi');
        cleanedText = cleanedText.replace(keywordPattern, (match, p1, p2) => {
            if (p1 && p2) return ", ";
            return "";
        });

        if (cleanedText.trim() === keyword) {
            cleanedText = '';
        }
    });

    cleanedText = cleanedText.replace(/,\s*,/g, ',').replace(/^\s*,\s*|\s*,\s*$/g, '').trim();
    return cleanedText;
}

// === Styles ===

function addGlobalStyles() {
    if (document.getElementById("kw-toggle-styles")) return;

    const styleEl = document.createElement("style");
    styleEl.id = "kw-toggle-styles";
    styleEl.textContent = `
        /* Force button styles based on data-kw-state attribute */
        [id^="keyword_"][data-kw-state="1"] {
            background: #00ff00 !important;
            color: black !important;
            font-weight: 900 !important;
            border: 5px solid lime !important;
            box-shadow: 0 0 10px lime !important;
            text-shadow: 1px 1px 0 white !important;
        }

        [id^="keyword_"][data-kw-state="2"] {
            background: #ff0000 !important;
            color: white !important;
            font-weight: 900 !important;
            border: 5px solid yellow !important;
            box-shadow: 0 0 10px red !important;
            text-shadow: 1px 1px 0 black !important;
        }

        [id^="keyword_"][data-kw-state="0"] {
            background: #555555 !important;
            color: white !important;
            border: none !important;
        }

        /* Style for the order mode button (dice) */
        #kt_order_mode {
            transition: color 0.2s ease-in-out, border-color 0.2s ease-in-out !important;
        }
        #kt_order_mode.random-mode {
            border-color: #34d399 !important;
            color: #34d399 !important;
        }

        /* BREAK toggle button */
        #kt_break_mode {
            transition: color 0.2s ease-in-out, border-color 0.2s ease-in-out, background 0.2s ease-in-out !important;
        }
        #kt_break_mode.break-active {
            border-color: #f59e0b !important;
            color: #f59e0b !important;
        }

        /* Checkbox wrapper - consistent styling for all checkboxes.
           Uses appearance:auto to get native browser checkbox with checkmark. */
        .kt-checkbox-wrap {
            display: inline-flex !important;
            align-items: center !important;
            gap: 4px !important;
            cursor: pointer !important;
        }
        .kt-checkbox-wrap input[type="checkbox"] {
            -webkit-appearance: auto !important;
            appearance: auto !important;
            width: 16px !important;
            height: 16px !important;
            margin: 0 !important;
            cursor: pointer !important;
            accent-color: #34d399 !important;
            opacity: 1 !important;
            position: static !important;
            pointer-events: auto !important;
        }

        /* Per-tab controls row */
        .kt-tab-controls {
            padding-bottom: 2px;
        }
        .kt-tab-controls[data-polarity="neg"] {
            border-bottom: 1px solid #333;
        }

        .kt-bound-toggle {
            transition: all 0.2s ease-in-out;
            font-size: 11px;
        }

        .kt-bound-fields {
            display: none;
        }

        /* Modal overlay */
        .kt-modal-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .kt-modal {
            background: #1a1a2e;
            border: 1px solid #444;
            border-radius: 8px;
            padding: 20px;
            min-width: 400px;
            max-width: 500px;
            color: #eee;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }

        .kt-modal h3 {
            margin: 0 0 15px 0;
            font-size: 16px;
            color: #fff;
        }

        .kt-modal-field {
            margin-bottom: 12px;
        }

        .kt-modal-field label {
            display: block;
            margin-bottom: 4px;
            font-size: 13px;
            color: #aaa;
        }

        .kt-modal-field input {
            width: 100%;
            padding: 8px;
            border: 1px solid #555;
            border-radius: 4px;
            background: #2a2a3e;
            color: #eee;
            font-size: 14px;
            box-sizing: border-box;
        }

        .kt-modal-field input:focus {
            outline: none;
            border-color: #6366f1;
        }

        .kt-modal-buttons {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 16px;
        }

        .kt-modal-buttons button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
        }

        .kt-modal-btn-ok {
            background: #6366f1;
            color: white;
        }

        .kt-modal-btn-ok:hover {
            background: #5558e6;
        }

        .kt-modal-btn-cancel {
            background: #555;
            color: white;
        }

        .kt-modal-btn-cancel:hover {
            background: #666;
        }

        .kt-modal-btn-danger {
            background: #dc2626;
            color: white;
        }

        .kt-modal-btn-danger:hover {
            background: #b91c1c;
        }

        /* Context menu */
        .kt-context-menu {
            position: fixed;
            z-index: 10001;
            background: #1a1a2e;
            border: 1px solid #444;
            border-radius: 6px;
            padding: 4px 0;
            min-width: 120px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        .kt-context-item {
            padding: 8px 16px;
            cursor: pointer;
            color: #eee;
            font-size: 13px;
        }

        .kt-context-item:hover {
            background: #2a2a3e;
        }

        .kt-context-item.danger {
            color: #f87171;
        }

        .kt-context-item.danger:hover {
            background: #3a1a1a;
        }
    `;

    document.head.appendChild(styleEl);
    console.log("Global styles added");
}

// === Prompt Management ===

function updatePrompts(isImg2img = false) {
    console.log(`Updating prompts for ${isImg2img ? 'img2img' : 'txt2img'}`);

    let positivePrompt, negativePrompt;
    let basePositiveText, baseNegativeText;
    let hasInitialized;
    const keywordStates = isImg2img ? img2imgKeywordStates : txt2imgKeywordStates;

    if (isImg2img) {
        positivePrompt = document.querySelector('#img2img_prompt textarea');
        negativePrompt = document.querySelector('#img2img_neg_prompt textarea');
        basePositiveText = img2imgBasePositiveText;
        baseNegativeText = img2imgBaseNegativeText;
        hasInitialized = hasInitializedImg2img;
    } else {
        positivePrompt = document.querySelector('#txt2img_prompt textarea');
        negativePrompt = document.querySelector('#txt2img_neg_prompt textarea');
        basePositiveText = txt2imgBasePositiveText;
        baseNegativeText = txt2imgBaseNegativeText;
        hasInitialized = hasInitializedTxt2img;
    }

    if (!positivePrompt || !negativePrompt) {
        console.log(`Could not find ${isImg2img ? 'img2img' : 'txt2img'} prompt textareas!`);
        return;
    }

    if (!hasInitialized) {
        if (isImg2img) {
            img2imgBasePositiveText = cleanUserText(positivePrompt.value || "");
            img2imgBaseNegativeText = cleanUserText(negativePrompt.value || "");
            hasInitializedImg2img = true;
            basePositiveText = img2imgBasePositiveText;
            baseNegativeText = img2imgBaseNegativeText;
        } else {
            txt2imgBasePositiveText = cleanUserText(positivePrompt.value || "");
            txt2imgBaseNegativeText = cleanUserText(negativePrompt.value || "");
            hasInitializedTxt2img = true;
            basePositiveText = txt2imgBasePositiveText;
            baseNegativeText = txt2imgBaseNegativeText;
        }
        console.log(`Initialized ${isImg2img ? 'img2img' : 'txt2img'} base text:`, basePositiveText, baseNegativeText);
    }

    let newPositiveText = cleanUserText(basePositiveText);
    let newNegativeText = cleanUserText(baseNegativeText);

    // Master toggle: when OFF, skip keyword injection entirely
    if (!keywordToggleEnabled) {
        try {
            positivePrompt.value = newPositiveText;
            negativePrompt.value = newNegativeText;
            positivePrompt.dispatchEvent(new Event('input', {bubbles: true}));
            negativePrompt.dispatchEvent(new Event('input', {bubbles: true}));
        } catch (e) {
            console.error(`Error updating textareas:`, e);
        }
        return;
    }

    // --- Two-level prompt composition ---
    //
    // Both positive and negative keywords support per-tab bound/free/prefix/N settings.
    // Positive uses tabSettings[cat].pos, negative uses tabSettings[cat].neg.
    // The global dice (globalRandomN) only applies to positive keywords.

    let posByCategory = {};  // category -> [promptText, ...]
    let negByCategory = {};  // category -> [promptText, ...]

    // Iterate per-category nested state: keywordStates[category][promptText] = state
    for (const category in keywordStates) {
        const catStates = keywordStates[category];
        for (const keyword in catStates) {
            const state = catStates[keyword];
            if (state === 1) {
                if (!posByCategory[category]) posByCategory[category] = [];
                posByCategory[category].push(keyword);
            } else if (state === 2) {
                if (!negByCategory[category]) negByCategory[category] = [];
                negByCategory[category].push(keyword);
            }
        }
    }

    // Helper: build pool from per-category keywords using bound/free settings
    function buildPool(byCategory, polarityKey) {
        let pool = [];
        for (const category of categoryOrder) {
            if (tabEnabled[category] === false) continue; // Skip disabled tabs
            const keywords = byCategory[category];
            if (!keywords || keywords.length === 0) continue;

            const catSettings = tabSettings[category];
            const s = catSettings && catSettings[polarityKey] ? catSettings[polarityKey] : { bound: false, randomN: 0, prefix: '' };

            if (s.bound) {
                let tabStr;
                if (s.randomN > 0 && keywords.length > 1) {
                    const n = Math.min(s.randomN, keywords.length);
                    tabStr = `{${n}$$, $$${keywords.join('|')}}`;
                } else {
                    tabStr = keywords.join(', ');
                }
                if (s.prefix) tabStr = s.prefix + tabStr;
                pool.push(tabStr);
            } else {
                for (const kw of keywords) pool.push(kw);
            }
        }
        // Handle categories not in categoryOrder
        for (const category in byCategory) {
            if (!categoryOrder.includes(category)) {
                for (const kw of byCategory[category]) pool.push(kw);
            }
        }
        return pool;
    }

    // Build positive prompt
    const posPool = buildPool(posByCategory, 'pos');
    if (posPool.length > 0) {
        let keywordString;
        if (globalRandomN > 0 && posPool.length > 1) {
            const n = Math.min(globalRandomN, posPool.length);
            keywordString = `{${n}$$, $$${posPool.join('|')}}`;
        } else if (useBreakSeparator) {
            keywordString = posPool.join('\nBREAK\n');
        } else {
            keywordString = posPool.join(', ');
        }
        if (newPositiveText && newPositiveText.length > 0 &&
            !newPositiveText.endsWith(' ') && !newPositiveText.endsWith(',')) {
            newPositiveText += ', ';
        }
        newPositiveText += keywordString;
    }

    // Build negative prompt (same bound/free logic, no global dice)
    const negPool = buildPool(negByCategory, 'neg');
    if (negPool.length > 0) {
        const negString = negPool.join(', ');
        if (newNegativeText && newNegativeText.length > 0 &&
            !newNegativeText.endsWith(' ') && !newNegativeText.endsWith(',')) {
            newNegativeText += ', ';
        }
        newNegativeText += negString;
    }

    console.log(`Setting ${isImg2img ? 'img2img' : 'txt2img'} prompts to:`, newPositiveText, newNegativeText);

    try {
        positivePrompt.value = newPositiveText;
        negativePrompt.value = newNegativeText;
        positivePrompt.dispatchEvent(new Event('input', {bubbles: true}));
        negativePrompt.dispatchEvent(new Event('input', {bubbles: true}));
        console.log(`${isImg2img ? 'img2img' : 'txt2img'} Textarea values updated`);
    } catch (e) {
        console.error(`Error updating ${isImg2img ? 'img2img' : 'txt2img'} textareas:`, e);
    }

    positivePrompt.addEventListener('input', function(e) {
        if (!e.isTrusted) return;
        if (isImg2img) {
            img2imgBasePositiveText = cleanUserText(this.value);
        } else {
            txt2imgBasePositiveText = cleanUserText(this.value);
        }
    });

    negativePrompt.addEventListener('input', function(e) {
        if (!e.isTrusted) return;
        if (isImg2img) {
            img2imgBaseNegativeText = cleanUserText(this.value);
        } else {
            txt2imgBaseNegativeText = cleanUserText(this.value);
        }
    });

    // Update N/M counters after prompt rebuild
    updateAllCounts();
}

// === API Functions ===

async function loadKeywordsFromFiles() {
    knownKeywords = new Set();
    buttonToPromptMap = {};
    promptToCategoryMap = {};
    categoryOrder = [];

    try {
        const response = await fetch('/sd-keyword-toggle/get-keywords');

        if (response.ok) {
            const data = await response.json();
            console.log("Successfully loaded keywords from server:", data);

            const keywordData = data.keywords;
            for (const category in keywordData) {
                categoryOrder.push(category);
                // Initialize tabSettings for new categories (preserve existing settings)
                if (!tabSettings[category]) {
                    tabSettings[category] = {
                        pos: { bound: false, randomN: 0, prefix: '', useAll: false },
                        neg: { bound: false, randomN: 0, prefix: '', useAll: false }
                    };
                }
                keywordData[category].forEach(keywordObj => {
                    if (typeof keywordObj === 'object' && keywordObj.prompt && keywordObj.button) {
                        knownKeywords.add(keywordObj.prompt);
                        buttonToPromptMap[keywordObj.button] = keywordObj.prompt;
                        promptToCategoryMap[keywordObj.prompt] = category;
                    } else if (typeof keywordObj === 'string') {
                        knownKeywords.add(keywordObj);
                        buttonToPromptMap[keywordObj] = keywordObj;
                        promptToCategoryMap[keywordObj] = category;
                    }
                });
            }

            return keywordData;
        } else {
            console.error("Failed to load keywords from API:", response.status, response.statusText);
        }
    } catch (error) {
        console.error("Error loading keywords from API:", error);
    }

    // Fallback to keywords.json
    try {
        console.log("Falling back to keywords.json");
        const jsonResponse = await fetch('/extensions/sd-keyword-toggle/keywords.json');

        if (jsonResponse.ok) {
            const jsonData = await jsonResponse.json();

            for (const category in jsonData) {
                jsonData[category].forEach(keyword => {
                    if (typeof keyword === 'string') {
                        knownKeywords.add(keyword);
                        buttonToPromptMap[keyword] = keyword;
                    }
                });
            }

            return jsonData;
        }
    } catch (jsonError) {
        console.error("Error loading keywords.json:", jsonError);
    }

    // Default keywords
    console.log("Using default keywords");
    const defaultKeywords = {
        "Quality": ["masterpiece", "high quality", "best quality"],
        "Style": ["anime", "photorealistic", "digital art"]
    };

    for (const category in defaultKeywords) {
        defaultKeywords[category].forEach(keyword => {
            knownKeywords.add(keyword);
            buttonToPromptMap[keyword] = keyword;
        });
    }

    return defaultKeywords;
}

async function apiAddKeyword(category, buttonText, promptText) {
    const response = await fetch('/sd-keyword-toggle/add-keyword', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({category, button_text: buttonText, prompt_text: promptText})
    });
    return await response.json();
}

async function apiDeleteKeyword(category, buttonText) {
    const response = await fetch('/sd-keyword-toggle/delete-keyword', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({category, button_text: buttonText})
    });
    return await response.json();
}

async function apiEditKeyword(category, oldButtonText, newButtonText, newPromptText) {
    const response = await fetch('/sd-keyword-toggle/edit-keyword', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({category, old_button_text: oldButtonText, new_button_text: newButtonText, new_prompt_text: newPromptText})
    });
    return await response.json();
}

async function apiCreateCategory(categoryName) {
    const response = await fetch('/sd-keyword-toggle/create-category', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({category_name: categoryName})
    });
    return await response.json();
}

// === Config Persistence ===
// Loads and saves per-tab settings (bound/free, randomN, prefix) and global settings.
// Config is stored server-side in keywords/config.json.

async function loadConfig() {
    try {
        const response = await fetch('/sd-keyword-toggle/get-config');
        if (response.ok) {
            const config = await response.json();
            globalRandomN = config.globalRandomN || 0;
            globalUseAll = config.globalUseAll || false;
            useBreakSeparator = config.useBreakSeparator || false;
            keywordToggleEnabled = config.keywordToggleEnabled !== false; // default true
            if (config.tabs) {
                for (const category in config.tabs) {
                    const t = config.tabs[category];
                    if (t.pos) {
                        // New format with pos/neg sub-objects
                        tabSettings[category] = {
                            pos: { bound: t.pos.bound || false, randomN: t.pos.randomN || 0, prefix: t.pos.prefix || '', useAll: t.pos.useAll || false },
                            neg: { bound: (t.neg && t.neg.bound) || false, randomN: (t.neg && t.neg.randomN) || 0, prefix: (t.neg && t.neg.prefix) || '', useAll: (t.neg && t.neg.useAll) || false }
                        };
                    } else {
                        // Old format: migrate to pos sub-object
                        tabSettings[category] = {
                            pos: { bound: t.bound || false, randomN: t.randomN || 0, prefix: t.prefix || '', useAll: t.useAll || false },
                            neg: { bound: false, randomN: 0, prefix: '', useAll: false }
                        };
                    }
                }
            }
            console.log("Config loaded:", config);
        }
    } catch (e) {
        console.error("Error loading config:", e);
    }
}

let saveConfigTimeout = null;
function saveConfigDebounced() {
    if (saveConfigTimeout) clearTimeout(saveConfigTimeout);
    saveConfigTimeout = setTimeout(async () => {
        try {
            const config = {
                globalRandomN,
                globalUseAll,
                useBreakSeparator,
                keywordToggleEnabled,
                tabs: {}
            };
            for (const category in tabSettings) {
                config.tabs[category] = { ...tabSettings[category] };
            }
            await fetch('/sd-keyword-toggle/save-config', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(config)
            });
            console.log("Config saved");
        } catch (e) {
            console.error("Error saving config:", e);
        }
    }, 500);
}

// === Helper: find category from a button element ===

function getCategoryForButton(button) {
    // Traverse up to find a container that has a kt_add_ button
    let container = button.parentElement;
    while (container) {
        const addBtn = container.querySelector('[id^="kt_add_"]');
        if (addBtn) {
            return addBtn.id.replace('kt_add_', '');
        }
        container = container.parentElement;
        // Stop at the accordion level
        if (container && container.id && container.id.startsWith('tab_')) break;
    }
    return null;
}

// === Modal System ===

function ktShowModal(title, fields, buttons) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'kt-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'kt-modal';

        const h3 = document.createElement('h3');
        h3.textContent = title;
        modal.appendChild(h3);

        const inputs = {};

        fields.forEach(field => {
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'kt-modal-field';

            const label = document.createElement('label');
            label.textContent = field.label;
            fieldDiv.appendChild(label);

            const input = document.createElement('input');
            input.type = 'text';
            input.value = field.value || '';
            input.placeholder = field.placeholder || '';
            fieldDiv.appendChild(input);

            inputs[field.key] = input;
            modal.appendChild(fieldDiv);
        });

        const btnContainer = document.createElement('div');
        btnContainer.className = 'kt-modal-buttons';

        function closeModal(result) {
            overlay.remove();
            resolve(result);
        }

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal(null);
        });

        // Close on Escape
        function onKeydown(e) {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', onKeydown);
                closeModal(null);
            } else if (e.key === 'Enter') {
                document.removeEventListener('keydown', onKeydown);
                const values = {};
                for (const key in inputs) values[key] = inputs[key].value;
                closeModal({action: 'ok', values});
            }
        }
        document.addEventListener('keydown', onKeydown);

        buttons.forEach(btnDef => {
            const btn = document.createElement('button');
            btn.textContent = btnDef.text;
            btn.className = btnDef.className || 'kt-modal-btn-cancel';
            btn.addEventListener('click', () => {
                document.removeEventListener('keydown', onKeydown);
                if (btnDef.action === 'ok') {
                    const values = {};
                    for (const key in inputs) values[key] = inputs[key].value;
                    closeModal({action: 'ok', values});
                } else if (btnDef.action === 'delete') {
                    closeModal({action: 'delete'});
                } else {
                    closeModal(null);
                }
            });
            btnContainer.appendChild(btn);
        });

        modal.appendChild(btnContainer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Focus first input
        const firstInput = modal.querySelector('input');
        if (firstInput) setTimeout(() => firstInput.focus(), 50);
    });
}

// === Add Keyword Modal ===

async function showAddKeywordModal(category) {
    const result = await ktShowModal(
        `Add keyword to "${category}"`,
        [
            {key: 'buttonText', label: 'Button text (what appears on the button)', placeholder: 'e.g. High Quality'},
            {key: 'promptText', label: 'Prompt text (what gets inserted in the prompt)', placeholder: 'e.g. masterpiece, best quality'}
        ],
        [
            {text: 'Cancel', action: 'cancel', className: 'kt-modal-btn-cancel'},
            {text: 'Add', action: 'ok', className: 'kt-modal-btn-ok'}
        ]
    );

    if (!result || result.action !== 'ok') return;

    let {buttonText, promptText} = result.values;
    buttonText = buttonText.trim();
    promptText = promptText.trim();

    if (!buttonText && !promptText) return;

    // If only one is provided, copy to the other
    if (!buttonText) buttonText = promptText;
    if (!promptText) promptText = buttonText;

    try {
        const response = await apiAddKeyword(category, buttonText, promptText);
        if (response.success) {
            // Register in tracking
            knownKeywords.add(promptText);
            buttonToPromptMap[buttonText] = promptText;

            // Add button to DOM in both txt2img and img2img
            addButtonToDOM(category, buttonText, promptText);
        } else {
            console.error("Failed to add keyword:", response.error);
            alert("Error: " + (response.error || "Failed to add keyword"));
        }
    } catch (e) {
        console.error("Error adding keyword:", e);
        alert("Error adding keyword: " + e.message);
    }
}

// === Edit Keyword Modal ===

async function showEditKeywordModal(category, buttonElement, currentButtonText, currentPromptText) {
    const result = await ktShowModal(
        `Edit keyword in "${category}"`,
        [
            {key: 'buttonText', label: 'Button text', value: currentButtonText},
            {key: 'promptText', label: 'Prompt text', value: currentPromptText}
        ],
        [
            {text: 'Delete', action: 'delete', className: 'kt-modal-btn-danger'},
            {text: 'Cancel', action: 'cancel', className: 'kt-modal-btn-cancel'},
            {text: 'Save', action: 'ok', className: 'kt-modal-btn-ok'}
        ]
    );

    if (!result) return;

    if (result.action === 'delete') {
        if (!confirm(`Delete "${currentButtonText}"?`)) return;

        try {
            const response = await apiDeleteKeyword(category, currentButtonText);
            if (response.success) {
                // Remove from tracking
                knownKeywords.delete(currentPromptText);
                delete buttonToPromptMap[currentButtonText];

                // Remove from per-tab keyword states
                if (txt2imgKeywordStates[category]) delete txt2imgKeywordStates[category][currentPromptText];
                if (img2imgKeywordStates[category]) delete img2imgKeywordStates[category][currentPromptText];

                // Remove button from DOM in both contexts
                removeButtonFromDOM(currentButtonText);

                // Update prompts
                updatePrompts(false);
                updatePrompts(true);
            } else {
                alert("Error: " + (response.error || "Failed to delete keyword"));
            }
        } catch (e) {
            console.error("Error deleting keyword:", e);
            alert("Error deleting keyword: " + e.message);
        }
        return;
    }

    if (result.action === 'ok') {
        let {buttonText, promptText} = result.values;
        buttonText = buttonText.trim();
        promptText = promptText.trim();

        if (!buttonText) return;
        if (!promptText) promptText = buttonText;

        // Skip if nothing changed
        if (buttonText === currentButtonText && promptText === currentPromptText) return;

        try {
            const response = await apiEditKeyword(category, currentButtonText, buttonText, promptText);
            if (response.success) {
                // Update tracking
                knownKeywords.delete(currentPromptText);
                delete buttonToPromptMap[currentButtonText];
                knownKeywords.add(promptText);
                buttonToPromptMap[buttonText] = promptText;

                // Transfer per-tab state from old prompt to new prompt
                if (txt2imgKeywordStates[category] && txt2imgKeywordStates[category][currentPromptText] !== undefined) {
                    txt2imgKeywordStates[category][promptText] = txt2imgKeywordStates[category][currentPromptText];
                    delete txt2imgKeywordStates[category][currentPromptText];
                }
                if (img2imgKeywordStates[category] && img2imgKeywordStates[category][currentPromptText] !== undefined) {
                    img2imgKeywordStates[category][promptText] = img2imgKeywordStates[category][currentPromptText];
                    delete img2imgKeywordStates[category][currentPromptText];
                }

                // Update buttons in DOM
                updateButtonInDOM(currentButtonText, buttonText, promptText);

                // Update prompts
                updatePrompts(false);
                updatePrompts(true);
            } else {
                alert("Error: " + (response.error || "Failed to edit keyword"));
            }
        } catch (e) {
            console.error("Error editing keyword:", e);
            alert("Error editing keyword: " + e.message);
        }
    }
}

// === New Category Modal ===

async function showNewCategoryModal() {
    const result = await ktShowModal(
        'Create new keyword category',
        [
            {key: 'categoryName', label: 'Category name', placeholder: 'e.g. colors'}
        ],
        [
            {text: 'Cancel', action: 'cancel', className: 'kt-modal-btn-cancel'},
            {text: 'Create', action: 'ok', className: 'kt-modal-btn-ok'}
        ]
    );

    if (!result || result.action !== 'ok') return;

    const categoryName = result.values.categoryName.trim();
    if (!categoryName) return;

    try {
        const response = await apiCreateCategory(categoryName);
        if (response.success) {
            addTabToDOM(response.category);
        } else {
            alert("Error: " + (response.error || "Failed to create category"));
        }
    } catch (e) {
        console.error("Error creating category:", e);
        alert("Error creating category: " + e.message);
    }
}

// === Context Menu ===

let activeContextMenu = null;

function hideContextMenu() {
    if (activeContextMenu) {
        activeContextMenu.remove();
        activeContextMenu = null;
    }
}

function showContextMenu(e, button) {
    e.preventDefault();
    hideContextMenu();

    const buttonText = button.textContent.trim().replace(/^[+\-] /, '');
    const promptText = buttonToPromptMap[buttonText] || buttonText;
    const category = getCategoryForButton(button);

    if (!category) {
        console.error("Could not determine category for button:", buttonText);
        return;
    }

    const menu = document.createElement('div');
    menu.className = 'kt-context-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';

    const editItem = document.createElement('div');
    editItem.className = 'kt-context-item';
    editItem.textContent = 'Edit';
    editItem.addEventListener('click', () => {
        hideContextMenu();
        showEditKeywordModal(category, button, buttonText, promptText);
    });
    menu.appendChild(editItem);

    const deleteItem = document.createElement('div');
    deleteItem.className = 'kt-context-item danger';
    deleteItem.textContent = 'Delete';
    deleteItem.addEventListener('click', async () => {
        hideContextMenu();
        if (!confirm(`Delete "${buttonText}"?`)) return;

        try {
            const response = await apiDeleteKeyword(category, buttonText);
            if (response.success) {
                knownKeywords.delete(promptText);
                delete buttonToPromptMap[buttonText];
                if (txt2imgKeywordStates[category]) delete txt2imgKeywordStates[category][promptText];
                if (img2imgKeywordStates[category]) delete img2imgKeywordStates[category][promptText];
                removeButtonFromDOM(buttonText);
                updatePrompts(false);
                updatePrompts(true);
            } else {
                alert("Error: " + (response.error || "Failed to delete keyword"));
            }
        } catch (err) {
            alert("Error deleting keyword: " + err.message);
        }
    });
    menu.appendChild(deleteItem);

    document.body.appendChild(menu);
    activeContextMenu = menu;

    // Adjust position if menu goes off-screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        menu.style.left = (window.innerWidth - rect.width - 5) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
        menu.style.top = (window.innerHeight - rect.height - 5) + 'px';
    }

    // Close context menu on next click (one-time listener, added after a tick to avoid immediate trigger)
    setTimeout(() => {
        document.addEventListener('click', function onClickAway() {
            hideContextMenu();
            document.removeEventListener('click', onClickAway);
        }, {once: true});
    }, 0);
}

// === DOM Manipulation ===

function addButtonToDOM(category, buttonText, promptText) {
    // Find all [...] buttons for this category and add the new button before them
    const addButtons = document.querySelectorAll(`[id="kt_add_${category}"]`);

    addButtons.forEach(addBtn => {
        // Find the parent container (Gradio Row)
        const container = addBtn.parentElement;
        if (!container) return;

        // Create new button element
        const newBtn = document.createElement('button');
        newBtn.id = `keyword_${buttonText.replace(/ /g, '_')}`;
        newBtn.textContent = buttonText;
        newBtn.className = addBtn.className; // Copy Gradio button classes
        newBtn.classList.remove('secondary'); // Remove secondary variant

        // Style it as neutral
        newBtn.style.cssText = `
            background: #555555 !important;
            color: white !important;
            margin: 2px !important;
            padding: 5px 10px !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            border: none !important;
            outline: none !important;
            position: relative !important;
            z-index: 100 !important;
        `;
        newBtn.dataset.kwState = '0';
        newBtn.dataset.kwInitialized = 'true';

        // Add click handler for toggling
        newBtn.addEventListener('click', function() {
            toggleKeyword(this);
        });

        // Add right-click handler
        newBtn.addEventListener('contextmenu', function(e) {
            showContextMenu(e, this);
        });

        // Insert before the [...] button
        container.insertBefore(newBtn, addBtn);
    });
}

function removeButtonFromDOM(buttonText) {
    const elemId = `keyword_${buttonText.replace(/ /g, '_')}`;
    // Remove all instances (txt2img and img2img)
    document.querySelectorAll(`[id="${elemId}"]`).forEach(btn => {
        btn.remove();
    });
}

function updateButtonInDOM(oldButtonText, newButtonText, newPromptText) {
    const oldElemId = `keyword_${oldButtonText.replace(/ /g, '_')}`;
    const newElemId = `keyword_${newButtonText.replace(/ /g, '_')}`;

    document.querySelectorAll(`[id="${oldElemId}"]`).forEach(btn => {
        btn.id = newElemId;

        // Determine current display state
        const state = parseInt(btn.dataset.kwState || '0');
        updateButtonAppearance(btn, state, newButtonText);
    });
}

function addTabToDOM(categoryName) {
    // Find all Keyword Toggle tab containers (one for txt2img, one for img2img)
    const tabContainers = document.querySelectorAll('.tabs');

    tabContainers.forEach(tabContainer => {
        // Check if this tabs container is inside a Keyword Toggle accordion
        const accordion = tabContainer.closest('.accordion');
        if (!accordion) return;
        const accordionLabel = accordion.querySelector('.label-wrap span');
        if (!accordionLabel || !accordionLabel.textContent.includes('Keyword Toggle')) return;

        // Find tab navigation
        const tabNav = tabContainer.querySelector('.tab-nav');
        if (!tabNav) return;

        // Create new tab header button
        const tabHeaderBtn = document.createElement('button');
        tabHeaderBtn.textContent = categoryName;
        // Copy class from existing tab buttons
        const existingTabBtn = tabNav.querySelector('button');
        if (existingTabBtn) {
            tabHeaderBtn.className = existingTabBtn.className;
            tabHeaderBtn.classList.remove('selected');
        }
        tabNav.appendChild(tabHeaderBtn);

        // Create new tab content panel
        const tabPanel = document.createElement('div');
        tabPanel.className = 'tabitem';
        tabPanel.style.display = 'none';

        // Create a row container
        const row = document.createElement('div');
        row.className = 'flex row gap-2';
        row.style.flexWrap = 'wrap';

        // Create the [...] add button
        const addBtn = document.createElement('button');
        addBtn.id = `kt_add_${categoryName}`;
        addBtn.textContent = '...';
        addBtn.style.cssText = 'padding: 5px 10px; cursor: pointer;';
        addBtn.addEventListener('click', () => showAddKeywordModal(categoryName));
        row.appendChild(addBtn);

        tabPanel.appendChild(row);
        tabContainer.appendChild(tabPanel);

        // Tab switching logic
        tabHeaderBtn.addEventListener('click', () => {
            // Deselect all tabs in this container
            tabNav.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
            tabContainer.querySelectorAll(':scope > .tabitem').forEach(p => p.style.display = 'none');
            // Select this tab
            tabHeaderBtn.classList.add('selected');
            tabPanel.style.display = 'block';
        });
    });
}

// === Button Initialization ===

async function createKeywordButtons() {
    const keywordData = await loadKeywordsFromFiles();

    for (const category in keywordData) {
        keywordData[category].forEach(keyword => {
            if (typeof keyword === 'object' && keyword.prompt) {
                knownKeywords.add(keyword.prompt);
            } else if (typeof keyword === 'string') {
                knownKeywords.add(keyword);
            }
        });
    }

    const buttons = document.querySelectorAll('[id^="keyword_"]');
    console.log(`Found ${buttons.length} existing keyword buttons`);

    buttons.forEach(button => {
        if (!button.hasAttribute('data-kw-initialized')) {
            button.addEventListener('click', function() {
                toggleKeyword(this);
            });
            button.setAttribute('data-kw-initialized', 'true');
        }
    });
}

async function initializeButtons() {
    await loadKeywordsFromFiles();

    ["txt2img", "img2img"].forEach(context => {
        const tabId = context === "img2img" ? "tab_img2img" : "tab_txt2img";
        const keywordStates = context === "img2img" ? img2imgKeywordStates : txt2imgKeywordStates;

        const buttons = document.querySelectorAll(`#${tabId} [id^="keyword_"]`);
        console.log(`Found ${buttons.length} ${context} keyword buttons`);

        buttons.forEach(button => {
            if (!button.hasAttribute('data-kw-initialized')) {
                // Toggle on click
                button.addEventListener('click', function() {
                    toggleKeyword(this);
                });

                // Context menu on right-click
                button.addEventListener('contextmenu', function(e) {
                    showContextMenu(e, this);
                });

                button.style.margin = "2px";
                button.style.cursor = "pointer";
                button.setAttribute('data-kw-initialized', 'true');

                const buttonText = button.textContent.trim();
                const promptText = buttonToPromptMap[buttonText] || buttonText;
                const category = getCategoryForButton(button);
                knownKeywords.add(promptText);

                // Restore button appearance from per-tab state
                if (category && keywordStates[category] && keywordStates[category][promptText] !== undefined) {
                    updateButtonAppearance(button, keywordStates[category][promptText], buttonText);
                }
            }
        });
    });
}

// === Setup [...] Add Buttons ===

function setupAddButtons() {
    const addButtons = document.querySelectorAll('[id^="kt_add_"]');
    addButtons.forEach(btn => {
        if (btn.hasAttribute('data-kt-add-initialized')) return;
        btn.setAttribute('data-kt-add-initialized', 'true');

        const category = btn.id.replace('kt_add_', '');
        btn.addEventListener('click', () => {
            showAddKeywordModal(category);
        });
    });
}

// === Setup New Category Button ===

function setupNewCategoryButton() {
    document.querySelectorAll('#kt_new_category').forEach(btn => {
        if (btn.hasAttribute('data-kt-newcat-initialized')) return;
        btn.setAttribute('data-kt-newcat-initialized', 'true');
        btn.addEventListener('click', () => {
            showNewCategoryModal();
        });
    });
}

// === Setup Global Dice Button + N Input ===
// The dice button is now just a visual indicator / quick toggle.
// The real control is the N input next to it: globalRandomN.
// When N > 0, the global pool is wrapped in {N$, $elem1|elem2|...}.

function setupGlobalDiceControls() {
    // N input
    document.querySelectorAll('#kt_global_random_n').forEach(input => {
        if (input.hasAttribute('data-kt-initialized')) return;
        input.setAttribute('data-kt-initialized', 'true');
        input.value = globalRandomN;
        input.addEventListener('input', () => {
            globalRandomN = parseInt(input.value) || 0;
            globalUseAll = false; // Manual N overrides useAll
            document.querySelectorAll('#kt_global_useAll').forEach(cb => cb.checked = false);
            document.querySelectorAll('#kt_global_random_n').forEach(i => {
                if (i !== input) i.value = globalRandomN;
            });
            syncGlobalDiceUI();
            updatePrompts(false);
            updatePrompts(true);
            saveConfigDebounced();
        });
    });

    // Global useAll checkbox
    document.querySelectorAll('#kt_global_useAll').forEach(cb => {
        if (cb.hasAttribute('data-kt-initialized')) return;
        cb.setAttribute('data-kt-initialized', 'true');
        cb.checked = globalUseAll;
        cb.addEventListener('change', () => {
            globalUseAll = cb.checked;
            document.querySelectorAll('#kt_global_useAll').forEach(c => c.checked = globalUseAll);
            updateAllCounts(); // This will set N=M if useAll
            syncGlobalDiceUI();
            updatePrompts(false);
            updatePrompts(true);
            saveConfigDebounced();
        });
    });

    // Dice button: click toggles N between 0 and the global pool size
    document.querySelectorAll('#kt_order_mode').forEach(btn => {
        if (btn.hasAttribute('data-kt-initialized')) return;
        btn.setAttribute('data-kt-initialized', 'true');
        if (globalRandomN > 0) btn.classList.add('random-mode');

        btn.addEventListener('click', () => {
            if (globalRandomN > 0) {
                globalRandomN = 0;
                globalUseAll = false;
            } else {
                globalRandomN = countGlobalPoolElements();
                globalUseAll = true;
            }
            document.querySelectorAll('#kt_global_random_n').forEach(i => i.value = globalRandomN);
            document.querySelectorAll('#kt_global_useAll').forEach(cb => cb.checked = globalUseAll);
            syncGlobalDiceUI();
            updatePrompts(false);
            updatePrompts(true);
            saveConfigDebounced();
        });
    });
}

function syncGlobalDiceUI() {
    document.querySelectorAll('#kt_order_mode').forEach(b => {
        if (globalRandomN > 0) b.classList.add('random-mode');
        else b.classList.remove('random-mode');
    });
}

// Helper: count how many elements would be in the global pool right now
function countGlobalPoolElements() {
    let count = 0;
    const keywordStates = txt2imgKeywordStates;
    for (const category of categoryOrder) {
        const catStates = keywordStates[category] || {};
        let activeCount = 0;
        for (const keyword in catStates) {
            if (catStates[keyword] === 1) activeCount++;
        }
        if (activeCount === 0) continue;
        const s = tabSettings[category] && tabSettings[category].pos ? tabSettings[category].pos : { bound: false };
        if (s.bound) {
            count += 1;
        } else {
            count += activeCount;
        }
    }
    return count || 1;
}

// === Setup BREAK Toggle ===

function setupBreakButton() {
    const btns = document.querySelectorAll('#kt_break_mode');
    btns.forEach(btn => {
        if (btn.hasAttribute('data-kt-initialized')) return;
        btn.setAttribute('data-kt-initialized', 'true');
        if (useBreakSeparator) btn.classList.add('break-active');

        btn.addEventListener('click', () => {
            useBreakSeparator = !useBreakSeparator;
            document.querySelectorAll('#kt_break_mode').forEach(b => {
                if (useBreakSeparator) b.classList.add('break-active');
                else b.classList.remove('break-active');
            });
            updatePrompts(false);
            updatePrompts(true);
            saveConfigDebounced();
        });
    });
}

// === Setup Per-Tab Controls (bound/free toggle, N, prefix, useAll, count) ===
// Each tab has HTML controls rendered by Python. This function wires them up.

// Wire up a single control row (positive or negative) for a category.
// polarity is "pos" or "neg". The HTML IDs use "kt_neg_" prefix for negative.
function wireTabControlRow(row, category, polarity) {
    const prefix = polarity === 'neg' ? 'neg_' : '';
    const settingsKey = polarity === 'neg' ? 'neg' : 'pos';

    // Ensure settings structure exists
    const settings = tabSettings[category];
    if (!settings[settingsKey]) {
        settings[settingsKey] = { bound: false, randomN: 0, prefix: '', useAll: false };
    }
    const s = settings[settingsKey];

    const boundBtn = row.querySelector(`#kt_${prefix}bound_${category}`);
    const boundFields = row.querySelector('.kt-bound-fields');
    const nInput = row.querySelector(`#kt_${prefix}randomN_${category}`);
    const countSpan = row.querySelector(`#kt_${prefix}count_${category}`);
    const useAllCb = row.querySelector(`#kt_${prefix}useAll_${category}`);
    const prefixInput = row.querySelector(`#kt_${prefix}prefix_${category}`);

    function updateVisibility() {
        if (boundBtn) {
            boundBtn.textContent = s.bound ? 'bound' : 'free';
            boundBtn.style.background = s.bound ? '#4a5568' : '#555';
            boundBtn.style.color = s.bound ? '#68d391' : '#aaa';
            boundBtn.style.borderColor = s.bound ? '#68d391' : '#666';
        }
        if (boundFields) boundFields.style.display = s.bound ? 'flex' : 'none';
    }

    // Initialize
    if (nInput) nInput.value = s.randomN;
    if (prefixInput) prefixInput.value = s.prefix;
    if (useAllCb) useAllCb.checked = s.useAll || false;
    updateVisibility();

    if (boundBtn) {
        boundBtn.addEventListener('click', () => {
            s.bound = !s.bound;
            updateVisibility();
            syncTabControlsForCategory(category);
            updatePrompts(false); updatePrompts(true);
            saveConfigDebounced();
        });
    }
    if (nInput) {
        nInput.addEventListener('input', () => {
            s.randomN = parseInt(nInput.value) || 0;
            s.useAll = false;
            if (useAllCb) useAllCb.checked = false;
            syncTabControlsForCategory(category);
            updatePrompts(false); updatePrompts(true);
            saveConfigDebounced();
        });
    }
    if (useAllCb) {
        useAllCb.addEventListener('change', () => {
            s.useAll = useAllCb.checked;
            syncTabControlsForCategory(category);
            updatePrompts(false); updatePrompts(true);
            saveConfigDebounced();
        });
    }
    if (prefixInput) {
        prefixInput.addEventListener('input', () => {
            s.prefix = prefixInput.value;
            syncTabControlsForCategory(category);
            updatePrompts(false); updatePrompts(true);
            saveConfigDebounced();
        });
    }
}

function setupTabControls() {
    document.querySelectorAll('.kt-tab-controls').forEach(row => {
        if (row.hasAttribute('data-kt-initialized')) return;
        row.setAttribute('data-kt-initialized', 'true');

        const category = row.dataset.category;
        const polarity = row.dataset.polarity; // "pos" or "neg"
        if (!category || !polarity) return;

        // Ensure settings exist with both pos and neg sub-objects
        if (!tabSettings[category]) {
            tabSettings[category] = {};
        }
        if (!tabSettings[category].pos) {
            // Migrate old flat settings to pos sub-object
            const old = tabSettings[category];
            tabSettings[category] = {
                pos: { bound: old.bound || false, randomN: old.randomN || 0, prefix: old.prefix || '', useAll: old.useAll || false },
                neg: { bound: false, randomN: 0, prefix: '', useAll: false }
            };
        }

        wireTabControlRow(row, category, polarity);
    });
}

// Sync per-tab control values across txt2img/img2img instances
function syncTabControlsForCategory(category) {
    const settings = tabSettings[category];
    if (!settings) return;

    document.querySelectorAll(`.kt-tab-controls[data-category="${category}"]`).forEach(row => {
        const polarity = row.dataset.polarity;
        const prefix = polarity === 'neg' ? 'neg_' : '';
        const s = settings[polarity] || {};

        const boundBtn = row.querySelector(`#kt_${prefix}bound_${category}`);
        const boundFields = row.querySelector('.kt-bound-fields');
        const nInput = row.querySelector(`#kt_${prefix}randomN_${category}`);
        const useAllCb = row.querySelector(`#kt_${prefix}useAll_${category}`);
        const prefixInput = row.querySelector(`#kt_${prefix}prefix_${category}`);

        if (boundBtn) {
            boundBtn.textContent = s.bound ? 'bound' : 'free';
            boundBtn.style.background = s.bound ? '#4a5568' : '#555';
            boundBtn.style.color = s.bound ? '#68d391' : '#aaa';
            boundBtn.style.borderColor = s.bound ? '#68d391' : '#666';
        }
        if (boundFields) boundFields.style.display = s.bound ? 'flex' : 'none';
        if (nInput) nInput.value = s.randomN;
        if (useAllCb) useAllCb.checked = s.useAll || false;
        if (prefixInput) prefixInput.value = s.prefix;
    });
}

// Update N/M counters for all tabs and global
function updateAllCounts() {
    const keywordStates = txt2imgKeywordStates;

    for (const category of categoryOrder) {
        const catStates = keywordStates[category] || {};
        let posCount = 0, negCount = 0;
        for (const kw in catStates) {
            if (catStates[kw] === 1) posCount++;
            else if (catStates[kw] === 2) negCount++;
        }

        const settings = tabSettings[category];
        if (!settings) continue;

        // Positive counts
        if (settings.pos) {
            if (settings.pos.useAll) {
                settings.pos.randomN = posCount;
                document.querySelectorAll(`#kt_randomN_${category}`).forEach(i => i.value = posCount);
            }
            document.querySelectorAll(`#kt_count_${category}`).forEach(span => {
                span.textContent = `/ ${posCount}`;
            });
        }

        // Negative counts
        if (settings.neg) {
            if (settings.neg.useAll) {
                settings.neg.randomN = negCount;
                document.querySelectorAll(`#kt_neg_randomN_${category}`).forEach(i => i.value = negCount);
            }
            document.querySelectorAll(`#kt_neg_count_${category}`).forEach(span => {
                span.textContent = `/ ${negCount}`;
            });
        }
    }

    // Global count
    const globalM = countGlobalPoolElements();
    document.querySelectorAll('#kt_global_count').forEach(span => {
        span.textContent = `/ ${globalM}`;
    });
    if (globalUseAll) {
        globalRandomN = globalM;
        document.querySelectorAll('#kt_global_random_n').forEach(i => i.value = globalM);
    }
}

// === Setup Master Toggle (ON/OFF) ===

function setupMasterToggle() {
    document.querySelectorAll('#kt_master_toggle').forEach(cb => {
        if (cb.hasAttribute('data-kt-initialized')) return;
        cb.setAttribute('data-kt-initialized', 'true');
        cb.checked = keywordToggleEnabled;

        cb.addEventListener('change', () => {
            keywordToggleEnabled = cb.checked;
            // Sync all instances
            document.querySelectorAll('#kt_master_toggle').forEach(c => c.checked = keywordToggleEnabled);
            // Update the label text next to the checkbox
            document.querySelectorAll('.kt-master-label').forEach(span => {
                span.textContent = keywordToggleEnabled ? 'ON' : 'OFF';
            });
            updatePrompts(false);
            updatePrompts(true);
            saveConfigDebounced();
        });
    });
}

// === Setup Reset All Button ===

function setupResetAll() {
    document.querySelectorAll('#kt_reset_all').forEach(btn => {
        if (btn.hasAttribute('data-kt-initialized')) return;
        btn.setAttribute('data-kt-initialized', 'true');

        btn.addEventListener('click', () => {
            // Reset all keyword states to neutral in both contexts
            for (const cat in txt2imgKeywordStates) {
                for (const kw in txt2imgKeywordStates[cat]) {
                    txt2imgKeywordStates[cat][kw] = 0;
                }
            }
            for (const cat in img2imgKeywordStates) {
                for (const kw in img2imgKeywordStates[cat]) {
                    img2imgKeywordStates[cat][kw] = 0;
                }
            }
            // Reset all button appearances
            document.querySelectorAll('[id^="keyword_"]').forEach(b => {
                const buttonText = b.textContent.trim().replace(/^[+\-] /, '');
                updateButtonAppearance(b, 0, buttonText);
            });
            updatePrompts(false);
            updatePrompts(true);
        });
    });
}

// === Setup Per-Tab On/Off Toggle ===
// Each tab has a checkbox to enable/disable its keywords in the prompt.

let tabEnabled = {}; // category -> bool (default true)

function setupTabEnabled() {
    document.querySelectorAll('[id^="kt_tab_enabled_"]').forEach(cb => {
        if (cb.hasAttribute('data-kt-initialized')) return;
        cb.setAttribute('data-kt-initialized', 'true');

        const category = cb.id.replace('kt_tab_enabled_', '');
        if (tabEnabled[category] === undefined) tabEnabled[category] = true;
        cb.checked = tabEnabled[category];

        cb.addEventListener('change', () => {
            tabEnabled[category] = cb.checked;
            // Sync all instances
            document.querySelectorAll(`#kt_tab_enabled_${category}`).forEach(c => c.checked = tabEnabled[category]);
            updatePrompts(false);
            updatePrompts(true);
        });
    });
}

// === Setup Per-Tab "Toggle All" Button ===
// Cycles: all neutral → all positive → all negative → all neutral

function setupTabToggleAll() {
    document.querySelectorAll('[id^="kt_tab_toggle_all_"]').forEach(btn => {
        if (btn.hasAttribute('data-kt-initialized')) return;
        btn.setAttribute('data-kt-initialized', 'true');

        const category = btn.id.replace('kt_tab_toggle_all_', '');

        btn.addEventListener('click', () => {
            // Determine current dominant state for this tab
            const contexts = [
                { states: txt2imgKeywordStates, selector: '#tab_txt2img' },
                { states: img2imgKeywordStates, selector: '#tab_img2img' }
            ];

            // Use first context to determine current state
            const catStates = txt2imgKeywordStates[category] || {};
            const values = Object.values(catStates);
            const allPositive = values.length > 0 && values.every(v => v === 1);
            const allNegative = values.length > 0 && values.every(v => v === 2);

            let newState;
            if (allPositive) newState = 2;       // all positive → all negative
            else if (allNegative) newState = 0;  // all negative → all neutral
            else newState = 1;                    // mixed/neutral → all positive

            // Apply to both contexts
            contexts.forEach(({ states, selector }) => {
                if (!states[category]) states[category] = {};
                // Get all keywords for this category from buttonToPromptMap
                const buttons = document.querySelectorAll(`${selector} [id^="keyword_"]`);
                buttons.forEach(b => {
                    const bCategory = getCategoryForButton(b);
                    if (bCategory !== category) return;
                    const buttonText = b.textContent.trim().replace(/^[+\-] /, '');
                    const promptText = buttonToPromptMap[buttonText] || buttonText;
                    states[category][promptText] = newState;
                    updateButtonAppearance(b, newState, buttonText);
                });
            });

            updatePrompts(false);
            updatePrompts(true);
        });
    });
}

// === Initialization ===

document.addEventListener('DOMContentLoaded', async function() {
    addGlobalStyles();
    await loadConfig();
    await initializeButtons();
});

window.addEventListener('load', async function() {
    addGlobalStyles();
    await loadConfig();
    await initializeButtons();
});

setInterval(async function() {
    await initializeButtons();
    setupMasterToggle();
    setupGlobalDiceControls();
    setupBreakButton();
    setupResetAll();
    setupTabControls();
    setupTabEnabled();
    setupTabToggleAll();
    setupAddButtons();
    setupNewCategoryButton();
}, 2000);

console.log("SD Keyword Toggle NEW script loaded");
