import { Router } from 'express';
import { searchController } from './search.controller.js';
import { requireAuth } from '../auth/auth.middleware.js';

const router = Router();

router.get('/', requireAuth, searchController.searchEmails);

export const searchRoutes = router;
