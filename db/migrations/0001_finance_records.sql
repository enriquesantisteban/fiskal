CREATE TABLE IF NOT EXISTS finance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('basketball', 'sales', 'purchases', 'it', 'payroll')),
  data jsonb NOT NULL,
  sort_order integer NOT NULL,
  legacy_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category, legacy_key)
);

CREATE INDEX IF NOT EXISTS finance_records_category_order_idx
  ON finance_records (category, sort_order, created_at);
