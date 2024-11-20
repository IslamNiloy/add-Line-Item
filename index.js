require('dotenv').config();
const express = require('express');
const morgan = require('morgan');  
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');

const app = express();
app.use(express.json()); 
const PORT = 3000;
const hubspotRoutes = require('./routes/hubspotRoutes');
// const workflowRoutes = require('./routes/workflowRoutes');
const lineItemRoutes = require('./routes/lineItemRoutes');


// Use morgan to log HTTP requests
app.use(morgan('dev'));  // Log requests to the console in 'dev' format

app.use(session({
  secret: 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,  // MongoDB connection string
    collectionName: 'sessions'
  }),
  cookie: { maxAge: 24 * 60 * 60 * 1000 }  // 1-day session expiration
}));


// MongoDB connection
const mongoUri = process.env.MONGO_URI;  // Ensure MONGO_URI is set in your .env file

mongoose.connect(mongoUri)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/', hubspotRoutes);
// app.use('/', workflowRoutes);
app.use('/', lineItemRoutes);

// Start server
app.listen(PORT, () => console.log(`=== Starting your app on http://localhost:${PORT} ===`));
