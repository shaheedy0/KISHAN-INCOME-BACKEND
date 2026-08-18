const express = require('express');
const verifyToken = require('./middleware'); // Bring in our security guard
const pool = require('./db');

const router = express.Router();

// A protected route that requires a valid JWT token
router.get('/profile', verifyToken, async (req, res) => {
    try {
        // req.user.id comes safely from the decoded token wristband
        const [users] = await pool.query('SELECT id, full_names, phone_number, wallet_balance, referral_code, created_at FROM users WHERE id = ?', [req.user.id]);
        
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        res.status(200).json({
            success: true,
            message: 'Protected data accessed successfully!',
            profile: users[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;