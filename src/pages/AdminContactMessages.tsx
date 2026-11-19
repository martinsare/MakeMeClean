import { useEffect, useState } from "react";
import { Mail, Phone, Clock, Tag, ChevronDown, ChevronUp, Send, CheckCircle2, Inbox, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useRole";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { ContactMessage } from "@/types";
import { MESSAGE_STATUS_STYLES } from "@/lib/constants";

function fmtDate(s: string) {
  return new Date(s).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_STYLES = MESSAGE_STATUS_STYLES;

export default function AdminContactMessages() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);

  const [messages, setMessages]   = useState<ContactMessage[]>([]);
  const [fetching, setFetching]   = useState(true);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending]     = useState(false);
  const [sendError, setSendError] = useState("");
  const [sentId, setSentId]       = useState<string | null>(null);

  const load = async () => {
    setFetching(true);
    const { data } = await supabase
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false });
    setMessages(data ?? []);
    setFetching(false);
  };

  useEffect(() => { if (!loading && !roleLoading && isAdmin) load(); }, [loading, roleLoading, isAdmin]);

  const open = async (msg: ContactMessage) => {
    if (expanded === msg.id) { setExpanded(null); return; }
    setExpanded(msg.id);
    setReplyText("");
    setSendError("");
    setSentId(null);
    if (!msg.status || msg.status === "new") {
      await supabase.from("contact_messages").update({ status: "read" }).eq("id", msg.id);
      setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, status: "read" } : m));
    }
  };

  const sendReply = async (msg: ContactMessage) => {
    if (!replyText.trim()) return;
    setSending(true);
    setSendError("");
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const { data: json, error: fnErr } = await supabase.functions.invoke(
        "reply-contact",
        {
          body: { messageId: msg.id, replyText: replyText.trim() },
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        }
      );
      if (fnErr || !json?.ok) throw new Error(json?.error ?? fnErr?.message ?? "Failed to send reply");
      setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, status: "replied" } : m));
      setSentId(msg.id);
      setReplyText("");
    } catch (e: any) {
      setSendError(e.message ?? "Something went wrong");
    } finally {
      setSending(false);
    }
  };

  const statusLabel = (s: string | null) => {
    if (!s || s === "new") return "New";
    if (s === "read") return "Read";
    if (s === "replied") return "Replied";
    return s;
  };

  if (loading || roleLoading) return null;
  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center text-gray-500">Access denied</div>;

  const counts = {
    all:     messages.length,
    new:     messages.filter((m) => !m.status || m.status === "new").length,
    replied: messages.filter((m) => m.status === "replied").length,
  };

  return (
    <AdminLayout
      title="Contact Messages"
      subtitle={`${counts.new} unread · ${counts.replied} replied`}
      actions={
        <button onClick={load} disabled={fetching}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
          <RefreshCw className={cn("w-4 h-4", fetching && "animate-spin")} /> Refresh
        </button>
      }
    >
      {fetching ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
            <Inbox className="w-7 h-7 text-gray-400" />
          </div>
          <p className="font-black text-gray-900 text-lg">No messages yet</p>
          <p className="text-sm text-gray-400 mt-1">Contact form submissions will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => {
            const isOpen  = expanded === msg.id;
            const replied = msg.status === "replied";
            const isNew   = !msg.status || msg.status === "new";

            return (
              <div key={msg.id}
                className={cn(
                  "bg-white border rounded-2xl shadow-sm overflow-hidden transition-all",
                  isOpen ? "border-green-200" : "border-gray-100",
                  isNew && !isOpen && "border-l-4 border-l-blue-400"
                )}>

                {/* Header row */}
                <button onClick={() => open(msg)}
                  className="w-full flex items-start gap-4 p-5 text-left hover:bg-gray-50/50 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Mail className="w-4.5 h-4.5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cn("text-sm font-black text-gray-900", isNew && "text-blue-900")}>{msg.name}</p>
                      <span className={cn(
                        "text-xs font-bold px-2 py-0.5 rounded-full border",
                        STATUS_STYLES[msg.status ?? "new"] ?? STATUS_STYLES.new
                      )}>
                        {statusLabel(msg.status)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{msg.email}{msg.phone ? ` · ${msg.phone}` : ""}</p>
                    <p className="text-sm text-gray-600 font-semibold mt-1 truncate">{msg.subject ?? "No subject"}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{msg.message}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <span className="text-xs text-gray-400 whitespace-nowrap">{fmtDate(msg.created_at)}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {/* Expanded detail + reply */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-5">

                    {/* Message body */}
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Message</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                    </div>

                    {/* Contact meta */}
                    <div className="flex flex-wrap gap-3">
                      <a href={`mailto:${msg.email}`}
                        className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors">
                        <Mail className="w-3 h-3" /> {msg.email}
                      </a>
                      {msg.phone && (
                        <a href={`tel:${msg.phone}`}
                          className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                          <Phone className="w-3 h-3" /> {msg.phone}
                        </a>
                      )}
                      {msg.subject && (
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-lg">
                          <Tag className="w-3 h-3" /> {msg.subject}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 text-xs text-gray-400 px-3 py-1.5">
                        <Clock className="w-3 h-3" /> {fmtDate(msg.created_at)}
                      </span>
                    </div>

                    {/* Sent confirmation */}
                    {sentId === msg.id && (
                      <div className="flex items-center gap-2.5 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                        <p className="text-sm font-semibold text-green-800">Reply sent successfully to {msg.email}.</p>
                      </div>
                    )}

                    {/* Reply form */}
                    {sentId !== msg.id && (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                          Reply to {msg.name}
                          <span className="ml-1 normal-case font-normal text-gray-400">— {msg.email}</span>
                        </p>
                        <textarea
                          rows={5}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          disabled={sending || replied}
                          placeholder={replied ? "A reply has already been sent for this message." : `Hi ${msg.name},\n\nThank you for getting in touch…`}
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none disabled:bg-gray-50 disabled:text-gray-400"
                        />
                        {sendError && (
                          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{sendError}</p>
                        )}
                        <div className="flex justify-end">
                          <button
                            onClick={() => sendReply(msg)}
                            disabled={sending || !replyText.trim() || replied}
                            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Send className="w-4 h-4" />
                            {sending ? "Sending…" : replied ? "Already replied" : "Send reply"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
