import { query } from '../config/db.js';
import { isUsableSlug, uniqueSlug } from '../utils/helpers.js';

async function addColumnIfMissing(table, column, definition) {
  await query(
    `DO $$ BEGIN
       ALTER TABLE ${table} ADD COLUMN ${column} ${definition};
     EXCEPTION WHEN duplicate_column THEN NULL;
     END $$`
  );
}

export async function ensurePaymentSchema() {
  await addColumnIfMissing('payments', 'eps_transaction_id', 'VARCHAR(64)');
  await addColumnIfMissing('payments', 'rejection_reason', 'TEXT');
  await addColumnIfMissing('payments', 'reviewed_at', 'TIMESTAMPTZ');

  await query(`
    CREATE TABLE IF NOT EXISTS eps_ipn_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      eps_transaction_id VARCHAR(64),
      merchant_transaction_id VARCHAR(100),
      store_id VARCHAR(64),
      status VARCHAR(32),
      total_amount DECIMAL(12,4),
      store_amount DECIMAL(12,4),
      transaction_type VARCHAR(64),
      financial_entity VARCHAR(128),
      ipn_timestamp BIGINT,
      raw_json TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_ipn_mtxn ON eps_ipn_log (merchant_transaction_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ipn_eps ON eps_ipn_log (eps_transaction_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_payments_txn ON payments (transaction_id)`);

  await query(
    `INSERT INTO platform_settings (key, value)
     VALUES
       ('eps_enabled', 'true'::jsonb),
       ('min_recharge_amount', '1'::jsonb)
     ON CONFLICT (key) DO NOTHING`
  );
}

export async function ensureChatbotSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS chatbot_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS chatbot_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES chatbot_sessions(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      courses JSONB DEFAULT '[]',
      sources JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_user ON chatbot_sessions(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_chatbot_messages_session ON chatbot_messages(session_id, created_at)`);

  await query(
    `INSERT INTO platform_settings (key, value)
     VALUES
       ('chatbot_enabled', 'true'::jsonb),
       ('craftx_api_key', '""'::jsonb),
       ('craftx_model', '"Qwen3 VL 30B"'::jsonb)
     ON CONFLICT (key) DO NOTHING`
  );
}

export async function repairEmptyCourseSlugs() {
  const { rows } = await query(
    `SELECT id, title, slug FROM courses
     WHERE slug IS NULL OR btrim(slug) = '' OR slug = '-' OR slug ~ '^-+[0-9]*$'`
  );
  for (const course of rows) {
    const slug = await uniqueSlug(course.title || `course-${course.id.slice(0, 8)}`, 'courses', course.id);
    if (!isUsableSlug(course.slug) || course.slug !== slug) {
      await query('UPDATE courses SET slug = $1, updated_at = NOW() WHERE id = $2', [slug, course.id]);
    }
  }
  return rows.length;
}
