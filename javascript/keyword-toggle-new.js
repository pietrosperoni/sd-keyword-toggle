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

// Convert category name to safe HTML ID (must match Python's _safe_id)
function safeId(name) {
    return name.replace(/ /g, '_').replace(/'/g, '').replace(/"/g, '');
}

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

    // State is keyed by buttonText (unique), not promptText
    if (!keywordStates[category]) keywordStates[category] = {};
    if (keywordStates[category][buttonText] === undefined) {
        keywordStates[category][buttonText] = 0;
    }

    keywordStates[category][buttonText] = (keywordStates[category][buttonText] + 1) % 3;
    const newState = keywordStates[category][buttonText];

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

        /* Tab drag & drop reorder mode */
        .kt-reorder-active button {
            border: 1px dashed #60a5fa !important;
            cursor: grab !important;
        }
        .kt-dragging {
            opacity: 0.4 !important;
        }
        .kt-drag-over {
            border-bottom: 3px solid #60a5fa !important;
            background: rgba(96, 165, 250, 0.15) !important;
        }

        /* Copy-to dropdown */
        .kt-copy-dropdown {
            position: absolute;
            z-index: 10001;
            background: #1a1a2e;
            border: 1px solid #444;
            border-radius: 6px;
            padding: 4px 0;
            min-width: 140px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }
        .kt-copy-dropdown-item {
            padding: 6px 14px;
            cursor: pointer;
            color: #eee;
            font-size: 12px;
        }
        .kt-copy-dropdown-item:hover {
            background: #2a2a3e;
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

    // Iterate per-category nested state: keywordStates[category][buttonText] = state
    // Resolve buttonText → promptText via buttonToPromptMap for the actual prompt
    for (const category in keywordStates) {
        const catStates = keywordStates[category];
        for (const btnText in catStates) {
            const state = catStates[btnText];
            const promptText = buttonToPromptMap[btnText] || btnText;
            if (state === 1) {
                if (!posByCategory[category]) posByCategory[category] = [];
                posByCategory[category].push(promptText);
            } else if (state === 2) {
                if (!negByCategory[category]) negByCategory[category] = [];
                negByCategory[category].push(promptText);
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
            keywordToggleEnabled = config.keywordToggleEnabled !== false;
            if (config.tabOrder) categoryOrder = config.tabOrder;
            if (config.hiddenTabs) hiddenTabs = config.hiddenTabs;
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
                tabOrder: categoryOrder,
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
    // Traverse up to find a .kt-tab-controls element with data-category
    let container = button.parentElement;
    while (container) {
        const ctrl = container.querySelector('.kt-tab-controls[data-category]');
        if (ctrl) return ctrl.dataset.category;
        // Also check if the container itself is a tab-controls
        if (container.classList && container.classList.contains('kt-tab-controls') && container.dataset.category) {
            return container.dataset.category;
        }
        container = container.parentElement;
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

                // Remove from per-tab keyword states (keyed by buttonText)
                if (txt2imgKeywordStates[category]) delete txt2imgKeywordStates[category][currentButtonText];
                if (img2imgKeywordStates[category]) delete img2imgKeywordStates[category][currentButtonText];

                // Remove button from DOM only in this category
                removeButtonFromDOM(currentButtonText, category);

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

                // Transfer per-tab state from old buttonText to new buttonText
                if (txt2imgKeywordStates[category] && txt2imgKeywordStates[category][currentButtonText] !== undefined) {
                    txt2imgKeywordStates[category][buttonText] = txt2imgKeywordStates[category][currentButtonText];
                    delete txt2imgKeywordStates[category][currentButtonText];
                }
                if (img2imgKeywordStates[category] && img2imgKeywordStates[category][currentButtonText] !== undefined) {
                    img2imgKeywordStates[category][buttonText] = img2imgKeywordStates[category][currentButtonText];
                    delete img2imgKeywordStates[category][currentButtonText];
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
                if (txt2imgKeywordStates[category]) delete txt2imgKeywordStates[category][buttonText];
                if (img2imgKeywordStates[category]) delete img2imgKeywordStates[category][buttonText];
                removeButtonFromDOM(buttonText, category);
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
    const addButtons = document.querySelectorAll(`[id="kt_add_${safeId(category)}"]`);

    addButtons.forEach(addBtn => {
        // Walk up from the [...] button to find the Gradio Row that contains keyword buttons
        let row = addBtn.parentElement;
        while (row && !row.querySelector('[id^="keyword_"]')) {
            row = row.parentElement;
            // Stop before going too far up
            if (row && row.classList && row.classList.contains('tabitem')) break;
        }
        if (!row) return;

        // Find an existing keyword button to copy its Gradio classes for consistent sizing
        const existingKwBtn = row.querySelector('[id^="keyword_"]');

        // Create new button
        const newBtn = document.createElement('button');
        newBtn.id = `keyword_${buttonText.replace(/ /g, '_')}`;
        newBtn.textContent = buttonText;

        if (existingKwBtn) {
            // Copy Gradio classes for matching size/layout
            newBtn.className = existingKwBtn.className;
            // Remove any state classes from the copied button
            newBtn.classList.remove('primary');
        }

        // Apply neutral style on top
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

        newBtn.addEventListener('click', function() {
            toggleKeyword(this);
        });
        newBtn.addEventListener('contextmenu', function(e) {
            showContextMenu(e, this);
        });

        // Insert the new button. Try to put it before the [...] button's wrapper.
        // Find the [...] button's ancestor that is a direct child of the row.
        let insertTarget = addBtn;
        while (insertTarget.parentElement && insertTarget.parentElement !== row) {
            insertTarget = insertTarget.parentElement;
        }
        if (insertTarget.parentElement === row) {
            row.insertBefore(newBtn, insertTarget);
        } else if (existingKwBtn) {
            // Insert after the last keyword button
            existingKwBtn.parentElement.appendChild(newBtn);
        } else {
            row.appendChild(newBtn);
        }
    });
}

function removeButtonFromDOM(buttonText, category) {
    const elemId = `keyword_${buttonText.replace(/ /g, '_')}`;
    document.querySelectorAll(`[id="${elemId}"]`).forEach(btn => {
        if (category) {
            const btnCategory = getCategoryForButton(btn);
            if (btnCategory !== category) return;
        }
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

                // Restore button appearance from per-tab state (keyed by buttonText)
                if (category && keywordStates[category] && keywordStates[category][buttonText] !== undefined) {
                    updateButtonAppearance(button, keywordStates[category][buttonText], buttonText);
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

        const category = getCategoryForButton(btn);
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

    const sid = safeId(category);
    const boundBtn = row.querySelector(`#kt_${prefix}bound_${sid}`);
    const boundFields = row.querySelector('.kt-bound-fields');
    const nInput = row.querySelector(`#kt_${prefix}randomN_${sid}`);
    const countSpan = row.querySelector(`#kt_${prefix}count_${sid}`);
    const useAllCb = row.querySelector(`#kt_${prefix}useAll_${sid}`);
    const prefixInput = row.querySelector(`#kt_${prefix}prefix_${sid}`);

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

        const sid = safeId(category);
        const boundBtn = row.querySelector(`#kt_${prefix}bound_${sid}`);
        const boundFields = row.querySelector('.kt-bound-fields');
        const nInput = row.querySelector(`#kt_${prefix}randomN_${sid}`);
        const useAllCb = row.querySelector(`#kt_${prefix}useAll_${sid}`);
        const prefixInput = row.querySelector(`#kt_${prefix}prefix_${sid}`);

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

        const sid = safeId(category);

        // Positive counts
        if (settings.pos) {
            if (settings.pos.useAll) {
                settings.pos.randomN = posCount;
                document.querySelectorAll(`#kt_randomN_${sid}`).forEach(i => i.value = posCount);
            }
            document.querySelectorAll(`#kt_count_${sid}`).forEach(span => {
                span.textContent = `/ ${posCount}`;
            });
        }

        // Negative counts
        if (settings.neg) {
            if (settings.neg.useAll) {
                settings.neg.randomN = negCount;
                document.querySelectorAll(`#kt_neg_randomN_${sid}`).forEach(i => i.value = negCount);
            }
            document.querySelectorAll(`#kt_neg_count_${sid}`).forEach(span => {
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

        const ctrl = cb.closest('.kt-tab-controls');
        const category = ctrl ? ctrl.dataset.category : cb.id.replace('kt_tab_enabled_', '');
        if (tabEnabled[category] === undefined) tabEnabled[category] = true;
        cb.checked = tabEnabled[category];

        cb.addEventListener('change', () => {
            tabEnabled[category] = cb.checked;
            // Sync all instances
            document.querySelectorAll(`#kt_tab_enabled_${safeId(category)}`).forEach(c => c.checked = tabEnabled[category]);
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

        const ctrl = btn.closest('.kt-tab-controls');
        const category = ctrl ? ctrl.dataset.category : btn.id.replace('kt_tab_toggle_all_', '');

        btn.addEventListener('click', () => {
            // Determine current dominant state for this tab
            const contexts = [
                { states: txt2imgKeywordStates, selector: '#tab_txt2img' },
                { states: img2imgKeywordStates, selector: '#tab_img2img' }
            ];

            // Use first context to determine current state
            // Note: buttons that were never clicked have no state entry, treat as neutral (0)
            const catStates = txt2imgKeywordStates[category] || {};
            const values = Object.values(catStates);
            const allPositive = values.length > 0 && values.every(v => v === 1);
            const allNegative = values.length > 0 && values.every(v => v === 2);
            const allNeutral = values.length === 0 || values.every(v => v === 0 || v === undefined);

            // Cycle: neutral → positive → negative → neutral
            let newState;
            if (allNeutral) newState = 1;
            else if (allPositive) newState = 2;
            else if (allNegative) newState = 0;
            else newState = 1; // mixed → all positive

            // Apply to both contexts
            contexts.forEach(({ states, selector }) => {
                if (!states[category]) states[category] = {};
                // Get all keywords for this category from buttonToPromptMap
                const buttons = document.querySelectorAll(`${selector} [id^="keyword_"]`);
                buttons.forEach(b => {
                    const bCategory = getCategoryForButton(b);
                    if (bCategory !== category) return;
                    const buttonText = b.textContent.trim().replace(/^[+\-] /, '');
                    states[category][buttonText] = newState;
                    updateButtonAppearance(b, newState, buttonText);
                });
            });

            updatePrompts(false);
            updatePrompts(true);
        });
    });
}

// === Copy Active Buttons to Another Tab ===
// Click 📋 → dropdown of tabs → copies all positive (green) buttons from this tab to chosen tab.
// Uses the existing keyword selection (state=1) as the "selection" — no separate select mode needed.

function setupCopyActive() {
    document.querySelectorAll('[id^="kt_copy_active_"]').forEach(btn => {
        if (btn.hasAttribute('data-kt-initialized')) return;
        btn.setAttribute('data-kt-initialized', 'true');

        const ctrl = btn.closest('.kt-tab-controls');
        const category = ctrl ? ctrl.dataset.category : btn.id.replace('kt_copy_active_', '');

        btn.addEventListener('click', () => {
            // Close any existing dropdown
            document.querySelectorAll('.kt-copy-dropdown').forEach(d => d.remove());

            const dropdown = document.createElement('div');
            dropdown.className = 'kt-copy-dropdown';

            for (const cat of categoryOrder) {
                if (cat === category) continue;
                const item = document.createElement('div');
                item.className = 'kt-copy-dropdown-item';
                item.textContent = cat;
                item.addEventListener('click', async () => {
                    dropdown.remove();
                    const isImg2img = btn.closest('#tab_img2img') !== null;
                    await copyActiveToCategory(category, cat, isImg2img);
                });
                dropdown.appendChild(item);
            }

            // Position below the button
            const rect = btn.getBoundingClientRect();
            dropdown.style.position = 'fixed';
            dropdown.style.left = rect.left + 'px';
            dropdown.style.top = (rect.bottom + 4) + 'px';
            document.body.appendChild(dropdown);

            // Close on click outside
            setTimeout(() => {
                document.addEventListener('click', function onClickAway(e) {
                    if (!dropdown.contains(e.target) && e.target !== btn) {
                        dropdown.remove();
                        document.removeEventListener('click', onClickAway);
                    }
                });
            }, 0);
        });
    });
}

// Find a unique button name for the destination tab.
// If "Michelangelo" exists, returns "Michelangelo(2)", then "Michelangelo(3)", etc.
function getUniqueButtonName(buttonText, destCategory) {
    // Collect existing button names in destination tab
    const existing = new Set();
    document.querySelectorAll(`[id^="kt_add_${safeId(destCategory)}"]`).forEach(addBtn => {
        const container = addBtn.closest('.row, .flex, [class*="row"]') || addBtn.parentElement;
        if (!container) return;
        container.querySelectorAll('[id^="keyword_"]').forEach(btn => {
            existing.add(btn.textContent.trim().replace(/^[+\-] /, ''));
        });
    });

    if (!existing.has(buttonText)) return buttonText;

    let n = 2;
    while (existing.has(`${buttonText}(${n})`)) n++;
    return `${buttonText}(${n})`;
}

async function copyActiveToCategory(sourceCategory, destCategory, isImg2img) {
    // Find all positive keywords in source tab
    const keywordStates = isImg2img ? img2imgKeywordStates : txt2imgKeywordStates;
    const catStates = keywordStates[sourceCategory] || {};
    let copied = 0;

    for (const srcButtonText in catStates) {
        if (catStates[srcButtonText] !== 1) continue; // Only positive (green)

        const promptText = buttonToPromptMap[srcButtonText] || srcButtonText;

        // Get unique name for destination (adds (2), (3) etc. if needed)
        const buttonText = getUniqueButtonName(srcButtonText, destCategory);

        try {
            const response = await apiAddKeyword(destCategory, buttonText, promptText);
            if (response.success) {
                buttonToPromptMap[buttonText] = promptText;
                try {
                    addButtonToDOM(destCategory, buttonText, promptText);
                } catch (domErr) {
                    console.warn(`Button saved but DOM insert failed for "${buttonText}":`, domErr);
                }
                copied++;
            }
        } catch (e) {
            console.error(`Error copying "${buttonText}":`, e);
        }
    }
    if (copied > 0) {
        console.log(`Copied ${copied} buttons from "${sourceCategory}" to "${destCategory}". Reload to see them.`);
    } else {
        alert('No active (green) buttons to copy in this tab.');
    }
}

// === Delete Active Buttons from Tab ===

function setupDeleteActive() {
    document.querySelectorAll('[id^="kt_delete_active_"]').forEach(btn => {
        if (btn.hasAttribute('data-kt-initialized')) return;
        btn.setAttribute('data-kt-initialized', 'true');

        const ctrl = btn.closest('.kt-tab-controls');
        const category = ctrl ? ctrl.dataset.category : btn.id.replace('kt_delete_active_', '');

        btn.addEventListener('click', async () => {
            // Collect active (green) keywords in this tab
            const isImg2img = btn.closest('#tab_img2img') !== null;
            const keywordStates = isImg2img ? img2imgKeywordStates : txt2imgKeywordStates;
            const catStates = keywordStates[category] || {};
            const activeKeywords = [];
            for (const buttonText in catStates) {
                if (catStates[buttonText] === 1) {
                    const promptText = buttonToPromptMap[buttonText] || buttonText;
                    activeKeywords.push({ buttonText, promptText });
                }
            }

            if (activeKeywords.length === 0) {
                alert('No active (green) buttons to delete in this tab.');
                return;
            }

            const names = activeKeywords.map(k => k.buttonText).join(', ');
            if (!confirm(`Delete ${activeKeywords.length} button(s) from "${category}" permanently?\n\n${names}`)) {
                return;
            }

            for (const { buttonText, promptText } of activeKeywords) {
                try {
                    const response = await apiDeleteKeyword(category, buttonText);
                    if (response.success) {
                        knownKeywords.delete(promptText);
                        delete buttonToPromptMap[buttonText];
                        if (txt2imgKeywordStates[category]) delete txt2imgKeywordStates[category][buttonText];
                        if (img2imgKeywordStates[category]) delete img2imgKeywordStates[category][buttonText];
                        removeButtonFromDOM(buttonText, category);
                    }
                } catch (e) {
                    console.error(`Error deleting "${buttonText}":`, e);
                }
            }
            updatePrompts(false);
            updatePrompts(true);
        });
    });
}

// === Tab Context Menu (right-click on tab headers) ===
// Provides: Rename, Move left/right, Hide, Move to Trash

function setupTabContextMenu() {
    // Strategy: find .kt-tab-controls elements (which have data-category),
    // then walk up to find the parent tab container, then find its tab-nav buttons.
    // This avoids depending on Gradio's accordion class names.

    document.querySelectorAll('.kt-tab-controls[data-category][data-polarity="pos"]').forEach(ctrl => {
        const category = ctrl.dataset.category;

        // Walk up to find the .tabs container
        let tabContainer = ctrl.closest('.tabs');
        if (!tabContainer) return;

        const tabNav = tabContainer.querySelector('.tab-nav');
        if (!tabNav) return;

        // Find the tab-nav button matching this category name
        tabNav.querySelectorAll('button').forEach(tabBtn => {
            if (tabBtn.textContent.trim() !== category) return;
            if (tabBtn.hasAttribute('data-kt-tab-ctx')) return;
            tabBtn.setAttribute('data-kt-tab-ctx', 'true');

            tabBtn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showTabContextMenu(e, category);
            });
        });
    });
}

function showTabContextMenu(e, category) {
    hideContextMenu(); // Reuse existing context menu cleanup

    const menu = document.createElement('div');
    menu.className = 'kt-context-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';

    const items = [
        { text: 'Rename', action: () => renameTab(category) },
        { text: 'Hide', action: () => hideTab(category) },
        { text: 'Move to Trash', action: () => trashTab(category), danger: true }
    ];

    items.forEach(({ text, action, danger }) => {
        const item = document.createElement('div');
        item.className = 'kt-context-item' + (danger ? ' danger' : '');
        item.textContent = text;
        item.addEventListener('click', () => {
            menu.remove();
            action();
        });
        menu.appendChild(item);
    });

    document.body.appendChild(menu);
    activeContextMenu = menu;

    // Adjust position if off-screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 5) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 5) + 'px';

    setTimeout(() => {
        document.addEventListener('click', function onClickAway() {
            if (activeContextMenu === menu) { menu.remove(); activeContextMenu = null; }
            document.removeEventListener('click', onClickAway);
        }, {once: true});
    }, 0);
}

async function renameTab(category) {
    const newName = prompt(`Rename tab "${category}" to:`, category);
    if (!newName || newName.trim() === '' || newName.trim() === category) return;

    try {
        const response = await fetch('/sd-keyword-toggle/rename-category', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ old_name: category, new_name: newName.trim() })
        });
        const data = await response.json();
        if (data.success) {
            const nn = data.new_name;
            // Migrate tabSettings, categoryOrder, promptToCategoryMap, keyword states
            const idx = categoryOrder.indexOf(category);
            if (idx >= 0) categoryOrder[idx] = nn;
            if (tabSettings[category]) { tabSettings[nn] = tabSettings[category]; delete tabSettings[category]; }
            if (txt2imgKeywordStates[category]) { txt2imgKeywordStates[nn] = txt2imgKeywordStates[category]; delete txt2imgKeywordStates[category]; }
            if (img2imgKeywordStates[category]) { img2imgKeywordStates[nn] = img2imgKeywordStates[category]; delete img2imgKeywordStates[category]; }
            for (const pt in promptToCategoryMap) {
                if (promptToCategoryMap[pt] === category) promptToCategoryMap[pt] = nn;
            }

            // Update tab header text in DOM
            findTabNavButtons(category).forEach(btn => btn.textContent = nn);
            // Update data-category attributes
            document.querySelectorAll(`.kt-tab-controls[data-category="${category}"]`).forEach(el => {
                el.dataset.category = nn;
            });

            saveConfigDebounced();
        } else {
            alert("Error: " + (data.error || "Failed to rename"));
        }
    } catch (e) {
        alert("Error: " + e.message);
    }
}

// Find Gradio tab-nav buttons matching a category name
function findTabNavButtons(category) {
    const results = [];
    document.querySelectorAll('.tab-nav button').forEach(btn => {
        if (btn.textContent.trim() === category) results.push(btn);
    });
    return results;
}

// Find the tab panel (tabitem) for a category by looking at the tab-nav button index
function findTabPanel(category, tabNav) {
    const buttons = Array.from(tabNav.querySelectorAll('button'));
    const idx = buttons.findIndex(b => b.textContent.trim() === category);
    if (idx < 0) return null;
    const tabContainer = tabNav.parentElement;
    const panels = tabContainer.querySelectorAll(':scope > .tabitem');
    return panels[idx] || null;
}

function hideTab(category) {
    if (!confirm(`Hide tab "${category}"? You can show it again from the 👁 button.`)) return;

    // Hide in DOM immediately (both tab header and panel)
    document.querySelectorAll('.tab-nav').forEach(tabNav => {
        const btn = Array.from(tabNav.querySelectorAll('button')).find(b => b.textContent.trim() === category);
        if (!btn) return;
        const panel = findTabPanel(category, tabNav);
        btn.style.display = 'none';
        if (panel) panel.style.display = 'none';
    });

    // Save to config
    if (!hiddenTabs) hiddenTabs = [];
    if (!hiddenTabs.includes(category)) hiddenTabs.push(category);
    saveConfigWithHidden();
}

let hiddenTabs = [];

async function saveConfigWithHidden() {
    // Load current config, update hiddenTabs, save
    try {
        const config = await fetch('/sd-keyword-toggle/get-config').then(r => r.json());
        config.hiddenTabs = hiddenTabs;
        config.tabOrder = categoryOrder;
        await fetch('/sd-keyword-toggle/save-config', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(config)
        });
    } catch (e) {
        console.error("Error saving config with hidden tabs:", e);
    }
}

async function trashTab(category) {
    if (!confirm(`Move tab "${category}" to Trash?\n\nThe file will be moved to keywords/Trash/ and can be restored manually.`)) return;

    try {
        const response = await fetch('/sd-keyword-toggle/delete-category', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ category })
        });
        const data = await response.json();
        if (data.success) {
            // Remove tab from DOM immediately
            document.querySelectorAll('.tab-nav').forEach(tabNav => {
                const btn = Array.from(tabNav.querySelectorAll('button')).find(b => b.textContent.trim() === category);
                if (!btn) return;
                const panel = findTabPanel(category, tabNav);
                btn.remove();
                if (panel) panel.remove();
            });

            // Remove from data structures
            const idx = categoryOrder.indexOf(category);
            if (idx >= 0) categoryOrder.splice(idx, 1);
            delete tabSettings[category];
            delete txt2imgKeywordStates[category];
            delete img2imgKeywordStates[category];

            saveConfigDebounced();
            updatePrompts(false);
            updatePrompts(true);
        } else {
            alert("Error: " + (data.error || "Failed to trash"));
        }
    } catch (e) {
        alert("Error: " + e.message);
    }
}

// === Tab Drag & Drop Reordering ===
// Makes tab header buttons draggable. Drop position determines new order.
// Saves order to config without reload.

// === Tab Reorder Mode ===
// A toggle button activates reorder mode. In this mode:
// - Tab buttons become draggable
// - Clicking a tab does NOT switch to it (Gradio events blocked)
// - Drop reorders tabs and panels in the DOM
// Click the toggle again to exit and save.

let reorderModeActive = false;
let reorderClickBlockers = []; // Store references to blocking listeners

function setupReorderButton() {
    document.querySelectorAll('#kt_reorder_tabs').forEach(btn => {
        if (btn.hasAttribute('data-kt-initialized')) return;
        btn.setAttribute('data-kt-initialized', 'true');

        btn.addEventListener('click', () => {
            if (reorderModeActive) {
                exitReorderMode();
            } else {
                enterReorderMode();
            }
        });
    });
}

function enterReorderMode() {
    reorderModeActive = true;

    // Style the button
    document.querySelectorAll('#kt_reorder_tabs').forEach(btn => {
        btn.style.borderColor = '#60a5fa';
        btn.style.color = '#60a5fa';
    });

    // Find all KT tab-navs and make buttons draggable
    document.querySelectorAll('.tab-nav').forEach(tabNav => {
        const tabContainer = tabNav.parentElement;
        if (!tabContainer || !tabContainer.querySelector('.kt-tab-controls')) return;

        tabNav.classList.add('kt-reorder-active');

        tabNav.querySelectorAll('button').forEach(btn => {
            btn.draggable = true;
            btn.style.cursor = 'grab';

            // Block Gradio's click handler by capturing the event
            const blocker = (e) => {
                if (reorderModeActive) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                }
            };
            btn.addEventListener('click', blocker, true); // capture phase
            reorderClickBlockers.push({ btn, blocker });

            btn.addEventListener('dragstart', tabDragStart);
            btn.addEventListener('dragend', tabDragEnd);
            btn.addEventListener('dragover', tabDragOver);
            btn.addEventListener('dragleave', tabDragLeave);
            btn.addEventListener('drop', tabDrop);
        });
    });
}

function exitReorderMode() {
    reorderModeActive = false;

    // Remove style from button
    document.querySelectorAll('#kt_reorder_tabs').forEach(btn => {
        btn.style.borderColor = '';
        btn.style.color = '';
    });

    // Remove drag handlers and click blockers
    document.querySelectorAll('.tab-nav.kt-reorder-active').forEach(tabNav => {
        tabNav.classList.remove('kt-reorder-active');
        tabNav.querySelectorAll('button').forEach(btn => {
            btn.draggable = false;
            btn.style.cursor = '';
            btn.removeEventListener('dragstart', tabDragStart);
            btn.removeEventListener('dragend', tabDragEnd);
            btn.removeEventListener('dragover', tabDragOver);
            btn.removeEventListener('dragleave', tabDragLeave);
            btn.removeEventListener('drop', tabDrop);
        });
    });

    reorderClickBlockers.forEach(({ btn, blocker }) => {
        btn.removeEventListener('click', blocker, true);
    });
    reorderClickBlockers = [];

    // Save the new order
    saveConfigDebounced();
}

function tabDragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.textContent.trim());
    e.target.classList.add('kt-dragging');
}

function tabDragEnd(e) {
    e.target.classList.remove('kt-dragging');
}

function tabDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('kt-drag-over');
}

function tabDragLeave(e) {
    e.currentTarget.classList.remove('kt-drag-over');
}

function tabDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('kt-drag-over');
    const draggedName = e.dataTransfer.getData('text/plain');
    const targetName = e.currentTarget.textContent.trim();
    if (draggedName === targetName) return;

    const tabNav = e.currentTarget.parentElement;
    reorderTabsInDOM(tabNav, draggedName, targetName);
}

function reorderTabsInDOM(tabNav, draggedName, targetName) {
    const tabContainer = tabNav.parentElement;
    const buttons = Array.from(tabNav.querySelectorAll('button'));
    const panels = Array.from(tabContainer.querySelectorAll(':scope > .tabitem'));

    const dragIdx = buttons.findIndex(b => b.textContent.trim() === draggedName);
    const targetIdx = buttons.findIndex(b => b.textContent.trim() === targetName);
    if (dragIdx < 0 || targetIdx < 0) return;

    const dragBtn = buttons[dragIdx];
    const targetBtn = buttons[targetIdx];
    if (dragIdx < targetIdx) {
        tabNav.insertBefore(dragBtn, targetBtn.nextSibling);
    } else {
        tabNav.insertBefore(dragBtn, targetBtn);
    }

    if (panels[dragIdx] && panels[targetIdx]) {
        const dragPanel = panels[dragIdx];
        const targetPanel = panels[targetIdx];
        if (dragIdx < targetIdx) {
            tabContainer.insertBefore(dragPanel, targetPanel.nextSibling);
        } else {
            tabContainer.insertBefore(dragPanel, targetPanel);
        }
    }

    // Update categoryOrder
    const newButtons = Array.from(tabNav.querySelectorAll('button'));
    categoryOrder = newButtons.map(b => b.textContent.trim()).filter(n => n);
}

// === Show Hidden Tabs ===

function setupShowHidden() {
    document.querySelectorAll('#kt_show_hidden').forEach(btn => {
        if (btn.hasAttribute('data-kt-initialized')) return;
        btn.setAttribute('data-kt-initialized', 'true');

        btn.addEventListener('click', async () => {
            try {
                const response = await fetch('/sd-keyword-toggle/get-all-categories');
                const data = await response.json();
                if (!data.hiddenTabs || data.hiddenTabs.length === 0) {
                    alert('No hidden tabs.');
                    return;
                }

                const result = await ktShowModal(
                    'Hidden tabs',
                    data.hiddenTabs.map(cat => ({
                        key: cat, label: cat, value: '', placeholder: 'Click Show to unhide'
                    })),
                    [
                        {text: 'Cancel', action: 'cancel', className: 'kt-modal-btn-cancel'},
                        {text: 'Show all', action: 'ok', className: 'kt-modal-btn-ok'}
                    ]
                );

                if (result && result.action === 'ok') {
                    // Unhide all — requires reload since hidden tabs weren't rendered
                    hiddenTabs = [];
                    await saveConfigWithHidden();
                    alert('Hidden tabs will appear after restart/reload of the WebUI.');
                }
            } catch (e) {
                alert("Error: " + e.message);
            }
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
    setupCopyActive();
    setupDeleteActive();
    setupTabContextMenu();
    setupReorderButton();
    setupShowHidden();
    setupAddButtons();
    setupNewCategoryButton();
}, 2000);

console.log("SD Keyword Toggle NEW script loaded");
