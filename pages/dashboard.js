const { data: sites, error } = await supabase
  .from('sites')
  .select('id, name, url')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false }) 