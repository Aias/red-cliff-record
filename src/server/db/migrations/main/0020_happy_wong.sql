-- Create extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move existing extensions
ALTER EXTENSION vector SET SCHEMA extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- Set the search path to include extensions
ALTER DATABASE "redcliffrecord" SET search_path TO public, extensions;