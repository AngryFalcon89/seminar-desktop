const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { isAlpha, isStrongPassword } = require('validator');
const { default: isEmail } = require('validator/lib/isEmail');
const User = require('../sql-models/User');
const OTP = require('../sql-models/OTP');
const { Op } = require('sequelize');

// Configure nodemailer
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    service: 'gmail',
    auth: {
        user: process.env.NodeMailer_email,
        pass: process.env.NodeMailer_password
    }
});

// Generate OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP Email
async function sendOTPEmail(email, otp) {
    const mailOptions = {
        from: process.env.NodeMailer_email,
        to: email,
        subject: 'Email Verification OTP',
        html: `
            <h1>Email Verification</h1>
            <p>Your OTP for email verification is: <strong>${otp}</strong></p>
            <p>This OTP will expire in 5 minutes.</p>
        `
    };

    await transporter.sendMail(mailOptions);
}

// Send Reset OTP Email
async function sendResetOTPEmail(email, otp) {
    const mailOptions = {
        from: process.env.NodeMailer_email,
        to: email,
        subject: 'Password Reset OTP',
        html: `
            <h1>Password Reset Request</h1>
            <p>Your OTP for password reset is: <strong>${otp}</strong></p>
            <p>This OTP will expire in 5 minutes.</p>
            <p>If you did not request this password reset, please ignore this email.</p>
        `
    };

    await transporter.sendMail(mailOptions);
}

// Request OTP route
router.post('/request-otp', async (req, res) => {
    try {
        const { name, email, username, password } = req.body;

        // NAME VALIDATION
        if (!('name' in req.body) || !name) {
            return res.status(400).json({ status: 'fail', message: 'Please provide a name' });
        }

        if (!isAlpha(name, 'en-US', { ignore: ' ' })) {
            return res.status(400).json({ status: 'fail', message: 'Name can only be alphabetic' });
        }

        // PASSWORD VALIDATION
        if (!('password' in req.body) || !password) {
            return res.status(400).json({ status: 'fail', message: 'Please provide a password' });
        }

        if (!isStrongPassword(password)) {
            return res.status(400).json({ status: 'fail', message: 'Please provide a Strong Password' });
        }

        // USERNAME VALIDATION
        if (!('username' in req.body) || !username) {
            return res.status(400).json({ status: 'fail', message: 'Please provide a username' });
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return res.status(400).json({
                status: 'fail',
                message: 'Username can only contain alphabets, number and underscore'
            });
        }

        if (await User.findOne({ where: { username } })) {
            return res.status(404).json({ status: 'fail', message: 'Username not available' });
        }

        // EMAIL VALIDATION
        if (!('email' in req.body) || !email) {
            return res.status(400).json({ status: 'fail', message: 'Please provide an email' });
        }

        if (!isEmail(email)) {
            return res.status(400).json({ status: 'fail', message: 'Please enter a valid email' });
        }

        if (await User.findOne({ where: { email } })) {
            return res.status(404).json({ status: 'fail', message: 'Email is not unique' });
        }

        // Check if OTP exists already (in case of resend OTP)
        const existingOTP = await OTP.findOne({ where: { email } });
        if (existingOTP) {
            await existingOTP.destroy();
        }

        // Generate and save OTP
        const otp = generateOTP();
        const otpExpiry = new Date();
        otpExpiry.setMinutes(otpExpiry.getMinutes() + 5); // OTP expires in 5 minutes

        await OTP.create({
            otp,
            email,
            expires: otpExpiry
        });

        // Send OTP email
        await sendOTPEmail(email, otp);

        res.status(200).json({ status: 'success', message: 'OTP sent successfully' });
    } catch (error) {
        console.error('OTP request error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Verify OTP route
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        // EMAIL VALIDATION
        if (!('email' in req.body) || !email) {
            return res.status(400).json({ status: 'fail', message: 'Please provide an email' });
        }

        if (!isEmail(email)) {
            return res.status(400).json({ status: 'fail', message: 'Please enter a valid email' });
        }

        if (await User.findOne({ where: { email } })) {
            return res.status(404).json({ status: 'fail', message: 'Email is not unique' });
        }

        // OTP VALIDATION
        if (!('otp' in req.body) || !otp) {
            return res.status(400).json({ status: 'fail', message: 'Please provide an OTP' });
        }

        const otpRecord = await OTP.findOne({ where: { email, otp } });
        if (!otpRecord) {
            return res.status(200).json({ status: 'fail', message: 'Invalid OTP' });
        }

        if (new Date() > otpRecord.expires) {
            await otpRecord.destroy();
            return res.status(200).json({
                status: 'fail',
                message: 'OTP Expired. Please request OTP again'
            });
        }

        await otpRecord.destroy();

        const verifiedEmailToken = jwt.sign({ email }, process.env.JWT_SECRET, {
            expiresIn: '10m'
        });

        res.status(200).json({
            status: 'success',
            message: 'OTP Verified Successfully',
            verifiedEmailToken
        });
    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Register route with OTP verification
router.post('/register', async (req, res) => {
    try {
        const { name, email, username, password, verifiedEmailToken } = req.body;

        // Verify email token
        const decoded = jwt.verify(verifiedEmailToken, process.env.JWT_SECRET);
        if (decoded.email !== email) {
            return res.status(400).json({
                status: 'fail',
                message: 'You are not the same person who verified their OTP'
            });
        }

        // NAME VALIDATION
        if (!('name' in req.body) || !name) {
            return res.status(400).json({ status: 'fail', message: 'Please provide a name' });
        }

        if (!isAlpha(name, 'en-US', { ignore: ' ' })) {
            return res.status(400).json({ status: 'fail', message: 'Name can only be alphabetic' });
        }

        // PASSWORD VALIDATION
        if (!('password' in req.body) || !password) {
            return res.status(400).json({ status: 'fail', message: 'Please provide a password' });
        }

        if (!isStrongPassword(password)) {
            return res.status(400).json({ status: 'fail', message: 'Please provide a Strong Password' });
        }

        // USERNAME VALIDATION
        if (!('username' in req.body) || !username) {
            return res.status(400).json({ status: 'fail', message: 'Please provide a username' });
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return res.status(400).json({
                status: 'fail',
                message: 'Username can only contain alphabets, number and underscore'
            });
        }

        if (await User.findOne({ where: { username } })) {
            return res.status(404).json({ status: 'fail', message: 'Username not available' });
        }

        // EMAIL VALIDATION
        if (!('email' in req.body) || !email) {
            return res.status(400).json({ status: 'fail', message: 'Please provide an email' });
        }

        if (!isEmail(email)) {
            return res.status(400).json({ status: 'fail', message: 'Please enter a valid email' });
        }

        if (await User.findOne({ where: { email } })) {
            return res.status(404).json({ status: 'fail', message: 'Email is not unique' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await User.create({
            name,
            email,
            username,
            password: hashedPassword
        });

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            status: 'success',
            message: 'User registered successfully',
            token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Login route
router.post('/login', async (req, res) => {
    try {
        const { emailOrUsername, password } = req.body;
        console.log('Login attempt for:', emailOrUsername);

        // Find user by email or username
        const user = await User.findOne({
            where: {
                [Op.or]: [
                    { email: emailOrUsername },
                    { username: emailOrUsername }
                ]
            }
        });

        if (!user) {
            console.log('User not found');
            return res.status(404).json({ status: 'fail', message: 'User not found' });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            console.log('Invalid password');
            return res.status(401).json({ status: 'fail', message: 'Invalid password' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log('Login successful for user:', user.email);
        res.status(200).json({
            status: 'success',
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                username: user.username
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Forgot password route
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        // Find user
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({ status: 'fail', message: 'User not found' });
        }

        // Generate and save OTP
        const otp = generateOTP();
        const otpExpiry = new Date();
        otpExpiry.setMinutes(otpExpiry.getMinutes() + 5); // OTP expires in 5 minutes

        // Delete existing OTP if any
        const existingOTP = await OTP.findOne({ where: { email } });
        if (existingOTP) {
            await existingOTP.destroy();
        }

        // Create new OTP
        await OTP.create({
            otp,
            email,
            expires: otpExpiry
        });

        // Send reset OTP email
        await sendResetOTPEmail(email, otp);

        res.status(200).json({ status: 'success', message: 'Reset OTP sent successfully' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Reset password route
router.post('/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        // Validate new password
        if (!isStrongPassword(newPassword)) {
            return res.status(400).json({ status: 'fail', message: 'Please provide a strong password' });
        }

        // Verify OTP
        const otpRecord = await OTP.findOne({ where: { email, otp } });
        if (!otpRecord) {
            return res.status(400).json({ status: 'fail', message: 'Invalid OTP' });
        }

        if (new Date() > otpRecord.expires) {
            await otpRecord.destroy();
            return res.status(400).json({ status: 'fail', message: 'OTP expired' });
        }

        // Find user
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({ status: 'fail', message: 'User not found' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await user.update({ password: hashedPassword });

        // Delete OTP
        await otpRecord.destroy();

        res.status(200).json({ status: 'success', message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

module.exports = router; 