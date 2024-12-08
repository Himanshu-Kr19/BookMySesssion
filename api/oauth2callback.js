// api/oauth2callback.js
const { google } = require('googleapis');
require('dotenv').config();

// Create OAuth client with production callback URL
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://book-my-sesssion.vercel.app/api/oauth2callback'  // Production URL
);

// Add auth route handler
module.exports = async (req, res) => {
    // Handle initial auth request
    if (req.url === '/api/auth/google') {
        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: [
                'https://www.googleapis.com/auth/calendar',
                'https://www.googleapis.com/auth/calendar.events'
            ],
            prompt: 'consent'
        });
        return res.redirect(url);
    }

    // Handle callback
    if (req.url.startsWith('/api/oauth2callback')) {
        const { code } = req.query;

        if (!code) {
            return res.status(400).json({ error: 'No code provided' });
        }

        try {
            const { tokens } = await oauth2Client.getToken(code);
            console.log('Refresh Token:', tokens.refresh_token);

            // Store token or handle as needed
            return res.status(200).json({
                message: 'Authorization successful',
                refreshToken: tokens.refresh_token
            });
        } catch (error) {
            console.error('Token Error:', error);
            return res.status(500).json({ error: error.message });
        }
    }
};