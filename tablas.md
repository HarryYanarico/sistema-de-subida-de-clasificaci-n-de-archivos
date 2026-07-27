# Script SQL - Sistema de Digitalización de Archivos

```sql
-- ============================================
-- Script SQL para MySQL
-- Sistema de Digitalización de Archivos
-- ============================================

-- ============================================
-- Tabla: users
-- ============================================
CREATE TABLE `users` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `password` VARCHAR(128) NOT NULL,
    `last_login` DATETIME(6) NULL,
    `is_superuser` TINYINT(1) NOT NULL DEFAULT 0,
    `username` VARCHAR(150) NOT NULL,
    `first_name` VARCHAR(150) NOT NULL DEFAULT '',
    `last_name` VARCHAR(150) NOT NULL DEFAULT '',
    `email` VARCHAR(254) NOT NULL DEFAULT '',
    `is_staff` TINYINT(1) NOT NULL DEFAULT 0,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `date_joined` DATETIME(6) NOT NULL,
    `role` VARCHAR(20) NOT NULL DEFAULT 'operador',
    `telefono` VARCHAR(20) NOT NULL DEFAULT '',
    CONSTRAINT `uk_users_username` UNIQUE (`username`)
);

-- ============================================
-- Tabla: unidades
-- ============================================
CREATE TABLE `unidades` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `nombre` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `descripcion` TEXT NOT NULL DEFAULT '',
    `activo` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME(6) NOT NULL,
    `updated_at` DATETIME(6) NOT NULL,
    CONSTRAINT `uk_unidades_slug` UNIQUE (`slug`)
);

-- ============================================
-- Tabla: personas
-- ============================================
CREATE TABLE `personas` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `unidad_id` BIGINT NOT NULL,
    `codigo` VARCHAR(20) NOT NULL,
    `nombres` VARCHAR(255) NOT NULL,
    `apellidos` VARCHAR(255) NOT NULL,
    `ci` VARCHAR(20) NOT NULL DEFAULT '',
    `email` VARCHAR(254) NULL,
    `telefono` VARCHAR(20) NOT NULL DEFAULT '',
    `created_at` DATETIME(6) NOT NULL,
    `updated_at` DATETIME(6) NOT NULL,
    CONSTRAINT `uk_personas_codigo_unidad` UNIQUE (`codigo`, `unidad_id`),
    CONSTRAINT `fk_personas_unidad`
        FOREIGN KEY (`unidad_id`) REFERENCES `unidades` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- ============================================
-- Tabla: tipos_documento
-- ============================================
CREATE TABLE `tipos_documento` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `unidad_id` BIGINT NOT NULL,
    `nombre` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `palabras_clave` TEXT NOT NULL,
    `activo` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME(6) NOT NULL,
    `updated_at` DATETIME(6) NOT NULL,
    CONSTRAINT `uk_tipos_documento_slug_unidad` UNIQUE (`slug`, `unidad_id`),
    CONSTRAINT `fk_tipos_documento_unidad`
        FOREIGN KEY (`unidad_id`) REFERENCES `unidades` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- ============================================
-- Tabla: documentos
-- ============================================
CREATE TABLE `documentos` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `persona_id` BIGINT NOT NULL,
    `tipo_documento_id` BIGINT NULL,
    `archivo_original` VARCHAR(500) NOT NULL,
    `archivo_pagina` VARCHAR(500) NULL,
    `pagina_numero` INT NOT NULL,
    `texto_extraido` TEXT NOT NULL DEFAULT '',
    `estado` VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    `created_at` DATETIME(6) NOT NULL,
    `updated_at` DATETIME(6) NOT NULL,
    CONSTRAINT `fk_documentos_persona`
        FOREIGN KEY (`persona_id`) REFERENCES `personas` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_documentos_tipo_documento`
        FOREIGN KEY (`tipo_documento_id`) REFERENCES `tipos_documento` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- ============================================
-- Tablas auxiliares de Django
-- ============================================

CREATE TABLE `django_content_type` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `app_label` VARCHAR(100) NOT NULL,
    `model` VARCHAR(100) NOT NULL,
    CONSTRAINT `uk_django_content_type` UNIQUE (`app_label`, `model`)
);

CREATE TABLE `auth_permission` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `content_type_id` INT NOT NULL,
    `codename` VARCHAR(100) NOT NULL,
    CONSTRAINT `fk_auth_permission_content_type`
        FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE `auth_group` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    CONSTRAINT `uk_auth_group_name` UNIQUE (`name`)
);

CREATE TABLE `auth_group_permissions` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `group_id` INT NOT NULL,
    `permission_id` INT NOT NULL,
    CONSTRAINT `fk_group_permissions_group`
        FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_group_permissions_permission`
        FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE `users_user_groups` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT NOT NULL,
    `group_id` INT NOT NULL,
    CONSTRAINT `fk_user_groups_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_user_groups_group`
        FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE `users_user_user_permissions` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT NOT NULL,
    `permission_id` INT NOT NULL,
    CONSTRAINT `fk_user_permissions_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_user_permissions_permission`
        FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE `django_session` (
    `session_key` VARCHAR(40) PRIMARY KEY,
    `session_data` LONGTEXT NOT NULL,
    `expire_date` DATETIME(6) NOT NULL
);

CREATE TABLE `django_migrations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `app` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `applied` DATETIME(6) NOT NULL
);

CREATE TABLE `django_admin_log` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `action_time` DATETIME(6) NOT NULL,
    `object_id` TEXT NULL,
    `object_repr` VARCHAR(200) NOT NULL,
    `action_flag` SMALLINT UNSIGNED NOT NULL,
    `change_message` TEXT NOT NULL,
    `content_type_id` INT NULL,
    `user_id` BIGINT NOT NULL,
    CONSTRAINT `fk_admin_log_content_type`
        FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_admin_log_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
);
```
