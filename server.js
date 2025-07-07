const express = require('express');
const path = require('path');
const app = express();

// Serve static files from the root directory of your Glitch project
// This makes index.html, manifest.json, service-worker.js, style.css, script.js, and icons accessible
app.use(express.static(path.join(__dirname, '/')));

// Send the main index.html file for any root requests
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
const listener = app.listen(process.env.PORT, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});