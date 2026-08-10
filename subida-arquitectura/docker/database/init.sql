-- Script de inicializacion de PostgreSQL
-- Este archivo se ejecuta automaticamente al iniciar el contenedor por primera vez

-- La base de datos se crea via variable de entorno POSTGRES_DB
-- Este script es para inicializaciones adicionales si se necesitan

-- Crear extensiones utiles
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
