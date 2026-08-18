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
// 1. Get the current background photo for the website
app.get('/api/config/public', async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT setting_value FROM site_settings WHERE setting_key = 'bg_image_url'"
        );
        const bgUrl = rows.length > 0 ? rows[0].setting_value : 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854';
        res.json({ bg_image_url: bgUrl, version: "Kishan.2026.1.9.5" });
    } catch (err) {
        res.status(500).json({ error: "Failed to load site configuration" });
    }
});

// 2. Allow Admin to change the background photo URL
app.post('/api/admin/config/background', async (req, res) => {
    const { new_bg_url } = req.body;
    try {
        await db.query(
            "INSERT INTO site_settings (setting_key, setting_value) VALUES ('bg_image_url', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
            [new_bg_url, new_bg_url]
        );
        res.json({ message: "Background image successfully updated!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to update background image" });
    }
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