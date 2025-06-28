const functions = require('firebase-functions');
const fetch = require('node-fetch');

exports.generateCyrusResponse = functions.https.onCall(async (data, context) => {
    const prompt = data.prompt;
    const history = data.history || [];
    const threadContext = data.threadContext || "";

    const GEMINI_API_KEY = functions.config().gemini.key; 

    if (!GEMINI_API_KEY) {
        throw new functions.https.HttpsError('failed-precondition', 'Gemini API Key is not configured in Firebase environment variables for the Cloud Function.');
    }

    const googleFormattedHistory = history.map(item => ({
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: item.content }]
    })).slice(-6); 

    let fullPrompt = threadContext ? `${threadContext}\n\nUser's latest reply: "${prompt}"\n\nYour next reply in the thread:` : prompt;
    googleFormattedHistory.push({ role: 'user', parts: [{ text: fullPrompt }] });

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