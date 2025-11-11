// Backfill batches for existing data
// Run this once: npx tsx scripts/backfill-batches.ts

import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function backfillBatches() {
  try {
    console.log('🔄 Backfilling batches for existing data...');
    console.log('📡 Using database:', process.env.DATABASE_URL?.substring(0, 50) + '...');

    // Backfill rate confirmations by upload date grouping
    const loadsResult = await pool.query(`
      SELECT 
        DATE_TRUNC('minute', created_at) as upload_time,
        COUNT(*) as record_count,
        ARRAY_AGG(load_number) as load_numbers
      FROM loads
      WHERE batch_id IS NULL
      GROUP BY DATE_TRUNC('minute', created_at)
      ORDER BY upload_time DESC
    `);

    console.log(`Found ${loadsResult.rows.length} rate con upload groups`);

    for (const group of loadsResult.rows) {
      const batchResult = await pool.query(`
        INSERT INTO upload_batches (batch_type, file_count, record_count, description, upload_date, metadata)
        VALUES ('ratecons', $1, $2, $3, $4, $5)
        RETURNING id
      `, [
        group.record_count,
        group.record_count,
        `Backfilled: ${group.record_count} rate confirmations`,
        group.upload_time,
        JSON.stringify({ files: [`${group.record_count} loads`] })
      ]);

      const batchId = batchResult.rows[0].id;

      // Update loads with batch_id
      await pool.query(`
        UPDATE loads 
        SET batch_id = $1 
        WHERE DATE_TRUNC('minute', created_at) = $2 AND batch_id IS NULL
      `, [batchId, group.upload_time]);

      console.log(`✅ Created batch #${batchId} for ${group.record_count} loads from ${group.upload_time}`);
    }

    // Backfill expenses by upload date grouping
    const expensesResult = await pool.query(`
      SELECT 
        DATE_TRUNC('hour', created_at) as upload_time,
        COUNT(*) as record_count,
        COUNT(DISTINCT card_id) as card_count
      FROM expenses
      WHERE batch_id IS NULL
      GROUP BY DATE_TRUNC('hour', created_at)
      ORDER BY upload_time DESC
    `);

    console.log(`Found ${expensesResult.rows.length} expense upload groups`);

    for (const group of expensesResult.rows) {
      const batchResult = await pool.query(`
        INSERT INTO upload_batches (batch_type, file_count, record_count, description, upload_date, metadata)
        VALUES ('expenses', 1, $1, $2, $3, $4)
        RETURNING id
      `, [
        group.record_count,
        `Backfilled: ${group.record_count} expenses`,
        group.upload_time,
        JSON.stringify({ filename: 'cc_statement.csv' })
      ]);

      const batchId = batchResult.rows[0].id;

      // Update expenses with batch_id
      await pool.query(`
        UPDATE expenses 
        SET batch_id = $1 
        WHERE DATE_TRUNC('hour', created_at) = $2 AND batch_id IS NULL
      `, [batchId, group.upload_time]);

      console.log(`✅ Created batch #${batchId} for ${group.record_count} expenses from ${group.upload_time}`);
    }

    console.log('✅ Backfill complete!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Backfill error:', error);
    await pool.end();
    process.exit(1);
  }
}

backfillBatches();