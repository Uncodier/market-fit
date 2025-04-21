-- Añadir columna performance como bitmask a la tabla commands
ALTER TABLE commands ADD COLUMN performance INTEGER DEFAULT 0;

-- Crear un comentario para documentar el significado de los bits
COMMENT ON COLUMN commands.performance IS 'Bitmask para almacenar el rendimiento del comando: bit 0 = like (1), bit 1 = dislike (2), bit 2 = flag (4)';

-- Crear una función para validar que like y dislike no estén activos simultáneamente
CREATE OR REPLACE FUNCTION validate_performance_bitmask()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar que like y dislike no estén activos simultáneamente
  IF (NEW.performance & 1) = 1 AND (NEW.performance & 2) = 2 THEN
    RAISE EXCEPTION 'Like y dislike no pueden estar activos simultáneamente';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear un trigger para validar el bitmask antes de insertar o actualizar
CREATE TRIGGER validate_performance_bitmask_trigger
BEFORE INSERT OR UPDATE ON commands
FOR EACH ROW
EXECUTE FUNCTION validate_performance_bitmask();

-- Crear índices para mejorar el rendimiento de las consultas
CREATE INDEX idx_commands_performance ON commands(performance);

-- Crear vistas para facilitar las consultas
CREATE VIEW commands_likes AS
SELECT * FROM commands WHERE (performance & 1) = 1;

CREATE VIEW commands_dislikes AS
SELECT * FROM commands WHERE (performance & 2) = 2;

CREATE VIEW commands_flags AS
SELECT * FROM commands WHERE (performance & 4) = 4;

-- Crear funciones de ayuda para manipular el bitmask
CREATE OR REPLACE FUNCTION set_like(command_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Establecer like (bit 0) y eliminar dislike (bit 1) si está presente
  UPDATE commands 
  SET performance = (performance & ~2) | 1
  WHERE id = command_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_dislike(command_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Establecer dislike (bit 1) y eliminar like (bit 0) si está presente
  UPDATE commands 
  SET performance = (performance & ~1) | 2
  WHERE id = command_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION toggle_flag(command_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Alternar el estado del flag (bit 2)
  UPDATE commands 
  SET performance = performance ^ 4
  WHERE id = command_id;
END;
$$ LANGUAGE plpgsql;

-- Crear una función para obtener el estado actual del bitmask
CREATE OR REPLACE FUNCTION get_performance_status(command_id UUID)
RETURNS TABLE (
  has_like BOOLEAN,
  has_dislike BOOLEAN,
  has_flag BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (performance & 1) = 1 AS has_like,
    (performance & 2) = 2 AS has_dislike,
    (performance & 4) = 4 AS has_flag
  FROM commands
  WHERE id = command_id;
END;
$$ LANGUAGE plpgsql; 