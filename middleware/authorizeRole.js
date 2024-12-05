// Authorization middleware (for specific roles)
const authorizeRole = (role) => (req, res, next) => {
    if (req.user && req.user.role === role) {
        next();
    } else {
        return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
};

module.exports = authorizeRole;
