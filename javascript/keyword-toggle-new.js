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
    
    // Use classes instead of inline styles
    button.className = "keyword-button";
    
    // Add state-specific class
    if (state === 1) {
        button.classList.add("positive");
        button.textContent = "+ " + originalText;
        button.style.backgroundColor = "#00aa44"; // Bright green
        button.style.color = "white";
        button.style.fontWeight = "bold";
    } else if (state === 2) {
        button.classList.add("negative");
        button.textContent = "- " + originalText;
        button.style.backgroundColor = "#aa0000"; // Bright red
        button.style.color = "white";
        button.style.fontWeight = "bold";
    } else {
        button.classList.add("neutral");
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

// Simple function to update prompts
function updatePrompts() {
    // Find all textareas
    const textareas = document.querySelectorAll('textarea');
    let positivePrompt, negativePrompt;
    
    // Specifically target the prompt textareas
    for (let i = 0; i < textareas.length; i++) {
        const textarea = textareas[i];
        if (textarea.placeholder && textarea.placeholder.includes("Prompt") && 
            !textarea.placeholder.includes("Negative")) {
            positivePrompt = textarea;
        }
        if (textarea.placeholder && textarea.placeholder.includes("Negative")) {
            negativePrompt = textarea;
        }
    }
    
    if (!positivePrompt || !negativePrompt) return;
    
    // Initialize user text if needed
    if (userPositiveText === "") {
        userPositiveText = positivePrompt.value;
    }
    if (userNegativeText === "") {
        userNegativeText = negativePrompt.value;
    }
    
    // Start fresh with user text
    let posText = userPositiveText;
    let negText = userNegativeText;
    
    // Collect keywords by state
    const posKeywords = [];
    const negKeywords = [];
    
    for (const id in keywordStates) {
        const elem = document.getElementById(id);
        if (!elem) continue;
        
        const word = elem.textContent.trim().replace(/^[+\-] /, '');
        const state = keywordStates[id];
        
        if (state === 1) posKeywords.push(word);
        else if (state === 2) negKeywords.push(word);
    }
    
    // Add keywords to prompts
    if (posKeywords.length > 0) {
        if (posText && !posText.endsWith(',') && !posText.endsWith(' ')) {
            posText += ', ';
        }
        posText += posKeywords.join(', ');
    }
    
    if (negKeywords.length > 0) {
        if (negText && !negText.endsWith(',') && !negText.endsWith(' ')) {
            negText += ', ';
        }
        negText += negKeywords.join(', ');
    }
    
    // Update textareas
    positivePrompt.value = posText;
    negativePrompt.value = negText;
    
    // Trigger input events
    positivePrompt.dispatchEvent(new Event('input', {bubbles:true}));
    negativePrompt.dispatchEvent(new Event('input', {bubbles:true}));
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Find and initialize all keyword buttons
    setInterval(function() {
        const buttons = document.querySelectorAll('[id^="keyword_"]');
        
        buttons.forEach(button => {
            if (!button.hasAttribute('data-initialized')) {
                button.setAttribute('data-initialized', 'true');
                
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
            }
        });
    }, 1000); // Check every second
});

// Additional gradio-specific initialization
window.addEventListener('gradio:mounted', function() {
    console.log("Gradio components mounted - initializing keyword toggle");
});

console.log("SD Keyword Toggle NEW script loaded");