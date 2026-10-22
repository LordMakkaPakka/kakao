import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  customType,
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