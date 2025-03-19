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

function createConfigPanel() {
    // Check if panel already exists
    if (document.getElementById('keyword-toggle-config')) return;
    
    // Find a good place to add our config - look for generation tab
    const tabs = document.querySelectorAll('.tab-nav button');
    let txtToImgTab = null;
    
    for (let tab of tabs) {
        if (tab.textContent.includes('txt2img')) {
            txtToImgTab = tab.parentNode.parentNode;
            break;
        }
    }
    
    if (!txtToImgTab) {
        console.log("Could not find txt2img tab to attach config panel");
        return;
    }
    
    // Create config panel elements
    const configPanel = document.createElement('div');
    configPanel.id = 'keyword-toggle-config';
    configPanel.className = 'keyword-toggle-config-panel';
    configPanel.style.cssText = 'margin: 10px 0; padding: 10px; border: 1px solid #555; border-radius: 4px;';
    
    const title = document.createElement('h3');
    title.textContent = 'Keyword Toggle Configuration';
    title.style.marginTop = '0';
    
    const instructions = document.createElement('p');
    instructions.innerHTML = 'Enter keyword categories in this format: <br>"category": (keyword1, keyword2), "category2": (keyword3, keyword4)';
    
    const textarea = document.createElement('textarea');
    textarea.id = 'keyword-toggle-config-input';
    textarea.rows = 5;
    textarea.style.width = '100%';
    textarea.placeholder = '"nature": (river, mountain, tree, forest), "city": (street, building, car)';
    
    // Load saved config if exists
    const savedConfig = localStorage.getItem('keyword-toggle-config');
    if (savedConfig) {
        textarea.value = savedConfig;
    }
    
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save & Apply Keywords';
    saveButton.className = 'lg primary gradio-button';
    saveButton.style.marginTop = '10px';
    
    // Add event listener for save button
    saveButton.addEventListener('click', function() {
        const configText = textarea.value;
        localStorage.setItem('keyword-toggle-config', configText);
        parseAndCreateKeywords(configText);
    });
    
    // Assemble panel
    configPanel.appendChild(title);
    configPanel.appendChild(instructions);
    configPanel.appendChild(textarea);
    configPanel.appendChild(saveButton);
    
    // Add to page near the txt2img tab
    txtToImgTab.parentNode.insertBefore(configPanel, txtToImgTab.nextSibling);
    
    // If we have saved config, parse it immediately
    if (savedConfig) {
        parseAndCreateKeywords(savedConfig);
    }
}

function parseAndCreateKeywords(configText) {
    try {
        // Reset configuration
        keywordConfig = {};
        
        // Parse the format: "category": (keyword1, keyword2), "category2": (keyword3, keyword4)
        const categoryPattern = /"([^"]+)":\s*\(([^)]+)\)/g;
        let match;
        
        while ((match = categoryPattern.exec(configText)) !== null) {
            const category = match[1].trim();
            const keywordsString = match[2].trim();
            const keywords = keywordsString.split(',').map(k => k.trim()).filter(k => k);
            
            keywordConfig[category] = keywords;
            console.log(`Parsed category "${category}" with keywords:`, keywords);
        }
        
        // Now create buttons for these keywords
        createKeywordButtons();
        
    } catch (e) {
        console.error("Error parsing keyword configuration:", e);
        alert("Error parsing configuration. Please check the format.");
    }
}

// Add this function right before the createKeywordButtons function

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

// Add this function to your code

function createConfigTab() {
    // Wait for the tab structure to be available
    const tabNavElement = document.querySelector('.tab-nav');
    if (!tabNavElement) {
        console.log("Tab navigation not found, will retry");
        setTimeout(createConfigTab, 1000);
        return;
    }

    // Check if our tab already exists
    if (document.getElementById('tab-keyword-toggle-config')) {
        console.log("Keywords config tab already exists");
        return;
    }

    console.log("Creating keywords config tab");
    
    // Create the tab button
    const tabButton = document.createElement('button');
    tabButton.id = 'tab-keyword-toggle-config-button';
    tabButton.className = 'svelte-1ipelgc';
    tabButton.textContent = 'Keywords';
    
    // Create tab content area
    const tabContent = document.createElement('div');
    tabContent.id = 'tab-keyword-toggle-config';
    tabContent.className = 'tabitem svelte-1q1lx0';
    tabContent.style.display = 'none';  // Initially hidden
    
    // Create panel content
    const configPanel = document.createElement('div');
    configPanel.id = 'keyword-toggle-config';
    configPanel.className = 'keyword-toggle-config-panel';
    configPanel.style.cssText = 'margin: 20px; padding: 20px; border: 1px solid #555; border-radius: 8px;';
    
    const title = document.createElement('h3');
    title.textContent = 'Keyword Toggle Configuration';
    title.style.marginTop = '0';
    
    const instructions = document.createElement('p');
    instructions.innerHTML = 'Enter keyword categories in this format: <br>"category": (keyword1, keyword2), "category2": (keyword3, keyword4)<br>Or paste a complete JSON configuration';
    
    const textarea = document.createElement('textarea');
    textarea.id = 'keyword-toggle-config-input';
    textarea.rows = 10;
    textarea.style.width = '100%';
    textarea.placeholder = '"nature": (river, mountain, tree, forest), "city": (street, building, car)';
    
    // Load saved config or the default from keywords.json
    const savedConfig = localStorage.getItem('keyword-toggle-config');
    if (savedConfig) {
        textarea.value = savedConfig;
    } else {
        // Try to load from keywords.json
        fetch('/extensions/sd-keyword-toggle/keywords.json')
            .then(response => response.json())
            .then(data => {
                // Convert the JSON to our format
                let formattedConfig = '';
                for (const category in data) {
                    const keywords = data[category].join(', ');
                    formattedConfig += `"${category}": (${keywords}), \n`;
                }
                textarea.value = formattedConfig.trim();
                localStorage.setItem('keyword-toggle-config', formattedConfig);
                parseAndCreateKeywords(formattedConfig);
            })
            .catch(err => {
                console.error("Could not load keywords.json:", err);
                textarea.value = '"Quality": (masterpiece, high quality, best quality), "Style": (anime, photorealistic, digital art)';
            });
    }
    
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save & Apply Keywords';
    saveButton.className = 'lg primary gradio-button';
    saveButton.style.marginTop = '10px';
    
    // Add event listener for save button
    saveButton.addEventListener('click', function() {
        const configText = textarea.value;
        localStorage.setItem('keyword-toggle-config', configText);
        parseAndCreateKeywords(configText);
    });
    
    // Assemble panel
    configPanel.appendChild(title);
    configPanel.appendChild(instructions);
    configPanel.appendChild(textarea);
    configPanel.appendChild(saveButton);
    
    // Add the panel to the tab content
    tabContent.appendChild(configPanel);
    
    // Add the tab button to navigation
    const liElement = document.createElement('li');
    liElement.appendChild(tabButton);
    tabNavElement.appendChild(liElement);
    
    // Add the tab content to the tab content area
    const tabContentArea = tabNavElement.parentElement.querySelector('.tab-content');
    if (tabContentArea) {
        tabContentArea.appendChild(tabContent);
    } else {
        console.error("Could not find tab content area");
    }
    
    // Add click handler for the tab
    tabButton.addEventListener('click', function() {
        // Hide all other tabs
        document.querySelectorAll('.tabitem').forEach(tab => {
            tab.style.display = 'none';
        });
        
        // Deselect all tab buttons
        document.querySelectorAll('.tab-nav button').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // Show our tab and select our button
        tabContent.style.display = 'block';
        tabButton.classList.add('selected');
    });
    
    console.log("Keywords config tab created");
    
    // If we have saved config, parse it immediately
    if (savedConfig) {
        parseAndCreateKeywords(savedConfig);
    }
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