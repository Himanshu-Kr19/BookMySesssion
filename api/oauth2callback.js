// api/oauth2callback.js
const { google } = require('googleapis');
require('dotenv').config();

const REDIRECT_URI = 'https://book-my-sesssion.vercel.app/api/oauth2callback';

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
);

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { code, error } = req.query;

    if (error) {
        console.error('OAuth Error:', error);
        return res.status(400).json({ error });
    }

    if (!code) {
        return res.status(400).json({ error: 'No code provided' });
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);
        console.log('Refresh Token:', tokens.refresh_token);
        return res.status(200).json({
            message: 'Authorization successful',
            refreshToken: tokens.refresh_token
        });
    } catch (error) {
        console.error('Token Error:', error);
        return res.status(500).json({ error: error.message });
    }
};