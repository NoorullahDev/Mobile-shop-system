import { create } from "zustand";
import type {
  Accessory,
  CreateAccessoryInput,
  CreatePhoneInput,
  Phone,
  Product,
} from "../types/inventory";
import * as inventoryService from "../services/inventoryService";

interface InventoryState {
  phones: Phone[];
  accessories: Accessory[];
  products: Product[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  loadPhones: () => Promise<void>;
  loadAccessories: () => Promise<void>;
  addPhone: (input: CreatePhoneInput) => Promise<void>;
  updatePhone: (id: number, input: CreatePhoneInput) => Promise<void>;
  removePhone: (id: number) => Promise<void>;
  restockPhone: (id: number, quantity: number, imeis: string[]) => Promise<void>;
  addAccessory: (input: CreateAccessoryInput) => Promise<void>;
  updateAccessory: (id: number, input: CreateAccessoryInput) => Promise<void>;
  removeAccessory: (id: number) => Promise<void>;
  restockAccessory: (id: number, quantity: number) => Promise<void>;
}

function buildProducts(phones: Phone[], accessories: Accessory[]): Product[] {
  const phoneProducts: Product[] = phones
    .filter((p) => p.quantity > 0)
    .map((p) => ({
      item_type: "phone",
      item_id: p.id,
      brand: p.brand,
      model: p.model,
      display_name: `${p.brand} ${p.model}${p.storage ? ` (${p.storage})` : ""}`,
      sale_price: p.sale_price,
      quantity: p.quantity,
      storage: p.storage ?? null,
      color: p.color ?? null,
    }));
  const accessoryProducts: Product[] = accessories
    .filter((a) => a.quantity > 0)
    .map((a) => ({
      item_type: "accessory",
      item_id: a.id,
      brand: a.brand,
      model: a.product_name,
      display_name: `${a.brand || ""} ${a.product_name}`.trim(),
      sale_price: a.sale_price,
      quantity: a.quantity,
      color: a.color ?? null,
    }));
  return [...phoneProducts, ...accessoryProducts];
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  phones: [],
  accessories: [],
  products: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const [phones, accessories] = await Promise.all([
        inventoryService.listPhones(),
        inventoryService.listAccessories(),
      ]);
      set({ phones, accessories, products: buildProducts(phones, accessories), loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  loadPhones: async () => {
    set({ loading: true, error: null });
    try {
      const phones = await inventoryService.listPhones();
      set((s) => ({
        phones,
        products: buildProducts(phones, s.accessories),
        loading: false,
      }));
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  loadAccessories: async () => {
    set({ loading: true, error: null });
    try {
      const accessories = await inventoryService.listAccessories();
      set((s) => ({
        accessories,
        products: buildProducts(s.phones, accessories),
        loading: false,
      }));
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  addPhone: async (input) => {
    set({ error: null });
    try {
      const created = await inventoryService.createPhone(input);
      const phones = [created, ...get().phones];
      set((s) => ({ phones, products: buildProducts(phones, s.accessories) }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  updatePhone: async (id, input) => {
    set({ error: null });
    try {
      const updated = await inventoryService.updatePhone(id, input);
      const phones = get().phones.map((x) => (x.id === id ? updated : x));
      set((s) => ({ phones, products: buildProducts(phones, s.accessories) }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  removePhone: async (id) => {
    set({ error: null });
    try {
      await inventoryService.deletePhone(id);
      const phones = get().phones.filter((x) => x.id !== id);
      set((s) => ({ phones, products: buildProducts(phones, s.accessories) }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  restockPhone: async (id, quantity, imeis) => {
    set({ error: null });
    try {
      await inventoryService.restockPhone(id, quantity, imeis);
      await get().loadPhones();
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  addAccessory: async (input) => {
    set({ error: null });
    try {
      const created = await inventoryService.createAccessory(input);
      const accessories = [created, ...get().accessories];
      set((s) => ({ accessories, products: buildProducts(s.phones, accessories) }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  updateAccessory: async (id, input) => {
    set({ error: null });
    try {
      const updated = await inventoryService.updateAccessory(id, input);
      const accessories = get().accessories.map((x) => (x.id === id ? updated : x));
      set((s) => ({ accessories, products: buildProducts(s.phones, accessories) }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  removeAccessory: async (id) => {
    set({ error: null });
    try {
      await inventoryService.deleteAccessory(id);
      const accessories = get().accessories.filter((x) => x.id !== id);
      set((s) => ({ accessories, products: buildProducts(s.phones, accessories) }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  restockAccessory: async (id, quantity) => {
    set({ error: null });
    try {
      await inventoryService.restockAccessory(id, quantity);
      await get().loadAccessories();
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },
}));
