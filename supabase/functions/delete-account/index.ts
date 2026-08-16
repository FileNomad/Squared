import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Method not allowed.",
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {
    const authHeader =
      req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: "Not authenticated.",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { password } =
      await req.json();

    if (
      typeof password !== "string" ||
      !password
    ) {
      return new Response(
        JSON.stringify({
          error: "Password is required.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL"
      )!;

    const anonKey =
      Deno.env.get(
        "SUPABASE_ANON_KEY"
      )!;

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      )!;

    const token =
      authHeader.replace(
        "Bearer ",
        ""
      );

    const userClient =
      createClient(
        supabaseUrl,
        anonKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );

    const {
      data: userData,
      error: userError,
    } =
      await userClient.auth.getUser(
        token
      );

    if (
      userError ||
      !userData.user
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Your session is no longer valid.",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        }
      );
    }

    const user =
      userData.user;

    if (!user.email) {
      return new Response(
        JSON.stringify({
          error:
            "This account does not have an email address.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        }
      );
    }

    //
    // Verify the password independently on the server.
    //
    const passwordClient =
      createClient(
        supabaseUrl,
        anonKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );

    const {
      data:
        passwordVerification,
      error:
        passwordError,
    } =
      await passwordClient.auth
        .signInWithPassword({
          email: user.email,
          password,
        });

    if (
      passwordError ||
      !passwordVerification.user ||
      passwordVerification.user.id !==
        user.id
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Incorrect password.",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        }
      );
    }

    //
    // From here onwards we use the privileged
    // server-side client.
    //
    const adminClient =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );

    const {
      error: cleanupError,
    } =
      await adminClient.rpc(
        "prepare_account_deletion",
        {
          p_user_id: user.id,
        }
      );

    if (cleanupError) {
      console.error(
        "Account cleanup failed:",
        cleanupError
      );

      return new Response(
        JSON.stringify({
          error:
            "Could not prepare the account for deletion.",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        }
      );
    }

    //
    // Soft-delete Auth account.
    //
    const {
      error: deleteError,
    } =
      await adminClient.auth.admin
        .deleteUser(
          user.id,
          true
        );

    if (deleteError) {
      console.error(
        "Auth deletion failed:",
        deleteError
      );

      return new Response(
        JSON.stringify({
          error:
            "Could not delete the account.",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );
  } catch (error) {
    console.error(
      "Delete account error:",
      error
    );

    return new Response(
      JSON.stringify({
        error:
          "Unexpected server error.",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );
  }
});
