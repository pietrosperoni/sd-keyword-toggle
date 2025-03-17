function createKeywordElement(keyword) {
    const keywordElement = document.createElement('button');
    keywordElement.textContent = keyword.text;
    keywordElement.className = `keyword-button ${keyword.state}`;
    
    keywordElement.addEventListener('click', () => {
        toggleKeywordState(keyword);
        updateKeywordUI(keywordElement, keyword);
    });

    return keywordElement;
}

function toggleKeywordState(keyword) {
    switch (keyword.state) {
        case 'neutral':
            keyword.state = 'positive';
            break;
        case 'positive':
            keyword.state = 'negative';
            break;
        case 'negative':
            keyword.state = 'neutral';
            break;
    }
}

function updateKeywordUI(keywordElement, keyword) {
    keywordElement.className = `keyword-button ${keyword.state}`;
}

function renderKeywords(keywords) {
    const keywordsContainer = document.getElementById('keywords-container');
    keywordsContainer.innerHTML = '';

    keywords.forEach(keyword => {
        const keywordElement = createKeywordElement(keyword);
        keywordsContainer.appendChild(keywordElement);
    });
}

// Example usage
const keywords = [
    { text: 'Keyword1', state: 'neutral' },
    { text: 'Keyword2', state: 'neutral' },
    { text: 'Keyword3', state: 'neutral' }
];

document.addEventListener('DOMContentLoaded', () => {
    renderKeywords(keywords);
});