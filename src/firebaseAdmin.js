import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export const verifyToken = async (token) => {
  if (!token) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded; 
  } catch (err) {
    console.error('[Auth Error]:', err.message);
    console.error('[Auth Stack]:', err.stack);
    return null;
  }
};
