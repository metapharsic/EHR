const Queue = require('bull');
const logger = require('../utils/logger');
const db = require('../db');

// ============================================
// ASYNCHRONOUS TASK QUEUE (Phase 3 Foundation)
// ============================================

let reportQueue;
let isRedisAvailable = false;
const mockJobs = new Map(); // Store mock jobs for polling

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
    // Suppress flood of connection errors
    if (!isRedisAvailable) return; 
    console.warn('[QUEUE] Redis connection lost, switching to in-memory fallback');
    isRedisAvailable = false;
  });

  // Basic check to see if we're actually connected
  // reportQueue.client.on('ready', () => { isRedisAvailable = true; });
  // For now, assume unavailable until proven otherwise by a successful operation
} catch (err) {
  console.error('[QUEUE] Failed to initialize Bull:', err.message);
}

/**
 * Process Logic (Extracted for reuse in fallback)
 */
async function processReportData(data) {
  const { reportId, type, params, userId } = data;
  logger.info(`Processing report: ${reportId}`, { type, userId });
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 3000));

  let result = {};
  if (type === 'inventory_intelligence') {
    result = {
      generatedAt: new Date(),
      summary: "Analyzed 15,000 movements. Predicted stock-out for 12 items.",
      recommendations: ["Order MetaMol x500", "Return Expired Batch B129"]
    };
  } else if (type === 'financial_health') {
    result = {
      generatedAt: new Date(),
      summary: "Financial liquidity is high. Working capital optimized.",
      recommendations: ["Increase credit limit for Tier-1 Distributors"]
    };
  } else if (type === 'demand_forecast') {
    result = {
      generatedAt: new Date(),
      summary: "Forecast indicates 15% growth in Cardiovascular category.",
      recommendations: ["Increase production of MetaCardio 50mg"]
    };
  } else {
    result = { generatedAt: new Date(), summary: "General report generated successfully." };
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

/**
 * STATUS POLLING WRAPPER
 * Intercepts calls to reportQueue.getJob to check mockJobs
 */
const getJob = async (jobId) => {
  if (mockJobs.has(jobId)) {
    return mockJobs.get(jobId);
  }
  if (!isRedisAvailable || !reportQueue) return null;
  
  try {
    return await reportQueue.getJob(jobId);
  } catch (err) {
    return null;
  }
};

/**
 * Add a new report job to the queue
 */
const addReportJob = async (data) => {
  // If Redis is likely down or we're in fallback mode
  if (!isRedisAvailable) {
    const jobId = `mock-${Date.now()}`;
    logger.warn('[QUEUE] Redis unavailable, queuing In-Memory:', jobId);
    
    const mockJob = {
      id: jobId,
      data,
      state: 'active',
      progressValue: 0,
      returnvalue: null,
      getState: async function() { return this.state; },
      progress: function(p) { if(p !== undefined) this.progressValue = p; return this.progressValue; }
    };
    
    mockJobs.set(jobId, mockJob);

    // Process in background (don't await)
    processReportData(data).then(result => {
      mockJob.state = 'completed';
      mockJob.progressValue = 100;
      mockJob.returnvalue = result;
      logger.info('[QUEUE] Mock Job Completed:', jobId);
    }).catch(err => {
      mockJob.state = 'failed';
      logger.error('[QUEUE] Mock Job Failed:', jobId, err.message);
    });

    return mockJob;
  }

  try {
    const job = await reportQueue.add(data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
    });
    isRedisAvailable = true; // Proven connection
    return job;
  } catch (err) {
    console.warn('[QUEUE] Redis failure on add, falling back:', err.message);
    isRedisAvailable = false;
    return await addReportJob(data); 
  }
};

module.exports = {
  reportQueue: { getJob }, // Export wrapper for status checks
  addReportJob
};
