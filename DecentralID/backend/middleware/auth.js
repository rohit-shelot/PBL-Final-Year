const jwt = require('jsonwebtoken');

function getCookie(req, name) {
    const cookieHeader = req.headers.cookie || '';
    const prefix = `${name}=`;
    const match = cookieHeader.split(';').map(value => value.trim()).find(value => value.startsWith(prefix));
    return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || getCookie(req, 'decentralid_session');

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        req.user = user;
        next();
    });
}

function generateToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
}

module.exports = { authenticateToken, generateToken };
