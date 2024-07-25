from flask import Flask, jsonify, render_template, request
from elasticsearch import Elasticsearch
import logging
import unidecode
from itertools import combinations
import time

app = Flask(__name__)

# Configuration du logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuration Elasticsearch
es = Elasticsearch(['http://localhost:9200'], timeout=30, max_retries=10, retry_on_timeout=True)

def check_elasticsearch_connection():
    try:
        if es.ping():
            logger.info("Connected to Elasticsearch")
            indices = ['words_fr', 'words_en', 'words_fren', 'words_all']
            for index in indices:
                if es.indices.exists(index=index):
                    logger.info(f"Index '{index}' exists")
                else:
                    logger.error(f"Index '{index}' does not exist")
            return True
        else:
            logger.error("Could not connect to Elasticsearch")
            return False
    except Exception as e:
        logger.error(f"Error connecting to Elasticsearch: {str(e)}")
        return False

@app.route('/')
def index():
    return render_template('index.html')

def get_words(letters, dictionary):
    index_name = f"words_{dictionary}"
    
    normalized_letters = unidecode.unidecode(letters.upper().replace(" ", ""))
    sorted_letters = ''.join(sorted(normalized_letters))
    
    # Générer toutes les sous-chaînes possibles
    substrings = [''.join(sorted(combo)) for i in range(2, len(sorted_letters) + 1)
                  for combo in combinations(sorted_letters, i)]
    
    # Requête Elasticsearch
    query = {
        "query": {
            "terms": {
                "sorted_word": substrings
            }
        },
        "sort": [
            {"length": "desc"},
            {"word": "asc"}
        ],
        "size": 10000  # Augmenter si nécessaire
    }
    
    try:
        results = es.search(index=index_name, body=query, request_timeout=30)
        return [hit['_source']['word'] for hit in results['hits']['hits']]
    except Exception as e:
        logger.error(f"Error querying Elasticsearch: {str(e)}")
        return []

def find_combinations(letters, words, max_depth=3, timeout=5):
    start_time = time.time()
    def backtrack(remaining, current=[]):
        if time.time() - start_time > timeout:
            return []
        if not remaining or len(current) >= max_depth:
            return [current]
        
        results = []
        for word in words:
            if all(remaining.count(c) >= word.upper().count(c) for c in set(word.upper())):
                new_remaining = list(remaining)
                for c in word.upper():
                    new_remaining.remove(c)
                results.extend(backtrack(''.join(new_remaining), current + [word]))
        
        return results

    combinations = backtrack(letters.upper())
    return sorted(combinations, key=lambda x: (sum(len(word) for word in x), len(x)), reverse=True)

@app.route('/api/words/<letters>')
def api_words(letters):
    start_time = time.time()
    dictionary = request.args.get('dict', 'fr')
    logger.info(f"Received request for words with letters: {letters}, dictionary: {dictionary}")
    
    words_time = time.time()
    words = get_words(letters, dictionary)
    logger.info(f"Found {len(words)} words in {time.time() - words_time:.4f} seconds")
    
    combinations_time = time.time()
    combinations = find_combinations(letters, words)
    logger.info(f"Found {len(combinations)} combinations in {time.time() - combinations_time:.4f} seconds")
    
    total_time = time.time() - start_time
    logger.info(f"Total processing time: {total_time:.4f} seconds")
    
    response = jsonify({
        "words": words[:500],  # Limitez à 500 mots
        "combinations": combinations[:50]  # Limitez à 50 combinations
    })
    return response

@app.route('/health')
def health_check():
    if check_elasticsearch_connection():
        return "Connected to Elasticsearch", 200
    else:
        return "Cannot connect to Elasticsearch", 500

if __name__ == '__main__':
    if check_elasticsearch_connection():
        app.run(debug=True)
    else:
        logger.error("Failed to connect to Elasticsearch or index 'words' does not exist. Exiting.")