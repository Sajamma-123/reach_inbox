import { Router } from 'express';
import multer from 'multer';
import { emailController } from './email.controller.js';
import { requireAuth } from '../auth/auth.middleware.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max CSV
});

const router = Router();

router.use(requireAuth);

// Schedule email campaign with optional CSV file
router.post('/schedule', upload.single('recipientsFile'), emailController.scheduleEmail);

// View campaigns
router.get('/', emailController.getEmails);
router.get('/stats', emailController.getMetrics);
router.get('/jobs/scheduled', emailController.getScheduledJobs);
router.get('/jobs/sent', emailController.getSentJobs);
router.get('/:id', emailController.getEmailById);

export const emailRoutes = router;
