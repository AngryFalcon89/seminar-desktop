const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Book = sequelize.define('Book', {
    ID: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    Accession_Number: DataTypes.INTEGER,
    MAL_ACC_Number: DataTypes.INTEGER,
    Author: {
        type: DataTypes.STRING,
        allowNull: false
    },
    Title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    Book_Status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    Edition: DataTypes.STRING,
    Publisher: {
        type: DataTypes.STRING,
        allowNull: false
    },
    Category1: DataTypes.STRING,
    Category2: DataTypes.STRING,
    Category3: DataTypes.STRING,
    Author1: DataTypes.STRING,
    Author2: DataTypes.STRING,
    Author3: DataTypes.STRING,
    Publishing_Year: {
        type: DataTypes.INTEGER,
        validate: {
            min: 1800,
            max: new Date().getFullYear() + 1
        }
    },
    IssuedTo: {
        type: DataTypes.JSON,
        defaultValue: null
    }
}, {
    timestamps: true,
    freezeTableName: true,
    underscored: false
});

module.exports = Book; 