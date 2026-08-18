const cron = require('node-cron');
const pool = require('./db');

// The 5 stars '* * * * *' mean: run every minute! 
// (For production midnight runs, we will later change this to '0 0 * * *')
cron.schedule('0 0 * * *', async () => {
    console.log('🤖 Cron Job waking up: Checking for active investments...');

    try {
        // 1. Find all investments that are currently 'Active'
        const [activeInvestments] = await pool.query(`
            SELECT ui.id, ui.user_id, ui.amount_invested, ui.expected_return, ui.lock_end_date, ip.contract_period_days 
            FROM user_investments ui
            JOIN investment_programs ip ON ui.program_id = ip.id
            WHERE ui.status = 'Active'
        `);

        if (activeInvestments.length === 0) {
            console.log('No active investments found right now. Going back to sleep.');
            return;
        }

        // 2. Loop through every single active investment
        for (let investment of activeInvestments) {
            
            // Calculate how much profit they should get per tick
            const totalProfit = investment.expected_return - investment.amount_invested;
            const dailyProfit = totalProfit / investment.contract_period_days;

            // A. Deposit the profit into the user's wallet silently
            await pool.query('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?', [dailyProfit, investment.user_id]);
            console.log(`Paid UGX ${dailyProfit.toFixed(2)} profit to User ID: ${investment.user_id}`);

            // B. Check if the contract has reached its maturity date
            const today = new Date();
            const lockEnd = new Date(investment.lock_end_date);
            
            if (today >= lockEnd) {
                // Return their original capital back to their wallet
                await pool.query('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?', [investment.amount_invested, investment.user_id]);
                
                // Change the status so it stops paying them tomorrow
                await pool.query('UPDATE user_investments SET status = ? WHERE id = ?', ['Matured', investment.id]);
                
                console.log(`Investment ${investment.id} has MATURED! Capital returned to User ID: ${investment.user_id}.`);
            }
        }
        
        console.log('✅ All profits distributed successfully!');

    } catch (error) {
        console.error('Error in automated profit engine:', error);
    }
});