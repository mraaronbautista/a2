export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          archived: boolean
          created_at: string
          created_by: string
          household_id: string
          id: string
          kind: string
          name: string
          owner_id: string | null
          starting_balance: number
          target_amount: number | null
        }
        Insert: {
          archived?: boolean
          created_at?: string
          created_by: string
          household_id: string
          id?: string
          kind: string
          name: string
          owner_id?: string | null
          starting_balance?: number
          target_amount?: number | null
        }
        Update: {
          archived?: boolean
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          kind?: string
          name?: string
          owner_id?: string | null
          starting_balance?: number
          target_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_settings: {
        Row: {
          category_limits: Json
          household_id: string
          updated_at: string
        }
        Insert: {
          category_limits?: Json
          household_id: string
          updated_at?: string
        }
        Update: {
          category_limits?: Json
          household_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_settings_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: true
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_transactions: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          created_at: string
          created_by: string
          description: string | null
          household_id: string
          id: string
          occurred_on: string
          paid_by: string
          split_mode: string
          tags: string[]
          to_account_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          household_id: string
          id?: string
          occurred_on?: string
          paid_by: string
          split_mode?: string
          tags?: string[]
          to_account_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          household_id?: string
          id?: string
          occurred_on?: string
          paid_by?: string
          split_mode?: string
          tags?: string[]
          to_account_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          color: string | null
          course_id: string | null
          created_at: string
          end_at: string | null
          household_id: string
          id: string
          owner_id: string
          recurrence_rule: string | null
          start_at: string
          title: string
          visibility: string
        }
        Insert: {
          color?: string | null
          course_id?: string | null
          created_at?: string
          end_at?: string | null
          household_id: string
          id?: string
          owner_id: string
          recurrence_rule?: string | null
          start_at: string
          title: string
          visibility?: string
        }
        Update: {
          color?: string | null
          course_id?: string | null
          created_at?: string
          end_at?: string | null
          household_id?: string
          id?: string
          owner_id?: string
          recurrence_rule?: string | null
          start_at?: string
          title?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          color: string | null
          created_at: string
          household_id: string
          id: string
          is_shared: boolean
          name: string
          owner_id: string
          professor: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          household_id: string
          id?: string
          is_shared?: boolean
          name: string
          owner_id: string
          professor?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          household_id?: string
          id?: string
          is_shared?: boolean
          name?: string
          owner_id?: string
          professor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      course_syllabi: {
        Row: {
          course_id: string
          created_at: string
          created_by: string
          edited_text: string
          extracted_text: string
          extraction_method: string | null
          extraction_status: string
          household_id: string
          id: string
          mime_type: string | null
          notes: string
          original_name: string
          size_bytes: number
          storage_path: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by: string
          edited_text?: string
          extracted_text?: string
          extraction_method?: string | null
          extraction_status?: string
          household_id: string
          id?: string
          mime_type?: string | null
          notes?: string
          original_name: string
          size_bytes: number
          storage_path: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string
          edited_text?: string
          extracted_text?: string
          extraction_method?: string | null
          extraction_status?: string
          household_id?: string
          id?: string
          mime_type?: string | null
          notes?: string
          original_name?: string
          size_bytes?: number
          storage_path?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_syllabi_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_syllabi_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          completed_at: string | null
          created_at: string
          household_id: string
          id: string
          owner_id: string
          target_date: string | null
          title: string
          visibility: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          household_id: string
          id?: string
          owner_id: string
          target_date?: string | null
          title: string
          visibility?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          household_id?: string
          id?: string
          owner_id?: string
          target_date?: string | null
          title?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          created_at: string
          household_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          archived_at: string | null
          case_brief_dissent: string | null
          case_brief_facts: string | null
          case_brief_holding: string | null
          case_brief_issue: string | null
          case_brief_reasoning: string | null
          content: Json | null
          course_id: string | null
          created_at: string
          household_id: string
          id: string
          last_edited_by: string | null
          owner_id: string
          page_settings: Json | null
          search_text: string
          space: string
          tags: string[]
          title: string
          type: string
          updated_at: string
          visibility: string
        }
        Insert: {
          archived_at?: string | null
          case_brief_dissent?: string | null
          case_brief_facts?: string | null
          case_brief_holding?: string | null
          case_brief_issue?: string | null
          case_brief_reasoning?: string | null
          content?: Json | null
          course_id?: string | null
          created_at?: string
          household_id: string
          id?: string
          last_edited_by?: string | null
          owner_id: string
          page_settings?: Json | null
          search_text?: string
          space?: string
          tags?: string[]
          title: string
          type?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          archived_at?: string | null
          case_brief_dissent?: string | null
          case_brief_facts?: string | null
          case_brief_holding?: string | null
          case_brief_issue?: string | null
          case_brief_reasoning?: string | null
          content?: Json | null
          course_id?: string | null
          created_at?: string
          household_id?: string
          id?: string
          last_edited_by?: string | null
          owner_id?: string
          page_settings?: Json | null
          search_text?: string
          space?: string
          tags?: string[]
          title?: string
          type?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      nudges: {
        Row: {
          created_at: string
          from_user_id: string
          household_id: string
          id: string
          item_id: string
          item_type: string
          message: string | null
          push_sent_at: string | null
          status: string
          to_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          household_id: string
          id?: string
          item_id: string
          item_type: string
          message?: string | null
          push_sent_at?: string | null
          status?: string
          to_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          household_id?: string
          id?: string
          item_id?: string
          item_type?: string
          message?: string | null
          push_sent_at?: string | null
          status?: string
          to_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nudges_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys: Json
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys?: Json
          user_id?: string
        }
        Relationships: []
      }
      library_entries: {
        Row: { created_at: string; id: string; note_id: string | null; order_index: number; reading_item_id: string | null; section_id: string }
        Insert: { created_at?: string; id?: string; note_id?: string | null; order_index?: number; reading_item_id?: string | null; section_id: string }
        Update: { created_at?: string; id?: string; note_id?: string | null; order_index?: number; reading_item_id?: string | null; section_id?: string }
        Relationships: [
          { foreignKeyName: "library_entries_note_id_fkey"; columns: ["note_id"]; isOneToOne: false; referencedRelation: "notes"; referencedColumns: ["id"] },
          { foreignKeyName: "library_entries_reading_item_id_fkey"; columns: ["reading_item_id"]; isOneToOne: false; referencedRelation: "reading_items"; referencedColumns: ["id"] },
          { foreignKeyName: "library_entries_section_id_fkey"; columns: ["section_id"]; isOneToOne: false; referencedRelation: "notebook_sections"; referencedColumns: ["id"] },
        ]
      }
      note_user_state: {
        Row: { is_favorite: boolean; last_opened_at: string | null; note_id: string; updated_at: string; user_id: string }
        Insert: { is_favorite?: boolean; last_opened_at?: string | null; note_id: string; updated_at?: string; user_id: string }
        Update: { is_favorite?: boolean; last_opened_at?: string | null; note_id?: string; updated_at?: string; user_id?: string }
        Relationships: [{ foreignKeyName: "note_user_state_note_id_fkey"; columns: ["note_id"]; isOneToOne: false; referencedRelation: "notes"; referencedColumns: ["id"] }]
      }
      notebook_sections: {
        Row: { color: string | null; created_at: string; id: string; name: string; notebook_id: string; order_index: number; updated_at: string }
        Insert: { color?: string | null; created_at?: string; id?: string; name: string; notebook_id: string; order_index?: number; updated_at?: string }
        Update: { color?: string | null; created_at?: string; id?: string; name?: string; notebook_id?: string; order_index?: number; updated_at?: string }
        Relationships: [{ foreignKeyName: "notebook_sections_notebook_id_fkey"; columns: ["notebook_id"]; isOneToOne: false; referencedRelation: "notebooks"; referencedColumns: ["id"] }]
      }
      notebook_user_state: {
        Row: { is_favorite: boolean; last_opened_at: string | null; notebook_id: string; updated_at: string; user_id: string }
        Insert: { is_favorite?: boolean; last_opened_at?: string | null; notebook_id: string; updated_at?: string; user_id: string }
        Update: { is_favorite?: boolean; last_opened_at?: string | null; notebook_id?: string; updated_at?: string; user_id?: string }
        Relationships: [{ foreignKeyName: "notebook_user_state_notebook_id_fkey"; columns: ["notebook_id"]; isOneToOne: false; referencedRelation: "notebooks"; referencedColumns: ["id"] }]
      }
      notebooks: {
        Row: { archived_at: string | null; cover: Json; course_id: string | null; created_at: string; description: string; household_id: string; id: string; name: string; order_index: number; owner_id: string; space: string; updated_at: string; visibility: string }
        Insert: { archived_at?: string | null; cover?: Json; course_id?: string | null; created_at?: string; description?: string; household_id: string; id?: string; name: string; order_index?: number; owner_id: string; space: string; updated_at?: string; visibility?: string }
        Update: { archived_at?: string | null; cover?: Json; course_id?: string | null; created_at?: string; description?: string; household_id?: string; id?: string; name?: string; order_index?: number; owner_id?: string; space?: string; updated_at?: string; visibility?: string }
        Relationships: [
          { foreignKeyName: "notebooks_course_id_fkey"; columns: ["course_id"]; isOneToOne: false; referencedRelation: "courses"; referencedColumns: ["id"] },
          { foreignKeyName: "notebooks_household_id_fkey"; columns: ["household_id"]; isOneToOne: false; referencedRelation: "households"; referencedColumns: ["id"] },
        ]
      }
      reading_items: {
        Row: {
          archived_at: string | null
          course_id: string
          created_at: string
          due_date: string | null
          id: string
          mime_type: string | null
          order_index: number
          original_name: string | null
          recurrence_rule: string | null
          size_bytes: number | null
          source_link: string | null
          storage_path: string | null
          title: string
        }
        Insert: {
          archived_at?: string | null
          course_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          mime_type?: string | null
          order_index?: number
          original_name?: string | null
          recurrence_rule?: string | null
          size_bytes?: number | null
          source_link?: string | null
          storage_path?: string | null
          title: string
        }
        Update: {
          archived_at?: string | null
          course_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          mime_type?: string | null
          order_index?: number
          original_name?: string | null
          recurrence_rule?: string | null
          size_bytes?: number | null
          source_link?: string | null
          storage_path?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_items_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_annotations: {
        Row: {
          anchor: Json | null
          body: string
          color: string
          created_at: string
          id: string
          kind: string
          page_number: number
          quoted_text: string | null
          reading_item_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          anchor?: Json | null
          body?: string
          color?: string
          created_at?: string
          id?: string
          kind: string
          page_number: number
          quoted_text?: string | null
          reading_item_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          anchor?: Json | null
          body?: string
          color?: string
          created_at?: string
          id?: string
          kind?: string
          page_number?: number
          quoted_text?: string | null
          reading_item_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_annotations_reading_item_id_fkey"
            columns: ["reading_item_id"]
            isOneToOne: false
            referencedRelation: "reading_items"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_bookmarks: {
        Row: {
          created_at: string
          id: string
          label: string
          page_number: number
          reading_item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          page_number: number
          reading_item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          page_number?: number
          reading_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_bookmarks_reading_item_id_fkey"
            columns: ["reading_item_id"]
            isOneToOne: false
            referencedRelation: "reading_items"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_note_links: {
        Row: {
          annotation_id: string | null
          created_at: string
          created_by: string
          id: string
          note_id: string
          page_number: number
          quoted_text: string | null
          reading_item_id: string
        }
        Insert: {
          annotation_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          note_id: string
          page_number: number
          quoted_text?: string | null
          reading_item_id: string
        }
        Update: {
          annotation_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          note_id?: string
          page_number?: number
          quoted_text?: string | null
          reading_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_note_links_annotation_id_fkey"
            columns: ["annotation_id"]
            isOneToOne: false
            referencedRelation: "reading_annotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_note_links_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_note_links_reading_item_id_fkey"
            columns: ["reading_item_id"]
            isOneToOne: false
            referencedRelation: "reading_items"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_progress: {
        Row: {
          is_favorite: boolean
          last_opened_at: string | null
          page_count: number | null
          page_number: number
          reading_item_id: string
          updated_at: string
          user_id: string
          view_mode: string
          zoom_mode: string
          zoom_value: number
        }
        Insert: {
          is_favorite?: boolean
          last_opened_at?: string | null
          page_count?: number | null
          page_number?: number
          reading_item_id: string
          updated_at?: string
          user_id: string
          view_mode?: string
          zoom_mode?: string
          zoom_value?: number
        }
        Update: {
          is_favorite?: boolean
          last_opened_at?: string | null
          page_count?: number | null
          page_number?: number
          reading_item_id?: string
          updated_at?: string
          user_id?: string
          view_mode?: string
          zoom_mode?: string
          zoom_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "reading_progress_reading_item_id_fkey"
            columns: ["reading_item_id"]
            isOneToOne: false
            referencedRelation: "reading_items"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_status: {
        Row: {
          completed_at: string | null
          prep_status: string
          reading_item_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          prep_status?: string
          reading_item_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          prep_status?: string
          reading_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_status_reading_item_id_fkey"
            columns: ["reading_item_id"]
            isOneToOne: false
            referencedRelation: "reading_items"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_income: {
        Row: {
          account_id: string
          amount: number
          anchor_date: string | null
          archived: boolean
          category: string
          created_at: string
          created_by: string
          day_of_month: number | null
          day_of_week: number | null
          frequency: string
          household_id: string
          id: string
          label: string
          paid_by: string
        }
        Insert: {
          account_id: string
          amount: number
          anchor_date?: string | null
          archived?: boolean
          category: string
          created_at?: string
          created_by: string
          day_of_month?: number | null
          day_of_week?: number | null
          frequency?: string
          household_id: string
          id?: string
          label: string
          paid_by: string
        }
        Update: {
          account_id?: string
          amount?: number
          anchor_date?: string | null
          archived?: boolean
          category?: string
          created_at?: string
          created_by?: string
          day_of_month?: number | null
          day_of_week?: number | null
          frequency?: string
          household_id?: string
          id?: string
          label?: string
          paid_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_income_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_income_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          attachments: Json
          checklist: Json
          comments: Json
          completed_at: string | null
          course_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          end_at: string | null
          household_id: string
          id: string
          owner_id: string
          recurrence_rule: string | null
          reminder_sent_at: string | null
          title: string
          visibility: string
        }
        Insert: {
          attachments?: Json
          checklist?: Json
          comments?: Json
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          end_at?: string | null
          household_id: string
          id?: string
          owner_id: string
          recurrence_rule?: string | null
          reminder_sent_at?: string | null
          title: string
          visibility?: string
        }
        Update: {
          attachments?: Json
          checklist?: Json
          comments?: Json
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          end_at?: string | null
          household_id?: string
          id?: string
          owner_id?: string
          recurrence_rule?: string | null
          reminder_sent_at?: string | null
          title?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      thoughts: {
        Row: {
          archived: boolean
          body: string
          comments: Json
          created_at: string
          household_id: string
          id: string
          owner_id: string
          updated_at: string
          visibility: string
        }
        Insert: {
          archived?: boolean
          body: string
          comments?: Json
          created_at?: string
          household_id: string
          id?: string
          owner_id: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          archived?: boolean
          body?: string
          comments?: Json
          created_at?: string
          household_id?: string
          id?: string
          owner_id?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "thoughts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_thought_comment: {
        Args: { p_body: string; p_thought_id: string }
        Returns: {
          archived: boolean
          body: string
          comments: Json
          created_at: string
          household_id: string
          id: string
          owner_id: string
          updated_at: string
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "thoughts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_access_note: { Args: { p_note_id: string }; Returns: boolean }
      can_access_notebook: { Args: { p_notebook_id: string }; Returns: boolean }
      can_access_reading: { Args: { p_reading_item_id: string }; Returns: boolean }
      can_access_section: { Args: { p_section_id: string }; Returns: boolean }
      can_manage_course: { Args: { p_course_id: string }; Returns: boolean }
      can_manage_notebook: { Args: { p_notebook_id: string }; Returns: boolean }
      can_manage_section: { Args: { p_section_id: string }; Returns: boolean }
      create_notebook_with_section: { Args: { p_course_id: string | null; p_cover: Json; p_description: string; p_household_id: string; p_name: string; p_space: string; p_visibility: string }; Returns: string }
      create_reading_linked_note: {
        Args: {
          p_annotation_id: string | null
          p_content: Json
          p_page_number: number
          p_quoted_text: string | null
          p_reading_item_id: string
          p_title: string
          p_visibility: string
        }
        Returns: string
      }
      delete_notebook_unfile: { Args: { target_notebook_id: string }; Returns: undefined }
      delete_section_unfile: { Args: { target_section_id: string }; Returns: undefined }
      file_note: { Args: { target_note_id: string; target_section_id: string }; Returns: string }
      file_reading: { Args: { target_reading_id: string; target_section_id: string }; Returns: string }
      is_household_member: {
        Args: { target_household_id: string }
        Returns: boolean
      }
      midpoint_order_index: { Args: { p_after: number | null; p_before: number | null }; Returns: number | null }
      move_library_entry: { Args: { target_entry_id: string; target_section_id: string }; Returns: undefined }
      remove_library_entry: { Args: { target_entry_id: string }; Returns: undefined }
      reorder_library_entry: { Args: { after_id: string | null; before_id: string | null; target_entry_id: string }; Returns: undefined }
      reorder_notebook: { Args: { after_id: string | null; before_id: string | null; target_notebook_id: string }; Returns: undefined }
      reorder_section: { Args: { after_id: string | null; before_id: string | null; target_section_id: string }; Returns: undefined }
      same_household: { Args: { target_user_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
