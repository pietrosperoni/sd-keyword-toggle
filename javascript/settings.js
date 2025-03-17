// This file provides functionality for the settings panel, allowing users to define and organize their custom keywords by categories.

class Settings {
    constructor() {
        this.keywords = {};
    }

    addCategory(category) {
        if (!this.keywords[category]) {
            this.keywords[category] = [];
        }
    }

    addKeyword(category, keyword) {
        if (this.keywords[category]) {
            this.keywords[category].push(keyword);
        } else {
            console.error(`Category "${category}" does not exist.`);
        }
    }

    removeKeyword(category, keyword) {
        if (this.keywords[category]) {
            this.keywords[category] = this.keywords[category].filter(k => k !== keyword);
        } else {
            console.error(`Category "${category}" does not exist.`);
        }
    }

    getKeywords(category) {
        return this.keywords[category] || [];
    }

    getAllKeywords() {
        return this.keywords;
    }
}

// Example usage
const settings = new Settings();
settings.addCategory('Positive');
settings.addKeyword('Positive', 'happy');
settings.addKeyword('Positive', 'joyful');
settings.removeKeyword('Positive', 'happy');
console.log(settings.getAllKeywords());