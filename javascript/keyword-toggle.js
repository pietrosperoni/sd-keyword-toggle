function toggleKeyword(button) {
    // Get prompt textareas
    const txt2img_prompt = gradioApp().querySelector('#txt2img_prompt textarea');
    const txt2img_neg_prompt = gradioApp().querySelector('#txt2img_neg_prompt textarea');
    
    // Toggle based on current color
    const currentColor = button.style.backgroundColor;
    
    if (currentColor === 'rgb(85, 85, 85)' || !currentColor) {
        // Neutral → Positive
        button.style.backgroundColor = 'rgb(68, 153, 102)';
        
        if (txt2img_prompt) {
            txt2img_prompt.value += (txt2img_prompt.value ? ', ' : '') + button.textContent;
            txt2img_prompt.dispatchEvent(new Event('input'));
        }
    } 
    else if (currentColor === 'rgb(68, 153, 102)') {
        // Positive → Negative
        button.style.backgroundColor = 'rgb(153, 68, 68)';
        
        if (txt2img_prompt && txt2img_neg_prompt) {
            // Remove from positive
            let text = txt2img_prompt.value;
            text = text.replace(', ' + button.textContent, '')
                       .replace(button.textContent + ', ', '')
                       .replace(button.textContent, '');
            txt2img_prompt.value = text;
            txt2img_prompt.dispatchEvent(new Event('input'));
            
            // Add to negative
            txt2img_neg_prompt.value += (txt2img_neg_prompt.value ? ', ' : '') + button.textContent;
            txt2img_neg_prompt.dispatchEvent(new Event('input'));
        }
    }
    else {
        // Negative → Neutral
        button.style.backgroundColor = 'rgb(85, 85, 85)';
        
        if (txt2img_neg_prompt) {
            // Remove from negative
            let text = txt2img_neg_prompt.value;
            text = text.replace(', ' + button.textContent, '')
                       .replace(button.textContent + ', ', '')
                       .replace(button.textContent, '');
            txt2img_neg_prompt.value = text;
            txt2img_neg_prompt.dispatchEvent(new Event('input'));
        }
    }
}