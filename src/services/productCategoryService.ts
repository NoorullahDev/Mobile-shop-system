import { invoke } from "@tauri-apps/api/core";
import type { CreateProductCategoryInput, ProductCategory } from "../types/inventory";

export async function createProductCategory(
  input: CreateProductCategoryInput,
  actor?: number | null,
): Promise<ProductCategory> {
  return invoke<ProductCategory>("create_product_category", {
    input,
    actor: actor ?? null,
  });
}

export async function listProductCategories(): Promise<ProductCategory[]> {
  return invoke<ProductCategory[]>("list_product_categories");
}

export async function updateProductCategory(
  id: number,
  input: CreateProductCategoryInput,
  actor?: number | null,
): Promise<ProductCategory> {
  return invoke<ProductCategory>("update_product_category", {
    id,
    input,
    actor: actor ?? null,
  });
}

export async function deleteProductCategory(
  id: number,
  actor?: number | null,
): Promise<void> {
  return invoke<void>("delete_product_category", { id, actor: actor ?? null });
}