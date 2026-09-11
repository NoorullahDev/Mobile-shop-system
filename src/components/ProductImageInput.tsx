import { useEffect, useRef, useState } from "react";
import { ImagePlus, Star, Trash2 } from "lucide-react";
import { Button } from "./Button";
import * as inventoryService from "../services/inventoryService";

export function ProductImageInput({ value, onChange, disabled }: { value: string[]; onChange: (paths: string[]) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{ value.filter(p=>!previews[p]).forEach(async p=>{try{const url=await inventoryService.readProductImage(p);setPreviews(v=>({...v,[p]:url}))}catch{}}); },[value]);
  useEffect(()=>{ return()=>{ Object.values(previews).forEach(u=>{ try{ URL.revokeObjectURL(u); }catch{} }); }; },[]);
  const choose=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const files=Array.from(e.target.files??[]).slice(0,Math.max(0,5-value.length));
    if(!files.length)return; setBusy(true);setError(null);
    try { const paths:string[]=[]; for(const file of files){if(!file.type.startsWith("image/"))throw new Error("Please choose image files only"); const path=await inventoryService.saveProductImage(file); paths.push(path); setPreviews(v=>({...v,[path]:URL.createObjectURL(file)}));} onChange([...value,...paths]); }
    catch(err){setError(String(err))}finally{setBusy(false);e.target.value=""}
  };
  return <section className="flex flex-col gap-2"><div><h3 className="text-[15px] font-semibold text-slate-900">Product Images</h3><p className="text-[12px] text-slate-400">First image is primary. Up to 5 JPG, PNG or WebP images, 10 MB each.</p></div>
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={choose}/>
    <div className="flex flex-wrap gap-3">{value.map((path,i)=><div key={path} className="relative h-24 w-24 overflow-hidden rounded-lg border bg-slate-50">{previews[path]?<img src={previews[path]} className="h-full w-full object-cover" alt={`Product ${i+1}`}/>:<div className="h-full grid place-items-center text-[10px] text-slate-400">Loading…</div>}{i===0&&<span className="absolute left-1 top-1 rounded bg-blue-600 px-1.5 py-0.5 text-[9px] text-white"><Star className="inline h-2.5 w-2.5"/> Primary</span>}<button type="button" onClick={()=>onChange(value.filter(p=>p!==path))} className="absolute bottom-1 right-1 rounded bg-white p-1 text-red-600 shadow" title="Remove image"><Trash2 className="h-3.5 w-3.5"/></button></div>)}</div>
    <div><Button type="button" size="sm" variant="secondary" disabled={disabled||busy||value.length>=5} loading={busy} onClick={()=>inputRef.current?.click()} icon={<ImagePlus className="h-4 w-4"/>}>{value.length?"Add More Images":"Choose Images"}</Button></div>{error&&<p className="text-[11px] text-red-600">{error}</p>}</section>;
}
