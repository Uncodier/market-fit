-- Final cleanup for task_comments policies
-- This fixes the multiple policies issue and optimizes auth function calls

-- Drop ALL existing policies completely
DROP POLICY IF EXISTS "task_comments_optimized_policy" ON public.task_comments;
DROP POLICY IF EXISTS "task_comments_fixed_policy" ON public.task_comments;
DROP POLICY IF EXISTS "task_comments_unified_policy" ON public.task_comments;
DROP POLICY IF EXISTS "Permitir a los usuarios leer comentarios de sus tareas o tareas asignadas" ON public.task_comments;
DROP POLICY IF EXISTS "Permitir a los usuarios crear comentarios en sus tareas o tareas asignadas" ON public.task_comments;
DROP POLICY IF EXISTS "Permitir a los usuarios actualizar sus propios comentarios" ON public.task_comments;
DROP POLICY IF EXISTS "Permitir a los usuarios eliminar sus propios comentarios" ON public.task_comments;
DROP POLICY IF EXISTS "Users can view comments on tasks they have access to" ON public.task_comments;
DROP POLICY IF EXISTS "Users can create comments on tasks they have access to" ON public.task_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.task_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.task_comments;

-- Create single optimized policy with proper auth function usage
CREATE POLICY "task_comments_final_policy" ON public.task_comments
FOR ALL USING (
  -- Allow users to manage their own comments (optimized auth call)
  user_id = (SELECT auth.uid()) OR
  -- Allow access to comments on tasks they own or are assigned to
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_comments.task_id 
    AND (
      t.user_id = (SELECT auth.uid()) OR 
      t.assignee = (SELECT auth.uid())
    )
  )
);

-- Add helpful comment
COMMENT ON POLICY "task_comments_final_policy" ON public.task_comments IS 'Optimized policy allowing users to manage comments on tasks they own, are assigned to, or comments they created'; 