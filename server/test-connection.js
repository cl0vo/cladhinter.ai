#!/usr/bin/env node

import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  console.log('🔍 Testing Neon PostgreSQL connection...\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in .env file');
    console.log('   Please add your Neon connection string to server/.env');
    process.exit(1);
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    
    // Test basic connection
    console.log('📡 Connecting to database...');
    const result = await sql`SELECT NOW() as current_time, version() as pg_version`;
    
    console.log('✅ Connection successful!\n');
    console.log('📊 Database info:');
    console.log(`   Time: ${result[0].current_time}`);
    console.log(`   PostgreSQL: ${result[0].pg_version.split(',')[0]}\n`);
    
    // Check tables
    console.log('📋 Checking tables...');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    if (tables.length === 0) {
      console.log('⚠️  No tables found. Run migrations first:');
      console.log('   npm run migrate\n');
    } else {
      console.log(`✅ Found ${tables.length} tables:\n`);
      tables.forEach(t => console.log(`   - ${t.table_name}`));
      console.log();
      
      // Get row counts
      console.log('📊 Row counts:');
      for (const table of tables) {
        const count = await sql`SELECT COUNT(*) as count FROM ${sql(table.table_name)}`;
        console.log(`   ${table.table_name.padEnd(20)} ${count[0].count} rows`);
      }
      console.log();
    }
    
    console.log('🎉 Everything looks good!\n');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Check your DATABASE_URL in server/.env');
    console.log('   2. Make sure ?sslmode=require is at the end');
    console.log('   3. Verify the database exists in Neon Console');
    console.log('   4. Check your internet connection\n');
    process.exit(1);
  }
}

testConnection();
