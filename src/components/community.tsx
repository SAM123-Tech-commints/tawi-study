"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Crown,
  Loader2,
  Megaphone,
  MessageCircle,
  Pin,
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
  createPostAction,
  deleteCommentAction,
  deletePostAction,
  getCommunityData,
  getProfilePreviewAction,
  heartbeatAction,
  promoteToAdminAction,
  reactToPostAction,
  removeFriendAction,
  removeMemberAction,
  respondFriendRequestAction,
  sendFriendRequestAction,
  setUserMutedAction,
  togglePinPostAction,
} from "@/lib/actions";
import { Avatar, Badge, Button, Card, cn, EmptyState, Input, Spinner, Textarea, useToast } from "@/components/ui";

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
        🎓 Educator
      </Badge>
    );
  return null;
}

/* ============================ main component ============================ */

export default function Community() {
  const router = useRouter();
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

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    const res = await createPostAction(body);
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Could not post", "error");
      onError(res.error);
      return;
    }
    setText("");
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
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-ink/40 dark:text-cream/40">{text.length}/2000</span>
        <Button onClick={submit} disabled={busy || !text.trim()}>
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
    if (!confirm("Delete this post? This can't be undone.")) return;
    const res = await deletePostAction(post.id);
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
              onClick={removePost}
              title="Delete post"
              className="rounded-full p-1.5 text-ink/35 transition hover:bg-red-50 hover:text-red-500 dark:text-cream/35 dark:hover:bg-red-500/10"
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

      {/* Reaction summary */}
      {totalReactions > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {reactionEntries.map(([emoji, n]) => (
            <button
              key={emoji}
              onClick={() => react(emoji)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[13px] transition",
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
                      "grid h-9 w-9 place-items-center rounded-full text-xl transition hover:scale-125 hover:bg-ink/5 dark:hover:bg-cream/10",
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
                className="h-9"
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
                        onClick={() => {
                          if (confirm(`Promote ${preview.name} to admin? They'll gain moderation powers.`))
                            act(() => promoteToAdminAction(preview.id), "Promoted to admin 👑");
                        }}
                      >
                        <Crown size={14} /> Promote
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={() => {
                        if (confirm(`Remove ${preview.name} from the community? This deletes all their posts, comments and reactions, and mutes them.`))
                          act(() => removeMemberAction(preview.id), "Member removed");
                      }}
                    >
                      <UserMinus size={14} /> Remove
                    </Button>
                  </div>
                </div>
              )}
            </div>
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
  if (preview.friendState === "friends")
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => {
          if (confirm(`Remove ${preview.name} from your friends?`)) act(() => removeFriendAction(preview.id), "Friend removed");
        }}
      >
        <Check size={14} /> Friends
      </Button>
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
