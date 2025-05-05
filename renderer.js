const { ipcRenderer, shell } = require('electron');

// DOM Elements
const authContainer = document.getElementById('auth-container');
const mainContainer = document.getElementById('main-container');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const resetPasswordForm = document.getElementById('reset-password-form');
const booksContainer = document.getElementById('books-container');
const searchInput = document.getElementById('search-input');
const addBookBtn = document.getElementById('add-book-btn');
const viewIssuedBtn = document.getElementById('view-issued-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');
const showResetPasswordLink = document.getElementById('showResetPassword');
const showLoginFromResetLink = document.getElementById('showLoginFromReset');
const searchButton = document.getElementById('search-button');
const requestOtpBtn = document.getElementById('request-otp-btn');
const requestResetOtpBtn = document.getElementById('request-reset-otp-btn');
const bulkImportBtn = document.getElementById('bulk-import-btn');
const bulkImportModal = document.getElementById('bulk-import-modal');
const bulkImportForm = document.getElementById('bulk-import-form');
const importFile = document.getElementById('import-file');
const filePreview = document.getElementById('file-preview');
const previewContent = document.getElementById('preview-content');
const columnMapping = document.getElementById('column-mapping');
const mappingContent = document.getElementById('mapping-content');
const importSubmitBtn = document.getElementById('import-submit-btn');

// Modal Elements
const addBookModal = document.getElementById('add-book-modal');
const issueBookModal = document.getElementById('issue-book-modal');
const editBookModal = document.getElementById('edit-book-modal');
const issuedBooksModal = document.getElementById('issued-books-modal');
const closeButtons = document.querySelectorAll('.close');

// Form Elements
const addBookForm = document.getElementById('add-book-form');
const issueBookForm = document.getElementById('issue-book-form');
const editBookForm = document.getElementById('edit-book-form');

// State
let currentPage = 1;
let totalPages = 1;
let currentUser = null;

// Tab handling
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// State for date range filter
let issueLogsStartDate = '';
let issueLogsEndDate = '';

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
    const currentYearPlusOne = new Date().getFullYear();
    const addYearInput = document.getElementById('book-publishing-year');
    const editYearInput = document.getElementById('edit-book-publishing-year');
    if (addYearInput) addYearInput.max = currentYearPlusOne;
    if (editYearInput) editYearInput.max = currentYearPlusOne;
});

function setupEventListeners() {
    // Auth Forms
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (registerForm) registerForm.addEventListener('submit', handleRegister);
    if (resetPasswordForm) resetPasswordForm.addEventListener('submit', handleResetPassword);
    
    if (showRegisterLink) showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        resetPasswordForm.style.display = 'none';
    });
    
    if (showLoginLink) showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
        resetPasswordForm.style.display = 'none';
    });

    if (showResetPasswordLink) showResetPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        registerForm.style.display = 'none';
        resetPasswordForm.style.display = 'block';
    });

    if (showLoginFromResetLink) showLoginFromResetLink.addEventListener('click', (e) => {
        e.preventDefault();
        resetPasswordForm.style.display = 'none';
        loginForm.style.display = 'block';
    });

    if (requestOtpBtn) requestOtpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleRequestOTP();
    });

    if (requestResetOtpBtn) requestResetOtpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleRequestResetOTP();
    });

    // Main Actions
    if (searchInput) {
        // Search on input with debounce
        searchInput.addEventListener('input', debounce(() => {
            const searchTerm = searchInput.value.trim();
            currentPage = 1;
            fetchBooks(currentPage, searchTerm);
        }, 300));

        // Search on button click
        const searchBtn = document.getElementById('search-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const searchTerm = searchInput.value.trim();
                currentPage = 1;
                fetchBooks(currentPage, searchTerm);
            });
        }

        // Search on Enter key
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const searchTerm = searchInput.value.trim();
                currentPage = 1;
                fetchBooks(currentPage, searchTerm);
            }
        });
    }

    if (addBookBtn) addBookBtn.addEventListener('click', () => showModal(addBookModal));
    if (viewIssuedBtn) viewIssuedBtn.addEventListener('click', () => {
        fetchIssuedBooks();
        showModal(issuedBooksModal);
    });
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // Close Modals
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            hideAllModals();
        });
    });

    // Forms
    if (addBookForm) addBookForm.addEventListener('submit', handleAddBook);
    if (issueBookForm) issueBookForm.addEventListener('submit', handleIssueBook);
    if (editBookForm) editBookForm.addEventListener('submit', (e) => handleEditBook(e, e.target.dataset.bookId));

    // Tab handling
    tabButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const tabId = button.dataset.tab;
            
            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show selected tab content
            tabContents.forEach(content => {
                content.style.display = content.id === `${tabId}-tab` ? 'block' : 'none';
            });
            
            // Load content based on tab
            if (tabId === 'books') {
                await fetchBooks();
            } else if (tabId === 'issued') {
                await fetchIssuedBooks();
            } else if (tabId === 'logs') {
                await fetchIssueLogs();
            }
        });
    });

    // Bulk Import
    if (bulkImportBtn) {
        bulkImportBtn.addEventListener('click', () => showModal(bulkImportModal));
    }

    if (importFile) {
        importFile.addEventListener('change', handleFileSelect);
    }

    if (bulkImportForm) {
        bulkImportForm.addEventListener('submit', handleBulkImport);
    }
}

// Auth Functions
async function handleLogin(e) {
    e.preventDefault();
    const emailOrUsername = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        console.log('Attempting login with:', { emailOrUsername });
        const response = await ipcRenderer.invoke('login', { emailOrUsername, password });
        
        if (response.status === 'success') {
            console.log('Login successful:', response.user);
            currentUser = response.user;
            showMainContainer();
            fetchBooks();
        } else {
            showNotification(response.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('An error occurred during login', 'error');
    }
}

async function handleRequestOTP() {
    const name = document.getElementById('register-name').value;
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    if (!name || !username || !email || !password) {
        showNotification('Please fill all fields', 'error');
        return;
    }

    try {
        // Disable button and show loading state
        requestOtpBtn.disabled = true;
        requestOtpBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending OTP...';

        const data = await ipcRenderer.invoke('request-otp', { email, isRegistration: true });
        console.log('OTP Response:', data);
        
        if (data.status === 'success') {
            document.getElementById('otp-section').style.display = 'block';
            showNotification('OTP sent to your email', 'success');
            requestOtpBtn.innerHTML = '<i class="fas fa-check"></i> OTP Sent';
            requestOtpBtn.disabled = true;
        } else {
            showNotification(data.message || 'Failed to send OTP', 'error');
            requestOtpBtn.disabled = false;
            requestOtpBtn.innerHTML = 'Request OTP';
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error sending OTP', 'error');
        requestOtpBtn.disabled = false;
        requestOtpBtn.innerHTML = 'Request OTP';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const otp = document.getElementById('register-otp').value;

    try {
        // First verify OTP
        const verifyResponse = await ipcRenderer.invoke('verify-otp', { email, otp });
        
        if (verifyResponse.status !== 'success') {
            showNotification(verifyResponse.message || 'OTP verification failed', 'error');
            return;
        }

        // Then register the user
        const registerResponse = await ipcRenderer.invoke('register', { 
            name, 
            username, 
            email, 
            password
        });

        if (registerResponse.status === 'success') {
            showNotification('Registration successful! Please login.', 'success');
            // Clear form fields
            document.getElementById('register-name').value = '';
            document.getElementById('register-username').value = '';
            document.getElementById('register-email').value = '';
            document.getElementById('register-password').value = '';
            document.getElementById('register-otp').value = '';
            document.getElementById('otp-section').style.display = 'none';
            // Switch to login form
            document.getElementById('register-form').style.display = 'none';
            document.getElementById('login-form').style.display = 'block';
        } else {
            showNotification(registerResponse.message || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error during registration', 'error');
    }
}

async function handleRequestResetOTP() {
    const email = document.getElementById('reset-email').value;

    if (!email) {
        showNotification('Please enter your email', 'error');
        return;
    }

    try {
        // Disable button and show loading state
        requestResetOtpBtn.disabled = true;
        requestResetOtpBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending OTP...';

        const data = await ipcRenderer.invoke('forgot-password', { email });
        
        if (data.status === 'success') {
            document.getElementById('reset-otp-section').style.display = 'block';
            showNotification('OTP sent to your email', 'success');
            requestResetOtpBtn.innerHTML = '<i class="fas fa-check"></i> OTP Sent';
            requestResetOtpBtn.disabled = true;
        } else {
            showNotification(data.message || 'Failed to send OTP', 'error');
            requestResetOtpBtn.disabled = false;
            requestResetOtpBtn.innerHTML = 'Request OTP';
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error sending OTP', 'error');
        requestResetOtpBtn.disabled = false;
        requestResetOtpBtn.innerHTML = 'Request OTP';
    }
}

async function handleResetPassword(e) {
    e.preventDefault();
    const email = document.getElementById('reset-email').value;
    const otp = document.getElementById('reset-otp').value;
    const newPassword = document.getElementById('reset-password').value;
    const confirmPassword = document.getElementById('reset-confirm-password').value;

    if (!email || !otp || !newPassword || !confirmPassword) {
        showNotification('Please fill all fields', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }

    try {
        const response = await ipcRenderer.invoke('reset-password', { email, otp, newPassword });

        if (response.status === 'success') {
            showNotification('Password reset successful! Please login with your new password.', 'success');
            // Clear form fields
            document.getElementById('reset-email').value = '';
            document.getElementById('reset-otp').value = '';
            document.getElementById('reset-password').value = '';
            document.getElementById('reset-confirm-password').value = '';
            document.getElementById('reset-otp-section').style.display = 'none';
            // Switch to login form
            resetPasswordForm.style.display = 'none';
            loginForm.style.display = 'block';
        } else {
            showNotification(response.message || 'Password reset failed', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error during password reset', 'error');
    }
}

// Book Functions
async function fetchBooks(page = 1, search = '') {
    try {
        const response = await ipcRenderer.invoke('fetch-books', { page, search });

        if (response.status === 'success') {
            displayBooks(response.books);
            updatePagination(response.totalPages);
        } else {
            showNotification(response.message || 'Failed to fetch books', 'error');
        }
    } catch (error) {
        console.error('Error fetching books:', error);
        showNotification('Error fetching books', 'error');
    }
}

function displayBooks(books) {
    const booksContainer = document.getElementById('books-container');
    booksContainer.innerHTML = '';

    books.forEach(book => {
        const publishingYear = book.Publishing_Year ? book.Publishing_Year : 'N/A';

        const bookCard = document.createElement('div');
        bookCard.className = 'book-card';
        bookCard.innerHTML = `
            <div class="book-info">
                <h3>${book.Title}</h3>
                <p><strong>ID:</strong> ${book.ID}</p>
                <p><strong>Accession Number:</strong> ${book.Accession_Number || 'N/A'}</p>
                <p><strong>Author:</strong> ${book.Author}</p>
                <p><strong>Publisher:</strong> ${book.Publisher}</p>
                <p><strong>Publishing Year:</strong> ${publishingYear}</p>
                <p><strong>Status:</strong> <span class="status-badge ${book.Book_Status ? 'available' : 'issued'}">${book.Book_Status ? 'Available' : 'Issued'}</span></p>
                ${!book.Book_Status && book.IssuedTo ? `
                    <p><strong>Issued To:</strong> ${book.IssuedTo.name}</p>
                    <p><strong>Return Date:</strong> ${new Date(book.IssuedTo.returnDate).toLocaleDateString()}</p>
                ` : ''}
            </div>
            <div class="book-actions">
                <button onclick="showEditModal('${book.ID}')" class="btn-secondary">
                    <i class="fas fa-edit"></i> Edit
                </button>
                ${book.Book_Status ? `
                    <button onclick="showIssueModal('${book.ID}')" class="btn-primary">
                        <i class="fas fa-book"></i> Issue
                    </button>
                ` : `
                    <button onclick="handleReturnBook('${book.ID}')" class="btn-warning">
                        <i class="fas fa-undo"></i> Return
                    </button>
                `}
                <button onclick="handleDeleteBook('${book.ID}')" class="btn-danger">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        booksContainer.appendChild(bookCard);
    });
}

async function handleAddBook(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const bookData = {
        ID: formData.get('ID'),
        Accession_Number: formData.get('Accession_Number') || null,
        MAL_ACC_Number: formData.get('MAL_ACC_Number') || null,
        Author: formData.get('Author'),
        Title: formData.get('Title'),
        Publisher: formData.get('Publisher'),
        Edition: formData.get('Edition'),
        Publishing_Year: parseInt(formData.get('Publishing_Year')) || null,
        Author1: formData.get('Author1'),
        Author2: formData.get('Author2'),
        Author3: formData.get('Author3'),
        Category1: formData.get('Category1'),
        Category2: formData.get('Category2'),
        Category3: formData.get('Category3')
    };

    try {
        const response = await ipcRenderer.invoke('add-book', { bookData });

        if (response.status === 'success') {
            showNotification('Book added successfully', 'success');
            hideAllModals();
            e.target.reset();
            fetchBooks();
        } else {
            showNotification(response.message || 'Failed to add book', 'error');
        }
    } catch (error) {
        showNotification(error.message || 'Error adding book', 'error');
    }
}

async function handleIssueBook(event) {
    event.preventDefault();
    const form = event.target;
    const bookId = form.querySelector('input[name="bookId"]').value;
    const name = form.querySelector('input[name="name"]').value;
    const email = form.querySelector('input[name="email"]').value;
    const returnDate = form.querySelector('input[name="returnDate"]').value;
    const remarks = form.querySelector('textarea[name="remarks"]').value;

    try {
        const response = await ipcRenderer.invoke('issue-book', { bookId, name, email, returnDate, remarks });

        if (response.status === 'success') {
            showNotification('Book issued successfully', 'success');
            hideAllModals();
            form.reset();
            fetchBooks();
        } else {
            showNotification(response.message || 'Failed to issue book', 'error');
        }
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleReturnBook(bookId) {
    if (!confirm('Are you sure you want to return this book?')) {
        return;
    }

    try {
        const response = await ipcRenderer.invoke('return-book', { bookId });

        if (response.status === 'success') {
            showNotification('Book returned successfully', 'success');
            
            // Check which tab is currently active and refresh accordingly
            const activeTab = document.querySelector('.tab-btn.active');
            if (activeTab && activeTab.dataset.tab === 'issued') {
                await fetchIssuedBooks();
            } else {
                fetchBooks();
            }
        } else {
            showNotification(response.message || 'Failed to return book', 'error');
        }
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleDeleteBook(bookId) {
    if (!confirm('Are you sure you want to delete this book?')) {
        return;
    }

    try {
        const response = await ipcRenderer.invoke('delete-book', { bookId });

        if (response.status === 'success') {
            showNotification('Book deleted successfully', 'success');
            fetchBooks();
        } else {
            showNotification(response.message || 'Failed to delete book', 'error');
        }
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function fetchIssuedBooks(page = 1) {
    try {
        const response = await ipcRenderer.invoke('fetch-issued-books', { page });

        if (response.status === 'success') {
            displayIssuedBooks(response.books);
            updatePagination(response.totalPages);
        } else {
            showNotification(response.message || 'Failed to fetch issued books', 'error');
        }
    } catch (error) {
        console.error('Error fetching issued books:', error);
        showNotification('Failed to fetch issued books', 'error');
    }
}

async function displayIssuedBooks(books) {
    const booksContainer = document.getElementById('issued-books-list');
    if (!booksContainer) return;

    if (books.length === 0) {
        booksContainer.innerHTML = '<p class="no-data">No books are currently issued</p>';
        return;
    }

    booksContainer.innerHTML = books.map(book => `
        <div class="book-card">
            <div class="book-info">
                <h3>${book.bookTitle || 'Unknown Title'}</h3>
                <p><strong>Book ID:</strong> ${book.bookId ?? 'Unknown ID'}</p>
                <p><strong>Issued To:</strong> ${book.issuerName ?? 'Unknown'}</p>
                <p><strong>Email:</strong> ${book.issuerEmail ?? 'Unknown'}</p>
                <p><strong>Issue Date:</strong> ${book.issueDate ? new Date(book.issueDate).toLocaleDateString() : 'N/A'}</p>
                <p><strong>Expected Return:</strong> ${book.expectedReturnDate ? new Date(book.expectedReturnDate).toLocaleDateString() : 'N/A'}</p>
            </div>
            <div class="book-actions">
                <button class="return-btn" onclick="handleReturnBook('${book.bookId}')">Return Book</button>
                <button class="reminder-btn" onclick="handleSendReminder('${book.bookId}')">Send Reminder</button>
            </div>
        </div>
    `).join('');
}

// Utility Functions
function showModal(modal) {
    if (modal) {
        modal.style.display = 'block';
    }
}

function hideAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (modal) {
            modal.style.display = 'none';
        }
    });
}

function showIssueModal(bookId) {
    document.getElementById('issue-book-id').value = bookId;
    showModal(issueBookModal);
}

async function showEditModal(bookId) {
    try {
        const response = await ipcRenderer.invoke('fetch-book', { bookId });

        if (response.status === 'success') {
            const book = response.book;
            const form = document.getElementById('edit-book-form');
            
            // Store book ID for the update request
            form.dataset.bookId = book.ID;
            
            // Populate form fields
            populateEditForm(book);

            // Show the modal
            const editModal = document.getElementById('edit-book-modal');
            showModal(editModal);
        } else {
            showNotification(response.message || 'Failed to fetch book details', 'error');
        }
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function populateEditForm(book) {
    const form = document.getElementById('edit-book-form');
    form.querySelector('[name="ID"]').value = book.ID;
    form.querySelector('[name="Accession_Number"]').value = book.Accession_Number || '';
    form.querySelector('[name="MAL_ACC_Number"]').value = book.MAL_ACC_Number || '';
    form.querySelector('[name="Author"]').value = book.Author || '';
    form.querySelector('[name="Title"]').value = book.Title || '';
    form.querySelector('[name="Publisher"]').value = book.Publisher || '';
    form.querySelector('[name="Edition"]').value = book.Edition || '';
    form.querySelector('[name="Publishing_Year"]').value = book.Publishing_Year || '';
    form.querySelector('[name="Author1"]').value = book.Author1 || '';
    form.querySelector('[name="Author2"]').value = book.Author2 || '';
    form.querySelector('[name="Author3"]').value = book.Author3 || '';
    form.querySelector('[name="Category1"]').value = book.Category1 || '';
    form.querySelector('[name="Category2"]').value = book.Category2 || '';
    form.querySelector('[name="Category3"]').value = book.Category3 || '';
}

async function handleEditBook(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const bookData = {
        ID: parseInt(formData.get('ID')),
        Accession_Number: parseInt(formData.get('Accession_Number')) || null,
        MAL_ACC_Number: parseInt(formData.get('MAL_ACC_Number')) || null,
        Author: formData.get('Author'),
        Title: formData.get('Title'),
        Publisher: formData.get('Publisher'),
        Publishing_Year: parseInt(formData.get('Publishing_Year')) || null,
        Edition: formData.get('Edition'),
        Category1: formData.get('Category1'),
        Category2: formData.get('Category2'),
        Category3: formData.get('Category3'),
        Author1: formData.get('Author1'),
        Author2: formData.get('Author2'),
        Author3: formData.get('Author3')
    };

    try {
        const response = await ipcRenderer.invoke('update-book', { bookId: e.target.dataset.bookId, bookData });

        if (response.status === 'success') {
            showNotification('Book updated successfully', 'success');
            hideAllModals();
            fetchBooks();
        } else {
            showNotification(response.message || 'Failed to update book', 'error');
        }
    } catch (error) {
        showNotification(error.message || 'Error updating book', 'error');
    }
}

function updatePagination(total) {
    totalPages = total;
    const pagination = document.querySelector('.pagination');
    pagination.innerHTML = `
        <button class="btn-secondary" ${currentPage === 1 ? 'disabled' : ''} 
            onclick="changePage(${currentPage - 1})">Previous</button>
        <span>Page ${currentPage} of ${totalPages}</span>
        <button class="btn-secondary" ${currentPage === totalPages ? 'disabled' : ''} 
            onclick="changePage(${currentPage + 1})">Next</button>
    `;
}

function changePage(page) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    fetchBooks(currentPage, searchInput.value.trim());
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function checkAuth() {
    const token = localStorage.getItem('token');
    if (token) {
        // Verify token and get user info
        ipcRenderer.invoke('check-auth', { token })
        .then(response => {
            if (response.status === 'success' && response.user) {
                currentUser = response.user;
                showMainContainer();
                fetchBooks();
            } else {
                showAuthContainer();
            }
        })
        .catch(() => showAuthContainer());
    } else {
        showAuthContainer();
    }
}

function showMainContainer() {
    console.log('Showing main container');
    if (authContainer) authContainer.style.display = 'none';
    if (mainContainer) mainContainer.style.display = 'block';
    if (userInfo) userInfo.textContent = `Welcome, ${currentUser.name}`;
    
    // Ensure the books tab is active and content is shown
    const booksTab = document.getElementById('books-tab');
    const booksTabButton = document.querySelector('[data-tab="books"]');
    if (booksTab) booksTab.style.display = 'block';
    if (booksTabButton) booksTabButton.classList.add('active');
    
    // Fetch initial data
    fetchBooks();
}

function showAuthContainer() {
    authContainer.style.display = 'flex';
    mainContainer.style.display = 'none';
    localStorage.removeItem('token');
}

function handleLogout() {
    localStorage.removeItem('token');
    showAuthContainer();
}

function showNotification(message, type = 'info') {
    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Add styles to make notification more visible
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.padding = '15px 25px';
    notification.style.borderRadius = '5px';
    notification.style.zIndex = '1000';
    notification.style.minWidth = '200px';
    notification.style.textAlign = 'center';
    notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    
    // Set colors based on type
    switch(type) {
        case 'success':
            notification.style.backgroundColor = '#5F6F52';
            notification.style.color = 'white';
            break;
        case 'error':
            notification.style.backgroundColor = '#6E1211';
            notification.style.color = 'white';
            break;
        default:
            notification.style.backgroundColor = '#2196F3';
            notification.style.color = 'white';
    }

    document.body.appendChild(notification);

    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.5s ease';
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Fetch and display issue logs
async function fetchIssueLogs(page = 1) {
    try {
        const response = await ipcRenderer.invoke('fetch-issue-logs', { 
            page, 
            startDate: issueLogsStartDate,
            endDate: issueLogsEndDate
        });
        
        if (response.status === 'success') {
            displayIssueLogs(response.logs);
            updatePagination(response.totalPages);
        } else {
            showNotification(response.message || 'Failed to fetch issue logs', 'error');
        }
    } catch (error) {
        console.error('Error fetching issue logs:', error);
        showNotification('Failed to fetch issue logs', 'error');
    }
}

function displayIssueLogs(logs) {
    const logsContainer = document.getElementById('issue-logs-list');
    if (!logsContainer) {
        console.error('Logs container not found');
        return;
    }

    // Always render the filter UI
    let html = `
        <div class="logs-header">
            <div class="logs-filters">
                <div class="filter-group">
                    <label for="date-range-start">Start Date:</label>
                    <input type="date" id="date-range-start" value="${issueLogsStartDate}">
                </div>
                <div class="filter-group">
                    <label for="date-range-end">End Date:</label>
                    <input type="date" id="date-range-end" value="${issueLogsEndDate}">
                </div>
                <button class="btn-secondary" id="apply-date-filter-btn">Apply Filter</button>
            </div>
            <button class="export-btn" onclick="exportLogsToExcel()">
                <i class="fas fa-file-excel"></i> Export to Excel
            </button>
        </div>
    `;

    if (!logs || logs.length === 0) {
        html += '<p class="no-data">No issue logs found</p>';
    } else {
        html += `<div class="logs-list">${logs.map(log => createLogCard(log)).join('')}</div>`;
    }

    logsContainer.innerHTML = html;

    // Add event listener for the filter button
    document.getElementById('apply-date-filter-btn').addEventListener('click', () => {
        const startInput = document.getElementById('date-range-start').value;
        const endInput = document.getElementById('date-range-end').value;
        issueLogsStartDate = startInput;
        issueLogsEndDate = endInput;
        fetchIssueLogs();
    });
}

function createLogCard(log) {
    const bookTitle = log.bookTitle || 'Unknown Title';
    const bookId = log.bookId ?? 'Unknown ID';
    const issuerName = log.issuerName || 'Unknown';
    const issuerEmail = log.issuerEmail || 'No email';
    const status = log.actualReturnDate ? 'returned' : 'issued';
    
    return `
        <div class="log-card" data-status="${status}" data-date="${new Date(log.issueDate).getTime()}">
            <div class="log-header">
                <h3 class="log-title">${bookTitle}</h3>
                <span class="log-status ${status}">${status}</span>
            </div>
            <div class="log-content">
                <div class="log-details">
                    <div class="log-detail">
                        <span class="log-label">Book ID:</span>
                        <span class="log-value">${bookId}</span>
                    </div>
                    <div class="log-detail">
                        <span class="log-label">Issued To:</span>
                        <span class="log-value">${issuerName}</span>
                    </div>
                    <div class="log-detail">
                        <span class="log-label">Email:</span>
                        <span class="log-value">${issuerEmail}</span>
                    </div>
                    <div class="log-detail">
                        <span class="log-label">Issue Date:</span>
                        <span class="log-value">${new Date(log.issueDate).toLocaleDateString()}</span>
                    </div>
                    <div class="log-detail">
                        <span class="log-label">Expected Return:</span>
                        <span class="log-value">${new Date(log.expectedReturnDate).toLocaleDateString()}</span>
                    </div>
                    ${log.actualReturnDate ? `
                        <div class="log-detail">
                            <span class="log-label">Return Date:</span>
                            <span class="log-value">${new Date(log.actualReturnDate).toLocaleDateString()}</span>
                        </div>
                    ` : ''}
                </div>
                ${log.remarks ? `
                    <div class="log-remarks">
                        <span class="log-label">Remarks:</span>
                        <span class="log-value">${log.remarks}</span>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

async function exportLogsToExcel() {
    try {
        const response = await ipcRenderer.invoke('export-logs');

        if (response.status === 'success') {
            showNotification('Logs exported successfully!', 'success');
            // Open the exported file
            if (response.filePath) {
                shell.openPath(response.filePath);
            }
        } else {
            showNotification(response.message || 'Failed to export logs', 'error');
        }
    } catch (error) {
        showNotification('Failed to export logs: ' + error.message, 'error');
    }
}

// Required columns for book import
const requiredColumns = {
    ID: 'required',
    Title: 'required',
    Author: 'required',
    Publisher: 'required',
    Accession_Number: 'optional',
    MAL_ACC_Number: 'optional',
    Author1: 'optional',
    Author2: 'optional',
    Author3: 'optional',
    Edition: 'optional',
    Publishing_Year: 'optional',
    Category1: 'optional',
    Category2: 'optional',
    Category3: 'optional'
};

async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Reset previous state
    filePreview.style.display = 'none';
    columnMapping.style.display = 'none';
    importSubmitBtn.disabled = true;
    previewContent.innerHTML = '';
    mappingContent.innerHTML = '';

    try {
        const response = await ipcRenderer.invoke('validate-import', { filePath: file.path });
        
        if (response.status === 'success') {
            // Show file preview
            filePreview.style.display = 'block';
            previewContent.innerHTML = `
                <p>File: ${file.name}</p>
                <p>Total rows: ${response.totalRows}</p>
                <p>Columns found: ${response.columns.join(', ')}</p>
            `;

            // Check for missing required columns
            const missingRequired = Object.entries(requiredColumns)
                .filter(([col, type]) => type === 'required' && !response.columns.includes(col))
                .map(([col]) => col);

            if (missingRequired.length > 0) {
                showNotification(`Missing required columns: ${missingRequired.join(', ')}`, 'error');
                importSubmitBtn.disabled = true;
                return;
            }

            // Show column mapping if needed
            if (response.needsMapping) {
                columnMapping.style.display = 'block';
                mappingContent.innerHTML = response.mappingOptions.map(option => `
                    <div class="mapping-row">
                        <label>${option.fileColumn} → </label>
                        <select class="mapping-select" data-file-column="${option.fileColumn}">
                            <option value="">Select mapping</option>
                            ${Object.keys(requiredColumns).map(col => 
                                `<option value="${col}" ${option.suggestedMapping === col ? 'selected' : ''}>${col}</option>`
                            ).join('')}
                        </select>
                    </div>
                `).join('');

                // Enable import button only if all required columns are mapped
                const checkMappingCompleteness = () => {
                    const allMapped = Array.from(document.querySelectorAll('.mapping-select'))
                        .every(select => select.value !== '');
                    importSubmitBtn.disabled = !allMapped;
                };

                // Add event listeners to mapping selects
                document.querySelectorAll('.mapping-select').forEach(select => {
                    select.addEventListener('change', checkMappingCompleteness);
                });

                // Initial check
                checkMappingCompleteness();
            } else {
                // If no mapping needed, enable import button
                importSubmitBtn.disabled = false;
            }
        } else {
            showNotification(response.message || 'Error validating file', 'error');
            importSubmitBtn.disabled = true;
        }
    } catch (error) {
        console.error('Error processing file:', error);
        showNotification('Error processing file', 'error');
        importSubmitBtn.disabled = true;
    }
}

async function handleBulkImport(event) {
    event.preventDefault();
    const file = importFile.files[0];
    if (!file) return;

    try {
        // Get column mapping if present
        const mappingSelects = document.querySelectorAll('.mapping-select');
        const columnMapping = {};
        mappingSelects.forEach(select => {
            if (select.value) {
                columnMapping[select.dataset.fileColumn] = select.value;
            }
        });

        // Disable submit button and show loading state
        importSubmitBtn.disabled = true;
        importSubmitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importing...';

        const response = await ipcRenderer.invoke('bulk-import', { 
            filePath: file.path,
            columnMapping: Object.keys(columnMapping).length > 0 ? columnMapping : undefined
        });

        if (response.status === 'success') {
            showNotification(`Successfully imported ${response.importedCount} books`, 'success');
            hideAllModals();
            fetchBooks();
        } else {
            showNotification(response.message || 'Error importing books', 'error');
        }
    } catch (error) {
        console.error('Error importing books:', error);
        showNotification('Error importing books', 'error');
    } finally {
        // Reset submit button
        importSubmitBtn.disabled = false;
        importSubmitBtn.innerHTML = '<i class="fas fa-upload"></i> Import Books';
    }
}

async function handleSendReminder(bookId) {
    const button = event.target;
    const originalText = button.innerHTML;
    
    try {
        // Disable button and show loading state
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

        const response = await ipcRenderer.invoke('send-reminder', { bookId });

        if (response.status === 'success') {
            // Show success state briefly
            button.innerHTML = '<i class="fas fa-check"></i> Sent!';
            showNotification('Reminder sent successfully!', 'success');
            
            // Reset button after 2 seconds
            setTimeout(() => {
                button.innerHTML = originalText;
                button.disabled = false;
            }, 2000);
        } else {
            throw new Error(response.message || 'Failed to send reminder');
        }
    } catch (error) {
        console.error('Error sending reminder:', error);
        showNotification(error.message || 'Error sending reminder', 'error');
        
        // Reset button on error
        button.innerHTML = originalText;
        button.disabled = false;
    }
} 