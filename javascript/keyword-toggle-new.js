// Keyword states: 0 = neutral, 1 = positive, 2 = negative
const keywordStates = {};

// Store non-keyword text entered by user
let userPositiveText = "";
let userNegativeText = "";

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
    
    // Update button appearance - more forceful approach
    updateButtonAppearance(button);
    
    // Update prompts
    updatePrompts();
}

// Function to update button appearance based on state
function updateButtonAppearance(button) {
    const state = keywordStates[button.id] || 0;
    const originalText = button.textContent.trim().replace(/^[+\-] /, '');
    
    // Reset all inline styles
    button.setAttribute("style", "");
    
    // Add state-specific class and style
    if (state === 1) {
        // POSITIVE - GREEN
        button.textContent = "+ " + originalText;
        button.style.backgroundColor = "#00aa44"; // GREEN for positive
        button.style.color = "white";
        button.style.fontWeight = "bold";
    } else if (state === 2) {
        // NEGATIVE - RED
        button.textContent = "- " + originalText;
        button.style.backgroundColor = "#aa0000"; // RED for negative
        button.style.color = "white";
        button.style.fontWeight = "bold";
    } else {
        // NEUTRAL - GRAY
        button.textContent = originalText;
        button.style.backgroundColor = "#555555"; // Gray
        button.style.color = "white";
    }
    
    // Common styles
    button.style.margin = "2px";
    button.style.padding = "5px 10px";
    button.style.borderRadius = "4px";
    button.style.cursor = "pointer";
}

// Direct approach to update prompts
function updatePrompts() {
    console.log("Updating prompts");
    
    // Find prompt textareas using direct selector for the version of Stable Diffusion you're using
    const allTextareas = document.querySelectorAll('textarea');
    console.log("Found", allTextareas.length, "textareas");
    
    // Try to get the positive and negative prompt textareas
    let positivePrompt = document.querySelector('textarea[placeholder*="Prompt"]:not([placeholder*="Negative"])');
    let negativePrompt = document.querySelector('textarea[placeholder*="Negative"]');
    
    // Fallback to indices based on your specific setup
    if (!positivePrompt && !negativePrompt && allTextareas.length >= 29) {
        console.log("Using fallback textareas by index");
        positivePrompt = allTextareas[27];  // Based on your previous debug output
        negativePrompt = allTextareas[28];  // Based on your previous debug output
    }
    
    if (!positivePrompt || !negativePrompt) {
        console.log("Could not find prompt textareas!");
        return;
    }
    
    console.log("Found prompt textareas:", !!positivePrompt, !!negativePrompt);
    
    // Get current values for initial use
    if (userPositiveText === "") {
        userPositiveText = positivePrompt.value || "";
        console.log("Initial positive text:", userPositiveText);
    }
    
    if (userNegativeText === "") {
        userNegativeText = negativePrompt.value || "";
        console.log("Initial negative text:", userNegativeText);
    }
    
    // Gather keywords based on their states
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
    
    console.log("Positive keywords:", posKeywords);
    console.log("Negative keywords:", negKeywords);
    
    // Build the new prompt strings
    let newPositiveText = userPositiveText;
    let newNegativeText = userNegativeText;
    
    // Add keywords with proper formatting
    if (posKeywords.length > 0) {
        if (newPositiveText && !newPositiveText.endsWith(' ') && !newPositiveText.endsWith(',')) {
            newPositiveText += ', ';
        }
        newPositiveText += posKeywords.join(', ');
    }
    
    if (negKeywords.length > 0) {
        if (newNegativeText && !newNegativeText.endsWith(' ') && !newNegativeText.endsWith(',')) {
            newNegativeText += ', ';
        }
        newNegativeText += negKeywords.join(', ');
    }
    
    console.log("New positive text:", newPositiveText);
    console.log("New negative text:", newNegativeText);
    
    // Super direct approach to update textareas
    try {
        // Method 1: Direct value setting
        positivePrompt.value = newPositiveText;
        negativePrompt.value = newNegativeText;
        
        // Method 2: Trigger change event
        positivePrompt.dispatchEvent(new Event('input', {bubbles: true}));
        negativePrompt.dispatchEvent(new Event('input', {bubbles: true}));
        
        // Method 3: Focus and blur to ensure change is registered
        positivePrompt.focus();
        setTimeout(() => {
            positivePrompt.blur();
            negativePrompt.focus();
            setTimeout(() => {
                negativePrompt.blur();
            }, 10);
        }, 10);
        
        console.log("Textarea values updated");
    } catch (e) {
        console.error("Error updating textareas:", e);
    }
}

// Initialize buttons
function initializeButtons() {
    const buttons = document.querySelectorAll('[id^="keyword_"]');
    console.log("Found keyword buttons:", buttons.length);
    
    buttons.forEach(button => {
        if (!button.hasAttribute('data-kw-initialized')) {
            button.setAttribute('data-kw-initialized', 'true');
            
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
        }
    });
}

// Multiple entry points to ensure initialization
document.addEventListener('DOMContentLoaded', initializeButtons);
window.addEventListener('load', initializeButtons);
setInterval(initializeButtons, 1000); // Keep checking for new buttons

// Gradio-specific events
document.addEventListener('gradio:mounted', initializeButtons);
document.addEventListener('gradio:change', initializeButtons);

console.log("SD Keyword Toggle NEW script loaded");