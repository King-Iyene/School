import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const OGS_SCHOOL_ID = '10107e81-ae9f-43f0-92c1-56e13a2029d8';

const LEADERS = [
  {
    email: 'proprietor@okrikagrammarschool.org',
    password: 'OGSProprietor@2025',
    first_name: 'Rt Revd Enoch',
    last_name: 'Atuboyedia',
    role: 'super_admin',
    staff_id: 'OGS/PRO/001',
    department: 'Administration',
    join_date: '1990-01-01',
    title: 'Proprietor / Bishop',
  },
  {
    email: 'principal@okrikagrammarschool.org',
    password: 'OGSPrincipal@2025',
    first_name: 'Kelvin Sampson',
    last_name: 'Fubara',
    role: 'super_admin',
    phone: '09034210590',
    staff_id: 'OGS/PRN/001',
    department: 'Administration',
    join_date: '2000-01-01',
    title: 'Principal',
  },
  {
    email: 'vp@okrikagrammarschool.org',
    password: 'OGSVicePrincipal@2025',
    first_name: 'Aninibia',
    last_name: 'Abbey-Kalio',
    role: 'super_admin',
    staff_id: 'OGS/VP/001',
    department: 'Administration',
    join_date: '2000-01-01',
    title: 'Vice Principal',
  },
];

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

    const results = [];

    for (const leader of LEADERS) {
      const { data: existing } = await adminClient
        .from('profiles')
        .select('id, email')
        .eq('email', leader.email)
        .maybeSingle();

      if (existing) {
        results.push({ email: leader.email, status: 'already_exists' });
        continue;
      }

      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: leader.email,
        password: leader.password,
        email_confirm: true,
        user_metadata: { first_name: leader.first_name, last_name: leader.last_name, role: leader.role },
      });

      if (authError) {
        results.push({ email: leader.email, status: 'error', error: authError.message });
        continue;
      }

      const { error: profileError } = await adminClient.from('profiles').upsert({
        id: authData.user.id,
        email: leader.email,
        first_name: leader.first_name,
        last_name: leader.last_name,
        role: leader.role,
        phone: (leader as any).phone ?? '',
        school_id: OGS_SCHOOL_ID,
        is_active: true,
        staff_id: leader.staff_id,
        department: leader.department,
        join_date: leader.join_date,
      });

      if (profileError) {
        await adminClient.auth.admin.deleteUser(authData.user.id);
        results.push({ email: leader.email, status: 'profile_error', error: profileError.message });
        continue;
      }

      results.push({ email: leader.email, status: 'created', id: authData.user.id, title: leader.title });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
