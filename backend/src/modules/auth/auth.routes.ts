import { Router } from 'express';
import { authController } from './auth.controller.js';
import { requireAuth } from './auth.middleware.js';

const router = Router();

// Google OAuth
router.get('/google', authController.initiateGoogleLogin);
router.get('/google/url', authController.getGoogleAuthUrl);
router.get('/google/callback', authController.handleGoogleCallback);

// Current User Profile & Logout
router.get('/me', requireAuth, authController.getMe);
router.post('/logout', requireAuth, authController.logout);

export const authRoutes = router;
