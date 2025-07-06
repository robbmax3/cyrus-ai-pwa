const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000; // Use port 3000 by default, or an environment variable

// Serve static files from the current directory (where server.js resides)
// This makes index.html, manifest.json, service-worker.js, and the icons folder accessible
app.use(express.static(__dirname));

// Send index.html for the root path specifically
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Cyrus AI web server running on http://localhost:${port}`);
  console.log('Access your AI by opening this URL in your browser.');
});