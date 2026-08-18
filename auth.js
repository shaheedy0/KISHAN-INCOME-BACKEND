const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('./db');

const router = express.Router();

// ==========================================
// 1. The Secure Registration Route (Updated for Referrals)
// ==========================================
router.post('/register', [
    body('full_names').notEmpty().withMessage('Full names are required.'),
    body('phone_number').matches(/^07[0-8][0-9]{7}$/).withMessage('Enter a valid Ugandan number (e.g., 0771234567).'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    // NEW: We now accept 'referred_by' from the user's phone!
    const { full_names, phone_number, gender, dob, password, referred_by } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 12);
        const referralCode = 'KISHAN-' + crypto.randomBytes(3).toString('hex').toUpperCase();

        const query = `INSERT INTO users (full_names, phone_number, gender, dob, password_hash, referral_code, referred_by) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        
        // Save the person who referred them into the database
        await pool.query(query, [full_names, phone_number, gender, dob, hashedPassword, referralCode, referred_by || null]);

        res.status(201).json({ success: true, message: 'Account created successfully!', referral_code: referralCode });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error or phone number already exists.' });
    }
});

// ==========================================
// 2. The Secure Login Route (Updated)
// ==========================================
router.post('/login', async (req, res) => {
    const { phone_number, password } = req.body;

    try {
        const [users] = await pool.query('SELECT * FROM users WHERE phone_number = ?', [phone_number]);
        const user = users[0];

        if (!user) return res.status(400).json({ success: false, message: 'Account not found. Please register first.' });

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(400).json({ success: false, message: 'Incorrect password.' });

        // NEW: We now pack their referral_code into their digital wristband so we can track their team!
        const token = jwt.sign(
            { id: user.id, role: user.role, referral_code: user.referral_code }, 
            process.env.JWT_SECRET,           
            { expiresIn: '24h' }              
        );

        res.status(200).json({
            success: true,
            message: 'Login successful!',
            token: token,
            user: {
                full_names: user.full_names,
                wallet_balance: user.wallet_balance,
                referral_code: user.referral_code
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error during login.' });
    }
});

module.exports = router;