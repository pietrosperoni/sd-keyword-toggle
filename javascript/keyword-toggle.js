// Keyword states: 0 = neutral, 1 = positive, 2 = negative
const keywordStates = {};

// Store non-keyword text entered by user
let userPositiveText = "";
let userNegativeText = "";

// Function to toggle keyword state and update prompt
function toggleKeyword(button) {
    console.log("Toggle keyword called for:", button.textContent);
    const keyword = button.textContent.trim();
    const keywordId = button.id;
    
    // Initialize state if not exists
    if (!keywordStates[keywordId]) {
        keywordStates[keywordId] = 0;
    }
    
    // Toggle state: neutral -> positive -> negative -> neutral
    keywordStates[keywordId] = (keywordStates[keywordId] + 1) % 3;
    
    // Update button appearance
    updateButtonStyle(button, keywordStates[keywordId]);
    
    // Update prompts
    updatePrompts();
}

// Function to update button style based on state
function updateButtonStyle(button, state) {
    switch (state) {
        case 0: // neutral
            button.style.backgroundColor = 'rgb(85, 85, 85)';
            button.style.color = 'white';
            break;
        case 1: // positive
            button.style.backgroundColor = 'rgb(0, 150, 50)';
            button.style.color = 'white';
            break;
        case 2: // negative
            button.style.backgroundColor = 'rgb(150, 0, 50)';
            button.style.color = 'white';
            break;
    }
}

// Helper function to find the prompt textareas
function findPromptTextareas() {
    // Find textareas with specific placeholder text
    const allTextareas = Array.from(document.querySelectorAll('textarea'));
    
    let positivePromptBox = null;
    let negativePromptBox = null;
    
    // Match exactly based on the known placeholder text
    for (const textarea of allTextareas) {
        if (textarea.placeholder && textarea.placeholder.startsWith("Prompt\n(Press Ctrl+Enter")) {
            positivePromptBox = textarea;
            console.log("Found positive prompt box by placeholder");
        }
        else if (textarea.placeholder && textarea.placeholder.startsWith("Negative prompt\n(Press Ctrl+Enter")) {
            negativePromptBox = textarea;
            console.log("Found negative prompt box by placeholder");
        }
    }
    
    // If still not found, try by index if we have at least 28 textareas
    if ((!positivePromptBox || !negativePromptBox) && allTextareas.length >= 29) {
        console.log("Trying to find prompt boxes by index");
        // Based on your console output, they are at indices 27 and 28
        positivePromptBox = positivePromptBox || allTextareas[27];
        negativePromptBox = negativePromptBox || allTextareas[28];
    }
    
    return { positivePromptBox, negativePromptBox };
}

// Function to update both prompt textboxes
function updatePrompts() {
    console.log("Updating prompts");
    
    // Find prompt textareas using our helper function
    const { positivePromptBox, negativePromptBox } = findPromptTextareas();
    
    // Debug info
    console.log("Prompt boxes found:", !!positivePromptBox, !!negativePromptBox);
    console.log("Positive box:", positivePromptBox);
    console.log("Negative box:", negativePromptBox);
    
    // If we still don't have both, we can't proceed
    if (!positivePromptBox || !negativePromptBox) {
        console.log("Failed to find both prompt boxes. Cannot proceed.");
        return;
    }
    
    // Rest of the function remains the same...
    // Extract user-entered text (non-keywords) if this is the first update
    if (userPositiveText === "") {
        userPositiveText = positivePromptBox.value;
    }
    if (userNegativeText === "") {
        userNegativeText = negativePromptBox.value;
    }
    
    // Build new prompts
    let positivePrompt = userPositiveText;
    let negativePrompt = userNegativeText;
    
    // Add keywords based on their states
    for (const keywordId in keywordStates) {
        const state = keywordStates[keywordId];
        const keywordElem = document.getElementById(keywordId);
        if (!keywordElem) continue;
        
        const keyword = keywordElem.textContent.trim();
        
        if (state === 1) { // positive
            if (positivePrompt && !positivePrompt.endsWith(' ') && !positivePrompt.endsWith(',')) {
                positivePrompt += ', ';
            }
            positivePrompt += keyword;
        } else if (state === 2) { // negative
            if (negativePrompt && !negativePrompt.endsWith(' ') && !negativePrompt.endsWith(',')) {
                negativePrompt += ', ';
            }
            negativePrompt += keyword;
        }
    }
    
    // Update textboxes
    positivePromptBox.value = positivePrompt;
    negativePromptBox.value = negativePrompt;
    
    // Trigger input event for Stable Diffusion to recognize the change
    positivePromptBox.dispatchEvent(new Event('input', { bubbles: true }));
    negativePromptBox.dispatchEvent(new Event('input', { bubbles: true }));
    
    console.log("Updated prompt values:", positivePromptBox.value, negativePromptBox.value);
}

// More robust initialization that waits for elements to be available
function initializeKeywordToggle() {
    console.log("SD Keyword Toggle: Initializing...");
    
    // Use MutationObserver to wait for elements to be added to the DOM
    const observer = new MutationObserver((mutations, obs) => {
        const keywordButtons = document.querySelectorAll('[id^="keyword_"]');
        if (keywordButtons.length > 0) {
            console.log("SD Keyword Toggle: Found keyword buttons:", keywordButtons.length);
            
            keywordButtons.forEach(button => {
                // Only add event listener if it doesn't have one already
                if (!button.hasAttribute('data-toggle-initialized')) {
                    button.addEventListener('click', function() {
                        toggleKeyword(this);
                    });
                    
                    // Mark as initialized
                    button.setAttribute('data-toggle-initialized', 'true');
                    
                    // Initialize style
                    button.style.backgroundColor = 'rgb(85, 85, 85)';
                    button.style.color = 'white';
                    button.style.margin = '2px';
                    button.style.padding = '5px 10px';
                    button.style.borderRadius = '4px';
                    button.style.cursor = 'pointer';
                    
                    // Initialize state
                    keywordStates[button.id] = 0;
                }
            });
            
            // Set up listener for user typing in the prompts
            const positivePromptBox = document.getElementById('txt2img_prompt') || document.getElementById('img2img_prompt');
            const negativePromptBox = document.getElementById('txt2img_negative_prompt') || document.getElementById('img2img_negative_prompt');
            
            if (positivePromptBox && !positivePromptBox.hasAttribute('data-toggle-initialized')) {
                positivePromptBox.addEventListener('input', function() {
                    userPositiveText = this.value;
                });
                positivePromptBox.setAttribute('data-toggle-initialized', 'true');
            }
            
            if (negativePromptBox && !negativePromptBox.hasAttribute('data-toggle-initialized')) {
                negativePromptBox.addEventListener('input', function() {
                    userNegativeText = this.value;
                });
                negativePromptBox.setAttribute('data-toggle-initialized', 'true');
            }
        }
    });
    
    // Start observing
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Also try to initialize on document ready
    if (document.readyState === "complete" || document.readyState === "interactive") {
        setTimeout(() => {
            const keywordButtons = document.querySelectorAll('[id^="keyword_"]');
            if (keywordButtons.length > 0) {
                console.log("SD Keyword Toggle: Found keyword buttons on init:", keywordButtons.length);
            }
        }, 1000);
    }
}

// Initialize on page load
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeKeywordToggle);
} else {
    initializeKeywordToggle();
}

// Also initialize on gradio load events
document.addEventListener("gradio:load", initializeKeywordToggle);
document.addEventListener("gradio:change", initializeKeywordToggle);

console.log("SD Keyword Toggle script loaded");