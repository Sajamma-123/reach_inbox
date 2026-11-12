import { Router, Request, Response } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from '../scheduler/queue.js';
import { isRedisConnected } from '../../config/redis.js';
import { prisma, isDatabaseConnected } from '../../config/database.js';

export const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

try {
  createBullBoard({
    queues: [new BullMQAdapter(emailQueue as any) as any],
    serverAdapter: serverAdapter,
  });
} catch (e) {
  // Silent catch if BullMQ adapter fails on cold start
}

const customRouter = Router();

customRouter.use((req: Request, res: Response, next) => {
  // If Redis is active, delegate directly to Bull-Board UI
  if (isRedisConnected) {
    return serverAdapter.getRouter()(req, res, next);
  }

  // If Redis is offline or not installed, render the PostgreSQL Live Queue Monitor dashboard
  if (req.path === '/' || req.path === '') {
    renderPostgresQueueDashboard(req, res);
  } else if (req.path.startsWith('/api/queues')) {
    // Return empty mock for Bull-board internal polling if requested
    res.json({ queues: [] });
  } else {
    res.redirect('/admin/queues');
  }
});

async function renderPostgresQueueDashboard(_req: Request, res: Response) {
  try {
    let jobs: any[] = [];
    if (isDatabaseConnected) {
      jobs = await prisma.emailJob.findMany({
        include: {
          recipient: { select: { recipientEmail: true } },
          email: { select: { subject: true, sender: { select: { email: true } } } },
        },
        orderBy: { plannedExecutionTime: 'desc' },
        take: 100,
      });
    }

    const counts = {
      total: jobs.length,
      delayed: jobs.filter((j) => j.status === 'DELAYED' || j.status === 'WAITING').length,
      completed: jobs.filter((j) => j.status === 'COMPLETED').length,
      failed: jobs.filter((j) => j.status === 'FAILED').length,
      rescheduled: jobs.filter((j) => j.status === 'RESCHEDULED').length,
    };

    const rowsHtml = jobs
      .map(
        (job) => `
      <tr style="border-bottom: 1px solid #1e293b; font-size: 13px;">
        <td style="padding: 12px 16px; font-family: monospace; color: #94a3b8;">${job.id}</td>
        <td style="padding: 12px 16px; font-family: monospace; color: #f8fafc; font-weight: 500;">${job.recipient?.recipientEmail || 'N/A'}</td>
        <td style="padding: 12px 16px; color: #cbd5e1;">${job.email?.subject || 'N/A'}</td>
        <td style="padding: 12px 16px; color: #94a3b8;">${new Date(job.plannedExecutionTime).toLocaleString()}</td>
        <td style="padding: 12px 16px; color: #94a3b8;">${job.executedAt ? new Date(job.executedAt).toLocaleString() : 'Pending'}</td>
        <td style="padding: 12px 16px;">
          <span style="
            display: inline-block;
            padding: 2px 10px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            ${
              job.status === 'COMPLETED'
                ? 'background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3);'
                : job.status === 'DELAYED'
                ? 'background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3);'
                : 'background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3);'
            }
          ">
            ${job.status}
          </span>
        </td>
        <td style="padding: 12px 16px;">
          ${
            job.etherealPreviewUrl
              ? `<a href="${job.etherealPreviewUrl}" target="_blank" style="color: #60a5fa; text-decoration: none; font-weight: 500;">View Email ↗</a>`
              : `<span style="color: #64748b;">-</span>`
          }
        </td>
      </tr>
    `
      )
      .join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Bull-Board Queue Monitor - ReachInbox</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: #090d16; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px 24px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #1e293b; }
    .title { font-size: 20px; font-weight: 700; color: #ffffff; display: flex; align-items: center; gap: 10px; }
    .badge { font-size: 11px; padding: 3px 8px; border-radius: 6px; background: #1e293b; color: #94a3b8; font-weight: 500; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 28px; }
    .card { background: #0f1422; border: 1px solid #1e293b; border-radius: 12px; padding: 18px; }
    .card-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: 600; }
    .card-value { font-size: 26px; font-weight: 700; color: #f8fafc; margin-top: 6px; font-family: monospace; }
    .card-delayed { border-left: 4px solid #3b82f6; }
    .card-completed { border-left: 4px solid #10b981; }
    .card-failed { border-left: 4px solid #f43f5e; }
    .card-rescheduled { border-left: 4px solid #f59e0b; }
    .table-container { background: #0f1422; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { background: #141a2b; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; padding: 14px 16px; font-weight: 600; border-bottom: 1px solid #1e293b; }
    .btn { background: #2563eb; color: #ffffff; text-decoration: none; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; border: none; cursor: pointer; }
    .btn:hover { background: #1d4ed8; }
    .btn-secondary { background: #1e293b; color: #e2e8f0; border: 1px solid #334155; }
    .btn-secondary:hover { background: #334155; }
    .notice { font-size: 12px; color: #94a3b8; display: flex; align-items: center; gap: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="title">
          <span>Bull-Board Queue Monitor</span>
          <span class="badge">reachinbox-email-queue</span>
        </div>
        <p style="font-size: 12px; color: #64748b; margin-top: 4px;">Connected to PostgreSQL (REACH INbOX) · Real-time Job Telemetry</p>
      </div>
      <div style="display: flex; gap: 10px;">
        <a href="/admin/queues" class="btn btn-secondary">↻ Refresh Queue</a>
        <a href="http://localhost:5173" class="btn">Open App Dashboard →</a>
      </div>
    </div>

    <div class="stats">
      <div class="card">
        <div class="card-label">Total Jobs</div>
        <div class="card-value">${counts.total}</div>
      </div>
      <div class="card card-delayed">
        <div class="card-label">Scheduled / Delayed</div>
        <div class="card-value" style="color: #60a5fa;">${counts.delayed}</div>
      </div>
      <div class="card card-completed">
        <div class="card-label">Delivered (Completed)</div>
        <div class="card-value" style="color: #34d399;">${counts.completed}</div>
      </div>
      <div class="card card-rescheduled">
        <div class="card-label">Rescheduled (Rate Limit)</div>
        <div class="card-value" style="color: #fbbf24;">${counts.rescheduled}</div>
      </div>
      <div class="card card-failed">
        <div class="card-label">Failed</div>
        <div class="card-value" style="color: #f87171;">${counts.failed}</div>
      </div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Job ID</th>
            <th>Recipient Email</th>
            <th>Subject</th>
            <th>Planned Execution</th>
            <th>Delivered At</th>
            <th>Status</th>
            <th>Live Preview</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="7" style="text-align: center; padding: 48px; color: #64748b;">No jobs in queue yet. Compose a campaign to view delayed execution!</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err: any) {
    res.status(500).send(`Queue Monitor error: ${err.message}`);
  }
}

export const bullBoardRouter = customRouter;
