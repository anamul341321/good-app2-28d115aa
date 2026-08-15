import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  adminListCardProducts, 
  adminCreateCardProduct, 
  adminUpdateCardProduct, 
  adminDeleteCardProduct,
  adminAddCardCodes,
  adminGetProductCodes
} from "@/lib/admin.functions";
import { useState } from "react";
import { 
  Plus, 
  Package, 
  Trash2, 
  Edit2, 
  PlusSquare, 
  Loader2,
  AlertCircle,
  ScanLine,
  Smartphone,
  Wifi
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CardCodeScanner } from "@/components/CardCodeScanner";

export const Route = createFileRoute("/admin/cards")({
  ssr: false,
  component: CardManagementPage,
});

function CardManagementPage() {
  const qc = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingCard, setEditingCard] = useState<any>(null);
  const [stockCard, setStockCard] = useState<any>(null);
  const [codesText, setCodesText] = useState("");
  const [scanning, setScanning] = useState(false);
  
  const { data: cards, isLoading } = useQuery({
    queryKey: ["admin-cards"],
    queryFn: () => adminListCardProducts(),
  });

  const create = useMutation({
    mutationFn: adminCreateCardProduct,
    onSuccess: () => {
      toast.success("Product created");
      setIsAdding(false);
      qc.invalidateQueries({ queryKey: ["admin-cards"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: adminUpdateCardProduct,
    onSuccess: () => {
      toast.success("Product updated");
      setEditingCard(null);
      qc.invalidateQueries({ queryKey: ["admin-cards"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: adminDeleteCardProduct,
    onSuccess: () => {
      toast.success("Product deleted");
      qc.invalidateQueries({ queryKey: ["admin-cards"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addCodes = useMutation({
    mutationFn: adminAddCardCodes,
    onSuccess: () => {
      toast.success("Stock added");
      setStockCard(null);
      qc.invalidateQueries({ queryKey: ["admin-cards"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Card Management
          </h1>
          <p className="text-sm text-muted-foreground font-medium">Manage Minute & Internet Cards</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-primary text-white px-4 py-2 rounded-xl font-black text-sm flex items-center gap-2 shadow-lg shadow-primary/20 btn-press"
        >
          <Plus className="h-4 w-4" />
          Add Card
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards?.map((card) => (
            <div key={card.id} className="bg-surface-1 border rounded-2xl p-4 space-y-4 hover:border-primary/50 transition-colors group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-12 w-12 rounded-xl flex items-center justify-center text-white font-black text-xs",
                    card.operator === "GP" ? "bg-[#007cc3]" :
                    card.operator === "Robi" ? "bg-[#e31c23]" :
                    card.operator === "Airtel" ? "bg-[#ed1c24]" :
                    card.operator === "Banglalink" ? "bg-[#ff6a00]" : "bg-slate-600"
                  )}>
                    {card.operator}
                  </div>
                  <div>
                    <h3 className="font-black text-sm leading-tight">{card.name}</h3>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mt-0.5">
                      {card.card_type === "Minute" ? <Smartphone className="h-3 w-3" /> : <Wifi className="h-3 w-3" />}
                      {card.card_type} • {card.amount_label}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-primary">৳{card.selling_price}</p>
                  <p className={cn(
                    "text-[10px] font-black px-2 py-0.5 rounded-full inline-block mt-1",
                    card.stock_count > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                  )}>
                    {card.stock_count} in stock
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button 
                  onClick={() => setStockCard(card)}
                  className="flex-1 bg-surface-2 hover:bg-surface-3 py-2 rounded-lg text-[11px] font-black flex items-center justify-center gap-1.5 transition-colors"
                >
                  <PlusSquare className="h-3.5 w-3.5" />
                  Add Stock
                </button>
                <button 
                  onClick={() => setEditingCard(card)}
                  className="p-2 bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button 
                  onClick={() => {
                    if (confirm("Delete this product?")) del.mutate({ data: { id: card.id } });
                  }}
                  className="p-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 rounded-lg transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      {(isAdding || editingCard) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black mb-6">{editingCard ? "Edit Card" : "New Card Product"}</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const data = {
                name: fd.get("name") as string,
                operator: fd.get("operator") as any,
                card_type: fd.get("card_type") as any,
                amount_label: fd.get("amount_label") as string,
                selling_price: Number(fd.get("selling_price")),
                description: fd.get("description") as string,
                validity: fd.get("validity") as string,
                is_active: true
              };
              if (editingCard) {
                update.mutate({ data: { id: editingCard.id, data } });
              } else {
                create.mutate({ data });
              }
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase ml-1">Operator</label>
                  <select name="operator" defaultValue={editingCard?.operator ?? "GP"} className="w-full bg-surface-2 border-none rounded-xl h-11 px-4 text-sm font-bold focus:ring-2 ring-primary/20 outline-none appearance-none">
                    <option value="GP">GP</option>
                    <option value="Robi">Robi</option>
                    <option value="Airtel">Airtel</option>
                    <option value="Banglalink">Banglalink</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase ml-1">Type</label>
                  <select name="card_type" defaultValue={editingCard?.card_type ?? "Minute"} className="w-full bg-surface-2 border-none rounded-xl h-11 px-4 text-sm font-bold focus:ring-2 ring-primary/20 outline-none appearance-none">
                    <option value="Minute">Minute Card</option>
                    <option value="Internet">Internet Card</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase ml-1">Product Name</label>
                <input name="name" defaultValue={editingCard?.name} required placeholder="e.g. GP 100 Minute" className="w-full bg-surface-2 border-none rounded-xl h-11 px-4 text-sm font-bold focus:ring-2 ring-primary/20 outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase ml-1">Amount Label</label>
                  <input name="amount_label" defaultValue={editingCard?.amount_label} required placeholder="e.g. 100 Min / 5GB" className="w-full bg-surface-2 border-none rounded-xl h-11 px-4 text-sm font-bold focus:ring-2 ring-primary/20 outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase ml-1">Price (৳)</label>
                  <input name="selling_price" type="number" defaultValue={editingCard?.selling_price} required placeholder="50" className="w-full bg-surface-2 border-none rounded-xl h-11 px-4 text-sm font-bold focus:ring-2 ring-primary/20 outline-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase ml-1">Validity</label>
                <input name="validity" defaultValue={editingCard?.validity} placeholder="e.g. 7 Days" className="w-full bg-surface-2 border-none rounded-xl h-11 px-4 text-sm font-bold focus:ring-2 ring-primary/20 outline-none" />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => { setIsAdding(false); setEditingCard(null); }}
                  className="flex-1 py-3 rounded-xl font-black text-sm bg-surface-2 hover:bg-surface-3 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  disabled={create.isPending || update.isPending}
                  className="flex-1 py-3 rounded-xl font-black text-sm bg-primary text-white shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {(create.isPending || update.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingCard ? "Save Changes" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Stock Dialog */}
      {stockCard && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black mb-1">Add Stock Codes</h2>
            <p className="text-xs font-bold text-muted-foreground mb-6 uppercase tracking-tight">Product: {stockCard.name}</p>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const raw = codesText;
              const codes = raw.split("\n").map(s => s.trim()).filter(Boolean);
              if (codes.length === 0) return toast.error("Please enter codes");
              addCodes.mutate({ data: { productId: stockCard.id, codes } });
            }} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-muted-foreground uppercase ml-1">Secret Codes (One per line)</label>
                  <button
                    type="button"
                    onClick={() => setScanning(true)}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500 text-white text-[10px] font-black flex items-center gap-1.5"
                  >
                    <ScanLine className="h-3.5 w-3.5" /> Scan Card
                  </button>
                </div>
                <textarea 
                  name="codes" 
                  rows={8} 
                  required
                  value={codesText}
                  onChange={(e) => setCodesText(e.target.value)}
                  placeholder="CODE001&#10;CODE002&#10;CODE003..." 
                  className="w-full bg-surface-2 border-none rounded-2xl p-4 text-sm font-mono focus:ring-2 ring-primary/20 outline-none resize-none" 
                />
              </div>


              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                <p className="text-[11px] font-bold text-amber-700/80 leading-relaxed">
                  Every line will be stored as a unique secret code. Users will receive one code per purchase until stock runs out.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setStockCard(null)}
                  className="flex-1 py-3 rounded-xl font-black text-sm bg-surface-2 hover:bg-surface-3 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  disabled={addCodes.isPending}
                  className="flex-1 py-3 rounded-xl font-black text-sm bg-primary text-white shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {addCodes.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
