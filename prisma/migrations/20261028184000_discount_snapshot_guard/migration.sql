BEGIN;
-- CHECKs de PostgreSQL aceitam UNKNOWN; exigir o tipo evita snapshots incompletos.
ALTER TABLE cobranca ADD CONSTRAINT cobranca_desconto_tipo_obrigatorio
  CHECK (desconto_id IS NULL OR desconto_tipo_aplicado IS NOT NULL);
COMMIT;
