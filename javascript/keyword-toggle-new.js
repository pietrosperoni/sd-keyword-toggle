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
    
    // Initialize state if not exists
    if (keywordStates[keywordId] === undefined) {
        keywordStates[keywordId] = 0;
    }
    
    // Toggle state: neutral -> positive -> negative -> neutral
    keywordStates[keywordId] = (keywordStates[keywordId] + 1) % 3;
    console.log(`Changed ${keyword} state to: ${keywordStates[keywordId]}`);
    
    // Update button appearance - use setAttribute with !important
    if (keywordStates[keywordId] === 1) { // positive - green
        button.textContent = "+ " + keyword;
        button.setAttribute("style", "background-color: #00aa44 !important; color: white !important; font-weight: bold !important; margin: 2px; padding: 5px 10px; border-radius: 4px; cursor: pointer; display: inline-block;");
        button.style.backgroundColor = 'rgb(153, 68, 68)';
    } else if (keywordStates[keywordId] === 2) { // negative - red
        button.textContent = "- " + keyword;
        button.setAttribute("style", "background-color: #aa0000 !important; color: white !important; font-weight: bold !important; margin: 2px; padding: 5px 10px; border-radius: 4px; cursor: pointer; display: inline-block;");
    } else { // neutral - gray
        button.textContent = keyword;
        button.setAttribute("style", "background-color: #555555 !important; color: white !important; margin: 2px; padding: 5px 10px; border-radius: 4px; cursor: pointer; display: inline-block;");
    }
    
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

// Initialize buttons
function initializeButtons() {
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
        } else {
            // For already initialized buttons, DON'T reset their styling
            // This is the key fix - we skip styling for buttons we've already processed
            console.log("Skipping already initialized button:", button.textContent);
        }
    });
}

// Initialize once at the start and then periodically check for new buttons
document.addEventListener('DOMContentLoaded', initializeButtons);
window.addEventListener('load', initializeButtons);
setInterval(initializeButtons, 1000);

console.log("SD Keyword Toggle NEW script loaded");