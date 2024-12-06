const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Debug logging
        console.log('Decoded token:', decoded);

        // Verify decoded token has required user data
        if (!decoded.id && !decoded.userId) {
            console.error('Token missing user ID:', decoded);
            return res.status(401).json({ error: 'Invalid token structure' });
        }

        // Standardize user object structure
        req.user = {
            id: decoded.id || decoded.userId,
            ...decoded
        };

        // Debug logging
        console.log('req.user set to:', req.user);

        next();
    } catch (error) {
        console.error('Token verification failed:', error);
        return res.status(403).json({ error: 'Invalid or expired token.' });
    }
};

module.exports = authenticateToken;