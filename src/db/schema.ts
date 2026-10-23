import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  customType,
  uniqueIndex,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  avatar: text("avatar"), // data URL (zdjęcie profilowe)
  /** Koniec bana; null = konto aktywne. */
  bannedUntil: timestamp("banned_until"),
  banReason: text("ban_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;

export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("Amatorskie"),
  uploader: text("uploader").notNull().default("Gnam"),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull().default("video/mp4"),
  fileSize: integer("file_size").notNull().default(0),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  thumbnail: text("thumbnail"), // data URL captured client-side
  data: bytea("data").notNull(),
  views: integer("views").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  dislikes: integer("dislikes").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Video = typeof videos.$inferSelect;

export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    videoId: integer("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    /** Komentarz nadrzędny (odpowiedzi); null = komentarz główny. */
    parentId: integer("parent_id").references((): AnyPgColumn => comments.id, {
      onDelete: "cascade",
    }),
    username: text("username").notNull(),
    body: text("body").notNull(),
    likes: integer("likes").notNull().default(0),
    dislikes: integer("dislikes").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("comments_video_id_idx").on(table.videoId)]
);

export type Comment = typeof comments.$inferSelect;

/** Jeden głos na komentarz: 1 = lubię, -1 = nie lubię. */
export const commentVotes = pgTable(
  "comment_votes",
  {
    id: serial("id").primaryKey(),
    commentId: integer("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    value: integer("value").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("comment_votes_comment_user_idx").on(
      table.commentId,
      table.username
    ),
  ]
);

export type CommentVote = typeof commentVotes.$inferSelect;

/** Nadane odznaki weryfikacji (nadaje je konto sensei69). */
export const verifications = pgTable("verifications", {
  username: text("username").primaryKey(),
  grantedBy: text("granted_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Verification = typeof verifications.$inferSelect;

/**
 * Odebrane odznaki. Wpis blokuje odznakę z listy startowej (np. SweetieFox)
 * oraz cofa odznakę nadaną ręcznie; sensei69 może ją później przywrócić.
 */
export const verificationRevocations = pgTable("verification_revocations", {
  username: text("username").primaryKey(),
  revokedBy: text("revoked_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type VerificationRevocation =
  typeof verificationRevocations.$inferSelect;

/**
 * Administratorzy nadani przez sensei69. sensei69 jest adminem zawsze
 * (nie trzeba wpisu w tej tabeli).
 */
export const admins = pgTable("admins", {
  username: text("username").primaryKey(),
  grantedBy: text("granted_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Admin = typeof admins.$inferSelect;
