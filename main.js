const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { Op } = require('sequelize');
const sequelize = require('./sql-models/database');
const User = require('./sql-models/User');
const Book = require('./sql-models/Book');
const IssueLog = require('./sql-models/IssueLog');
const ExcelJS = require('exceljs');
const fs = require('fs');
const xlsx = require('xlsx');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, 'config.env') });

let mainWindow = null;

// OTP storage
const otpStore = new Map();

// Email configuration
let transporter;
try {
    console.log('Email config:', {
        user: process.env.NodeMailer_email,
        pass: process.env.NodeMailer_password
    });
    
    transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.NodeMailer_email,
            pass: process.env.NodeMailer_password
        }
    });

    // Verify transporter configuration
    transporter.verify(function(error, success) {
        if (error) {
            console.error('Email configuration error:', error);
            throw new Error('Failed to configure email service. Please check your email credentials.');
        } else {
            console.log('Email server is ready to send messages');
        }
    });
} catch (error) {
    console.error('Failed to initialize email transporter:', error);
}

// Function to clean up expired OTPs
function cleanupExpiredOTPs() {
    const now = Date.now();
    for (const [email, data] of otpStore.entries()) {
        if (now - data.timestamp > 5 * 60 * 1000) {
            otpStore.delete(email);
        }
    }
}

// Run cleanup every minute
setInterval(cleanupExpiredOTPs, 60 * 1000);

// Function to generate OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

const department = process.env.DEPARTMENT_NAME;
const college = process.env.COLLEGE_NAME;
const university = process.env.UNIVERSITY_NAME;
const address = process.env.COLLEGE_ADDRESS;

// Refined email template generator
function generateEmailTemplate({ subject, greeting, message, codeBlock, closing }) {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #EDEBE8; border-radius: 10px; border: 1px solid #5F6F52; box-shadow: 0 2px 8px rgba(95,111,82,0.08);">
      <div style="background: #5F6F52; color: #fff; padding: 20px 30px; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0;">${department}</h2>
        <p style="margin: 0; font-size: 1rem;">${college}</p>
        <p style="margin: 0; font-size: 0.95rem;">${university}</p>
      </div>
      <div style="padding: 30px;">
        <h3 style="color: #5F6F52; margin-top: 0;">${subject}</h3>
        <p>${greeting}</p>
        <p>${message}</p>
        ${codeBlock ? `<div style=\"background: #5F6F52; color: #fff; font-size: 2rem; font-weight: bold; padding: 15px 0; border-radius: 8px; text-align: center; margin: 20px 0; letter-spacing: 2px;\">${codeBlock}</div>` : ''}
        <p style="color: #333;">${closing}</p>
      </div>
      <div style="background: #5F6F52; color: #fff; padding: 15px 30px; border-radius: 0 0 10px 10px; font-size: 0.95rem;">
        <p style="margin: 0;">${address}</p>
        <p style="margin: 0; font-size: 0.9rem;">This is an automated message from the Seminar Management System. Please do not reply.</p>
      </div>
    </div>
    `;
}

// Refined OTP email
async function sendOTPEmail(email, otp, name = '') {
    if (!transporter) {
        console.error('Email transporter not initialized');
        return false;
    }
    try {
        const mailOptions = {
            from: {
                name: 'Seminar Management System',
                address: process.env.NodeMailer_email
            },
            to: email,
            subject: 'Your OTP for Seminar Management System',
            html: generateEmailTemplate({
                subject: 'OTP Verification',
                greeting: `Dear ${name || 'User'},`,
                message: 'Your One-Time Password (OTP) for verification is:',
                codeBlock: otp,
                closing: 'This OTP is valid for 5 minutes. Please do not share it with anyone. If you did not request this OTP, please ignore this email.'
            })
        };
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
}

// Refined password reset email
async function sendPasswordResetEmail(email, otp, name = '') {
    if (!transporter) {
        console.error('Email transporter not initialized');
        return false;
    }
    try {
        const mailOptions = {
            from: {
                name: 'Seminar Management System',
                address: process.env.NodeMailer_email
            },
            to: email,
            subject: 'Password Reset OTP for Seminar Management System',
            html: generateEmailTemplate({
                subject: 'Password Reset Request',
                greeting: `Dear ${name || 'User'},`,
                message: 'You have requested to reset your password. Use the following OTP to proceed:',
                codeBlock: otp,
                closing: 'This OTP is valid for 5 minutes. If you did not request a password reset, please ignore this email.'
            })
        };
        const info = await transporter.sendMail(mailOptions);
        console.log('Password reset email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending password reset email:', error);
        return false;
    }
}

// Refined reminder email
async function sendReminderEmail(email, name, bookTitle, returnDate) {
    if (!transporter) {
        console.error('Email transporter not initialized');
        return false;
    }
    try {
        const mailOptions = {
            from: {
                name: 'Seminar Management System',
                address: process.env.NodeMailer_email
            },
            to: email,
            subject: 'Book Return Reminder - Seminar Management System',
            html: generateEmailTemplate({
                subject: 'Book Return Reminder',
                greeting: `Dear ${name || 'User'},`,
                message: `This is a reminder that you have borrowed the book <b>${bookTitle}</b>. Please return it by <b>${new Date(returnDate).toLocaleDateString()}</b>.`,
                codeBlock: '',
                closing: 'If you have already returned the book, please ignore this message.'
            })
        };
        const info = await transporter.sendMail(mailOptions);
        console.log('Reminder email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending reminder email:', error);
        return false;
    }
}

// Function to store OTP
function storeOTP(email, otp) {
    otpStore.set(email, {
        otp,
        timestamp: Date.now(),
        attempts: 0
    });
}

// Function to verify OTP
function verifyOTP(email, otp) {
    const storedData = otpStore.get(email);
    if (!storedData) {
        return { valid: false, message: 'OTP not found or expired' };
    }

    // Check if OTP is expired (5 minutes)
    if (Date.now() - storedData.timestamp > 5 * 60 * 1000) {
        otpStore.delete(email);
        return { valid: false, message: 'OTP expired' };
    }

    // Check if too many attempts (max 3)
    if (storedData.attempts >= 3) {
        otpStore.delete(email);
        return { valid: false, message: 'Too many attempts. Please request a new OTP' };
    }

    // Increment attempts
    storedData.attempts++;
    otpStore.set(email, storedData);

    if (storedData.otp === otp) {
        otpStore.delete(email);
        return { valid: true, message: 'OTP verified successfully' };
    }

    return { valid: false, message: 'Invalid OTP' };
}

async function initializeApp() {
    try {
        console.log('Starting application initialization...');
        
        // Test database connection
        console.log('Testing database connection...');
        try {
            await sequelize.authenticate();
            console.log('Database connection established successfully');
        } catch (dbError) {
            console.error('Database connection error:', dbError);
            throw new Error('Failed to connect to database: ' + dbError.message);
        }

        // Sync database
        console.log('Syncing database...');
        try {
            await sequelize.sync({ force: false });
            console.log('Database synced successfully');
        } catch (syncError) {
            console.error('Database sync error:', syncError);
            throw new Error('Failed to sync database: ' + syncError.message);
        }

    } catch (error) {
        console.error('Error initializing application:', error);
        if (mainWindow) {
            mainWindow.loadFile('error.html');
        }
    }
}

function createWindow() {
    // Don't create a new window if one already exists
    if (mainWindow) {
        mainWindow.focus();
        return;
    }

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');

    // Handle window close
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Auth Handlers
ipcMain.handle('login', async (event, credentials) => {
    try {
        console.log('Login attempt with credentials:', credentials);
        
        const user = await User.findOne({
            where: {
                [Op.or]: [
                    { email: credentials.emailOrUsername },
                    { username: credentials.emailOrUsername }
                ]
            }
        });

        if (!user) {
            console.log('User not found');
            return { status: 'error', message: 'User not found' };
        }

        // In a real app, you should hash and compare passwords properly
        if (user.password === credentials.password) {
            console.log('Login successful for user:', user.username);
            return { 
                status: 'success', 
                user: { 
                    id: user.id, 
                    name: user.name, 
                    email: user.email,
                    username: user.username
                } 
            };
        } else {
            console.log('Invalid password for user:', user.username);
            return { status: 'error', message: 'Invalid password' };
        }
    } catch (error) {
        console.error('Login error:', error);
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('request-otp', async (event, { email, isRegistration = false }) => {
    try {
        console.log('OTP request for email:', email, 'isRegistration:', isRegistration);
        
        if (!transporter) {
            return { 
                status: 'error', 
                message: 'Email service not configured. Please contact administrator.' 
            };
        }

        if (!isRegistration) {
            // For password reset, check if user exists
            const user = await User.findOne({ where: { email } });
            if (!user) {
                console.log('User not found for password reset');
                return { status: 'error', message: 'User not found' };
            }
        }

        // Generate and store OTP
        const otp = generateOTP();
        storeOTP(email, otp);
        
        // Send OTP via email
        const emailSent = await sendOTPEmail(email, otp, isRegistration ? '' : user.name);
        if (!emailSent) {
            return { 
                status: 'error', 
                message: 'Failed to send OTP email. Please try again later or contact administrator.' 
            };
        }
        
        return { 
            status: 'success', 
            message: 'OTP sent successfully to your email address' 
        };
    } catch (error) {
        console.error('OTP request error:', error);
        return { 
            status: 'error', 
            message: 'An unexpected error occurred. Please try again later.' 
        };
    }
});

ipcMain.handle('verify-otp', async (event, { email, otp }) => {
    try {
        console.log('Verifying OTP for email:', email);
        
        const verification = verifyOTP(email, otp);
        if (!verification.valid) {
            return { 
                status: 'error', 
                message: verification.message
            };
        }

        // Generate a secure token for successful verification
        const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');
        
        return { 
            status: 'success', 
            message: verification.message,
            verifiedEmailToken: token
        };
    } catch (error) {
        console.error('OTP verification error:', error);
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('register', async (event, userData) => {
    try {
        console.log('Registering new user:', userData);
        
        // Check if username or email already exists
        const existingUser = await User.findOne({
            where: {
                [Op.or]: [
                    { email: userData.email },
                    { username: userData.username }
                ]
            }
        });

        if (existingUser) {
            return { 
                status: 'error', 
                message: existingUser.email === userData.email ? 
                    'Email already exists' : 'Username already exists' 
            };
        }

        // Create new user
        const newUser = await User.create({
            name: userData.name,
            username: userData.username,
            email: userData.email,
            password: userData.password // In a real app, hash the password
        });

        return { 
            status: 'success', 
            message: 'Registration successful',
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                username: newUser.username
            }
        };
    } catch (error) {
        console.error('Registration error:', error);
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('forgot-password', async (event, { email }) => {
    try {
        console.log('Forgot password request for email:', email);
        
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return { status: 'error', message: 'User not found' };
        }

        // Generate and store OTP
        const otp = generateOTP();
        storeOTP(email, otp);
        
        // Send OTP via email
        const emailSent = await sendPasswordResetEmail(email, otp, user.name);
        if (!emailSent) {
            return { 
                status: 'error', 
                message: 'Failed to send OTP email. Please try again later or contact administrator.' 
            };
        }
        
        return { 
            status: 'success', 
            message: 'OTP sent successfully to your email address' 
        };
    } catch (error) {
        console.error('Forgot password error:', error);
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('reset-password', async (event, { email, otp, newPassword }) => {
    try {
        console.log('Resetting password for email:', email);
        
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return { status: 'error', message: 'User not found' };
        }

        // In a real app, verify the OTP
        // For now, we'll just update the password
        user.password = newPassword; // In a real app, hash the password
        await user.save();

        return { 
            status: 'success', 
            message: 'Password reset successful'
        };
    } catch (error) {
        console.error('Reset password error:', error);
        return { status: 'error', message: error.message };
    }
});

// Book Handlers
ipcMain.handle('fetch-books', async (event, { page = 1, search = '' }) => {
    try {
        console.log('Fetching books, page:', page, 'search:', search);
        
        const limit = 10;
        const offset = (page - 1) * limit;
        
        const where = search ? {
            [Op.or]: [
                { Title: { [Op.like]: `%${search}%` } },
                { Author: { [Op.like]: `%${search}%` } },
                { Publisher: { [Op.like]: `%${search}%` } }
            ]
        } : {};

        const { count, rows } = await Book.findAndCountAll({
            where,
            limit,
            offset,
            order: [['createdAt', 'DESC']]
        });

        // Convert Sequelize instances to plain objects
        const plainBooks = rows.map(book => book.get({ plain: true }));
        console.log('Fetched books (plain):', plainBooks);

        return {
            status: 'success',
            books: plainBooks,
            totalPages: Math.ceil(count / limit)
        };
    } catch (error) {
        console.error('Fetch books error:', error);
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('add-book', async (event, { bookData }) => {
    try {
        console.log('Adding new book:', bookData);
        
        const book = await Book.create(bookData);
        
        return {
            status: 'success',
            message: 'Book added successfully',
            book
        };
    } catch (error) {
        console.error('Add book error:', error);
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('update-book', async (event, { bookId, bookData }) => {
    try {
        console.log('Updating book:', bookId, bookData);
        
        const book = await Book.findByPk(bookId);
        if (!book) {
            return { status: 'error', message: 'Book not found' };
        }

        await book.update(bookData);
        
        return {
            status: 'success',
            message: 'Book updated successfully',
            book
        };
    } catch (error) {
        console.error('Update book error:', error);
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('delete-book', async (event, { bookId }) => {
    try {
        console.log('Deleting book:', bookId);
        
        const book = await Book.findByPk(bookId);
        if (!book) {
            return { status: 'error', message: 'Book not found' };
        }

        await book.destroy();
        
        return {
            status: 'success',
            message: 'Book deleted successfully'
        };
    } catch (error) {
        console.error('Delete book error:', error);
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('issue-book', async (event, { bookId, name, email, returnDate, remarks }) => {
    try {
        console.log('Issuing book:', bookId, 'to:', name);
        const book = await Book.findByPk(bookId);
        if (!book) {
            return { status: 'error', message: 'Book not found' };
        }
        if (!book.Book_Status) {
            return { status: 'error', message: 'Book is already issued' };
        }
        const returnDateObj = new Date(returnDate);
        if (returnDateObj < new Date()) {
            return { status: 'error', message: 'Return date cannot be in the past' };
        }
        // Update book status
        await book.update({
            Book_Status: false,
            IssuedTo: {
                name,
                email,
                returnDate,
                remarks,
                issueDate: new Date()
            }
        });
        // Create issue log
        await IssueLog.create({
            bookId: book.ID,
            bookTitle: book.Title,
            issuerName: name,
            issuerEmail: email,
            issueDate: new Date(),
            expectedReturnDate: returnDate,
            remarks,
            isReturned: false
        });
        return {
            status: 'success',
            message: 'Book issued successfully'
        };
    } catch (error) {
        console.error('Issue book error:', error);
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('return-book', async (event, { bookId }) => {
    try {
        console.log('Returning book:', bookId);
        const book = await Book.findByPk(bookId);
        if (!book) {
            return { status: 'error', message: 'Book not found' };
        }
        if (book.Book_Status) {
            return { status: 'error', message: 'Book is not issued' };
        }
        // Update book status
        await book.update({
            Book_Status: true,
            IssuedTo: null
        });
        // Update latest issue log
        const latestLog = await IssueLog.findOne({
            where: { bookId, isReturned: false },
            order: [['createdAt', 'DESC']]
        });
        if (latestLog) {
            await latestLog.update({
                actualReturnDate: new Date(),
                isReturned: true
            });
        }
        return {
            status: 'success',
            message: 'Book returned successfully'
        };
    } catch (error) {
        console.error('Return book error:', error);
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('fetch-issued-books', async (event, { page = 1 }) => {
    try {
        console.log('Fetching issued books, page:', page);
        const limit = 10;
        const offset = (page - 1) * limit;
        // Fetch from IssueLog where isReturned is false
        const { count, rows } = await IssueLog.findAndCountAll({
            where: { isReturned: false },
            limit,
            offset,
            order: [['createdAt', 'DESC']]
        });
        // Only use data from IssueLog, no Book lookup
        const books = rows.map(log => log.get({ plain: true }));
        console.log('Fetched issued books (from logs only):', books);
        return {
            status: 'success',
            books,
            totalPages: Math.ceil(count / limit)
        };
    } catch (error) {
        console.error('Fetch issued books error:', error);
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('fetch-issue-logs', async (event, { page = 1, startDate, endDate }) => {
    try {
        console.log('Fetching issue logs, page:', page);
        
        const limit = 10;
        const offset = (page - 1) * limit;
        
        const where = {};
        if (startDate && endDate) {
            where.issueDate = {
                [Op.between]: [new Date(startDate), new Date(endDate)]
            };
        }
        
        const { count, rows } = await IssueLog.findAndCountAll({
            where,
            limit,
            offset,
            order: [['createdAt', 'DESC']]
        });

        // Convert Sequelize instances to plain objects
        const plainLogs = rows.map(log => log.get({ plain: true }));
        console.log('Fetched issue logs (plain):', plainLogs);

        return {
            status: 'success',
            logs: plainLogs,
            totalPages: Math.ceil(count / limit)
        };
    } catch (error) {
        console.error('Fetch issue logs error:', error);
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('export-logs', async (event) => {
    try {
        console.log('Exporting logs to Excel');
        
        const logs = await IssueLog.findAll();

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Issue Logs');

        // Add headers
        worksheet.columns = [
            { header: 'Book Title', key: 'bookTitle', width: 30 },
            { header: 'Issuer Name', key: 'issuerName', width: 20 },
            { header: 'Issuer Email', key: 'issuerEmail', width: 30 },
            { header: 'Issue Date', key: 'issueDate', width: 20 },
            { header: 'Expected Return', key: 'expectedReturnDate', width: 20 },
            { header: 'Actual Return', key: 'actualReturnDate', width: 20 },
            { header: 'Remarks', key: 'remarks', width: 40 }
        ];

        // Add data
        logs.forEach(log => {
            worksheet.addRow({
                bookTitle: log.bookTitle,
                issuerName: log.issuerName,
                issuerEmail: log.issuerEmail,
                issueDate: log.issueDate,
                expectedReturnDate: log.expectedReturnDate,
                actualReturnDate: log.actualReturnDate,
                remarks: log.remarks
            });
        });

        // Save to file
        const filePath = path.join(app.getPath('userData'), `issue_logs_${new Date().toISOString().split('T')[0]}.xlsx`);
        await workbook.xlsx.writeFile(filePath);

        return {
            status: 'success',
            message: 'Logs exported successfully',
            filePath
        };
    } catch (error) {
        console.error('Export logs error:', error);
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('validate-import', async (event, { filePath }) => {
    try {
        console.log('Validating import file:', filePath);
        
        const workbook = xlsx.readFile(filePath);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(worksheet);

        // Check required columns
        const requiredColumns = ['ID', 'Title', 'Author', 'Publisher'];
        const foundColumns = Object.keys(data[0] || {});
        const missingColumns = requiredColumns.filter(col => !foundColumns.includes(col));

        if (missingColumns.length > 0) {
            return {
                status: 'error',
                message: `Missing required columns: ${missingColumns.join(', ')}`
            };
        }

        return {
            status: 'success',
            message: 'File validated successfully',
            totalRows: data.length,
            columns: foundColumns
        };
    } catch (error) {
        console.error('Validate import error:', error);
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('bulk-import', async (event, { filePath, columnMapping }) => {
    try {
        console.log('Bulk importing books from:', filePath);
        
        const workbook = xlsx.readFile(filePath);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(worksheet);

        // Map columns if provided
        const mappedData = columnMapping ? 
            data.map(row => {
                const mappedRow = {};
                Object.entries(columnMapping).forEach(([fileCol, dbCol]) => {
                    mappedRow[dbCol] = row[fileCol];
                });
                return mappedRow;
            }) : data;

        // Import books
        const books = await Book.bulkCreate(mappedData, {
            validate: true,
            ignoreDuplicates: true
        });

        return {
            status: 'success',
            message: 'Books imported successfully',
            importedCount: books.length
        };
    } catch (error) {
        console.error('Bulk import error:', error);
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('send-reminder', async (event, { bookId }) => {
    try {
        console.log('Sending reminder for book:', bookId);
        
        const book = await Book.findByPk(bookId);
        if (!book) {
            return { status: 'error', message: 'Book not found' };
        }

        if (book.Book_Status) {
            return { status: 'error', message: 'Book is not issued' };
        }

        // Send reminder email
        if (transporter) {
            const emailSent = await sendReminderEmail(book.IssuedTo.email, book.IssuedTo.name, book.Title, book.IssuedTo.returnDate);
            if (emailSent) {
                return {
                    status: 'success',
                    message: 'Reminder sent successfully'
                };
            } else {
                return {
                    status: 'error',
                    message: 'Failed to send reminder email'
                };
            }
        } else {
            return {
                status: 'error',
                message: 'Email service not configured'
            };
        }
    } catch (error) {
        console.error('Send reminder error:', error);
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('fetch-book', async (event, { bookId }) => {
    try {
        console.log('Fetching book:', bookId);
        const book = await Book.findByPk(bookId);
        if (!book) {
            return { status: 'error', message: 'Book not found' };
        }
        // Return plain object
        return {
            status: 'success',
            book: book.get({ plain: true })
        };
    } catch (error) {
        console.error('Fetch book error:', error);
        return { status: 'error', message: error.message };
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
});

// Handle app ready
app.whenReady().then(() => {
    console.log('Electron app is ready, initializing...');
    initializeApp().then(() => {
        createWindow();
    });

    app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
    app.quit();
}); 