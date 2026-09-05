import { Smartphone } from "lucide-react";
import { InventoryProductPage } from "./InventoryProductPage";
import { PhoneForm } from "./PhoneForm";
import { useInventoryStore } from "../store/inventory";
import * as inventoryService from "../services/inventoryService";
import type { Phone } from "../types/inventory";

const rowTitle = (item: Phone) => `${item.brand} ${item.model}`;

function phoneSubtitle(item: Phone) {
  const parts: string[] = [];
  if (item.variant) parts.push(item.variant);
  if (item.storage) parts.push(item.storage);
  if (item.ram) parts.push(item.ram);
  if (item.network_type) parts.push(item.network_type);
  if (item.battery_capacity) parts.push(item.battery_capacity);
  if (item.chipset) parts.push(item.chipset);
  if (item.color) parts.push(item.color);
  return parts.join(" · ") || "—";
}

export function InventoryPage() {
  const { phones, loading, error, loadPhones, addPhone, updatePhone, removePhone, restockPhone } =
    useInventoryStore();
  return (
    <InventoryProductPage
      rows={phones}
      loading={loading}
      error={error}
      onLoad={(search) => loadPhones(search)}
      rowTitle={rowTitle}
      rowSubtitle={phoneSubtitle}
      add={addPhone}
      update={updatePhone}
      remove={removePhone}
      restock={restockPhone}
      listImei={(item) => inventoryService.listPhoneImeis(item.id)}
      showImei
      FormComponent={PhoneForm}
      typeName="Mobile Phones"
      itemName="mobile phone"
      description="Manage your smartphone stock, specs and inventory"
      addLabel="Add Mobile Phone"
      icon={Smartphone}
      showImeiCol
      showImeiButton
    />
  );
}
