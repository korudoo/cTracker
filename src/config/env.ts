const requiredEnv = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const;

type RequiredEnv = (typeof requiredEnv)[number];

function readEnvVar(name: RequiredEnv): string {
  const value = import.meta.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  supabaseUrl: readEnvVar('VITE_SUPABASE_URL'),
  supabaseAnonKey: readEnvVar('VITE_SUPABASE_ANON_KEY'),
};
