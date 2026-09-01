import { useEffect, useMemo, useState } from "react";
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Smartphone,
  Headphones,
  UserPlus,
  CreditCard,
  Banknote,
  Landmark,
  CircleCheck,
  X,
} from "lucide-react";
import { PageContainer } from "../components/PageContainer";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Modal } from "../components/Modal";
import { EmptyState } from "../components/EmptyState";
import { Alert } from "../components/Alert";
import { SaleReceipt } from "./SaleReceipt";
import { useSaleStore } from "../store/sales";
import { useInventoryStore } from "../store/inventory";
import { useMemberStore } from "../store/members";
import { useSessionStore } from "../store/session";
import { formatMoney, formatMoneyCompact, roundMoney } from "../lib/format";
import * as inventoryService from "../services/inventoryService";
import * as memberService from "../services/memberService";
import type { PhoneImei, Product } from "../types/inventory";
import type { CreateMemberInput } from "../types/member";
import type { CreateSaleInput } from "../types/sale";
import { PAYMENT_METHODS } from "../types/sale";

const methodLabels: Record<string, { label: string; icon: typeof Banknote }> = {
  cash: { label: "Cash", icon: Banknote },
  bank_transfer: { label: "Bank Transfer", icon: Landmark },
  card: { label: "Card", icon: CreditCard },
  other: { label: "Other", icon: CircleCheck },
};

interface CartLine {
  key: number;
  item_type: "phone" | "accessory";
  item_id: number;
  quantity: number;
  imei_id: number | null;
  unit_price: number;
}

let lineKey = 0;

export function POSPage() {
  const { add } = useSaleStore();
  const { products, load: loadInventory } = useInventoryStore();
  const { members, load: loadMembers } = useMemberStore();
  const user = useSessionStore((s) => s.user);

  const [search, setSearch] = useState("");
  const [productType, setProductType] = useState<"phone" | "accessory">("phone");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [imeiByItem, setImeiByItem] = useState<Record<number, PhoneImei[]>>({});
  const [memberId, setMemberId] = useState("");
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [discount, setDiscount] = useState("0");
  const [paidAmount, setPaidAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<Awaited<ReturnType<typeof add>>>(null);

  useEffect(() => {
    loadInventory();
    loadMembers();
  }, [loadInventory, loadMembers]);

  const typeProducts = useMemo(
    () => products.filter((p) => p.item_type === productType),
    [products, productType],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return typeProducts;
    return typeProducts.filter((p) =>
      `${p.brand} ${p.model} ${p.color ?? ""} ${p.storage ?? ""} ${p.item_type === "accessory" ? p.model : ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [typeProducts, search]);

  const createCustomer = async (input: CreateMemberInput): Promise<number> => {
    const created = await memberService.createMember(input);
    useMemberStore.getState().load();
    setMemberId(String(created.id));
    setNewCustomerOpen(false);
    return created.id;
  };

  const loadImeis = async (itemId: number) => {
    if (imeiByItem[itemId]) return;
    try {
      const all = await inventoryService.listPhoneImeis(itemId);
      setImeiByItem((prev) => ({
        ...prev,
        [itemId]: all.filter((i) => i.status === "in_stock"),
      }));
    } catch {
      setImeiByItem((prev) => ({ ...prev, [itemId]: [] }));
    }
  };

  const addToCart = (item: Product) => {
    setError(null);
    const existing = cart.find(
      (l) => l.item_type === item.item_type && l.item_id === item.item_id,
    );
    if (existing) {
      if (existing.quantity >= item.quantity) {
        setError(`Only ${item.quantity} in stock.`);
        return;
      }
      setCart((prev) =>
        prev.map((l) =>
          l.key === existing.key ? { ...l, quantity: l.quantity + 1 } : l,
        ),
      );
    } else {
      setCart((prev) => [
        ...prev,
        {
          key: ++lineKey,
          item_type: item.item_type,
          item_id: item.item_id,
          quantity: 1,
          imei_id: null,
          unit_price: item.sale_price,
        },
      ]);
      if (item.item_type === "phone") loadImeis(item.item_id);
    }
  };

  const updateLine = (key: number, patch: Partial<CartLine>) => {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const removeLine = (key: number) => {
    setCart((prev) => prev.filter((l) => l.key !== key));
  };

  const setQty = (key: number, qty: number) => {
    const line = cart.find((l) => l.key === key);
    if (!line) return;
    const product = products.find(
      (p) => p.item_type === line.item_type && p.item_id === line.item_id,
    );
    const max = product ? product.quantity : qty;
    updateLine(key, { quantity: Math.max(1, Math.min(qty, max)) });
  };

  const lineTotal = (l: CartLine) => roundMoney(l.unit_price * l.quantity);
  const itemCount = cart.reduce((s, l) => s + l.quantity, 0);
  const subtotal = cart.reduce((sum, l) => sum + lineTotal(l), 0);
  const discountNum = Math.max(0, roundMoney(Number(discount) || 0));
  const total = Math.max(0, roundMoney(subtotal - discountNum));
  const paidNum = paidAmount === "" ? NaN : Number(paidAmount);
  const change = Number.isFinite(paidNum) && paidNum >= total ? paidNum - total : 0;

  const clearCart = () => {
    setCart([]);
    setMemberId("");
    setPaymentMethod("cash");
    setDiscount("0");
    setPaidAmount("");
    setSearch("");
    setProductType("phone");
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setError("Cart is empty. Add a product to checkout.");
      return;
    }
    const input: CreateSaleInput = {
      member_id: memberId ? Number(memberId) : null,
      discount: discountNum,
      paid_amount: paidAmount === "" ? null : paidNum,
      payment_method: paymentMethod,
      items: cart.map((l) => ({
        item_type: l.item_type,
        item_id: l.item_id,
        quantity: l.quantity,
        imei_id: l.imei_id ?? null,
        unit_price: l.unit_price > 0 ? l.unit_price : null,
      })),
    };
    setSaving(true);
    setError(null);
    try {
      const created = await add(input, user?.id ?? null);
      await loadInventory();
      setJustCreated(created);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer className="flex h-full flex-col">
      {/* POS Header */}
      <div
        className="flex shrink-0 items-center justify-between rounded-t-lg px-4 py-3"
        style={{ background: "#0F1B32", borderBottom: "1px solid #1E2E4F" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            <ShoppingCart className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
          </span>
          <div className="leading-tight">
            <div className="text-[14px] font-bold text-white">New Sale · Point of Sale</div>
            <div className="text-[11px]" style={{ color: "#7E8FAD" }}>
              {itemCount} item{itemCount !== 1 ? "s" : ""} in cart
            </div>
          </div>
        </div>
        <a
          href="#/sales"
          className="rounded px-3 py-2 text-[12px] font-semibold transition-colors hover:bg-white/10"
          style={{ color: "#AEBBD1" }}
        >
          View Sales History →
        </a>
      </div>

      <div className="grid flex-1 grid-cols-5 gap-4 overflow-hidden rounded-b-lg bg-white p-4" style={{ border: "1px solid #E2E8F0" }}>
        {/* LEFT: product grid */}
        <div className="col-span-3 flex min-h-0 flex-col">
          {/* Product type toggle */}
          <div className="mb-3 flex shrink-0 items-center gap-1 rounded-lg p-0.5" style={{ background: "#F1F5F9" }}>
            {(
              [
                { key: "phone", label: "Mobile Phones", icon: Smartphone, count: products.filter((x) => x.item_type === "phone").length },
                { key: "accessory", label: "Accessories", icon: Headphones, count: products.filter((x) => x.item_type === "accessory").length },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => { setProductType(tab.key); setSearch(""); }}
                className="flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-[13px] font-semibold transition-colors"
                style={{
                  background: productType === tab.key ? "#fff" : "transparent",
                  color: productType === tab.key ? "#0F172A" : "#64748B",
                  boxShadow: productType === tab.key ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <tab.icon className="h-4 w-4" style={{ color: productType === tab.key ? "#3B6FD4" : "#94A3B8" }} />
                {tab.label}
                <span
                  className="rounded-full px-1.5 text-[10px] font-bold"
                  style={{
                    background: productType === tab.key ? "#DBEAFE" : "#E2E8F0",
                    color: productType === tab.key ? "#2563EB" : "#64748B",
                  }}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative mb-3 shrink-0">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: "#94A3B8" }}
            />
            <input
              className="h-10 w-full rounded border bg-white pl-10 pr-9 text-[14px] outline-none transition-all placeholder:text-[#94A3B8]"
              style={{ borderColor: "#CBD5E1" }}
              placeholder={
                productType === "phone"
                  ? "Search phones by brand, model, storage or color..."
                  : "Search accessories by brand, type or product..."
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#3B6FD4";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,111,212,0.12)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#CBD5E1";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
                style={{ color: "#94A3B8" }}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="flex-1 overflow-y-auto">
              <EmptyState
                icon={productType === "phone" ? Smartphone : Headphones}
                title={typeProducts.length === 0 ? `No ${productType === "phone" ? "phones" : "accessories"} in stock` : "No matching products"}
                description={
                  typeProducts.length === 0
                    ? productType === "phone"
                      ? "Add or restock mobile phones before taking a sale."
                      : "Add or restock accessories before taking a sale."
                    : "Try a different search term."
                }
              />
            </div>
          ) : (
            <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto pr-1 xl:grid-cols-3" style={{ maxHeight: "100%" }}>
              {filtered.map((p) => {
                const inCart = cart.find(
                  (l) => l.item_type === p.item_type && l.item_id === p.item_id,
                );
                const soldOut = p.quantity === 0 || (inCart ? inCart.quantity >= p.quantity : false);
                const cardIcon = p.item_type === "phone" ? Smartphone : Headphones;
                const CardIcon = cardIcon;
                return (
                  <button
                    key={`${p.item_type}:${p.item_id}`}
                    type="button"
                    onClick={() => addToCart(p)}
                    className="group flex flex-col rounded-lg text-left transition-all"
                    style={{
                      border: `1px solid ${inCart ? "#3B6FD4" : "#E2E8F0"}`,
                      background: inCart ? "#F5F8FF" : "#fff",
                      boxShadow: inCart ? "0 0 0 1px #3B6FD4, 0 4px 12px rgba(59,111,212,0.12)" : "0 1px 2px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div className="flex items-center gap-2.5 px-3 pt-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          background: p.item_type === "phone" ? "#EEF2FF" : "#F0FDF4",
                          color: p.item_type === "phone" ? "#3B6FD4" : "#16A34A",
                        }}
                      >
                        <CardIcon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold" style={{ color: "#0F172A" }}>
                          {p.brand} {p.model}
                        </div>
                        {p.item_type === "phone" ? (
                          <div className="truncate text-[11px]" style={{ color: "#64748B" }}>
                            {[p.storage, p.color].filter(Boolean).join(" · ") || "—"}
                          </div>
                        ) : (
                          <div className="truncate text-[11px]" style={{ color: "#64748B" }}>
                            {[p.model, p.color].filter(Boolean).join(" · ") || "—"}
                          </div>
                        )}
                      </div>
                    </div>

                    {p.item_type === "phone" && p.imei && (
                      <div className="mt-2 px-3">
                        <span
                          className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ background: "#EFF6FF", color: "#1D4ED8" }}
                        >
                          IMEI: {p.imei}
                        </span>
                      </div>
                    )}

                    <div className="mt-2 flex items-end justify-between px-3 pb-3">
                      <div>
                        <div className="text-[15px] font-bold" style={{ color: "#0F172A" }}>
                          {formatMoneyCompact(p.sale_price)}
                        </div>
                        <div className="text-[11px]" style={{ color: inCart ? "#3B6FD4" : "#64748B" }}>
                          {inCart ? `${inCart.quantity} in cart` : `${p.quantity} in stock`}
                        </div>
                      </div>
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-full transition-colors"
                        style={{
                          background: inCart ? "#3B6FD4" : p.item_type === "phone" ? "#EEF2FF" : "#F0FDF4",
                          color: inCart ? "#fff" : p.item_type === "phone" ? "#3B6FD4" : "#16A34A",
                        }}
                      >
                        {inCart ? <CircleCheck className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </span>
                    </div>
                    {soldOut && inCart && (
                      <div
                        className="px-3 py-1.5 text-[10px] font-semibold"
                        style={{ background: "#FEF2F2", color: "#B91C1C" }}
                      >
                        Max stock reached
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: cart + checkout */}
        <div
          className="col-span-2 flex min-h-0 flex-col rounded-lg"
          style={{ border: "1px solid #E2E8F0", background: "#F8FAFC" }}
        >
          <div
            className="shrink-0 px-4 py-3"
            style={{ borderBottom: "1px solid #E2E8F0", background: "#fff" }}
          >
            <div className="text-[13px] font-bold" style={{ color: "#0F172A" }}>
              Current Order
            </div>
          </div>

          {/* Cart lines */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {cart.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <EmptyState
                  icon={ShoppingCart}
                  title="Cart is empty"
                  description="Click a product on the left to add it."
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {cart.map((l) => {
                  const product = products.find(
                    (p) => p.item_type === l.item_type && p.item_id === l.item_id,
                  );
                  const imeis = l.item_type === "phone" ? imeiByItem[l.item_id] ?? [] : [];
                  return (
                    <div
                      key={l.key}
                      className="rounded-md bg-white p-2.5"
                      style={{ border: "1px solid #E2E8F0" }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold" style={{ color: "#0F172A" }}>
                            {product ? `${product.brand} ${product.model}` : "Product"}
                          </div>
                          <div className="text-[11px]" style={{ color: "#94A3B8" }}>
                            {formatMoney(l.unit_price)} each
                          </div>
                        </div>
                        <div className="text-[13px] font-bold" style={{ color: "#0F172A" }}>
                          {formatMoney(lineTotal(l))}
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div
                          className="flex items-center gap-1 rounded border"
                          style={{ borderColor: "#CBD5E1" }}
                        >
                          <button
                            type="button"
                            onClick={() => setQty(l.key, l.quantity - 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-l hover:bg-slate-100"
                            style={{ color: "#475569" }}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={l.quantity}
                            onChange={(e) => setQty(l.key, Number(e.target.value) || 1)}
                            className="h-7 w-10 border-x text-center text-[13px] outline-none"
                            style={{ borderColor: "#CBD5E1" }}
                          />
                          <button
                            type="button"
                            onClick={() => setQty(l.key, l.quantity + 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-r hover:bg-slate-100"
                            style={{ color: "#475569" }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLine(l.key)}
                          className="flex h-7 w-7 items-center justify-center rounded hover:bg-red-50"
                          style={{ color: "#DC2626" }}
                          title="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {imeis.length > 0 && (
                        <Select
                          name={`imei-${l.key}`}
                          className="mt-2"
                          options={[
                            { value: "", label: "No IMEI (count as units)" },
                            ...imeis.map((i) => ({ value: String(i.id), label: i.imei })),
                          ]}
                          value={l.imei_id ? String(l.imei_id) : ""}
                          onChange={(e) =>
                            updateLine(l.key, { imei_id: e.target.value ? Number(e.target.value) : null })
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Totals + checkout */}
          <div className="shrink-0 border-t px-4 py-3" style={{ borderColor: "#E2E8F0", background: "#fff" }}>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Select
                    label="Customer"
                    options={[
                      { value: "", label: "Walk-in Customer" },
                      ...members.map((m) => ({ value: String(m.id), label: m.name })),
                    ]}
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setNewCustomerOpen(true)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded transition-colors hover:bg-blue-50"
                  style={{ color: "#3B6FD4", border: "1px solid #DBEAFE", background: "#F5F8FF" }}
                  title="Create new customer"
                >
                  <UserPlus className="h-4 w-4" />
                </button>
              </div>
              <Select
                label="Payment"
                options={PAYMENT_METHODS.map((m) => ({
                  value: m,
                  label: `${methodLabels[m]?.label ?? m} ${m === "cash" ? "· Rs" : ""}`,
                }))}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <Input
                label="Discount (Rs)"
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
              <Input
                label="Amount Received"
                type="number"
                min={0}
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder="Full payment"
              />
            </div>

            {error && (
              <div className="mb-3">
                <Alert variant="error" message={error} />
              </div>
            )}

            <div className="flex flex-col gap-1.5 py-2" style={{ borderTop: "1px dashed #CBD5E1" }}>
              <div className="flex justify-between text-[13px]" style={{ color: "#475569" }}>
                <span>Subtotal</span>
                <span className="font-medium" style={{ color: "#0F172A" }}>{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[13px]" style={{ color: "#475569" }}>
                <span>Discount</span>
                <span className="font-medium" style={{ color: discountNum > 0 ? "#DC2626" : "#0F172A" }}>
                  −{formatMoney(discountNum)}
                </span>
              </div>
              {paymentMethod !== "cash" && (
                <div className="flex justify-between text-[12px]" style={{ color: "#64748B" }}>
                  <span>{methodLabels[paymentMethod]?.label} payment</span>
                  <span>{formatMoney(Number.isFinite(paidNum) ? Math.min(paidNum, total) : 0)}</span>
                </div>
              )}
              {Number.isFinite(paidNum) && total > 0 && paidNum < total && (
                <div className="flex justify-between text-[12px] font-medium" style={{ color: "#B45309" }}>
                  <span>Balance due (On credit)</span>
                  <span>{formatMoney(total - paidNum)}</span>
                </div>
              )}
              {change > 0 && paymentMethod === "cash" && (
                <div className="flex justify-between text-[12px] font-semibold" style={{ color: "#16A34A" }}>
                  <span>Change to return</span>
                  <span>{formatMoney(change)}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between" style={{ borderTop: "1px solid #E2E8F0", paddingTop: 8 }}>
                <span className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "#0F172A" }}>
                  Total Due
                </span>
                <span className="text-[20px] font-bold" style={{ color: "#15803D" }}>
                  {formatMoney(total)}
                </span>
              </div>
            </div>

            <Button
              variant={paymentMethod === "cash" || Number.isFinite(paidNum) && paidNum >= total ? "success" : "primary"}
              size="lg"
              className="mt-2 w-full"
              loading={saving}
              disabled={cart.length === 0}
              onClick={handleCheckout}
              icon={<CircleCheck className="h-4 w-4" />}
            >
              {paymentMethod === "cash" && Number.isFinite(paidNum) && paidNum >= total
                ? "Complete Sale & Print Receipt"
                : "Complete Sale"}
            </Button>
          </div>
        </div>
      </div>

      {/* New Customer Modal */}
      <Modal
        open={newCustomerOpen}
        title="New Customer"
        subtitle="Add a customer and select them for this sale"
        onClose={() => setNewCustomerOpen(false)}
        size="sm"
      >
        <NewCustomerForm onSave={createCustomer} onCancel={() => setNewCustomerOpen(false)} />
      </Modal>

      {/* Receipt Modal */}
      <Modal
        open={justCreated !== null}
        title="Sale Completed!"
        subtitle="Invoice generated successfully"
        onClose={() => setJustCreated(null)}
        size="lg"
      >
        {justCreated && (
          <SaleReceipt
            sale={justCreated}
            onClose={() => {
              setJustCreated(null);
              clearCart();
            }}
          />
        )}
      </Modal>
    </PageContainer>
  );
}

function NewCustomerForm({
  onSave,
  onCancel,
}: {
  onSave: (input: CreateMemberInput) => Promise<number>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Customer name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
      });
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <Input
        label="Customer Name *"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Alex Thompson"
        autoFocus
      />
      <Input
        label="Phone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="e.g. 0712 345 678"
      />
      <Input
        label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="optional"
      />
      <Input
        label="Address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="optional"
      />
      {error && (
        <div className="rounded-md px-3 py-2 text-[12px] font-medium" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" loading={saving} onClick={handleSubmit} icon={<UserPlus className="h-4 w-4" />}>
          Save Customer
        </Button>
      </div>
    </div>
  );
}
