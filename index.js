import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { json } from 'express'; 
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { connectToDB } from './src/db.js';
import { typeDefs } from './src/schema.js';
import { resolvers } from './src/resolvers.js';
import { verifyToken } from './src/firebaseAdmin.js';
import { userModel as User } from './src/models/User.js';

dotenv.config();

const app = express();
const httpServer = http.createServer(app);

// Global middleware
app.use(cors());
app.use(json()); // global JSON parsing

// ✅ Auth middleware
app.use(async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (token) {
    try {
      const decoded = await verifyToken(token);
      let mongoUser = await User.findOne({ firebaseUid: decoded.uid });

      if (!mongoUser) {
        mongoUser = await User.create({
          firebaseUid: decoded.uid,
          displayName: decoded.name || 'Anonymous',
          avatarUrl: decoded.picture || '',
        });
      }

      req.user = mongoUser;
    } catch (err) {
      console.error('[Auth Middleware] Error:', err.message);
    }
  }
  next();
});

const start = async () => {
  await connectToDB();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true,
  });

  await server.start();

  // ✅ Correct usage of expressMiddleware with json()
  app.use(
    '/graphql',
    json(), 
    expressMiddleware(server, {
      context: async ({ req }) => ({
        user: req.user,
        userId: req.user?._id || null,
      }),
    })
  );

  const PORT = process.env.PORT || 4001;
  httpServer.listen(PORT, () =>
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`)
  );
};

start();
