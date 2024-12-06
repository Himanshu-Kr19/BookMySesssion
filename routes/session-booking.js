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
            SELECT u.id AS user_id, sp.id AS speaker_id, u.first_name, u.last_name, u.email, 
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


// Endpoint to get available time slots for a speaker
router.get('/:speakerId/slots', authenticateToken, async (req, res) => {
    const speakerId = req.params.speakerId;

    try {
        // Query to fetch all time slots and their booking status
        const query = `
            SELECT 
                ts.id,
                ts.slot_start,
                ts.slot_end,
                COUNT(b.id) as booking_count
            FROM time_slots ts
            LEFT JOIN bookings b ON ts.id = b.slot_id
            WHERE ts.speaker_profile_id = $1
            GROUP BY ts.id, ts.slot_start, ts.slot_end
            ORDER BY ts.slot_start;
        `;

        const result = await pool.query(query, [speakerId]);

        if (result.rows.length === 0) {
            return res.status(204).json({ message: 'No slots found for this speaker.' });
        }

        // Function to convert UTC time to IST
        const convertToIST = (utcDateStr) => {
            const utcDate = new Date(utcDateStr);
            const IST_OFFSET = 5.5 * 60 * 60 * 1000; // 5:30 hours in milliseconds
            const istDate = new Date(utcDate.getTime() + IST_OFFSET);
            return istDate.toISOString().slice(0, 19).replace('T', ' ');
        };

        // Map the result including slot ID and booking count
        const availableSlots = result.rows.map(row => ({
            id: row.id,
            slot_start: convertToIST(row.slot_start),
            slot_end: convertToIST(row.slot_end),
            booking_count: parseInt(row.booking_count)
        }));

        res.status(200).json(availableSlots);

    } catch (error) {
        console.error('Error fetching time slots:', error);
        res.status(500).json({ error: 'An error occurred while fetching slots.' });
    }
});

//Booking Slot for a speaker(one user can't book same slot but multiple users can book same slot)
router.post('/:speakerId/book-slot', authenticateToken, async (req, res) => {
    try {

        if (!req.user || (!req.user.id && !req.user.userId)) {
            console.error('Invalid user object:', req.user);
            return res.status(401).json({ message: 'Invalid user authentication.' });
        }

        const userId = req.user.id || req.user.userId;
        const speakerId = req.params.speakerId;
        const { slot_id } = req.body;

        // Validate required parameters
        if (!slot_id) {
            return res.status(400).json({ message: 'Slot ID is required.' });
        }

        // Check if speaker exists
        const speakerQuery = `
            SELECT * FROM time_slots WHERE speaker_profile_id = $1
        `;
        const speakerResult = await pool.query(speakerQuery, [speakerId]);

        if (speakerResult.rows.length === 0) {
            return res.status(404).json({ message: 'Speaker not found or the speaker has not listed their profile yet.' });
        }

        // Check if slot exists and belongs to speaker
        const slotQuery = `
            SELECT * FROM time_slots 
            WHERE id = $1 AND speaker_profile_id = $2
        `;
        const slotResult = await pool.query(slotQuery, [slot_id, speakerId]);

        if (slotResult.rows.length === 0) {
            return res.status(404).json({ message: 'Slot not found or does not belong to this speaker.' });
        }

        // Insert booking
        const insertBookingQuery = `
            INSERT INTO bookings (user_id, slot_id, speaker_profile_id) 
            VALUES ($1, $2, $3)
            RETURNING *;
        `;

        console.log('Executing query with params:', { userId, slot_id, speakerId });
        const bookingResult = await pool.query(insertBookingQuery, [userId, slot_id, speakerId]);

        res.status(200).json({
            message: 'Slot booked successfully!',
            booking: bookingResult.rows[0]
        });

    } catch (error) {
        console.error('Booking error:', error);
        if (error.code === '23505') {
            return res.status(400).json({
                message: 'You have already booked this slot. Multiple bookings are not allowed.'
            });
        }
        if (error.code === '23503') { // Foreign key violation
            return res.status(400).json({
                message: 'Invalid slot or speaker ID provided.'
            });
        }
        res.status(500).json({
            message: 'Failed to book slot',
            error: error.message
        });
    }
});
module.exports = router;
