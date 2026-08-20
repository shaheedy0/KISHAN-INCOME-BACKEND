// 1. Bring in the tools
const express = require('express');
const cors = require('cors'); // CORS tool
require('dotenv').config(); 

const pool = require('./db'); 

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
app.get('/api/admin/stats', async (req, res) => {
    try {
        const [results] = await pool.query(`SELECT COUNT(*) as total_users FROM users`);
        const stats = results[0] || {};
        res.status(200).json({
            total_users: stats.total_users || 0,
            total_deposits: 0,
            pending_withdrawals: []
        });
    } catch (err) {
        console.error("Stats Error:", err);
        res.status(500).json({ message: "Database error fetching stats." });
    }
});

// 2. Get All Members Directory
app.get('/api/admin/members/all', async (req, res) => {
    try {
        const [results] = await pool.query(`SELECT * FROM users ORDER BY id DESC`);
        res.status(200).json({ members: results || [] });
    } catch (err) {
        console.error("Members Error:", err);
        res.status(500).json({ message: "Database error fetching members." });
    }
});

// 3. Manual Balance Adjustment
app.post('/api/admin/balance/adjust', async (req, res) => {
    const { phone_number, amount } = req.body;
    
    if (!phone_number || amount === undefined) {
        return res.status(400).json({ message: "Phone number and amount are required." });
    }

    try {
        const [result] = await pool.query(
            `UPDATE users SET wallet_balance = wallet_balance + ? WHERE phone_number = ?`,
            [Number(amount), phone_number]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "User not found!" });
        }
        
        res.status(200).json({ message: `Successfully updated balance for ${phone_number}` });
    } catch (err) {
        console.error("Balance Adjustment Error:", err);
        res.status(500).json({ message: "Database error updating balance." });
    }
});

// ==========================================
//        ADMIN WITHDRAWAL MANAGEMENT
// ==========================================

// Fetch all pending withdrawal requests
app.get('/api/admin/withdrawals/pending', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT w.id, w.amount, w.status, w.created_at, u.phone_number, u.full_names 
             FROM withdrawals w 
             JOIN users u ON w.user_id = u.id 
             WHERE w.status = 'pending' 
             ORDER BY w.created_at ASC`
        );
        res.status(200).json({ withdrawals: rows });
    } catch (err) {
        console.error("Pending Withdrawals Error:", err);
        res.status(500).json({ message: "Database error fetching withdrawals." });
    }
});

// Approve or Reject a Withdrawal
app.post('/api/admin/withdrawals/action', async (req, res) => {
    const { withdrawal_id, action } = req.body; // action: 'approve' or 'reject'

    if (!withdrawal_id || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ message: "Invalid withdrawal ID or action." });
    }

    try {
        const [rows] = await pool.query(`SELECT user_id, amount, status FROM withdrawals WHERE id = ?`, [withdrawal_id]);
        if (rows.length === 0) return res.status(404).json({ message: "Withdrawal request not found." });

        const request = rows[0];
        if (request.status !== 'pending') {
            return res.status(400).json({ message: "This request has already been processed." });
        }

        if (action === 'approve') {
            await pool.query(`UPDATE withdrawals SET status = 'approved' WHERE id = ?`, [withdrawal_id]);
        } else if (action === 'reject') {
            // Refund the deducted amount back to user's wallet
            await pool.query(`UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?`, [request.amount, request.user_id]);
            await pool.query(`UPDATE withdrawals SET status = 'rejected' WHERE id = ?`, [withdrawal_id]);
        }

        res.status(200).json({ message: `Withdrawal successfully ${action}d.` });
    } catch (err) {
        console.error("Withdrawal Action Error:", err);
        res.status(500).json({ message: "Database error processing withdrawal." });
    }
});

// 1. PUBLIC: Get All Active Investment Plans
app.get('/api/investments/plans', async (req, res) => {
    try {
        const [plans] = await db.query("SELECT * FROM investment_plans ORDER BY id DESC");
        res.json({ plans });
    } catch (err) {
        res.status(500).json({ message: "Error fetching investment plans." });
    }
});

// 2. ADMIN: Create a New Investment Plan
app.post('/api/admin/investments/create', verifyToken, async (req, res) => {
    // Optional check: ensure user is admin if you have an admin verification middleware/column
    const { title, min_amount, max_amount, daily_return_pct, duration_days, max_purchases, image_url } = req.body;

    if (!title || !min_amount || !daily_return_pct || !duration_days) {
        return res.status(400).json({ message: "Please fill in all mandatory fields (Title, Min Amount, Rate, Duration)." });
    }

    try {
        await db.query(
            `INSERT INTO investment_plans (title, min_amount, max_amount, daily_return_pct, duration_days, max_purchases, image_url) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [title, min_amount, max_amount || null, daily_return_pct, duration_days, max_purchases || 1, image_url || null]
        );
        res.json({ message: "Investment plan created successfully!" });
    } catch (err) {
        res.status(500).json({ message: "Server error creating plan." });
    }
});

// 3. ADMIN: Delete an Investment Plan
app.delete('/api/admin/investments/:id', verifyToken, async (req, res) => {
    const planId = req.params.id;
    try {
        await db.query("DELETE FROM investment_plans WHERE id = ?", [planId]);
        res.json({ message: "Investment plan removed successfully." });
    } catch (err) {
        res.status(500).json({ message: "Error deleting investment plan." });
    }
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

// --- 1. GET ALL INVESTMENT PLANS (User view) ---
app.get('/api/plans', verifyToken, async (req, res) => {
    try {
        const [plans] = await db.query('SELECT * FROM investment_plans ORDER BY price ASC');
        res.json(plans);
    } catch (err) {
        res.status(500).json({ message: 'Error loading investment plans.' });
    }
});

// --- 2. PROCESS PLAN PURCHASE (Deduct wallet & save investment) ---
app.post('/api/plans/invest', verifyToken, async (req, res) => {
    const { planId } = req.body;
    const userId = req.user.id;

    try {
        const [plans] = await db.query('SELECT * FROM investment_plans WHERE id = ?', [planId]);
        if (plans.length === 0) {
            return res.status(400).json({ message: 'Investment plan not found.' });
        }
        const plan = plans[0];

        const [users] = await db.query('SELECT wallet_balance FROM users WHERE id = ?', [userId]);
        const user = users[0];

        if (user.wallet_balance < plan.price) {
            return res.status(400).json({ message: 'Insufficient wallet balance. Please deposit funds.' });
        }

        // Deduct price from user wallet
        await db.query(
            'UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?', 
            [plan.price, userId]
        );

        // Record the investment
        await db.query(
            'INSERT INTO user_investments (user_id, plan_id, amount, daily_return, duration_days, days_remaining) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, plan.id, plan.price, plan.daily_return, plan.duration_days, plan.duration_days]
        );

        res.json({ message: 'Investment plan activated successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error processing investment.' });
    }
});

// --- 3. FETCH USER'S ACTIVE INVESTMENTS ---
app.get('/api/user/investments', verifyToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const [investments] = await db.query(`
            SELECT ui.*, ip.name 
            FROM user_investments ui 
            JOIN investment_plans ip ON ui.plan_id = ip.id 
            WHERE ui.user_id = ? 
            ORDER BY ui.created_at DESC
        `, [userId]);
        
        res.json(investments);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching user investments.' });
    }
});

// --- 4. ADMIN: CREATE A NEW INVESTMENT PLAN ---
app.post('/api/admin/plans', verifyToken, verifyAdmin, async (req, res) => {
    const { name, price, daily_return, duration_days } = req.body;
    try {
        await db.query(
            'INSERT INTO investment_plans (name, price, daily_return, duration_days) VALUES (?, ?, ?, ?)',
            [name, price, daily_return, duration_days]
        );
        res.json({ message: 'Plan created successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error creating plan.' });
    }
});

// --- 5. ADMIN: UPDATE AN EXISTING INVESTMENT PLAN ---
app.put('/api/admin/plans/:id', verifyToken, verifyAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, price, daily_return, duration_days } = req.body;
    try {
        await db.query(
            'UPDATE investment_plans SET name = ?, price = ?, daily_return = ?, duration_days = ? WHERE id = ?',
            [name, price, daily_return, duration_days, id]
        );
        res.json({ message: 'Plan updated successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error updating plan.' });
    }
});

// --- 6. ADMIN: DELETE AN INVESTMENT PLAN ---
app.delete('/api/admin/plans/:id', verifyToken, verifyAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM investment_plans WHERE id = ?', [id]);
        res.json({ message: 'Plan deleted successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error deleting plan.' });
    }
});

// 9. Tell the server to listen for traffic
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running! You can view it at http://localhost:${PORT}`);
});