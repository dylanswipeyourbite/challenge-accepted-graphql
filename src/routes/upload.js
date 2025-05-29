import express from 'express';
import multer from 'multer';
import { getStorage } from 'firebase-admin/storage';
import { challengeModel } from '../models/Challenge.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload/:challengeId', upload.single('file'), async (req, res) => {
  try {
    const { challengeId } = req.params;
    const userId = req.user.uid; // assuming you have auth middleware that sets req.user
    const file = req.file;

    const bucket = getStorage().bucket();
    const fileRef = bucket.file(`challenges/${challengeId}/${Date.now()}_${file.originalname}`);
    await fileRef.save(file.buffer, { contentType: file.mimetype });

    const [url] = await fileRef.getSignedUrl({
      action: 'read',
      expires: '03-01-2030',
    });

    // Save media URL to challenge
    const challenge = await challengeModel.findById(challengeId);
    const participant = challenge.participants.find(p => p.userId === userId);
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    participant.media = participant.media || [];
    participant.media.push({
      url,
      type: file.mimetype.startsWith('video') ? 'video' : 'photo',
    });

    await challenge.save();
    res.json({ success: true, url });
  } catch (err) {
    console.error('Upload failed:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;
