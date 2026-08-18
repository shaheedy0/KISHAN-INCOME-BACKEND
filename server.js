// 1. Bring in the tools we downloaded
const express = require('express');
require('dotenv').config(); // This loads your secret .env passwords

// 2. Start the Express application
const app = express();
require('./cron'); // This wakes up your automated profit robot

// 3. Allow the server to understand data sent to it (like user registrations)
app.use(express.json());

// 4. Create a simple test route to make sure it works
app.get('/', (req, res) => {
    res.send('Welcome to the Kishan Income SACCO Backend API! The server is running securely.');
});

// 5. Tell the server to listen for traffic on a specific port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    app.use('/api/auth', require('./auth'));
    app.use('/api/user', require('./protected'));
    app.use('/api/investments', require('./investments'));
    app.use('/api/momo', require('./mobilemoney'));
    app.use('/api/referrals', require('./referrals'));
    console.log(`Server is running! You can view it at http://localhost:${PORT}`);
});