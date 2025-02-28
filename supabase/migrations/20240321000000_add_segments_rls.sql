-- Enable RLS
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;

-- Política para SELECT: usuarios autenticados pueden ver segmentos de sus sitios
CREATE POLICY "Users can view segments for their sites" ON segments
  FOR SELECT
  USING (
    site_id IN (
      SELECT s.id 
      FROM sites s
      INNER JOIN profiles p ON p.id = s.user_id
      WHERE p.id = auth.uid()
    )
  );

-- Política para INSERT: usuarios autenticados pueden crear segmentos en sus sitios
CREATE POLICY "Users can create segments for their sites" ON segments
  FOR INSERT
  WITH CHECK (
    site_id IN (
      SELECT s.id 
      FROM sites s
      INNER JOIN profiles p ON p.id = s.user_id
      WHERE p.id = auth.uid()
    )
  );

-- Política para UPDATE: usuarios autenticados pueden actualizar segmentos de sus sitios
CREATE POLICY "Users can update segments for their sites" ON segments
  FOR UPDATE
  USING (
    site_id IN (
      SELECT s.id 
      FROM sites s
      INNER JOIN profiles p ON p.id = s.user_id
      WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    site_id IN (
      SELECT s.id 
      FROM sites s
      INNER JOIN profiles p ON p.id = s.user_id
      WHERE p.id = auth.uid()
    )
  );

-- Política para DELETE: usuarios autenticados pueden eliminar segmentos de sus sitios
CREATE POLICY "Users can delete segments for their sites" ON segments
  FOR DELETE
  USING (
    site_id IN (
      SELECT s.id 
      FROM sites s
      INNER JOIN profiles p ON p.id = s.user_id
      WHERE p.id = auth.uid()
    )
  ); 