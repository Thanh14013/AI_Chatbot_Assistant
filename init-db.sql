-- Initialize PostgreSQL Database for AI Chatbot Assistant
-- This script runs automatically when the PostgreSQL container starts for the first time

-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create additional extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set default timezone
SET timezone = 'UTC';

-- You can add more initialization scripts here
-- For example: creating initial users, setting up permissions, etc.

-- Note: Sequelize migrations should handle table creation
-- This file is mainly for extensions and initial setup
