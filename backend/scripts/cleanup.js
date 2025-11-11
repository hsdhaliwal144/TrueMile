// ============================================================================
// DATABASE CLEANUP SCRIPT
// ============================================================================
// Save this as: ~/fleet1_backend/scripts/cleanup.js
// Run: node scripts/cleanup.js

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

async function cleanup() {
  try {
    console.log('🔧 Starting database cleanup...\n');

    // 1. Delete test drivers
    console.log('1️⃣ Removing test drivers (JOHN, TEST, DEMO, SAMPLE)...');
    const deleteResult = await pool.query(
      "DELETE FROM drivers WHERE LOWER(name) IN ('john', 'test', 'demo', 'sample') RETURNING name"
    );
    
    if (deleteResult.rows.length > 0) {
      console.log('   ✅ Deleted:', deleteResult.rows.map(r => r.name).join(', '));
    } else {
      console.log('   ℹ️  No test drivers found');
    }

    // 2. Check for PARVINDER
    console.log('\n2️⃣ Checking for PARVINDER...');
    const parvinderCheck = await pool.query(
      "SELECT id, name FROM drivers WHERE LOWER(name) LIKE '%parvinder%'"
    );
    
    if (parvinderCheck.rows.length > 0) {
      console.log('   ✅ PARVINDER exists:');
      parvinderCheck.rows.forEach(d => {
        console.log(`      ID: ${d.id}, Name: "${d.name}"`);
      });
    } else {
      console.log('   ℹ️  PARVINDER not found in database');
    }

    // 3. Check for duplicates
    console.log('\n3️⃣ Checking for duplicate drivers...');
    const duplicates = await pool.query(`
      SELECT LOWER(name) as name_lower, COUNT(*) as count, 
             STRING_AGG(name, ', ') as variations
      FROM drivers 
      GROUP BY LOWER(name) 
      HAVING COUNT(*) > 1
    `);
    
    if (duplicates.rows.length > 0) {
      console.log('   ⚠️  Found duplicates:');
      duplicates.rows.forEach(d => {
        console.log(`      "${d.name_lower}" appears ${d.count} times as: ${d.variations}`);
      });
      console.log('\n   💡 You may want to manually clean these up');
    } else {
      console.log('   ✅ No duplicates found');
    }

    // 4. Show all current drivers
    console.log('\n4️⃣ Current drivers in database:');
    const allDrivers = await pool.query(
      'SELECT id, name, active, truck_id FROM drivers ORDER BY name'
    );
    
    if (allDrivers.rows.length === 0) {
      console.log('   ⚠️  No drivers in database!');
    } else {
      console.log('   📋 Drivers:');
      allDrivers.rows.forEach(d => {
        const status = d.active ? '✓' : '✗';
        const truck = d.truck_id ? `(Truck: ${d.truck_id})` : '';
        console.log(`      ${status} ID: ${d.id} | ${d.name} ${truck}`);
      });
    }

    console.log('\n✅ Cleanup complete!\n');
    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error.message);
    console.error('Full error:', error);
    await pool.end();
    process.exit(1);
  }
}

// Run cleanup
console.log('═══════════════════════════════════════════════════════');
console.log('           DATABASE CLEANUP SCRIPT');
console.log('═══════════════════════════════════════════════════════\n');

cleanup();
