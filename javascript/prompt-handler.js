/**
 * Enhanced Prompt Handler for SD-Keyword-Toggle
 * 
 * This file handles the textareas in both txt2img and img2img interfaces.
 * Its responsibilities:
 * - Find and track prompt textareas in both interfaces
 * - Maintain "base text" (user's original prompt without our toggled keywords)
 * - Update textareas with active keywords (both positive and negative)
 * - Prevent update loops by tracking which updates are ours vs. user edits
 */

// Track all found textareas
const textareaMap = {
    txt2img: {
        positive: null,
        negative: null,
        basePositive: "",
        baseNegative: ""
    },
    img2img: {
        positive: null, 
        negative: null,
        basePositive: "", 
        baseNegative: ""
    }
};

// Set to track updates we initiate
const ourUpdates = new Set();

// Debug flag - set to true for verbose logging
const DEBUG = true;
function debugLog(...args) {
    if (DEBUG) console.log(...args);
}

// Initialize all prompts
function findAllPrompts() {
    debugLog("Searching for all prompt textareas...");
    
    // Look for txt2img prompts
    const txt2imgContainer = document.getElementById('txt2img_prompt_container') || 
                            document.getElementById('txt2img_prompt')?.parentElement;
    
    if (txt2imgContainer) {
        textareaMap.txt2img.positive = txt2imgContainer.querySelector('textarea:not([id*="neg"])');
        textareaMap.txt2img.negative = txt2imgContainer.querySelector('textarea[id*="neg"]');
        debugLog("txt2img prompts found:", !!textareaMap.txt2img.positive, !!textareaMap.txt2img.negative);
    }
    
    // Look for img2img prompts
    const img2imgContainer = document.getElementById('img2img_prompt_container') || 
                            document.getElementById('img2img_prompt')?.parentElement;
    
    if (img2imgContainer) {
        textareaMap.img2img.positive = img2imgContainer.querySelector('textarea:not([id*="neg"])');
        textareaMap.img2img.negative = img2imgContainer.querySelector('textarea[id*="neg"]');
        debugLog("img2img prompts found:", !!textareaMap.img2img.positive, !!textareaMap.img2img.negative);
    }
    
    // If container method failed, try direct IDs
    if (!textareaMap.txt2img.positive) 
        textareaMap.txt2img.positive = document.getElementById('txt2img_prompt');
    if (!textareaMap.txt2img.negative) 
        textareaMap.txt2img.negative = document.getElementById('txt2img_neg_prompt');
    if (!textareaMap.img2img.positive) 
        textareaMap.img2img.positive = document.getElementById('img2img_prompt');
    if (!textareaMap.img2img.negative) 
        textareaMap.img2img.negative = document.getElementById('img2img_neg_prompt');
    
    // If all else fails, try more generic selectors
    if (!textareaMap.txt2img.positive || !textareaMap.txt2img.negative) {
        const allTextareas = document.querySelectorAll('textarea');
        for (let i = 0; i < allTextareas.length; i++) {
            const ta = allTextareas[i];
            const placeholder = ta.getAttribute('placeholder') || '';
            
            if (placeholder.includes('Prompt') && !placeholder.includes('Negative')) {
                if (!textareaMap.txt2img.positive) {
                    textareaMap.txt2img.positive = ta;
                } else if (!textareaMap.img2img.positive) {
                    textareaMap.img2img.positive = ta;
                }
            } else if (placeholder.includes('Negative')) {
                if (!textareaMap.txt2img.negative) {
                    textareaMap.txt2img.negative = ta;
                } else if (!textareaMap.img2img.negative) {
                    textareaMap.img2img.negative = ta;
                }
            }
        }
    }
    
    // Initialize base text with current user content (once)
    // Only store base text the first time we find textareas
    if (textareaMap.txt2img.positive && textareaMap.txt2img.basePositive === "") 
        textareaMap.txt2img.basePositive = textareaMap.txt2img.positive.value || "";
    if (textareaMap.txt2img.negative && textareaMap.txt2img.baseNegative === "") 
        textareaMap.txt2img.baseNegative = textareaMap.txt2img.negative.value || "";
    if (textareaMap.img2img.positive && textareaMap.img2img.basePositive === "") 
        textareaMap.img2img.basePositive = textareaMap.img2img.positive.value || "";
    if (textareaMap.img2img.negative && textareaMap.img2img.baseNegative === "") 
        textareaMap.img2img.baseNegative = textareaMap.img2img.negative.value || "";
    
    // Setup change listeners
    setupPromptListeners();
    
    debugLog("Prompt map initialized:", {
        txt2img: {
            positive: !!textareaMap.txt2img.positive,
            negative: !!textareaMap.txt2img.negative,
            basePositive: textareaMap.txt2img.basePositive,
            baseNegative: textareaMap.txt2img.baseNegative
        },
        img2img: {
            positive: !!textareaMap.img2img.positive,
            negative: !!textareaMap.img2img.negative,
            basePositive: textareaMap.img2img.basePositive,
            baseNegative: textareaMap.img2img.baseNegative
        }
    });
}

// Set up event listeners for user edits
function setupPromptListeners() {
    for (const interfaceType in textareaMap) {
        for (const promptType of ['positive', 'negative']) {
            const textarea = textareaMap[interfaceType][promptType];
            if (textarea && !textarea.hasAttribute('data-kw-listener')) {
                textarea.addEventListener('input', function(e) {
                    // Skip our programmatic updates with a reliable check
                    const textareaId = this.id || `${interfaceType}_${promptType}`;
                    if (ourUpdates.has(textareaId)) {
                        debugLog(`Skipping our programmatic update for ${interfaceType} ${promptType}`);
                        ourUpdates.delete(textareaId);
                        return;
                    }
                    
                    // This is a user edit, update base text
                    const baseKey = `base${promptType.charAt(0).toUpperCase() + promptType.slice(1)}`;
                    textareaMap[interfaceType][baseKey] = this.value || "";
                    debugLog(`User updated ${interfaceType} ${promptType} base text:`, 
                             textareaMap[interfaceType][baseKey]);
                });
                textarea.setAttribute('data-kw-listener', 'true');
            }
        }
    }
}

// Update all prompts based on keyword states
function updateAllPrompts(keywordStates) {
    debugLog("Updating all prompts with keyword states", keywordStates);
    
    // Collect active keywords by state
    const positiveKeywords = [];
    const negativeKeywords = [];
    
    for (const keyword in keywordStates) {
        const state = keywordStates[keyword];
        if (state === 1) { // Positive
            positiveKeywords.push(keyword);
        } else if (state === 2) { // Negative
            negativeKeywords.push(keyword);
        }
    }
    
    debugLog("Active positive keywords:", positiveKeywords);
    debugLog("Active negative keywords:", negativeKeywords);
    
    // Update both interfaces
    for (const interfaceType in textareaMap) {
        // Update positive prompt
        const posTA = textareaMap[interfaceType].positive;
        if (posTA) {
            // Mark this update as ours to prevent listener firing
            const textareaId = posTA.id || `${interfaceType}_positive`;
            ourUpdates.add(textareaId);
            
            // Get base text
            let newText = textareaMap[interfaceType].basePositive;
            
            // Add positive keywords
            if (positiveKeywords.length > 0) {
                if (newText && newText.length > 0 && 
                    !newText.endsWith(' ') && !newText.endsWith(',')) {
                    newText += ', ';
                }
                newText += positiveKeywords.join(', ');
            }
            
            // Update textarea
            posTA.value = newText;
            posTA.dispatchEvent(new Event('input', {bubbles: true}));
            debugLog(`Updated ${interfaceType} positive prompt:`, newText);
        }
        
        // Update negative prompt
        const negTA = textareaMap[interfaceType].negative;
        if (negTA) {
            // Mark update as ours
            const textareaId = negTA.id || `${interfaceType}_negative`;
            ourUpdates.add(textareaId);
            
            // Get base text
            let newText = textareaMap[interfaceType].baseNegative;
            
            // Add negative keywords
            if (negativeKeywords.length > 0) {
                if (newText && newText.length > 0 && 
                    !newText.endsWith(' ') && !newText.endsWith(',')) {
                    newText += ', ';
                }
                newText += negativeKeywords.join(', ');
            }
            
            // Update textarea
            negTA.value = newText;
            negTA.dispatchEvent(new Event('input', {bubbles: true}));
            debugLog(`Updated ${interfaceType} negative prompt:`, newText);
        }
    }
}

// Export our functions to the global scope
window.sdKeywordPrompts = {
    findAllPrompts,
    updateAllPrompts,
    textareaMap
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => setTimeout(findAllPrompts, 1000));
window.addEventListener('load', () => setTimeout(findAllPrompts, 1000));

// Re-check periodically for prompts (less frequently to avoid issues)
const checkInterval = setInterval(findAllPrompts, 5000);

console.log("SD-Keyword-Toggle Prompt Handler loaded");