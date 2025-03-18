// Keyword states: 0 = neutral, 1 = positive, 2 = negative
const keywordStates = {};

// Store base prompt text (excluding keywords)
let basePositiveText = "";
let baseNegativeText = "";
let hasInitialized = false;

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
    
    // Update button appearance
    updateButtonAppearance(button);
    
    // Update prompts
    updatePrompts();
}

// Function to update button appearance based on state
function updateButtonAppearance(button) {
    const state = keywordStates[button.id] || 0;
    const originalText = button.textContent.trim().replace(/^[+\-] /, '');
    
    // Force clear all styles first
    button.style = {};
    
    if (state === 1) {
        // POSITIVE - GREEN
        button.textContent = "+ " + originalText;
        button.style.backgroundColor = "#00aa44";
        button.style.color = "white";
        button.style.fontWeight = "bold";
    } else if (state === 2) {
        // NEGATIVE - RED
        button.textContent = "- " + originalText;
        button.style.backgroundColor = "#aa0000";
        button.style.color = "white";
        button.style.fontWeight = "bold";
    } else {
        // NEUTRAL - GRAY
        button.textContent = originalText;
        button.style.backgroundColor = "#555555";
        button.style.color = "white";
    }
    
    // Make sure these styles always apply
    button.style.margin = "2px";
    button.style.padding = "5px 10px";
    button.style.borderRadius = "4px";
    button.style.cursor = "pointer";
    button.style.display = "inline-block";
}

// Better approach to update prompts
function updatePrompts() {
    console.log("Updating prompts");
    
    // Find prompt textareas
    const allTextareas = document.querySelectorAll('textarea');
    
    // Try to get the positive and negative prompt textareas
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
    
    // Initialize base text the first time only
    if (!hasInitialized) {
        basePositiveText = positivePrompt.value || "";
        baseNegativeText = negativePrompt.value || "";
        hasInitialized = true;
        console.log("Initialized base text:", basePositiveText, baseNegativeText);
    }
    
    // Always start from the base text
    let newPositiveText = basePositiveText;
    let newNegativeText = baseNegativeText;
    
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
        
        // Update base text to whatever the user types
        basePositiveText = this.value;
        console.log("User updated positive text:", basePositiveText);
    });
    
    negativePrompt.addEventListener('input', function(e) {
        if (!e.isTrusted) return; // Skip events from our script
        
        // Update base text to whatever the user types
        baseNegativeText = this.value;
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
            
            // Initial styling
            button.style.margin = "2px";
            button.style.padding = "5px 10px";
            button.style.borderRadius = "4px";
            button.style.backgroundColor = "#555555";
            button.style.color = "white";
            button.style.cursor = "pointer";
            button.style.display = "inline-block";
            
            // Mark as initialized
            button.setAttribute('data-kw-initialized', 'true');
        }
    });
}

// Initialize once at the start and then periodically check for new buttons
document.addEventListener('DOMContentLoaded', initializeButtons);
window.addEventListener('load', initializeButtons);
setInterval(initializeButtons, 1000);

console.log("SD Keyword Toggle NEW script loaded");