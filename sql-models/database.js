const { Sequelize } = require('sequelize');
const path = require('path');
const { app } = require('electron');
const fs = require('fs');

// Get the user's application data directory
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'database.sqlite');

// Ensure the userData directory exists
if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
}

console.log('Database path:', dbPath);

const sequelize = new Sequelize({
    dialect: 'sqlite',
    dialectModule: require('sqlite3'),
    storage: dbPath,
    logging: console.log, // Enable logging for debugging
    define: {
        timestamps: true,
        underscored: true,
        foreignKeys: false // Disable foreign key constraints
    },
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

// Test the connection and sync without force
sequelize.authenticate()
    .then(() => {
        console.log('Database connection has been established successfully.');
        // Only sync if tables don't exist
        return sequelize.sync({ alter: true });
    })
    .then(() => {
        console.log('Database tables are synchronized.');
    })
    .catch(err => {
        console.error('Unable to connect to the database:', err);
    });

module.exports = sequelize; 