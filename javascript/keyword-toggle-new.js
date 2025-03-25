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
    // Using keyword text as key instead of button ID to keep multiple instances in sync
    if (keywordStates[keyword] === undefined) {
        keywordStates[keyword] = 0;
    }
    
    // Toggle state: neutral -> positive -> negative -> neutral
    keywordStates[keyword] = (keywordStates[keyword] + 1) % 3;
    console.log(`Changed ${keyword} state to: ${keywordStates[keyword]}`);
    
    // Find all buttons with this same keyword across all tabs
    const allMatchingButtons = findButtonsByKeyword(keyword);
    console.log(`Found ${allMatchingButtons.length} instances of ${keyword}`);
    
    // Update all matching buttons to maintain sync
    allMatchingButtons.forEach(btn => {
        // Store state in data attribute
        btn.dataset.kwState = keywordStates[keyword];
        
        // Update appearance for each matching button
        updateButtonAppearance(btn, keyword, keywordStates[keyword]);
    });
    
    // Update prompts
    updatePrompts();
    
    // Update tab colors to reflect keyword states
    setTimeout(updateTabColors, 10);
}

// New helper function to find all buttons with the same keyword text
function findButtonsByKeyword(keyword) {
    // Search for all buttons that might contain this keyword
    const allButtons = document.querySelectorAll('[id^="keyword_"]');
    
    // Filter to only buttons with matching text (ignoring +/- prefix)
    return Array.from(allButtons).filter(btn => {
        const btnKeyword = btn.textContent.trim().replace(/^[+\-] /, '');
        return btnKeyword === keyword;
    });
}

// Extract button appearance updating to a separate function
function updateButtonAppearance(button, keyword, state) {
    // Update button appearance - add !important to all style properties
    if (state === 1) { // positive - green
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
    } else if (state === 2) { // negative - red
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

// Add global styles for tab indicators
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
        
        /* Tab indicator styles */
        .tab-has-positive {
            position: relative;
        }
        
        .tab-has-negative {
            position: relative;
        }
        
        .tab-has-both {
            position: relative;
        }
        
        /* Super forceful tab colors */
        #tabs > .tab-nav > button.tab-has-positive,
        button[id^="tab_"].tab-has-positive {
            background-color: #FF0000 !important;
            color: white !important;
            border: 2px solid #FF0000 !important;
        }
        
        #tabs > .tab-nav > button.tab-has-negative,
        button[id^="tab_"].tab-has-negative {
            background-color: #0000FF !important;
            color: white !important;
            border: 2px solid #0000FF !important;
        }
        
        #tabs > .tab-nav > button.tab-has-both,
        button[id^="tab_"].tab-has-both {
            background-color: #8A2BE2 !important;
            color: white !important;
            border: 2px solid #8A2BE2 !important;
        }
        
        /* Force refresh hack */
        body.force-tab-refresh #tabs > .tab-nav {
            opacity: 0.99;
        }
    `;
    
    // Add more specific styles to override any existing tab styles
    const tabStyles = `
        /* Main tab color indicators */
        #tabs > .tab-nav > button.tab-has-positive,
        div#tabs button.tab-has-positive[role="tab"],
        .tabs > .tab-nav > button.tab-has-positive {
            background-color: #FF0000 !important;
            color: white !important;
            border-color: #FF0000 !important;
        }
        
        #tabs > .tab-nav > button.tab-has-negative,
        div#tabs button.tab-has-negative[role="tab"],
        .tabs > .tab-nav > button.tab-has-negative {
            background-color: #0000FF !important;
            color: white !important;
            border-color: #0000FF !important;
        }
        
        #tabs > .tab-nav > button.tab-has-both,
        div#tabs button.tab-has-both[role="tab"],
        .tabs > .tab-nav > button.tab-has-both {
            background-color: #8A2BE2 !important;
            color: white !important;
            border-color: #8A2BE2 !important;
        }
    `;
    
    styleEl.textContent += tabStyles;
    
    // Add to document
    document.head.appendChild(styleEl);
    console.log("Global styles added");
}

// Replace your updatePrompts function with this one
function updatePrompts() {
    console.log("Updating prompts");
    
    // Use our enhanced prompt handler if it's available
    if (window.sdKeywordPrompts) {
        window.sdKeywordPrompts.updateAllPrompts(keywordStates, knownKeywords);
        return;
    }
    
    // Old implementation as fallback
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
    
    // Initialize base text the first time only, but clean it of known keywords
    if (!hasInitialized) {
        basePositiveText = cleanUserText(positivePrompt.value || "");
        baseNegativeText = cleanUserText(negativePrompt.value || "");
        hasInitialized = true;
        console.log("Initialized base text:", basePositiveText, baseNegativeText);
    }
    
    // Rest of your existing function...
    // [...]
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

// Ultra-direct tab coloring function 
function updateTabColors() {
    console.log("----- ULTRA FORCEFUL TAB COLORING -----");
    
    // Get active keywords
    const activePositiveKeywords = Object.entries(keywordStates)
        .filter(([kw, state]) => state === 1)
        .map(([kw]) => kw);
        
    const activeNegativeKeywords = Object.entries(keywordStates)
        .filter(([kw, state]) => state === 2)
        .map(([kw]) => kw);
    
    console.log("Active positive keywords:", activePositiveKeywords);
    console.log("Active negative keywords:", activeNegativeKeywords);
    
    // Reset all tabs (be very specific with selectors)
    document.querySelectorAll('button[role="tab"], .tab-nav button').forEach(tab => {
        tab.style = "";
        tab.removeAttribute("style");
        tab.classList.remove('tab-has-positive', 'tab-has-negative', 'tab-has-both');
    });
    
    // If no active keywords, we're done
    if (activePositiveKeywords.length === 0 && activeNegativeKeywords.length === 0) {
        console.log("No active keywords, all tabs reset");
        return;
    }
    
    // Find all keyword buttons
    const keywordButtons = document.querySelectorAll('[id^="keyword_"]');
    console.log(`Found ${keywordButtons.length} keyword buttons to process`);
    
    // Map to track active keywords by tab button
    const tabsWithPositiveKeywords = new Map(); // tab element -> keywords
    const tabsWithNegativeKeywords = new Map(); // tab element -> keywords
    
    // For each keyword button, find its containing tab
    keywordButtons.forEach(button => {
        const buttonText = button.textContent.trim();
        const buttonKeyword = buttonText.replace(/^[+\-] /, '');
        
        // Skip if not an active keyword
        const isActivePositive = activePositiveKeywords.includes(buttonKeyword);
        const isActiveNegative = activeNegativeKeywords.includes(buttonKeyword);
        
        if (!isActivePositive && !isActiveNegative) return;
        
        // Find the closest tab panel and its tab
        let element = button;
        let depth = 0;
        const maxDepth = 20; // Increase depth to ensure we find it
        
        while (element && depth < maxDepth) {
            depth++;
            
            // Check if this is a tab panel
            const isTabPanel = element.getAttribute('role') === 'tabpanel' ||
                              element.classList.contains('tabitem') ||
                              element.classList.contains('gradio-tabitem') ||
                              element.id?.startsWith('tabpanel_');
            
            if (isTabPanel) {
                // Find which tab controls this panel
                let tabButton = null;
                
                // Method 1: via aria-controls
                if (element.id) {
                    tabButton = document.querySelector(`button[aria-controls="${element.id}"]`);
                    if (tabButton) console.log(`Found tab via aria-controls for keyword "${buttonKeyword}"`);
                }
                
                // Method 2: via aria-labelledby
                if (!tabButton && element.getAttribute('aria-labelledby')) {
                    const labelId = element.getAttribute('aria-labelledby');
                    tabButton = document.getElementById(labelId);
                    if (tabButton) console.log(`Found tab via aria-labelledby for keyword "${buttonKeyword}"`);
                }
                
                // Method 3: Parent tab navigation
                if (!tabButton) {
                    let parent = element.parentElement;
                    let parentDepth = 0;
                    const maxParentDepth = 10;
                    
                    while (parent && parentDepth < maxParentDepth && !tabButton) {
                        parentDepth++;
                        
                        // Check if parent has tab navigation
                        const tabNav = parent.querySelector('.tab-nav');
                        if (tabNav) {
                            tabButton = tabNav.querySelector('button') ||
                                        tabNav.querySelector('[role="tab"]');
                            
                            if (tabButton) console.log(`Found tab via tab-nav for keyword "${buttonKeyword}"`);
                        }
                        
                        parent = parent.parentElement;
                    }
                }
                
                // If we found a tab, map it to the keyword
                if (tabButton) {
                    const tabName = tabButton.textContent.trim();
                    console.log(`Found tab "${tabName}" for keyword "${buttonKeyword}"`);
                    
                    // Track which tab has which keyword type
                    if (isActivePositive) {
                        if (!tabsWithPositiveKeywords.has(tabButton)) {
                            tabsWithPositiveKeywords.set(tabButton, []);
                        }
                        tabsWithPositiveKeywords.get(tabButton).push(buttonKeyword);
                        console.log(`Added positive keyword "${buttonKeyword}" to tab "${tabName}"`);
                    }
                    
                    if (isActiveNegative) {
                        if (!tabsWithNegativeKeywords.has(tabButton)) {
                            tabsWithNegativeKeywords.set(tabButton, []);
                        }
                        tabsWithNegativeKeywords.get(tabButton).push(buttonKeyword);
                        console.log(`Added negative keyword "${buttonKeyword}" to tab "${tabName}"`);
                    }
                    
                    break;
                }
            }
            
            // Move up DOM tree
            element = element.parentElement;
        }
    });
    
    console.log(`Found ${tabsWithPositiveKeywords.size} tabs with positive keywords`);
    console.log(`Found ${tabsWithNegativeKeywords.size} tabs with negative keywords`);
    
    // MOST FORCEFUL APPROACH: Create direct inline styles and !important rules
    // Apply color styles to tabs that have active keywords
    
    // Handle tabs with positive keywords
    tabsWithPositiveKeywords.forEach((keywords, tabButton) => {
        const tabName = tabButton.textContent.trim();
        const hasNegative = tabsWithNegativeKeywords.has(tabButton);
        
        // Create a unique ID if needed
        if (!tabButton.id) {
            tabButton.id = `tab-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        }
        
        // Create extremely forceful styles
        if (hasNegative) {
            // Tab has both positive and negative - PURPLE
            console.log(`COLORING tab "${tabName}" PURPLE (has both positive and negative keywords)`);
            
            // Apply directly to element
            tabButton.style = `
                background-color: #8A2BE2 !important;
                color: white !important;
                border: 2px solid #8A2BE2 !important;
                font-weight: bold !important;
                box-shadow: 0 0 5px purple !important;
                outline: 3px solid black !important;
                z-index: 9999 !important;
                position: relative !important;
                text-decoration: underline !important;
            `;
            
            // Also add a class for CSS rules
            tabButton.classList.add('tab-has-both');
            
            // Force redraw
            tabButton.hidden = true;
            tabButton.offsetHeight; // trigger reflow
            tabButton.hidden = false;
            
        } else {
            // Tab has only positive - RED
            console.log(`COLORING tab "${tabName}" RED (has positive keywords)`);
            
            // Apply directly to element
            tabButton.style = `
                background-color: #FF0000 !important;
                color: white !important; 
                border: 2px solid #FF0000 !important;
                font-weight: bold !important;
                box-shadow: 0 0 5px red !important;
                outline: 3px solid black !important;
                z-index: 9999 !important;
                position: relative !important;
                text-decoration: underline !important;
            `;
            
            // Also add a class for CSS rules
            tabButton.classList.add('tab-has-positive');
            
            // Force redraw
            tabButton.hidden = true;
            tabButton.offsetHeight; // trigger reflow
            tabButton.hidden = false;
        }
        
        // Check if style was applied successfully
        setTimeout(() => {
            const computed = window.getComputedStyle(tabButton);
            console.log(`Tab "${tabName}" computed style check:`, {
                backgroundColor: computed.backgroundColor,
                color: computed.color,
                border: computed.border
            });
        }, 50);
    });
    
    // Handle tabs with only negative keywords
    tabsWithNegativeKeywords.forEach((keywords, tabButton) => {
        // Skip if already handled (had both positive and negative)
        if (tabsWithPositiveKeywords.has(tabButton)) return;
        
        const tabName = tabButton.textContent.trim();
        
        // Create a unique ID if needed
        if (!tabButton.id) {
            tabButton.id = `tab-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        }
        
        // Tab has only negative - BLUE
        console.log(`COLORING tab "${tabName}" BLUE (has negative keywords)`);
        
        // Apply directly to element
        tabButton.style = `
            background-color: #0000FF !important;
            color: white !important; 
            border: 2px solid #0000FF !important;
            font-weight: bold !important;
            box-shadow: 0 0 5px blue !important;
            outline: 3px solid black !important;
            z-index: 9999 !important;
            position: relative !important;
            text-decoration: underline !important;
        `;
        
        // Also add a class for CSS rules
        tabButton.classList.add('tab-has-negative');
        
        // Force redraw
        tabButton.hidden = true;
        tabButton.offsetHeight; // trigger reflow
        tabButton.hidden = false;
        
        // Check if style was applied successfully
        setTimeout(() => {
            const computed = window.getComputedStyle(tabButton);
            console.log(`Tab "${tabName}" computed style check:`, {
                backgroundColor: computed.backgroundColor,
                color: computed.color,
                border: computed.border
            });
        }, 50);
    });
    
    // Create additional stylesheet with element-specific selectors
    const styleId = 'kw-tab-color-overrides';
    let styleEl = document.getElementById(styleId);
    
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
    }
    
    let cssRules = '';
    
    // Add specific ID selectors
    [...tabsWithPositiveKeywords.keys(), ...tabsWithNegativeKeywords.keys()].forEach(tabButton => {
        const tabId = tabButton.id;
        if (!tabId) return;
        
        const hasBoth = tabsWithPositiveKeywords.has(tabButton) && tabsWithNegativeKeywords.has(tabButton);
        const hasPositive = tabsWithPositiveKeywords.has(tabButton);
        
        if (hasBoth) {
            cssRules += `
                #${tabId} {
                    background-color: #8A2BE2 !important;
                    color: white !important;
                    border: 2px solid #8A2BE2 !important;
                }
            `;
        } else if (hasPositive) {
            cssRules += `
                #${tabId} {
                    background-color: #FF0000 !important;
                    color: white !important;
                    border: 2px solid #FF0000 !important;
                }
            `;
        } else {
            cssRules += `
                #${tabId} {
                    background-color: #0000FF !important;
                    color: white !important;
                    border: 2px solid #0000FF !important;
                }
            `;
        }
    });
    
    styleEl.textContent = cssRules;
    
    // Force a refresh
    document.body.classList.add('force-tab-refresh');
    setTimeout(() => document.body.classList.remove('force-tab-refresh'), 10);
}

// Improved function that ensures tab coloring works
function ensureTabColoringWorks() {
    // Add event listener to keyword buttons
    document.querySelectorAll('[id^="keyword_"]').forEach(button => {
        if (!button.hasAttribute('data-tab-color-init')) {
            button.addEventListener('click', function() {
                console.log("Keyword clicked, updating tab colors immediately and with delay");
                updateTabColors(); // Immediate update
                setTimeout(updateTabColors, 100); // Delayed update in case state changes take time
            });
            button.setAttribute('data-tab-color-init', 'true');
        }
    });
    
    // Also update on tab click events to keep track of active tab
    document.querySelectorAll('button[role="tab"]').forEach(tab => {
        if (!tab.hasAttribute('data-tab-event-init')) {
            tab.addEventListener('click', function() {
                console.log(`Tab clicked: ${this.textContent.trim()}`);
                setTimeout(updateTabColors, 100); // Update after tab change
            });
            tab.setAttribute('data-tab-event-init', 'true');
        }
    });
    
    // Update now
    updateTabColors();
}

// Make sure this runs on both DOMContentLoaded and load events
document.addEventListener('DOMContentLoaded', function() {
    addGlobalStyles();
    initializeButtons();
    setTimeout(ensureTabColoringWorks, 1000);
});

window.addEventListener('load', function() {
    addGlobalStyles();
    initializeButtons();
    setTimeout(ensureTabColoringWorks, 1000);
});

// Also run it periodically
setInterval(ensureTabColoringWorks, 5000);

// Global dictionaries to map keywords to their tabs
const positiveKeywordTabs = {}; // keyword -> [tab names]
const negativeKeywordTabs = {}; // keyword -> [tab names]

// Add more CSS to ensure subtab styles apply properly
function addSubtabStyles() {
    const styleEl = document.getElementById("kw-toggle-styles") || document.createElement("style");
    styleEl.id = "kw-toggle-styles";
    
    // Add forceful subtab styling
    const additionalStyles = `
        /* Subtab indicator styles - super forceful */
        .tabitem button.tab-has-positive,
        .tab-nav button.tab-has-positive,
        button[id^="tab_"].tab-has-positive,
        button[aria-controls^="tabpanel_"].tab-has-positive {
            background-color: #FF0000 !important;
            color: white !important;
            border: 2px solid #FF0000 !important;
            font-weight: bold !important;
            box-shadow: 0 0 5px red !important;
            z-index: 100 !important;
            position: relative !important;
        }
        
        .tabitem button.tab-has-negative,
        .tab-nav button.tab-has-negative,
        button[id^="tab_"].tab-has-negative,
        button[aria-controls^="tabpanel_"].tab-has-negative {
            background-color: #0000FF !important;
            color: white !important;
            border: 2px solid #0000FF !important;
            font-weight: bold !important;
            box-shadow: 0 0 5px blue !important;
            z-index: 100 !important;
            position: relative !important;
        }
        
        .tabitem button.tab-has-both,
        .tab-nav button.tab-has-both,
        button[id^="tab_"].tab-has-both,
        button[aria-controls^="tabpanel_"].tab-has-both {
            background-color: #8A2BE2 !important;
            color: white !important;
            border: 2px solid #8A2BE2 !important;
            font-weight: bold !important;
            box-shadow: 0 0 5px purple !important;
            z-index: 100 !important;
            position: relative !important;
        }
    `;
    
    styleEl.textContent += additionalStyles;
    
    if (!document.getElementById("kw-toggle-styles")) {
        document.head.appendChild(styleEl);
    }
    
    console.log("Added subtab styling rules");
}

// Make sure the enhanced styles get added
document.addEventListener('DOMContentLoaded', addSubtabStyles);
window.addEventListener('load', addSubtabStyles);


// Add this line right below it
const tabNameToButtonMap = {}; // tab name -> button element

// Function that builds the keyword-to-tab mapping
function buildKeywordTabMapping() {
    // Clear existing mapping
    Object.keys(keywordToTabMapping).forEach(key => delete keywordToTabMapping[key]);
    
    // Find all keyword buttons
    const keywordButtons = document.querySelectorAll('[id^="keyword_"][data-kw-initialized="true"]');
    console.log(`Building keyword-to-tab mapping from ${keywordButtons.length} buttons`);
    
    // Process each button to map it to its containing tab
    keywordButtons.forEach(button => {
        // Extract the keyword text, removing any prefix
        const keyword = button.textContent.trim().replace(/^[+\-] /, '');
        
        // Find the parent tab by looking up the DOM until we find a tab panel
        let element = button;
        let tabPanel = null;
        let maxDepth = 10;
        let depth = 0;
        
        // Find the closest tab panel
        while (element && depth < maxDepth) {
            depth++;
            
            if (element.getAttribute('role') === 'tabpanel' || 
                element.classList.contains('tabitem') ||
                element.id?.startsWith('tabpanel_')) {
                tabPanel = element;
                break;
            }
            
            element = element.parentElement;
        }
        
        // If we found a tab panel, find which tab controls it
        if (tabPanel) {
            let tabName = null;
            
            // Look for tab based on aria relationship
            const panelId = tabPanel.id;
            if (panelId) {
                const tab = document.querySelector(`button[aria-controls="${panelId}"]`);
                if (tab) {
                    tabName = tab.textContent.trim();
                }
            }
            
            // Alternative: look for aria-labelledby
            if (!tabName) {
                const labelId = tabPanel.getAttribute('aria-labelledby');
                if (labelId) {
                    const tab = document.getElementById(labelId);
                    if (tab) {
                        tabName = tab.textContent.trim();
                    }
                }
            }
            
            // If we found a tab name, record this mapping
            if (tabName) {
                if (!keywordToTabMapping[keyword]) {
                    keywordToTabMapping[keyword] = new Set();
                }
                keywordToTabMapping[keyword].add(tabName);
                console.log(`Mapped keyword "${keyword}" to tab "${tabName}"`);
            }
        }
    });
    
    console.log("Keyword-to-tab mapping:", keywordToTabMapping);
}

// Global keyword-to-tab mapping (initialized once)
const keywordToTabMapping = {}; // keyword -> array of tab names

// Build a comprehensive keyword-to-tab mapping on start
function buildGlobalKeywordMap() {
    console.log("Building global keyword-to-tab mapping");
    
    // First, map all tab names to their button elements
    document.querySelectorAll('button[role="tab"]').forEach(tabButton => {
        const tabName = tabButton.textContent.trim();
        tabNameToButtonMap[tabName] = tabButton;
    });
    
    // Find all keyword buttons
    const keywordButtons = document.querySelectorAll('[id^="keyword_"]');
    console.log(`Found ${keywordButtons.length} keyword buttons to process for mapping`);
    
    // For each keyword button, find which tab contains it
    keywordButtons.forEach(button => {
        const buttonKeyword = button.textContent.trim().replace(/^[+\-] /, '');
        
        // Find the closest tab panel ancestor
        let element = button;
        let depth = 0;
        const maxDepth = 15;
        
        while (element && depth < maxDepth) {
            depth++;
            
            // Check if this element is a tab panel
            const isTabPanel = element.getAttribute('role') === 'tabpanel' ||
                              element.classList.contains('tabitem') ||
                              element.classList.contains('gradio-tabitem') ||
                              element.id?.startsWith('tabpanel_');
            
            if (isTabPanel) {
                // Find the tab that controls this panel
                let tabButton = null;
                
                // Method 1: via aria-controls
                if (element.id) {
                    tabButton = document.querySelector(`button[aria-controls="${element.id}"]`);
                }
                
                // Method 2: via aria-labelledby
                if (!tabButton && element.getAttribute('aria-labelledby')) {
                    const labelId = element.getAttribute('aria-labelledby');
                    tabButton = document.getElementById(labelId);
                }
                
                // Method 3: Parent tab navigation
                if (!tabButton) {
                    let parent = element.parentElement;
                    let parentDepth = 0;
                    const maxParentDepth = 5;
                    
                    while (parent && parentDepth < maxParentDepth && !tabButton) {
                        parentDepth++;
                        
                        // Check if parent has tab navigation
                        const tabNav = parent.querySelector('.tab-nav');
                        if (tabNav) {
                            tabButton = tabNav.querySelector('button[aria-selected="true"]') || 
                                        tabNav.querySelector('button');
                        }
                        
                        parent = parent.parentElement;
                    }
                }
                
                if (tabButton) {
                    const tabName = tabButton.textContent.trim();
                    
                    // Add this keyword->tab mapping
                    if (!keywordToTabMapping[buttonKeyword]) {
                        keywordToTabMapping[buttonKeyword] = [];
                    }
                    
                    // Only add if not already in the array
                    if (!keywordToTabMapping[buttonKeyword].includes(tabName)) {
                        keywordToTabMapping[buttonKeyword].push(tabName);
                        console.log(`Mapped keyword "${buttonKeyword}" to tab "${tabName}"`);
                    }
                    
                    // Also store tab button mapping
                    tabNameToButtonMap[tabName] = tabButton;
                    
                    break;
                }
            }
            
            element = element.parentElement;
        }
    });
    
    console.log("Final keyword-to-tab mapping:", keywordToTabMapping);
    console.log("Tab name to button mapping:", Object.keys(tabNameToButtonMap).length, "tabs");
}

// Improved tab coloring function that colors ALL tabs containing active keywords
function updateTabColors() {
    console.log("----- COLORING ALL TABS WITH ACTIVE KEYWORDS -----");
    
    // Ensure we have an up-to-date keyword mapping
    if (Object.keys(keywordToTabMapping).length === 0) {
        buildGlobalKeywordMap();
    }
    
    // Get active keywords
    const activePositiveKeywords = Object.entries(keywordStates)
        .filter(([kw, state]) => state === 1)
        .map(([kw]) => kw);
        
    const activeNegativeKeywords = Object.entries(keywordStates)
        .filter(([kw, state]) => state === 2)
        .map(([kw]) => kw);
    
    console.log("Active positive keywords:", activePositiveKeywords);
    console.log("Active negative keywords:", activeNegativeKeywords);
    
    // Reset all tab colors
    Object.values(tabNameToButtonMap).forEach(tab => {
        tab.style.removeProperty('background-color');
        tab.style.removeProperty('color');
        tab.style.removeProperty('border');
        tab.classList.remove('tab-has-positive', 'tab-has-negative', 'tab-has-both');
    });
    
    // If no active keywords, we're done
    if (activePositiveKeywords.length === 0 && activeNegativeKeywords.length === 0) {
        console.log("No active keywords, all tabs reset");
        return;
    }
    
    // Find which tabs contain active keywords
    const tabsWithPositive = new Set();
    const tabsWithNegative = new Set();
    
    // Check all positive keywords
    activePositiveKeywords.forEach(keyword => {
        // Get all tabs containing this keyword
        if (keywordToTabMapping[keyword]) {
            keywordToTabMapping[keyword].forEach(tabName => {
                tabsWithPositive.add(tabName);
                console.log(`Tab "${tabName}" contains positive keyword "${keyword}"`);
            });
        }
    });
    
    // Check all negative keywords
    activeNegativeKeywords.forEach(keyword => {
        // Get all tabs containing this keyword
        if (keywordToTabMapping[keyword]) {
            keywordToTabMapping[keyword].forEach(tabName => {
                tabsWithNegative.add(tabName);
                console.log(`Tab "${tabName}" contains negative keyword "${keyword}"`);
            });
        }
    });
    
    console.log("Tabs with positive keywords:", [...tabsWithPositive]);
    console.log("Tabs with negative keywords:", [...tabsWithNegative]);
    
    // Apply colors to ALL tabs containing active keywords
    Object.entries(tabNameToButtonMap).forEach(([tabName, tabButton]) => {
        // Check if this tab has both positive and negative keywords
        if (tabsWithPositive.has(tabName) && tabsWithNegative.has(tabName)) {
            // Purple for both
            tabButton.style.cssText = `
                background-color: #8A2BE2 !important;
                color: white !important; 
                border: 2px solid #8A2BE2 !important;
                font-weight: bold !important;
                box-shadow: 0 0 5px purple !important;
                z-index: 100 !important;
            `;
            tabButton.classList.add('tab-has-both');
            console.log(`Colored tab "${tabName}" PURPLE (both positive and negative)`);
        }
        // Check if this tab has positive keywords
        else if (tabsWithPositive.has(tabName)) {
            // Red for positive
            tabButton.style.cssText = `
                background-color: #FF0000 !important;
                color: white !important;
                border: 2px solid #FF0000 !important;
                font-weight: bold !important;
                box-shadow: 0 0 5px red !important;
                z-index: 100 !important;
            `;
            tabButton.classList.add('tab-has-positive');
            console.log(`Colored tab "${tabName}" RED (positive)`);
        }
        // Check if this tab has negative keywords
        else if (tabsWithNegative.has(tabName)) {
            // Blue for negative
            tabButton.style.cssText = `
                background-color: #0000FF !important;
                color: white !important;
                border: 2px solid #0000FF !important;
                font-weight: bold !important;
                box-shadow: 0 0 5px blue !important;
                z-index: 100 !important;
            `;
            tabButton.classList.add('tab-has-negative');
            console.log(`Colored tab "${tabName}" BLUE (negative)`);
        }
    });
    
    // Force refresh to make sure styles apply
    document.body.classList.add('force-tab-refresh');
    setTimeout(() => document.body.classList.remove('force-tab-refresh'), 10);
    
    // NUCLEAR OPTION: Replace this section in your updateTabColors function
    // Replace the part where we style tabs (around line 1150-1190)
    
    // Apply colors to ALL tabs containing active keywords
    Object.entries(tabNameToButtonMap).forEach(([tabName, tabButton]) => {
        // First remove any inline styles to prevent conflicts
        tabButton.removeAttribute("style");
        
        // Create a unique ID if needed for targeting
        if (!tabButton.id) {
            tabButton.id = `forced-tab-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        }
        
        // Check if this tab has both positive and negative keywords
        if (tabsWithPositive.has(tabName) && tabsWithNegative.has(tabName)) {
            // PURPLE FOR BOTH - NUCLEAR APPROACH
            console.log(`NUCLEAR COLORING tab "${tabName}" PURPLE`);
            
            // 1. Direct style modification with !important on everything
            tabButton.style.cssText = `
                background-color: #8A2BE2 !important;
                background: #8A2BE2 !important;
                color: white !important; 
                border: 4px solid #8A2BE2 !important;
                font-weight: bold !important;
                box-shadow: 0 0 15px purple !important;
                text-shadow: 0 0 5px white !important;
                z-index: 9999 !important;
                position: relative !important;
                text-decoration: underline !important;
                outline: 3px solid yellow !important;
                transform: scale(1.05) !important;
            `;
            
            // 2. Add multiple classes for redundancy
            tabButton.classList.add('tab-has-both', 'force-purple-tab', 'keyword-active-tab');
            
            // 3. Set direct attributes that might be used for styling
            tabButton.setAttribute('data-colored', 'purple');
            tabButton.setAttribute('data-tab-state', 'both');
            
            // 4. Create a wrapper if needed to increase specificity
            const parent = tabButton.parentElement;
            if (parent && !parent.classList.contains('kw-tab-wrapper')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'kw-tab-wrapper kw-purple-wrapper';
                wrapper.style.cssText = 'position: relative; display: inline-block; z-index: 9999;';
                parent.insertBefore(wrapper, tabButton);
                wrapper.appendChild(tabButton);
            }
            
            // 5. Create an overlay element inside the button for visual effect
            const existingOverlay = tabButton.querySelector('.kw-tab-overlay');
            if (!existingOverlay) {
                const overlay = document.createElement('div');
                overlay.className = 'kw-tab-overlay';
                overlay.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(138, 43, 226, 0.5);
                    z-index: -1;
                    pointer-events: none;
                `;
                tabButton.appendChild(overlay);
            }
        }
        // For positive keywords
        else if (tabsWithPositive.has(tabName)) {
            // RED FOR POSITIVE - NUCLEAR APPROACH
            console.log(`NUCLEAR COLORING tab "${tabName}" RED`);
            
            tabButton.style.cssText = `
                background-color: #FF0000 !important;
                background: #FF0000 !important;
                color: white !important; 
                border: 4px solid #FF0000 !important;
                font-weight: bold !important;
                box-shadow: 0 0 15px red !important;
                text-shadow: 0 0 5px white !important;
                z-index: 9999 !important;
                position: relative !important;
                text-decoration: underline !important;
                outline: 3px solid yellow !important;
                transform: scale(1.05) !important;
            `;
            
            tabButton.classList.add('tab-has-positive', 'force-red-tab', 'keyword-active-tab');
            tabButton.setAttribute('data-colored', 'red');
            tabButton.setAttribute('data-tab-state', 'positive');
            
            // Create wrapper
            const parent = tabButton.parentElement;
            if (parent && !parent.classList.contains('kw-tab-wrapper')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'kw-tab-wrapper kw-red-wrapper';
                wrapper.style.cssText = 'position: relative; display: inline-block; z-index: 9999;';
                parent.insertBefore(wrapper, tabButton);
                wrapper.appendChild(tabButton);
            }
            
            // Create overlay
            const existingOverlay = tabButton.querySelector('.kw-tab-overlay');
            if (!existingOverlay) {
                const overlay = document.createElement('div');
                overlay.className = 'kw-tab-overlay';
                overlay.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(255, 0, 0, 0.5);
                    z-index: -1;
                    pointer-events: none;
                `;
                tabButton.appendChild(overlay);
            }
        }
        // For negative keywords
        else if (tabsWithNegative.has(tabName)) {
            // BLUE FOR NEGATIVE - NUCLEAR APPROACH
            console.log(`NUCLEAR COLORING tab "${tabName}" BLUE`);
            
            tabButton.style.cssText = `
                background-color: #0000FF !important;
                background: #0000FF !important;
                color: white !important; 
                border: 4px solid #0000FF !important;
                font-weight: bold !important;
                box-shadow: 0 0 15px blue !important;
                text-shadow: 0 0 5px white !important;
                z-index: 9999 !important;
                position: relative !important;
                text-decoration: underline !important;
                outline: 3px solid yellow !important;
                transform: scale(1.05) !important;
            `;
            
            tabButton.classList.add('tab-has-negative', 'force-blue-tab', 'keyword-active-tab');
            tabButton.setAttribute('data-colored', 'blue');
            tabButton.setAttribute('data-tab-state', 'negative');
            
            // Create wrapper
            const parent = tabButton.parentElement;
            if (parent && !parent.classList.contains('kw-tab-wrapper')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'kw-tab-wrapper kw-blue-wrapper';
                wrapper.style.cssText = 'position: relative; display: inline-block; z-index: 9999;';
                parent.insertBefore(wrapper, tabButton);
                wrapper.appendChild(tabButton);
            }
            
            // Create overlay
            const existingOverlay = tabButton.querySelector('.kw-tab-overlay');
            if (!existingOverlay) {
                const overlay = document.createElement('div');
                overlay.className = 'kw-tab-overlay';
                overlay.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 255, 0.5);
                    z-index: -1;
                    pointer-events: none;
                `;
                tabButton.appendChild(overlay);
            }
        }
    });
    
    // Add CSS animation that keeps reapplying styles
    const animationStyleId = 'kw-tab-animation';
    let animStyleEl = document.getElementById(animationStyleId);
    
    if (!animStyleEl) {
        animStyleEl = document.createElement('style');
        animStyleEl.id = animationStyleId;
        document.head.appendChild(animStyleEl);
    }
    
    // Animation that persists styles
    animStyleEl.textContent = `
        @keyframes keepPurpleTab {
            0%, 100% {
                background-color: #8A2BE2 !important;
                color: white !important;
                border-color: #8A2BE2 !important;
                box-shadow: 0 0 15px purple !important;
            }
        }
        
        @keyframes keepRedTab {
            0%, 100% {
                background-color: #FF0000 !important;
                color: white !important;
                border-color: #FF0000 !important;
                box-shadow: 0 0 15px red !important;
            }
        }
        
        @keyframes keepBlueTab {
            0%, 100% {
                background-color: #0000FF !important;
                color: white !important;
                border-color: #0000FF !important;
                box-shadow: 0 0 15px blue !important;
            }
        }
        
        .tab-has-both, .force-purple-tab {
            animation: keepPurpleTab 1s infinite !important;
        }
        
        .tab-has-positive, .force-red-tab {
            animation: keepRedTab 1s infinite !important;
        }
        
        .tab-has-negative, .force-blue-tab {
            animation: keepBlueTab 1s infinite !important;
        }
    `;
    
    // Set up an interval to keep reapplying these styles
    const styleInterval = setInterval(() => {
        document.querySelectorAll('.force-purple-tab, .force-red-tab, .force-blue-tab').forEach(tab => {
            // Reapply styles every second
            const color = tab.getAttribute('data-colored');
            if (color === 'purple') {
                tab.style.backgroundColor = '#8A2BE2';
                tab.style.borderColor = '#8A2BE2';
            } else if (color === 'red') {
                tab.style.backgroundColor = '#FF0000';
                tab.style.borderColor = '#FF0000';
            } else if (color === 'blue') {
                tab.style.backgroundColor = '#0000FF';
                tab.style.borderColor = '#0000FF';
            }
        });
    }, 1000);
    
    // Force refresh to make sure styles apply
    document.body.classList.add('force-tab-refresh');
    setTimeout(() => document.body.classList.remove('force-tab-refresh'), 10);
}