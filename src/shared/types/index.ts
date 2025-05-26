/**
 * Shared types used across client and server
 *
 * Frontend should import types from here instead of directly from @/db/schema
 * This maintains proper client/server separation while sharing necessary types
 */

// Re-export all shared types for convenient importing
export * from './database';
export * from './api';
export * from './domain';
export * from './media';
