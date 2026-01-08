-- Migration: Permitir CNPJ nulo para reset de fábrica
-- Data: 2024

-- Alterar coluna CNPJ para permitir NULL
ALTER TABLE empresas ALTER COLUMN cnpj DROP NOT NULL;

-- Manter UNIQUE constraint (CNPJs válidos ainda não podem duplicar)
-- A constraint UNIQUE já permite múltiplos NULLs no PostgreSQL
