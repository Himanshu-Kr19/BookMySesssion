const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

const router = express.Router();

// Speaker Profile Setup Route
router.post(
    '/setup-profile',
    authenticateToken,
    authorizeRole('speaker'),
    async (req, res) => {
        const { expertise, pricePerSession } = req.body;

        if (!expertise || pricePerSession == null) { // Check for null or undefined
            return res.status(400).json({ error: 'Expertise and price per session are required.' });
        }

        const speakerId = req.user.userId;

        try {
            // Check if profile already exists
            const checkProfileQuery = `SELECT id FROM speaker_profiles WHERE speaker_id = $1`;
            const existingProfile = await pool.query(checkProfileQuery, [speakerId]);

            if (existingProfile.rows.length > 0) {
                // Update existing profile
                const updateProfileQuery = `
                    UPDATE speaker_profiles 
                    SET expertise = $1, price_per_session = $2 
                    WHERE speaker_id = $3
                    RETURNING *;
                `;
                const updatedProfile = await pool.query(updateProfileQuery, [expertise, pricePerSession, speakerId]);
                return res.status(200).json({ message: 'Profile updated successfully.', profile: updatedProfile.rows[0] });
            }

            // Create a new profile
            const createProfileQuery = `
                INSERT INTO speaker_profiles (speaker_id, expertise, price_per_session)
                VALUES ($1, $2, $3)
                RETURNING *;
            `;
            const newProfile = await pool.query(createProfileQuery, [speakerId, expertise, pricePerSession]);

            res.status(201).json({ message: 'Profile created successfully.', profile: newProfile.rows[0] });
        } catch (error) {
            console.error('Error setting up profile:', error);
            res.status(500).json({ error: 'Failed to set up profile. Please try again later.' });
        }
    }
);

module.exports = router;
