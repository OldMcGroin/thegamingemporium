-- Run this once in the existing gaming-emporium-suggestions D1 database.
ALTER TABLE suggestions ADD COLUMN category TEXT;

-- Existing rows remain valid with a blank category. New submissions require a category.
