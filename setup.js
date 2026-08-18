const pool = require('./db');

async function createTables() {
    try {
        console.log('Connecting to online TiDB database...');

        // 1. Users Table
        const usersTable = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                full_names VARCHAR(100) NOT NULL,
                phone_number VARCHAR(15) UNIQUE NOT NULL,
                gender ENUM('Male', 'Female', 'Other') NOT NULL,
                dob DATE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                referral_code VARCHAR(20) UNIQUE NOT NULL,
                referred_by VARCHAR(20) NULL,
                wallet_balance DECIMAL(12, 2) DEFAULT 0.00,
                role ENUM('member', 'admin') DEFAULT 'member',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        // 2. Investment Programs Table (Admin Controlled)
        const programsTable = `
            CREATE TABLE IF NOT EXISTS investment_programs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(100) NOT NULL,
                description TEXT,
                contract_period_days INT NOT NULL,
                roi_percentage DECIMAL(5, 2) NOT NULL,
                price_per_share DECIMAL(12, 2) NOT NULL,
                photo_url VARCHAR(255) NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        // 3. User Investments Table (Locked Programs)
        const userInvestmentsTable = `
            CREATE TABLE IF NOT EXISTS user_investments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                program_id INT NOT NULL,
                amount_invested DECIMAL(12, 2) NOT NULL,
                shares_bought DECIMAL(10, 2) NOT NULL,
                expected_return DECIMAL(12, 2) NOT NULL,
                lock_start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                lock_end_date TIMESTAMP NOT NULL,
                status ENUM('Active', 'Matured', 'Withdrawn') DEFAULT 'Active',
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (program_id) REFERENCES investment_programs(id) ON DELETE CASCADE
            );
        `;

        // 4. Transactions Ledger Table (Mobile Money & Wallet History)
        const transactionsTable = `
            CREATE TABLE IF NOT EXISTS transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                type ENUM('Deposit', 'Withdrawal', 'Investment', 'Referral_Bonus', 'Admin_Adjustment') NOT NULL,
                amount DECIMAL(12, 2) NOT NULL,
                provider ENUM('MTN', 'Airtel', 'System') NOT NULL,
                reference_id VARCHAR(100) UNIQUE NULL,
                status ENUM('Pending', 'Success', 'Failed') DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        `;

        // Execute table creations
        await pool.query(usersTable);
        await pool.query(programsTable);
        await pool.query(userInvestmentsTable);
        await pool.query(transactionsTable);

        console.log('Success! All 4 SACCO tables have been created securely in the cloud.');
        process.exit(0);

    } catch (error) {
        console.error('Error setting up database tables:', error);
        process.exit(1);
    }
}

createTables();