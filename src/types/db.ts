export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          opening_balance: number;
          notifications_enabled: boolean;
          timezone: string;
          calendar_preference: 'AD' | 'BS';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          opening_balance?: number;
          notifications_enabled?: boolean;
          timezone?: string;
          calendar_preference?: 'AD' | 'BS';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          opening_balance?: number;
          notifications_enabled?: boolean;
          timezone?: string;
          calendar_preference?: 'AD' | 'BS';
          updated_at?: string;
        };
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          is_default: boolean;
          opening_balance: number;
          current_balance: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          is_default?: boolean;
          opening_balance?: number;
          current_balance?: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          is_default?: boolean;
          opening_balance?: number;
          current_balance?: number;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          type: 'deposit' | 'cheque' | 'withdrawal';
          amount: number;
          status: 'pending' | 'deducted' | 'cleared';
          due_date: string;
          created_date: string;
          cheque_number: string | null;
          payee: string | null;
          description: string | null;
          reference_number: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          account_id: string;
          type: 'deposit' | 'cheque' | 'withdrawal';
          amount: number;
          status?: 'pending' | 'deducted' | 'cleared';
          due_date: string;
          created_date?: string;
          cheque_number?: string | null;
          payee?: string | null;
          description?: string | null;
          reference_number?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          type?: 'deposit' | 'cheque' | 'withdrawal';
          amount?: number;
          status?: 'pending' | 'deducted' | 'cleared';
          due_date?: string;
          created_date?: string;
          cheque_number?: string | null;
          payee?: string | null;
          description?: string | null;
          reference_number?: string | null;
          updated_at?: string;
        };
      };
    };
    Functions: {
      process_due_status_transitions: {
        Args: {
          p_timezone?: string;
        };
        Returns: {
          updated_cheques_withdrawals: number;
          updated_deposits: number;
          local_date: string;
        };
      };
    };
    Enums: {
      transaction_type: 'deposit' | 'cheque' | 'withdrawal';
      transaction_status: 'pending' | 'deducted' | 'cleared';
      calendar_mode: 'AD' | 'BS';
    };
  };
}
