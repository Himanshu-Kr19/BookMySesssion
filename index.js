const express = require('express');
const cors = require('cors');
const pool = require('./config/db'); // Import database configuration
const dotenv = require('dotenv');
const authRoutes = require('./routes/signup');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
