import { ensurePaymentSchema, ensureChatbotSchema } from './ensure.js';

async function migrate() {
  await ensurePaymentSchema();
  await ensureChatbotSchema();
  console.log('Migrations applied: payments EPS columns + eps_ipn_log.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
