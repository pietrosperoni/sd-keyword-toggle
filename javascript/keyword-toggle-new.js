// === State Variables ===

// Separate keyword states for txt2img and img2img - track by keyword TEXT not ID
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
let orderMode = 'stable'; // 'stable' or 'random'

// === Core Functions ===

function toggleKeyword(button) {
    const tabId = button.closest('#tab_img2img') ? "img2img" : "txt2img";
    const isImg2img = tabId === "img2img";
    const keywordStates = isImg2img ? img2imgKeywordStates : txt2imgKeywordStates;

    const buttonText = button.textContent.trim().replace(/^[+\-] /, '');
    const promptText = buttonToPromptMap[buttonText] || buttonText;
    const keyword = promptText;

    if (keywordStates[keyword] === undefined) {
        keywordStates[keyword] = 0;
    }

    keywordStates[keyword] = (keywordStates[keyword] + 1) % 3;

    const contextSelector = isImg2img ? '#tab_img2img' : '#tab_txt2img';
    const allMatchingButtons = document.querySelectorAll(`${contextSelector} [id^="keyword_"]`);

    allMatchingButtons.forEach(btn => {
        const btnKeyword = btn.textContent.trim().replace(/^[+\-] /, '');
        if (btnKeyword === buttonText) {
            updateButtonAppearance(btn, keywordStates[keyword], buttonText);
        }
    });

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

        /* Style for the order mode button */
        #kt_order_mode {
            transition: color 0.2s ease-in-out, border-color 0.2s ease-in-out !important;
        }
        #kt_order_mode.random-mode {
            border-color: #34d399 !important;
            color: #34d399 !important;
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

    let posKeywords = [];
    let negKeywords = [];

    for (const keyword in keywordStates) {
        const state = keywordStates[keyword];
        if (state === 1) posKeywords.push(keyword);
        else if (state === 2) negKeywords.push(keyword);
    }

    // Add positive keywords
    if (posKeywords.length > 0) {
        if (orderMode === 'random' && posKeywords.length > 1) {
            // Dynamic Prompts with explicit ", " separator: {N$$, $$item1|item2|...}
            const randomString = `{${posKeywords.length}$$, $$${posKeywords.join('|')}}`;
            if (newPositiveText && newPositiveText.length > 0 &&
                !newPositiveText.endsWith(' ') && !newPositiveText.endsWith(',')) {
                newPositiveText += ', ';
            }
            newPositiveText += randomString;
        } else {
            if (newPositiveText && newPositiveText.length > 0 &&
                !newPositiveText.endsWith(' ') && !newPositiveText.endsWith(',')) {
                newPositiveText += ', ';
            }
            newPositiveText += posKeywords.join(', ');
        }
    }

    // Add negative keywords
    if (negKeywords.length > 0) {
        if (orderMode === 'random' && negKeywords.length > 1) {
            const randomString = `{${negKeywords.length}$$, $$${negKeywords.join('|')}}`;
            if (newNegativeText && newNegativeText.length > 0 &&
                !newNegativeText.endsWith(' ') && !newNegativeText.endsWith(',')) {
                newNegativeText += ', ';
            }
            newNegativeText += randomString;
        } else {
            if (newNegativeText && newNegativeText.length > 0 &&
                !newNegativeText.endsWith(' ') && !newNegativeText.endsWith(',')) {
                newNegativeText += ', ';
            }
            newNegativeText += negKeywords.join(', ');
        }
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
}

// === API Functions ===

async function loadKeywordsFromFiles() {
    knownKeywords = new Set();
    buttonToPromptMap = {};

    try {
        const response = await fetch('/sd-keyword-toggle/get-keywords');

        if (response.ok) {
            const data = await response.json();
            console.log("Successfully loaded keywords from server:", data);

            const keywordData = data.keywords;
            for (const category in keywordData) {
                keywordData[category].forEach(keywordObj => {
                    if (typeof keywordObj === 'object' && keywordObj.prompt && keywordObj.button) {
                        knownKeywords.add(keywordObj.prompt);
                        buttonToPromptMap[keywordObj.button] = keywordObj.prompt;
                    } else if (typeof keywordObj === 'string') {
                        knownKeywords.add(keywordObj);
                        buttonToPromptMap[keywordObj] = keywordObj;
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

                // Remove from keyword states
                delete txt2imgKeywordStates[currentPromptText];
                delete img2imgKeywordStates[currentPromptText];

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

                // Transfer state from old prompt to new prompt
                if (txt2imgKeywordStates[currentPromptText] !== undefined) {
                    txt2imgKeywordStates[promptText] = txt2imgKeywordStates[currentPromptText];
                    delete txt2imgKeywordStates[currentPromptText];
                }
                if (img2imgKeywordStates[currentPromptText] !== undefined) {
                    img2imgKeywordStates[promptText] = img2imgKeywordStates[currentPromptText];
                    delete img2imgKeywordStates[currentPromptText];
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
                delete txt2imgKeywordStates[promptText];
                delete img2imgKeywordStates[promptText];
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
                knownKeywords.add(promptText);

                if (keywordStates[promptText] !== undefined) {
                    updateButtonAppearance(button, keywordStates[promptText], buttonText);
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
    const btn = document.querySelector('#kt_new_category');
    if (btn && !btn.hasAttribute('data-kt-newcat-initialized')) {
        btn.setAttribute('data-kt-newcat-initialized', 'true');
        btn.addEventListener('click', () => {
            showNewCategoryModal();
        });
    }
}

// === Setup Order Mode Button ===

function setupOrderModeButton() {
    const orderButton = document.querySelector('#kt_order_mode');
    if (orderButton && !orderButton.hasAttribute('data-order-mode-initialized')) {
        orderButton.addEventListener('click', () => {
            orderMode = (orderMode === 'stable') ? 'random' : 'stable';
            if (orderMode === 'random') {
                orderButton.classList.add('random-mode');
            } else {
                orderButton.classList.remove('random-mode');
            }
            updatePrompts(false);
            updatePrompts(true);
        });
        orderButton.setAttribute('data-order-mode-initialized', 'true');
        console.log("SD Keyword Toggle: Order mode button initialized.");
    }
}

// === Initialization ===

document.addEventListener('DOMContentLoaded', async function() {
    addGlobalStyles();
    await initializeButtons();
});

window.addEventListener('load', async function() {
    addGlobalStyles();
    await initializeButtons();
});

setInterval(async function() {
    await initializeButtons();
    setupOrderModeButton();
    setupAddButtons();
    setupNewCategoryButton();
}, 2000);

console.log("SD Keyword Toggle NEW script loaded");
