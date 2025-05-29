import mongoose from 'mongoose';

export const userSchema = new mongoose.Schema({  
  firebaseUid: { 
    type: String, 
    required: true, 
    unique: true // Ensure no duplicate Firebase accounts
  },
  displayName: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true,
    unique: true
  },
  avatarUrl: { 
    type: String 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Export the model
export const userModel = mongoose.model('User', userSchema);
