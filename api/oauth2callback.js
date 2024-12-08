// This file is responsible for handling the OAuth2 callback from Google.
const { google } = require('googleapis');
require('dotenv').config();
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://book-my-sesssion.vercel.app/api/oauth2callback'
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
        // Store token securely or return it to client
        return res.status(200).json({
            message: 'Token received successfully',
            refreshToken: tokens.refresh_token
        });
    } catch (error) {
        console.error('Token Error:', error);
        return res.status(500).json({ error: error.message });
    }
};