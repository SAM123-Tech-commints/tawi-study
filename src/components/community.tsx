"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  Crown,
  GraduationCap,
  ImagePlus,
  Loader2,
  Megaphone,
  MessageCircle,
  Pin,
  Plus,
  Search,
  Send,
  Shield,
  Smile,
  Sparkles,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  VolumeX,
  X,
} from "lucide-react";
import {
  addCommentAction,
  createGroupAction,
  createPostAction,
  deleteCommentAction,
  deleteGroupAction,
  deletePostAction,
  getChatsData,
  getCommunityData,
  getConversationAction,
  getGroupMessagesAction,
  getGroupsData,
  getProfilePreviewAction,
  getTypingAction,
  heartbeatAction,
  inviteToGroupAction,
  leaveGroupAction,
  pingTypingAction,
  promoteToAdminAction,
  reactToPostAction,
  removeFriendAction,
  removeMemberAction,
  respondFriendRequestAction,
  sendFriendRequestAction,
  sendGroupMessageAction,
  sendMessageAction,
  setUserMutedAction,
  togglePinPostAction,
} from "@/lib/actions";
import { Avatar, Badge, Button, Card, cn, ConfirmDialog, EmptyState, Field, Input, Modal, Spinner, Textarea, useToast } from "@/components/ui";

/* ------------------------------- types ------------------------------- */

type CommunityData = NonNullable<Awaited<ReturnType<typeof getCommunityData>>>;
type PostItem = CommunityData["posts"][number];
type PersonItem = CommunityData["people"][number];
type AuthorShape = PostItem["author"];
type Preview = NonNullable<Awaited<ReturnType<typeof getProfilePreviewAction>>>;

/* ----------------------------- helpers ------------------------------- */

/** Chatbox-style relative time: "just now", "3m", "5h", "2d", then a date. */
function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 45) return "just now";
  if (secs < 90) return "1m";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const wks = Math.floor(days / 7);
  if (wks < 5) return `${wks}w`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const BANNER_GRADIENTS: Record<string, string> = {
  lime: "from-brand-300 to-brand-500",
  violet: "from-violet-300 to-violet-500",
  sky: "from-sky-300 to-sky-500",
  amber: "from-amber-300 to-amber-500",
  rose: "from-rose-300 to-rose-500",
};
function bannerClass(banner: string | null): string {
  return BANNER_GRADIENTS[banner ?? "lime"] ?? BANNER_GRADIENTS.lime;
}

function UserAvatar({ name, avatar, size = 40 }: { name: string; avatar: string | null; size?: number }) {
  if (avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatar}
        alt={name}
        className="rounded-full object-cover ring-1 ring-ink/10 dark:ring-cream/15"
        style={{ width: size, height: size }}
      />
    );
  }
  return <Avatar name={name} size={size} />;
}

function PresenceAvatar({
  person,
  size = 40,
  onClick,
}: {
  person: { name: string; avatar: string | null; online: boolean };
  size?: number;
  onClick?: () => void;
}) {
  const dot = Math.max(10, Math.round(size * 0.28));
  const inner = (
    <span className="relative inline-flex shrink-0">
      <UserAvatar name={person.name} avatar={person.avatar} size={size} />
      <span
        title={person.online ? "Online" : "Offline"}
        className={cn(
          "absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-surface dark:border-surface-dark",
          person.online ? "bg-green-500" : "bg-ink/25 dark:bg-cream/30"
        )}
        style={{ width: dot, height: dot }}
      />
    </span>
  );
  if (!onClick) return inner;
  return (
    <button onClick={onClick} className="rounded-full transition hover:opacity-90 active:scale-95" aria-label={`View ${person.name}`}>
      {inner}
    </button>
  );
}

function RoleBadge({ author }: { author: { isAdmin: boolean; role: string | null } }) {
  if (author.isAdmin)
    return (
      <Badge tone="violet" className="gap-1">
        <Shield size={11} /> Admin
      </Badge>
    );
  if (author.role === "educator")
    return (
      <Badge tone="brand" className="gap-1">
        <GraduationCap size={11} /> Educator
      </Badge>
    );
  return null;
}

/* ============================ main component ============================ */

export default function Community() {
  const router = useRouter();
  const [view, setView] = useState<"feed" | "chats" | "groups">("feed");
  const [data, setData] = useState<CommunityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const firstLoad = useRef(true);

  const refresh = useCallback(async () => {
    const d = await getCommunityData();
    setData(d);
    if (firstLoad.current) {
      firstLoad.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Presence heartbeat + light polling so the feed and online dots stay live.
  useEffect(() => {
    const hb = setInterval(() => {
      heartbeatAction().catch(() => {});
    }, 45_000);
    const poll = setInterval(() => {
      refresh().catch(() => {});
    }, 30_000);
    return () => {
      clearInterval(hb);
      clearInterval(poll);
    };
  }, [refresh]);

  const bumpGuest = useCallback(
    (error?: string) => {
      if (error && /guest|sign in/i.test(error)) router.push("/signin");
    },
    [router]
  );

  if (loading || !data) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  const { me } = data;
  const canParticipate = !me.isGuest && !me.muted;

  return (
    <div className="space-y-5">
      <div className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-ink/5 p-1 dark:border-cream/10 dark:bg-cream/5">
        {(
          [
            ["feed", "Feed", Megaphone],
            ["chats", "Friend chats", MessageCircle],
            ["groups", "Group chats", Users],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition-all active:scale-95",
              view === id
                ? "bg-surface text-ink shadow-sm dark:bg-cream/15 dark:text-cream"
                : "text-ink/60 hover:text-ink dark:text-cream/60 dark:hover:text-cream"
            )}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {view === "chats" ? (
        <ChatsTab me={me} />
      ) : view === "groups" ? (
        <GroupsTab me={me} />
      ) : (
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {/* ------------------------------- FEED ------------------------------- */}
      <div className="space-y-5">
        {me.isGuest ? (
          <Card className="flex items-center justify-between gap-3 border-brand-500/30 bg-brand-50/60 dark:bg-brand-500/10">
            <p className="text-sm font-medium text-ink/70 dark:text-cream/70">
              You&apos;re browsing as a guest. Create a free account to post, react and add friends.
            </p>
            <Button size="sm" onClick={() => router.push("/signin")}>
              Sign in
            </Button>
          </Card>
        ) : me.muted ? (
          <Card className="flex items-center gap-2.5 border-red-500/30 bg-red-50/60 dark:bg-red-500/10">
            <VolumeX size={18} className="text-red-500" />
            <p className="text-sm font-medium text-ink/70 dark:text-cream/70">
              An admin has muted you in the community. You can still read posts, but can&apos;t post, comment or react.
            </p>
          </Card>
        ) : (
          <Composer me={me} onPosted={refresh} onError={bumpGuest} />
        )}

        {data.posts.length === 0 ? (
          <EmptyState
            icon={<Sparkles size={22} />}
            title="No posts yet"
            desc="Be the first to share an update, a question, or a win with the community."
          />
        ) : (
          <div className="space-y-4">
            {data.posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                me={me}
                emojis={data.reactionEmojis}
                canParticipate={canParticipate}
                onOpenProfile={setPreviewId}
                onChanged={refresh}
                onError={bumpGuest}
              />
            ))}
          </div>
        )}
      </div>

      {/* ----------------------------- SIDEBAR ----------------------------- */}
      <div className="space-y-5 lg:sticky lg:top-24 lg:h-fit">
        <FriendsSidebar data={data} onOpenProfile={setPreviewId} onChanged={refresh} onError={bumpGuest} />
      </div>

      {previewId && (
        <ProfilePreviewModal userId={previewId} onClose={() => setPreviewId(null)} onChanged={refresh} />
      )}
      </div>
      )}
    </div>
  );
}

/* ============================ group chats ============================ */

type GroupsData = NonNullable<Awaited<ReturnType<typeof getGroupsData>>>;
type GroupItem = GroupsData["groups"][number];
type GroupMessage = { id: string; mine: boolean; senderName: string; senderAvatar: string | null; content: string; image: string | null; createdAt: string };

function GroupsTab({ me }: { me: CommunityData["me"] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [gImage, setGImage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [gName, setGName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [friends, setFriends] = useState<{ id: string; name: string; avatar: string | null }[]>([]);
  const [creating, setCreating] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [askLeave, setAskLeave] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const gFileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadAll = useCallback(async () => {
    const [g, c] = await Promise.all([getGroupsData(), getChatsData()]);
    if (g) setGroups(g.groups);
    if (c) setFriends(c.chats.map((x) => ({ id: x.id, name: x.name, avatar: x.avatar })));
    setLoading(false);
  }, []);

  const loadThread = useCallback(
    async (groupId: string) => {
      const res = await getGroupMessagesAction(groupId);
      if (!res.ok) {
        toast(res.error ?? "Could not open group", "error");
        return;
      }
      setMessages(res.messages);
    },
    [toast]
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!openId) return;
    loadThread(openId);
    const t = setInterval(() => {
      loadThread(openId);
      loadAll();
    }, 5000);
    return () => clearInterval(t);
  }, [openId, loadThread, loadAll]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, openId]);

  const open = groups.find((g) => g.id === openId) ?? null;
  const invitable = friends.filter((f) => !open?.members.some((m) => m.id === f.id));

  const create = async () => {
    if (creating) return;
    setCreating(true);
    const res = await createGroupAction({ name: gName, memberIds: picked });
    setCreating(false);
    if (!res.ok) {
      toast(res.error ?? "Could not create group", "error");
      if (/guest|sign in/i.test(res.error ?? "")) router.push("/signin");
      return;
    }
    setGName("");
    setPicked([]);
    setShowCreate(false);
    toast("Group chat created 🎉");
    await loadAll();
    if (res.id) {
      setOpenId(res.id);
      setMessages([]);
    }
  };

  const invite = async (userId: string) => {
    if (!openId) return;
    const res = await inviteToGroupAction({ groupId: openId, userId });
    if (!res.ok) {
      toast(res.error ?? "Could not invite", "error");
      return;
    }
    toast("Invited to the group 🤝");
    await loadAll();
  };

  const leave = async () => {
    if (!openId) return;
    setAskLeave(false);
    const res = await leaveGroupAction(openId);
    if (!res.ok) {
      toast(res.error ?? "Could not leave", "error");
      return;
    }
    toast("Left the group");
    setOpenId(null);
    setMessages([]);
    await loadAll();
  };

  const remove = async () => {
    if (!openId) return;
    setAskDelete(false);
    const res = await deleteGroupAction(openId);
    if (!res.ok) {
      toast(res.error ?? "Could not delete", "error");
      return;
    }
    toast("Group deleted");
    setOpenId(null);
    setMessages([]);
    await loadAll();
  };

  const pickGImage = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Only image files work here.", "error");
      return;
    }
    if (file.size > 1_000_000) {
      toast("Image must be under ~1MB.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setGImage(String(reader.result ?? ""));
    reader.onerror = () => toast("Could not read that image.", "error");
    reader.readAsDataURL(file);
  };

  const send = async () => {
    const body = draft.trim();
    if ((!body && !gImage) || !openId || sending) return;
    setSending(true);
    const res = await sendGroupMessageAction({ groupId: openId, content: body, image: gImage });
    setSending(false);
    if (!res.ok) {
      toast(res.error ?? "Could not send", "error");
      return;
    }
    setDraft("");
    setGImage(null);
    await loadThread(openId);
    await loadAll();
  };

  if (loading) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  if (me.isGuest) {
    return (
      <Card className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink/70 dark:text-cream/70">
          Group chats are for members — sign in and add friends to start a GC.
        </p>
        <Button size="sm" onClick={() => router.push("/signin")}>
          Sign in
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      {/* Group list */}
      <div className="space-y-3">
        <Button onClick={() => setShowCreate(true)} className="w-full">
          <Plus size={15} /> New group chat
        </Button>
        <Card className="max-h-[52vh] space-y-1 overflow-auto p-3">
          {groups.length === 0 ? (
            <div className="p-3 text-center">
              <p className="text-sm font-bold text-ink dark:text-cream">No groups yet</p>
              <p className="mt-1 text-[13px] text-ink/55 dark:text-cream/55">
                Create a GC and invite your friends.
              </p>
            </div>
          ) : (
            groups.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  setOpenId(g.id);
                  setMessages([]);
                  setGImage(null);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-2xl p-2 text-left transition active:scale-[0.99]",
                  openId === g.id ? "bg-brand-100 dark:bg-brand-500/15" : "hover:bg-ink/[0.04] dark:hover:bg-cream/[0.06]"
                )}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-500 text-base font-extrabold text-ink">
                  {g.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-ink dark:text-cream">{g.name}</span>
                  <span className="block truncate text-[12px] text-ink/50 dark:text-cream/50">
                    {g.members.length} member{g.members.length === 1 ? "" : "s"}
                    {g.lastMessage ? ` · ${g.lastMessage}` : ""}
                  </span>
                </span>
              </button>
            ))
          )}
        </Card>
      </div>

      {/* Thread */}
      <Card className="flex max-h-[60vh] min-h-[320px] flex-col p-4">
        {!open ? (
          <div className="grid flex-1 place-items-center text-center">
            <div>
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink/5 text-ink/50 dark:bg-cream/10 dark:text-cream/50">
                <Users size={24} />
              </span>
              <p className="mt-2 text-sm font-bold text-ink dark:text-cream">Pick a group</p>
              <p className="mt-1 text-[13px] text-ink/55 dark:text-cream/55">Or create one and invite friends.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-ink/8 pb-3 dark:border-cream/10">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink dark:text-cream">{open.name}</p>
                <p className="truncate text-[11px] text-ink/50 dark:text-cream/50">
                  {open.members.map((m) => m.name.split(" ")[0]).join(", ")}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button variant="outline" size="sm" onClick={() => setShowInvite(true)}>
                  <UserPlus size={14} /> Invite
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setAskLeave(true)} className="text-red-500">
                  Leave
                </Button>
                {open.isOwner && (
                  <Button variant="ghost" size="sm" onClick={() => setAskDelete(true)} className="text-red-500" title="Delete group">
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-auto py-1">
              {messages.map((m) => (
                <div key={m.id} className={cn("flex gap-2", m.mine ? "justify-end" : "justify-start")}>
                  {!m.mine && <UserAvatar name={m.senderName} avatar={m.senderAvatar} size={28} />}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-snug",
                      m.mine
                        ? "rounded-br-md bg-brand-500 font-medium text-ink"
                        : "rounded-bl-md bg-ink/[0.05] text-ink/85 dark:bg-cream/10 dark:text-cream/85"
                    )}
                  >
                    {!m.mine && (
                      <p className="mb-0.5 text-[11px] font-bold text-brand-700 dark:text-brand-300">{m.senderName}</p>
                    )}
                    {m.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.image} alt="Attached" className="mb-1.5 max-h-48 rounded-xl object-cover" loading="lazy" />
                    )}
                    {m.content ? <p className="whitespace-pre-wrap break-words">{m.content}</p> : null}
                    <p className={cn("mt-0.5 text-right text-[10px]", m.mine ? "text-ink/55" : "text-ink/40 dark:text-cream/40")}>
                      {timeAgo(m.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            {gImage && (
              <div className="relative mt-2 w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={gImage} alt="Attached" className="max-h-28 rounded-xl border border-ink/10 object-cover dark:border-cream/15" />
                <button
                  onClick={() => setGImage(null)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white transition hover:bg-black/80"
                  aria-label="Remove image"
                >
                  <X size={11} />
                </button>
              </div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <input
                ref={gFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  pickGImage(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => gFileRef.current?.click()}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink/55 transition hover:bg-ink/5 active:scale-90 dark:text-cream/55 dark:hover:bg-cream/10"
                aria-label="Attach image"
                title="Attach image"
              >
                <ImagePlus size={17} />
              </button>
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Message ${open.name}…`}
                maxLength={1000}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                className="h-10"
              />
              <Button onClick={send} disabled={sending || (!draft.trim() && !gImage)} className="shrink-0">
                {sending ? <Spinner className="h-4 w-4 border-ink/30 border-t-ink" /> : <Send size={15} />}
              </Button>
            </div>
          </>
        )}
      </Card>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)}>
        <h3 className="font-display text-lg font-bold text-ink dark:text-cream">New group chat</h3>
        <div className="mt-4 space-y-4">
          <Field label="Group name">
            <Input value={gName} onChange={(e) => setGName(e.target.value)} placeholder="e.g. Bio 4A study GC" maxLength={60} />
          </Field>
          <Field label="Invite friends" hint="Only friends can be invited.">
            <div className="max-h-48 space-y-1 overflow-auto">
              {friends.length === 0 ? (
                <p className="text-[13px] text-ink/50 dark:text-cream/50">
                  No friends yet — add friends from the Feed first.
                </p>
              ) : (
                friends.map((f) => (
                  <label key={f.id} className="flex cursor-pointer items-center gap-2.5 rounded-xl p-1.5 transition hover:bg-ink/[0.04] dark:hover:bg-cream/[0.06]">
                    <input
                      type="checkbox"
                      checked={picked.includes(f.id)}
                      onChange={() =>
                        setPicked((p) => (p.includes(f.id) ? p.filter((x) => x !== f.id) : [...p, f.id]))
                      }
                      className="h-4 w-4 accent-[#96C51F]"
                    />
                    <UserAvatar name={f.name} avatar={f.avatar} size={30} />
                    <span className="text-[13px] font-bold text-ink dark:text-cream">{f.name}</span>
                  </label>
                ))
              )}
            </div>
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setShowCreate(false)}>
            Cancel
          </Button>
          <Button onClick={create} disabled={creating || gName.trim().length < 2 || !picked.length}>
            {creating ? <Spinner className="h-4 w-4 border-ink/30 border-t-ink" /> : <Plus size={15} />}
            Create GC
          </Button>
        </div>
      </Modal>

      {/* Invite modal */}
      <Modal open={showInvite} onClose={() => setShowInvite(false)}>
        <h3 className="font-display text-lg font-bold text-ink dark:text-cream">Invite to {open?.name ?? "group"}</h3>
        <div className="mt-4 max-h-64 space-y-1 overflow-auto">
          {invitable.length === 0 ? (
            <p className="text-[13px] text-ink/50 dark:text-cream/50">All your friends are already here 🎉</p>
          ) : (
            invitable.map((f) => (
              <div key={f.id} className="flex items-center gap-2.5 rounded-xl p-1.5">
                <UserAvatar name={f.name} avatar={f.avatar} size={32} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink dark:text-cream">{f.name}</span>
                <Button size="sm" variant="outline" onClick={() => invite(f.id)}>
                  <UserPlus size={14} /> Invite
                </Button>
              </div>
            ))
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={() => setShowInvite(false)}>
            Done
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={askLeave}
        title={`Leave ${open?.name ?? "group"}?`}
        message="You'll stop receiving its messages. The group stays for everyone else."
        confirmLabel="Leave"
        danger
        onCancel={() => setAskLeave(false)}
        onConfirm={leave}
      />
      <ConfirmDialog
        open={askDelete}
        title={`Delete ${open?.name ?? "group"}?`}
        message="All messages disappear for everyone. This can't be undone."
        confirmLabel="Delete"
        danger
        onCancel={() => setAskDelete(false)}
        onConfirm={remove}
      />
    </div>
  );
}

/* ============================ friend chats ============================ */type ChatsData = NonNullable<Awaited<ReturnType<typeof getChatsData>>>;
type ChatItem = ChatsData["chats"][number];
type ChatMessage = { id: string; mine: boolean; content: string; image: string | null; read: boolean; createdAt: string };

function ChatsTab({ me }: { me: CommunityData["me"] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [chatImage, setChatImage] = useState<string | null>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [friendTyping, setFriendTyping] = useState(false);

  const loadChats = useCallback(async () => {
    const d = await getChatsData();
    if (d) setChats(d.chats);
    setLoading(false);
  }, []);

  const loadThread = useCallback(
    async (friendId: string) => {
      const res = await getConversationAction(friendId);
      if (!res.ok) {
        toast(res.error ?? "Could not open chat", "error");
        return;
      }
      setMessages(res.messages);
    },
    [toast]
  );

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Poll the open thread + list so chats feel live.
  useEffect(() => {
    if (!openId) return;
    loadThread(openId);
    const t = setInterval(() => {
      loadThread(openId);
      loadChats();
    }, 5000);
    return () => clearInterval(t);
  }, [openId, loadThread, loadChats]);

  // Poll typing indicator for the open conversation.
  useEffect(() => {
    if (!openId) { setFriendTyping(false); return; }
    let active = true;
    const check = async () => {
      const res = await getTypingAction(openId);
      if (active && res.ok) setFriendTyping(res.typing);
    };
    check();
    const t = setInterval(check, 3000);
    return () => { active = false; clearInterval(t); };
  }, [openId]);

  // Ping typing when the user types in the draft box.
  const pingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleDraftChange = (val: string) => {
    setDraft(val);
    if (openId && val.trim()) {
      if (pingTimerRef.current) clearTimeout(pingTimerRef.current);
      pingTimerRef.current = setTimeout(() => { pingTypingAction(openId); }, 300);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, openId]);

  const openChat = (id: string) => {
    setOpenId(id);
    setMessages([]);
    setChatImage(null);
  };

  const pickChatImage = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Only image files work here.", "error");
      return;
    }
    if (file.size > 1_000_000) {
      toast("Image must be under ~1MB.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setChatImage(String(reader.result ?? ""));
    reader.onerror = () => toast("Could not read that image.", "error");
    reader.readAsDataURL(file);
  };

  const send = async () => {
    const body = draft.trim();
    if ((!body && !chatImage) || !openId || sending) return;
    setSending(true);
    const res = await sendMessageAction({ friendId: openId, content: body, image: chatImage });
    setSending(false);
    if (!res.ok) {
      toast(res.error ?? "Could not send", "error");
      if (/guest|sign in/i.test(res.error ?? "")) router.push("/signin");
      return;
    }
    setDraft("");
    setChatImage(null);
    await loadThread(openId);
    await loadChats();
  };

  const open = chats.find((c) => c.id === openId) ?? null;

  if (loading) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  if (me.isGuest) {
    return (
      <Card className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink/70 dark:text-cream/70">
          Chats are for members — create a free account and add friends to start chatting.
        </p>
        <Button size="sm" onClick={() => router.push("/signin")}>
          Sign in
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      {/* Conversation list */}
      <Card className="max-h-[60vh] space-y-1 overflow-auto p-3">
        {chats.length === 0 ? (
          <div className="p-3 text-center">
            <p className="text-sm font-bold text-ink dark:text-cream">No chats yet</p>
            <p className="mt-1 text-[13px] text-ink/55 dark:text-cream/55">
              Add friends from the Feed → Discover people, then chat here.
            </p>
          </div>
        ) : (
          chats.map((c) => (
            <button
              key={c.id}
              onClick={() => openChat(c.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-2xl p-2 text-left transition active:scale-[0.99]",
                openId === c.id ? "bg-brand-100 dark:bg-brand-500/15" : "hover:bg-ink/[0.04] dark:hover:bg-cream/[0.06]"
              )}
            >
              <span className="relative inline-flex shrink-0">
                <UserAvatar name={c.name} avatar={c.avatar} size={40} />
                <span
                  title={c.online ? "Online" : "Offline"}
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-surface dark:border-surface-dark",
                    c.online ? "bg-green-500" : "bg-ink/25 dark:bg-cream/30"
                  )}
                  style={{ width: 12, height: 12 }}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-bold text-ink dark:text-cream">{c.name}</span>
                  {c.unread > 0 && (
                    <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand-500 px-1 text-[11px] font-extrabold text-ink">
                      {c.unread}
                    </span>
                  )}
                </span>
                <span className="block truncate text-[12px] text-ink/50 dark:text-cream/50">
                  {c.lastMessage ? `${c.lastMine ? "You: " : ""}${c.lastMessage}` : "Say hi 👋"}
                </span>
              </span>
            </button>
          ))
        )}
      </Card>

      {/* Thread */}
      <Card className="flex max-h-[60vh] min-h-[320px] flex-col p-4">
        {!open ? (
          <div className="grid flex-1 place-items-center text-center">
            <div>
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink/5 text-ink/50 dark:bg-cream/10 dark:text-cream/50">
                <MessageCircle size={24} />
              </span>
              <p className="mt-2 text-sm font-bold text-ink dark:text-cream">Pick a conversation</p>
              <p className="mt-1 text-[13px] text-ink/55 dark:text-cream/55">Only friends can message each other.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2.5 border-b border-ink/8 pb-3 dark:border-cream/10">
              <UserAvatar name={open.name} avatar={open.avatar} size={34} />
              <div>
                <p className="flex items-center gap-1.5 text-sm font-bold text-ink dark:text-cream">
                  {open.name}
                  {open.online && <span className="inline-block h-2 w-2 rounded-full bg-green-500" />}
                </p>
                <p className={cn("text-[11px]", open.online ? "text-green-600 dark:text-green-400" : "text-ink/45 dark:text-cream/45")}>
                  {open.online ? "Active now" : "Offline"}
                </p>
              </div>
            </div>
            <div className="flex-1 space-y-0.5 overflow-auto py-1">
              {messages.map((m, i) => {
                const prevSame = i > 0 && messages[i - 1].mine === m.mine;
                return (
                  <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start", prevSame && "mt-0.5")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-snug",
                        m.mine
                          ? "rounded-br-md bg-brand-500 font-medium text-ink"
                          : "rounded-bl-md bg-ink/[0.05] text-ink/85 dark:bg-cream/10 dark:text-cream/85"
                      )}
                    >
                      {m.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.image} alt="Attached" className="mb-1.5 max-h-48 rounded-xl object-cover" loading="lazy" />
                      )}
                      {m.content ? <p className="whitespace-pre-wrap break-words">{m.content}</p> : null}
                      {!prevSame && (
                        <p className={cn("mt-0.5 flex items-center justify-end gap-1 text-[10px]", m.mine ? "text-ink/55" : "text-ink/40 dark:text-cream/40")}>
                          {timeAgo(m.createdAt)}
                          {m.mine && (
                            m.read
                              ? <CheckCheck size={12} className="text-brand-600 dark:text-brand-400" />
                              : <Check size={12} className="text-ink/40 dark:text-cream/40" />
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              {friendTyping && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md bg-ink/[0.05] px-3.5 py-2.5 dark:bg-cream/10">
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-ink/40 [animation-delay:0ms] dark:bg-cream/40" />
                      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-ink/40 [animation-delay:150ms] dark:bg-cream/40" />
                      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-ink/40 [animation-delay:300ms] dark:bg-cream/40" />
                    </span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            {chatImage && (
              <div className="relative mt-2 w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={chatImage} alt="Attached" className="max-h-28 rounded-xl border border-ink/10 object-cover dark:border-cream/15" />
                <button
                  onClick={() => setChatImage(null)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white transition hover:bg-black/80"
                  aria-label="Remove image"
                >
                  <X size={11} />
                </button>
              </div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <input
                ref={chatFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  pickChatImage(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => chatFileRef.current?.click()}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink/55 transition hover:bg-ink/5 active:scale-90 dark:text-cream/55 dark:hover:bg-cream/10"
                aria-label="Attach image"
                title="Attach image"
              >
                <ImagePlus size={17} />
              </button>
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Message ${open.name}…`}
                maxLength={1000}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                className="h-10"
              />
              <Button onClick={send} disabled={sending || (!draft.trim() && !chatImage)} className="shrink-0">
                {sending ? <Spinner className="h-4 w-4 border-ink/30 border-t-ink" /> : <Send size={15} />}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

/* ============================== composer ============================== */

function Composer({
  me,
  onPosted,
  onError,
}: {
  me: CommunityData["me"];
  onPosted: () => Promise<void>;
  onError: (error?: string) => void;
}) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickImage = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Only image files work here.", "error");
      return;
    }
    if (file.size > 1_000_000) {
      toast("Image must be under ~1MB.", "error");
      return;
    }
    setImgBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      setImage(String(reader.result ?? ""));
      setImgBusy(false);
    };
    reader.onerror = () => {
      setImgBusy(false);
      toast("Could not read that image.", "error");
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    const res = await createPostAction(body, image);
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Could not post", "error");
      onError(res.error);
      return;
    }
    setText("");
    setImage(null);
    toast("Posted to the community 🎉");
    await onPosted();
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-3">
        <UserAvatar name={me.name} avatar={me.avatar} size={40} />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink dark:text-cream">{me.name}</p>
          <p className="text-[12px] text-ink/50 dark:text-cream/50">
            {me.isAdmin ? "Posting as admin" : "Share with the community"}
          </p>
        </div>
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What's on your mind? Share an update, ask a question…"
        rows={3}
        maxLength={2000}
      />
      {image && (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="Attached" className="max-h-48 rounded-2xl border border-ink/10 object-cover dark:border-cream/15" />
          <button
            onClick={() => setImage(null)}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white transition hover:bg-black/80 active:scale-90"
            aria-label="Remove image"
          >
            <X size={13} />
          </button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              pickImage(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={imgBusy || !!image}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-ink/60 transition hover:bg-ink/5 active:scale-95 disabled:opacity-50 dark:text-cream/60 dark:hover:bg-cream/10"
          >
            {imgBusy ? <Spinner className="h-4 w-4" /> : <ImagePlus size={16} />}
            Photo
          </button>
          <span className="text-[11px] text-ink/40 dark:text-cream/40">{text.length}/2000</span>
        </div>
        <Button onClick={submit} disabled={busy || imgBusy || !text.trim()}>
          {busy ? <Spinner className="border-ink/30 border-t-ink" /> : <Send size={15} />}
          Post
        </Button>
      </div>
    </Card>
  );
}

/* ============================== post card ============================== */

function PostCard({
  post,
  me,
  emojis,
  canParticipate,
  onOpenProfile,
  onChanged,
  onError,
}: {
  post: PostItem;
  me: CommunityData["me"];
  emojis: string[];
  canParticipate: boolean;
  onOpenProfile: (id: string) => void;
  onChanged: () => Promise<void>;
  onError: (error?: string) => void;
}) {
  const { toast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState(false);

  const react = async (emoji: string) => {
    if (!canParticipate) {
      toast("You can't react right now.", "error");
      return;
    }
    setPickerOpen(false);
    const res = await reactToPostAction({ postId: post.id, emoji });
    if (!res.ok) {
      toast(res.error ?? "Could not react", "error");
      onError(res.error);
      return;
    }
    await onChanged();
  };

  const submitComment = async () => {
    const body = commentText.trim();
    if (!body) return;
    setBusy(true);
    const res = await addCommentAction({ postId: post.id, content: body });
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Could not comment", "error");
      onError(res.error);
      return;
    }
    setCommentText("");
    await onChanged();
  };

  const removePost = async () => {
    setAskDelete(false);
    setBusy(true);
    const res = await deletePostAction(post.id);
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Could not delete", "error");
      return;
    }
    toast("Post deleted");
    await onChanged();
  };

  const togglePin = async () => {
    const res = await togglePinPostAction(post.id);
    if (!res.ok) {
      toast(res.error ?? "Could not pin", "error");
      return;
    }
    toast(res.pinned ? "Pinned as announcement 📌" : "Unpinned");
    await onChanged();
  };

  const removeComment = async (commentId: string) => {
    const res = await deleteCommentAction(commentId);
    if (!res.ok) {
      toast(res.error ?? "Could not delete comment", "error");
      return;
    }
    await onChanged();
  };

  const reactionEntries = Object.entries(post.reactions).filter(([, n]) => n > 0);
  const totalReactions = reactionEntries.reduce((acc, [, n]) => acc + n, 0);

  return (
    <Card className={cn("space-y-3", post.pinned && "ring-2 ring-brand-400/60")}>
      {post.pinned && (
        <div className="flex items-center gap-1.5 text-[12px] font-bold text-brand-700 dark:text-brand-300">
          <Megaphone size={13} /> Pinned announcement
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3">
        <PresenceAvatar person={post.author} size={42} onClick={() => onOpenProfile(post.author.id)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button
              onClick={() => onOpenProfile(post.author.id)}
              className="text-sm font-bold text-ink hover:underline dark:text-cream"
            >
              {post.author.name}
            </button>
            <RoleBadge author={post.author} />
          </div>
          <p className="text-[12px] text-ink/45 dark:text-cream/45">{timeAgo(post.createdAt)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {me.isAdmin && (
            <button
              onClick={togglePin}
              title={post.pinned ? "Unpin" : "Pin as announcement"}
              className={cn(
                "rounded-full p-1.5 transition hover:bg-ink/5 dark:hover:bg-cream/10",
                post.pinned ? "text-brand-600 dark:text-brand-400" : "text-ink/35 dark:text-cream/35"
              )}
            >
              <Pin size={15} />
            </button>
          )}
          {post.canDelete && (
            <button
              onClick={() => setAskDelete(true)}
              title="Delete post"
              className="rounded-full p-1.5 text-ink/35 transition hover:bg-red-50 hover:text-red-500 active:scale-90 dark:text-cream/35 dark:hover:bg-red-500/10"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink/85 dark:text-cream/85">
        {post.content}
      </p>
      {post.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.image}
          alt="Post attachment"
          className="max-h-96 w-full rounded-2xl border border-ink/10 object-cover dark:border-cream/15"
          loading="lazy"
        />
      )}
      <ConfirmDialog
        open={askDelete}
        title="Delete this post?"
        message="The post, its reactions and all comments will be removed. This can't be undone."
        confirmLabel="Delete"
        danger
        busy={busy}
        onCancel={() => setAskDelete(false)}
        onConfirm={removePost}
      />

      {/* Reaction summary */}
      {totalReactions > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {reactionEntries.map(([emoji, n]) => (
            <button
              key={emoji}
              onClick={() => react(emoji)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[12px] transition",
                post.myReaction === emoji
                  ? "border-brand-400 bg-brand-100 dark:border-brand-500/50 dark:bg-brand-500/20"
                  : "border-ink/10 bg-ink/[0.03] hover:bg-ink/[0.06] dark:border-cream/10 dark:bg-cream/5 dark:hover:bg-cream/10"
              )}
            >
              <span>{emoji}</span>
              <span className="font-semibold text-ink/60 dark:text-cream/60">{n}</span>
            </button>
          ))}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-1 border-t border-ink/8 pt-2 dark:border-cream/10">
        <div className="relative">
          <button
            onClick={() => setPickerOpen((v) => !v)}
            disabled={!canParticipate}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition",
              post.myReaction
                ? "text-brand-700 dark:text-brand-300"
                : "text-ink/60 hover:bg-ink/5 dark:text-cream/60 dark:hover:bg-cream/10",
              !canParticipate && "cursor-not-allowed opacity-50"
            )}
          >
            {post.myReaction ? <span className="text-base leading-none">{post.myReaction}</span> : <Smile size={16} />}
            React
          </button>
          {pickerOpen && (
            <>
              <button className="fixed inset-0 z-10 cursor-default" onClick={() => setPickerOpen(false)} aria-hidden />
              <div className="absolute bottom-full left-0 z-20 mb-1.5 flex gap-0.5 rounded-full border border-ink/10 bg-surface p-1 shadow-lg dark:border-cream/15 dark:bg-surface-dark">
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => react(emoji)}
                    className={cn(
                      "grid h-7 w-7 place-items-center rounded-full text-base transition hover:scale-125 hover:bg-ink/5 dark:hover:bg-cream/10",
                      post.myReaction === emoji && "bg-brand-100 dark:bg-brand-500/20"
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button
          onClick={() => setShowComments((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-ink/60 transition hover:bg-ink/5 dark:text-cream/60 dark:hover:bg-cream/10"
        >
          <MessageCircle size={16} />
          {post.comments.length > 0 ? `${post.comments.length} comment${post.comments.length === 1 ? "" : "s"}` : "Comment"}
        </button>
      </div>

      {/* Comments */}
      {(showComments || post.comments.length > 0) && (
        <div className="space-y-3 border-t border-ink/8 pt-3 dark:border-cream/10">
          {post.comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2.5">
              <PresenceAvatar person={c.author} size={30} onClick={() => onOpenProfile(c.author.id)} />
              <div className="min-w-0 flex-1">
                <div className="group inline-block max-w-full rounded-2xl bg-ink/[0.04] px-3 py-2 dark:bg-cream/[0.06]">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onOpenProfile(c.author.id)}
                      className="text-[13px] font-bold text-ink hover:underline dark:text-cream"
                    >
                      {c.author.name}
                    </button>
                    {c.author.isAdmin && <Shield size={11} className="text-violet-500" />}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-[13.5px] leading-snug text-ink/80 dark:text-cream/80">
                    {c.content}
                  </p>
                </div>
                <div className="mt-0.5 flex items-center gap-2 pl-1">
                  <span className="text-[11px] text-ink/40 dark:text-cream/40">{timeAgo(c.createdAt)}</span>
                  {c.canDelete && (
                    <button
                      onClick={() => removeComment(c.id)}
                      className="text-[11px] font-semibold text-ink/40 transition hover:text-red-500 dark:text-cream/40"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {canParticipate && (
            <div className="flex items-center gap-2">
              <UserAvatar name={me.name} avatar={me.avatar} size={30} />
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment…"
                maxLength={1000}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitComment();
                  }
                }}
                className="h-10"
              />
              <Button size="sm" variant="soft" onClick={submitComment} disabled={busy || !commentText.trim()}>
                {busy ? <Spinner className="h-4 w-4" /> : <Send size={14} />}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ============================ friends sidebar ============================ */

function FriendsSidebar({
  data,
  onOpenProfile,
  onChanged,
  onError,
}: {
  data: CommunityData;
  onOpenProfile: (id: string) => void;
  onChanged: () => Promise<void>;
  onError: (error?: string) => void;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const respond = async (requesterId: string, accept: boolean) => {
    setBusyId(requesterId);
    const res = await respondFriendRequestAction({ requesterId, accept });
    setBusyId(null);
    if (!res.ok) {
      toast(res.error ?? "Could not respond", "error");
      onError(res.error);
      return;
    }
    toast(accept ? "Friend added 🤝" : "Request declined");
    await onChanged();
  };

  const addFriend = async (person: PersonItem) => {
    setBusyId(person.id);
    const res = await sendFriendRequestAction(person.id);
    setBusyId(null);
    if (!res.ok) {
      toast(res.error ?? "Could not send request", "error");
      onError(res.error);
      return;
    }
    toast(res.status === "friends" ? "Friend added 🤝" : "Friend request sent");
    await onChanged();
  };

  const cancelOrRemove = async (personId: string) => {
    setBusyId(personId);
    const res = await removeFriendAction(personId);
    setBusyId(null);
    if (!res.ok) {
      toast(res.error ?? "Could not update", "error");
      return;
    }
    await onChanged();
  };

  const q = search.trim().toLowerCase();
  const filteredPeople = q
    ? data.people.filter((p) => p.name.toLowerCase().includes(q))
    : data.people.filter((p) => p.friendState === "none").slice(0, 6);

  return (
    <>
      {/* Presence summary */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={17} className="text-ink/60 dark:text-cream/60" />
            <h3 className="text-sm font-bold text-ink dark:text-cream">Community</h3>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-[12px] font-bold text-green-700 dark:bg-green-500/20 dark:text-green-300">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            {data.onlineCount} online
          </span>
        </div>
      </Card>

      {/* Incoming requests */}
      {data.incoming.length > 0 && (
        <Card className="space-y-3 p-4">
          <h3 className="text-[13px] font-bold uppercase tracking-wide text-ink/50 dark:text-cream/50">
            Friend requests ({data.incoming.length})
          </h3>
          {data.incoming.map((req) => (
            <div key={req.id} className="flex items-center gap-2.5">
              <PresenceAvatar person={req} size={36} onClick={() => onOpenProfile(req.id)} />
              <button onClick={() => onOpenProfile(req.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-[13px] font-bold text-ink hover:underline dark:text-cream">{req.name}</p>
                <p className="text-[11px] text-ink/45 dark:text-cream/45">wants to be friends</p>
              </button>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => respond(req.id, true)}
                  disabled={busyId === req.id}
                  title="Accept"
                  className="grid h-8 w-8 place-items-center rounded-full bg-brand-500 text-ink transition hover:bg-brand-400 active:scale-95"
                >
                  {busyId === req.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />}
                </button>
                <button
                  onClick={() => respond(req.id, false)}
                  disabled={busyId === req.id}
                  title="Decline"
                  className="grid h-8 w-8 place-items-center rounded-full bg-ink/5 text-ink/60 transition hover:bg-ink/10 active:scale-95 dark:bg-cream/10 dark:text-cream/60"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Friends */}
      <Card className="space-y-3 p-4">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-ink/50 dark:text-cream/50">
          Friends ({data.friends.length})
        </h3>
        {data.friends.length === 0 ? (
          <p className="text-[13px] text-ink/50 dark:text-cream/50">
            No friends yet — add people from the discover list below.
          </p>
        ) : (
          data.friends.map((f) => (
            <button
              key={f.id}
              onClick={() => onOpenProfile(f.id)}
              className="flex w-full items-center gap-2.5 rounded-xl p-1 text-left transition hover:bg-ink/[0.03] dark:hover:bg-cream/5"
            >
              <PresenceAvatar person={f} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-ink dark:text-cream">{f.name}</p>
                <p className={cn("text-[11px]", f.online ? "text-green-600 dark:text-green-400" : "text-ink/45 dark:text-cream/45")}>
                  {f.online ? "Active now" : "Offline"}
                </p>
              </div>
              {f.isAdmin && <Shield size={13} className="shrink-0 text-violet-500" />}
            </button>
          ))
        )}
      </Card>

      {/* Discover people */}
      <Card className="space-y-3 p-4">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-ink/50 dark:text-cream/50">Discover people</h3>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 dark:text-cream/40" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members…"
            className="h-9 pl-9"
          />
        </div>
        {filteredPeople.length === 0 ? (
          <p className="text-[13px] text-ink/50 dark:text-cream/50">
            {q ? "No members match that search." : "You've connected with everyone here!"}
          </p>
        ) : (
          filteredPeople.map((p) => (
            <div key={p.id} className="flex items-center gap-2.5">
              <PresenceAvatar person={p} size={36} onClick={() => onOpenProfile(p.id)} />
              <button onClick={() => onOpenProfile(p.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-[13px] font-bold text-ink hover:underline dark:text-cream">{p.name}</p>
                <p className="text-[11px] capitalize text-ink/45 dark:text-cream/45">
                  {p.isAdmin ? "Admin" : p.role ?? "Member"}
                </p>
              </button>
              <PersonAction person={p} busy={busyId === p.id} onAdd={() => addFriend(p)} onCancel={() => cancelOrRemove(p.id)} onAccept={() => respond(p.id, true)} />
            </div>
          ))
        )}
      </Card>
    </>
  );
}

function PersonAction({
  person,
  busy,
  onAdd,
  onCancel,
  onAccept,
}: {
  person: PersonItem;
  busy: boolean;
  onAdd: () => void;
  onCancel: () => void;
  onAccept: () => void;
}) {
  if (busy)
    return (
      <span className="grid h-8 w-8 place-items-center">
        <Loader2 size={15} className="animate-spin text-ink/40 dark:text-cream/40" />
      </span>
    );
  if (person.friendState === "friends")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-[12px] font-bold text-ink dark:bg-brand-500/20 dark:text-brand-300">
        <Check size={13} /> Friends
      </span>
    );
  if (person.friendState === "outgoing")
    return (
      <button
        onClick={onCancel}
        title="Cancel request"
        className="rounded-full bg-ink/5 px-2.5 py-1 text-[12px] font-bold text-ink/55 transition hover:bg-ink/10 dark:bg-cream/10 dark:text-cream/55"
      >
        Requested
      </button>
    );
  if (person.friendState === "incoming")
    return (
      <button
        onClick={onAccept}
        className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-2.5 py-1 text-[12px] font-bold text-ink transition hover:bg-brand-400"
      >
        <Check size={13} /> Accept
      </button>
    );
  return (
    <button
      onClick={onAdd}
      title="Add friend"
      className="grid h-8 w-8 place-items-center rounded-full bg-ink/5 text-ink/70 transition hover:bg-brand-500 hover:text-ink active:scale-95 dark:bg-cream/10 dark:text-cream/70"
    >
      <UserPlus size={15} />
    </button>
  );
}

/* ========================= profile preview modal ========================= */

function ProfilePreviewModal({
  userId,
  onClose,
  onChanged,
}: {
  userId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<null | { kind: "promote" | "remove" | "unfriend"; name: string }>(null);

  const load = useCallback(async () => {
    const p = await getProfilePreviewAction(userId);
    setPreview(p);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const act = async (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Something went wrong", "error");
      return;
    }
    if (okMsg) toast(okMsg);
    await load();
    await onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade" onClick={onClose} />
      <div className="animate-pop relative z-10 my-auto w-full max-w-md overflow-hidden rounded-3xl border border-ink/10 bg-surface shadow-2xl dark:border-cream/10 dark:bg-surface-dark">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/20 p-1.5 text-white/90 transition hover:bg-black/40"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {loading || !preview ? (
          <div className="grid h-64 place-items-center">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <>
            {/* Banner */}
            <div className={cn("h-24 bg-gradient-to-br", bannerClass(preview.banner))} />

            <div className="px-6 pb-6">
              {/* Avatar overlapping banner */}
              <div className="-mt-10 mb-3 flex items-end justify-between">
                <div className="rounded-full ring-4 ring-surface dark:ring-surface-dark">
                  <PresenceAvatar person={preview} size={72} />
                </div>
                {!preview.isSelf && <FriendActionButton preview={preview} busy={busy} act={act} />}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-ink dark:text-cream">{preview.name}</h2>
                <RoleBadge author={preview} />
                {preview.isSelf && <Badge tone="neutral">You</Badge>}
                {preview.muted && (
                  <Badge tone="red" className="gap-1">
                    <VolumeX size={11} /> Muted
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-[13px] font-medium text-ink/50 dark:text-cream/50">
                {preview.online ? (
                  <span className="text-green-600 dark:text-green-400">● Active now</span>
                ) : (
                  "● Offline"
                )}
              </p>

              {preview.bio && (
                <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-ink/75 dark:text-cream/75">
                  {preview.bio}
                </p>
              )}

              {/* Details */}
              <div className="mt-3 space-y-1.5 text-[13px] text-ink/70 dark:text-cream/70">
                {(preview.course || preview.yearLevel) && (
                  <p className="flex items-center gap-1.5">
                    <span className="text-ink/40 dark:text-cream/40">🎓</span>
                    {[preview.course, preview.yearLevel].filter(Boolean).join(" · ")}
                  </p>
                )}
                {preview.institution && (
                  <p className="flex items-center gap-1.5">
                    <span className="text-ink/40 dark:text-cream/40">🏫</span>
                    {preview.institution}
                  </p>
                )}
                <p className="flex items-center gap-1.5">
                  <span className="text-ink/40 dark:text-cream/40">📅</span>
                  Joined {new Date(preview.memberSince).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </p>
              </div>

              {/* Stats */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-ink/[0.03] py-2.5 text-center dark:bg-cream/5">
                  <p className="text-lg font-bold text-ink dark:text-cream">{preview.postCount}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/45 dark:text-cream/45">Posts</p>
                </div>
                <div className="rounded-2xl bg-ink/[0.03] py-2.5 text-center dark:bg-cream/5">
                  <p className="text-lg font-bold text-ink dark:text-cream">{preview.friendCount}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/45 dark:text-cream/45">Friends</p>
                </div>
              </div>

              {/* Admin moderation */}
              {preview.viewerIsAdmin && !preview.isSelf && (
                <div className="mt-4 space-y-2 rounded-2xl border border-violet-500/20 bg-violet-50/50 p-3 dark:bg-violet-500/10">
                  <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                    <Shield size={12} /> Admin controls
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => act(() => setUserMutedAction({ userId: preview.id, muted: !preview.muted }), preview.muted ? "Member unmuted" : "Member muted")}
                    >
                      <VolumeX size={14} /> {preview.muted ? "Unmute" : "Mute"}
                    </Button>
                    {!preview.isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setAsk({ kind: "promote", name: preview.name })}
                      >
                        <Crown size={14} /> Promote
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={() => setAsk({ kind: "remove", name: preview.name })}
                    >
                      <UserMinus size={14} /> Remove
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <ConfirmDialog
              open={ask !== null}
              title={
                ask?.kind === "promote"
                  ? `Promote ${ask?.name ?? "this member"} to admin?`
                  : ask?.kind === "remove"
                    ? `Remove ${ask?.name ?? "this member"}?`
                    : `Remove ${ask?.name ?? "this friend"}?`
              }
              message={
                ask?.kind === "promote"
                  ? "They'll gain moderation powers: pin, mute, promote and remove."
                  : ask?.kind === "remove"
                    ? "This deletes all their posts, comments and reactions, and mutes them. This can't be undone."
                    : "You won't see each other in friends anymore. You can add them back later."
              }
              confirmLabel={ask?.kind === "promote" ? "Promote" : "Remove"}
              danger={ask?.kind !== "promote"}
              busy={busy}
              onCancel={() => setAsk(null)}
              onConfirm={() => {
                if (!preview || !ask) return;
                if (ask.kind === "promote") {
                  setAsk(null);
                  act(() => promoteToAdminAction(preview.id), "Promoted to admin 👑");
                } else if (ask.kind === "remove") {
                  setAsk(null);
                  act(() => removeMemberAction(preview.id), "Member removed");
                } else {
                  setAsk(null);
                  act(() => removeFriendAction(preview.id), "Friend removed");
                }
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

function FriendActionButton({
  preview,
  busy,
  act,
}: {
  preview: Preview;
  busy: boolean;
  act: (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) => Promise<void>;
}) {
  const [askUnfriend, setAskUnfriend] = useState(false);
  if (preview.friendState === "friends")
    return (
      <>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => setAskUnfriend(true)}
        >
          <Check size={14} /> Friends
        </Button>
        <ConfirmDialog
          open={askUnfriend}
          title={`Remove ${preview.name}?`}
          message="You won't see each other in friends anymore. You can add them back later."
          confirmLabel="Remove"
          danger
          busy={busy}
          onCancel={() => setAskUnfriend(false)}
          onConfirm={() => {
            setAskUnfriend(false);
            act(() => removeFriendAction(preview.id), "Friend removed");
          }}
        />
      </>
    );
  if (preview.friendState === "outgoing")
    return (
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => removeFriendAction(preview.id), "Request cancelled")}>
        Requested
      </Button>
    );
  if (preview.friendState === "incoming")
    return (
      <Button
        size="sm"
        disabled={busy}
        onClick={() => act(() => respondFriendRequestAction({ requesterId: preview.id, accept: true }), "Friend added 🤝")}
      >
        <Check size={14} /> Accept
      </Button>
    );
  return (
    <Button size="sm" disabled={busy} onClick={() => act(() => sendFriendRequestAction(preview.id), "Friend request sent")}>
      <UserPlus size={14} /> Add friend
    </Button>
  );
}
