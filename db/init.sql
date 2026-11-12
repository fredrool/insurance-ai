-- Enable vector support
CREATE EXTENSION IF NOT EXISTS vector;

-- Initial experiments
CREATE TABLE IF NOT EXISTS insurance_documents (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding VECTOR(512) NOT NULL
);

-- RAG document chunks
CREATE TABLE IF NOT EXISTS document_chunks (
    id BIGSERIAL PRIMARY KEY,
    document_id TEXT NOT NULL,
    document_name TEXT NOT NULL,
    document_version TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(512) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (document_id, chunk_index)
);