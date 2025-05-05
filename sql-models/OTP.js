const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const OTP = sequelize.define('OTP', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    otp: DataTypes.STRING,
    email: DataTypes.STRING,
    expires: DataTypes.DATE
}, {
    timestamps: true
});

module.exports = OTP; 