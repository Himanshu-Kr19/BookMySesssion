const express = require('express');
const cors = require('cors');
const pool = require('./config/db'); // Import database configuration
require('dotenv').config();
const authRoutes = require('./routes/auth');
const app = express();
const PORT = process.env.PORT || 5000;
const { google } = require('googleapis');

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Credentials", true);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS, PUT, PATCH, DELETE"
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
    );
    next();
});
// Add OAuth routes
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NODE_ENV === 'production'
        ? 'https://book-my-sesssion.vercel.app/api/oauth2callback'
        : 'http://localhost:5000/oauth2callback'
);// Add OAuth routes
app.get('/auth/google', (req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events'
        ],
        prompt: 'consent'
    });
    res.redirect(url);
});
// Local development callback route
if (process.env.NODE_ENV !== 'production') {
    app.get('/oauth2callback', async (req, res) => {
        const { code } = req.query;
        try {
            const { tokens } = await oauth2Client.getToken(code);
            console.log('Refresh Token:', tokens.refresh_token);
            res.send('Success! Check console for refresh token');
        } catch (error) {
            console.error('Token Error:', error);
            res.status(500).send(error.message);
        }
    });
}
// Test the database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection failed:', err);
    } else {
        console.log('Database connected successfully at:', res.rows[0].now);
    }
});

// API routes
app.get('/', (req, res) => {
    res.send('Server is running, and the database connection is established!');
});

app.use('/api/auth', authRoutes);
app.use('/api/speaker', require('./routes/speaker-profile'));
app.use('/api/session', require('./routes/session-booking'));

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
