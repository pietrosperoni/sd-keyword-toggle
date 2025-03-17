from flask import Flask, request, jsonify

app = Flask(__name__)

# In-memory storage for keywords
keywords = {
    "positive": [],
    "negative": [],
    "neutral": []
}

@app.route('/api/keywords', methods=['GET'])
def get_keywords():
    return jsonify(keywords)

@app.route('/api/keywords/toggle', methods=['POST'])
def toggle_keyword():
    data = request.json
    keyword = data.get('keyword')
    
    if keyword in keywords['positive']:
        keywords['positive'].remove(keyword)
        keywords['negative'].append(keyword)
    elif keyword in keywords['negative']:
        keywords['negative'].remove(keyword)
        keywords['neutral'].append(keyword)
    else:
        keywords['positive'].append(keyword)

    return jsonify(keywords)

if __name__ == '__main__':
    app.run(debug=True)