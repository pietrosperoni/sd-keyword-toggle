document.addEventListener('DOMContentLoaded', function() {
    // Find all keyword buttons and attach event listeners
    const keywordButtons = document.querySelectorAll('[id^="keyword_"]');
    
    keywordButtons.forEach(button => {
        button.addEventListener('click', function() {
            toggleKeyword(this);
        });
        
        // Initialize with neutral style
        button.style.backgroundColor = 'rgb(85, 85, 85)';
        button.style.color = 'white';
        button.style.margin = '2px';
        button.style.padding = '5px 10px';
        button.style.borderRadius = '4px';
        button.style.cursor = 'pointer';
    });
});