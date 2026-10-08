CREATE TABLE IF NOT EXISTS sync_accesos (
 id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 version_password CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 expira_en DATETIME NOT NULL,
 revocado TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS sync_acceso_sesiones (
 acceso_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 sesion_id BIGINT UNSIGNED NOT NULL,
 rol ENUM('emisor','receptor') NOT NULL,
 PRIMARY KEY (sesion_id, rol),
 INDEX (acceso_id),
 FOREIGN KEY (acceso_id) REFERENCES sync_accesos(id),
 FOREIGN KEY (sesion_id) REFERENCES sesiones(id) ON DELETE CASCADE
) ENGINE=InnoDB;
