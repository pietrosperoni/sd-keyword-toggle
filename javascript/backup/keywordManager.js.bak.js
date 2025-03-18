// This file manages the state of keywords, including functions to add, remove, and toggle keywords between positive, negative, and neutral states.

class KeywordManager {
    constructor() {
        this.keywords = {};
    }

    addKeyword(keyword) {
        if (!this.keywords[keyword]) {
            this.keywords[keyword] = 'neutral';
        }
    }

    toggleKeyword(keyword) {
        if (this.keywords[keyword] === 'neutral') {
            this.keywords[keyword] = 'positive';
        } else if (this.keywords[keyword] === 'positive') {
            this.keywords[keyword] = 'negative';
        } else {
            this.keywords[keyword] = 'neutral';
        }
    }

    removeKeyword(keyword) {
        delete this.keywords[keyword];
    }

    getKeywordState(keyword) {
        return this.keywords[keyword] || 'neutral';
    }

    getAllKeywords() {
        return this.keywords;
    }
}

const keywordManager = new KeywordManager();
export default keywordManager;