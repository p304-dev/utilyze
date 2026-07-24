-- Replace the blanket unique constraint on idempotency_key with a partial
-- unique index that only prevents duplicate 'sent' alerts.
-- This allows re-testing (test_logged) and re-trying after failures without
-- conflicting with the idempotency guarantee for real sends.

ALTER TABLE alert_logs DROP CONSTRAINT IF EXISTS alert_logs_idempotency_key_key;

CREATE UNIQUE INDEX IF NOT EXISTS alert_logs_sent_idempotency
  ON alert_logs (idempotency_key)
  WHERE status = 'sent';
