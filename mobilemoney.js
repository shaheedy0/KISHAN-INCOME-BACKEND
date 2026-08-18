const express = require('express');
const verifyToken = require('./middleware');
const pool = require('./db');

const router = express.Router();

// ==========================================
// 1. DEPOSIT: Add money to wallet via MTN / Airtel
// ==========================================
router.post('/deposit', verifyToken, async (req, res) => {
    const { amount, provider, phone_number } = req.body;
    const user_id = req.user.id;

    if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Enter a valid deposit amount.' });
    }

    if (!['MTN', 'Airtel'].includes(provider)) {
        return res.status(400).json({ success: false, message: 'Provider must be MTN or Airtel.' });
    }

    try {
        // Generate a transaction reference
        const reference_id = `${provider}-${Date.now()}`;

        // Add funds to user's wallet
        await pool.query('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?', [amount, user_id]);

        // Record the transaction in history
        await pool.query(
            'INSERT INTO transactions (user_id, type, amount, provider, reference_id, status) VALUES (?, ?, ?, ?, ?, ?)',
            [user_id, 'Deposit', amount, provider, reference_id, 'Success']
        );

        // Fetch updated balance
        const [users] = await pool.query('SELECT wallet_balance FROM users WHERE id = ?', [user_id]);

        res.status(200).json({
            success: true,
            message: `Successfully deposited UGX ${amount} via ${provider}.`,
            new_balance: users[0].wallet_balance,
            reference_id: reference_id
        });

    } catch (error) {
        console.error('Deposit error:', error);
        res.status(500).json({ success: false, message: 'Server error during deposit.' });
    }
});

// ==========================================
// 2. WITHDRAWAL: Request payout to MTN / Airtel
// ==========================================
router.post('/withdraw', verifyToken, async (req, res) => {
    const { amount, provider, phone_number } = req.body;
    const user_id = req.user.id;

    if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Enter a valid withdrawal amount.' });
    }

    try {
        // Check current user balance
        const [users] = await pool.query('SELECT wallet_balance FROM users WHERE id = ?', [user_id]);
        const currentBalance = users[0].wallet_balance;

        if (currentBalance < amount) {
            return res.status(400).json({
                success: false,
                message: `Insufficient funds. Your wallet balance is UGX ${currentBalance}.`
            });
        }

        const reference_id = `WD-${provider}-${Date.now()}`;

        // Deduct funds from wallet
        await pool.query('UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?', [amount, user_id]);

        // Log transaction record
        await pool.query(
            'INSERT INTO transactions (user_id, type, amount, provider, reference_id, status) VALUES (?, ?, ?, ?, ?, ?)',
            [user_id, 'Withdrawal', amount, provider, reference_id, 'Pending']
        );

        res.status(200).json({
            success: true,
            message: `Withdrawal request for UGX ${amount} submitted via ${provider}.`,
            reference_id: reference_id
        });

    } catch (error) {
        console.error('Withdrawal error:', error);
        res.status(500).json({ success: false, message: 'Server error during withdrawal.' });
    }
});

module.exports = router;