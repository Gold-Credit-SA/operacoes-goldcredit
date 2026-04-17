import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MASTER_EMAIL = 'renan@goldcreditsa.com.br';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Validate token using getClaims (compatible with signing-keys)
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims?.sub) {
      console.error('Auth error:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callingUser = { id: claimsData.claims.sub as string, email: claimsData.claims.email as string };

    const userEmail = callingUser.email as string;
    const userId = callingUser.id;

    // Check if user is master admin
    if (userEmail !== MASTER_EMAIL) {
      return new Response(
        JSON.stringify({ error: 'Access denied. Only master admin can manage users.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Admin client with service role for user management
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { action, ...data } = await req.json();

    switch (action) {
      case 'list': {
        // List all profiles
        const { data: profiles, error: profilesError } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (profilesError) throw profilesError;

        // Get all roles
        const { data: roles, error: rolesError } = await supabaseAdmin
          .from('user_roles')
          .select('*');

        if (rolesError) throw rolesError;

        // Combine profiles with their roles
        const usersWithRoles = (profiles || []).map(profile => {
          const userRoles = (roles || []).filter(r => r.user_id === profile.user_id);
          return {
            ...profile,
            user_roles: userRoles.map(r => ({ role: r.role }))
          };
        });

        return new Response(
          JSON.stringify({ success: true, data: usersWithRoles }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create': {
        const { email, password, name, role = 'user' } = data;

        if (!email || !password || !name) {
          return new Response(
            JSON.stringify({ error: 'Email, password, and name are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create user in auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true, // Auto-confirm since admin is creating
        });

        if (authError) {
          return new Response(
            JSON.stringify({ error: authError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const userId = authData.user.id;

        // Create profile
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert({ user_id: userId, email, name });

        if (profileError) {
          // Rollback: delete auth user
          await supabaseAdmin.auth.admin.deleteUser(userId);
          throw profileError;
        }

        // Create role
        const userRole = email === MASTER_EMAIL ? 'admin' : role;
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .insert({ user_id: userId, role: userRole });

        if (roleError) {
          // Rollback
          await supabaseAdmin.auth.admin.deleteUser(userId);
          throw roleError;
        }

        return new Response(
          JSON.stringify({ success: true, data: { id: userId, email, name, role: userRole } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        const { userId, name, email, password, role } = data;

        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'User ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get current profile to check master status and current email
        const { data: currentProfile } = await supabaseAdmin
          .from('profiles')
          .select('email')
          .eq('user_id', userId)
          .single();

        // Update profile name if provided
        if (name) {
          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ name })
            .eq('user_id', userId);

          if (profileError) throw profileError;
        }

        // Update email if provided (not allowed for master admin)
        if (email && email !== currentProfile?.email) {
          if (currentProfile?.email === MASTER_EMAIL) {
            return new Response(
              JSON.stringify({ error: 'Não é permitido alterar o e-mail do administrador master.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const { error: authEmailError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            email,
            email_confirm: true,
          });
          if (authEmailError) {
            return new Response(
              JSON.stringify({ error: `Erro ao atualizar e-mail: ${authEmailError.message}` }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const { error: profileEmailError } = await supabaseAdmin
            .from('profiles')
            .update({ email })
            .eq('user_id', userId);

          if (profileEmailError) throw profileEmailError;
        }

        // Update password if provided
        if (password) {
          const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password,
          });

          if (authError) throw authError;

          // Force password change on next login
          const { error: flagError } = await supabaseAdmin
            .from('profiles')
            .update({ must_change_password: true })
            .eq('user_id', userId);

          if (flagError) throw flagError;
        }

        // Update role if provided
        if (role) {
          const { error: roleError } = await supabaseAdmin
            .from('user_roles')
            .update({ role })
            .eq('user_id', userId);

          if (roleError) throw roleError;
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        const { userId } = data;

        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'User ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if trying to delete master admin
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('email')
          .eq('user_id', userId)
          .single();

        if (profile?.email === MASTER_EMAIL) {
          return new Response(
            JSON.stringify({ error: 'Cannot delete master admin' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Delete user (cascades to profiles and roles)
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
