revoke all on function public.ensure_current_user_bootstrapped() from public, anon;
grant execute on function public.ensure_current_user_bootstrapped() to authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;