-- ══════════════════════════════════════════════════════════════
-- Synchronize standard specialist booking extras in settings table
-- ══════════════════════════════════════════════════════════════

INSERT INTO public.settings (key, value, updated_at)
VALUES (
  'booking_extras',
  '[
    {"id":"oven","label":"Inside Oven & Grill","icon":"🍳","duration":0.75,"desc":"Deep degreasing & rack soaking"},
    {"id":"fridge","label":"Inside Fridge / Freezer","icon":"❄️","duration":0.5,"desc":"Shelves washed & sanitized"},
    {"id":"windows","label":"Interior Window Glass","icon":"🪟","duration":0.5,"desc":"Internal panes & sills buffed"},
    {"id":"ironing","label":"Ironing & Laundry","icon":"🧺","duration":1.0,"desc":"Shirts, linens & folding"},
    {"id":"cupboards","label":"Inside Kitchen Cabinets","icon":"📦","duration":0.75,"desc":"Shelves wiped & sanitized"},
    {"id":"bed_linen","label":"Bed Linen Change","icon":"🛏️","duration":0.5,"desc":"Fresh bedsheets changed & made up"}
  ]',
  NOW()
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = NOW();
