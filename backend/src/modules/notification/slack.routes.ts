import { Router } from 'express';
import { slackController } from './slack.controller.js';
import { requireAuth } from '../auth/auth.middleware.js';

const router = Router();

// Slack OAuth Initiation & Callback
router.get('/connect', requireAuth, slackController.connectSlack);
router.get('/authorize', slackController.initiateSlackOAuth);
router.get('/callback', slackController.handleCallback);

// Slack Status & Management
router.get('/status', requireAuth, slackController.getStatus);
router.post('/disconnect', requireAuth, slackController.disconnect);
router.post('/test', requireAuth, slackController.sendTestNotification);

export const slackRoutes = router;
