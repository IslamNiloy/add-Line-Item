require('dotenv').config();
const express = require('express');
const request = require('request-promise-native');
const NodeCache = require('node-cache');
const session = require('express-session');
const Token = require('../models/tokenModel');
const User = require('../models/user'); 
// const opn = require('open');
const app = express();

const PORT = 3000;

const refreshTokenStore = {};
const accessTokenCache = new NodeCache({ deleteOnExpire: true });

if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
    throw new Error('Missing CLIENT_ID or CLIENT_SECRET environment variable.')
}

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

// To request others, set the SCOPE environment variable instead
let SCOPES = ['crm.objects.contacts.read'];
if (process.env.SCOPE) {
    SCOPES = (process.env.SCOPE.split(/ |, ?|%20/)).join(' ');
}

// On successful install, users will be redirected to /oauth-callback
const REDIRECT_URI = process.env.REDIRECT_URI;


const authUrl =
  'https://app.hubspot.com/oauth/authorize' +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` + 
  `&scope=${encodeURIComponent(SCOPES)}` + 
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`; 

exports.install =  (req, res) => {
  res.redirect(authUrl);
};

exports.oauthCallback = async (req, res) => {
  if (req.query.code) {
    console.log('       > Received an authorization token');

    const authCodeProof = {
      grant_type: 'authorization_code',
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      redirect_uri: process.env.REDIRECT_URI,
      code: req.query.code
    };

    try {
      const { accessToken, portalId } = await exchangeForTokens(authCodeProof);

      if (!accessToken) {
        return res.redirect(`/error?msg=Token exchange failed`);
      }
      req.session.portalId = portalId;

      res.redirect(`/`);  
    } catch (error) {
      console.error('Error during token exchange:', error.message);
      res.redirect(`/error?msg=${encodeURIComponent(error.message)}`);
    }
  } else {
    res.redirect(`/error?msg=No authorization code found`);
  }
};


const getPortalIdFromAccessToken = async (accessToken) => {
  try {
    const response = await request({
      url: `https://api.hubapi.com/oauth/v1/access-tokens/${accessToken}`,
      json: true
    });
    console.log(`Response in getPortalIdFromAccessToken: ${JSON.stringify(response)}`)
    this.insertIntoUser(response);
    return response.hub_id;  // This will give you the portalId (HubSpot account ID)
  } catch (e) {
    console.error('Error retrieving portalId:', e.message);
    throw new Error('Failed to retrieve portalId from HubSpot');
  }
};

const exchangeForTokens = async (exchangeProof) => {
  try {
    const responseBody = await request.post('https://api.hubapi.com/oauth/v1/token', {
      form: exchangeProof
    });
    const tokens = JSON.parse(responseBody);

    // Get the portalId (HubSpot's account ID) from the access token
    const portalId = await getPortalIdFromAccessToken(tokens.access_token);

    if (!portalId) {
      throw new Error('Failed to retrieve portalId from HubSpot');
    }

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

    // Store tokens in the database using the portalId as a unique identifier
    await Token.findOneAndUpdate(
      { portalId },  // Use the portalId to identify the user
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt
      },
      { upsert: true, new: true }  // Create a new record if it doesn't exist, or update if it does
    );

    console.log(`Stored access token and refresh token for portalId ${portalId}`);
    return { accessToken: tokens.access_token, portalId };  // Return access token and portalId
  } catch (e) {
    console.error('Error exchanging tokens:', e.message);
    throw new Error('Token exchange failed');
  }
};



const refreshAccessToken = async (portalId) => {
  const tokenRecord = await Token.findOne({ portalId });

  if (!tokenRecord) {
    throw new Error(`No stored refresh token found for portal ${portalId}`);
  }

  const refreshTokenProof = {
    grant_type: 'refresh_token',
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    redirect_uri: process.env.REDIRECT_URI,
    refresh_token: tokenRecord.refreshToken
  };

  try {
    const tokens = await exchangeForTokens(refreshTokenProof);
    console.log(`Refreshed access token for portal ${portalId}`);
    return tokens.accessToken;
  } catch (error) {
    console.error('Error refreshing access token:', error.message);
    throw new Error('Unable to refresh access token');
  }
};



exports.getAccessToken = async (portalId) => {
  // console.log('im here',portalId)
  
  const tokenRecord =  await Token.find({ portalId });
  // console.log(tokenRecord)

  if (!tokenRecord) {
    throw new Error(`No stored tokens found for portal ${portalId}`);
  }

  const now = new Date();
  console.log(now)
  // If the access token is expired, refresh it
  if (now >= tokenRecord[0].expiresAt) {
    console.log('Access token expired, refreshing...');
    await refreshAccessToken(portalId);  // Refresh the token
    return await exports.getAccessToken(portalId);  // Recursively call to get the refreshed token
  }
  // Return the valid access token
  return tokenRecord[0].accessToken;
};


exports.isAuthorized = (userId) => {
  return refreshTokenStore[userId] ? true : false;
};

exports.error = (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.write(`<h4>Error: ${req.query.msg}</h4>`);
  res.end();
};


exports.home = async (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Hubxpert App</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background-color: #f1f1f1;
        }
        header {
          background-color: #004080;
          color: white;
          text-align: center;
          padding: 20px 0;
        }
        header .logo {
          width: 200px;
          margin-bottom: 10px;
        }
        header h1 {
          margin: 0;
          font-size: 2em;
        }
        main {
          flex: 1;
          padding: 20px;
          text-align: center;
        }
        .description {
          max-width: 600px;
          margin: 0 auto;
        }
        .description h2 {
          font-size: 2em;
          color: #004080;
        }
        .description p {
          font-size: 1.2em;
          color: #333;
        }
        .install-section {
          margin-top: 30px;
        }
        .install-button {
          padding: 10px 20px;
          font-size: 20px;
          font-weight: bold;
          background-color: #f2750e;
          border: none;
          border-radius: 5px;
          color: #fff;
          cursor: pointer;
          transition: transform 0.2s ease;
          text-decoration: none;
          display: inline-block;
        }
        .install-button:hover {
          transform: scale(1.1);
        }
        footer {
          background-color: #f1f1f1;
          text-align: center;
          padding: 10px 0;
        }
        footer p {
          margin: 0;
          color: #555;
        }
        footer a {
          color: #004080;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <header>
        <a href="https://www.hubxpert.com/"><img src="https://static.wixstatic.com/media/2369f3_e7a786f139044881883babb752b00212~mv2.png/v1/fill/w_388,h_154,al_c,q_85,usm_0.66_1.00_0.01,enc_auto/2369f3_e7a786f139044881883babb752b00212~mv2.png" alt="Hubxpert Logo" class="logo"></a>
        <h1>Add Line Item App By HubXpert</h1>
      </header>
      <main>
        <section class="description">
          <h2>About Our App</h2>
          <p>Welcome to the Hubxpert App, your go-to solution for seamless HubSpot integration and data formatting. Our app provides custom workflow actions to format data, making your HubSpot experience more efficient and effective.</p>
        </section>
        <section class="install-section">
          <a href="${process.env.INSTALL_URL}" class="install-button">Install the App</a>
        </section>
      </main>
      <footer>
        <p>&copy; 2024 HubXpert. All rights reserved. <a href="https://www.hubxpert.com">Visit HubXpert</a></p>
      </footer>
    </body>
    </html>
  `);
  res.end();
};


  exports.insertIntoUser = async (data) => {
    try {
      // Destructure the data you received
      const {
        token,
        user,
        hub_domain,
        signed_access_token,
        hub_id,
        app_id,
        expires_in,
        user_id,
      } = data;

      const existingUser = await User.findOne({ portalId: hub_id });
    
      if (existingUser) {
        console.log('User with this hub_id already exists. Skipping insertion.');
        return;
      }
  
      // Create a new user object with the mapped data
      const newUser = new User({
        email: user,
        name: '', // Add the name if available
        appName: app_id+"-remove-multi-select", // Add the app name if available
        companyName: '', // Add the company name if available
        phoneNumber: '', // Add the phone number if available
        countryCode: '', // Add the country code if available
        portalId: hub_id,
        accountType: '', // Add the account type if available
        timeZone: '', // Add the time zone if available
        companyCurrency: '', // Add the company currency if available
        uiDomain: hub_domain,
        dataHostingLocation: signed_access_token.hublet,
        additionalCurrencies: [], // Add additional currencies if available
        refreshToken: '', // Add the refresh token if available
        accessToken: token,
        installationDate: new Date(), // Use the current date
        expiresIn: expires_in,
      });
  
      // Save the user to the database
      await newUser.save();
      console.log('User data inserted successfully!');
    } catch (error) {
      console.error('Error inserting user data:', error);
    }
  };
  