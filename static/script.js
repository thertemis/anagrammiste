let letterBlocks = [];
let removedWords = new Set();
let currentPage = 1;
const wordsPerPage = 50;
let currentAbortController = null;
let currentDictionary = 'fr';  // Dictionnaire par défaut

function showError(message) {
    const errorContainer = document.getElementById('error-container');
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
    console.error(message);
}

function clearError() {
    const errorContainer = document.getElementById('error-container');
    errorContainer.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function() {
    const input = document.getElementById('input');
    const submitBtn = document.getElementById('submit-btn');
    const shuffleBtn = document.getElementById('shuffle-button');
    const dictButtons = document.querySelectorAll('.dict-btn');
    
    submitBtn.addEventListener('click', handleSubmit);
    shuffleBtn.addEventListener('click', shuffleUnlockedBlocks);
    input.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            handleSubmit();
        }
    });

    dictButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            currentDictionary = this.dataset.dict;
            dictButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            updateSuggestions();
        });
    });

    // Activer le dictionnaire français par défaut
    document.getElementById('dict-fr').classList.add('active');
});

function handleSubmit() {
    clearError();
    const input = document.getElementById('input').value.toUpperCase().replace(/[^A-Z]/g, '');
    if (input.length === 0) {
        showError("Veuillez entrer au moins une lettre.");
        return;
    }
    letterBlocks = input.split('').map(letter => ({ letter, locked: false }));
    createLetterBlocks();
    updateSuggestions();
    document.getElementById('input').value = ''; // Clear the input field after submission
}

function getColorForLetter(letter) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const hue = (alphabet.indexOf(letter) / 26) * 360;
    return `hsl(${hue}, 70%, 80%)`;
}

function createLetterBlocks() {
    const letterBlocksDiv = document.getElementById('letter-blocks');
    letterBlocksDiv.innerHTML = '';
    
    letterBlocks.forEach((block, index) => {
        const blockElement = document.createElement('div');
        blockElement.className = 'letter-block';
        blockElement.textContent = block.letter;
        blockElement.style.backgroundColor = block.locked ? '#cccccc' : getColorForLetter(block.letter);
        blockElement.draggable = !block.locked;
        blockElement.dataset.index = index;
        blockElement.addEventListener('dragstart', dragStart);
        blockElement.addEventListener('dragover', dragOver);
        blockElement.addEventListener('drop', drop);
        blockElement.addEventListener('click', () => toggleLock(index));
        letterBlocksDiv.appendChild(blockElement);
    });
}

function dragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.dataset.index);
    e.target.style.opacity = '0.5';
}

function dragOver(e) {
    e.preventDefault();
}

function drop(e) {
    e.preventDefault();
    const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
    const targetIndex = Array.from(e.target.parentNode.children).indexOf(e.target);
    
    if (draggedIndex !== targetIndex) {
        const temp = letterBlocks[draggedIndex];
        letterBlocks[draggedIndex] = letterBlocks[targetIndex];
        letterBlocks[targetIndex] = temp;
        
        createLetterBlocks();
        updateSuggestions();
    }
}

function toggleLock(index) {
    letterBlocks[index].locked = !letterBlocks[index].locked;
    createLetterBlocks();
    updateSuggestions();
}

function updateInput() {
    const input = document.getElementById('input');
    input.value = letterBlocks.map(block => block.letter).join('');
    updateSuggestions();
}

function shuffleUnlockedBlocks() {
    const unlockedBlocks = letterBlocks.filter(block => !block.locked);
    const lockedBlocks = letterBlocks.filter(block => block.locked);

    // Mélanger les blocs non verrouillés
    for (let i = unlockedBlocks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [unlockedBlocks[i], unlockedBlocks[j]] = [unlockedBlocks[j], unlockedBlocks[i]];
    }

    letterBlocks = [...lockedBlocks, ...unlockedBlocks];
    createLetterBlocks();
    updateSuggestions();
}

function updateSuggestions() {
    const unlockedLetters = letterBlocks.filter(block => !block.locked).map(block => block.letter).join('');
    
    // Annuler la requête précédente si elle existe
    if (currentAbortController) {
        currentAbortController.abort();
    }

    // Créer un nouveau AbortController pour cette requête
    currentAbortController = new AbortController();
    
    if (unlockedLetters.length > 0) {
        console.log(`Fetching words for: ${unlockedLetters} using dictionary: ${currentDictionary}`);
        fetch(`/api/words/${unlockedLetters}?dict=${currentDictionary}`, { signal: currentAbortController.signal })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                console.log("Received data:", data);
                const filteredWords = data.words.filter(word => !removedWords.has(word));
                currentPage = 1;  // Réinitialiser la page à 1 à chaque nouvelle recherche
                displayWords(filteredWords);
                displayCombinations(data.combinations);
            })
            .catch(error => {
                if (error.name === 'AbortError') {
                    console.log('Fetch aborted');
                } else {
                    console.error(`Erreur lors de la récupération des mots: ${error.message}`);
                    showError(`Erreur lors de la récupération des mots: ${error.message}`);
                }
            });
    } else {
        console.log("No unlocked letters");
        document.getElementById('words').innerHTML = '';
        document.getElementById('combinations').innerHTML = '';
    }
}

function displayWords(words) {
    const wordsDiv = document.getElementById('words');
    wordsDiv.innerHTML = '<h3>Mots possibles:</h3>';
    if (words.length === 0) {
        wordsDiv.innerHTML += '<p>Aucun mot trouvé.</p>';
    } else {
        const ul = document.createElement('ul');
        const startIndex = (currentPage - 1) * wordsPerPage;
        const endIndex = startIndex + wordsPerPage;
        words.slice(startIndex, endIndex).forEach(word => {
            const li = document.createElement('li');
            const wordLink = document.createElement('a');
            wordLink.href = '#';
            wordLink.textContent = word;
            wordLink.addEventListener('click', (e) => {
                e.preventDefault();
                selectWord(word);
            });
            li.appendChild(wordLink);

            const wiktionaryLink = document.createElement('a');
            wiktionaryLink.href = `https://fr.wiktionary.org/wiki/${word}`;
            wiktionaryLink.target = '_blank';
            wiktionaryLink.innerHTML = '&#128270;'; // Loupe emoji
            wiktionaryLink.title = 'Rechercher sur Wiktionnaire';
            wiktionaryLink.style.marginLeft = '5px';
            li.appendChild(wiktionaryLink);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = '❌';
            deleteButton.title = 'Supprimer ce mot';
            deleteButton.style.marginLeft = '5px';
            deleteButton.addEventListener('click', () => removeWord(word));
            li.appendChild(deleteButton);

            ul.appendChild(li);
        });
        wordsDiv.appendChild(ul);

        // Ajouter la pagination
        const totalPages = Math.ceil(words.length / wordsPerPage);
        const paginationDiv = document.createElement('div');
        paginationDiv.className = 'pagination';
        if (currentPage > 1) {
            const prevButton = document.createElement('button');
            prevButton.textContent = 'Précédent';
            prevButton.addEventListener('click', () => {
                currentPage--;
                displayWords(words);
            });
            paginationDiv.appendChild(prevButton);
        }
        if (currentPage < totalPages) {
            const nextButton = document.createElement('button');
            nextButton.textContent = 'Suivant';
            nextButton.addEventListener('click', () => {
                currentPage++;
                displayWords(words);
            });
            paginationDiv.appendChild(nextButton);
        }
        wordsDiv.appendChild(paginationDiv);
    }
}

function displayCombinations(combinations) {
    const combinationsDiv = document.getElementById('combinations');
    combinationsDiv.innerHTML = '<h3>Combinaisons:</h3>';
    if (combinations.length === 0) {
        combinationsDiv.innerHTML += '<p>Aucune combinaison trouvée.</p>';
    } else {
        const ul = document.createElement('ul');
        combinations.forEach(combo => {
            const li = document.createElement('li');
            combo.forEach((word, index) => {
                if (!removedWords.has(word)) {
                    const wordLink = document.createElement('a');
                    wordLink.href = '#';
                    wordLink.textContent = word;
                    wordLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        selectWord(word);
                    });
                    li.appendChild(wordLink);
                    if (index < combo.length - 1) {
                        li.appendChild(document.createTextNode(' + '));
                    }
                }
            });
            if (li.childNodes.length > 0) {
                ul.appendChild(li);
            }
        });
        combinationsDiv.appendChild(ul);
    }
}

function selectWord(word) {
    const normalizedWord = word.toUpperCase();
    let remainingBlocks = [...letterBlocks];
    let newBlocks = [];

    // Verrouiller les lettres du mot sélectionné
    for (let letter of normalizedWord) {
        const index = remainingBlocks.findIndex(block => block.letter === letter && !block.locked);
        if (index !== -1) {
            let block = remainingBlocks.splice(index, 1)[0];
            block.locked = true;
            newBlocks.push(block);
        }
    }

    // Ajouter les lettres restantes non verrouillées
    newBlocks.push(...remainingBlocks);

    letterBlocks = newBlocks;
    createLetterBlocks();
    updateSuggestions();
}

function removeWord(word) {
    removedWords.add(word);
    updateSuggestions();
}