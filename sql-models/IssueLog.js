const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const IssueLog = sequelize.define('IssueLog', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    bookId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    bookTitle: {
        type: DataTypes.STRING,
        allowNull: false
    },
    issuerName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    issuerEmail: {
        type: DataTypes.STRING,
        allowNull: false
    },
    issueDate: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    expectedReturnDate: {
        type: DataTypes.DATE,
        allowNull: false
    },
    actualReturnDate: {
        type: DataTypes.DATE,
        allowNull: true
    },
    remarks: {
        type: DataTypes.STRING,
        defaultValue: ''
    },
    isReturned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    timestamps: true
});

module.exports = IssueLog; 