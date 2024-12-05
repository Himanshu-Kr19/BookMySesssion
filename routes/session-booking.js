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
});// Endpoint to get available time slots for a speaker
router.get('/:speakerId/slots', async (req, res) => {
    const speakerId = req.params.speakerId;

    try {
        // Query to fetch available time slots for a specific speaker (from 9 AM to 4 PM)
        const query = `
            SELECT id, slot_start, slot_end 
            FROM time_slots 
            WHERE speaker_profile_id = $1 
              AND is_booked = FALSE
            ORDER BY slot_start;
        `;

        const result = await pool.query(query, [speakerId]);

        // If no available slots, respond with 204 (No Content) or 404 (Not Found) as you prefer
        if (result.rows.length === 0) {
            return res.status(204).json({ message: 'No available slots for this speaker.' });
        }

        // Function to convert UTC time to IST
        const convertToIST = (utcDateStr) => {
            const utcDate = new Date(utcDateStr);
            // Add IST offset (UTC + 5:30) to the UTC time
            const IST_OFFSET = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
            const istDate = new Date(utcDate.getTime() + IST_OFFSET);
            return istDate.toISOString().slice(0, 19).replace('T', ' '); // Format as 'YYYY-MM-DD HH:MM:SS'
        };

        // Map the result to a cleaner format and convert times to IST
        const availableSlots = result.rows.map(row => ({
            slot_start: convertToIST(row.slot_start),
            slot_end: convertToIST(row.slot_end)
        }));

        // Respond with the available slots
        res.status(200).json(availableSlots);

    } catch (error) {
        console.error('Error fetching time slots:', error);
        res.status(500).json({ error: 'An error occurred while fetching available slots.' });
    }
});

module.exports = router;
