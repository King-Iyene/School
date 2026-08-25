import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { email, password, first_name, last_name, role, phone, gender, school_id, action, userId, ...extraData } = await req.json();

    if (action === 'delete') {
      if (!userId) throw new Error('User ID is required for deletion');
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteError) throw deleteError;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!email || !role) {
      throw new Error('Email and role are required');
    }

    // 1. Create the user in Auth
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: password || 'School@' + Math.random().toString(36).slice(-4),
      email_confirm: true,
      user_metadata: { first_name, last_name, role },
    });

    if (authError) throw authError;

    // 2. Create/Update the profile
    // Note: The database trigger handle_new_user should catch this, 
    // but we'll do an explicit upsert here for safety and to capture extra fields.
    const { error: profileError } = await adminClient.from('profiles').upsert({
      id: authData.user.id,
      email,
      first_name: first_name || '',
      last_name: last_name || '',
      role,
      phone: phone || '',
      gender: gender || '',
      school_id: school_id || null,
      is_active: true,
      ...extraData
    });

    if (profileError) {
      // Cleanup auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    return new Response(JSON.stringify({ user: authData.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Unexpected error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
