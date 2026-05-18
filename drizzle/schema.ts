import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const appSettings = mysqlTable("appSettings", {
  id: int("id").primaryKey(),
  ownerId: int("ownerId").references(() => users.id),
  appName: varchar("appName", { length: 80 }).default("FutGestão").notNull(),
  appDescription: text("appDescription"),
  primaryColor: varchar("primaryColor", { length: 16 }).default("#16a34a").notNull(),
  secondaryColor: varchar("secondaryColor", { length: 16 }).default("#0f172a").notNull(),
  logoUrl: text("logoUrl"),
  openingBalanceCents: int("openingBalanceCents").default(0).notNull(),
  matchHour: int("matchHour").default(20).notNull(),
  matchMinute: int("matchMinute").default(0).notNull(),
  confirmationHour: int("confirmationHour").default(18).notNull(),
  confirmationMinute: int("confirmationMinute").default(0).notNull(),
  arrivalMinutesBefore: int("arrivalMinutesBefore").default(15).notNull(),
  regulationText: text("regulationText"),
  recurringDays: varchar("recurringDays", { length: 255 }).default("5").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const players = mysqlTable("players", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  name: varchar("name", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  type: mysqlEnum("type", ["line", "goalkeeper", "both"]).default("line").notNull(),
  monthlyFeeCents: int("monthlyFeeCents").default(0).notNull(),
  isMonthlyMember: boolean("isMonthlyMember").default(true).notNull(),
  isRefereeAuthorized: boolean("isRefereeAuthorized").default(false).notNull(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const matches = mysqlTable("matches", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 160 }).notNull(),
  matchDate: timestamp("matchDate").notNull(),
  confirmationDeadline: timestamp("confirmationDeadline").notNull(),
  arrivalDeadline: timestamp("arrivalDeadline").notNull(),
  status: mysqlEnum("status", ["scheduled", "in_progress", "finished", "cancelled"])
    .default("scheduled")
    .notNull(),
  clockSeconds: int("clockSeconds").default(0).notNull(),
  clockRunning: boolean("clockRunning").default(false).notNull(),
  arrivalQrToken: varchar("arrivalQrToken", { length: 96 }),
  arrivalQrExpiresAt: timestamp("arrivalQrExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const attendances = mysqlTable(
  "attendances",
  {
    id: int("id").autoincrement().primaryKey(),
    matchId: int("matchId").notNull().references(() => matches.id),
    playerId: int("playerId").notNull().references(() => players.id),
    status: mysqlEnum("status", ["confirmed", "pending", "declined"]).default("pending").notNull(),
    confirmedAt: timestamp("confirmedAt"),
    arrivedAt: timestamp("arrivedAt"),
    arrivalOrder: int("arrivalOrder"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    uniqueAttendance: uniqueIndex("attendance_match_player_unique").on(table.matchId, table.playerId),
  }),
);

export const guests = mysqlTable("guests", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId").notNull().references(() => matches.id),
  hostPlayerId: int("hostPlayerId").notNull().references(() => players.id),
  name: varchar("name", { length: 160 }).notNull(),
  amountCents: int("amountCents").default(1000).notNull(),
  paid: boolean("paid").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const payments = mysqlTable(
  "payments",
  {
    id: int("id").autoincrement().primaryKey(),
    playerId: int("playerId").notNull().references(() => players.id),
    referenceMonth: varchar("referenceMonth", { length: 7 }).notNull(),
    amountCents: int("amountCents").default(0).notNull(),
    status: mysqlEnum("status", ["pending", "sent", "confirmed", "rejected"]).default("pending").notNull(),
    proofUrl: text("proofUrl"),
    rejectionReason: text("rejectionReason"),
    submittedAt: timestamp("submittedAt"),
    confirmedAt: timestamp("confirmedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    uniquePayment: uniqueIndex("payment_player_month_unique").on(table.playerId, table.referenceMonth),
  }),
);

export const expenses = mysqlTable("expenses", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId").references(() => matches.id),
  category: mysqlEnum("category", ["field", "materials", "other"]).default("field").notNull(),
  description: varchar("description", { length: 240 }).notNull(),
  amountCents: int("amountCents").default(0).notNull(),
  paidAt: timestamp("paidAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const teams = mysqlTable("teams", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId").notNull().references(() => matches.id),
  name: varchar("name", { length: 16 }).notNull(),
  playOrder: int("playOrder").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const teamPlayers = mysqlTable("teamPlayers", {
  id: int("id").autoincrement().primaryKey(),
  teamId: int("teamId").notNull().references(() => teams.id),
  matchId: int("matchId").notNull().references(() => matches.id),
  playerId: int("playerId").references(() => players.id),
  guestId: int("guestId").references(() => guests.id),
  role: mysqlEnum("role", ["line", "goalkeeper", "improvised_goalkeeper"]).default("line").notNull(),
  arrivalOrder: int("arrivalOrder").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const refereeAssignments = mysqlTable("refereeAssignments", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId").notNull().references(() => matches.id),
  playerId: int("playerId").notNull().references(() => players.id),
  role: mysqlEnum("role", ["referee1", "referee2", "scorekeeper"]).notNull(),
  rotationOrder: int("rotationOrder").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const gameEvents = mysqlTable("gameEvents", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId").notNull().references(() => matches.id),
  teamId: int("teamId").references(() => teams.id),
  playerId: int("playerId").references(() => players.id),
  guestId: int("guestId").references(() => guests.id),
  type: mysqlEnum("type", ["goal", "yellow_card", "red_card"]).notNull(),
  minute: int("minute").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type AppSettings = typeof appSettings.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Attendance = typeof attendances.$inferSelect;
export type Guest = typeof guests.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type TeamPlayer = typeof teamPlayers.$inferSelect;
export type RefereeAssignment = typeof refereeAssignments.$inferSelect;
export type GameEvent = typeof gameEvents.$inferSelect;

export const regulationAcceptances = mysqlTable("regulationAcceptances", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  acceptedAt: timestamp("acceptedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const playerInvites = mysqlTable("playerInvites", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  type: mysqlEnum("type", ["line", "goalkeeper", "both"]).default("line").notNull(),
  monthlyFeeCents: int("monthlyFeeCents").default(0).notNull(),
  isMonthlyMember: boolean("isMonthlyMember").default(true).notNull(),
  isRefereeAuthorized: boolean("isRefereeAuthorized").default(false).notNull(),
  invitedBy: int("invitedBy").notNull().references(() => users.id),
  status: mysqlEnum("status", ["pending", "accepted", "declined"]).default("pending").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RegulationAcceptance = typeof regulationAcceptances.$inferSelect;
export type PlayerInvite = typeof playerInvites.$inferSelect;
