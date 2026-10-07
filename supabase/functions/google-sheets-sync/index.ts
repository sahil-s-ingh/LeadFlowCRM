import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface ColumnMapping {
  full_name?: string;
  mobile_number?: string;
  email?: string;
  state?: string;
  trading_product?: string;
  fund_amount?: string;
  notes?: string;
}

interface SheetSettings {
  id: string;
  user_id: string;
  sheet_url: string;
  sheet_name: string | null;
  column_mapping: ColumnMapping;
  trading_product_default: string;
  source_tag: string;
  is_active: boolean;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        current.push(field);
        field = "";
      } else if (char === "\n" || char === "\r") {
        if (char === "\r" && text[i + 1] === "\n") i++;
        current.push(field);
        rows.push(current);
        current = [];
        field = "";
      } else {
        field += char;
      }
    }
  }
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

async function syncSheet(settings: SheetSettings): Promise<{
  total: number;
  imported: number;
  duplicates: number;
  failed: number;
}> {
  const response = await fetch(settings.sheet_url, {
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch sheet: HTTP ${response.status}`);
  }
  const csvText = await response.text();
  const rows = parseCSV(csvText);
  if (rows.length < 2) {
    return { total: 0, imported: 0, duplicates: 0, failed: 0 };
  }

  const headers = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1);
  const mapping = settings.column_mapping || {};

  const findColumnIndex = (mappedName?: string): number => {
    if (!mappedName) return -1;
    const idx = headers.findIndex(
      (h) => h.toLowerCase() === mappedName.toLowerCase(),
    );
    return idx;
  };

  const colIdx: Record<string, number> = {
    full_name: findColumnIndex(mapping.full_name),
    mobile_number: findColumnIndex(mapping.mobile_number),
    email: findColumnIndex(mapping.email),
    state: findColumnIndex(mapping.state),
    trading_product: findColumnIndex(mapping.trading_product),
    fund_amount: findColumnIndex(mapping.fund_amount),
    notes: findColumnIndex(mapping.notes),
  };

  let imported = 0;
  let duplicates = 0;
  let failed = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const get = (key: string): string => {
      const idx = colIdx[key];
      return idx >= 0 && idx < row.length ? row[idx].trim() : "";
    };

    const fullName = get("full_name");
    const mobile = get("mobile_number");
    const email = get("email");
    const state = get("state") || "N/A";
    const tradingProductRaw = get("trading_product");
    const fundAmountRaw = get("fund_amount");
    const notes = get("notes");

    const rowData: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (idx < row.length) rowData[h] = row[idx];
    });

    if (!fullName && !mobile && !email) {
      failed++;
      await supabase.from("google_sheets_sync_log").insert({
        settings_id: settings.id,
        user_id: settings.user_id,
        row_data: rowData,
        status: "failed",
        error_message: "No identifiable fields (name, phone, or email)",
        row_number: i + 2,
      });
      continue;
    }

    let duplicateLeadId: string | null = null;
    if (email) {
      const { data: existing } = await supabase
        .from("submissions")
        .select("id")
        .ilike("email", email)
        .is("deleted_at", null)
        .maybeSingle();
      if (existing) duplicateLeadId = (existing as { id: string }).id;
    }
    if (!duplicateLeadId && mobile) {
      const { data: existing } = await supabase
        .from("submissions")
        .select("id")
        .eq("mobile_number", mobile)
        .is("deleted_at", null)
        .maybeSingle();
      if (existing) duplicateLeadId = (existing as { id: string }).id;
    }

    if (duplicateLeadId) {
      duplicates++;
      await supabase.from("google_sheets_sync_log").insert({
        settings_id: settings.id,
        user_id: settings.user_id,
        row_data: rowData,
        lead_id: duplicateLeadId,
        status: "duplicate",
        error_message: "Lead already exists with matching email or phone",
        row_number: i + 2,
      });
      continue;
    }

    const tradingProduct = tradingProductRaw === "tradingview_premium"
      ? "tradingview_premium"
      : (tradingProductRaw === "algo" ? "algo" : settings.trading_product_default);

    const fundAmount = fundAmountRaw
      ? parseFloat(fundAmountRaw.replace(/[^0-9.]/g, "")) || null
      : null;

    const tags = [settings.source_tag].filter(Boolean);

    const { data: newLead, error: insertError } = await supabase
      .from("submissions")
      .insert({
        full_name: fullName || "Unknown",
        mobile_number: mobile || "N/A",
        email: email || "N/A",
        state,
        trading_product: tradingProduct,
        status: "new",
        tags,
        notes,
        fund_amount: fundAmount,
      })
      .select("id")
      .single();

    if (insertError || !newLead) {
      failed++;
      await supabase.from("google_sheets_sync_log").insert({
        settings_id: settings.id,
        user_id: settings.user_id,
        row_data: rowData,
        status: "failed",
        error_message: insertError?.message || "Insert failed",
        row_number: i + 2,
      });
      continue;
    }

    imported++;
    await supabase.from("google_sheets_sync_log").insert({
      settings_id: settings.id,
      user_id: settings.user_id,
      row_data: rowData,
      lead_id: (newLead as { id: string }).id,
      status: "success",
      row_number: i + 2,
    });
  }

  await supabase
    .from("google_sheets_settings")
    .update({
      last_synced_at: new Date().toISOString(),
      last_row_count: dataRows.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", settings.id);

  return {
    total: dataRows.length,
    imported,
    duplicates,
    failed,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    let settingsId: string | null = null;
    let targetUserId: string | null = null;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      settingsId = body.settings_id || null;
      targetUserId = body.user_id || null;
    }

    let query = supabase
      .from("google_sheets_settings")
      .select("*")
      .eq("is_active", true);

    if (settingsId) {
      query = query.eq("id", settingsId);
    }

    const { data: settingsList, error: fetchError } = await query;

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch settings", details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!settingsList || settingsList.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active Google Sheets to sync", results: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: Array<{
      settings_id: string;
      sheet_name: string;
      success: boolean;
      summary?: { total: number; imported: number; duplicates: number; failed: number };
      error?: string;
    }> = [];

    for (const settings of settingsList as SheetSettings[]) {
      if (targetUserId && settings.user_id !== targetUserId) continue;
      try {
        const summary = await syncSheet(settings);
        results.push({
          settings_id: settings.id,
          sheet_name: settings.sheet_name || "Untitled",
          success: true,
          summary,
        });
      } catch (err) {
        results.push({
          settings_id: settings.id,
          sheet_name: settings.sheet_name || "Untitled",
          success: false,
          error: String(err?.message || err),
        });
      }
    }

    return new Response(
      JSON.stringify({ message: "Sync complete", results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
