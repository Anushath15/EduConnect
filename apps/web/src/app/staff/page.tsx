"use client"
import { useState, type FormEvent } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Users, Plus, Pencil, Trash2, KeyRound, X, Check } from "lucide-react"

import { get, post, patch, del } from "@/lib/api"
import { AdminLayout } from "@/components/AdminLayout"
 
type UserRole = "PRINCIPAL"|"VICE_PRINCIPAL"|"COORDINATOR"|"ADMINISTRATOR"|
                "CLASS_TEACHER"|"SUBJECT_TEACHER"|"TEMP_TEACHER"|"INTERN"|"OFFICE_STAFF"
 
interface StaffMember {
  id: string; name: string; email: string; role: UserRole
  phone: string | null; isActive: boolean; lastLoginAt: string | null
}
 
const ROLE_COLORS: Record<UserRole, string> = {
  PRINCIPAL:      "bg-purple-500/15 text-purple-600",
  VICE_PRINCIPAL: "bg-indigo-500/15 text-indigo-600",
  COORDINATOR:    "bg-blue-500/15 text-blue-600",
  ADMINISTRATOR:  "bg-sky-500/15 text-sky-600",
  CLASS_TEACHER:  "bg-green-500/15 text-green-600",
  SUBJECT_TEACHER:"bg-teal-500/15 text-teal-600",
  TEMP_TEACHER:   "bg-yellow-500/15 text-yellow-700",
  INTERN:         "bg-orange-500/15 text-orange-600",
  OFFICE_STAFF:   "bg-slate-500/15 text-slate-600",
}
const ROLE_LABELS: Record<UserRole, string> = {
  PRINCIPAL:"Principal", VICE_PRINCIPAL:"Vice Principal", COORDINATOR:"Coordinator",
  ADMINISTRATOR:"Administrator", CLASS_TEACHER:"Class Teacher", SUBJECT_TEACHER:"Subject Teacher",
  TEMP_TEACHER:"Temp Teacher", INTERN:"Intern", OFFICE_STAFF:"Office Staff",
}
const ALL_ROLES: UserRole[] = ["PRINCIPAL","VICE_PRINCIPAL","COORDINATOR","ADMINISTRATOR",
  "CLASS_TEACHER","SUBJECT_TEACHER","TEMP_TEACHER","INTERN","OFFICE_STAFF"]
 
const inp = "w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
 
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium mb-1.5">{label}</label>{children}</div>
}
function Err({ msg }: { msg: string }) {
  return <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">{msg}</div>
}
function Dlg({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
function Actions({ onClose, loading, label }: { onClose: () => void; loading: boolean; label: string }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onClose} className="flex-1 rounded-lg border py-2.5 text-sm font-medium hover:bg-accent">Cancel</button>
      <button type="submit" disabled={loading} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
        {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Check className="h-4 w-4" />}
        {loading ? "Saving…" : label}
      </button>
    </div>
  )
}
 
export default function StaffPage() {
  const qc = useQueryClient()
  const [dialog,   setDialog]   = useState<null|"add"|"edit"|"reset">(null)
  const [selected, setSelected] = useState<StaffMember|null>(null)
  const [formErr,  setFormErr]  = useState("")
  const [addName,  setAddName]  = useState("")
  const [addEmail, setAddEmail] = useState("")
  const [addPass,  setAddPass]  = useState("")
  const [addRole,  setAddRole]  = useState<UserRole>("SUBJECT_TEACHER")
  const [addPhone, setAddPhone] = useState("")
  const [editName, setEditName] = useState("")
  const [editPhone,setEditPhone]= useState("")
  const [editRole, setEditRole] = useState<UserRole>("SUBJECT_TEACHER")
  const [newPass,  setNewPass]  = useState("")
 
  const { data: staff = [], isLoading } = useQuery<StaffMember[]>({
    queryKey: ["staff"], queryFn: () => get<StaffMember[]>("/staff"), staleTime: 30_000,
  })
  const refetch = () => qc.invalidateQueries({ queryKey: ["staff"] })
  const close   = () => { setDialog(null); setSelected(null); setFormErr(""); setAddName(""); setAddEmail(""); setAddPass(""); setAddPhone("") }
 
  const createM = useMutation({
    mutationFn: () => post("/staff", { name:addName, email:addEmail, password:addPass, role:addRole, phone:addPhone||undefined }),
    onSuccess: () => { refetch(); close() }, onError: (e: Error) => setFormErr(e.message),
  })
  const updateM = useMutation({
    mutationFn: () => patch(`/staff/${selected!.id}`, { name:editName, phone:editPhone||null, role:editRole }),
    onSuccess: () => { refetch(); close() }, onError: (e: Error) => setFormErr(e.message),
  })
  const deactM = useMutation({ mutationFn: (id:string) => del(`/staff/${id}`), onSuccess: refetch })
  const resetM  = useMutation({
    mutationFn: () => post(`/staff/${selected!.id}/reset-password`, { newPassword:newPass }),
    onSuccess: () => { close(); setNewPass("") }, onError: (e: Error) => setFormErr(e.message),
  })
 
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Staff</h1>
            <p className="text-muted-foreground mt-1">{staff.length} member{staff.length!==1?"s":""}</p>
          </div>
          <button onClick={() => { setFormErr(""); setDialog("add") }}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" /> Add Staff
          </button>
        </div>
 
        <div className="rounded-xl border bg-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : staff.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Users className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium">No staff members yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {["Name","Email","Role","Phone","Last Login","Actions"].map(h=>
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {staff.map(m=>(
                  <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{m.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[m.role]}`}>
                        {ROLE_LABELS[m.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.phone??"—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleDateString() : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={()=>{setSelected(m);setEditName(m.name);setEditPhone(m.phone??"");setEditRole(m.role);setFormErr("");setDialog("edit")}}
                          className="rounded p-1.5 hover:bg-accent transition-colors" title="Edit">
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={()=>{setSelected(m);setNewPass("");setFormErr("");setDialog("reset")}}
                          className="rounded p-1.5 hover:bg-accent transition-colors" title="Reset password">
                          <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={()=>{if(confirm(`Deactivate ${m.name}?`))deactM.mutate(m.id)}}
                          className="rounded p-1.5 hover:bg-destructive/10 transition-colors" title="Deactivate">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
 
      {dialog==="add" && (
        <Dlg title="Add Staff Member" onClose={close}>
          <form onSubmit={(e:FormEvent)=>{e.preventDefault();setFormErr("");createM.mutate()}} className="space-y-4">
            {formErr&&<Err msg={formErr}/>}
            <Field label="Full name"><input required value={addName} onChange={e=>setAddName(e.target.value)} placeholder="Priya Murugan" className={inp}/></Field>
            <Field label="Email"><input required type="email" value={addEmail} onChange={e=>setAddEmail(e.target.value)} placeholder="priya@school.edu" className={inp}/></Field>
            <Field label="Temporary password"><input required type="password" value={addPass} onChange={e=>setAddPass(e.target.value)} placeholder="Min 8 chars…" className={inp}/></Field>
            <Field label="Role"><select value={addRole} onChange={e=>setAddRole(e.target.value as UserRole)} className={inp}>{ALL_ROLES.map(r=><option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></Field>
            <Field label="Phone (optional)"><input value={addPhone} onChange={e=>setAddPhone(e.target.value)} placeholder="+91 98765 43210" className={inp}/></Field>
            <Actions onClose={close} loading={createM.isPending} label="Create Staff Member"/>
          </form>
        </Dlg>
      )}
      {dialog==="edit"&&selected&&(
        <Dlg title={`Edit — ${selected.name}`} onClose={close}>
          <form onSubmit={(e:FormEvent)=>{e.preventDefault();setFormErr("");updateM.mutate()}} className="space-y-4">
            {formErr&&<Err msg={formErr}/>}
            <Field label="Full name"><input required value={editName} onChange={e=>setEditName(e.target.value)} className={inp}/></Field>
            <Field label="Phone"><input value={editPhone} onChange={e=>setEditPhone(e.target.value)} className={inp}/></Field>
            <Field label="Role"><select value={editRole} onChange={e=>setEditRole(e.target.value as UserRole)} className={inp}>{ALL_ROLES.map(r=><option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></Field>
            <Actions onClose={close} loading={updateM.isPending} label="Save Changes"/>
          </form>
        </Dlg>
      )}
      {dialog==="reset"&&selected&&(
        <Dlg title={`Reset Password — ${selected.name}`} onClose={close}>
          <form onSubmit={(e:FormEvent)=>{e.preventDefault();setFormErr("");resetM.mutate()}} className="space-y-4">
            {formErr&&<Err msg={formErr}/>}
            <p className="text-sm text-muted-foreground">Set a new temporary password for {selected.name}.</p>
            <Field label="New password"><input required type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="Min 8 chars…" className={inp}/></Field>
            <Actions onClose={close} loading={resetM.isPending} label="Reset Password"/>
          </form>
        </Dlg>
      )}
    </AdminLayout>
  )
}