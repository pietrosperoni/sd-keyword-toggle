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
let knownKeywords = new Set(); // Still track all keywords

// Modified toggle function to handle different contexts and update all buttons with same keyword
function toggleKeyword(button) {
    // Get context (txt2img or img2img)
    const tabId = button.closest('#tab_img2img') ? "img2img" : "txt2img";
    const isImg2img = tabId === "img2img";
    
    // Use the appropriate state tracker
    const keywordStates = isImg2img ? img2imgKeywordStates : txt2imgKeywordStates;
    
    // Get keyword text without any prefix
    const keyword = button.textContent.trim().replace(/^[+\-] /, '');
    
    // Initialize state if not exists - TRACK BY KEYWORD TEXT instead of ID
    if (keywordStates[keyword] === undefined) {
        keywordStates[keyword] = 0;
    }
    
    // Toggle state: neutral -> positive -> negative -> neutral
    keywordStates[keyword] = (keywordStates[keyword] + 1) % 3;
    console.log(`Changed "${keyword}" state to: ${keywordStates[keyword]} in ${isImg2img ? 'img2img' : 'txt2img'}`);
    
    // Find ALL buttons with the same keyword in this context
    const contextSelector = isImg2img ? '#tab_img2img' : '#tab_txt2img';
    const allMatchingButtons = document.querySelectorAll(`${contextSelector} [id^="keyword_"]`);
    
    // Update ALL matching buttons
    allMatchingButtons.forEach(btn => {
        const btnKeyword = btn.textContent.trim().replace(/^[+\-] /, '');
        if (btnKeyword === keyword) {
            // Update this button's appearance
            updateButtonAppearance(btn, keywordStates[keyword], keyword);
        }
    });
    
    // Update prompts for the appropriate interface
    updatePrompts(isImg2img);
}

// Helper function to update button appearance - updated with legacy styling
function updateButtonAppearance(button, state, keyword) {
    // Store state in data attribute
    button.dataset.kwState = state;
    
    // Reset any existing styles
    button.setAttribute("style", "");
    
    // Update appearance based on state - match legacy styling exactly
    if (state === 1) { // positive - green
        button.textContent = "+ " + keyword;
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
        button.textContent = "- " + keyword;
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
        button.textContent = keyword;
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

// Function to clean user text of any keywords
function cleanUserText(text) {
    if (!text) return "";
    
    let cleanedText = text;
    // Get all keywords from all buttons
    const buttons = document.querySelectorAll('[id^="keyword_"]');
    buttons.forEach(button => {
        const keyword = button.textContent.trim().replace(/^[+\-] /, '');
        knownKeywords.add(keyword);
        
        // Remove the keyword from user text (with comma handling)
        const keywordPattern = new RegExp(`(^|,\\s*)${keyword}(\\s*,|$)`, 'gi');
        cleanedText = cleanedText.replace(keywordPattern, '$1$2');
        
        // Also handle case where it's the only text
        if (cleanedText.trim() === keyword) {
            cleanedText = '';
        }
    });
    
    // Clean up any double commas or trailing/leading commas
    cleanedText = cleanedText.replace(/,\s*,/g, ',').replace(/^\s*,\s*|\s*,\s*$/g, '').trim();
    
    return cleanedText;
}

// Add this function right after cleanUserText:

function addGlobalStyles() {
    // Check if styles already added
    if (document.getElementById("kw-toggle-styles")) return;
    
    // Create style element
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
    `;
    
    // Add to document
    document.head.appendChild(styleEl);
    console.log("Global styles added");
}

// Modified updatePrompts function with fixed variable declarations
function updatePrompts(isImg2img = false) {
    console.log(`Updating prompts for ${isImg2img ? 'img2img' : 'txt2img'}`);
    
    // More precise selectors for textareas
    let positivePrompt, negativePrompt;
    let basePositiveText, baseNegativeText;
    let hasInitialized;
    // Only declare keywordStates once
    const keywordStates = isImg2img ? img2imgKeywordStates : txt2imgKeywordStates;
    
    if (isImg2img) {
        // More precise selectors for img2img textareas
        positivePrompt = document.querySelector('#img2img_prompt textarea');
        negativePrompt = document.querySelector('#img2img_neg_prompt textarea');
        basePositiveText = img2imgBasePositiveText;
        baseNegativeText = img2imgBaseNegativeText;
        hasInitialized = hasInitializedImg2img;
    } else {
        // More precise selectors for txt2img textareas
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
    
    // Initialize base text the first time only, but clean it of known keywords
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
    
    // Always start from the cleaned base text
    let newPositiveText = cleanUserText(basePositiveText);
    let newNegativeText = cleanUserText(baseNegativeText);
    
    // Collect keywords based on state - use the keywordStates object directly
    let posKeywords = [];
    let negKeywords = [];
    
    // Process all keywords in the state object
    for (const keyword in keywordStates) {
        const state = keywordStates[keyword];
        
        if (state === 1) posKeywords.push(keyword);
        else if (state === 2) negKeywords.push(keyword);
    }
    
    // Add positive keywords if any
    if (posKeywords.length > 0) {
        if (newPositiveText && newPositiveText.length > 0 && 
            !newPositiveText.endsWith(' ') && !newPositiveText.endsWith(',')) {
            newPositiveText += ', ';
        }
        newPositiveText += posKeywords.join(', ');
    }
    
    // Add negative keywords if any
    if (negKeywords.length > 0) {
        if (newNegativeText && newNegativeText.length > 0 && 
            !newNegativeText.endsWith(' ') && !newNegativeText.endsWith(',')) {
            newNegativeText += ', ';
        }
        newNegativeText += negKeywords.join(', ');
    }
    
    console.log(`Setting ${isImg2img ? 'img2img' : 'txt2img'} prompts to:`, newPositiveText, newNegativeText);
    
    // Update the textareas
    try {
        // Set values
        positivePrompt.value = newPositiveText;
        negativePrompt.value = newNegativeText;
        
        // Trigger events to ensure UI updates
        positivePrompt.dispatchEvent(new Event('input', {bubbles: true}));
        negativePrompt.dispatchEvent(new Event('input', {bubbles: true}));
        
        console.log(`${isImg2img ? 'img2img' : 'txt2img'} Textarea values updated`);
    } catch (e) {
        console.error(`Error updating ${isImg2img ? 'img2img' : 'txt2img'} textareas:`, e);
    }
    
    // Allow updating base text when user edits - with context awareness
    positivePrompt.addEventListener('input', function(e) {
        if (!e.isTrusted) return; // Skip events from our script
        
        // Update the appropriate base text
        if (isImg2img) {
            img2imgBasePositiveText = cleanUserText(this.value);
            console.log("User updated img2img positive text:", img2imgBasePositiveText);
        } else {
            txt2imgBasePositiveText = cleanUserText(this.value);
            console.log("User updated txt2img positive text:", txt2imgBasePositiveText);
        }
    });
    
    negativePrompt.addEventListener('input', function(e) {
        if (!e.isTrusted) return; // Skip events from our script
        
        // Update the appropriate base text
        if (isImg2img) {
            img2imgBaseNegativeText = cleanUserText(this.value);
            console.log("User updated img2img negative text:", img2imgBaseNegativeText);
        } else {
            txt2imgBaseNegativeText = cleanUserText(this.value);
            console.log("User updated txt2img negative text:", txt2imgBaseNegativeText);
        }
    });
}

// Add this code before initializeButtons function

// Configuration system
let keywordConfig = {};

// Replace the loadKeywordsFromFiles function with this API-based version:

async function loadKeywordsFromFiles() {
    // Reset known keywords
    knownKeywords = new Set();
    
    try {
        // Use the API to get keywords from the server
        const response = await fetch('/sd-keyword-toggle/get-keywords');
        
        if (response.ok) {
            const data = await response.json();
            console.log("Successfully loaded keywords from server:", data);
            
            // Add all keywords to the known keywords set
            const keywordData = data.keywords;
            for (const category in keywordData) {
                keywordData[category].forEach(keyword => knownKeywords.add(keyword));
            }
            
            return keywordData;
        } else {
            console.error("Failed to load keywords from API:", response.status, response.statusText);
        }
    } catch (error) {
        console.error("Error loading keywords from API:", error);
    }
    
    // Fallback to keywords.json if API fails
    try {
        console.log("Falling back to keywords.json");
        const jsonResponse = await fetch('/extensions/sd-keyword-toggle/keywords.json');
        
        if (jsonResponse.ok) {
            const jsonData = await jsonResponse.json();
            
            // Add all keywords to the known keywords set
            for (const category in jsonData) {
                jsonData[category].forEach(keyword => knownKeywords.add(keyword));
            }
            
            return jsonData;
        }
    } catch (jsonError) {
        console.error("Error loading keywords.json:", jsonError);
    }
    
    // Default keywords if everything fails
    console.log("Using default keywords");
    const defaultKeywords = {
        "Quality": ["masterpiece", "high quality", "best quality"],
        "Style": ["anime", "photorealistic", "digital art"]
    };
    
    for (const category in defaultKeywords) {
        defaultKeywords[category].forEach(keyword => knownKeywords.add(keyword));
    }
    
    return defaultKeywords;
}

// Replace createKeywordButtons function with this version:

async function createKeywordButtons() {
    // Load the keywords for tracking purposes
    const keywordData = await loadKeywordsFromFiles();
    
    // We're not creating containers anymore, just tracking keywords
    for (const category in keywordData) {
        keywordData[category].forEach(keyword => knownKeywords.add(keyword));
    }
    
    // Find all existing keyword buttons created by Gradio
    const buttons = document.querySelectorAll('[id^="keyword_"]');
    console.log(`Found ${buttons.length} existing keyword buttons`);
    
    // Initialize the click handlers for these buttons
    buttons.forEach(button => {
        if (!button.hasAttribute('data-kw-initialized')) {
            // Add click handler
            button.addEventListener('click', function() {
                toggleKeyword(this);
            });
            
            // Mark as initialized
            button.setAttribute('data-kw-initialized', 'true');
        }
    });
}

// Update initializeButtons to check for existing states
async function initializeButtons() {
    // First load keywords for tracking
    await loadKeywordsFromFiles();
    
    // Then initialize buttons in each tab context separately
    ["txt2img", "img2img"].forEach(context => {
        const tabId = context === "img2img" ? "tab_img2img" : "tab_txt2img";
        const keywordStates = context === "img2img" ? img2imgKeywordStates : txt2imgKeywordStates;
        
        // Find only the keyword buttons in the specific tab
        const buttons = document.querySelectorAll(`#${tabId} [id^="keyword_"]`);
        console.log(`Found ${buttons.length} ${context} keyword buttons`);
        
        buttons.forEach(button => {
            if (!button.hasAttribute('data-kw-initialized')) {
                // Add click handler
                button.addEventListener('click', function() {
                    toggleKeyword(this);
                });
                
                // Very minimal initial styling - avoid disrupting the UI
                button.style.margin = "2px";
                button.style.cursor = "pointer";
                
                // Mark as initialized to avoid duplicate event handlers
                button.setAttribute('data-kw-initialized', 'true');
                
                // Track this keyword
                const keyword = button.textContent.trim();
                knownKeywords.add(keyword);
                
                // Apply existing state if there is one
                if (keywordStates[keyword] !== undefined) {
                    updateButtonAppearance(button, keywordStates[keyword], keyword);
                }
            }
        });
    });
}

// Update the initialization code to handle async:
document.addEventListener('DOMContentLoaded', async function() {
    addGlobalStyles();
    await initializeButtons();
});

window.addEventListener('load', async function() {
    addGlobalStyles();
    await initializeButtons();
});

// Set interval to periodically check for new buttons
setInterval(async function() {
    await initializeButtons();
}, 2000); // Increased interval to reduce console spam

console.log("SD Keyword Toggle NEW script loaded");