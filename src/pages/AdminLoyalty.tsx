import { useEffect, useState } from "react";
import { Trophy, Plus, Trash2, Gift, Users, Star, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useRole";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/supabase";
import { cn, formatDate } from "@/lib/utils";
import { api } from "@/lib/apiClient";

interface Reward {
  id: string;
  name: string;
  description: string;
  points_required: number;
  active: boolean;
}

interface LeaderEntry {
  user_id: string;
  total: number;
  full_name: string;
  email: string;
}

const TIERS = [
  { name: "Bronze",   min: 0,    textColor: "text-amber-700",  bgLight: "bg-amber-50",  emoji: "🥉" },
  { name: "Silver",   min: 500,  textColor: "text-gray-500",   bgLight: "bg-gray-50",   emoji: "🥈" },
  { name: "Gold",     min: 1000, textColor: "text-yellow-600", bgLight: "bg-yellow-50", emoji: "🥇" },
  { name: "Platinum", min: 2500, textColor: "text-purple-700", bgLight: "bg-purple-50", emoji: "💎" },
];

function getTier(pts: number) {
  let t = TIERS[0];
  for (const tier of TIERS) { if (pts >= tier.min) t = tier; }
  return t;
}

export default function AdminLoyalty() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);

  const [rewards, setRewards]         = useState<Reward[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [fetching, setFetching]       = useState(true);

  // Award points
  const [awardEmail, setAwardEmail]   = useState("");
  const [awardPoints, setAwardPoints] = useState("50");
  const [awardReason, setAwardReason] = useState("");
  const [awarding, setAwarding]       = useState(false);
  const [awardMsg, setAwardMsg]       = useState<{ ok: boolean; text: string } | null>(null);

  // New reward form
  const [newName, setNewName]               = useState("");
  const [newDesc, setNewDesc]               = useState("");
  const [newPts, setNewPts]                 = useState("500");
  const [addingReward, setAddingReward]     = useState(false);
  const [rewardMsg, setRewardMsg]           = useState<{ ok: boolean; text: string } | null>(null);

  const fetchAll = async () => {
    const [{ data: rws }, { data: pts }] = await Promise.all([
      supabase.from("loyalty_rewards").select("*").order("points_required"),
      supabase
        .from("loyalty_points")
        .select("user_id, points"),
    ]);

    setRewards((rws ?? []) as Reward[]);

    // Fetch user details separately (deduplicated & guarded against empty IN list)
    const userIds = [...new Set((pts ?? []).map((p: any) => p.user_id).filter(Boolean))];
    const { data: profiles } =
      userIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds)
        : { data: [] as any[] };
    const profileMap: Record<string, any> = {};
    for (const p of profiles ?? []) profileMap[p.id] = p;

    // Aggregate points per user
    const map: Record<string, LeaderEntry> = {};
    for (const row of pts ?? []) {
      if (!map[row.user_id]) {
        const profile = profileMap[row.user_id];
        map[row.user_id] = {
          user_id: row.user_id,
          total: 0,
          full_name: profile?.full_name ?? "Unknown",
          email: "",
        };
      }
      map[row.user_id].total += row.points;
    }
    const sorted = Object.values(map).sort((a, b) => b.total - a.total);
    setLeaderboard(sorted);
    setFetching(false);
  };

  useEffect(() => {
    if (!loading && !roleLoading && isAdmin) fetchAll();
  }, [loading, roleLoading, isAdmin]);

  const awardPts = async () => {
    if (!awardEmail.trim() || !awardReason.trim()) return;
    setAwarding(true);
    setAwardMsg(null);
    try {
      const pts = parseInt(awardPoints, 10);
      if (!Number.isInteger(pts) || pts === 0) {
        throw new Error("Please enter a valid non-zero point amount.");
      }

      await api.awardLoyaltyPoints({
        email: awardEmail.trim().toLowerCase(),
        points: pts,
        reason: awardReason.trim(),
      });

      setAwardMsg({ ok: true, text: `Awarded ${pts} points to ${awardEmail.trim().toLowerCase()}` });
      setAwardEmail("");
      setAwardReason("");
      setAwardPoints("50");
      await fetchAll();
    } catch (e) {
      setAwardMsg({ ok: false, text: (e as Error).message });
    } finally {
      setAwarding(false);
    }
  };

  const addReward = async () => {
    if (!newName.trim()) return;
    setAddingReward(true);
    setRewardMsg(null);
    try {
      const { error } = await supabase.from("loyalty_rewards").insert({
        name: newName.trim(),
        description: newDesc.trim(),
        points_required: parseInt(newPts) || 500,
        active: true,
      });
      if (error) throw new Error(error.message);
      setRewardMsg({ ok: true, text: "Reward added!" });
      setNewName(""); setNewDesc(""); setNewPts("500");
      await fetchAll();
    } catch (e) {
      setRewardMsg({ ok: false, text: (e as Error).message });
    } finally {
      setAddingReward(false);
    }
  };

  const toggleReward = async (id: string, active: boolean) => {
    setRewardMsg(null);
    const { error } = await supabase.from("loyalty_rewards").update({ active: !active }).eq("id", id);
    if (error) {
      setRewardMsg({ ok: false, text: error.message });
      return;
    }
    await fetchAll();
  };

  const deleteReward = async (id: string) => {
    setRewardMsg(null);
    const { error } = await supabase.from("loyalty_rewards").delete().eq("id", id);
    if (error) {
      setRewardMsg({ ok: false, text: error.message });
      return;
    }
    await fetchAll();
  };

  if (loading || roleLoading) return null;
  if (!user || !isAdmin) return <div className="min-h-screen flex items-center justify-center text-gray-500">Access denied</div>;

  return (
    <AdminLayout title="Loyalty & Rewards" subtitle="Manage customer loyalty points and rewards">

      {fetching ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {TIERS.map((tier) => {
              const count = leaderboard.filter((l) => getTier(l.total).name === tier.name).length;
              return (
                <div key={tier.name} className={cn("rounded-2xl border p-5", tier.bgLight)}>
                  <p className="text-2xl mb-1">{tier.emoji}</p>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{tier.name}</p>
                  <p className="text-2xl font-black text-gray-900">{count}</p>
                </div>
              );
            })}
          </div>

          {/* Award Points */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-sm font-black text-gray-900">Award Points Manually</h2>
              <p className="text-xs text-gray-400 mt-0.5">Give bonus points to a customer by their email address</p>
            </div>
            <div className="p-6 space-y-4">
              {awardMsg && (
                <div className={cn("flex items-center gap-3 rounded-xl px-4 py-3", awardMsg.ok ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200")}>
                  {awardMsg.ok ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
                  <p className="text-sm font-semibold text-gray-800">{awardMsg.text}</p>
                </div>
              )}
              <div className="grid sm:grid-cols-3 gap-3">
                <input
                  type="email"
                  placeholder="customer@email.com"
                  value={awardEmail}
                  onChange={(e) => setAwardEmail(e.target.value)}
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="number"
                  placeholder="Points"
                  value={awardPoints}
                  onChange={(e) => setAwardPoints(e.target.value)}
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="text"
                  placeholder="Reason (e.g. Referral bonus)"
                  value={awardReason}
                  onChange={(e) => setAwardReason(e.target.value)}
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <button
                onClick={awardPts}
                disabled={awarding || !awardEmail.trim() || !awardReason.trim()}
                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-bold rounded-xl transition-colors"
              >
                {awarding ? "Awarding..." : "Award Points"}
              </button>
            </div>
          </div>

          {/* Manage Rewards */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-sm font-black text-gray-900">Manage Rewards</h2>
              <p className="text-xs text-gray-400 mt-0.5">Create rewards customers can redeem with their points</p>
            </div>

            {/* Add new reward */}
            <div className="p-6 border-b border-gray-100 space-y-4">
              {rewardMsg && (
                <div className={cn("flex items-center gap-3 rounded-xl px-4 py-3", rewardMsg.ok ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200")}>
                  {rewardMsg.ok ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
                  <p className="text-sm font-semibold text-gray-800">{rewardMsg.text}</p>
                </div>
              )}
              <div className="grid sm:grid-cols-3 gap-3">
                <input type="text" placeholder="Reward name" value={newName} onChange={(e) => setNewName(e.target.value)}
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <input type="text" placeholder="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <input type="number" placeholder="Points required" value={newPts} onChange={(e) => setNewPts(e.target.value)}
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <button onClick={addReward} disabled={addingReward || !newName.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-bold rounded-xl transition-colors">
                <Plus className="w-4 h-4" /> {addingReward ? "Adding..." : "Add Reward"}
              </button>
            </div>

            {rewards.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <Gift className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No rewards yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {rewards.map((r) => (
                  <div key={r.id} className="px-6 py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">{r.name}</p>
                      <p className="text-xs text-gray-500">{r.description}</p>
                    </div>
                    <p className="text-sm font-bold text-green-600 shrink-0">{r.points_required.toLocaleString()} pts</p>
                    <button onClick={() => toggleReward(r.id, r.active)}
                      className={cn("text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors shrink-0",
                        r.active ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100" : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                      )}>
                      {r.active ? "Active" : "Hidden"}
                    </button>
                    <button onClick={() => deleteReward(r.id)} className="text-red-400 hover:text-red-600 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Leaderboard */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-sm font-black text-gray-900">Customer Leaderboard</h2>
              <p className="text-xs text-gray-400 mt-0.5">All customers ranked by loyalty points</p>
            </div>
            {leaderboard.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No loyalty data yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {leaderboard.map((entry, i) => {
                  const tier = getTier(entry.total);
                  return (
                    <div key={entry.user_id} className="px-6 py-4 flex items-center gap-4">
                      <p className="text-lg font-black text-gray-300 w-6 shrink-0 text-center">{i + 1}</p>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900">{entry.full_name}</p>
                        <p className="text-xs text-gray-400 truncate">{entry.email}</p>
                      </div>
                      <span className={cn("text-xs font-bold px-2 py-1 rounded-lg", tier.bgLight, tier.textColor)}>
                        {tier.emoji} {tier.name}
                      </span>
                      <p className="text-sm font-black text-green-600 shrink-0">{entry.total.toLocaleString()} pts</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}
    </AdminLayout>
  );
}
