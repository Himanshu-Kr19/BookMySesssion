const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticateToken = require('../middleware/authenticateToken');

// Get all speakers
router.get('/get-speakers', authenticateToken, async (req, res) => {
    try {
        const { expertise, min_price, max_price } = req.query;

        // Build query based on optional filters
        let query = `
            SELECT u.id AS speaker_id, u.first_name, u.last_name, u.email, 
                sp.expertise, sp.price_per_session
            FROM speaker_profiles sp
            JOIN users u ON sp.speaker_id = u.id
            WHERE u.role = 'speaker'
        `;

        if (expertise || min_price || max_price) {
            query += ' AND';
        }

        if (expertise) {
            query += ` sp.expertise ILIKE '%${expertise}%'`;
        }

        if (min_price && max_price) {
            query += ` AND sp.price_per_session BETWEEN ${min_price} AND ${max_price}`;
        }

        const result = await pool.query(query);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "No speakers found" });
        }

        res.json({ speakers: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error" });
    }
});

module.exports = router;
