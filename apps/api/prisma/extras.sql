-- Extras Prisma's schema DSL cannot express (applied after init.sql).
-- Stock invariants enforced by the DB itself (the last line of defence vs overselling).
ALTER TABLE "inventory"
  ADD CONSTRAINT "inventory_qty_available_nonneg" CHECK ("qty_available" >= 0);
ALTER TABLE "inventory"
  ADD CONSTRAINT "inventory_qty_reserved_nonneg" CHECK ("qty_reserved" >= 0);
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_money_nonneg"
  CHECK ("subtotal" >= 0 AND "delivery_fee" >= 0 AND "discount" >= 0 AND "total" >= 0);

-- The ONE read surface the customer app consumes (Plan §4): a product is visible for a
-- branch iff master-active AND listed-for-branch AND in stock AND a price resolves.
-- Branch-specific price wins over base (branch_id IS NULL). Operator/HQ-only columns
-- (cost, qty_reserved, internal flags) are intentionally NOT exposed.
CREATE OR REPLACE VIEW "customer_catalog" AS
SELECT
  p.id                       AS product_id,
  bp.branch_id               AS branch_id,
  p.name_ar,
  p.name_en,
  p.image_urls,
  p.unit,
  rp.price                   AS price,
  (i.qty_available > 0)      AS in_stock
FROM "products" p
JOIN "branch_products" bp ON bp.product_id = p.id
JOIN "inventory" i        ON i.product_id = p.id AND i.branch_id = bp.branch_id
JOIN LATERAL (
  SELECT pr.price
    FROM "prices" pr
   WHERE pr.product_id = p.id
     AND (pr.branch_id = bp.branch_id OR pr.branch_id IS NULL)
     AND (pr.starts_at IS NULL OR pr.starts_at <= now())
     AND (pr.ends_at   IS NULL OR pr.ends_at   >= now())
   ORDER BY (pr.branch_id = bp.branch_id) DESC NULLS LAST, pr.starts_at DESC NULLS LAST
   LIMIT 1
) rp ON true
WHERE p.is_active = true
  AND bp.is_listed = true
  AND i.qty_available > 0;
