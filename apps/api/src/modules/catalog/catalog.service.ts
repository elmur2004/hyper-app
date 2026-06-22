import { Injectable } from '@nestjs/common';
import type { CustomerCatalogRow } from '@hyper/shared';
import { PrismaService } from '../../prisma/prisma.service';

interface CatalogViewRow {
  product_id: string;
  branch_id: string;
  name_ar: string;
  name_en: string;
  image_urls: string[];
  unit: string;
  price: number;
  in_stock: boolean;
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** The ONLY catalog read for the customer app — the derived customer_catalog view. */
  async forBranch(branchId: string): Promise<CustomerCatalogRow[]> {
    const rows = await this.prisma.$queryRaw<CatalogViewRow[]>`
      SELECT product_id, branch_id, name_ar, name_en, image_urls, unit, price, in_stock
        FROM customer_catalog
       WHERE branch_id = ${branchId}
       ORDER BY name_ar`;
    return rows.map((r) => ({
      productId: r.product_id as CustomerCatalogRow['productId'],
      branchId: r.branch_id as CustomerCatalogRow['branchId'],
      nameAr: r.name_ar,
      nameEn: r.name_en,
      imageUrls: r.image_urls ?? [],
      unit: r.unit,
      price: Number(r.price),
      inStock: r.in_stock,
    }));
  }

  /** Server-authoritative resolved price for a (branch, product) — used at checkout. */
  async resolvePrice(branchId: string, productId: string): Promise<number | null> {
    const rows = await this.prisma.$queryRaw<{ price: number }[]>`
      SELECT price FROM customer_catalog WHERE branch_id = ${branchId} AND product_id = ${productId} LIMIT 1`;
    return rows[0] ? Number(rows[0].price) : null;
  }
}
