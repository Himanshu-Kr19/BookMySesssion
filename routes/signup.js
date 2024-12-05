const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const router = express.Router();

// Signup route
router.post('/signup', async (req, res) => {
    const { firstName, lastName, email, password, role } = req.body;

    try {
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate OTP
        const otp = crypto.randomInt(100000, 999999); // Random 6-digit OTP
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP valid for 10 minutes

        // Check if user already exists (basic validation)
        const checkUserQuery = `SELECT email FROM users WHERE email = $1`;
        const userCheckResult = await pool.query(checkUserQuery, [email]);
        if (userCheckResult.rows.length > 0) {
            return res.status(400).json({ error: 'Email is already registered.' });
        }

        // Insert user data with the OTP into the database (not verified yet)
        const query = `
            INSERT INTO users (first_name, last_name, email, password, role, otp, otp_expires_at, verified)
            VALUES ($1, $2, $3, $4, $5, $6, $7, false)
            RETURNING id;
        `;
        const values = [firstName, lastName, email, hashedPassword, role, otp, otpExpiresAt];
        const result = await pool.query(query, values);

        const userId = result.rows[0].id;

        // Send OTP via email using Gmail SMTP
        const transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: process.env.EMAIL,
                pass: process.env.EMAIL_PASSWORD,
            },
        });
        const mailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject: 'Verify Your Account',
            html: `
                <html>
                    <head>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                color: #333;
                                line-height: 1.5;
                                background-color: #f4f4f4;
                                padding: 20px;
                            }
                            .container {
                                background-color: #fff;
                                border-radius: 8px;
                                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                                padding: 30px;
                                text-align: center;
                            }
                            .header {
                                font-size: 24px;
                                color: #0056b3;
                                margin-bottom: 20px;
                            }
                            .otp {
                                font-size: 28px;
                                font-weight: bold;
                                color: #ff6347;
                                margin-top: 20px;
                            }
                            .footer {
                                font-size: 14px;
                                color: #666;
                                margin-top: 30px;
                            }
                            .cta {
                                margin-top: 20px;
                                padding: 12px 25px;
                                background-color: #0056b3;
                                color: #fff;
                                font-size: 16px;
                                border: none;
                                border-radius: 4px;
                                cursor: pointer;
                            }
                            .cta:hover {
                                background-color: #004080;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">Welcome to BookMySession!</div>
                            <p>Thank you for registering with <strong>BookMySession</strong>, the ultimate platform for booking your sessions with ease.</p>
                            <p>We need to verify your email address to complete your registration. Please use the OTP below to verify your account:</p>
                            <div class="otp">${otp}</div>
                            <p>Your OTP is valid for the next 10 minutes. After that, it will expire.</p>
                            <p>If you did not register for an account, you can safely ignore this email.</p>
                                <p>Thank you for choosing BookMySession!</p>
                            </div>
                        </div>
                    </body>
                </html>
            `,
        };


        await transporter.sendMail(mailOptions);

        res.status(200).json({
            message: 'OTP has been sent to your email. Please check your inbox, and if you do not see it, check your spam folder for the verification email.', userId: userId
        });
    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).json({ error: 'Signup failed. Please try again later.' });
    }
});

// OTP Verification route
router.post('/verify-otp', async (req, res) => {
    const { userId, otp } = req.body;

    try {
        // Fetch user by ID and check OTP
        const query = `SELECT otp, otp_expires_at, verified FROM users WHERE id = $1`;
        const result = await pool.query(query, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const { otp: storedOtp, otp_expires_at: otpExpiresAt, verified } = result.rows[0];

        // Check if the account is already verified
        if (verified) {
            return res.status(400).json({ error: 'Account already verified.' });
        }

        // Validate OTP
        if (storedOtp !== otp) {
            return res.status(400).json({ error: 'Invalid OTP.' });
        }

        // Check OTP expiration
        if (new Date() > otpExpiresAt) {
            return res.status(400).json({ error: 'OTP has expired.' });
        }

        // Mark the account as verified
        await pool.query(`UPDATE users SET verified = true WHERE id = $1`, [userId]);

        // Delete OTP from the database to ensure it can't be reused
        await pool.query(`UPDATE users SET otp = NULL WHERE id = $1`, [userId]);

        res.status(200).json({ message: 'Account verified successfully.' });
    } catch (error) {
        console.error('Error during OTP verification:', error);
        res.status(500).json({ error: 'OTP verification failed. Please try again later.' });
    }
});

module.exports = router;
