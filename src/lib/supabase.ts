import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          address: string | null;
          city: string | null;
          postcode: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          address?: string | null;
          city?: string | null;
          postcode?: string | null;
        };
        Update: {
          full_name?: string | null;
          phone?: string | null;
          address?: string | null;
          city?: string | null;
          postcode?: string | null;
        };
      };
      bookings: {
        Row: {
          id: string;
          user_id: string;
          service_type: string;
          service_name: string;
          date: string;
          time_slot: string;
          address: string;
          city: string;
          postcode: string;
          status: string;
          payment_status?: string | null;
          price: number;
          notes: string | null;
          created_at: string;
          invoice_number: string | null;
          recurring_plan_id?: string | null;
          recurring_freq?: string | null;
          reminder_sent?: boolean | null;
          refunded_amount?: number | null;
          bedrooms?: number | null;
          bathrooms?: number | null;
          living_rooms?: number | null;
          extras?: string[] | null;
          property_type?: string | null;
          duration_hours?: number | null;
        };
        Insert: {
          user_id: string;
          service_type: string;
          service_name: string;
          date: string;
          time_slot: string;
          address: string;
          city: string;
          postcode: string;
          status?: string;
          price: number;
          notes?: string | null;
          invoice_number?: string | null;
          bedrooms?: number | null;
          bathrooms?: number | null;
          living_rooms?: number | null;
          extras?: any;
          property_type?: string | null;
          duration_hours?: number | null;
        };
        Update: {
          status?: string;
          notes?: string | null;
          bedrooms?: number | null;
          bathrooms?: number | null;
          living_rooms?: number | null;
          extras?: any;
          property_type?: string | null;
          duration_hours?: number | null;
        };
      };
    };
  };
};
