const mongoose = require('mongoose');

// Define the schema for storing OAuth tokens
const tokenSchema = new mongoose.Schema({
  portalId: {
    type: String,
    required: true,
    unique: true  
  },
  accessToken: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  }
});

// Create a Token model
const Token = mongoose.model('Token', tokenSchema);

module.exports = Token;
