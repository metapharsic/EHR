const Queue = require('bull');
const logger = require('../utils/logger');
const db = require('../db');

// ============================================
// ASYNCHRONOUS TASK QUEUE (Phase 3 Foundation)
// ============================================

let reportQueue;
let isRedisAvailable = false;

// Attempt to initialize Bull with Redis
try {
  reportQueue = new Queue('report-generation', {
    redis: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT || 6379,
    },
    settings: {
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
    }
  });

  reportQueue.on('error', (err) => {
    if (!isRedisAvailable) return;
    console.warn('[QUEUE] Redis connection lost, switching to DB fallback');
    isRedisAvailable = false;
  });
} catch (err) {
  console.error('[QUEUE] Failed to initialize Bull:', err.message);
}

/**
 * Process Logic (Extracted for reuse in fallback)
 */
async function processReportData(data) {
  const { reportId, type } = data;
  logger.info(`Processing report: ${reportId}`, { type });

  await new Promise(resolve => setTimeout(resolve, 3000));

  let result = {};
  if (type === 'inventory_intelligence') {
    result = {
      generatedAt: new Date(),
      summary: 'Analyzed 15,000 movements. Predicted stock-out for 12 items.',
      recommendations: ['Order MetaMol x500', 'Return Expired Batch B129'],
    };
  } else if (type === 'financial_health') {
    result = {
      generatedAt: new Date(),
      summary: 'Financial liquidity is high. Working capital optimized.',
      recommendations: ['Increase credit limit for Tier-1 Distributors'],
    };
  } else if (type === 'demand_forecast') {
    result = {
      generatedAt: new Date(),
      summary: 'Forecast indicates 15% growth in Cardiovascular category.',
      recommendations: ['Increase production of MetaCardio 50mg'],
    };
  } else {
    result = { generatedAt: new Date(), summary: 'Report generated successfully.' };
  }

  return { success: true, reportId, result };
}

/**
 * Bull Processor (Standard path)
 */
if (reportQueue) {
  reportQueue.process(async (job) => {
    return await processReportData(job.data);
  });
}

// ─── DB-backed fallback (shared across PM2 cluster workers) ─────────────────

async function dbAddJob(jobId, reportId, type, userId) {
  await db.query(
    `INSERT INTO report_jobs (id, report_id, type, user_id, state, progress)
     VALUES ($1, $2, $3, $4, 'active', 0)
     ON CONFLICT (id) DO NOTHING`,
    [jobId, reportId, type, userId || null]
  );
}

async function dbSetCompleted(jobId, result) {
  await db.query(
    `UPDATE report_jobs SET state='completed', progress=100, result=$2, updated_at=NOW()
     WHERE id=$1`,
    [jobId, JSON.stringify(result)]
  );
}

async function dbSetFailed(jobId, error) {
  await db.query(
    `UPDATE report_jobs SET state='failed', error=$2, updated_at=NOW() WHERE id=$1`,
    [jobId, error]
  );
}

async function dbGetJob(jobId) {
  const r = await db.query('SELECT * FROM report_jobs WHERE id=$1', [jobId]);
  if (!r.rows.length) return null;
  const row = r.rows[0];
  // Return a Bull-compatible job shape
  return {
    id: row.id,
    data: { reportId: row.report_id, type: row.type },
    getState: async () => row.state,
    progress: () => row.progress,
    returnvalue: row.result,
  };
}

// ─── STATUS POLLING WRAPPER ──────────────────────────────────────────────────
const getJob = async (jobId) => {
  // DB-backed mock job (cluster-safe)
  if (typeof jobId === 'string' && jobId.startsWith('dbj-')) {
    return dbGetJob(jobId);
  }
  if (!isRedisAvailable || !reportQueue) return null;
  try {
    return await reportQueue.getJob(jobId);
  } catch (err) {
    return null;
  }
};

// ─── ADD JOB ────────────────────────────────────────────────────────────────
const addReportJob = async (data) => {
  if (!isRedisAvailable) {
    const jobId = `dbj-${Date.now()}`;
    const { reportId, type, userId } = data;
    logger.warn('[QUEUE] Redis unavailable, using DB fallback:', jobId);

    // Persist to DB immediately (visible to all cluster workers)
    await dbAddJob(jobId, reportId, type, userId);

    // Process in background
    processReportData(data)
      .then(result => dbSetCompleted(jobId, result))
      .catch(err => dbSetFailed(jobId, err.message));

    // Return a minimal Bull-compatible object
    return {
      id: jobId,
      data,
      getState: async () => {
        const r = await db.query('SELECT state FROM report_jobs WHERE id=$1', [jobId]);
        return r.rows[0]?.state || 'active';
      },
      progress: () => 0,
      returnvalue: null,
    };
  }

  try {
    const job = await reportQueue.add(data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
    });
    isRedisAvailable = true;
    return job;
  } catch (err) {
    console.warn('[QUEUE] Redis failure on add, falling back:', err.message);
    isRedisAvailable = false;
    return await addReportJob(data);
  }
};

module.exports = {
  reportQueue: { getJob },
  addReportJob,
};
