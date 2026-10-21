-- WhatsApp passa a ser o contato obrigatório; o e-mail vira um campo opcional à parte.
-- Cadastros antigos ficam com email vazio (o contato deles continua em contact/contact_type).
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email text;
