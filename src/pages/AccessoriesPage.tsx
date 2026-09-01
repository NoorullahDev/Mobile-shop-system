import { Headphones } from "lucide-react";
import { InventoryProductPage } from "./InventoryProductPage";
import { AccessoryForm } from "./AccessoryForm";
import { useInventoryStore } from "../store/inventory";
import type { Accessory } from "../types/inventory";

const rowTitle = (item: Accessory) => `${item.brand} ${item.product_name}`;

function accessorySubtitle(item: Accessory) {
  const parts: string[] = [];
  if (item.accessory_type) parts.push(item.accessory_type);
  if (item.compatible_models) parts.push(`for ${item.compatible_models}`);
  if (item.color) parts.push(item.color);
  return parts.join(" · ") || "—";
}

export function AccessoriesPage() {
  const { accessories, loading, error, loadAccessories, addAccessory, updateAccessory, removeAccessory, restockAccessory } =
    useInventoryStore();
  return (
    <InventoryProductPage
      rows={accessories}
      loading={loading}
      error={error}
      onLoad={() => loadAccessories()}
      rowTitle={rowTitle}
      rowSubtitle={accessorySubtitle}
      add={addAccessory}
      update={updateAccessory}
      remove={removeAccessory}
      restock={restockAccessory}
      FormComponent={AccessoryForm}
      typeName="Accessories"
      itemName="accessory"
      description="Manage your mobile accessories, from chargers to covers"
      addLabel="Add Accessory"
      icon={Headphones}
    />
  );
}