const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

const router = express.Router();

// Helper function to create default time slots
const createDefaultTimeSlots = async (speakerProfileId) => {
    const startTime = '2024-12-05 09:00:00'; // 9 AM in UTC
    const endTime = '2024-12-05 16:00:00'; // 4 PM in UTC

    // Convert UTC start and end times to IST
    const startTimeUTC = new Date(startTime).getTime();
    const endTimeUTC = new Date(endTime).getTime();

    const IST_OFFSET = 5.5 * 60 * 60 * 1000; // IST is UTC + 5:30 (in milliseconds)
    const timeSlots = [];
    let slotStart = new Date(startTimeUTC + IST_OFFSET); // Adjust to IST

    // Generate slots from 9 AM to 4 PM with a 1-hour interval
    while (slotStart.getTime() < endTimeUTC + IST_OFFSET) {
        const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000); // 1-hour interval
        timeSlots.push({
            speaker_profile_id: speakerProfileId,
            slot_start: slotStart.toISOString().slice(0, 19).replace('T', ' '), // Format date as 'YYYY-MM-DD HH:MM:SS'
            slot_end: slotEnd.toISOString().slice(0, 19).replace('T', ' '), // Format date as 'YYYY-MM-DD HH:MM:SS'
        });
        slotStart = slotEnd; // Move to the next slot
    }

    // Insert all the time slots at once
    const insertQuery = `
        INSERT INTO time_slots (speaker_profile_id, slot_start, slot_end)
        VALUES
        ${timeSlots.map((_, index) => `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`).join(', ')}
    `;

    // Extract values for all time slots
    const values = timeSlots.flatMap(slot => [
        slot.speaker_profile_id,
        slot.slot_start,
        slot.slot_end
    ]);

    try {
        await pool.query(insertQuery, values); // Execute the query with all time slot values
    } catch (error) {
        throw new Error('Failed to create time slots');
    }
};

// Speaker profile setup route
router.post(
    '/setup-profile',
    authenticateToken,
    authorizeRole('speaker'),
    async (req, res) => {
        const { expertise, pricePerSession } = req.body;
        if (!expertise || !pricePerSession) {
            return res.status(400).json({ error: 'Expertise and price per session are required.' });
        }

        const speakerId = req.user.userId;

        try {
            const checkProfileQuery = `SELECT id FROM speaker_profiles WHERE speaker_id = $1`;
            const existingProfile = await pool.query(checkProfileQuery, [speakerId]);

            let speakerProfile;

            if (existingProfile.rows.length > 0) {
                // Update existing profile
                const updateProfileQuery = `
                    UPDATE speaker_profiles 
                    SET expertise = $1, price_per_session = $2 
                    WHERE speaker_id = $3
                    RETURNING *;
                `;
                speakerProfile = await pool.query(updateProfileQuery, [
                    expertise,
                    pricePerSession,
                    speakerId,
                ]);
            } else {
                // Create new profile
                const createProfileQuery = `
                    INSERT INTO speaker_profiles (speaker_id, expertise, price_per_session)
                    VALUES ($1, $2, $3)
                    RETURNING *;
                `;
                speakerProfile = await pool.query(createProfileQuery, [
                    speakerId,
                    expertise,
                    pricePerSession,
                ]);
            }

            // After creating or updating the profile, add time slots for the speaker
            await createDefaultTimeSlots(speakerProfile.rows[0].id);

            res.status(200).json({
                message: 'Profile created/updated and time slots added successfully.',
                profile: speakerProfile.rows[0],
            });
        } catch (error) {
            console.error('Error setting up profile:', error);
            res.status(500).json({ error: 'Failed to set up profile.' });
        }
    }
);

module.exports = router;