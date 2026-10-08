-- La copia de respaldo de esta migracion estaba vacia. Permite instalaciones nuevas.
CREATE TABLE IF NOT EXISTS limites_solicitudes (
    clave CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    intentos INT UNSIGNED NOT NULL DEFAULT 0,
    ventana_iniciada_en DATETIME NOT NULL,
    INDEX idx_limites_ventana (ventana_iniciada_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
