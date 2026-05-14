export type PlayerType = "line" | "goalkeeper" | "both";
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { addDays, set, getDate, getMonth, getYear } from 'date-fns';

export type AttendanceStatus = "confirmed" | "pending" | "declined";

export type TeamCandidate = {
  id: number;
  name: string;
  type: PlayerType;
  arrivalOrder: number;
  isGuest?: boolean;
};

export type GeneratedTeamPlayer = TeamCandidate & {
  role: "line" | "goalkeeper" | "improvised_goalkeeper";
};

export type GeneratedTeam = {
  name: string;
  playOrder: number;
  players: GeneratedTeamPlayer[];
};

export type GeneratedTeamsResult = {
  teams: GeneratedTeam[];
  waitingList: TeamCandidate[];
};

const TEAM_NAMES = ["A", "B", "C", "D", "E", "F", "G", "H"];

function canPlayGoal(player: TeamCandidate) {
  return player.type === "goalkeeper" || player.type === "both";
}

function canPlayLine(player: TeamCandidate) {
  return player.type === "line" || player.type === "both";
}

function removeCandidate(candidates: TeamCandidate[], candidate: TeamCandidate | undefined) {
  if (!candidate) return candidates;
  return candidates.filter(item => item.id !== candidate.id || item.isGuest !== candidate.isGuest);
}

function pickGoalkeeper(candidates: TeamCandidate[], fixedGoalkeepersUsed: number) {
  const goalkeepers = candidates.filter(canPlayGoal);
  if (goalkeepers.length >= Math.max(0, 2 - fixedGoalkeepersUsed)) {
    return { player: goalkeepers[0], role: "goalkeeper" as const };
  }
  if (goalkeepers.length === 1) {
    return { player: goalkeepers[0], role: "goalkeeper" as const };
  }
  return { player: undefined, role: undefined };
}

export function generateTeamsWithWaitingList(candidates: TeamCandidate[]): GeneratedTeamsResult {
  let pool = [...candidates].sort((a, b) => a.arrivalOrder - b.arrivalOrder);
  const fixedGoalkeeperCount = pool.filter(canPlayGoal).length;
  let fixedGoalkeepersUsed = 0;
  const result: GeneratedTeam[] = [];

  while (pool.length >= 6 && result.length < TEAM_NAMES.length) {
    const teamPlayers: GeneratedTeamPlayer[] = [];
    const goalkeeperPick = pickGoalkeeper(pool, fixedGoalkeepersUsed);

    if (goalkeeperPick.player) {
      teamPlayers.push({ ...goalkeeperPick.player, role: goalkeeperPick.role ?? "goalkeeper" });
      pool = removeCandidate(pool, goalkeeperPick.player);
      fixedGoalkeepersUsed += 1;
    }

    const lineTarget = goalkeeperPick.player ? 5 : 6;
    const availableLine = pool.filter(canPlayLine);
    const selectedLine = availableLine.slice(0, lineTarget);

    if (selectedLine.length < lineTarget) {
      const needed = lineTarget - selectedLine.length;
      const fallback = pool
        .filter(player => !selectedLine.some(line => line.id === player.id && line.isGuest === player.isGuest))
        .slice(0, needed);
      selectedLine.push(...fallback);
    }

    for (const player of selectedLine) {
      teamPlayers.push({ ...player, role: "line" });
      pool = removeCandidate(pool, player);
    }

    if (!goalkeeperPick.player && teamPlayers.length === 6) {
      const improvised = teamPlayers[0];
      if (improvised) {
        improvised.role = "improvised_goalkeeper";
      }
    }

    if (teamPlayers.length < 6) break;

    result.push({
      name: TEAM_NAMES[result.length] ?? `T${result.length + 1}`,
      playOrder: result.length + 1,
      players: teamPlayers,
    });
  }

  return { teams: result, waitingList: pool };
}

export function generateTeams(candidates: TeamCandidate[]): GeneratedTeam[] {
  return generateTeamsWithWaitingList(candidates).teams;
}

export function guestsAreReleased(params: {
  now: Date;
  confirmationDeadline: Date;
  monthlyMemberStatuses: AttendanceStatus[];
}) {
  if (params.now.getTime() >= params.confirmationDeadline.getTime()) return true;
  if (params.monthlyMemberStatuses.length === 0) return false;
  return params.monthlyMemberStatuses.every(status => status !== "pending");
}

export function selectRefereeRotation(params: {
  authorizedPlayerIds: number[];
  unavailablePlayerIds: number[];
  lastAssignedPlayerIds: number[];
}) {
  const available = params.authorizedPlayerIds.filter(id => params.unavailablePlayerIds.includes(id));
  const sorted = [...available].sort((a, b) => {
    const lastA = params.lastAssignedPlayerIds.lastIndexOf(a);
    const lastB = params.lastAssignedPlayerIds.lastIndexOf(b);
    return lastA - lastB;
  });

  return sorted.slice(0, 3).map((playerId, index) => ({
    playerId,
    role: (["referee1", "referee2", "scorekeeper"] as const)[index],
    rotationOrder: index + 1,
  }));
}

export function nextFridayMatch(now = new Date(), options?: {
  matchHour?: number;
  matchMinute?: number;
  confirmationHour?: number;
  confirmationMinute?: number;
  arrivalMinutesBefore?: number;
}) {
  const timezone = 'America/Sao_Paulo';
  const matchHour = options?.matchHour ?? 20;
  const matchMinute = options?.matchMinute ?? 0;
  const confirmationHour = options?.confirmationHour ?? 18;
  const confirmationMinute = options?.confirmationMinute ?? 0;
  const arrivalMinutesBefore = options?.arrivalMinutesBefore ?? 15;
  
  // Converter agora para BRT para calcular o dia da semana
  const nowBRT = toZonedTime(now, timezone);
  const day = nowBRT.getDay();
  
  // Calcular próxima sexta
  let diff = (5 - day + 7) % 7;
  
  // Se diff é 0 (hoje é sexta), verificar se já passou do horário do jogo
  if (diff === 0) {
    const tentative = set(nowBRT, { 
      hours: matchHour, 
      minutes: matchMinute, 
      seconds: 0, 
      milliseconds: 0 
    });
    if (tentative.getTime() <= nowBRT.getTime()) {
      diff = 7; // Próxima sexta
    }
  }
  
  // IMPORTANTE: Adicionar dias em UTC, não em BRT
  const fridayUTC = addDays(now, diff);
  
  // Converter para BRT para setar a hora
  const fridayBRT = toZonedTime(fridayUTC, timezone);
  
  // Criar as datas com horários em BRT
  const matchDateBRT = set(fridayBRT, {
    hours: matchHour,
    minutes: matchMinute,
    seconds: 0,
    milliseconds: 0
  });
  
  const confirmationDateBRT = set(fridayBRT, { 
    hours: confirmationHour, 
    minutes: confirmationMinute, 
    seconds: 0, 
    milliseconds: 0 
  });
  
  const arrivalDateBRT = set(fridayBRT, {
    hours: matchHour,
    minutes: matchMinute - arrivalMinutesBefore,
    seconds: 0,
    milliseconds: 0
  });
  
  // Converter para UTC para armazenar no banco
  const matchDate = fromZonedTime(matchDateBRT, timezone);
  const confirmationDeadline = fromZonedTime(confirmationDateBRT, timezone);
  const arrivalDeadline = fromZonedTime(arrivalDateBRT, timezone);
  
  // IMPORTANTE: O Drizzle converte Date para ISO string sem Z
  // O MySQL interpreta como local time e adiciona o offset
  // Solucao: Subtrair 3 horas (offset BRT) para compensar
  const offset = 3 * 60 * 60 * 1000; // 3 horas em ms
  return {
    matchDate: new Date(matchDate.getTime() - offset),
    confirmationDeadline: new Date(confirmationDeadline.getTime() - offset),
    arrivalDeadline: new Date(arrivalDeadline.getTime() - offset),
  };
}

export function canConfirmAttendance(params: {
  now: Date;
  confirmationDeadline: Date;
  requestedStatus: AttendanceStatus;
  isAdmin: boolean;
}) {
  if (params.requestedStatus !== "confirmed") return { allowed: true, reason: null } as const;
  if (params.isAdmin) return { allowed: true, reason: null } as const;
  if (params.now.getTime() <= params.confirmationDeadline.getTime()) return { allowed: true, reason: null } as const;
  return {
    allowed: false,
    reason: "O prazo de confirmação encerrou sexta-feira às 18h. Procure o administrador para verificar vaga.",
  } as const;
}

export function calculateFinanceSummary(params: {
  payments: Array<{ status: "pending" | "sent" | "confirmed" | "rejected"; amountCents: number }>;
  guests: Array<{ paid: boolean; amountCents: number }>;
  expenses: Array<{ amountCents: number }>;
  openingBalanceCents?: number;
}) {
  const confirmedPayments = params.payments.filter(payment => payment.status === "confirmed").reduce((sum, payment) => sum + payment.amountCents, 0);
  const paidGuests = params.guests.filter(guest => guest.paid).reduce((sum, guest) => sum + guest.amountCents, 0);
  const totalExpenses = params.expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
  const openingBalanceCents = params.openingBalanceCents ?? 0;
  const totalRevenue = confirmedPayments + paidGuests;
  return {
    openingBalanceCents,
    confirmedPayments,
    paidGuests,
    totalRevenue,
    totalExpenses,
    balance: openingBalanceCents + totalRevenue - totalExpenses,
  };
}

export function summarizePlayerStats(params: {
  players: Array<{ id: number; name: string }>;
  attendances: Array<{ playerId: number; status: AttendanceStatus }>;
  events: Array<{ playerId: number | null; type: "goal" | "yellow_card" | "red_card" }>;
}) {
  return params.players.map(player => {
    const playerAttendances = params.attendances.filter(item => item.playerId === player.id);
    const playerEvents = params.events.filter(item => item.playerId === player.id);
    return {
      playerId: player.id,
      name: player.name,
      goals: playerEvents.filter(item => item.type === "goal").length,
      yellowCards: playerEvents.filter(item => item.type === "yellow_card").length,
      redCards: playerEvents.filter(item => item.type === "red_card").length,
      confirmedPresence: playerAttendances.filter(item => item.status === "confirmed").length,
    };
  });
}
