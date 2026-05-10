from pathlib import Path

root = Path('/home/ubuntu/futgestao')

# 1) Schema changes
schema_path = root / 'drizzle/schema.ts'
schema = schema_path.read_text()
if 'export const appSettings = mysqlTable("appSettings"' not in schema:
    schema = schema.replace('export const players = mysqlTable("players", {', '''export const appSettings = mysqlTable("appSettings", {
  id: int("id").primaryKey(),
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const players = mysqlTable("players", {''')
if 'arrivalQrToken' not in schema:
    schema = schema.replace('  clockRunning: boolean("clockRunning").default(false).notNull(),\n', '  clockRunning: boolean("clockRunning").default(false).notNull(),\n  arrivalQrToken: varchar("arrivalQrToken", { length: 96 }),\n  arrivalQrExpiresAt: timestamp("arrivalQrExpiresAt"),\n')
if 'export type AppSettings' not in schema:
    schema = schema.replace('export type Player = typeof players.$inferSelect;\n', 'export type AppSettings = typeof appSettings.$inferSelect;\nexport type Player = typeof players.$inferSelect;\n')
schema_path.write_text(schema)

# 2) Domain rules
rules_path = root / 'server/futgestaoRules.ts'
rules = rules_path.read_text()
rules = rules.replace('export function nextFridayMatch(now = new Date()) {\n  const date = new Date(now);\n  const day = date.getDay();\n  const diff = (5 - day + 7) % 7;\n  date.setDate(date.getDate() + diff);\n  date.setHours(20, 0, 0, 0);', '''export function nextFridayMatch(now = new Date(), options?: {
  matchHour?: number;
  matchMinute?: number;
  confirmationHour?: number;
  confirmationMinute?: number;
  arrivalMinutesBefore?: number;
}) {
  const date = new Date(now);
  const day = date.getDay();
  const diff = (5 - day + 7) % 7;
  date.setDate(date.getDate() + diff);
  date.setHours(options?.matchHour ?? 20, options?.matchMinute ?? 0, 0, 0);''')
rules = rules.replace('  confirmationDeadline.setHours(18, 0, 0, 0);', '  confirmationDeadline.setHours(options?.confirmationHour ?? 18, options?.confirmationMinute ?? 0, 0, 0);')
rules = rules.replace('  arrivalDeadline.setMinutes(arrivalDeadline.getMinutes() - 15);', '  arrivalDeadline.setMinutes(arrivalDeadline.getMinutes() - (options?.arrivalMinutesBefore ?? 15));')
rules = rules.replace('export function calculateFinanceSummary(params: {\n  payments: Array<{ status: "pending" | "sent" | "confirmed" | "rejected"; amountCents: number }>;\n  guests: Array<{ paid: boolean; amountCents: number }>;\n  expenses: Array<{ amountCents: number }>;\n}) {', 'export function calculateFinanceSummary(params: {\n  payments: Array<{ status: "pending" | "sent" | "confirmed" | "rejected"; amountCents: number }>;\n  guests: Array<{ paid: boolean; amountCents: number }>;\n  expenses: Array<{ amountCents: number }>;\n  openingBalanceCents?: number;\n}) {')
rules = rules.replace('  const totalExpenses = params.expenses.reduce((sum, expense) => sum + expense.amountCents, 0);\n  return {\n    confirmedPayments,\n    paidGuests,\n    totalRevenue: confirmedPayments + paidGuests,\n    totalExpenses,\n    balance: confirmedPayments + paidGuests - totalExpenses,\n  };', '  const totalExpenses = params.expenses.reduce((sum, expense) => sum + expense.amountCents, 0);\n  const openingBalanceCents = params.openingBalanceCents ?? 0;\n  const totalRevenue = confirmedPayments + paidGuests;\n  return {\n    openingBalanceCents,\n    confirmedPayments,\n    paidGuests,\n    totalRevenue,\n    totalExpenses,\n    balance: openingBalanceCents + totalRevenue - totalExpenses,\n  };')
rules_path.write_text(rules)

# 3) Router: import and helpers
router_path = root / 'server/routers.ts'
r = router_path.read_text()
r = r.replace('import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";', 'import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";\nimport { randomUUID } from "node:crypto";')
r = r.replace('  attendances,\n', '  appSettings,\n  attendances,\n')
r = r.replace('import { getDb } from "./db";', 'import { getDb } from "./db";\nimport { storagePut } from "./storage";')
helper = '''
const defaultSettings = {
  id: 1,
  appName: "FutGestão",
  appDescription: "Controle a confirmação, os convidados, o caixa, os times, a arbitragem e as estatísticas da sua turma em um único painel responsivo para web e celular.",
  primaryColor: "#16a34a",
  secondaryColor: "#0f172a",
  logoUrl: null as string | null,
  openingBalanceCents: 0,
  matchHour: 20,
  matchMinute: 0,
  confirmationHour: 18,
  confirmationMinute: 0,
  arrivalMinutesBefore: 15,
};

async function ensureAppSettings() {
  const db = await requireDb();
  const rows = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  if (rows[0]) return rows[0];
  await db.insert(appSettings).values(defaultSettings).onDuplicateKeyUpdate({ set: defaultSettings });
  return { ...defaultSettings, createdAt: new Date(), updatedAt: new Date() };
}

async function nextArrivalOrder(matchId: number) {
  const db = await requireDb();
  const maxOrderRows = await db
    .select({ value: sql<number>`coalesce(max(${attendances.arrivalOrder}), 0)` })
    .from(attendances)
    .where(eq(attendances.matchId, matchId));
  return Number(maxOrderRows[0]?.value ?? 0) + 1;
}
'''
if 'async function ensureAppSettings()' not in r:
    r = r.replace('\nasync function ensureCurrentMatch() {', helper + '\nasync function ensureCurrentMatch() {')
r = r.replace('  const next = nextFridayMatch();', '  const settings = await ensureAppSettings();\n  const next = nextFridayMatch(new Date(), settings);')
r = r.replace('      const refereeRows = await db.select().from(refereeAssignments).where(eq(refereeAssignments.matchId, match.id)).orderBy(asc(refereeAssignments.rotationOrder));', '      const refereeRows = await db.select().from(refereeAssignments).where(eq(refereeAssignments.matchId, match.id)).orderBy(asc(refereeAssignments.rotationOrder));\n      const settings = await ensureAppSettings();')
r = r.replace('        .filter(attendance => attendance.status === "confirmed" && !assignedPlayerIds.has(attendance.playerId))', '        .filter(attendance => attendance.status === "confirmed" && attendance.arrivalOrder !== null && !assignedPlayerIds.has(attendance.playerId))')
r = r.replace('      const finance = calculateFinanceSummary({ payments: paymentRows, guests: guestRows, expenses: expenseRows });', '      const finance = calculateFinanceSummary({ payments: paymentRows, guests: guestRows, expenses: expenseRows, openingBalanceCents: settings.openingBalanceCents });')
r = r.replace('        match,\n', '        settings,\n        match,\n', 1)
# setAttendance body segment
old = '''        const maxOrderRows = await db
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
          });'''
new = '''        const isConfirmed = input.status === "confirmed";
        const confirmedAt = isConfirmed ? existing[0]?.confirmedAt ?? new Date() : null;
        const arrivalOrder = isConfirmed ? existing[0]?.arrivalOrder ?? null : null;
        const arrivedAt = isConfirmed ? existing[0]?.arrivedAt ?? null : null;

        await db
          .insert(attendances)
          .values({
            matchId: match.id,
            playerId: input.playerId,
            status: input.status,
            confirmedAt,
            arrivedAt,
            arrivalOrder,
          })
          .onDuplicateKeyUpdate({
            set: { status: input.status, confirmedAt, arrivedAt, arrivalOrder, updatedAt: new Date() },
          });'''
r = r.replace(old, new)
old_mark = '''    markArrived: adminProcedure.input(z.object({ playerId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const match = await ensureCurrentMatch();
      await db
        .update(attendances)
        .set({ arrivedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(attendances.matchId, match.id), eq(attendances.playerId, input.playerId)));
      return { success: true } as const;
    }),'''
new_mark = '''    markArrived: adminProcedure.input(z.object({ playerId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const match = await ensureCurrentMatch();
      const existing = await db
        .select()
        .from(attendances)
        .where(and(eq(attendances.matchId, match.id), eq(attendances.playerId, input.playerId)))
        .limit(1);
      const order = existing[0]?.arrivalOrder ?? await nextArrivalOrder(match.id);
      const now = new Date();
      await db
        .insert(attendances)
        .values({ matchId: match.id, playerId: input.playerId, status: "confirmed", confirmedAt: existing[0]?.confirmedAt ?? now, arrivedAt: now, arrivalOrder: order })
        .onDuplicateKeyUpdate({ set: { status: "confirmed", confirmedAt: existing[0]?.confirmedAt ?? now, arrivedAt: now, arrivalOrder: order, updatedAt: now } });
      return { success: true } as const;
    }),

    generateArrivalQr: adminProcedure.mutation(async () => {
      const db = await requireDb();
      const match = await ensureCurrentMatch();
      const token = randomUUID();
      const expiresAt = new Date(new Date(match.matchDate).getTime() + 4 * 60 * 60 * 1000);
      await db.update(matches).set({ arrivalQrToken: token, arrivalQrExpiresAt: expiresAt, updatedAt: new Date() }).where(eq(matches.id, match.id));
      return { token, expiresAt } as const;
    }),

    confirmArrivalByQr: protectedProcedure.input(z.object({ token: z.string().min(20) })).mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const matchRows = await db.select().from(matches).where(eq(matches.arrivalQrToken, input.token)).limit(1);
      const match = matchRows[0];
      if (!match || !match.arrivalQrExpiresAt || new Date(match.arrivalQrExpiresAt).getTime() < Date.now()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "QR Code inválido ou expirado. Peça ao administrador para gerar um novo código no campo." });
      }
      const playerRows = await db.select().from(players).where(eq(players.userId, ctx.user.id)).limit(1);
      const player = playerRows[0];
      if (!player) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Crie seu cadastro de jogador antes de confirmar chegada." });
      const existing = await db
        .select()
        .from(attendances)
        .where(and(eq(attendances.matchId, match.id), eq(attendances.playerId, player.id)))
        .limit(1);
      if (existing[0]?.status === "declined") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Você marcou ausência. Altere para Presença antes de registrar chegada." });
      }
      const order = existing[0]?.arrivalOrder ?? await nextArrivalOrder(match.id);
      const now = new Date();
      await db
        .insert(attendances)
        .values({ matchId: match.id, playerId: player.id, status: "confirmed", confirmedAt: existing[0]?.confirmedAt ?? now, arrivedAt: now, arrivalOrder: order })
        .onDuplicateKeyUpdate({ set: { status: "confirmed", confirmedAt: existing[0]?.confirmedAt ?? now, arrivedAt: now, arrivalOrder: order, updatedAt: now } });
      return { success: true, playerId: player.id, arrivalOrder: order } as const;
    }),'''
r = r.replace(old_mark, new_mark)
r = r.replace('const attendanceRows = await db.select().from(attendances).where(and(eq(attendances.matchId, match.id), eq(attendances.status, "confirmed"))).orderBy(asc(attendances.arrivalOrder));', 'const attendanceRows = await db.select().from(attendances).where(and(eq(attendances.matchId, match.id), eq(attendances.status, "confirmed"))).orderBy(asc(attendances.arrivalOrder));')
r = r.replace('          if (!player || !attendance.arrivalOrder) return null;', '          if (!player || !attendance.arrivalOrder || !attendance.arrivedAt) return null;')
r = r.replace('    setClock: protectedProcedure.input(z.object({ clockSeconds: z.number().int().min(0), clockRunning: z.boolean() })).mutation(async ({ input, ctx }) => {', '    setClock: protectedProcedure.input(z.object({ clockSeconds: z.number().int().min(0).max(60 * 60 * 6), clockRunning: z.boolean() })).mutation(async ({ input, ctx }) => {')
settings_router = '''

    updateSettings: adminProcedure.input(z.object({
      appName: z.string().min(2).max(80),
      appDescription: z.string().max(600).optional().nullable(),
      primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      logoUrl: z.string().max(2000).optional().nullable(),
      openingBalanceCents: z.number().int().min(-100000000).max(100000000),
      matchHour: z.number().int().min(0).max(23),
      matchMinute: z.number().int().min(0).max(59),
      confirmationHour: z.number().int().min(0).max(23),
      confirmationMinute: z.number().int().min(0).max(59),
      arrivalMinutesBefore: z.number().int().min(0).max(180),
    })).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.insert(appSettings).values({ id: 1, ...input }).onDuplicateKeyUpdate({ set: { ...input, updatedAt: new Date() } });
      return { success: true } as const;
    }),

    uploadLogo: adminProcedure.input(z.object({
      fileName: z.string().min(1).max(160),
      mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]),
      dataBase64: z.string().min(20),
    })).mutation(async ({ input }) => {
      const cleanName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
      const buffer = Buffer.from(input.dataBase64, "base64");
      const { url } = await storagePut(`branding/${cleanName}`, buffer, input.mimeType);
      const db = await requireDb();
      await db.insert(appSettings).values({ id: 1, ...defaultSettings, logoUrl: url }).onDuplicateKeyUpdate({ set: { logoUrl: url, updatedAt: new Date() } });
      return { url } as const;
    }),'''
if 'updateSettings: adminProcedure' not in r:
    r = r.replace('\n    stats: protectedProcedure.query(async () => {', settings_router + '\n\n    stats: protectedProcedure.query(async () => {')
router_path.write_text(r)

# 4) Frontend
home_path = root / 'client/src/pages/Home.tsx'
h = home_path.read_text()
# ensure auth import if missing
if 'useAuth' not in h.split('\n')[:5]:
    h = 'import { useAuth } from "@/hooks/useAuth";\n' + h
h = h.replace('import { Activity, Banknote, CalendarClock, ClipboardList, Goal, ShieldCheck, Trophy, Users } from "lucide-react";', 'import { Activity, Banknote, CalendarClock, ClipboardList, Goal, QrCode, Settings, ShieldCheck, Trophy, Upload, Users } from "lucide-react";\nimport { QRCodeSVG } from "qrcode.react";')
h = h.replace('  const recordEvent = trpc.futgestao.recordEvent.useMutation({ onSuccess: () => refresh("Evento registrado.") });', '  const recordEvent = trpc.futgestao.recordEvent.useMutation({ onSuccess: () => refresh("Evento registrado.") });\n  const generateArrivalQr = trpc.futgestao.generateArrivalQr.useMutation({ onSuccess: () => refresh("QR Code de chegada gerado.") });\n  const confirmArrivalByQr = trpc.futgestao.confirmArrivalByQr.useMutation({ onSuccess: data => refresh(`Chegada registrada. Ordem ${data.arrivalOrder}.`) });\n  const updateSettings = trpc.futgestao.updateSettings.useMutation({ onSuccess: () => refresh("Configurações salvas.") });\n  const uploadLogo = trpc.futgestao.uploadLogo.useMutation({ onSuccess: result => { setSettingsForm(form => ({ ...form, logoUrl: result.url })); refresh("Logo enviada."); } });')
h = h.replace('  const [clockSeconds, setClockSeconds] = useState(0);', '''  const [clockSeconds, setClockSeconds] = useState(0);
  const [qrToken, setQrToken] = useState("");
  const [settingsForm, setSettingsForm] = useState({
    appName: "FutGestão",
    appDescription: "",
    primaryColor: "#16a34a",
    secondaryColor: "#0f172a",
    logoUrl: "",
    openingBalance: "0",
    matchHour: "20",
    matchMinute: "0",
    confirmationHour: "18",
    confirmationMinute: "0",
    arrivalMinutesBefore: "15",
  });''')
h = h.replace('  const data = overview.data;', '  const data = overview.data;\n  const appDescription = data?.settings.appDescription || "Controle a confirmação, os convidados, o caixa, os times, a arbitragem e as estatísticas da sua turma em um único painel responsivo para web e celular.";')
# settings form sync insert after clock sync effect
h = h.replace('  useEffect(() => {\n    if (!data?.match) return;', '  useEffect(() => {\n    if (!data?.settings) return;\n    setSettingsForm({\n      appName: data.settings.appName,\n      appDescription: data.settings.appDescription ?? "",\n      primaryColor: data.settings.primaryColor,\n      secondaryColor: data.settings.secondaryColor,\n      logoUrl: data.settings.logoUrl ?? "",\n      openingBalance: String((data.settings.openingBalanceCents ?? 0) / 100).replace(".", ","),\n      matchHour: String(data.settings.matchHour ?? 20),\n      matchMinute: String(data.settings.matchMinute ?? 0),\n      confirmationHour: String(data.settings.confirmationHour ?? 18),\n      confirmationMinute: String(data.settings.confirmationMinute ?? 0),\n      arrivalMinutesBefore: String(data.settings.arrivalMinutesBefore ?? 15),\n    });\n  }, [data?.settings]);\n\n  useEffect(() => {\n    if (!data?.match) return;')
h = h.replace('  const isAdmin = user?.role === "admin";', '''  const isAdmin = user?.role === "admin";
  const arrivalQrUrl = data?.match.arrivalQrToken ? `${window.location.origin}/?chegada=${data.match.arrivalQrToken}` : "";
  const brandStyle = data?.settings ? ({ "--brand-primary": data.settings.primaryColor, "--brand-secondary": data.settings.secondaryColor } as React.CSSProperties) : undefined;''')
h = h.replace('<div className="space-y-6 pb-20">', '<div className="space-y-6 pb-20" style={brandStyle}>')
h = h.replace('bg-[radial-gradient(circle_at_top_left,#22c55e_0,#0f3d26_42%,#081b13_100%)]', 'bg-[radial-gradient(circle_at_top_left,var(--brand-primary)_0,var(--brand-secondary)_48%,#081b13_100%)]')
h = h.replace('<Badge className="border-white/20 bg-white/15 text-white hover:bg-white/20">Pelada de sexta-feira</Badge>', '<Badge className="border-white/20 bg-white/15 text-white hover:bg-white/20">{data.settings.appName}</Badge>')
h = h.replace('<h1 className="text-3xl font-black tracking-tight md:text-5xl">FutGestão</h1>', '<div className="flex flex-wrap items-center gap-3">{data.settings.logoUrl && <img src={data.settings.logoUrl} alt="Logo do grupo" className="h-16 w-16 rounded-2xl border border-white/30 bg-white/90 object-contain p-2" />}<h1 className="text-3xl font-black tracking-tight md:text-5xl">{data.settings.appName}</h1></div>')
h = h.replace('Controle a confirmação, os convidados, o caixa, os times, a arbitragem e as estatísticas da sua turma em um único painel responsivo para web e celular.', '{appDescription}')
h = h.replace('<TabsList className="grid h-auto grid-cols-2 gap-2 rounded-2xl bg-muted p-2 md:grid-cols-7">', '<TabsList className="grid h-auto grid-cols-2 gap-2 rounded-2xl bg-muted p-2 md:grid-cols-8">')
h = h.replace('<TabsTrigger value="stats">Estatísticas</TabsTrigger>', '<TabsTrigger value="stats">Estatísticas</TabsTrigger>\n          {isAdmin && <TabsTrigger value="config">Configurações</TabsTrigger>}')
# QR in presence card before map list
h = h.replace('              {presencePlayers.map(player => {', '''              {!isAdmin && myPlayer && (
                <div className="grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                  <div className="flex items-start gap-3"><QrCode className="mt-0.5 h-5 w-5" /><div><p className="font-semibold">Chegada real pelo QR Code do campo</p><p>Confirme presença antes. Quando chegar, escaneie o QR Code exibido pelo administrador ou cole o código abaixo. Só a chegada validada entra na ordem dos times.</p></div></div>
                  <div className="flex flex-col gap-2 sm:flex-row"><Input value={qrToken} onChange={e => setQrToken(e.target.value)} placeholder="Código de chegada" /><Button onClick={() => confirmArrivalByQr.mutate({ token: qrToken })} disabled={!qrToken.trim()}>Validar chegada</Button></div>
                </div>
              )}
              {isAdmin && (
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div><p className="font-semibold">QR Code de chegada no campo</p><p className="text-sm text-muted-foreground">Gere e exiba este código no campo. O jogador só entra na ordem real de chegada após validar o código ou ser marcado pelo administrador.</p></div>
                  <div className="grid justify-items-center gap-2">
                    {arrivalQrUrl ? <QRCodeSVG value={arrivalQrUrl} size={128} /> : <div className="grid h-32 w-32 place-items-center rounded-xl bg-white text-xs text-muted-foreground">Sem QR</div>}
                    <Button size="sm" onClick={() => generateArrivalQr.mutate()}>Gerar QR Code</Button>
                  </div>
                </div>
              )}
              {presencePlayers.map(player => {''')
h = h.replace('Confirmado em {dateTime(player.attendance?.confirmedAt)} · Ordem {player.attendance?.arrivalOrder ?? "-"} · Chegada presencial {dateTime(player.attendance?.arrivedAt)}', '{isAdmin ? `Confirmado em ${dateTime(player.attendance?.confirmedAt)} · Ordem ${player.attendance?.arrivalOrder ?? "-"} · Chegada presencial ${dateTime(player.attendance?.arrivedAt)}` : `Sua chegada real: ${player.attendance?.arrivedAt ? `${dateTime(player.attendance.arrivedAt)} · ordem ${player.attendance.arrivalOrder ?? "-"}` : "ainda não validada por QR Code ou administrador"}`}')
h = h.replace('<StatusRow label="Mensalidades confirmadas" value={money(data.finance.confirmedPayments)} tone="text-emerald-700" />', '<StatusRow label="Saldo inicial em caixa" value={money(data.finance.openingBalanceCents)} tone="text-slate-700" />\n              <StatusRow label="Mensalidades confirmadas" value={money(data.finance.confirmedPayments)} tone="text-emerald-700" />')
h = h.replace('<CardHeader><CardTitle>Organização automática</CardTitle><CardDescription>Primeiros confirmados jogam primeiro. O algoritmo prioriza goleiros e completa times com 5 linha + 1 goleiro ou 6 sem goleiro.</CardDescription></CardHeader>', '<CardHeader><CardTitle>Organização automática</CardTitle><CardDescription>Primeiros com chegada validada por QR Code ou administrador jogam primeiro. O algoritmo prioriza goleiros e completa times com 5 linha + 1 goleiro ou 6 sem goleiro.</CardDescription></CardHeader>')
h = h.replace('              <div className="grid grid-cols-3 gap-2"><Button onClick={() => setClockSeconds(clockSeconds + 60)}>+1 min</Button><Button variant="secondary" onClick={() => setClockSeconds(Math.max(0, clockSeconds - 60))}>-1 min</Button><Button variant="outline" onClick={() => { setClockSeconds(0); setClock.mutate({ clockSeconds: 0, clockRunning: false }); }}>Zerar</Button></div>\n              <div className="grid grid-cols-2 gap-2"><Button onClick={() => setClock.mutate({ clockSeconds, clockRunning: true })}>Iniciar / retomar</Button><Button variant="secondary" onClick={() => setClock.mutate({ clockSeconds, clockRunning: false })}>Pausar e salvar</Button></div>', '              <div className="grid grid-cols-3 gap-2"><Button onClick={() => setClock.mutate({ clockSeconds: 0, clockRunning: true })}>Iniciar do zero</Button><Button variant="secondary" onClick={() => setClock.mutate({ clockSeconds, clockRunning: true })}>Retomar</Button><Button variant="outline" onClick={() => { setClockSeconds(0); setClock.mutate({ clockSeconds: 0, clockRunning: false }); }}>Zerar</Button></div>\n              <Button variant="secondary" onClick={() => setClock.mutate({ clockSeconds, clockRunning: false })}>Pausar e salvar</Button>')
config_block = '''

        {isAdmin && (
          <TabsContent value="config" className="grid gap-4 lg:grid-cols-[1fr_.8fr]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Configurações do grupo</CardTitle><CardDescription>Edite saldo inicial, horários, descrição, cores e logo usados no aplicativo.</CardDescription></CardHeader>
              <CardContent>
                <form className="grid gap-3" onSubmit={event => {
                  event.preventDefault();
                  updateSettings.mutate({
                    appName: settingsForm.appName,
                    appDescription: settingsForm.appDescription || null,
                    primaryColor: settingsForm.primaryColor,
                    secondaryColor: settingsForm.secondaryColor,
                    logoUrl: settingsForm.logoUrl || null,
                    openingBalanceCents: centsFromBRL(settingsForm.openingBalance),
                    matchHour: Number(settingsForm.matchHour),
                    matchMinute: Number(settingsForm.matchMinute),
                    confirmationHour: Number(settingsForm.confirmationHour),
                    confirmationMinute: Number(settingsForm.confirmationMinute),
                    arrivalMinutesBefore: Number(settingsForm.arrivalMinutesBefore),
                  });
                }}>
                  <Field label="Nome do app"><Input value={settingsForm.appName} onChange={e => setSettingsForm({ ...settingsForm, appName: e.target.value })} /></Field>
                  <Field label="Descrição"><Input value={settingsForm.appDescription} onChange={e => setSettingsForm({ ...settingsForm, appDescription: e.target.value })} /></Field>
                  <Field label="Saldo que já existe em caixa"><Input value={settingsForm.openingBalance} onChange={e => setSettingsForm({ ...settingsForm, openingBalance: e.target.value })} placeholder="Ex.: 350,00" /></Field>
                  <div className="grid gap-3 md:grid-cols-2"><Field label="Cor principal"><Input type="color" value={settingsForm.primaryColor} onChange={e => setSettingsForm({ ...settingsForm, primaryColor: e.target.value })} /></Field><Field label="Cor secundária"><Input type="color" value={settingsForm.secondaryColor} onChange={e => setSettingsForm({ ...settingsForm, secondaryColor: e.target.value })} /></Field></div>
                  <div className="grid gap-3 md:grid-cols-3"><Field label="Hora do jogo"><Input type="number" min="0" max="23" value={settingsForm.matchHour} onChange={e => setSettingsForm({ ...settingsForm, matchHour: e.target.value })} /></Field><Field label="Minuto"><Input type="number" min="0" max="59" value={settingsForm.matchMinute} onChange={e => setSettingsForm({ ...settingsForm, matchMinute: e.target.value })} /></Field><Field label="Chegar antes, em minutos"><Input type="number" min="0" max="180" value={settingsForm.arrivalMinutesBefore} onChange={e => setSettingsForm({ ...settingsForm, arrivalMinutesBefore: e.target.value })} /></Field></div>
                  <div className="grid gap-3 md:grid-cols-2"><Field label="Hora limite de confirmação"><Input type="number" min="0" max="23" value={settingsForm.confirmationHour} onChange={e => setSettingsForm({ ...settingsForm, confirmationHour: e.target.value })} /></Field><Field label="Minuto limite"><Input type="number" min="0" max="59" value={settingsForm.confirmationMinute} onChange={e => setSettingsForm({ ...settingsForm, confirmationMinute: e.target.value })} /></Field></div>
                  <Field label="URL da logo"><Input value={settingsForm.logoUrl} onChange={e => setSettingsForm({ ...settingsForm, logoUrl: e.target.value })} placeholder="/manus-storage/... ou link da imagem" /></Field>
                  <Button type="submit">Salvar configurações</Button>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Logo do grupo</CardTitle><CardDescription>Envie uma imagem PNG, JPG, WEBP ou SVG. Ela será guardada no armazenamento do projeto e usada no topo do app.</CardDescription></CardHeader>
              <CardContent className="grid gap-3">
                {settingsForm.logoUrl ? <img src={settingsForm.logoUrl} alt="Prévia da logo" className="h-32 w-32 rounded-2xl border object-contain p-2" /> : <div className="grid h-32 w-32 place-items-center rounded-2xl border text-sm text-muted-foreground">Sem logo</div>}
                <Input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={event => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const result = String(reader.result ?? "");
                    const base64 = result.split(",")[1];
                    if (base64) uploadLogo.mutate({ fileName: file.name, mimeType: file.type as "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml", dataBase64: base64 });
                  };
                  reader.readAsDataURL(file);
                }} />
              </CardContent>
            </Card>
          </TabsContent>
        )}'''
if 'value="config"' not in h:
    h = h.replace('\n        <TabsContent value="stats" className="grid gap-4 md:grid-cols-3">', config_block + '\n\n        <TabsContent value="stats" className="grid gap-4 md:grid-cols-3">')
home_path.write_text(h)
