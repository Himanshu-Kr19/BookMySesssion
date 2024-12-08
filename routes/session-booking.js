const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticateToken = require('../middleware/authenticateToken');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const { OAuth2 } = google.auth;

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
);
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
        res.status(500).json({ error: 'An error occurred while fetching slots.' });
    }
});

// Create a transporter object using the default SMTP transport (Gmail)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
    },
});

oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});


async function sendCalendarInvite(bookingDetails, userEmail, speakerEmail) {
    try {

        if (!bookingDetails?.start_time || !userEmail || !speakerEmail) {
            throw new Error(`Missing required booking details: 
                start_time: ${!!bookingDetails?.start_time}, 
                userEmail: ${!!userEmail}, 
                speakerEmail: ${!!speakerEmail}`);
        }
        if (!bookingDetails?.start_time || !userEmail || !speakerEmail) {
            throw new Error('Missing required booking details');
        }
        oauth2Client.setCredentials({
            refresh_token: process.env.GOOGLE_REFRESH_TOKEN
        });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const startTime = new Date(bookingDetails.start_time);
        if (isNaN(startTime.getTime())) {
            throw new Error('Invalid start time');
        }

        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

        const event = {
            summary: 'Mentoring Session',
            description: `Virtual engaging session`,
            start: {
                dateTime: startTime.toISOString(),
                timeZone: 'IST'
            },
            end: {
                dateTime: endTime.toISOString(),
                timeZone: 'IST'
            },
            attendees: [
                { email: userEmail },
                { email: speakerEmail }
            ],
            reminders: {
                useDefault: true
            }
        };

        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
            sendUpdates: 'all'
        });
        console.log('Calendar event created:', response.data.htmlLink);
        return response.data.htmlLink;
    } catch (error) {
        console.error('Calendar invite error:', error);
        throw error;
    }
}

// Booking Slot Route (with email notifications)
router.post('/:speakerId/book-slot', authenticateToken, async (req, res) => {
    try {

        if (!req.user || (!req.user.id && !req.user.userId)) {
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

        const bookingResult = await pool.query(insertBookingQuery, [userId, slot_id, speakerId]);

        // Fetch user and speaker information for email notifications
        const user = 'SELECT email, first_name FROM users WHERE id = $1';
        const speaker = 'SELECT email, first_name FROM users WHERE id = (SELECT speaker_id FROM speaker_profiles WHERE id = $1)';

        const userResult = await pool.query(user, [userId]);
        const speaker_ans = await pool.query(speaker, [speakerId]);

        if (userResult.rows.length === 0 || speaker_ans.rows.length === 0) {
            return res.status(400).json({ message: 'User or speaker email not found.' });
        }

        const userEmail = userResult.rows[0].email;
        const speakerEmail = speaker_ans.rows[0].email;
        const userFirstName = userResult.rows[0].first_name;
        const speakerFirstName = speaker_ans.rows[0].first_name;

        // Email content for the user
        const userMailOptions = {
            from: process.env.EMAIL_USER,
            to: userEmail,
            subject: 'Slot Booked Successfully - Confirmation',
            html: `
        <html>
            <body style="font-family: Arial, sans-serif; background-color: #f7f7f7; color: #333;">
                <div style="max-width: 600px; margin: auto; background-color: #fff; padding: 20px; border-radius: 8px;">
                    <h2 style="text-align: center; color: #2a9d8f;">Slot Booked Successfully!</h2>
                    <p>Hello <strong>${userFirstName}</strong>,</p>
                    <p>Congratulations! You have successfully booked a session with <strong>${speakerFirstName}</strong>.</p>

                    <p style="font-weight: bold; color: #333;">Here are your booking details:</p>

                    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Speaker:</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${speakerFirstName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Slot Start:</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${slotResult.rows[0].slot_start}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Slot End:</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${slotResult.rows[0].slot_end}</td>
                        </tr>
                    </table>

                    <p style="margin-top: 20px;">We are excited to have you on board for this session. Please ensure to be on time and ready for an engaging experience.</p>
                    <p style="color: #e76f51; font-weight: bold;">Looking forward to a productive session with ${speakerFirstName}!</p>

                    <footer style="text-align: center; margin-top: 40px; font-size: 12px; color: #777;">
                        <p>Thank you for using our platform. We hope you enjoy the session!</p>
                    </footer>
                </div>
            </body>
        </html>
    `,
        };


        // Email content for the speaker
        const speakerMailOptions = {
            from: process.env.EMAIL_USER,
            to: speakerEmail,
            subject: 'New Slot Booking - Speaker Notification',
            html: `
        <html>
            <body style="font-family: Arial, sans-serif; background-color: #f7f7f7; color: #333;">
                <div style="max-width: 600px; margin: auto; background-color: #fff; padding: 20px; border-radius: 8px;">
                    <h2 style="text-align: center; color: #2a9d8f;">New Slot Booking!</h2>
                    <p>Hello <strong>${speakerFirstName}</strong>,</p>
                    <p>A new user has successfully booked a session with you! Here are the details:</p>
                    
                    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">User:</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${userFirstName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Slot Start:</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${slotResult.rows[0].slot_start}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Slot End:</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${slotResult.rows[0].slot_end}</td>
                        </tr>
                    </table>

                    <p style="margin-top: 20px;">Please prepare accordingly for the upcoming session. Make sure to reach out to the user if you need any further details.</p>
                    <p style="color: #e76f51; font-weight: bold;">Looking forward to a productive session!</p>

                    <footer style="text-align: center; margin-top: 40px; font-size: 12px; color: #777;">
                        <p>Thank you for being a part of our platform.</p>
                    </footer>
                </div>
            </body>
        </html>
    `,
        };

        // Send calendar invite
        try {
            console.log('Sending calendar invite...');
            const calendarLink = await sendCalendarInvite(
                {
                    start_time: slotResult.rows[0].slot_start, // Use slot start time
                    end_time: slotResult.rows[0].slot_end,     // Use slot end time
                    booking_id: bookingResult.rows[0].id
                },
                userResult.rows[0].email,
                speaker_ans.rows[0].email
            );
            console.log('Calendar invite sent successfully');

            // Email calendar content for the user
            const userMailCalendar = {
                from: process.env.EMAIL_USER,
                to: userEmail,
                subject: 'Calendar Invite Link - Confirmation',
                html: `
                <html>
                    <body style="font-family: Arial, sans-serif; background-color: #f7f7f7; color: #333; padding: 20px; margin: 0;">
                        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #ddd; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); overflow: hidden;">
                            <!-- Header Section -->
                            <header style="background-color: #2a9d8f; padding: 20px; text-align: center; color: #fff; border-radius: 10px 10px 0 0;">
                                <h1 style="margin: 0; font-size: 24px;">BookMySession</h1>
                                <p style="margin: 5px 0 0; font-size: 14px;">Your Gateway to Knowledge and Networking</p>
                            </header>
                            
                            <!-- Body Section -->
                            <div style="padding: 20px;">
                                <h2 style="font-size: 20px; margin-top: 0;">Hello, ${userFirstName}!</h2>
                                <p style="line-height: 1.6;">We’re excited to confirm your upcoming session with one of our expert speakers. Here are the details:</p>
                                
                                <!-- Event Details -->
                                <div style="margin: 20px 0; padding: 15px; background-color: #f0f9f8; border-left: 5px solid #2a9d8f; border-radius: 5px;">
                                    <p style="margin: 0;"><strong>Session Details:</strong></p>
                                    <ul style="list-style: none; padding: 0; margin: 10px 0 0;">
                                        <li><strong>Speaker:</strong> ${speakerFirstName}</li>
                                        <li><strong>Start Time:</strong>${slotResult.rows[0].slot_start}</li>
                                        <li><strong>End Time:</strong>${slotResult.rows[0].slot_end}</li>
                                    </ul>
                                </div>
                                
                                <!-- Google Calendar Invite -->
                                <p style="line-height: 1.6;">To ensure you don’t miss the session, a <strong>Google Calendar event</strong> has been created for you. Use the link below to add it to your calendar:</p>
                                <div style="margin: 20px 0; text-align: center;">
                                    <a href="${calendarLink}" style="display: inline-block; padding: 10px 20px; color: #fff; background-color: #2a9d8f; text-decoration: none; border-radius: 5px; font-weight: bold;">
                                        Add to Google Calendar
                                    </a>
                                </div>
                            </div>
                            
                            <!-- Footer Section -->
                            <footer style="background-color: #2a9d8f; padding: 15px; text-align: center; color: #fff; border-radius: 0 0 10px 10px; font-size: 14px;">
                                <p style="margin: 0;">Thank you for choosing <strong>BookMySession</strong>. We’re confident you’ll have an insightful and engaging session!</p>\
                            </footer>
                        </div>
                    </body>
                </html>
                `
            };

            // Email calendar content for the speaker
            const speakerMailCalendar = {
                from: process.env.EMAIL_USER,
                to: speakerEmail,
                subject: 'Calendar Invite Link - Confirmation',
                html: `
                <html>
                    <body style="font-family: Arial, sans-serif; background-color: #f7f7f7; color: #333; padding: 20px; margin: 0;">
                        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #ddd; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); overflow: hidden;">
                            <!-- Header Section -->
                            <header style="background-color: #2a9d8f; padding: 20px; text-align: center; color: #fff; border-radius: 10px 10px 0 0;">
                                <h1 style="margin: 0; font-size: 24px;">BookMySession</h1>
                                <p style="margin: 5px 0 0; font-size: 14px;">Empowering Connections Through Knowledge Sharing</p>
                            </header>
                            
                            <!-- Body Section -->
                            <div style="padding: 20px;">
                                <h2 style="font-size: 20px; margin-top: 0;">Hello, ${speakerFirstName}!</h2>
                                <p style="line-height: 1.6;">We are thrilled to have you as a speaker for an upcoming session. Your insights and expertise will be invaluable to the attendees.</p>
                                
                                <!-- Event Details -->
                                <div style="margin: 20px 0; padding: 15px; background-color: #f0f9f8; border-left: 5px solid #2a9d8f; border-radius: 5px;">
                                    <p style="margin: 0;"><strong>Event Details:</strong></p>
                                    <ul style="list-style: none; padding: 0; margin: 10px 0 0;">
                                        <li><strong>Start Time:</strong>${slotResult.rows[0].slot_start}</li>
                                        <li><strong>End Time:</strong>${slotResult.rows[0].slot_end}</li>
                                    </ul>
                                </div>
                                
                                <!-- Google Calendar Invite -->
                                <p style="line-height: 1.6;">To ensure seamless scheduling, a <strong>Google Calendar event</strong> has been created for both you and the attendees. This will serve as a reminder for the scheduled session.</p>
                                <div style="margin: 20px 0; text-align: center;">
                                    <a href="${calendarLink}" style="display: inline-block; padding: 10px 20px; color: #fff; background-color: #2a9d8f; text-decoration: none; border-radius: 5px; font-weight: bold;">
                                        Add to Google Calendar
                                    </a>
                                </div>
                            </div>
                            
                            <!-- Footer Section -->
                            <footer style="background-color: #2a9d8f; padding: 15px; text-align: center; color: #fff; border-radius: 0 0 10px 10px; font-size: 14px;">
                                <p style="margin: 0;">Thank you for choosing <strong>BookMySession</strong>. We look forward to an engaging session!</p>
                            </footer>
                        </div>
                    </body>
                </html>
                `
            };

            // Send emails with calendar invites
            await transporter.sendMail(userMailCalendar);
            await transporter.sendMail(speakerMailCalendar);

        } catch (error) {
            console.error('Failed to send calendar invite:', error);
        }

        // Send emails with confirmation messages
        await transporter.sendMail(userMailOptions);
        await transporter.sendMail(speakerMailOptions);

        res.status(200).json({
            message: 'Slot booked successfully!',
            booking: bookingResult.rows[0]
        });

    } catch (error) {
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
