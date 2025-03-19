// Add at the top of your file

// Helper function to debug styling
function debugButtonStyle(button, label) {
    console.log("===== BUTTON STYLE DEBUG: " + label + " =====");
    console.log("Button text:", button.textContent);
    console.log("Style attribute:", button.getAttribute("style"));
    console.log("Computed backgroundColor:", window.getComputedStyle(button).backgroundColor);
    console.log("Button HTML:", button.outerHTML);
    console.log("===============================");
}

// Keyword states: 0 = neutral, 1 = positive, 2 = negative
const keywordStates = {};

// Store base prompt text (excluding keywords)
let basePositiveText = "";
let baseNegativeText = "";
let hasInitialized = false;
let knownKeywords = new Set(); // Track all keywords we know about

// Function to toggle keyword state and update prompt
function toggleKeyword(button) {
    const keyword = button.textContent.trim().replace(/^[+\-] /, ''); // Remove any prefix
    const keywordId = button.id;
    
    // Debug before any changes
    debugButtonStyle(button, "BEFORE TOGGLE");
    
    // Initialize state if not exists
    if (keywordStates[keywordId] === undefined) {
        keywordStates[keywordId] = 0;
    }
    
    // Toggle state: neutral -> positive -> negative -> neutral
    keywordStates[keywordId] = (keywordStates[keywordId] + 1) % 3;
    console.log(`Changed ${keyword} state to: ${keywordStates[keywordId]}`);
    
    // Store state in data attribute too (for inspection)
    button.dataset.kwState = keywordStates[keywordId];
    
    // Update button appearance - add !important to all style properties
    if (keywordStates[keywordId] === 1) { // positive - green
        button.textContent = "+ " + keyword;
        button.setAttribute("style", "");
        // Add !important to EVERYTHING and make foreground/background contrast high
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
    } else if (keywordStates[keywordId] === 2) { // negative - red
        button.textContent = "- " + keyword;
        button.setAttribute("style", "");
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
        button.setAttribute("style", "");
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
    
    // Debug after changes
    debugButtonStyle(button, "AFTER TOGGLE");
    
    // Update prompts
    updatePrompts();
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
            background-color: #00aa44 !important;
            color: white !important;
            font-weight: bold !important;
        }
        
        [id^="keyword_"][data-kw-state="2"] {
            background-color: #aa0000 !important;
            color: white !important;
            font-weight: bold !important;
        }
        
        [id^="keyword_"][data-kw-state="0"] {
            background-color: #555555 !important;
            color: white !important;
        }
    `;
    
    // Add to document
    document.head.appendChild(styleEl);
    console.log("Global styles added");
}

// Better approach to update prompts
function updatePrompts() {
    console.log("Updating prompts");
    
    // Find prompt textareas
    const allTextareas = document.querySelectorAll('textarea');
    
    // Try to get the positive and negative prompt textareas
    // FIX: Fixed the syntax error in the selector
    let positivePrompt = document.querySelector('textarea[placeholder*="Prompt"]:not([placeholder*="Negative"])');
    let negativePrompt = document.querySelector('textarea[placeholder*="Negative"]');
    
    // Fallback to indices based on your specific setup
    if (!positivePrompt && !negativePrompt && allTextareas.length >= 29) {
        positivePrompt = allTextareas[27];
        negativePrompt = allTextareas[28];
    }
    
    if (!positivePrompt || !negativePrompt) {
        console.log("Could not find prompt textareas!");
        return;
    }
    
    // Initialize base text the first time only, but clean it of known keywords
    if (!hasInitialized) {
        basePositiveText = cleanUserText(positivePrompt.value || "");
        baseNegativeText = cleanUserText(negativePrompt.value || "");
        hasInitialized = true;
        console.log("Initialized base text:", basePositiveText, baseNegativeText);
    }
    
    // Always start from the cleaned base text
    let newPositiveText = cleanUserText(basePositiveText);
    let newNegativeText = cleanUserText(baseNegativeText);
    
    // Collect keywords based on state
    let posKeywords = [];
    let negKeywords = [];
    
    for (const id in keywordStates) {
        const btn = document.getElementById(id);
        if (!btn) continue;
        
        const word = btn.textContent.trim().replace(/^[+\-] /, '');
        const state = keywordStates[id];
        
        if (state === 1) posKeywords.push(word);
        else if (state === 2) negKeywords.push(word);
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
    
    console.log("Setting prompts to:", newPositiveText, newNegativeText);
    
    // Update the textareas
    try {
        // Set values
        positivePrompt.value = newPositiveText;
        negativePrompt.value = newNegativeText;
        
        // Trigger events to ensure UI updates
        positivePrompt.dispatchEvent(new Event('input', {bubbles: true}));
        negativePrompt.dispatchEvent(new Event('input', {bubbles: true}));
        
        console.log("Textarea values updated");
    } catch (e) {
        console.error("Error updating textareas:", e);
    }
    
    // Allow updating base text when user edits
    positivePrompt.addEventListener('input', function(e) {
        if (!e.isTrusted) return; // Skip events from our script
        
        // Update base text to whatever the user types, but clean it of known keywords
        basePositiveText = cleanUserText(this.value);
        console.log("User updated positive text:", basePositiveText);
    });
    
    negativePrompt.addEventListener('input', function(e) {
        if (!e.isTrusted) return; // Skip events from our script
        
        // Update base text to whatever the user types, but clean it of known keywords
        baseNegativeText = cleanUserText(this.value);
        console.log("User updated negative text:", baseNegativeText);
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

// Initialize buttons
async function initializeButtons() {
    // First try to create buttons from text files
    await createKeywordButtons();
    
    // Then initialize any existing buttons (from previous methods)
    const buttons = document.querySelectorAll('[id^="keyword_"]');
    console.log("Found keyword buttons:", buttons.length);
    
    buttons.forEach(button => {
        if (!button.hasAttribute('data-kw-initialized')) {
            // Add click handler
            button.addEventListener('click', function() {
                toggleKeyword(this);
            });
            
            // Initial styling - ONLY for new buttons
            button.setAttribute("style", "background-color: #555555 !important; color: white !important; margin: 2px; padding: 5px 10px; border-radius: 4px; cursor: pointer; display: inline-block;");
            
            // Mark as initialized
            button.setAttribute('data-kw-initialized', 'true');
            
            // Track this keyword
            const keyword = button.textContent.trim();
            knownKeywords.add(keyword);
        }
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