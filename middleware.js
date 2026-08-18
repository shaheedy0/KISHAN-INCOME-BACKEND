const jwt = require('jsonwebtoken');

// This function acts as a security guard checking digital wristbands
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    
    // Tokens are usually sent as "Bearer <token_string>"
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    try {
        // Verify the token using your secret key
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified; // Attach user info (id and role) to the request
        next(); // Allow them to pass through to the destination route
    } catch (error) {
        return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
    }
};

module.exports = verifyToken;