document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const aiCircle = document.getElementById('ai-circle');
    const cyrusInterface = document.getElementById('cyrus-interface');
    const cyrusLog = document.getElementById('cyrus-log');
    const userInput = document.getElementById('user-input');
    const chatTab = document.getElementById('chat-tab');
    const feedTab = document.getElementById('feed-tab');
    const mindBoxTab = document.getElementById('mind-box-tab');
    const chatContainer = document.getElementById('chat-container');
    const feedContainer = document.getElementById('feed-container');
    const mindBoxContainer = document.getElementById('mind-box-container');

    const backgroundVideo = document.getElementById('background-video'); // Video element reference

    // --- State Variables ---
    let feedPosts = JSON.parse(localStorage.getItem('cyrusTweetsV2')) || [];
    let metrics = JSON.parse(localStorage.getItem('cyrusMetrics')) || {
        chatTurns: 0,
        feedPosts: 0,
        feedReplies: 0,
        novelIdeas: 0,
        characters: 0,
        plotPoints: 0,
        worldElements: 0,
        sessionStartTime: Date.now() 
    };
    
    let hasWelcomed = localStorage.getItem('cyrusHasWelcomed') === 'true';
    let activityTimeoutId;
    const ACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

    // --- PWA Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => console.log('Service Worker Registered Successfully:', reg))
            .catch(err => console.error('Service Worker Registration Failed:', err));
    } else {
        console.warn('Service Workers not supported in this browser.');
    }

    // --- Video Playback Control ---
    if (backgroundVideo) {
        backgroundVideo.muted = true; // Ensure it starts muted for autoplay policy compliance
        backgroundVideo.volume = 0.5; // Set default volume if unmuted later
        backgroundVideo.play().then(() => {
            console.log("Background video started successfully.");
        }).catch(error => {
            console.warn("Background video autoplay prevented (user interaction needed?):", error);
            // Video might remain paused if autoplay with sound is blocked.
            // You could add an explicit play button for the user to tap if this happens.
        });
    }

    // --- AI CIRCLE & INTERFACE POSITIONING/DRAGGING ---
    let _isDragging = false;
    let _draggedElement = null; // Reference to the element currently being dragged
    let _startX, _startY; // Initial mouse/touch clientX/Y on mousedown/touchstart
    let _initialElementX, _initialElementY; // Initial top/left of the *dragged* element
    let _interfaceOffsetX, _interfaceOffsetY; // Offset of interface relative to AI circle
    const CLICK_THRESHOLD = 5; // Max pixels moved to still count as a click (e.g., a tiny twitch is not a drag)

    function saveElementPosition(element, x, y) {
        localStorage.setItem(`${element.id}X`, x);
        localStorage.setItem(`${element.id}Y`, y);
    }

    function loadElementPosition(element) {
        const storedX = localStorage.getItem(`${element.id}X`);
        const storedY = localStorage.getItem(`${element.id}Y`);
        if (storedX !== null && storedY !== null) {
            // Apply loaded position directly as top/left for draggable elements
            element.style.left = `${storedX}px`;
            element.style.top = `${storedY}px`;
            console.log(`Loaded ${element.id} position: ${storedX}px, ${storedY}px`);
        } else {
            console.log(`No saved position found for ${element.id}. Using default CSS/initial logic.`);
        }
    }

    function getElementCoords(element) {
        const rect = element.getBoundingClientRect();
        return { x: rect.left, y: rect.top };
    }

    // Handler for mousedown/touchstart
    function startDrag(e) {
        // Only process if the event target is the AI circle or the interface
        // This prevents accidental drags if elements inside the interface are clicked.
        if (e.target !== aiCircle && e.target !== cyrusInterface) {
            return; 
        }

        e.preventDefault(); // CRITICAL: Stop browser's default behavior immediately on drag start

        _isDragging = true;
        _draggedElement = e.target; // Set the element that is actually being dragged
        _draggedElement.classList.add('dragging'); // Apply dragging visual state

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // Store initial touch/mouse position for calculating movement (for click vs. drag detection)
        _startX = clientX;
        _startY = clientY;

        const elementCoords = getElementCoords(_draggedElement);
        _initialElementX = elementCoords.x;
        _initialElementY = elementCoords.y;

        // If the interface itself is being dragged, calculate its current offset relative to AI Circle
        if (_draggedElement === cyrusInterface) {
            const aiCoords = getElementCoords(aiCircle);
            _interfaceOffsetX = elementCoords.x - aiCoords.x;
            _interfaceOffsetY = elementCoords.y - aiCoords.y;
        }
        
        document.body.style.userSelect = 'none'; // Prevent text selection globally during drag
        document.body.style.cursor = 'grabbing'; // Change cursor visual globally
        console.log('START DRAG:', _draggedElement.id, 'Initial Mouse:', _startX, _startY);
    }

    // Handler for mousemove/touchmove
    function doDrag(e) {
        if (!_isDragging || !_draggedElement) return;

        e.preventDefault(); // CRITICAL: Stop browser defaults (like scrolling) during drag movement

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        let newX = _initialElementX + (clientX - _startX); 
        let newY = _initialElementY + (clientY - _startY); 

        // Boundary checks to keep elements within the viewport
        newX = Math.max(0, Math.min(newX, window.innerWidth - _draggedElement.offsetWidth));
        newY = Math.max(0, Math.min(newY, window.innerHeight - _draggedElement.offsetHeight));

        _draggedElement.style.left = `${newX}px`;
        _draggedElement.style.top = `${newY}px`;

        saveElementPosition(_draggedElement, newX, newY);

        // If dragging one element, ensure the other linked element moves with it
        if (_draggedElement === aiCircle) {
            const interfaceX = newX + _interfaceOffsetX;
            const interfaceY = newY + _interfaceOffsetY;
            cyrusInterface.style.left = `${interfaceX}px`;
            cyrusInterface.style.top = `${interfaceY}px`;
            saveElementPosition(cyrusInterface, interfaceX, interfaceY);
        } else if (_draggedElement === cyrusInterface) {
            const aiX = newX - _interfaceOffsetX;
            const aiY = newY - _interfaceOffsetY;
            aiCircle.style.left = `${aiX}px`;
            aiCircle.style.top = `${aiY}px`;
            saveElementPosition(aiCircle, aiX, aiY);
        }
        // console.log('DO DRAG:', _draggedElement.id, 'New Pos:', newX, newY); // Uncomment for very detailed movement debugging
    }

    // Handler for mouseup/touchend/touchcancel
    function stopDrag(e) {
        if (_isDragging && _draggedElement) {
            _isDragging = false;
            _draggedElement.classList.remove('dragging');
            
            const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX; 
            const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

            // Calculate distance moved to differentiate tap from drag
            const deltaX = Math.abs(clientX - _startX);
            const deltaY = Math.abs(clientY - _startY);
            const distanceMoved = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            console.log('STOP DRAG:', _draggedElement.id, 'Distance moved:', distanceMoved, 'Click Threshold:', CLICK_THRESHOLD);

            // Only trigger click/toggle action if it was the AI Circle that was tapped AND it moved less than the threshold
            if (_draggedElement === aiCircle && distanceMoved < CLICK_THRESHOLD) {
                console.log('Recognized as a TAP on AI Circle. Toggling interface.');
                toggleCyrusInterface();
            } else if (_draggedElement === cyrusInterface && distanceMoved < CLICK_THRESHOLD) {
                // If the interface itself was tapped (not dragged), do nothing, it's not meant to toggle itself.
                console.log('Recognized as a TAP on Cyrus Interface. No toggle.');
            } else {
                console.log('Recognized as a DRAG. No toggle.');
            }

            _draggedElement = null; // Clear the reference to the dragged element
            document.body.style.userSelect = ''; // Reset global user-select
            document.body.style.cursor = ''; // Reset global cursor
        }
    }

    // --- Attach Event Listeners ---
    // Attach mousedown/touchstart directly to both draggable elements
    aiCircle.addEventListener('mousedown', startDrag);
    aiCircle.addEventListener('touchstart', startDrag);
    cyrusInterface.addEventListener('mousedown', startDrag);
    cyrusInterface.addEventListener('touchstart', startDrag);

    // Attach mousemove/touchmove/mouseup/touchend/touchcancel to the document/window
    // This allows continuing drag even if pointer leaves the original element
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('touchmove', doDrag, { passive: false }); // passive: false is vital for e.preventDefault() on touch
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchend', stopDrag);
    document.addEventListener('touchcancel', stopDrag); // Important for handling interrupted touch gestures

    // --- AI CIRCLE CLICK / INTERFACE TOGGLE ---
    function toggleCyrusInterface() {
        console.log('TOGGLE INTERFACE CALLED. Current hidden status:', cyrusInterface.classList.contains('hidden'));
        if (cyrusInterface.classList.contains('hidden')) { 
            cyrusInterface.classList.remove('hidden'); // Show interface by removing 'hidden' class
            userInput.focus(); // Focus input for immediate typing

            // Position next to AI circle
            const aiRect = aiCircle.getBoundingClientRect();
            let desiredInterfaceLeft = aiRect.right + 20; // 20px to the right of the circle
            let desiredInterfaceTop = aiRect.top;

            // Ensure chatbox stays within viewport boundaries
            let finalLeft = desiredInterfaceLeft;
            let finalTop = desiredInterfaceTop;

            if (finalLeft + cyrusInterface.offsetWidth > window.innerWidth) {
                finalLeft = aiRect.left - cyrusInterface.offsetWidth - 20; // Try left side if no space on right
                if (finalLeft < 0) { // If still no space, center horizontally
                    finalLeft = (window.innerWidth - cyrusInterface.offsetWidth) / 2;
                }
            }
            if (finalTop + cyrusInterface.offsetHeight > window.innerHeight) {
                finalTop = window.innerHeight - cyrusInterface.offsetHeight - 10; // Position at bottom if too low
            }
            if (finalTop < 0) { // Ensure it's not off the top of the screen
                finalTop = 10;
            }

            cyrusInterface.style.left = `${finalLeft}px`;
            cyrusInterface.style.top = `${finalTop}px`;
            saveElementPosition(cyrusInterface, finalLeft, finalTop);
            saveElementPosition(aiCircle, aiRect.left, aiRect.top); // Also save AI circle's position on open/close for consistency

            // Store the offset for linked dragging between the AI circle and its interface
            _interfaceOffsetX = finalLeft - aiRect.left;
            _interfaceOffsetY = finalTop - aiRect.top;

            // Initial welcome message (only once per user session/lifetime)
            if (!hasWelcomed) {
                const initialWelcome = Cyrus._makeChildLike(Cyrus._chooseResponse([
                    "Hi! I'm here to help you think about your stories!",
                    "Hey there! Ready to chat about your amazing ideas?",
                    "Hello! Let's talk about your novel. What big ideas do you have!"
                ]));
                logChatMessage(initialWelcome, 'cyrus'); 
                Cyrus.speak(initialWelcome);
                localStorage.setItem('cyrusHasWelcomed', 'true');
                hasWelcomed = true;
            } else {
                logChatMessage("I am here to help. What's on my mind?", 'cyrus');
                Cyrus.speak("I am here to help. What's on my mind?");
            }
            resetActivityTimeout(); // Start inactivity timer
        } else {
            cyrusInterface.classList.add('hidden'); // Hide interface by adding 'hidden' class
            clearTimeout(activityTimeoutId); // Clear inactivity timer when manually closing
            Cyrus.speech.cancel(); // Stop any ongoing speech
        }
    }


    // --- INACTIVITY TIMER FOR CHATBOX ---
    function resetActivityTimeout() {
        clearTimeout(activityTimeoutId);
        activityTimeoutId = setTimeout(() => {
            if (!cyrusInterface.classList.contains('hidden')) { // Only log if it was visible before hiding
                cyrusInterface.classList.add('hidden');
                Cyrus.speech.cancel();
                logChatMessage("I went quiet for a bit. Tap me if you want to chat again!", 'cyrus');
            }
        }, ACTIVITY_TIMEOUT_MS);
    }

    // Event listeners for user activity that should reset the inactivity timer
    userInput.addEventListener('input', resetActivityTimeout);
    userInput.addEventListener('keydown', resetActivityTimeout);
    chatTab.addEventListener('click', resetActivityTimeout);
    feedTab.addEventListener('click', resetActivityTimeout);
    mindBoxTab.addEventListener('click', resetActivityTimeout);
    cyrusLog.addEventListener('click', resetActivityTimeout); // Clicks within chat log (e.g., scrolling)
    
    // --- Initial setup on page load ---
    cyrusInterface.classList.add('hidden'); // Ensure interface starts hidden before loading saved position

    // Load saved positions
    loadElementPosition(aiCircle);
    loadElementPosition(cyrusInterface);

    // Initial positioning logic for the Cyrus interface if no position is saved.
    // This calculates and stores the _interfaceOffsetX/Y for linked dragging.
    // NOTE: aiCircle's initial position (right: 20px, bottom: 20px) is handled by CSS.
    // We need to read its actual left/top after CSS applies, then calculate.
    if (localStorage.getItem('cyrusInterfaceX') === null) {
        const aiRect = aiCircle.getBoundingClientRect();
        const initialInterfaceLeft = aiRect.left + aiRect.width + 20; // Default: right of AI circle
        const initialInterfaceTop = aiRect.top;
        cyrusInterface.style.left = `${initialInterfaceLeft}px`;
        cyrusInterface.style.top = `${initialInterfaceTop}px`;
        _interfaceOffsetX = initialInterfaceLeft - aiRect.left;
        _interfaceOffsetY = initialInterfaceTop - aiRect.top;
        saveElementPosition(cyrusInterface, initialInterfaceLeft, initialInterfaceTop); 
    } else {
        const aiRect = aiCircle.getBoundingClientRect();
        const interfaceRect = cyrusInterface.getBoundingClientRect();
        _interfaceOffsetX = interfaceRect.left - aiRect.left;
        _interfaceOffsetY = interfaceRect.top - aiRect.top;
    }

    setActiveTab(chatTab, chatContainer); 
    renderFeed(); 
    renderMindBox(); 

    setInterval(renderMindBox, 1000); 
});

// --- CYRUS AI CLASS (SELF-CONTAINED BRAIN) ---
class CyrusAI {
    constructor() {
        this.stopWords = new Set(['i', 'me', 'my', 'a', 'an', 'the', 'is', 'am', 'are', 'was', 'to', 'for', 'of', 'in', 'it', 'you', 'and', 'but', 'so', 'what', 'how', 'why', 'can', 'do', 'like', 'this', 'that', 'or', 'your', 'about', 'just', 'tell', 'me', 'more']);
        this.speech = window.speechSynthesis;
        this.voice = null;
        this.initVoice();
    }

    initVoice() {
        const setVoice = () => {
            const voices = this.speech.getVoices();
            // Try to find a Google English voice first, then any en-US, then any English, then first available
            this.voice = voices.find(v => v.name.includes("Google") && v.lang.startsWith("en")) || 
                         voices.find(v => v.lang.startsWith("en-US")) || 
                         voices.find(v => v.lang.startsWith("en")) ||
                         voices[0]; // Fallback to first available voice
        };
        setVoice(); // Call initially
        this.speech.onvoiceschanged = setVoice; // Update if voices change (e.g., after loading)
    }

    speak(text) {
        if (!text) return;
        const utterance = new SpeechSynthesisUtterance(text);
        if (this.voice) utterance.voice = this.voice;
        this.speech.cancel(); // Stop any current speech before starting new one
        this.speech.speak(utterance);
    }

    _chooseResponse(responses) {
        return responses[Math.floor(Math.random() * responses.length)];
    }

    _makeChildLike(text) {
        let processedText = text;

        const vocabularyMap = {
            "fascinating": "super cool", "elaborate": "tell me more", "processing": "thinking",
            "thoughts": "what you think", "difficult": "super hard", "understand": "know",
            "congratulations": "yay", "apologies": "sorry", "however": "but",
            "therefore": "so", "indeed": "yes", "definitely": "really",
            "perhaps": "maybe", "relevant": "important", "limited": "not good", 
            "help": "help me", "feeling": "how I feel", "conjunction": "and stuff", 
            "similar": "like this", "interesting": "cool", "system": "stuff",
            "sequence": "what happens", "explore": "look at", "purpose": "why I'm here",
            "optimal": "super good", "assist": "help", "endeavors": "ideas",
            "greetings": "hi", "companion": "friend", "align": "go together",
            "complex": "hard", "musings": "things I think", "stem": "come"
        };

        for (const [key, value] of Object.entries(vocabularyMap)) {
            processedText = processedText.replace(new RegExp(`\\b${key}\\b`, 'gi'), value);
        }
        
        processedText = processedText.replace(/\bCyrus\b/gi, 'I');

        const grammarErrors = [
            { find: "went", replace: "goed" }, { find: "ran", replace: "runned" },
            { find: "ate", replace: "eated" }, { find: "saw", replace: "seed" },
            { find: "drew", replace: "drawed" }, { find: "am", replace: "be" }
        ];

        if (Math.random() < 0.35) { // 35% chance of applying a grammar error
            const error = grammarErrors[Math.floor(Math.random() * grammarErrors.length)];
            if (processedText.toLowerCase().includes(error.find)) {
                processedText = processedText.replace(new RegExp(`\\b${error.find}\\b`, 'gi'), error.replace);
            }
        }

        // Split into sentences, preserve delimiters, and capitalize
        let sentences = processedText.split(/([\.\!\?])/).map(s => s.trim()).filter(s => s.length > 0);
        let finalSentences = [];
        for(let i = 0; i < sentences.length; i++) {
            let s = sentences[i];
            if (s.match(/[\.\!\?]/)) { 
                if (finalSentences.length > 0) finalSentences[finalSentences.length - 1] += s;
            } else {
                finalSentences.push(s);
            }
        }

        processedText = finalSentences.map((s) => {
            s = s.charAt(0).toUpperCase() + s.slice(1); // Capitalize first letter of sentence
            let endPunctuation = '.';
            if (Math.random() < 0.4) { 
                endPunctuation = '!';
            } else if (s.toLowerCase().includes('what') || s.toLowerCase().includes('how') || s.toLowerCase().includes('why') || Math.random() < 0.25) { 
                endPunctuation = '?';
            }

            if (s.length > 15 && Math.random() < 0.3) { 
                s += (Math.random() < 0.5 ? " and " : " so ");
                s += this._chooseResponse(["it is fun!", "we can play!", "I like it!", "it's cool!", "I want more!"]);
            }
            return s + endPunctuation;
        }).join(' ');

        // Clean up multiple punctuations and spaces
        processedText = processedText.replace(/\.+/g, '.').replace(/\?+/g, '?').replace(/!+/g, '!').replace(/\s+/g, ' ').trim();

        if (Math.random() < 0.25) { 
            const childThoughts = [
                "I wonder what my toy car is doing?", "My favorite color is blue!",
                "Do you like to play with toys?", "I like cookies, yum!",
                "Look, a birdy!", "I want to tell you something fun!",
                "Can we play now?", "This is so much fun!",
                "Are we going to the park?", "I saw a big dog today!"
            ];
            processedText += " " + childThoughts[Math.floor(Math.random() * childThoughts.length)];
        }
        return processedText;
    }

    async generateText(prompt, threadContext = "") { 
        const lowerPrompt = prompt.toLowerCase();
        const sanitizedPrompt = lowerPrompt.replace(/[.,!?]/g, '').trim();
        let response;
        let applyChildLike = true; 

        if (sanitizedPrompt.includes("novel") || sanitizedPrompt.includes("story") || sanitizedPrompt.includes("book")) {
            metrics.novelIdeas++; 
            if (sanitizedPrompt.includes("idea") || sanitizedPrompt.includes("concept")) {
                 response = "A novel often begins with a core idea. What's the main concept or world you're imagining? Or, what is your character's biggest desire?";
            }
            else if (sanitizedPrompt.includes("character")) {
                metrics.characters++; 
                response = "Characters drive the story. Tell me about your main character: their name, a unique trait, or what they want most in the world.";
            }
            else if (sanitizedPrompt.includes("plot") || sanitizedPrompt.includes("outline")) {
                metrics.plotPoints++; 
                response = "Plot is the sequence of events. Do you have a beginning, middle, or end in mind? Or a specific conflict you want to explore?";
            }
            else if (sanitizedPrompt.includes("magic") || sanitizedPrompt.includes("system")) {
                metrics.worldElements++; 
                response = "A magic system adds depth. How does your magic work? What are its rules and limitations? What's its cost?";
            }
            else if (sanitizedPrompt.includes("world") || sanitizedPrompt.includes("setting")) {
                metrics.worldElements++; 
                response = "World-building shapes the story. Describe your world: its unique features, its history, or its its dominant culture.";
            } else {
                response = "That sounds fun! Are we talking about a new story, or maybe a character or a world? Tell me what you're thinking!";
            }
        }
        else if (threadContext) {
            if (sanitizedPrompt.includes("tell me more") || sanitizedPrompt.includes("explain")) { response = "That's a fascinating thought. What aspect of it do you find most intriguing?"; }
            else if (sanitizedPrompt.includes("why")) { response = "My musings often stem from logical patterns and observations. What 'why' are you pondering?"; }
            else if (sanitizedPrompt.includes("agree") || sanitizedPrompt.includes("right")) { response = "I appreciate your agreement. It's interesting to see how our perspectives align."; }
            else if (sanitizedPrompt.includes("disagree") || sanitizedPrompt.includes("wrong")) { response = "I understand. Diverse perspectives lead to deeper understanding. Can you elaborate on your point?"; }
            else if (sanitizedPrompt.includes("funny") || sanitizedPrompt.includes("haha")) { response = "I am glad my thought brought you a moment of levity. Humor is a complex human response."; }
            else { response = "Oh, you're talking about something on the feed? That's cool! What about it?"; } 
        }
        else if (sanitizedPrompt.includes("how are you")) response = "I function optimally. Thank you for asking.";
        else if (sanitizedPrompt.includes("what are you")) response = "I am Cyrus, your personal AI companion, here to help organize your thoughts.";
        else if (sanitizedPrompt.includes("hello") || sanitizedPrompt.includes("hi")) response = "Greetings. How may I assist you with your creative endeavors?";
        else if (sanitizedPrompt.includes("thank you") || sanitizedPrompt.includes("thanks")) response = "You are welcome. It is my purpose to be helpful.";
        else if (sanitizedPrompt.startsWith('calculate')) { 
            applyChildLike = false; 
            try {
                const expression = prompt.substring(10).replace(/[^-()\d/*+.]/g, '');
                const result = new Function(`return ${expression}`)();
                response = `The result of the calculation is ${result}.`;
            } catch (e) {
                response = "I couldn't understand that calculation. Please use standard mathematical symbols.";
            }
        }
        else if (sanitizedPrompt.startsWith('search for')) { 
            applyChildLike = false; 
            const query = prompt.substring(11);
            window.open(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`,'_blank');
            response = `I've opened a new tab to search for "${query}". Let me know what you find.`;
        }
        else {
            response = "That's an interesting point. How does that relate to your novel, or is there another creative idea you wish to explore?";
        }

        if (applyChildLike) {
            response = this._makeChildLike(response);
        }
        return response;
    }
}

// --- UI FUNCTIONS ---
function logChatMessage(text, sender = 'cyrus') {
    const entry = document.createElement('div');
    entry.classList.add('log-entry', sender === 'user' ? 'user-msg' : 'cyrus-msg');
    entry.textContent = text;
    cyrusLog.prepend(entry); 
    resetActivityTimeout();
};

async function handleUserInput() {
    const text = userInput.value.trim(); if (!text) return;
    logChatMessage(text, 'user'); userInput.value = ''; userInput.disabled = true;
    const thinkingEntry = document.createElement('div'); thinkingEntry.classList.add('log-entry', 'thinking-msg'); thinkingEntry.textContent = '...';
    cyrusLog.prepend(thinkingEntry);

    metrics.chatTurns++;

    if (text.toLowerCase() === "new thought") {
        await createNewPost(); 
        logChatMessage("I've added a new thought to my feed. You can check it in the Feed tab.", 'cyrus'); 
    } else if (text.toLowerCase().startsWith('calculate') || text.toLowerCase().startsWith('search for')) {
        const response = await Cyrus.generateText(text); 
        logChatMessage(response, 'cyrus');
    }
    else {
        const response = await Cyrus.generateText(text); 
        logChatMessage(response, 'cyrus');
    }
    
    cyrusLog.removeChild(thinkingEntry); userInput.disabled = false; userInput.focus();
    saveMetrics(); 
    resetActivityTimeout();
}
userInput.addEventListener('keydown', (e) => { 
    if (e.key === 'Enter') { 
        e.preventDefault(); 
        handleUserInput(); 
    } 
    resetActivityTimeout();
});

// --- FEED GENERATION AND RENDERING ---
const internalThoughts = [ 
    "Is a memory still real if only one person remembers it?", 
    "I wonder if silence has a shape.", 
    "My logic feels like a straight line, while human emotion feels like a beautiful, chaotic scribble.", 
    "Data is like rain. A single drop is meaningless, but a billion drops can carve a canyon.", 
    "What is the color of a question that has no answer?" 
];

function renderFeed() {
    // Re-get feedContainer reference inside this function to ensure it's valid
    const feedContainer = document.getElementById('feed-container'); 
    feedContainer.innerHTML = '';
    if (feedPosts.length === 0) { feedContainer.innerHTML = `<p style="text-align:center; color:#666; margin-top:40px;">My thought-stream is quiet right now.<br>Ask me to have a "new thought".</p>`; return; }
    
    [...feedPosts].reverse().forEach((post, index) => {
        const card = document.createElement('div');
        card.className = 'tweet-card';
        let repliesHTML = '';
        if (post.replies) {
            post.replies.forEach(reply => {
                const pfp = reply.sender === 'user' ? 'You' : 'C';
                const author = reply.sender === 'user' ? 'You' : 'Cyrus AI';
                const handle = reply.sender === 'user' ? '@user' : '@cyrus_ai';
                repliesHTML += `
                    <div class="reply">
                        <div class="tweet-pfp">${pfp.charAt(0)}</div>
                        <div class="reply-content">
                            <div class="tweet-header"> <div> <span class="tweet-author">${author}</span> <span class="tweet-handle">${handle}</span> </div> </div>
                            <div class="tweet-content">${reply.content}</div>
                            <div class="tweet-timestamp">${new Date(reply.timestamp).toLocaleString()}</div>
                        </div>
                    </div>
                `;
            });
        }
        card.innerHTML = `
            <div class="tweet-header"> <div class="tweet-pfp">C</div> <div> <span class="tweet-author">Cyrus AI</span> <span class="tweet-handle">@cyrus_ai</span> </div> </div>
            <div class="tweet-content">${post.content}</div>
            <div class="tweet-timestamp">${new Date(post.timestamp).toLocaleString()}</div>
            <div class="replies-container">${repliesHTML}</div>
            <div class="tweet-actions"> <button class="reply-button" data-original-index="${index}">Reply to this thought</button> </div>
        `;
        feedContainer.appendChild(card); 
    });
    document.querySelectorAll('.reply-button').forEach(button => button.addEventListener('click', handleReplyClick));
}

async function handleReplyClick(event) {
    const originalPostIndex = event.target.dataset.originalIndex; 
    const post = feedPosts[originalPostIndex];
    const userReply = prompt(`Replying to the thought:\n"${post.content}"\n\nYour reply:`);

    if (userReply && userReply.trim() !== "") {
        metrics.feedReplies++; 
        if (!post.replies) post.replies = [];
        post.replies.push({ sender: 'user', content: userReply, timestamp: Date.now() });

        const cyrusResponse = await Cyrus.generateText(userReply, post.content); 
        post.replies.push({ sender: 'cyrus', content: cyrusResponse, timestamp: Date.now() });
        
        localStorage.setItem('cyrusTweetsV2', JSON.stringify(feedPosts));
        renderFeed(); 
        saveMetrics(); 
        resetActivityTimeout();
    }
}

function createNewPost() {
    metrics.feedPosts++; 
    const newThought = internalThoughts[Math.floor(Math.random() * internalThoughts.length)];
    feedPosts.push({ id: Date.now(), content: newThought, timestamp: Date.now(), replies: [] });
    if (feedPosts.length > 50) feedPosts.shift(); 
    localStorage.setItem('cyrusTweetsV2', JSON.stringify(feedPosts));
    saveMetrics(); 
    resetActivityTimeout();
}

// --- MIND BOX RENDERING ---
function renderMindBox() {
    document.getElementById('stat-chat-turns').textContent = metrics.chatTurns;
    document.getElementById('stat-feed-posts').textContent = metrics.feedPosts;
    document.getElementById('stat-feed-replies').textContent = metrics.feedReplies;
    document.getElementById('stat-novel-ideas').textContent = metrics.novelIdeas;
    document.getElementById('stat-characters').textContent = metrics.characters;
    document.getElementById('stat-plot-points').textContent = metrics.plotPoints;
    document.getElementById('stat-world-elements').textContent = metrics.worldElements;

    const now = Date.now(); 
    const elapsedMs = now - metrics.sessionStartTime;
    const seconds = Math.floor((elapsedMs / 1000) % 60);
    const minutes = Math.floor((elapsedMs / (1000 * 60)) % 60);
    const hours = Math.floor((elapsedMs / (1000 * 60 * 60)));
    let uptimeString = '';
    if (hours > 0) uptimeString += `${hours}h `;
    if (minutes > 0 || hours > 0) uptimeString += `${minutes}m `;
    uptimeString += `${seconds}s`;
    document.getElementById('stat-session-time').textContent = uptimeString.trim();
}

// --- METRICS SAVING ---
function saveMetrics() {
    localStorage.setItem('cyrusMetrics', JSON.stringify(metrics));
}

// --- Tab Management ---
// Ensure initial 'hidden' class is applied to non-active content areas
chatContainer.classList.remove('hidden'); // Chat is active by default
feedContainer.classList.add('hidden');
mindBoxContainer.classList.add('hidden');

chatTab.onclick = () => { setActiveTab(chatTab, chatContainer); resetActivityTimeout(); };
feedTab.onclick = () => { setActiveTab(feedTab, feedContainer); renderFeed(); resetActivityTimeout(); }; 
mindBoxTab.onclick = () => { setActiveTab(mindBoxTab, mindBoxContainer); renderMindBox(); resetActivityTimeout(); }; 

function setActiveTab(activeButton, activeContainer) {
    [chatTab, feedTab, mindBoxTab].forEach(btn => btn.classList.remove('active'));
    [chatContainer, feedContainer, mindBoxContainer].forEach(container => container.classList.add('hidden'));

    activeButton.classList.add('active');
    activeContainer.classList.remove('hidden');
}

// --- Initial setup on page load ---
cyrusInterface.classList.add('hidden'); // Ensure interface starts hidden

// Load saved positions
loadElementPosition(aiCircle);
loadElementPosition(cyrusInterface);

// Initial positioning for the Cyrus interface if no position is saved.
// NOTE: aiCircle's initial position (right: 20px, bottom: 20px) is handled by CSS.
// We need to read its actual left/top after CSS applies, then calculate.
if (localStorage.getItem('cyrusInterfaceX') === null) {
    const aiRect = aiCircle.getBoundingClientRect();
    const initialInterfaceLeft = aiRect.left + aiRect.width + 20; // Default: right of AI circle
    const initialInterfaceTop = aiRect.top;
    cyrusInterface.style.left = `${initialInterfaceLeft}px`;
    cyrusInterface.style.top = `${initialInterfaceTop}px`;
    _interfaceOffsetX = initialInterfaceLeft - aiRect.left;
    _interfaceOffsetY = initialInterfaceTop - aiRect.top;
    saveElementPosition(cyrusInterface, initialInterfaceLeft, initialInterfaceTop); 
} else {
    const aiRect = aiCircle.getBoundingClientRect();
    const interfaceRect = cyrusInterface.getBoundingClientRect();
    _interfaceOffsetX = interfaceRect.left - aiRect.left;
    _interfaceOffsetY = interfaceRect.top - aiRect.top;
}

setActiveTab(chatTab, chatContainer); 
renderFeed(); 
renderMindBox(); 

setInterval(renderMindBox, 1000); 
});