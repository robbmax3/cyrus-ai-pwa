const express = require('express');
const app = express();

// These lines serve your main files.
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});
app.get('/manifest.json', (req, res) => {
  res.sendFile(__dirname + '/manifest.json');
});
app.get('/service-worker.js', (req, res) => {
  res.sendFile(__dirname + '/service-worker.js');
});

// Starts the server
const listener = app.listen(process.env.PORT, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});