// 1. Bring in the tools
const express = require('express');
const cors = require('cors'); // CORS tool
require('dotenv').config(); 

const db = require('./db'); 

// 2. Start the Express application
const app = express();

// 3. SECURITY CLEARANCE: Allow frontend to talk to backend (Must be first!)
app.use(cors());
app.use(express.json());

// 4. Automated robot
require('./cron'); 

// Admin PIN Verification Route
app.post('/api/admin/verify-pin', (req, res) => {
    const { admin_pin } = req.body;
    
    // Set your desired admin password here
    const MY_SECRET_PASSWORD = "SYusufK01."; 

    if (admin_pin === MY_SECRET_PASSWORD) {
        return res.status(200).json({ message: "Access Granted" });
    } else {
        return res.status(401).json({ message: "Invalid Admin Password!" });
    }
});

// ==========================================
//          ADMIN DATA ROUTES
// ==========================================

// 1. Get Admin Statistics
app.get('/api/admin/stats', (req, res) => {
    // Assuming your database connection is named 'db'. Change it if you use 'pool' or something else.
    const query = `SELECT COUNT(*) as total_users, SUM(total_deposits) as total_deposits FROM users`;
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ message: "Database error fetching stats." });
        
        const stats = results[0] || {};
        res.status(200).json({
            total_users: stats.total_users || 0,
            total_deposits: stats.total_deposits || 0,
            pending_withdrawals: [] // We can set up the actual withdrawals table later
        });
    });
});

// 2. Get All Members Directory
app.get('/api/admin/members/all', (req, res) => {
    const query = `SELECT id, phone_number, full_names, wallet_balance, total_deposits as total_invested, created_at FROM users ORDER BY created_at DESC`;
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ message: "Database error fetching members." });
        res.status(200).json({ members: results });
    });
});

// 3. Manual Balance Adjustment
app.post('/api/admin/balance/adjust', (req, res) => {
    const { phone_number, amount } = req.body;
    
    if (!phone_number || amount === undefined) {
        return res.status(400).json({ message: "Phone number and amount are required." });
    }

    const query = `UPDATE users SET wallet_balance = wallet_balance + ? WHERE phone_number = ?`;
    
    db.query(query, [Number(amount), phone_number], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error updating balance." });
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "User not found!" });
        }
        
        res.status(200).json({ message: `Successfully added ${amount} UGX to ${phone_number}` });
    });
});

// 5. MAIN API ROUTES
app.use('/api/auth', require('./auth'));
app.use('/api/user', require('./protected'));
app.use('/api/investments', require('./investments'));
app.use('/api/momo', require('./mobilemoney'));
app.use('/api/referrals', require('./referrals'));

// 6. Test Route
app.get('/', (req, res) => {
    res.send('Welcome to the Kishan Income SACCO Backend API! The server is running securely.');
});

// 7. Get the current background photo for the website
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

// 8. Allow Admin to change the background photo URL
app.post('/api/admin/config/background', async (req, res) => {
    const { new_bg_url } = req.body;
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS site_settings (
                setting_key VARCHAR(50) PRIMARY KEY,
                setting_value TEXT
            )
        `);
        await db.query(
            "INSERT INTO site_settings (setting_key, setting_value) VALUES ('bg_image_url', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
            [new_bg_url, new_bg_url]
        );
        res.json({ message: "Background image successfully updated!" });
    } catch (err) {
        console.error("Database error:", err);
        res.status(500).json({ error: "Failed to update background image" });
    }
});

// 9. Tell the server to listen for traffic
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running! You can view it at http://localhost:${PORT}`);
});