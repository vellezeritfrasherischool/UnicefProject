import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, ShieldCheck, UserMinus, UserPlus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { adminService, type AdminOverview } from "./adminService";
import { useApp } from "./store";

export default function SchoolAdmin() {
  const { user } = useApp();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await adminService.list()); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Nuk u ngarkua administrimi."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const profiles = useMemo(() => new Map(data?.profiles.map(profile => [profile.id, profile]) ?? []), [data]);
  const createInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await adminService.invite(email);
      setInviteCode(result.code);
      setEmail("");
      toast.success("Ftesa u krijua. Kodi shfaqet vetëm tani.");
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Ftesa nuk u krijua."); }
    finally { setBusy(false); }
  };
  const deactivate = async (id: string) => {
    if (!window.confirm("Ta çaktivizojmë këtë mësues?")) return;
    setBusy(true);
    try { await adminService.deactivateTeacher(id); toast.success("Mësuesi u çaktivizua."); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Veprimi dështoi."); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="py-20 text-center text-muted-foreground">Duke ngarkuar…</div>;
  if (!data) return <div className="p-6 rounded-2xl border border-destructive/30 bg-destructive/5">Nuk ke leje administratori për shkollën.</div>;

  return <div className="max-w-5xl mx-auto space-y-6">
    <div className="flex items-center gap-3">
      <div className="p-3 rounded-2xl bg-primary/10 text-primary"><ShieldCheck /></div>
      <div><h1 className="text-2xl font-extrabold">Administrimi i shkollës</h1><p className="text-muted-foreground">{data.school.name}</p></div>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        ["Kërkesa AI (30 ditë)", data.usageSummary.requests30d],
        ["Tekst", data.usageSummary.byOperation.chat ?? 0],
        ["Audio", data.usageSummary.byOperation.speech ?? 0],
        ["Dështime", data.usageSummary.failed30d],
      ].map(([label, value]) => <div key={String(label)} className="bg-card border border-border rounded-2xl p-4">
        <p className="text-2xl font-extrabold">{value}</p><p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>)}
    </div>

    <section className="bg-card border border-border rounded-2xl p-5">
      <h2 className="font-bold mb-4 flex items-center gap-2"><UserPlus size={19} /> Fto mësues</h2>
      <form onSubmit={createInvite} className="flex flex-col sm:flex-row gap-3">
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="mesuesi@shkolla.edu" className="ui-input flex-1" />
        <button disabled={busy} className="ui-btn-primary">Krijo ftesë 7-ditore</button>
      </form>
      {inviteCode && <div className="mt-4 p-4 rounded-xl bg-warning-muted border border-warning/30">
        <p className="text-xs font-bold mb-1">Kopjoje tani — kodi nuk mund të rikthehet:</p>
        <div className="flex gap-2 items-center"><code className="break-all flex-1">{inviteCode}</code>
          <button onClick={() => { void navigator.clipboard.writeText(inviteCode); toast.success("Kodi u kopjua."); }} className="p-2 rounded-lg hover:bg-card"><Copy size={17} /></button></div>
      </div>}
    </section>

    <section className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-border"><h2 className="font-bold">Mësuesit</h2></div>
      <div className="divide-y divide-border">{data.members.map(member => {
        const profile = profiles.get(member.user_id);
        return <div key={member.user_id} className="p-4 flex items-center gap-4">
          <div className="flex-1 min-w-0"><p className="font-semibold truncate">{profile?.name ?? "Përdorues"}</p><p className="text-sm text-muted-foreground truncate">{profile?.email}</p></div>
          <span className={`text-xs px-2 py-1 rounded-full ${member.active ? "bg-success-muted" : "bg-muted"}`}>{member.active ? "Aktiv" : "Joaktiv"}</span>
          {member.role === "teacher" && member.user_id !== user?.id && member.active &&
            <button disabled={busy} onClick={() => void deactivate(member.user_id)} className="p-2 text-destructive rounded-lg hover:bg-destructive/10" aria-label="Çaktivizo"><UserMinus size={18} /></button>}
        </div>;
      })}</div>
    </section>

    <section className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-border"><h2 className="font-bold">Ftesat</h2></div>
      <div className="divide-y divide-border">{data.invitations.map(invite => <div key={invite.id} className="p-4 flex items-center gap-3">
        <div className="flex-1"><p className="font-semibold">{invite.email}</p><p className="text-xs text-muted-foreground">Skadon: {new Date(invite.expires_at).toLocaleDateString()}</p></div>
        <span className="text-xs">{invite.used_at ? "Përdorur" : "Në pritje"}</span>
        {!invite.used_at && <button disabled={busy} onClick={async () => { await adminService.revokeInvitation(invite.id); toast.success("Ftesa u anulua."); await load(); }} className="p-2 text-destructive"><XCircle size={18} /></button>}
      </div>)}</div>
    </section>
  </div>;
}
