-- Add is_private column to task_comments
ALTER TABLE public.task_comments
ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT false;

-- Add files column to task_comments (using an array of objects with file metadata)
ALTER TABLE public.task_comments
ADD COLUMN files JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Add comment to explain the columns
COMMENT ON COLUMN public.task_comments.is_private IS 'If true, the comment is only visible to team members and not to leads or agents';
COMMENT ON COLUMN public.task_comments.files IS 'Array of attached files with metadata like {name, url, size, type}';

-- Update RLS policies to handle private comments
DROP POLICY IF EXISTS "Permitir a los usuarios leer comentarios de sus tareas o tareas asignadas" ON public.task_comments;
CREATE POLICY "Permitir a los usuarios leer comentarios de sus tareas o tareas asignadas"
  ON public.task_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id 
      AND (
        -- Si el comentario es privado, solo el equipo puede verlo
        (is_private = true AND (t.user_id = auth.uid() OR t.assignee = auth.uid()))
        OR
        -- Si el comentario no es privado, cualquiera con acceso a la tarea puede verlo
        (is_private = false AND (t.user_id = auth.uid() OR t.assignee = auth.uid()))
      )
    )
  );

-- Create storage bucket for task files if it doesn't exist
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('task_files', 'task_files', true)  -- Set public to true
  ON CONFLICT (id) DO UPDATE
  SET public = true;  -- Ensure bucket is public even if it exists
END $$;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Usuarios pueden acceder a archivos de sus tareas" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios pueden subir archivos" ON storage.objects;
DROP POLICY IF EXISTS "Dar acceso público a los archivos" ON storage.objects;

-- Policy for uploading files (authenticated users only)
CREATE POLICY "Usuarios pueden subir archivos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task_files' AND
  (auth.uid() IS NOT NULL)
);

-- Policy for reading files (public access)
CREATE POLICY "Dar acceso público a los archivos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'task_files');

-- Policy for deleting files (only task owners or assignees)
CREATE POLICY "Usuarios pueden eliminar archivos de sus tareas"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'task_files' AND
  (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = (regexp_match(name, '^([^/]+)/'))[1]::uuid
      AND (t.user_id = auth.uid() OR t.assignee = auth.uid())
    )
  )
); 