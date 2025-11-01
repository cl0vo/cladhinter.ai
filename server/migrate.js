import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrate() {
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    console.log('🔄 Running database migrations...');
    
    // Read schema file
    const schemaPath = join(__dirname, 'database', 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    
    // Split by semicolons and execute each statement
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      await sql(statement);
    }
    
    console.log('✅ Database migrations completed successfully!');
    console.log('📊 Tables created:');
    console.log('   - users');
    console.log('   - sessions');
    console.log('   - ad_watches');
    console.log('   - daily_watch_counts');
    console.log('   - orders');
    console.log('   - reward_claims');
    console.log('   - daily_bonus_claims');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
