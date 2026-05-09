import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  attendances,
  expenses,
  gameEvents,
  guests,
  matches,
  payments,
  players,
  refereeAssignments,
  teamPlayers,
  teams,
} from "../drizzle/schema";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { calculateFinanceSummary, canConfirmAttendance, generateTeamsWithWaitingList, guestsAreReleased, nextFridayMatch, selectRefereeRotation, summarizePlayerStats } from "./futgestaoRules";

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  }
  return db;
}

async function ensureCurrentMatch() {
  const db = await requireDb();
  const existing = await db
    .select()
    .from(matches)
    .where(inArray(matches.status, ["scheduled", "in_progress"]))
    .orderBy(asc(matches.matchDate))
    .limit(1);

  if (existing[0]) return existing[0];

  const next = nextFridayMatch();
  await db.insert(matches).values({
    title: "Pelada de sexta-feira",
    matchDate: next.matchDate,
    confirmationDeadline: next.confirmationDeadline,
    arrivalDeadline: next.arrivalDeadline,
  });

  const created = await db.select().from(matches).orderBy(desc(matches.id)).limit(1);
  if (!created[0]) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível criar a próxima partida." });
  }
  return created[0];
}

async function ensureAttendanceRows(matchId: number) {
  const db = await requireDb();
  const activePlayers = await db.select().from(players).where(eq(players.active, true));
  for (const player of activePlayers) {
    await db
      .insert(attendances)
      .values({ matchId, playerId: player.id, status: "pending" })
      .onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
  }
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function ensureScorekeeperPermission(matchId: number, user: { id: number; role: "admin" | "user" }) {
  if (user.role === "admin") return;
  const db = await requireDb();
  const scorekeeperRows = await db
    .select()
    .from(refereeAssignments)
    .where(and(eq(refereeAssignments.matchId, matchId), eq(refereeAssignments.role, "scorekeeper")))
    .limit(1);
  const scorekeeper = scorekeeperRows[0];
  if (!scorekeeper) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Somente o administrador ou o mesário escalado pode controlar o jogo." });
  }
  const playerRows = await db.select().from(players).where(eq(players.id, scorekeeper.playerId)).limit(1);
  if (playerRows[0]?.userId !== user.id) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Somente o administrador ou o mesário escalado pode controlar o jogo." });
  }
}

const playerInput = z.object({
  name: z.string().min(2),
  phone: z.string().optional().nullable(),
  type: z.enum(["line", "goalkeeper", "both"]),
  monthlyFeeCents: z.number().int().min(0).default(0),
  isMonthlyMember: z.boolean().default(true),
  isRefereeAuthorized: z.boolean().default(false),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  futgestao: router({
    overview: protectedProcedure.query(async () => {
      const db = await requireDb();
      const match = await ensureCurrentMatch();
      await ensureAttendanceRows(match.id);

      const playerRows = await db.select().from(players).where(eq(players.active, true)).orderBy(asc(players.name));
      const attendanceRows = await db.select().from(attendances).where(eq(attendances.matchId, match.id));
      const guestRows = await db.select().from(guests).where(eq(guests.matchId, match.id)).orderBy(desc(guests.id));
      const paymentRows = await db.select().from(payments).orderBy(desc(payments.createdAt)).limit(80);
      const expenseRows = await db.select().from(expenses).orderBy(desc(expenses.paidAt)).limit(80);
      const eventRows = await db.select().from(gameEvents).where(eq(gameEvents.matchId, match.id)).orderBy(desc(gameEvents.createdAt));
      const teamRows = await db.select().from(teams).where(eq(teams.matchId, match.id)).orderBy(asc(teams.playOrder));
      const teamPlayerRows = await db.select().from(teamPlayers).where(eq(teamPlayers.matchId, match.id)).orderBy(asc(teamPlayers.arrivalOrder));
      const refereeRows = await db.select().from(refereeAssignments).where(eq(refereeAssignments.matchId, match.id)).orderBy(asc(refereeAssignments.rotationOrder));

      const monthlyStatuses = playerRows
        .filter(player => player.isMonthlyMember)
        .map(player => attendanceRows.find(item => item.playerId === player.id)?.status ?? "pending");
      const guestsReleased = guestsAreReleased({
        now: new Date(),
        confirmationDeadline: match.confirmationDeadline,
        monthlyMemberStatuses: monthlyStatuses,
      });

      const assignedPlayerIds = new Set(teamPlayerRows.map(item => item.playerId).filter((id): id is number => Boolean(id)));
      const assignedGuestIds = new Set(teamPlayerRows.map(item => item.guestId).filter((id): id is number => Boolean(id)));
      const waitingPlayers = attendanceRows
        .filter(attendance => attendance.status === "confirmed" && !assignedPlayerIds.has(attendance.playerId))
        .map(attendance => {
          const player = playerRows.find(item => item.id === attendance.playerId);
          return player ? { kind: "player" as const, id: player.id, name: player.name, type: player.type, arrivalOrder: attendance.arrivalOrder ?? 9999 } : null;
        })
        .filter((item): item is { kind: "player"; id: number; name: string; type: "line" | "goalkeeper" | "both"; arrivalOrder: number } => item !== null);
      const waitingGuests = guestRows
        .filter(guest => !assignedGuestIds.has(guest.id))
        .map((guest, index) => ({ kind: "guest" as const, id: guest.id, name: guest.name, type: "line" as const, arrivalOrder: 1000 + index }));
      const waitingList = [...waitingPlayers, ...waitingGuests].sort((a, b) => (a?.arrivalOrder ?? 9999) - (b?.arrivalOrder ?? 9999));

      const finance = calculateFinanceSummary({ payments: paymentRows, guests: guestRows, expenses: expenseRows });

      return {
        match,
        players: playerRows.map(player => ({
          ...player,
          attendance: attendanceRows.find(item => item.playerId === player.id) ?? null,
        })),
        guests: guestRows,
        payments: paymentRows,
        expenses: expenseRows,
        events: eventRows,
        teams: teamRows.map(team => ({
          ...team,
          players: teamPlayerRows.filter(item => item.teamId === team.id),
        })),
        referees: refereeRows,
        waitingList,
        guestsReleased,
        finance,
      };
    }),

    createPlayer: adminProcedure.input(playerInput).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.insert(players).values(input);
      return { success: true } as const;
    }),

    updatePlayer: adminProcedure
      .input(playerInput.extend({ id: z.number().int().positive(), active: z.boolean().default(true) }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const { id, ...values } = input;
        await db.update(players).set(values).where(eq(players.id, id));
        return { success: true } as const;
      }),

    createMyPlayer: protectedProcedure.input(playerInput).mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const existing = await db.select().from(players).where(eq(players.userId, ctx.user.id)).limit(1);
      if (existing[0]) {
        await db.update(players).set(input).where(eq(players.id, existing[0].id));
      } else {
        await db.insert(players).values({ ...input, userId: ctx.user.id });
      }
      return { success: true } as const;
    }),

    setAttendance: protectedProcedure
      .input(z.object({ playerId: z.number().int().positive(), status: z.enum(["confirmed", "pending", "declined"]) }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const match = await ensureCurrentMatch();
        const player = await db.select().from(players).where(eq(players.id, input.playerId)).limit(1);
        if (!player[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Jogador não encontrado." });
        if (ctx.user.role !== "admin" && player[0].userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Você só pode alterar a própria presença." });
        }
        const confirmationPermission = canConfirmAttendance({
          now: new Date(),
          confirmationDeadline: match.confirmationDeadline,
          requestedStatus: input.status,
          isAdmin: ctx.user.role === "admin",
        });
        if (!confirmationPermission.allowed) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: confirmationPermission.reason ?? "Prazo de confirmação encerrado." });
        }

        const existing = await db
          .select()
          .from(attendances)
          .where(and(eq(attendances.matchId, match.id), eq(attendances.playerId, input.playerId)))
          .limit(1);
        const maxOrderRows = await db
          .select({ value: sql<number>`coalesce(max(${attendances.arrivalOrder}), 0)` })
          .from(attendances)
          .where(eq(attendances.matchId, match.id));
        const nextOrder = Number(maxOrderRows[0]?.value ?? 0) + 1;
        const confirmedAt = input.status === "confirmed" ? new Date() : null;
        const arrivalOrder = input.status === "confirmed" ? existing[0]?.arrivalOrder ?? nextOrder : null;

        await db
          .insert(attendances)
          .values({
            matchId: match.id,
            playerId: input.playerId,
            status: input.status,
            confirmedAt,
            arrivalOrder,
          })
          .onDuplicateKeyUpdate({
            set: { status: input.status, confirmedAt, arrivalOrder, updatedAt: new Date() },
          });
        return { success: true } as const;
      }),

    markArrived: adminProcedure.input(z.object({ playerId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const match = await ensureCurrentMatch();
      await db
        .update(attendances)
        .set({ arrivedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(attendances.matchId, match.id), eq(attendances.playerId, input.playerId)));
      return { success: true } as const;
    }),

    createGuest: protectedProcedure
      .input(z.object({ hostPlayerId: z.number().int().positive(), name: z.string().min(2), amountCents: z.number().int().min(0).default(1000) }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const match = await ensureCurrentMatch();
        const host = await db.select().from(players).where(eq(players.id, input.hostPlayerId)).limit(1);
        if (!host[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Jogador anfitrião não encontrado." });
        if (ctx.user.role !== "admin" && host[0].userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Você só pode cadastrar convidados vinculados ao seu jogador." });
        }
        const allPlayers = await db.select().from(players).where(eq(players.active, true));
        const allAttendances = await db.select().from(attendances).where(eq(attendances.matchId, match.id));
        const monthlyStatuses = allPlayers
          .filter(player => player.isMonthlyMember)
          .map(player => allAttendances.find(item => item.playerId === player.id)?.status ?? "pending");
        const released = guestsAreReleased({ now: new Date(), confirmationDeadline: match.confirmationDeadline, monthlyMemberStatuses: monthlyStatuses });
        if (!released) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Convidados ainda não foram liberados. Aguarde a confirmação dos mensalistas ou o prazo de sexta-feira às 18h." });
        }
        await db.insert(guests).values({ ...input, matchId: match.id });
        return { success: true } as const;
      }),

    setGuestPaid: adminProcedure.input(z.object({ guestId: z.number().int().positive(), paid: z.boolean() })).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.update(guests).set({ paid: input.paid }).where(eq(guests.id, input.guestId));
      return { success: true } as const;
    }),

    submitPayment: protectedProcedure
      .input(z.object({ playerId: z.number().int().positive(), referenceMonth: z.string().regex(/^\d{4}-\d{2}$/), amountCents: z.number().int().min(0), proofUrl: z.string().min(3) }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const player = await db.select().from(players).where(eq(players.id, input.playerId)).limit(1);
        if (!player[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Jogador não encontrado." });
        if (ctx.user.role !== "admin" && player[0].userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Você só pode enviar comprovante do próprio jogador." });
        }
        await db
          .insert(payments)
          .values({ ...input, status: "sent", submittedAt: new Date() })
          .onDuplicateKeyUpdate({
            set: { amountCents: input.amountCents, proofUrl: input.proofUrl, status: "sent", submittedAt: new Date(), updatedAt: new Date() },
          });
        return { success: true } as const;
      }),

    reviewPayment: adminProcedure
      .input(z.object({ paymentId: z.number().int().positive(), status: z.enum(["confirmed", "rejected"]), rejectionReason: z.string().optional().nullable() }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        await db.update(payments).set({
          status: input.status,
          rejectionReason: input.rejectionReason ?? null,
          confirmedAt: input.status === "confirmed" ? new Date() : null,
          updatedAt: new Date(),
        }).where(eq(payments.id, input.paymentId));
        return { success: true } as const;
      }),

    createExpense: adminProcedure
      .input(z.object({ category: z.enum(["field", "materials", "other"]), description: z.string().min(2), amountCents: z.number().int().min(1) }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const match = await ensureCurrentMatch();
        await db.insert(expenses).values({ ...input, matchId: match.id, paidAt: new Date() });
        return { success: true } as const;
      }),

    generateTeams: adminProcedure.mutation(async () => {
      const db = await requireDb();
      const match = await ensureCurrentMatch();
      const attendanceRows = await db.select().from(attendances).where(and(eq(attendances.matchId, match.id), eq(attendances.status, "confirmed"))).orderBy(asc(attendances.arrivalOrder));
      const playerRows = await db.select().from(players).where(eq(players.active, true));
      const guestRows = await db.select().from(guests).where(eq(guests.matchId, match.id));
      const candidates = attendanceRows
        .map(attendance => {
          const player = playerRows.find(item => item.id === attendance.playerId);
          if (!player || !attendance.arrivalOrder) return null;
          return { id: player.id, name: player.name, type: player.type, arrivalOrder: attendance.arrivalOrder };
        })
        .filter(Boolean) as Array<{ id: number; name: string; type: "line" | "goalkeeper" | "both"; arrivalOrder: number }>;
      const guestCandidates = guestRows.map((guest, index) => ({ id: guest.id, name: guest.name, type: "line" as const, arrivalOrder: 1000 + index, isGuest: true }));
      const generatedResult = generateTeamsWithWaitingList([...candidates, ...guestCandidates]);
      const generated = generatedResult.teams;

      await db.delete(teamPlayers).where(eq(teamPlayers.matchId, match.id));
      await db.delete(teams).where(eq(teams.matchId, match.id));
      for (const team of generated) {
        await db.insert(teams).values({ matchId: match.id, name: team.name, playOrder: team.playOrder });
      }
      const createdTeams = await db.select().from(teams).where(eq(teams.matchId, match.id)).orderBy(asc(teams.playOrder));
      for (const team of generated) {
        const created = createdTeams.find(item => item.name === team.name);
        if (!created) continue;
        for (const player of team.players) {
          await db.insert(teamPlayers).values({
            matchId: match.id,
            teamId: created.id,
            playerId: player.isGuest ? null : player.id,
            guestId: player.isGuest ? player.id : null,
            role: player.role,
            arrivalOrder: player.arrivalOrder,
          });
        }
      }
      return { success: true, generatedCount: generated.length, waitingCount: generatedResult.waitingList.length } as const;
    }),

    assignReferees: adminProcedure.mutation(async () => {
      const db = await requireDb();
      const match = await ensureCurrentMatch();
      const authorized = await db.select().from(players).where(and(eq(players.active, true), eq(players.isRefereeAuthorized, true)));
      const teamPlayerRows = await db.select().from(teamPlayers).where(eq(teamPlayers.matchId, match.id));
      const playingIds = teamPlayerRows.map(item => item.playerId).filter((id): id is number => Boolean(id));
      const unavailable = authorized.map(player => player.id).filter(id => !playingIds.includes(id));
      const latestAssignments = await db.select().from(refereeAssignments).orderBy(desc(refereeAssignments.createdAt)).limit(30);
      const rotation = selectRefereeRotation({
        authorizedPlayerIds: authorized.map(player => player.id),
        unavailablePlayerIds: unavailable,
        lastAssignedPlayerIds: latestAssignments.map(item => item.playerId),
      });
      if (rotation.length < 3) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "É preciso ter pelo menos 3 árbitros autorizados fora do jogo." });
      }
      await db.delete(refereeAssignments).where(eq(refereeAssignments.matchId, match.id));
      for (const assignment of rotation) {
        await db.insert(refereeAssignments).values({ matchId: match.id, ...assignment });
      }
      return { success: true } as const;
    }),

    setClock: protectedProcedure.input(z.object({ clockSeconds: z.number().int().min(0), clockRunning: z.boolean() })).mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const match = await ensureCurrentMatch();
      await ensureScorekeeperPermission(match.id, ctx.user);
      await db.update(matches).set({ ...input, status: input.clockRunning ? "in_progress" : match.status, updatedAt: new Date() }).where(eq(matches.id, match.id));
      return { success: true } as const;
    }),

    recordEvent: protectedProcedure
      .input(z.object({ type: z.enum(["goal", "yellow_card", "red_card"]), minute: z.number().int().min(0), teamId: z.number().int().positive().optional().nullable(), playerId: z.number().int().positive().optional().nullable(), guestId: z.number().int().positive().optional().nullable() }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const match = await ensureCurrentMatch();
        await ensureScorekeeperPermission(match.id, ctx.user);
        await db.insert(gameEvents).values({ matchId: match.id, ...input });
        return { success: true } as const;
      }),

    stats: protectedProcedure.query(async () => {
      const db = await requireDb();
      const allPlayers = await db.select().from(players).where(eq(players.active, true));
      const allAttendances = await db.select().from(attendances);
      const allEvents = await db.select().from(gameEvents);
      const playerStats = summarizePlayerStats({ players: allPlayers, attendances: allAttendances, events: allEvents });
      return {
        month: currentMonth(),
        scorers: [...playerStats].sort((a, b) => b.goals - a.goals),
        cards: [...playerStats].sort((a, b) => b.yellowCards + b.redCards - (a.yellowCards + a.redCards)),
        presence: [...playerStats].sort((a, b) => b.confirmedPresence - a.confirmedPresence),
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
