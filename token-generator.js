// token-generator.js
import admin from 'firebase-admin';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin (reuse your existing setup)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// You'll need your Firebase Web API Key from Firebase Console
// Go to: Project Settings > General > Web API Key
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'YOUR_WEB_API_KEY_HERE';

const users = {
  dylan: {
    uid: 'ur0bI1NAjMdkYylgimAMGgMGwrt1',
    email: 'd.t.janssens@gmail.com',
    password: '123456' 
  },
  anna: {
    uid: 'k1T9HdnkJ9eJNNahaGIaBNBc7fD2',
    email: 'd.tjanssens@gmail.com', 
    password: '123456'
  },
  laurens: {
    uid: 'qZnp11fiXrMbuMe7zb6pkEo1u6D2',
    email: 'dtjanssens@gmail.com',
    password: '123456'
  }
};

// Method 1: Generate ID Token via REST API (requires password)
async function generateIdToken(email, password) {
  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }
    
    return data.idToken;
  } catch (error) {
    throw new Error(`Failed to get ID token: ${error.message}`);
  }
}

// Method 2: Generate Custom Token (for reference)
async function generateCustomToken(uid) {
  try {
    const customToken = await admin.auth().createCustomToken(uid);
    return customToken;
  } catch (error) {
    throw new Error(`Failed to create custom token: ${error.message}`);
  }
}

async function generateTokens() {
  console.log('🔑 Firebase Tokens for Testing:\n');
  
  for (const [name, userData] of Object.entries(users)) {
    console.log(`${name.toUpperCase()} (${userData.email}):`);
    
    try {
      // Generate ID Token (what your server expects)
      const idToken = await generateIdToken(userData.email, userData.password);
      console.log(`✅ ID Token: ${idToken}`);
      
      // Also generate custom token for reference
      const customToken = await generateCustomToken(userData.uid);
      console.log(`📋 Custom Token: ${customToken}`);
      
    } catch (error) {
      console.error(`❌ Error for ${name}: ${error.message}`);
    }
    
    console.log('---\n');
  }
}

// Run specific user
async function generateTokenForUser(userName) {
  const userData = users[userName.toLowerCase()];
  if (!userData) {
    console.error('User not found. Available users:', Object.keys(users).join(', '));
    return;
  }
  
  console.log(`🔑 ${userName.toUpperCase()} Tokens:`);
  
  try {
    // Generate ID Token (ready to use with your server)
    const idToken = await generateIdToken(userData.email, userData.password);
    console.log(`✅ ID Token (use this): ${idToken}`);
    console.log(`📧 Email: ${userData.email}`);
    console.log(`🆔 UID: ${userData.uid}`);
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

// Command line usage
const userArg = process.argv[2];
if (userArg) {
  generateTokenForUser(userArg);
} else {
  generateTokens();
}