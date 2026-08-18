const express = require('express');
const verifyToken = require('./middleware'); // Your security guard
const pool = require('./db');

const router = express.Router();

// ==========================================
// 1. ADMIN: Create a new Investment Program
// ==========================================
router.post('/admin/create-program', async (req, res) => {
    const { title, description, contract_period_days, roi_percentage, price_per_share } = req.body;
    
    try {
        const query = `INSERT INTO investment_programs (title, description, contract_period_days, roi_percentage, price_per_share) VALUES (?, ?, ?, ?, ?)`;
        await pool.query(query, [title, description, contract_period_days, roi_percentage, price_per_share]);
        
        res.status(201).json({ success: true, message: 'Investment program created successfully!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error creating program.' });
    }
});

// ==========================================
// 2. MEMBER: View all active programs
// ==========================================
router.get('/programs', verifyToken, async (req, res) => {
    try {
        const [programs] = await pool.query('SELECT * FROM investment_programs WHERE is_active = TRUE');
        res.status(200).json({ success: true, programs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error fetching programs.' });
    }
});

// ==========================================
// 3. MEMBER: Invest / Buy Shares
// ==========================================
router.post('/invest', verifyToken, async (req, res) => {
    const { program_id, shares_to_buy } = req.body;
    const user_id = req.user.id; // Safely pulled from their digital wristband

    try {
        // A. Get the program details
        const [programs] = await pool.query('SELECT * FROM investment_programs WHERE id = ?', [program_id]);
        if (programs.length === 0) return res.status(404).json({ success: false, message: 'Program not found.' });
        const program = programs[0];

        // B. Calculate costs and returns
        const total_cost = program.price_per_share * shares_to_buy;
        const expected_return = total_cost + (total_cost * (program.roi_percentage / 100));
        
        // Calculate lock end date (adds the contract days to today's date)
        const lockEndDate = new Date();
        lockEndDate.setDate(lockEndDate.getDate() + program.contract_period_days);

        // C. Check if the user has enough money in their wallet
        const [users] = await pool.query('SELECT wallet_balance FROM users WHERE id = ?', [user_id]);
        const user = users[0];

        if (user.wallet_balance < total_cost) {
            return res.status(400).json({ 
                success: false, 
                message: `Insufficient funds. You need UGX ${total_cost} but your balance is UGX ${user.wallet_balance}.` 
            });
        }

        // D. Process the investment safely
        await pool.query('UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?', [total_cost, user_id]);
        
        await pool.query(
            'INSERT INTO user_investments (user_id, program_id, amount_invested, shares_bought, expected_return, lock_end_date) VALUES (?, ?, ?, ?, ?, ?)',
            [user_id, program_id, total_cost, shares_to_buy, expected_return, lockEndDate]
        );

        await pool.query(
            'INSERT INTO transactions (user_id, type, amount, provider, status) VALUES (?, ?, ?, ?, ?)',
            [user_id, 'Investment', total_cost, 'System', 'Success']
        );

        res.status(200).json({ 
            success: true, 
            message: 'Investment successful!', 
            expected_return: expected_return, 
            unlocks_on: lockEndDate 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error during investment.' });
    }
});

module.exports = router;