const express = require('express');
const verifyToken = require('./middleware');
const pool = require('./db');

const router = express.Router();

// ==========================================
// 1. MEMBER: View my Referral Team
// ==========================================
router.get('/my-team', verifyToken, async (req, res) => {
    // We pull their unique code straight from their secure JWT token
    const myReferralCode = req.user.referral_code;

    try {
        // Find everyone in the database who has THIS user's code in their 'referred_by' column
        const [team] = await pool.query(
            'SELECT full_names, phone_number, created_at FROM users WHERE referred_by = ?', 
            [myReferralCode]
        );

        res.status(200).json({
            success: true,
            total_referrals: team.length,
            team_members: team
        });

    } catch (error) {
        console.error('Referral team error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching team details.' });
    }
});

module.exports = router;