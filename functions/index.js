const functions = require('firebase-functions');
const fetch = require('node-fetch'); // For making HTTP requests to Google Gemini

exports.generateCyrusResponse = functions.https.onCall(async (data, context) => {
    const prompt = data.prompt;
    const history = data.history || []; // Pass chat history from the app
    const threadContext = data.threadContext || "";

    // IMPORTANT: Get API Key securely from Firebase's own environment variables
    const GEMINI_API_KEY = functions.config().gemini.key; 

    if (!GEMINI_API_KEY) {
        throw new functions.https.HttpsError('failed-precondition', 'Gemini API Key is not configured in Firebase environment variables for the Cloud Function.');
    }

    const googleFormattedHistory = history.map(item => ({
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: item.content }]
    })).slice(-6); // Limit history sent to AI

    let fullPrompt = threadContext ? `${threadContext}\n\nUser's latest reply: "${prompt}"\n\nYour next reply in the thread:` : prompt;
    googleFormattedHistory.push({ role: 'user', parts: [{ text: fullPrompt }] });

    // IMPORTANT: Corrected API Key reference here to GEMINI_API_KEY (removed extra _API)
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`; 

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: googleFormattedHistory })
        });

        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.error?.message || response.statusText || 'Unknown API error from Google.';
            console.error("Google AI Cloud Function Error:", errorMessage);
            throw new functions.https.HttpsError('internal', `API call failed: ${errorMessage}`);
        }

        const data = await response.json();
        const aiResponse = data.candidates[0].content.parts[0].text;
        return { text: aiResponse };

    } catch (error) {
        console.error("Cloud Function Fetch Error:", error);
        throw new functions.https.HttpsError('internal', `Function error: ${error.message}`);
    }
});