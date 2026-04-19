// Hand-authored to mirror supabase/migrations/*.sql. Regenerate with
//   supabase gen types typescript --linked --schema public > lib/database.types.ts
// once the project is linked and migrations are applied.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type StockStatus =
  | "in_stock"
  | "out_of_stock"
  | "low_stock"
  | "unavailable"
  | "unknown";

export type PriceChangeType = "initial" | "increase" | "decrease";
export type StockChangeType = "initial" | "changed";
export type ScrapeRunType = "initial" | "daily";
export type ScrapeRunStatus = "running" | "succeeded" | "failed";

export type Database = {
  public: {
    Tables: {
      manufacturers: {
        Row: {
          id: number;
          name: string;
          slug: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          slug: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          slug?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      perfumes: {
        Row: {
          id: number;
          manufacturer_id: number;
          name: string;
          slug: string;
          canonical_description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          manufacturer_id: number;
          name: string;
          slug: string;
          canonical_description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          manufacturer_id?: number;
          name?: string;
          slug?: string;
          canonical_description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "perfumes_manufacturer_id_fkey";
            columns: ["manufacturer_id"];
            isOneToOne: false;
            referencedRelation: "manufacturers";
            referencedColumns: ["id"];
          },
        ];
      };
      retailers: {
        Row: {
          id: number;
          name: string;
          slug: string;
          base_url: string;
        };
        Insert: {
          id?: number;
          name: string;
          slug: string;
          base_url: string;
        };
        Update: {
          id?: number;
          name?: string;
          slug?: string;
          base_url?: string;
        };
        Relationships: [];
      };
      perfume_listings: {
        Row: {
          id: number;
          perfume_id: number;
          retailer_id: number;
          source_url: string;
          source_product_id: string | null;
          source_title: string;
          source_description: string | null;
          active: boolean;
          first_seen_at: string;
          last_seen_at: string;
          last_scraped_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          perfume_id: number;
          retailer_id: number;
          source_url: string;
          source_product_id?: string | null;
          source_title: string;
          source_description?: string | null;
          active?: boolean;
          first_seen_at?: string;
          last_seen_at?: string;
          last_scraped_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          perfume_id?: number;
          retailer_id?: number;
          source_url?: string;
          source_product_id?: string | null;
          source_title?: string;
          source_description?: string | null;
          active?: boolean;
          first_seen_at?: string;
          last_seen_at?: string;
          last_scraped_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "perfume_listings_perfume_id_fkey";
            columns: ["perfume_id"];
            isOneToOne: false;
            referencedRelation: "perfumes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "perfume_listings_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_variants: {
        Row: {
          id: number;
          perfume_listing_id: number;
          size_label: string;
          size_value_ml: number | null;
          current_price: number | null;
          currency: string;
          current_stock_status: StockStatus;
          current_stock_raw: string | null;
          first_seen_at: string;
          last_seen_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          perfume_listing_id: number;
          size_label: string;
          size_value_ml?: number | null;
          current_price?: number | null;
          currency?: string;
          current_stock_status?: StockStatus;
          current_stock_raw?: string | null;
          first_seen_at?: string;
          last_seen_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          perfume_listing_id?: number;
          size_label?: string;
          size_value_ml?: number | null;
          current_price?: number | null;
          currency?: string;
          current_stock_status?: StockStatus;
          current_stock_raw?: string | null;
          first_seen_at?: string;
          last_seen_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listing_variants_perfume_listing_id_fkey";
            columns: ["perfume_listing_id"];
            isOneToOne: false;
            referencedRelation: "perfume_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_price_history: {
        Row: {
          id: number;
          listing_variant_id: number;
          price: number;
          currency: string;
          observed_at: string;
          change_type: PriceChangeType;
        };
        Insert: {
          id?: number;
          listing_variant_id: number;
          price: number;
          currency?: string;
          observed_at?: string;
          change_type: PriceChangeType;
        };
        Update: {
          id?: number;
          listing_variant_id?: number;
          price?: number;
          currency?: string;
          observed_at?: string;
          change_type?: PriceChangeType;
        };
        Relationships: [
          {
            foreignKeyName: "listing_price_history_listing_variant_id_fkey";
            columns: ["listing_variant_id"];
            isOneToOne: false;
            referencedRelation: "listing_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_stock_history: {
        Row: {
          id: number;
          listing_variant_id: number;
          stock_status: StockStatus;
          stock_raw: string | null;
          observed_at: string;
          change_type: StockChangeType;
        };
        Insert: {
          id?: number;
          listing_variant_id: number;
          stock_status: StockStatus;
          stock_raw?: string | null;
          observed_at?: string;
          change_type: StockChangeType;
        };
        Update: {
          id?: number;
          listing_variant_id?: number;
          stock_status?: StockStatus;
          stock_raw?: string | null;
          observed_at?: string;
          change_type?: StockChangeType;
        };
        Relationships: [
          {
            foreignKeyName: "listing_stock_history_listing_variant_id_fkey";
            columns: ["listing_variant_id"];
            isOneToOne: false;
            referencedRelation: "listing_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      notes: {
        Row: {
          id: number;
          name: string;
          slug: string;
          note_family: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          slug: string;
          note_family?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          slug?: string;
          note_family?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      source_notes: {
        Row: {
          id: number;
          retailer_id: number;
          raw_note_name: string;
          normalized_note_id: number | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          retailer_id: number;
          raw_note_name: string;
          normalized_note_id?: number | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          retailer_id?: number;
          raw_note_name?: string;
          normalized_note_id?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "source_notes_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "source_notes_normalized_note_id_fkey";
            columns: ["normalized_note_id"];
            isOneToOne: false;
            referencedRelation: "notes";
            referencedColumns: ["id"];
          },
        ];
      };
      perfume_notes: {
        Row: {
          id: number;
          perfume_id: number;
          note_id: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          perfume_id: number;
          note_id: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          perfume_id?: number;
          note_id?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "perfume_notes_perfume_id_fkey";
            columns: ["perfume_id"];
            isOneToOne: false;
            referencedRelation: "perfumes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "perfume_notes_note_id_fkey";
            columns: ["note_id"];
            isOneToOne: false;
            referencedRelation: "notes";
            referencedColumns: ["id"];
          },
        ];
      };
      perfume_source_notes: {
        Row: {
          id: number;
          perfume_listing_id: number;
          raw_note_text: string;
          normalized_note_id: number | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          perfume_listing_id: number;
          raw_note_text: string;
          normalized_note_id?: number | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          perfume_listing_id?: number;
          raw_note_text?: string;
          normalized_note_id?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "perfume_source_notes_perfume_listing_id_fkey";
            columns: ["perfume_listing_id"];
            isOneToOne: false;
            referencedRelation: "perfume_listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "perfume_source_notes_normalized_note_id_fkey";
            columns: ["normalized_note_id"];
            isOneToOne: false;
            referencedRelation: "notes";
            referencedColumns: ["id"];
          },
        ];
      };
      personal_perfumes: {
        Row: {
          id: number;
          perfume_id: number;
          in_collection: boolean;
          in_wanted: boolean;
          size_owned_text: string | null;
          personal_note: string | null;
          rating: number | null;
          added_to_collection_at: string | null;
          added_to_wanted_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          perfume_id: number;
          in_collection?: boolean;
          in_wanted?: boolean;
          size_owned_text?: string | null;
          personal_note?: string | null;
          rating?: number | null;
          added_to_collection_at?: string | null;
          added_to_wanted_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: number;
          perfume_id?: number;
          in_collection?: boolean;
          in_wanted?: boolean;
          size_owned_text?: string | null;
          personal_note?: string | null;
          rating?: number | null;
          added_to_collection_at?: string | null;
          added_to_wanted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "personal_perfumes_perfume_id_fkey";
            columns: ["perfume_id"];
            isOneToOne: true;
            referencedRelation: "perfumes";
            referencedColumns: ["id"];
          },
        ];
      };
      personal_perfume_notes: {
        Row: {
          id: number;
          personal_perfume_id: number;
          note_id: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          personal_perfume_id: number;
          note_id: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          personal_perfume_id?: number;
          note_id?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "personal_perfume_notes_personal_perfume_id_fkey";
            columns: ["personal_perfume_id"];
            isOneToOne: false;
            referencedRelation: "personal_perfumes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "personal_perfume_notes_note_id_fkey";
            columns: ["note_id"];
            isOneToOne: false;
            referencedRelation: "notes";
            referencedColumns: ["id"];
          },
        ];
      };
      theme_tags: {
        Row: {
          id: number;
          name: string;
          slug: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          slug: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          slug?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      personal_perfume_theme_tags: {
        Row: {
          id: number;
          personal_perfume_id: number;
          theme_tag_id: number;
        };
        Insert: {
          id?: number;
          personal_perfume_id: number;
          theme_tag_id: number;
        };
        Update: {
          id?: number;
          personal_perfume_id?: number;
          theme_tag_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "personal_perfume_theme_tags_personal_perfume_id_fkey";
            columns: ["personal_perfume_id"];
            isOneToOne: false;
            referencedRelation: "personal_perfumes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "personal_perfume_theme_tags_theme_tag_id_fkey";
            columns: ["theme_tag_id"];
            isOneToOne: false;
            referencedRelation: "theme_tags";
            referencedColumns: ["id"];
          },
        ];
      };
      journal_entries: {
        Row: {
          id: number;
          perfume_id: number;
          title: string | null;
          body: string;
          entry_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          perfume_id: number;
          title?: string | null;
          body: string;
          entry_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          perfume_id?: number;
          title?: string | null;
          body?: string;
          entry_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "journal_entries_perfume_id_fkey";
            columns: ["perfume_id"];
            isOneToOne: false;
            referencedRelation: "perfumes";
            referencedColumns: ["id"];
          },
        ];
      };
      scrape_runs: {
        Row: {
          id: number;
          source_name: string;
          run_type: ScrapeRunType;
          status: ScrapeRunStatus;
          started_at: string;
          finished_at: string | null;
          records_seen: number;
          records_created: number;
          records_updated: number;
          error_summary: string | null;
        };
        Insert: {
          id?: number;
          source_name: string;
          run_type: ScrapeRunType;
          status?: ScrapeRunStatus;
          started_at?: string;
          finished_at?: string | null;
          records_seen?: number;
          records_created?: number;
          records_updated?: number;
          error_summary?: string | null;
        };
        Update: {
          id?: number;
          source_name?: string;
          run_type?: ScrapeRunType;
          status?: ScrapeRunStatus;
          started_at?: string;
          finished_at?: string | null;
          records_seen?: number;
          records_created?: number;
          records_updated?: number;
          error_summary?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      stock_status: StockStatus;
      price_change_type: PriceChangeType;
      stock_change_type: StockChangeType;
      scrape_run_type: ScrapeRunType;
      scrape_run_status: ScrapeRunStatus;
    };
    CompositeTypes: Record<never, never>;
  };
};
