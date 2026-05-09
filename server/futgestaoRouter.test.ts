import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

type MockChain<T> = PromiseLike<T> & {
  from: () => MockChain<T>;
  where: () => MockChain<T>;
  orderBy: () => MockChain<T>;
  limit: () => Promise<T>;
  values: (value: unknown) => MockChain<T>;
  set: (value: unknown) => MockChain<T>;
  onDuplicateKeyUpdate: (value: unknown) => Promise<T>;
};

const mockState = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  insertValues: [] as unknown[],
  updateSets: [] as unknown[],
}));

function chain<T>(result: T): MockChain<T> {
  const promise = Promise.resolve(result);
  const api: Partial<MockChain<T>> = {
    then: promise.then.bind(promise),
    from: () => api as MockChain<T>,
    where: () => api as MockChain<T>,
    orderBy: () => api as MockChain<T>,
    limit: () => promise,
    values: (value: unknown) => {
      mockState.insertValues.push(value);
      return api as MockChain<T>;
    },
    set: (value: unknown) => {
      mockState.updateSets.push(value);
      return api as MockChain<T>;
    },
    onDuplicateKeyUpdate: () => promise,
  };
  return api as MockChain<T>;
}

const dbMock = vi.hoisted(() => ({
  select: vi.fn(() => chain(mockState.selectQueue.shift() ?? [])),
  insert: vi.fn(() => chain({ affectedRows: 1 })),
  update: vi.fn(() => chain({ affectedRows: 1 })),
  delete: vi.fn(() => chain({ affectedRows: 1 })),
}));

vi.mock("./db", () => ({
  getDb: vi.fn(async () => dbMock),
}));

function createContext(role: "admin" | "user", id = role === "admin" ? 1 : 2): TrpcContext {
  const user: AuthenticatedUser = {
    id,
    openId: `${role}-${id}`,
    email: `${role}${id}@example.com`,
    name: `${role} ${id}`,
    loginMethod: "test",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

const match = {
  id: 10,
  title: "Pelada de sexta-feira",
  matchDate: new Date("2026-05-15T20:00:00-03:00"),
  confirmationDeadline: new Date(Date.now() + 60_000),
  arrivalDeadline: new Date("2026-05-15T19:45:00-03:00"),
  status: "scheduled",
  clockSeconds: 0,
  clockRunning: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("futgestao router mutations", () => {
  beforeEach(() => {
    mockState.selectQueue.length = 0;
    mockState.insertValues.length = 0;
    mockState.updateSets.length = 0;
    dbMock.select.mockClear();
    dbMock.insert.mockClear();
    dbMock.update.mockClear();
    dbMock.delete.mockClear();
  });

  it("registra presença confirmada mantendo horário, ordem de chegada e vínculo da partida", async () => {
    mockState.selectQueue.push(
      [match],
      [{ id: 20, name: "João", userId: 2, type: "line", active: true }],
      [],
      [{ value: 4 }],
    );
    const caller = appRouter.createCaller(createContext("user", 2));

    await expect(caller.futgestao.setAttendance({ playerId: 20, status: "confirmed" })).resolves.toEqual({ success: true });

    expect(mockState.insertValues.at(-1)).toMatchObject({
      matchId: 10,
      playerId: 20,
      status: "confirmed",
      arrivalOrder: 5,
    });
    expect((mockState.insertValues.at(-1) as { confirmedAt: Date }).confirmedAt).toBeInstanceOf(Date);
  });

  it("envia comprovante de mensalidade como status enviado para o próprio jogador", async () => {
    mockState.selectQueue.push([{ id: 30, name: "Carlos", userId: 2 }]);
    const caller = appRouter.createCaller(createContext("user", 2));

    await expect(caller.futgestao.submitPayment({
      playerId: 30,
      referenceMonth: "2026-05",
      amountCents: 8000,
      proofUrl: "comprovante-pix-123",
    })).resolves.toEqual({ success: true });

    expect(mockState.insertValues.at(-1)).toMatchObject({
      playerId: 30,
      referenceMonth: "2026-05",
      amountCents: 8000,
      proofUrl: "comprovante-pix-123",
      status: "sent",
    });
  });

  it("bloqueia despesa para jogador comum e permite despesa para administrador", async () => {
    const userCaller = appRouter.createCaller(createContext("user", 2));

    await expect(userCaller.futgestao.createExpense({
      category: "field",
      description: "Aluguel do campo",
      amountCents: 25000,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });

    mockState.selectQueue.push([match]);
    const adminCaller = appRouter.createCaller(createContext("admin", 1));

    await expect(adminCaller.futgestao.createExpense({
      category: "field",
      description: "Aluguel do campo",
      amountCents: 25000,
    })).resolves.toEqual({ success: true });

    expect(mockState.insertValues.at(-1)).toMatchObject({
      matchId: 10,
      category: "field",
      description: "Aluguel do campo",
      amountCents: 25000,
    });
  });

  it("persiste o cronômetro quando o administrador inicia ou pausa o jogo", async () => {
    mockState.selectQueue.push([match]);
    const caller = appRouter.createCaller(createContext("admin", 1));

    await expect(caller.futgestao.setClock({ clockSeconds: 615, clockRunning: true })).resolves.toEqual({ success: true });

    expect(mockState.updateSets.at(-1)).toMatchObject({
      clockSeconds: 615,
      clockRunning: true,
      status: "in_progress",
    });
  });

  it("cadastra convidado quando os mensalistas já responderam e registra o valor diário", async () => {
    mockState.selectQueue.push(
      [match],
      [{ id: 30, name: "Carlos", userId: 2, isMonthlyMember: true }],
      [{ id: 30, isMonthlyMember: true }],
      [{ playerId: 30, status: "confirmed" }],
    );
    const caller = appRouter.createCaller(createContext("user", 2));

    await expect(caller.futgestao.createGuest({ hostPlayerId: 30, name: "Visitante", amountCents: 1000 })).resolves.toEqual({ success: true });

    expect(mockState.insertValues.at(-1)).toMatchObject({
      matchId: 10,
      hostPlayerId: 30,
      name: "Visitante",
      amountCents: 1000,
    });
  });

  it("permite ao administrador revisar mensalidade enviada", async () => {
    const caller = appRouter.createCaller(createContext("admin", 1));

    await expect(caller.futgestao.reviewPayment({ paymentId: 70, status: "confirmed" })).resolves.toEqual({ success: true });

    expect(mockState.updateSets.at(-1)).toMatchObject({
      status: "confirmed",
      rejectionReason: null,
    });
  });

  it("gera times automáticos e persiste escalações com base em confirmados e convidados", async () => {
    const playerRows = [
      { id: 1, name: "Goleiro", type: "goalkeeper", active: true },
      ...Array.from({ length: 11 }, (_, index) => ({ id: index + 2, name: `Linha ${index + 2}`, type: "line", active: true })),
    ];
    mockState.selectQueue.push(
      [match],
      playerRows.map((player, index) => ({ playerId: player.id, status: "confirmed", arrivalOrder: index + 1, confirmedAt: new Date() })),
      playerRows,
      [],
      [{ id: 100, name: "A" }, { id: 101, name: "B" }],
    );
    const caller = appRouter.createCaller(createContext("admin", 1));

    await expect(caller.futgestao.generateTeams()).resolves.toEqual({ success: true, generatedCount: 2, waitingCount: 0 });

    expect(dbMock.delete).toHaveBeenCalled();
    expect(mockState.insertValues.some(value => !Array.isArray(value) && (value as { name?: string }).name === "A")).toBe(true);
    expect(mockState.insertValues.filter(value => !Array.isArray(value) && Boolean((value as { role?: string }).role))).toHaveLength(12);
  });

  it("define arbitragem em rodízio com jogadores autorizados fora dos times", async () => {
    mockState.selectQueue.push(
      [match],
      [
        { id: 1, name: "Jogador A", isRefereeAuthorized: true },
        { id: 2, name: "Jogador B", isRefereeAuthorized: true },
        { id: 3, name: "Jogador C", isRefereeAuthorized: true },
        { id: 4, name: "Jogador D", isRefereeAuthorized: true },
      ],
      [{ playerId: 1 }],
      [],
    );
    const caller = appRouter.createCaller(createContext("admin", 1));

    await expect(caller.futgestao.assignReferees()).resolves.toEqual({ success: true });

    expect(mockState.insertValues.slice(-3)).toMatchObject([
      { matchId: 10, playerId: 2, role: "referee1" },
      { matchId: 10, playerId: 3, role: "referee2" },
      { matchId: 10, playerId: 4, role: "scorekeeper" },
    ]);
  });

  it("registra eventos de jogo quando acionado por administrador", async () => {
    mockState.selectQueue.push([match]);
    const caller = appRouter.createCaller(createContext("admin", 1));

    await expect(caller.futgestao.recordEvent({ type: "goal", minute: 12, playerId: 5, teamId: 3 })).resolves.toEqual({ success: true });

    expect(mockState.insertValues.at(-1)).toMatchObject({
      matchId: 10,
      type: "goal",
      minute: 12,
      playerId: 5,
      teamId: 3,
    });
  });
});
