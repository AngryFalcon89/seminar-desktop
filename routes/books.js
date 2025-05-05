const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const { parse } = require('csv-parse/sync');
const Book = require('../sql-models/Book');
const IssueLog = require('../sql-models/IssueLog');
const auth = require('../middleware/auth');
const { isNumeric, isAlphanumeric, isDate, isAlpha } = require('validator');
const { default: isEmail } = require('validator/lib/isEmail');
const nodemailer = require('nodemailer');
const XLSX = require('xlsx');
const { Op } = require('sequelize');

// Configure multer for file upload
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || 
            file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimetype === 'application/vnd.ms-excel') {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
        }
    }
});

// Create a new book
router.post('/', auth, async (req, res) => {
    try {
        const {
            ID,
            Accession_Number,
            MAL_ACC_Number,
            Author,
            Title,
            Publisher,
            Edition,
            Publishing_Year,
            Author1,
            Author2,
            Author3,
            Category1,
            Category2,
            Category3,
        } = req.body;

        // ID validation
        if (!('ID' in req.body) || !ID) {
            return res.status(400).json({ status: 'fail', message: 'Please provide ID' });
        }
        if (!isNumeric(ID)) {
            return res.status(400).json({ status: 'fail', message: 'ID is not a number' });
        }
        if (await Book.findOne({ where: { ID } })) {
            return res.status(400).json({ status: 'fail', message: 'Please provide a unique ID' });
        }

        // Accession_Number validation
        if (Accession_Number && !isNumeric(Accession_Number)) {
            return res.status(400).json({ status: 'fail', message: 'Accession_Number is not a number' });
        }

        // MAL_ACC_Number validation
        if (MAL_ACC_Number && !isNumeric(MAL_ACC_Number)) {
            return res.status(400).json({ status: 'fail', message: 'MAL_ACC_Number is not a number' });
        }

        // Author validation
        if (!('Author' in req.body) || !Author) {
            return res.status(400).json({ status: 'fail', message: 'Please provide Author' });
        }
        if (!isAlphanumeric(Author, 'en-US', { ignore: ' ' })) {
            return res.status(400).json({ status: 'fail', message: 'Author can only be alphanumeric' });
        }

        // Title validation
        if (!('Title' in req.body) || !Title) {
            return res.status(400).json({ status: 'fail', message: 'Please provide Title' });
        }
        if (!isAlphanumeric(Title, 'en-US', { ignore: ' ' })) {
            return res.status(400).json({ status: 'fail', message: 'Title can only be alphanumeric' });
        }

        // Publisher validation
        if (!('Publisher' in req.body) || !Publisher) {
            return res.status(400).json({ status: 'fail', message: 'Please provide Publisher' });
        }
        if (!isAlphanumeric(Publisher, 'en-US', { ignore: ' ,.' })) {
            return res.status(400).json({ status: 'fail', message: 'Publisher can only be alphanumeric' });
        }

        // Edition validation
        if (Edition && !isAlphanumeric(Edition, 'en-US', { ignore: ' ' })) {
            return res.status(400).json({ status: 'fail', message: 'Edition can only be alphanumeric' });
        }

        // Publishing_Year validation
        let validatedPublishingYear = null;
        if (Publishing_Year) {
            const year = parseInt(Publishing_Year);
            if (isNaN(year) || year < 1800 || year > new Date().getFullYear() + 1) {
                return res.status(400).json({ 
                    status: 'fail', 
                    message: 'Publishing Year must be a valid year between 1800 and next year' 
                });
            }
            validatedPublishingYear = year;
        }

        // Additional authors validation
        if (Author1 && !isAlphanumeric(Author1, 'en-US', { ignore: ' ' })) {
            return res.status(400).json({ status: 'fail', message: 'Author1 is not alphanumeric' });
        }
        if (Author2 && !isAlphanumeric(Author2, 'en-US', { ignore: ' ' })) {
            return res.status(400).json({ status: 'fail', message: 'Author2 is not alphanumeric' });
        }
        if (Author3 && !isAlphanumeric(Author3, 'en-US', { ignore: ' ' })) {
            return res.status(400).json({ status: 'fail', message: 'Author3 is not alphanumeric' });
        }

        // Categories validation
        if (Category1 && !isAlphanumeric(Category1, 'en-US', { ignore: ' ' })) {
            return res.status(400).json({ status: 'fail', message: 'Category1 is not alphanumeric' });
        }
        if (Category2 && !isAlphanumeric(Category2, 'en-US', { ignore: ' ' })) {
            return res.status(400).json({ status: 'fail', message: 'Category2 is not alphanumeric' });
        }
        if (Category3 && !isAlphanumeric(Category3, 'en-US', { ignore: ' ' })) {
            return res.status(400).json({ status: 'fail', message: 'Category3 is not alphanumeric' });
        }

        const newBook = await Book.create({
            ID,
            Accession_Number,
            MAL_ACC_Number,
            Author,
            Edition,
            Title,
            Publishing_Year: validatedPublishingYear,
            Publisher,
            Author1,
            Author2,
            Author3,
            Category1,
            Category2,
            Category3,
        });

        return res.status(200).json({ status: 'success', message: 'Book Saved Successfully', newBook });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: 'error', message: error.message });
    }
});

// Get all books with search and pagination
router.get('/', auth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';

        let whereClause = {};
        if (search) {
            // If search is a number, search in numeric fields
            if (!isNaN(search)) {
                whereClause = {
                    [Op.or]: [
                        { ID: parseInt(search) },
                        { Accession_Number: parseInt(search) },
                        { MAL_ACC_Number: parseInt(search) }
                    ]
                };
            } else {
                // If search is text, search in text fields
                whereClause = {
                    [Op.or]: [
                        { Author: { [Op.like]: `%${search}%` } },
                        { Title: { [Op.like]: `%${search}%` } },
                        { Publisher: { [Op.like]: `%${search}%` } },
                        { Category1: { [Op.like]: `%${search}%` } },
                        { Category2: { [Op.like]: `%${search}%` } },
                        { Category3: { [Op.like]: `%${search}%` } }
                    ]
                };
            }
        }

        const { count, rows: books } = await Book.findAndCountAll({
            where: whereClause,
            offset: (page - 1) * limit,
            limit: limit,
            order: [['Accession_Number', 'ASC']]
        });

        const totalPages = Math.ceil(count / limit);

        res.json({
            books,
            currentPage: page,
            totalPages,
            totalBooks: count
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ message: 'Error fetching books', error: error.message });
    }
});

// Get currently issued books
router.get('/issued', auth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const { count, rows: issuedBooks } = await IssueLog.findAndCountAll({
            where: { isReturned: false },
            offset: offset,
            limit: limit,
            order: [['issueDate', 'DESC']]
        });

        const totalPages = Math.ceil(count / limit);

        res.json({
            books: issuedBooks,
            currentPage: page,
            totalPages,
            totalBooks: count
        });
    } catch (error) {
        console.error('Error fetching issued books:', error);
        res.status(500).json({ message: 'Error fetching issued books', error: error.message });
    }
});

// Export issue logs to Excel
router.get('/export-logs', auth, async (req, res) => {
    try {
        const logs = await IssueLog.findAll({
            order: [['issueDate', 'DESC']]
        });

        // Prepare data for Excel
        const data = logs.map(log => ({
            'Book Title': log.bookTitle || 'Unknown',
            'Issuer Name': log.issuerName,
            'Issuer Email': log.issuerEmail,
            'Issue Date': log.issueDate.toLocaleDateString(),
            'Expected Return Date': log.expectedReturnDate.toLocaleDateString(),
            'Actual Return Date': log.actualReturnDate ? log.actualReturnDate.toLocaleDateString() : 'Not Returned',
            'Status': log.isReturned ? 'Returned' : 'Issued',
            'Remarks': log.remarks || ''
        }));

        // Create workbook and worksheet
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(data);

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Issue Logs');

        // Generate buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=issue_logs.xlsx');

        // Send the file
        res.send(buffer);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ message: 'Error exporting logs', error: error.message });
    }
});

// Get issue logs
router.get('/issue-logs', auth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;

        let whereClause = {};
        
        if (startDate && endDate) {
            whereClause.issueDate = {
                [Op.between]: [new Date(startDate), new Date(endDate)]
            };
        }

        const { count, rows: logs } = await IssueLog.findAndCountAll({
            where: whereClause,
            limit,
            offset,
            order: [['issueDate', 'DESC']]
        });

        res.status(200).json({
            status: 'success',
            logs,
            currentPage: page,
            totalPages: Math.ceil(count / limit)
        });
    } catch (error) {
        console.error('Error fetching issue logs:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Get a single book
router.get('/:bookId', auth, async (req, res) => {
    try {
        const book = await Book.findOne({ 
            where: { ID: req.params.bookId } 
        });
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }
        res.json({ book });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching book', error: error.message });
    }
});

// Delete a book
router.delete('/:bookId', auth, async (req, res) => {
    try {
        const book = await Book.findOne({ where: { ID: req.params.bookId } });
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }

        // Delete related issue logs first
        await IssueLog.destroy({ where: { bookId: book.ID } });
        await book.destroy();
        res.json({ message: 'Book deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting book', error: error.message });
    }
});

// Update a book
router.patch('/:bookId', auth, async (req, res) => {
    try {
        const book = await Book.findOne({ 
            where: { ID: req.params.bookId } 
        });
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }

        // If ID is being updated, check if it's unique
        if (req.body.ID && req.body.ID != book.ID) {
            const existingBook = await Book.findOne({ 
                where: { ID: req.body.ID } 
            });
            if (existingBook) {
                return res.status(400).json({ message: 'Book ID already exists' });
            }
        }

        // If Publishing_Year is being updated, validate and convert it
        if (req.body.Publishing_Year !== undefined) {
            const year = parseInt(req.body.Publishing_Year);
            if (isNaN(year) || year < 1800 || year > new Date().getFullYear() + 1) {
                return res.status(400).json({ 
                    status: 'fail', 
                    message: 'Publishing Year must be a valid year between 1800 and next year' 
                });
            }
            req.body.Publishing_Year = year;
        }

        // Update book fields
        await book.update(req.body);
        
        res.json({ message: 'Book updated successfully', book });
    } catch (error) {
        res.status(500).json({ message: 'Error updating book', error: error.message });
    }
});

// Issue a book
router.post('/:bookId/issue', auth, async (req, res) => {
    try {
        const { name, email, returnDate, remarks } = req.body;
        
        if (!name || !email || !returnDate) {
            return res.status(400).json({ message: 'Name, email, and return date are required' });
        }

        const book = await Book.findOne({ 
            where: { ID: req.params.bookId } 
        });
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }

        if (!book.Book_Status) {
            return res.status(400).json({ message: 'Book is not available for issue' });
        }

        // Create issue log
        const issueLog = new IssueLog({
            bookId: book.ID,
            bookTitle: book.Title,
            issuerName: name,
            issuerEmail: email,
            expectedReturnDate: new Date(returnDate),
            remarks
        });

        // Update book status
        book.IssuedTo = {
            name,
            email,
            issuedAt: new Date(),
            returnDate: new Date(returnDate),
            remarks
        };
        book.Book_Status = false;

        await Promise.all([issueLog.save(), book.save()]);
        res.json({ message: 'Book issued successfully', book, issueLog });
    } catch (error) {
        res.status(500).json({ message: 'Error issuing book', error: error.message });
    }
});

// Return a book
router.post('/:bookId/return', auth, async (req, res) => {
    try {
        const book = await Book.findOne({ 
            where: { ID: req.params.bookId } 
        });
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }

        if (book.Book_Status) {
            return res.status(400).json({ message: 'Book is not issued' });
        }

        // Update issue log
        const issueLog = await IssueLog.findOne({
            where: {
                bookId: book.ID,
                isReturned: false
            }
        });

        if (issueLog) {
            issueLog.isReturned = true;
            issueLog.actualReturnDate = new Date();
            await issueLog.save();
        }

        // Update book status
        book.IssuedTo = null;
        book.Book_Status = true;

        await book.save();
        res.json({ message: 'Book returned successfully', book });
    } catch (error) {
        res.status(500).json({ message: 'Error returning book', error: error.message });
    }
});

// Validate import file
router.post('/validate-import', auth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: 'error', message: 'No file uploaded' });
        }

        const file = req.file;
        let data;
        let columns;

        // Parse file based on type
        if (file.mimetype === 'text/csv') {
            try {
                // Convert buffer to string
                const fileContent = file.buffer.toString('utf-8');
                console.log('CSV Content:', fileContent.substring(0, 200) + '...'); // Debug log
                
                // Parse CSV synchronously using csv-parse/sync
                const records = parse(fileContent, {
                    columns: true,
                    skip_empty_lines: true,
                    trim: true,
                    relax_quotes: true,
                    relax_column_count: true
                });

                console.log('Parsed Records:', records.length); // Debug log
                console.log('First Record:', records[0]); // Debug log

                if (records.length === 0) {
                    throw new Error('No records found in CSV file');
                }

                data = records;
                columns = Object.keys(records[0] || {});
                console.log('Columns found:', columns); // Debug log
            } catch (csvError) {
                console.error('CSV Parsing Error:', csvError);
                return res.status(400).json({ 
                    status: 'error', 
                    message: 'Error parsing CSV file: ' + csvError.message 
                });
            }
        } else {
            // Excel file
            const workbook = xlsx.read(file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            data = xlsx.utils.sheet_to_json(worksheet);
            columns = Object.keys(data[0] || {});
        }

        // Check if we need column mapping
        const requiredColumns = ['ID', 'Title', 'Author', 'Publisher'];
        const needsMapping = requiredColumns.some(col => !columns.includes(col));

        let mappingOptions = [];
        if (needsMapping) {
            mappingOptions = columns.map(col => ({
                fileColumn: col,
                suggestedMapping: findSuggestedMapping(col)
            }));
        }

        res.json({
            status: 'success',
            totalRows: data.length,
            columns,
            needsMapping,
            mappingOptions
        });
    } catch (error) {
        console.error('File validation error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Bulk import books
router.post('/bulk-import', auth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: 'error', message: 'No file uploaded' });
        }

        const file = req.file;
        let records = [];
        let columns = [];

        // Parse file based on type
        if (file.mimetype === 'text/csv') {
            try {
                const fileContent = file.buffer.toString('utf-8');
                records = parse(fileContent, {
                    columns: true,
                    skip_empty_lines: true,
                    trim: true,
                    relax_quotes: true,
                    relax_column_count: true
                });
                
                if (records.length === 0) {
                    return res.status(400).json({ 
                        status: 'error', 
                        message: 'No records found in CSV file' 
                    });
                }

                columns = Object.keys(records[0]);
            } catch (error) {
                console.error('CSV parsing error:', error);
                return res.status(400).json({ 
                    status: 'error', 
                    message: 'Error parsing CSV file: ' + error.message 
                });
            }
        } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                   file.mimetype === 'application/vnd.ms-excel') {
            try {
                const workbook = xlsx.read(file.buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                records = xlsx.utils.sheet_to_json(worksheet);
                
                if (records.length === 0) {
                    return res.status(400).json({ 
                        status: 'error', 
                        message: 'No records found in Excel file' 
                    });
                }

                columns = Object.keys(records[0]);
            } catch (error) {
                console.error('Excel parsing error:', error);
                return res.status(400).json({ 
                    status: 'error', 
                    message: 'Error parsing Excel file: ' + error.message 
                });
            }
        }

        // Transform records to match our schema
        const transformedRecords = records.map(record => {
            const transformed = {};
            
            // Map fields based on column names
            Object.keys(record).forEach(key => {
                const value = record[key];
                
                // Skip empty values
                if (value === '' || value === null || value === undefined) {
                    return;
                }

                // Handle numeric fields
                if (["ID", "Accession_Number", "MAL_ACC_Number"].includes(key)) {
                    transformed[key] = parseInt(value) || null;
                }
                // Handle publishing year specifically
                else if (key === 'Publishing_Year') {
                    const year = parseInt(value);
                    if (!isNaN(year) && year >= 1800 && year <= new Date().getFullYear()) {
                        transformed[key] = year;
                    }
                }
                // Handle boolean fields
                else if (key === 'Book_Status') {
                    transformed[key] = value.toLowerCase() === 'true';
                }
                // Handle string fields
                else {
                    transformed[key] = value.toString().trim();
                }
            });

            return transformed;
        });

        // Insert records using Sequelize bulkCreate
        const result = await Book.bulkCreate(transformedRecords, { ignoreDuplicates: true });

        res.json({
            status: 'success',
            message: 'Books imported successfully',
            importedCount: result.length,
            totalRecords: records.length
        });
    } catch (error) {
        console.error('Bulk import error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Error importing books: ' + error.message 
        });
    }
});

// Helper function to suggest column mapping
function findSuggestedMapping(column) {
    const mappingRules = {
        'id': 'ID',
        'book id': 'ID',
        'bookid': 'ID',
        'book_id': 'ID',
        'title': 'Title',
        'book title': 'Title',
        'booktitle': 'Title',
        'book_title': 'Title',
        'author': 'Author',
        'writer': 'Author',
        'publisher': 'Publisher',
        'publishing company': 'Publisher',
        'publishing_company': 'Publisher',
        'accession': 'Accession_Number',
        'accession number': 'Accession_Number',
        'accession_number': 'Accession_Number',
        'mal acc': 'MAL_ACC_Number',
        'mal_acc': 'MAL_ACC_Number',
        'malacc': 'MAL_ACC_Number',
        'edition': 'Edition',
        'publishing year': 'Publishing_Year',
        'publishing_year': 'Publishing_Year',
        'year': 'Publishing_Year',
        'category': 'Category1',
        'main category': 'Category1',
        'category1': 'Category1',
        'sub category': 'Category2',
        'category2': 'Category2',
        'tertiary category': 'Category3',
        'category3': 'Category3'
    };

    return mappingRules[column.toLowerCase()] || null;
}

// Send reminder for issued book
router.post('/:bookId/send-reminder', auth, async (req, res) => {
    try {
        const book = await Book.findOne({ 
            where: { ID: req.params.bookId } 
        });
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }

        if (book.Book_Status) {
            return res.status(400).json({ message: 'Book is not issued' });
        }

        if (!book.IssuedTo || !book.IssuedTo.email) {
            return res.status(400).json({ message: 'No email found for the person who issued the book' });
        }

        // Create HTML email content
        const emailContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                    }
                    .container {
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .header {
                        background-color: #1a237e;
                        color: white;
                        padding: 20px;
                        text-align: center;
                        border-radius: 5px 5px 0 0;
                    }
                    .content {
                        background-color: #f9f9f9;
                        padding: 20px;
                        border: 1px solid #ddd;
                        border-radius: 0 0 5px 5px;
                    }
                    .book-details {
                        background-color: white;
                        padding: 15px;
                        border-radius: 5px;
                        margin: 15px 0;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 20px;
                        padding-top: 20px;
                        border-top: 1px solid #ddd;
                        font-size: 0.9em;
                        color: #666;
                    }
                    .highlight {
                        color: #1a237e;
                        font-weight: bold;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>Book Return Reminder</h2>
                    </div>
                    <div class="content">
                        <p>Dear ${book.IssuedTo.name},</p>
                        <p>This is a reminder that you have borrowed the following book:</p>
                        <div class="book-details">
                            <p><strong>Book Title:</strong> ${book.Title}</p>
                            <p><strong>Book ID:</strong> ${book.ID}</p>
                            <p><strong>Expected Return Date:</strong> ${new Date(book.IssuedTo.returnDate).toLocaleDateString()}</p>
                        </div>
                        <p>Please return the book by the expected return date.</p>
                        <div class="footer">
                            <p>Thank you for your cooperation.</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Send email using nodemailer
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.NodeMailer_email,
                pass: process.env.NodeMailer_password
            }
        });

        const mailOptions = {
            from: process.env.NodeMailer_email,
            to: book.IssuedTo.email,
            subject: `Book Return Reminder - ${book.Title}`,
            html: emailContent
        };

        await transporter.sendMail(mailOptions);

        res.json({ message: 'Reminder sent successfully' });
    } catch (error) {
        console.error('Error sending reminder:', error);
        res.status(500).json({ message: 'Error sending reminder', error: error.message });
    }
});

module.exports = router; 