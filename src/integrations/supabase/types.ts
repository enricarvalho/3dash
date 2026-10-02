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
  public: {
    Tables: {
      asset_events: {
        Row: {
          asset_id: string
          cost: number
          created_at: string
          description: string
          event_date: string
          id: string
          kind: string
          location: string | null
          notes: string | null
          owner_id: string
          quantity_delta: number
          updated_at: string
        }
        Insert: {
          asset_id: string
          cost?: number
          created_at?: string
          description: string
          event_date?: string
          id?: string
          kind?: string
          location?: string | null
          notes?: string | null
          owner_id?: string
          quantity_delta?: number
          updated_at?: string
        }
        Update: {
          asset_id?: string
          cost?: number
          created_at?: string
          description?: string
          event_date?: string
          id?: string
          kind?: string
          location?: string | null
          notes?: string | null
          owner_id?: string
          quantity_delta?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_events_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          acquisition_date: string | null
          category: string
          condition: string
          created_at: string
          id: string
          image_url: string | null
          location: string | null
          material_id: string | null
          name: string
          notes: string | null
          origin_printer_id: string | null
          owner_id: string
          part_id: string | null
          printer_id: string | null
          quantity: number
          serial_number: string | null
          unit_value: number
          updated_at: string
        }
        Insert: {
          acquisition_date?: string | null
          category?: string
          condition?: string
          created_at?: string
          id?: string
          image_url?: string | null
          location?: string | null
          material_id?: string | null
          name: string
          notes?: string | null
          origin_printer_id?: string | null
          owner_id?: string
          part_id?: string | null
          printer_id?: string | null
          quantity?: number
          serial_number?: string | null
          unit_value?: number
          updated_at?: string
        }
        Update: {
          acquisition_date?: string | null
          category?: string
          condition?: string
          created_at?: string
          id?: string
          image_url?: string | null
          location?: string | null
          material_id?: string | null
          name?: string
          notes?: string | null
          origin_printer_id?: string | null
          owner_id?: string
          part_id?: string | null
          printer_id?: string | null
          quantity?: number
          serial_number?: string | null
          unit_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_closings: {
        Row: {
          closed_at: string
          closed_by: string | null
          company_out: number
          counted: Json
          created_at: string
          difference: number
          difference_reason: string | null
          distributable: number
          expected: Json
          id: string
          inflows: Json
          loss_carry: number
          month: string
          notes: string | null
          opening: Json
          outflows: Json
          owner_id: string
          partner_shares: Json
          previous_loss: number
          reopen_history: Json
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          reserve_amount: number
          reserve_balance: number
          reserve_spent: number
          result: number
          status: string
          total_in: number
          updated_at: string
        }
        Insert: {
          closed_at?: string
          closed_by?: string | null
          company_out?: number
          counted?: Json
          created_at?: string
          difference?: number
          difference_reason?: string | null
          distributable?: number
          expected?: Json
          id?: string
          inflows?: Json
          loss_carry?: number
          month: string
          notes?: string | null
          opening?: Json
          outflows?: Json
          owner_id?: string
          partner_shares?: Json
          previous_loss?: number
          reopen_history?: Json
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          reserve_amount?: number
          reserve_balance?: number
          reserve_spent?: number
          result?: number
          status?: string
          total_in?: number
          updated_at?: string
        }
        Update: {
          closed_at?: string
          closed_by?: string | null
          company_out?: number
          counted?: Json
          created_at?: string
          difference?: number
          difference_reason?: string | null
          distributable?: number
          expected?: Json
          id?: string
          inflows?: Json
          loss_carry?: number
          month?: string
          notes?: string | null
          opening?: Json
          outflows?: Json
          owner_id?: string
          partner_shares?: Json
          previous_loss?: number
          reopen_history?: Json
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          reserve_amount?: number
          reserve_balance?: number
          reserve_spent?: number
          result?: number
          status?: string
          total_in?: number
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          city: string | null
          complement: string | null
          created_at: string
          district: string | null
          doc_number: string | null
          email: string | null
          id: string
          kind: string
          legal_name: string | null
          name: string
          notes: string | null
          number: string | null
          owner_id: string
          phone: string | null
          state: string | null
          status: string
          street: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          city?: string | null
          complement?: string | null
          created_at?: string
          district?: string | null
          doc_number?: string | null
          email?: string | null
          id?: string
          kind?: string
          legal_name?: string | null
          name: string
          notes?: string | null
          number?: string | null
          owner_id?: string
          phone?: string | null
          state?: string | null
          status?: string
          street?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          city?: string | null
          complement?: string | null
          created_at?: string
          district?: string | null
          doc_number?: string | null
          email?: string | null
          id?: string
          kind?: string
          legal_name?: string | null
          name?: string
          notes?: string | null
          number?: string | null
          owner_id?: string
          phone?: string | null
          state?: string | null
          status?: string
          street?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      materials: {
        Row: {
          category: string
          color: string | null
          cost_per_unit: number
          created_at: string
          id: string
          image_url: string | null
          min_quantity: number
          name: string
          owner_id: string
          quantity: number
          supplier: string | null
          type: string
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string
          color?: string | null
          cost_per_unit?: number
          created_at?: string
          id?: string
          image_url?: string | null
          min_quantity?: number
          name: string
          owner_id?: string
          quantity?: number
          supplier?: string | null
          type?: string
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          color?: string | null
          cost_per_unit?: number
          created_at?: string
          id?: string
          image_url?: string | null
          min_quantity?: number
          name?: string
          owner_id?: string
          quantity?: number
          supplier?: string | null
          type?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      part_materials: {
        Row: {
          created_at: string
          grams: number
          id: string
          material_id: string | null
          owner_id: string
          part_id: string
          position: number
          units: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          grams?: number
          id?: string
          material_id?: string | null
          owner_id?: string
          part_id: string
          position?: number
          units?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          grams?: number
          id?: string
          material_id?: string | null
          owner_id?: string
          part_id?: string
          position?: number
          units?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "part_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_materials_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      part_services: {
        Row: {
          created_at: string
          description: string
          id: string
          owner_id: string
          part_id: string
          position: number
          quantity: number
          unit_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          owner_id?: string
          part_id: string
          position?: number
          quantity?: number
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          owner_id?: string
          part_id?: string
          position?: number
          quantity?: number
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "part_services_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_withdrawals: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          kind: string
          material_id: string | null
          notes: string | null
          owner_id: string
          part_id: string | null
          partner_id: string
          payment_method: string | null
          quantity: number
          suggested_amount: number
          transaction_id: string | null
          withdrawn_on: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          kind: string
          material_id?: string | null
          notes?: string | null
          owner_id?: string
          part_id?: string | null
          partner_id: string
          payment_method?: string | null
          quantity?: number
          suggested_amount?: number
          transaction_id?: string | null
          withdrawn_on?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          kind?: string
          material_id?: string | null
          notes?: string | null
          owner_id?: string
          part_id?: string | null
          partner_id?: string
          payment_method?: string | null
          quantity?: number
          suggested_amount?: number
          transaction_id?: string | null
          withdrawn_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_withdrawals_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_withdrawals_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_withdrawals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_withdrawals_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          owner_id: string
          share_pct: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          owner_id?: string
          share_pct?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          share_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      parts: {
        Row: {
          category: string
          created_at: string
          energy_price_kwh: number
          estimated_cost: number
          id: string
          image_url: string | null
          image_urls: string[]
          material_grams: number
          material_id: string | null
          name: string
          notes: string | null
          owner_id: string
          print_minutes: number
          printer_id: string | null
          printer_watts: number
          sale_price: number
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          energy_price_kwh?: number
          estimated_cost?: number
          id?: string
          image_url?: string | null
          image_urls?: string[]
          material_grams?: number
          material_id?: string | null
          name: string
          notes?: string | null
          owner_id?: string
          print_minutes?: number
          printer_id?: string | null
          printer_watts?: number
          sale_price?: number
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          energy_price_kwh?: number
          estimated_cost?: number
          id?: string
          image_url?: string | null
          image_urls?: string[]
          material_grams?: number
          material_id?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          print_minutes?: number
          printer_id?: string | null
          printer_watts?: number
          sale_price?: number
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
        ]
      }
      printer_cost_history: {
        Row: {
          created_at: string
          custo_hora_manutencao: number
          custo_hora_maquina: number
          custo_hora_total: number
          id: string
          motivo: string | null
          owner_id: string
          printer_id: string
        }
        Insert: {
          created_at?: string
          custo_hora_manutencao?: number
          custo_hora_maquina?: number
          custo_hora_total?: number
          id?: string
          motivo?: string | null
          owner_id?: string
          printer_id: string
        }
        Update: {
          created_at?: string
          custo_hora_manutencao?: number
          custo_hora_maquina?: number
          custo_hora_total?: number
          id?: string
          motivo?: string | null
          owner_id?: string
          printer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "printer_cost_history_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
        ]
      }
      printer_maintenances: {
        Row: {
          created_at: string
          custo_estimado: number
          data_ultima: string | null
          descricao: string
          horas_desde_ultima: number
          id: string
          owner_id: string
          periodicidade_horas: number | null
          printer_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custo_estimado?: number
          data_ultima?: string | null
          descricao: string
          horas_desde_ultima?: number
          id?: string
          owner_id?: string
          periodicidade_horas?: number | null
          printer_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custo_estimado?: number
          data_ultima?: string | null
          descricao?: string
          horas_desde_ultima?: number
          id?: string
          owner_id?: string
          periodicidade_horas?: number | null
          printer_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "printer_maintenances_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
        ]
      }
      printers: {
        Row: {
          cenario: string
          created_at: string
          custo_hora_maquina: number | null
          data_aquisicao: string | null
          horas_acumuladas: number
          id: string
          marca: string | null
          modelo: string | null
          nome: string
          observacoes: string | null
          owner_id: string
          potencia_watts: number | null
          status: string
          updated_at: string
          valor_compra: number
          vida_util_horas: number
        }
        Insert: {
          cenario?: string
          created_at?: string
          custo_hora_maquina?: number | null
          data_aquisicao?: string | null
          horas_acumuladas?: number
          id?: string
          marca?: string | null
          modelo?: string | null
          nome: string
          observacoes?: string | null
          owner_id?: string
          potencia_watts?: number | null
          status?: string
          updated_at?: string
          valor_compra?: number
          vida_util_horas?: number
        }
        Update: {
          cenario?: string
          created_at?: string
          custo_hora_maquina?: number | null
          data_aquisicao?: string | null
          horas_acumuladas?: number
          id?: string
          marca?: string | null
          modelo?: string | null
          nome?: string
          observacoes?: string | null
          owner_id?: string
          potencia_watts?: number | null
          status?: string
          updated_at?: string
          valor_compra?: number
          vida_util_horas?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company: string | null
          contact_address: string | null
          contact_email: string | null
          contact_instagram: string | null
          contact_phone: string | null
          contact_website: string | null
          created_at: string
          default_energy_price_kwh: number
          default_printer_watts: number
          full_name: string | null
          id: string
          min_margin_pct: number
          pdf_footer_text: string | null
          price_multiplier: number
          updated_at: string
        }
        Insert: {
          company?: string | null
          contact_address?: string | null
          contact_email?: string | null
          contact_instagram?: string | null
          contact_phone?: string | null
          contact_website?: string | null
          created_at?: string
          default_energy_price_kwh?: number
          default_printer_watts?: number
          full_name?: string | null
          id: string
          min_margin_pct?: number
          pdf_footer_text?: string | null
          price_multiplier?: number
          updated_at?: string
        }
        Update: {
          company?: string | null
          contact_address?: string | null
          contact_email?: string | null
          contact_instagram?: string | null
          contact_phone?: string | null
          contact_website?: string | null
          created_at?: string
          default_energy_price_kwh?: number
          default_printer_watts?: number
          full_name?: string | null
          id?: string
          min_margin_pct?: number
          pdf_footer_text?: string | null
          price_multiplier?: number
          updated_at?: string
        }
        Relationships: []
      }
      quote_audit_log: {
        Row: {
          action: string
          changed_by: string
          changes: Json
          created_at: string
          id: string
          owner_id: string
          quote_id: string
        }
        Insert: {
          action?: string
          changed_by?: string
          changes?: Json
          created_at?: string
          id?: string
          owner_id?: string
          quote_id: string
        }
        Update: {
          action?: string
          changed_by?: string
          changes?: Json
          created_at?: string
          id?: string
          owner_id?: string
          quote_id?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          created_at: string
          description: string
          id: string
          image_url: string | null
          kind: string
          material_id: string | null
          owner_id: string
          part_id: string | null
          print_minutes: number
          quantity: number
          quote_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          image_url?: string | null
          kind?: string
          material_id?: string | null
          owner_id?: string
          part_id?: string | null
          print_minutes?: number
          quantity?: number
          quote_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          kind?: string
          material_id?: string | null
          owner_id?: string
          part_id?: string | null
          print_minutes?: number
          quantity?: number
          quote_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_status_history: {
        Row: {
          changed_by: string
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          owner_id: string
          quote_id: string
          to_status: string
        }
        Insert: {
          changed_by?: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          owner_id?: string
          quote_id: string
          to_status: string
        }
        Update: {
          changed_by?: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          owner_id?: string
          quote_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_status_history_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          notes: string | null
          owner_id: string
          status: string
          title: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          status?: string
          title?: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          status?: string
          title?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_audit_log: {
        Row: {
          action: string
          changed_by: string
          changes: Json
          created_at: string
          id: string
          owner_id: string
          sale_id: string
          sale_label: string | null
        }
        Insert: {
          action?: string
          changed_by?: string
          changes?: Json
          created_at?: string
          id?: string
          owner_id?: string
          sale_id: string
          sale_label?: string | null
        }
        Update: {
          action?: string
          changed_by?: string
          changes?: Json
          created_at?: string
          id?: string
          owner_id?: string
          sale_id?: string
          sale_label?: string | null
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          created_at: string
          description: string
          id: string
          image_url: string | null
          material_id: string | null
          owner_id: string
          part_id: string | null
          quantity: number
          sale_id: string
          unit_cost: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          image_url?: string | null
          material_id?: string | null
          owner_id?: string
          part_id?: string | null
          quantity?: number
          sale_id: string
          unit_cost?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          material_id?: string | null
          owner_id?: string
          part_id?: string | null
          quantity?: number
          sale_id?: string
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cost_total: number
          created_at: string
          customer_id: string | null
          discount: number
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          notes: string | null
          owner_id: string
          payment_method: string | null
          quote_id: string | null
          sale_date: string
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          cost_total?: number
          created_at?: string
          customer_id?: string | null
          discount?: number
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          payment_method?: string | null
          quote_id?: string | null
          sale_date?: string
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          cost_total?: number
          created_at?: string
          customer_id?: string | null
          discount?: number
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          payment_method?: string | null
          quote_id?: string | null
          sale_date?: string
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          kind: string
          name: string
          owner_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          name: string
          owner_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          name?: string
          owner_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          material_id: string
          note: string | null
          owner_id: string
          quantity: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          note?: string | null
          owner_id?: string
          quantity: number
          reason?: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          note?: string | null
          owner_id?: string
          quantity?: number
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          cash_closing_id: string | null
          category: string
          created_at: string
          customer_id: string | null
          description: string
          id: string
          kind: string
          occurred_on: string
          owner_id: string
          paid_from_reserve: boolean
          payment_method: string | null
          quote_id: string | null
          sale_id: string | null
        }
        Insert: {
          amount?: number
          cash_closing_id?: string | null
          category?: string
          created_at?: string
          customer_id?: string | null
          description: string
          id?: string
          kind?: string
          occurred_on?: string
          owner_id?: string
          paid_from_reserve?: boolean
          payment_method?: string | null
          quote_id?: string | null
          sale_id?: string | null
        }
        Update: {
          amount?: number
          cash_closing_id?: string | null
          category?: string
          created_at?: string
          customer_id?: string | null
          description?: string
          id?: string
          kind?: string
          occurred_on?: string
          owner_id?: string
          paid_from_reserve?: boolean
          payment_method?: string | null
          quote_id?: string | null
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_cash_closing_id_fkey"
            columns: ["cash_closing_id"]
            isOneToOne: false
            referencedRelation: "cash_closings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      log_printer_cost: {
        Args: { _motivo: string; _printer_id: string }
        Returns: undefined
      }
      month_is_closed: { Args: { _d: string }; Returns: boolean }
      raise_closed_month: { Args: { _d: string }; Returns: undefined }
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
  public: {
    Enums: {},
  },
} as const
