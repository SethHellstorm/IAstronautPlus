-- Ejecutar sobre la base indicada por DB_DATABASE. No contiene datos ni credenciales.
-- Si las tablas ya existen, no modifica su estructura.

CREATE TABLE IF NOT EXISTS `sesiones` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `codigo` char(6) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `token_emisor_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `token_receptor_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `estado` enum('esperando','vinculada','cerrada') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'esperando',
  `creada_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `codigo_expira_en` datetime NOT NULL,
  `expira_en` datetime NOT NULL,
  `vinculada_en` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `eventos` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `sesion_id` bigint unsigned NOT NULL,
  `clave_evento` char(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `tipo` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `datos` json NOT NULL,
  `creado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expira_en` datetime NOT NULL,
  `confirmado_en` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_eventos_clave` (`sesion_id`,`clave_evento`),
  KEY `idx_eventos_pendientes` (`sesion_id`,`confirmado_en`,`id`),
  CONSTRAINT `fk_eventos_sesion` FOREIGN KEY (`sesion_id`) REFERENCES `sesiones` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

