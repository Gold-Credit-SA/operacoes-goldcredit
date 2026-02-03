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
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Client with user's token to verify they're admin
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is master admin
    if (user.email !== MASTER_EMAIL) {
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
        // List all users with profiles and roles
        const { data: profiles, error } = await supabaseAdmin
          .from('profiles')
          .select('*, user_roles(role)')
          .order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, data: profiles }),
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
        const { userId, name, password, role } = data;

        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'User ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update profile name if provided
        if (name) {
          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ name })
            .eq('user_id', userId);

          if (profileError) throw profileError;
        }

        // Update password if provided
        if (password) {
          const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password,
          });

          if (authError) throw authError;
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
