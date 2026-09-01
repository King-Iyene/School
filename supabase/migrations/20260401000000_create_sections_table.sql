-- Force a PostgREST schema cache reload to resolve any '400 Bad Request' ghost errors
NOTIFY pgrst, 'reload schema';
