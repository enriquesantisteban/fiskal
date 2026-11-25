CREATE TABLE IF NOT EXISTS baloncesto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes text NOT NULL,
  anio text NOT NULL,
  temporada text NOT NULL,
  dinero_ingresado numeric(12, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ventas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ventas text NOT NULL,
  comercio text NOT NULL,
  dinero_aportado numeric(12, 2) NOT NULL DEFAULT 0,
  dinero_recogido numeric(12, 2) NOT NULL DEFAULT 0,
  beneficio numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compras text NOT NULL,
  comercio text NOT NULL,
  dinero_pagado numeric(12, 2) NOT NULL DEFAULT 0,
  a_medias boolean NOT NULL DEFAULT false,
  reembolso numeric(12, 2) NOT NULL DEFAULT 0,
  precio_final numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS informatica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente text NOT NULL,
  trabajo text NOT NULL,
  fecha_inicio date,
  fecha_finalizacion date,
  importe numeric(12, 2) NOT NULL DEFAULT 0,
  pagado numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE informatica ADD COLUMN IF NOT EXISTS importe numeric(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE informatica ADD COLUMN IF NOT EXISTS pagado numeric(12, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'informatica' AND column_name = 'importe_pagado'
  ) THEN
    UPDATE informatica SET importe = importe_pagado, pagado = importe_pagado;
    ALTER TABLE informatica DROP COLUMN importe_pagado;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS nominas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa text NOT NULL,
  mes text NOT NULL,
  anio text NOT NULL,
  pagado numeric(12, 2) NOT NULL DEFAULT 0
);
