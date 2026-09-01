import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Search,
  Smartphone,
  Headphones,
  Pencil,
  Trash2,
  PackagePlus,
  ListChecks,
  AlertTriangle,
  Boxes,
  Package,
  Coins,
  Tags,
  X,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { KpiCard } from "../components/KpiCard";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { Spinner } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { RestockForm } from "./RestockForm";
import { ManageProductCategoriesModal } from "./ManageProductCategoriesModal";
import { useSupplierStore } from "../store/suppliers";
import { useProductCategoryStore } from "../store/productCategories";
import { useSessionStore } from "../store/session";
import { formatMoneyCompact } from "../lib/format";
import type { PhoneImei, ProductCategory, Supplier } from "../types/inventory";

function formatPKR(n: number) {
  return `Rs. ${n.toLocaleString("en-PK")}`;
}

export interface InventoryRow {
  id: number;
  cost_price: number;
  sale_price: number;
  quantity: number;
  low_stock_threshold: number;
  supplier_name?: string | null;
  imei?: string | null;
}

function StockBadge<T extends InventoryRow>({ item }: { item: T }) {
  const isLow =
    item.low_stock_threshold > 0 && item.quantity <= item.low_stock_threshold;
  const isOut = item.quantity === 0;

  if (isOut) return <StatusBadge status="Out of Stock" />;
  if (isLow) return <StatusBadge status="Low Stock" />;
  return <StatusBadge status="In Stock" />;
}

interface InventoryProductPageProps<T extends InventoryRow, I> {
  rows: T[];
  loading: boolean;
  error: string | null;
  onLoad: (search: string) => void;
  rowTitle: (item: T) => string;
  rowSubtitle: (item: T) => string;
  add: (input: I) => Promise<void>;
  update: (id: number, input: I) => Promise<void>;
  remove: (id: number) => Promise<void>;
  restock: (id: number, quantity: number, imeis: string[]) => Promise<void>;
  listImei?: (item: T) => Promise<PhoneImei[]>;
  showImei?: boolean;
  FormComponent: React.ComponentType<{
    onSubmit: (input: I) => Promise<void>;
    onCancel: () => void;
    initial?: T | null;
    suppliers: Supplier[];
    categories: ProductCategory[];
  }>;
  typeName: string;
  itemName: string;
  description: string;
  addLabel: string;
  icon: typeof Smartphone | typeof Headphones;
  showCategoryManager?: boolean;
  showImeiCol?: boolean;
  showImeiButton?: boolean;
}

export function InventoryProductPage<T extends InventoryRow, I>({
  rows,
  loading,
  error,
  onLoad,
  rowTitle,
  rowSubtitle,
  add,
  update,
  remove,
  restock,
  listImei,
  showImei,
  FormComponent,
  typeName,
  itemName,
  description,
  addLabel,
  icon,
  showCategoryManager,
  showImeiCol,
  showImeiButton,
}: InventoryProductPageProps<T, I>) {
  const { suppliers, load: loadSuppliers } = useSupplierStore();
  const { categories, load: loadProductCategories } = useProductCategoryStore();
  const user = useSessionStore((s) => s.user);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [restockItem, setRestockItem] = useState<T | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [imeiItem, setImeiItem] = useState<T | null>(null);
  const [imeis, setImeis] = useState<PhoneImei[]>([]);
  const [imeiLoading, setImeiLoading] = useState(false);
  const [stockFilter, setStockFilter] = useState<"all" | "in" | "low" | "out">("all");
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const imeiReq = useRef(0);
  const canManageCategories = user !== null && (user.role === "Admin" || user.role === "Owner");

  useEffect(() => {
    onLoad("");
    loadSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadProductCategories();
  }, [loadProductCategories]);

  const doSearch = () => onLoad(search);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (item: T) => {
    setEditing(item);
    setModalOpen(true);
  };

  const handleSubmit = async (input: I) => {
    if (editing) await update(editing.id, input);
    else await add(input);
    setModalOpen(false);
  };

  const handleDelete = async () => {
    if (confirmDelete === null) return;
    await remove(confirmDelete);
    setConfirmDelete(null);
  };

  const openImeiViewer = async (item: T) => {
    if (!listImei) return;
    const req = ++imeiReq.current;
    setImeiItem(item);
    setImeiLoading(true);
    setImeis([]);
    try {
      const rows = await listImei(item);
      if (req === imeiReq.current) setImeis(rows);
    } finally {
      if (req === imeiReq.current) setImeiLoading(false);
    }
  };

  const isLowStock = (q: number, t: number) => t > 0 && q <= t;
  const totalItems = rows.length;
  const lowStockCount = rows.filter((i) => isLowStock(i.quantity, i.low_stock_threshold)).length;
  const outOfStockCount = rows.filter((i) => i.quantity === 0).length;
  const totalUnits = rows.reduce((s, i) => s + i.quantity, 0);
  const inventoryValue = rows.reduce((s, i) => s + i.quantity * i.cost_price, 0);

  const visibleRows = rows.filter((i) => {
    if (stockFilter === "in") return i.quantity > 0 && !isLowStock(i.quantity, i.low_stock_threshold);
    if (stockFilter === "low") return isLowStock(i.quantity, i.low_stock_threshold);
    if (stockFilter === "out") return i.quantity === 0;
    return true;
  });

  const stockTabs: { key: "all" | "in" | "low" | "out"; label: string; count: number }[] = [
    { key: "all", label: "All", count: rows.length },
    { key: "in", label: "In Stock", count: rows.length - lowStockCount - outOfStockCount },
    { key: "low", label: "Low Stock", count: lowStockCount },
    { key: "out", label: "Out of Stock", count: outOfStockCount },
  ];

  return (
    <div>
      <PageHeader
        title={typeName}
        description={description}
        breadcrumb={[{ label: "Inventory" }, { label: typeName }]}
        meta={`${totalItems} items`}
        actions={
          <div className="flex items-center gap-2">
            {showCategoryManager && canManageCategories && (
              <Button
                variant="secondary"
                onClick={() => setCategoryManagerOpen(true)}
                icon={<Tags className="h-3.5 w-3.5" />}
              >
                Manage Categories
              </Button>
            )}
            <Button onClick={openCreate} icon={<Plus className="h-3.5 w-3.5" />}>
              {addLabel}
            </Button>
          </div>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert message={error} variant="error" />
        </div>
      )}

      {lowStockCount > 0 && (
        <div className="mb-4">
          <Alert
            variant="warning"
            title={`${lowStockCount} item${lowStockCount !== 1 ? "s" : ""} below minimum stock`}
            message="Consider restocking these items to avoid stockouts."
          />
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          title="Total Products"
          value={totalItems.toLocaleString("en-PK")}
          icon={Boxes}
          tone="primary"
          sub="unique SKUs"
        />
        <KpiCard
          title="Inventory Value"
          value={formatMoneyCompact(inventoryValue)}
          icon={Coins}
          tone="green"
          sub="at cost price"
        />
        <KpiCard
          title="Units in Stock"
          value={totalUnits.toLocaleString("en-PK")}
          icon={Package}
          tone="navy"
          sub="total pieces"
        />
        <KpiCard
          title="Low Stock Alerts"
          value={String(lowStockCount)}
          icon={AlertTriangle}
          tone={lowStockCount > 0 ? "amber" : "green"}
          sub={`${outOfStockCount} out of stock`}
        />
      </div>

      <Card noPadding>
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid #E2E8F0" }}
        >
          <div className="relative flex-1 max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              style={{ color: "#94A3B8" }}
            />
            <input
              className="h-9 w-full rounded border bg-white pl-9 pr-3 text-[13px] outline-none transition-all placeholder:text-[#94A3B8]"
              style={{ borderColor: "#CBD5E1", color: "#0F172A" }}
              placeholder={`Search by brand, model or ${showImei ? "IMEI" : "type"}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
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
                onClick={() => {
                  setSearch("");
                  onLoad("");
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
                style={{ color: "#94A3B8" }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={doSearch}>
            Search
          </Button>

          <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: "#F1F5F9" }}>
            {stockTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStockFilter(tab.key)}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors"
                style={{
                  background: stockFilter === tab.key ? "#fff" : "transparent",
                  color: stockFilter === tab.key ? "#0F172A" : "#64748B",
                  boxShadow: stockFilter === tab.key ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {tab.label}
                <span
                  className="rounded-full px-1.5 text-[10px] font-bold"
                  style={{
                    background: stockFilter === tab.key ? "#DBEAFE" : "#E2E8F0",
                    color: stockFilter === tab.key ? "#2563EB" : "#64748B",
                  }}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {lowStockCount > 0 && (
              <span
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: "#FEF3C7", color: "#B45309" }}
              >
                <AlertTriangle className="h-3 w-3" />
                {lowStockCount} Low Stock
              </span>
            )}
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{ background: "#F1F5F9", color: "#475569" }}
            >
              {totalItems} total
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16" style={{ color: "#64748B" }}>
            <Spinner className="h-5 w-5" />
            <span className="text-[13px]">Loading {itemName} inventory...</span>
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={icon}
              title="No inventory found"
              description={
                search || stockFilter !== "all"
                  ? "No items match the current search and stock filter."
                  : `Add your first ${itemName} to start tracking stock.`
              }
              action={
                !search && stockFilter === "all" ? (
                  <Button onClick={openCreate} icon={<Plus className="h-3.5 w-3.5" />}>
                    {addLabel}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setStockFilter("all");
                      onLoad("");
                    }}
                  >
                    Clear Filters
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Brand / Model</th>
                  {showImei ? <th>Specs</th> : <th>Type</th>}
                  <th>Supplier</th>
                  <th className="text-right">Cost Price</th>
                  <th className="text-right">Sale Price</th>
                  <th className="text-center">Stock</th>
                  {showImeiCol && <th className="text-center">IMEI</th>}
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((item) => {
                  const isLow =
                    item.low_stock_threshold > 0 && item.quantity <= item.low_stock_threshold;
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="font-semibold" style={{ color: "#0F172A", fontSize: "13px" }}>
                          {rowTitle(item)}
                        </div>
                        <div className="text-[11px]" style={{ color: "#94A3B8" }}>
                          ID: {item.id}
                        </div>
                      </td>
                      <td>
                        <span style={{ color: "#475569", fontSize: "13px" }}>
                          {rowSubtitle(item)}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: "#475569", fontSize: "13px" }}>
                          {item.supplier_name ?? "—"}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="amount text-[13px]" style={{ color: "#64748B" }}>
                          {formatPKR(item.cost_price)}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="amount text-[13px] font-semibold" style={{ color: "#0F172A" }}>
                          {formatPKR(item.sale_price)}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className="text-[14px] font-bold"
                            style={{
                              color: isLow
                                ? "#D97706"
                                : item.quantity === 0
                                ? "#DC2626"
                                : "#16A34A",
                            }}
                          >
                            {item.quantity}
                          </span>
                          <StockBadge item={item} />
                        </div>
                      </td>
                      {showImeiCol && (
                        <td className="text-center">
                          {showImeiButton ? (
                            <button
                              type="button"
                              onClick={() => openImeiViewer(item)}
                              className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors hover:bg-blue-50"
                              style={{ color: "#3B6FD4", border: "1px solid #DBEAFE", background: "#EFF6FF" }}
                              title="View IMEI numbers"
                            >
                              <ListChecks className="h-3 w-3" />
                              IMEI
                            </button>
                          ) : (
                            <span className="imei-box" style={{ fontSize: "11px", color: "#475569" }}>
                              {item.imei ?? "—"}
                            </span>
                          )}
                        </td>
                      )}
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setRestockItem(item)}
                            className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-green-50"
                            style={{ color: "#16A34A" }}
                            title="Restock"
                          >
                            <PackagePlus className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-blue-50"
                            style={{ color: "#3B6FD4" }}
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(item.id)}
                            className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-red-50"
                            style={{ color: "#DC2626" }}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        title={editing ? `Edit ${typeName}` : `Add ${typeName}`}
        subtitle={editing ? `Editing: ${rowTitle(editing)}` : `${addLabel} details`}
        onClose={() => setModalOpen(false)}
        size="lg"
      >
        <FormComponent
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
          initial={editing}
          suppliers={suppliers}
          categories={categories}
        />
      </Modal>

      {/* Restock Modal */}
      <Modal
        open={restockItem !== null}
        title="Restock Item"
        subtitle={
          restockItem
            ? `${rowTitle(restockItem)} — Current qty: ${restockItem.quantity}`
            : undefined
        }
        onClose={() => setRestockItem(null)}
        size="md"
      >
        {restockItem && (
          <RestockForm
            item={{
              id: restockItem.id,
              title: rowTitle(restockItem),
              quantity: restockItem.quantity,
            }}
            onCancel={() => setRestockItem(null)}
            hasImeiTracking={showImei}
            onSubmit={async (qty, imeis) => {
              await restock(restockItem.id, qty, imeis);
              setRestockItem(null);
            }}
          />
        )}
      </Modal>

      {/* IMEI Viewer Modal */}
      <Modal
        open={imeiItem !== null}
        title="IMEI Numbers"
        subtitle={imeiItem ? rowTitle(imeiItem) : undefined}
        onClose={() => setImeiItem(null)}
        size="sm"
      >
        {imeiLoading ? (
          <div className="flex items-center justify-center gap-2 py-10" style={{ color: "#64748B" }}>
            <Spinner className="h-5 w-5" />
            <span className="text-[13px]">Loading IMEI numbers...</span>
          </div>
        ) : imeis.length === 0 ? (
          <p className="py-6 text-center text-[13px]" style={{ color: "#64748B" }}>
            No IMEI numbers registered. Use <strong>Restock</strong> to register IMEI units.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {imeis.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between rounded-lg px-3 py-2"
                style={{
                  background: i.status === "sold" ? "#F8FAFC" : "#F0FDF4",
                  border: "1px solid",
                  borderColor: i.status === "sold" ? "#E2E8F0" : "#DCFCE7",
                }}
              >
                <span className="imei-box" style={{ background: "transparent", border: "none", padding: 0 }}>
                  {i.imei}
                </span>
                <StatusBadge status={i.status === "sold" ? "returned" : "in stock"} />
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={confirmDelete !== null}
        title="Delete Item"
        onClose={() => setConfirmDelete(null)}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>
              Delete Item
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Alert
            variant="warning"
            message="Deleting this item will remove it from inventory. This action cannot be undone."
          />
          <p className="text-[13px]" style={{ color: "#475569" }}>
            Are you sure you want to delete this {itemName} from your inventory?
          </p>
        </div>
      </Modal>

      {/* Manage Product Categories */}
      <ManageProductCategoriesModal
        open={categoryManagerOpen}
        onClose={() => setCategoryManagerOpen(false)}
      />
    </div>
  );
}