import { describe, expect, it } from "vitest";
import { calculateFinanceSummary, canConfirmAttendance, generateTeams, generateTeamsWithWaitingList, guestsAreReleased, nextFridayMatch, selectRefereeRotation, summarizePlayerStats, type TeamCandidate } from "./futgestaoRules";

function candidate(id: number, type: TeamCandidate["type"], arrivalOrder = id): TeamCandidate {
  return { id, name: `Jogador ${id}`, type, arrivalOrder };
}

describe("futgestaoRules", () => {
  it("libera convidados quando todos os mensalistas já responderam antes do prazo", () => {
    const deadline = new Date("2026-05-08T18:00:00-03:00");

    expect(guestsAreReleased({
      now: new Date("2026-05-08T17:30:00-03:00"),
      confirmationDeadline: deadline,
      monthlyMemberStatuses: ["confirmed", "declined"],
    })).toBe(true);
  });

  it("bloqueia convidados antes do prazo quando existe mensalista pendente", () => {
    const deadline = new Date("2026-05-08T18:00:00-03:00");

    expect(guestsAreReleased({
      now: new Date("2026-05-08T17:30:00-03:00"),
      confirmationDeadline: deadline,
      monthlyMemberStatuses: ["confirmed", "pending"],
    })).toBe(false);
  });

  it("libera convidados automaticamente após sexta-feira às 18h", () => {
    const deadline = new Date("2026-05-08T18:00:00-03:00");

    expect(guestsAreReleased({
      now: new Date("2026-05-08T18:01:00-03:00"),
      confirmationDeadline: deadline,
      monthlyMemberStatuses: ["pending"],
    })).toBe(true);
  });

  it("gera times com um goleiro fixo e cinco jogadores de linha quando há goleiros disponíveis", () => {
    const teams = generateTeams([
      candidate(1, "goalkeeper", 1),
      candidate(2, "line", 2),
      candidate(3, "line", 3),
      candidate(4, "line", 4),
      candidate(5, "line", 5),
      candidate(6, "line", 6),
    ]);

    expect(teams).toHaveLength(1);
    expect(teams[0]?.name).toBe("A");
    expect(teams[0]?.players).toHaveLength(6);
    expect(teams[0]?.players.filter(player => player.role === "goalkeeper")).toHaveLength(1);
    expect(teams[0]?.players.filter(player => player.role === "line")).toHaveLength(5);
  });

  it("improvisa goleiro quando não existe goleiro fixo", () => {
    const teams = generateTeams([1, 2, 3, 4, 5, 6].map(id => candidate(id, "line", id)));

    expect(teams).toHaveLength(1);
    expect(teams[0]?.players[0]?.role).toBe("improvised_goalkeeper");
  });

  it("mantém dois goleiros fixos quando existem dois times completos", () => {
    const teams = generateTeams([
      candidate(1, "goalkeeper", 1),
      candidate(2, "goalkeeper", 2),
      ...[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(id => candidate(id, "line", id)),
    ]);

    expect(teams).toHaveLength(2);
    expect(teams[0]?.players.filter(player => player.role === "goalkeeper")).toHaveLength(1);
    expect(teams[1]?.players.filter(player => player.role === "goalkeeper")).toHaveLength(1);
  });

  it("forma dois times com um goleiro fixo e um goleiro improvisado quando só há um goleiro disponível", () => {
    const teams = generateTeams([
      candidate(1, "goalkeeper", 1),
      ...[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(id => candidate(id, "line", id)),
    ]);

    expect(teams).toHaveLength(2);
    expect(teams[0]?.players.filter(player => player.role === "goalkeeper")).toHaveLength(1);
    expect(teams[1]?.players.filter(player => player.role === "improvised_goalkeeper")).toHaveLength(1);
    expect(teams[1]?.players).toHaveLength(6);
  });

  it("retorna fila de espera explícita quando sobram jogadores após formar times", () => {
    const result = generateTeamsWithWaitingList([1, 2, 3, 4, 5, 6, 7, 8].map(id => candidate(id, "line", id)));

    expect(result.teams).toHaveLength(1);
    expect(result.waitingList.map(player => player.id)).toEqual([7, 8]);
  });

  it("respeita a ordem de chegada na montagem dos times", () => {
    const teams = generateTeams([
      candidate(10, "line", 10),
      candidate(1, "goalkeeper", 1),
      candidate(5, "line", 5),
      candidate(2, "line", 2),
      candidate(3, "line", 3),
      candidate(4, "line", 4),
    ]);

    expect(teams[0]?.players.map(player => player.id)).toEqual([1, 2, 3, 4, 5, 10]);
  });

  it("seleciona três jogadores autorizados que estão fora do jogo para arbitragem", () => {
    const selected = selectRefereeRotation({
      authorizedPlayerIds: [1, 2, 3, 4, 5],
      unavailablePlayerIds: [2, 3, 5],
      lastAssignedPlayerIds: [2],
    });

    expect(selected).toEqual([
      { playerId: 3, role: "referee1", rotationOrder: 1 },
      { playerId: 5, role: "referee2", rotationOrder: 2 },
      { playerId: 2, role: "scorekeeper", rotationOrder: 3 },
    ]);
  });

  it("calcula a próxima sexta-feira com prazo de confirmação e chegada antecipada", () => {
    const next = nextFridayMatch(new Date("2026-05-07T12:00:00-03:00"));

    expect(next.matchDate.getDay()).toBe(5);
    expect(next.matchDate.getHours()).toBe(20);
    expect(next.confirmationDeadline.getHours()).toBe(18);
    expect(next.arrivalDeadline.getMinutes()).toBe(45);
  });

  it("bloqueia confirmação de presença de jogador comum após sexta às 18h", () => {
    const result = canConfirmAttendance({
      now: new Date("2026-05-08T18:01:00-03:00"),
      confirmationDeadline: new Date("2026-05-08T18:00:00-03:00"),
      requestedStatus: "confirmed",
      isAdmin: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("sexta-feira às 18h");
  });

  it("permite que administrador confirme presença após o prazo quando necessário", () => {
    const result = canConfirmAttendance({
      now: new Date("2026-05-08T18:01:00-03:00"),
      confirmationDeadline: new Date("2026-05-08T18:00:00-03:00"),
      requestedStatus: "confirmed",
      isAdmin: true,
    });

    expect(result.allowed).toBe(true);
  });

  it("calcula receitas, despesas e saldo financeiro do grupo", () => {
    const summary = calculateFinanceSummary({
      payments: [
        { status: "confirmed", amountCents: 5000 },
        { status: "sent", amountCents: 5000 },
      ],
      guests: [
        { paid: true, amountCents: 1000 },
        { paid: false, amountCents: 1000 },
      ],
      expenses: [
        { amountCents: 3500 },
      ],
    });

    expect(summary).toEqual({
      confirmedPayments: 5000,
      paidGuests: 1000,
      totalRevenue: 6000,
      totalExpenses: 3500,
      balance: 2500,
    });
  });

  it("gera estatísticas de gols, cartões e presença por jogador", () => {
    const stats = summarizePlayerStats({
      players: [{ id: 1, name: "João" }, { id: 2, name: "Carlos" }],
      attendances: [
        { playerId: 1, status: "confirmed" },
        { playerId: 1, status: "declined" },
        { playerId: 2, status: "confirmed" },
      ],
      events: [
        { playerId: 1, type: "goal" },
        { playerId: 1, type: "yellow_card" },
        { playerId: 2, type: "red_card" },
        { playerId: null, type: "goal" },
      ],
    });

    expect(stats).toEqual([
      { playerId: 1, name: "João", goals: 1, yellowCards: 1, redCards: 0, confirmedPresence: 1 },
      { playerId: 2, name: "Carlos", goals: 0, yellowCards: 0, redCards: 1, confirmedPresence: 1 },
    ]);
  });
});
