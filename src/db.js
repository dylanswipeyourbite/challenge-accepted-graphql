import mongoose from 'mongoose';

const MONGODB_URI = "mongodb+srv://admin:boGzoQlWSLLFCqOc@cluster0.qjr1jcl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"; // Change if you're using Atlas or different host

export const connectToDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};
