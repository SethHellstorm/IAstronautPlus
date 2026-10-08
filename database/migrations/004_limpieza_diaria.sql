-- Ejecutar en la base de sincronizacion. No requiere cambiar event_scheduler si ya esta ON.
-- Las horas de retencion y el horario del evento se calculan en UTC.
SET time_zone = '+00:00';
DELIMITER $$
CREATE EVENT IF NOT EXISTS sync_limpieza_diaria
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP + INTERVAL 1 DAY
ON COMPLETION PRESERVE
ENABLE
COMMENT 'Retencion de datos antiguos de sincronizacion; conserva actividad vigente'
DO
BEGIN
    DECLARE bloqueo INT DEFAULT 0;
    DECLARE nombre_bloqueo VARCHAR(64);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        IF bloqueo = 1 THEN DO RELEASE_LOCK(nombre_bloqueo); END IF;
        RESIGNAL;
    END;
    SET nombre_bloqueo = SHA2(CONCAT('sync_', DATABASE()), 256);
    SELECT GET_LOCK(nombre_bloqueo, 5) INTO bloqueo;
    IF bloqueo = 1 THEN
        START TRANSACTION;
        -- INICIO_RETENCION
        DELETE FROM eventos
        WHERE creado_en <= UTC_TIMESTAMP() - INTERVAL 24 HOUR
          AND expira_en <= UTC_TIMESTAMP();

        -- Las asociaciones se eliminan mediante su FK ON DELETE CASCADE.
        -- Una sesion con eventos recientes se conserva hasta la siguiente limpieza.
        DELETE FROM sesiones
        WHERE creada_en <= UTC_TIMESTAMP() - INTERVAL 24 HOUR
          AND expira_en <= UTC_TIMESTAMP()
          AND NOT EXISTS (SELECT 1 FROM eventos e WHERE e.sesion_id = sesiones.id);

        -- No hay fecha de creacion de acceso: se retiene 24 h desde su vencimiento.
        DELETE FROM sync_accesos
        WHERE expira_en <= UTC_TIMESTAMP() - INTERVAL 24 HOUR
          AND NOT EXISTS (SELECT 1 FROM sync_acceso_sesiones m WHERE m.acceso_id = sync_accesos.id);

        -- Las ventanas actuales duran 300 segundos; no se borran contadores recientes.
        DELETE FROM limites_solicitudes
        WHERE ventana_iniciada_en <= UTC_TIMESTAMP() - INTERVAL 24 HOUR;
        -- FIN_RETENCION
        COMMIT;
        DO RELEASE_LOCK(nombre_bloqueo);
    END IF;
END$$
DELIMITER ;
