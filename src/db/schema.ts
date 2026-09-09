import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  integer,
  boolean,
  real,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  role: text("role"), // student | educator
  institution: text("institution"),
  avatar: text("avatar"), // base64 data URL or null
  settings: jsonb("settings"), // { theme, timerWork, timerBreak, timerLongBreak, timerRounds, language, timerEnabled }
  apiKey: text("api_key"), // for external AI services
  // --- Community / social profile ---
  bio: text("bio"), // short "about me" shown on the profile preview card
  course: text("course"), // e.g. "BSIT"
  yearLevel: text("year_level"), // e.g. "2nd year"
  banner: text("banner"), // accent id for the profile cover banner (lime|violet|sky|amber|rose)
  appearOffline: boolean("appear_offline").notNull().default(false),
  lastSeen: timestamp("last_seen", { withTimezone: true }), // presence heartbeat
  muted: boolean("muted").notNull().default(false), // admin-muted from the community
  isGuest: boolean("is_guest").notNull().default(false),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ============================== COMMUNITY ============================== */

/** A post in the shared community feed. Any member can author one. */
export const communityPosts = pgTable("community_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  content: text("content").notNull(),
  image: text("image"), // base64 data URL or null (max ~1MB)
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One reaction per member per post (Messenger-style — emoji can be changed). */
export const communityReactions = pgTable("community_reactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id").notNull(),
  userId: uuid("user_id").notNull(),
  emoji: text("emoji").notNull(), // 👍 ❤️ 😂 😮 😢 👏
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A comment on a community post. */
export const communityComments = pgTable("community_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id").notNull(),
  userId: uuid("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Friendship / friend-request edge. status: pending | accepted. */
export const friendships = pgTable("friendships", {
  id: uuid("id").primaryKey().defaultRandom(),
  requesterId: uuid("requester_id").notNull(),
  addresseeId: uuid("addressee_id").notNull(),
  status: text("status").notNull().default("pending"), // pending | accepted
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** 1-on-1 friend chat message. Only accepted friends can message each other. */
export const communityMessages = pgTable("community_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderId: uuid("sender_id").notNull(),
  receiverId: uuid("receiver_id").notNull(),
  content: text("content").notNull(),
  image: text("image"), // base64 data URL or null
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A group chat (GC): named, owned, invite-only. */
export const communityGroups = pgTable("community_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Membership edge for group chats. */
export const communityGroupMembers = pgTable("community_group_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull(),
  userId: uuid("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Message inside a group chat. */
export const communityGroupMessages = pgTable("community_group_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull(),
  senderId: uuid("sender_id").notNull(),
  content: text("content").notNull(),
  image: text("image"), // base64 data URL or null
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#B7E938"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export interface KeyTerm {
  term: string;
  meaning: string;
}
export interface SummaryData {
  overview: string;
  bullets: string[];
  keyTerms: KeyTerm[];
}
export interface NoteSection {
  heading: string;
  content: string;
}
export interface NotesData {
  sections: NoteSection[];
}

export const kits = pgTable("kits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  classId: uuid("class_id"),
  title: text("title").notNull(),
  sourceName: text("source_name").notNull().default(""),
  content: text("content").notNull().default(""),
  summary: jsonb("summary").$type<SummaryData>(),
  notes: jsonb("notes").$type<NotesData>(),
  aiEnabled: boolean("ai_enabled").notNull().default(false),
  pinned: boolean("pinned").notNull().default(false),
  shareToken: text("share_token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cards = pgTable("cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  kitId: uuid("kit_id").notNull(),
  term: text("term").notNull(),
  definition: text("definition").notNull(),
  order: integer("order").notNull().default(0),
});

export type QuestionType = "mcq" | "true_false" | "short";
export interface GenQuestion {
  id?: string;
  type: QuestionType;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

export const kitQuestions = pgTable("kit_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  kitId: uuid("kit_id").notNull(),
  type: text("type").notNull(),
  question: text("question").notNull(),
  options: jsonb("options").$type<string[]>(),
  answer: text("answer").notNull(),
  explanation: text("explanation").notNull().default(""),
  order: integer("order").notNull().default(0),
});

export const assignments = pgTable("assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  classId: uuid("class_id"),
  title: text("title").notNull(),
  teacherName: text("teacher_name").notNull().default(""),
  className: text("class_name").notNull().default(""),
  dueDate: text("due_date").notNull().default(""),
  content: text("content").notNull().default(""),
  sourceName: text("source_name").notNull().default(""),
  shareToken: text("share_token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assignmentQuestions = pgTable("assignment_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  assignmentId: uuid("assignment_id").notNull(),
  type: text("type").notNull(),
  question: text("question").notNull(),
  options: jsonb("options").$type<string[]>(),
  answer: text("answer").notNull(),
  explanation: text("explanation").notNull().default(""),
  order: integer("order").notNull().default(0),
});

export const cardProgress = pgTable("card_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  cardId: uuid("card_id").notNull(),
  ease: real("ease").notNull().default(2.5),
  interval: integer("interval").notNull().default(0),
  reps: integer("reps").notNull().default(0),
  lapses: integer("lapses").notNull().default(0),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const attempts = pgTable("attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  assignmentId: uuid("assignment_id").notNull(),
  userId: uuid("user_id"),
  name: text("name").notNull().default(""),
  score: integer("score").notNull().default(0),
  total: integer("total").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  date: text("date").notNull(), // YYYY-MM-DD
  color: text("color").notNull().default("#B7E938"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  done: boolean("done").notNull().default(false),
  due: text("due").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  kind: text("kind").notNull().default("note"), // note | doc
  title: text("title").notNull().default("Untitled"),
  content: text("content").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Kit = typeof kits.$inferSelect;
export type CardRow = typeof cards.$inferSelect;
export type KitQuestionRow = typeof kitQuestions.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;
export type AssignmentQuestionRow = typeof assignmentQuestions.$inferSelect;
export type ClassFolder = typeof classes.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type CalEvent = typeof events.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
export type DocRow = typeof documents.$inferSelect;
export type CommunityPost = typeof communityPosts.$inferSelect;
export type CommunityReaction = typeof communityReactions.$inferSelect;
export type CommunityComment = typeof communityComments.$inferSelect;
export type Friendship = typeof friendships.$inferSelect;
