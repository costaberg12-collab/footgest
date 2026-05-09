import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Activity, Banknote, CalendarClock, ClipboardList, Goal, ShieldCheck, Trophy, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type PlayerType = "line" | "goalkeeper" | "both";
type PresenceStatus = "confirmed" | "pending" | "declined";

type FormState = {
  name: string;
  phone: string;
  type: PlayerType;
  monthlyFee: string;
  isMonthlyMember: boolean;
  isRefereeAuthorized: boolean;
};

const initialPlayerForm: FormState = {
  name: "",
  phone: "",
  type: "line",
  monthlyFee: "80",
  isMonthlyMember: true,
  isRefereeAuthorized: false,
};

function centsFromBRL(value: string) {
  const normalized = Number(value.replace(".", "").replace(",", "."));
  return Number.isFinite(normalized) ? Math.round(normalized * 100) : 0;
}

function money(cents = 0) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateTime(value?: Date | string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const typeLabel: Record<PlayerType, string> = {
  line: "Linha",
  goalkeeper: "Goleiro",
  both: "Linha e goleiro",
};

const presenceLabel: Record<PresenceStatus, string> = {
  confirmed: "Confirmado",
  pending: "Pendente",
  declined: "Não vai",
};

const presenceTone: Record<PresenceStatus, string> = {
  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  pending: "bg-amber-100 text-amber-900 border-amber-200",
  declined: "bg-rose-100 text-rose-800 border-rose-200",
};

export default function Home() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const overview = trpc.futgestao.overview.useQuery(undefined, { refetchInterval: 20000 });
  const stats = trpc.futgestao.stats.useQuery();

  const createPlayer = trpc.futgestao.createPlayer.useMutation({ onSuccess: () => refresh("Jogador cadastrado.") });
  const createMyPlayer = trpc.futgestao.createMyPlayer.useMutation({ onSuccess: () => refresh("Seu cadastro foi salvo.") });
  const setAttendance = trpc.futgestao.setAttendance.useMutation({ onSuccess: () => refresh("Presença atualizada.") });
  const markArrived = trpc.futgestao.markArrived.useMutation({ onSuccess: () => refresh("Chegada registrada.") });
  const createGuest = trpc.futgestao.createGuest.useMutation({ onSuccess: () => refresh("Convidado cadastrado.") });
  const setGuestPaid = trpc.futgestao.setGuestPaid.useMutation({ onSuccess: () => refresh("Pagamento do convidado atualizado.") });
  const submitPayment = trpc.futgestao.submitPayment.useMutation({ onSuccess: () => refresh("Comprovante enviado.") });
  const reviewPayment = trpc.futgestao.reviewPayment.useMutation({ onSuccess: () => refresh("Mensalidade revisada.") });
  const createExpense = trpc.futgestao.createExpense.useMutation({ onSuccess: () => refresh("Despesa registrada.") });
  const generateTeams = trpc.futgestao.generateTeams.useMutation({ onSuccess: data => refresh(`${data.generatedCount} time(s) gerado(s).`) });
  const assignReferees = trpc.futgestao.assignReferees.useMutation({ onSuccess: () => refresh("Arbitragem definida.") });
  const setClock = trpc.futgestao.setClock.useMutation({ onSuccess: () => refresh("Cronômetro salvo.") });
  const recordEvent = trpc.futgestao.recordEvent.useMutation({ onSuccess: () => refresh("Evento registrado.") });

  const [playerForm, setPlayerForm] = useState<FormState>(initialPlayerForm);
  const [guestForm, setGuestForm] = useState({ hostPlayerId: "0", name: "", amount: "10" });
  const [paymentForm, setPaymentForm] = useState({ playerId: "0", referenceMonth: new Date().toISOString().slice(0, 7), amount: "80", proofUrl: "" });
  const [expenseForm, setExpenseForm] = useState({ category: "field", description: "", amount: "" });
  const [eventForm, setEventForm] = useState({ type: "goal", minute: "0", playerId: "0", teamId: "0" });
  const [clockSeconds, setClockSeconds] = useState(0);

  function refresh(message: string) {
    toast.success(message);
    utils.futgestao.overview.invalidate();
    utils.futgestao.stats.invalidate();
  }

  const data = overview.data;

  useEffect(() => {
    if (!data?.match) return;
    const savedSeconds = data.match.clockSeconds ?? 0;
    const updatedAt = data.match.updatedAt ? new Date(data.match.updatedAt).getTime() : Date.now();
    const elapsed = data.match.clockRunning ? Math.max(0, Math.floor((Date.now() - updatedAt) / 1000)) : 0;
    setClockSeconds(savedSeconds + elapsed);
  }, [data?.match.id, data?.match.clockSeconds, data?.match.clockRunning, data?.match.updatedAt]);

  useEffect(() => {
    if (!data?.match.clockRunning) return;
    const timer = window.setInterval(() => setClockSeconds(seconds => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [data?.match.clockRunning]);

  const isAdmin = user?.role === "admin";
  const confirmedCount = data?.players.filter(player => player.attendance?.status === "confirmed").length ?? 0;
  const pendingCount = data?.players.filter(player => (player.attendance?.status ?? "pending") === "pending").length ?? 0;
  const declinedCount = data?.players.filter(player => player.attendance?.status === "declined").length ?? 0;
  const myPlayer = data?.players.find(player => player.userId === user?.id);

  const availableEventPlayers = useMemo(() => {
    if (!data) return [];
    const ids = new Set(data.teams.flatMap(team => team.players.map(item => item.playerId).filter(Boolean)));
    return data.players.filter(player => ids.has(player.id));
  }, [data]);

  if (overview.isLoading) {
    return <div className="grid min-h-[60vh] place-items-center text-muted-foreground">Carregando o FutGestão...</div>;
  }

  if (overview.error || !data) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle>Não foi possível carregar o sistema</CardTitle>
          <CardDescription>{overview.error?.message ?? "Erro desconhecido."}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <section className="overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_top_left,#22c55e_0,#0f3d26_42%,#081b13_100%)] p-5 text-white shadow-2xl md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr] lg:items-end">
          <div className="space-y-4">
            <Badge className="border-white/20 bg-white/15 text-white hover:bg-white/20">Pelada de sexta-feira</Badge>
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">FutGestão</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50 md:text-base">
                Controle a confirmação, os convidados, o caixa, os times, a arbitragem e as estatísticas da sua turma em um único painel responsivo para web e celular.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <HeroMetric icon={CalendarClock} label="Jogo" value={dateTime(data.match.matchDate)} />
              <HeroMetric icon={ShieldCheck} label="Confirmar até" value={dateTime(data.match.confirmationDeadline)} />
              <HeroMetric icon={Activity} label="Chegar antes" value={dateTime(data.match.arrivalDeadline)} />
            </div>
          </div>
          <Card className="border-white/20 bg-white/95 text-foreground shadow-xl">
            <CardHeader>
              <CardTitle>Status da rodada</CardTitle>
              <CardDescription>Convidados são liberados após os mensalistas responderem ou após sexta às 18h.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <StatusRow label="Confirmados" value={confirmedCount} tone="text-emerald-700" />
              <StatusRow label="Pendentes" value={pendingCount} tone="text-amber-700" />
              <StatusRow label="Não vão" value={declinedCount} tone="text-rose-700" />
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Convidados</span>
                <Badge className={data.guestsReleased ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}>{data.guestsReleased ? "Liberados" : "Aguardando"}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard icon={Users} label="Jogadores ativos" value={data.players.length.toString()} detail={`${confirmedCount} confirmados`} />
        <SummaryCard icon={Banknote} label="Saldo do grupo" value={money(data.finance.balance)} detail={`${money(data.finance.totalRevenue)} em receitas`} />
        <SummaryCard icon={Goal} label="Times gerados" value={data.teams.length.toString()} detail={`${data.waitingList.length} na fila de espera`} />
        <SummaryCard icon={Trophy} label="Eventos de jogo" value={data.events.length.toString()} detail="Gols e cartões" />
      </div>

      <Tabs defaultValue="presenca" className="space-y-4">
        <TabsList className="grid h-auto grid-cols-2 gap-2 rounded-2xl bg-muted p-2 md:grid-cols-7">
          <TabsTrigger value="presenca">Presença</TabsTrigger>
          <TabsTrigger value="jogadores">Jogadores</TabsTrigger>
          <TabsTrigger value="convidados">Convidados</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="times">Times</TabsTrigger>
          <TabsTrigger value="jogo">Jogo</TabsTrigger>
          <TabsTrigger value="stats">Estatísticas</TabsTrigger>
        </TabsList>

        <TabsContent value="presenca">
          <Card>
            <CardHeader>
              <CardTitle>Confirmação de presença</CardTitle>
              <CardDescription>O sistema registra o horário da confirmação e mantém a ordem de chegada para formar os times.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {data.players.map(player => {
                const status = (player.attendance?.status ?? "pending") as PresenceStatus;
                return (
                  <div key={player.id} className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{player.name}</h3>
                        <Badge variant="outline">{typeLabel[player.type]}</Badge>
                        <Badge className={presenceTone[status]}>{presenceLabel[status]}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Confirmado em {dateTime(player.attendance?.confirmedAt)} · Ordem {player.attendance?.arrivalOrder ?? "-"} · Chegada presencial {dateTime(player.attendance?.arrivedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => setAttendance.mutate({ playerId: player.id, status: "confirmed" })}>Confirmar</Button>
                      <Button size="sm" variant="secondary" onClick={() => setAttendance.mutate({ playerId: player.id, status: "pending" })}>Pendente</Button>
                      <Button size="sm" variant="outline" onClick={() => setAttendance.mutate({ playerId: player.id, status: "declined" })}>Não vou</Button>
                      {isAdmin && <Button size="sm" variant="ghost" onClick={() => markArrived.mutate({ playerId: player.id })}>Chegou</Button>}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jogadores" className="grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle>{isAdmin ? "Cadastrar jogador" : "Meu cadastro de jogador"}</CardTitle>
              <CardDescription>Classifique cada atleta como linha, goleiro ou ambos. Administradores também definem mensalistas e árbitros autorizados.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3" onSubmit={event => {
                event.preventDefault();
                const payload = {
                  name: playerForm.name,
                  phone: playerForm.phone || null,
                  type: playerForm.type,
                  monthlyFeeCents: centsFromBRL(playerForm.monthlyFee),
                  isMonthlyMember: playerForm.isMonthlyMember,
                  isRefereeAuthorized: playerForm.isRefereeAuthorized,
                };
                if (isAdmin) createPlayer.mutate(payload);
                else createMyPlayer.mutate(payload);
                setPlayerForm(initialPlayerForm);
              }}>
                <Field label="Nome"><Input value={playerForm.name} onChange={e => setPlayerForm({ ...playerForm, name: e.target.value })} required /></Field>
                <Field label="Telefone"><Input value={playerForm.phone} onChange={e => setPlayerForm({ ...playerForm, phone: e.target.value })} /></Field>
                <Field label="Tipo">
                  <Select value={playerForm.type} onValueChange={value => setPlayerForm({ ...playerForm, type: value as PlayerType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="line">Linha</SelectItem>
                      <SelectItem value="goalkeeper">Goleiro</SelectItem>
                      <SelectItem value="both">Linha e goleiro</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Mensalidade"><Input value={playerForm.monthlyFee} onChange={e => setPlayerForm({ ...playerForm, monthlyFee: e.target.value })} /></Field>
                <div className="grid gap-2 rounded-xl bg-muted p-3 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={playerForm.isMonthlyMember} onChange={e => setPlayerForm({ ...playerForm, isMonthlyMember: e.target.checked })} /> Mensalista</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={playerForm.isRefereeAuthorized} onChange={e => setPlayerForm({ ...playerForm, isRefereeAuthorized: e.target.checked })} /> Pode apitar</label>
                </div>
                <Button type="submit">Salvar jogador</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Elenco</CardTitle>
              <CardDescription>{myPlayer ? `Seu jogador vinculado: ${myPlayer.name}` : "Jogadores cadastrados no grupo."}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {data.players.map(player => (
                <div key={player.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
                  <div>
                    <p className="font-medium">{player.name}</p>
                    <p className="text-xs text-muted-foreground">{typeLabel[player.type]} · {player.isMonthlyMember ? `Mensalista ${money(player.monthlyFeeCents)}` : "Avulso"}</p>
                  </div>
                  <div className="flex gap-2">
                    {player.isRefereeAuthorized && <Badge variant="outline">Árbitro</Badge>}
                    {player.userId === user?.id && <Badge>Meu perfil</Badge>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="convidados" className="grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Cadastrar convidado</CardTitle>
              <CardDescription>O cadastro só é aceito quando os convidados estiverem liberados pela regra da rodada.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3" onSubmit={event => {
                event.preventDefault();
                createGuest.mutate({ hostPlayerId: Number(guestForm.hostPlayerId), name: guestForm.name, amountCents: centsFromBRL(guestForm.amount) });
                setGuestForm({ hostPlayerId: "0", name: "", amount: "10" });
              }}>
                <Field label="Quem convidou">
                  <Select value={guestForm.hostPlayerId} onValueChange={value => setGuestForm({ ...guestForm, hostPlayerId: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{data.players.map(player => <SelectItem key={player.id} value={String(player.id)}>{player.name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Nome do convidado"><Input value={guestForm.name} onChange={e => setGuestForm({ ...guestForm, name: e.target.value })} required /></Field>
                <Field label="Valor por dia"><Input value={guestForm.amount} onChange={e => setGuestForm({ ...guestForm, amount: e.target.value })} /></Field>
                <Button type="submit" disabled={!data.guestsReleased}>Cadastrar convidado</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Convidados da rodada</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {data.guests.length === 0 && <p className="text-sm text-muted-foreground">Nenhum convidado cadastrado.</p>}
              {data.guests.map(guest => (
                <div key={guest.id} className="flex items-center justify-between rounded-xl border p-3">
                  <div><p className="font-medium">{guest.name}</p><p className="text-xs text-muted-foreground">Valor {money(guest.amountCents)}</p></div>
                  <Button variant={guest.paid ? "secondary" : "outline"} size="sm" disabled={!isAdmin} onClick={() => setGuestPaid.mutate({ guestId: guest.id, paid: !guest.paid })}>{guest.paid ? "Pago" : "Marcar pago"}</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financeiro" className="grid gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Enviar comprovante</CardTitle><CardDescription>O administrador confirma ou rejeita o pagamento enviado.</CardDescription></CardHeader>
            <CardContent>
              <form className="grid gap-3" onSubmit={event => {
                event.preventDefault();
                submitPayment.mutate({ playerId: Number(paymentForm.playerId), referenceMonth: paymentForm.referenceMonth, amountCents: centsFromBRL(paymentForm.amount), proofUrl: paymentForm.proofUrl });
              }}>
                <Field label="Jogador"><Select value={paymentForm.playerId} onValueChange={value => setPaymentForm({ ...paymentForm, playerId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{data.players.map(player => <SelectItem key={player.id} value={String(player.id)}>{player.name}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="Mês"><Input type="month" value={paymentForm.referenceMonth} onChange={e => setPaymentForm({ ...paymentForm, referenceMonth: e.target.value })} /></Field>
                <Field label="Valor"><Input value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} /></Field>
                <Field label="Link ou identificação do comprovante"><Input value={paymentForm.proofUrl} onChange={e => setPaymentForm({ ...paymentForm, proofUrl: e.target.value })} required /></Field>
                <Button type="submit">Enviar comprovante</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Registrar despesa</CardTitle><CardDescription>Campo, materiais e outros gastos entram no saldo automático.</CardDescription></CardHeader>
            <CardContent>
              <form className="grid gap-3" onSubmit={event => {
                event.preventDefault();
                createExpense.mutate({ category: expenseForm.category as "field" | "materials" | "other", description: expenseForm.description, amountCents: centsFromBRL(expenseForm.amount) });
                setExpenseForm({ category: "field", description: "", amount: "" });
              }}>
                <Field label="Categoria"><Select value={expenseForm.category} onValueChange={value => setExpenseForm({ ...expenseForm, category: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="field">Campo</SelectItem><SelectItem value="materials">Materiais</SelectItem><SelectItem value="other">Outros</SelectItem></SelectContent></Select></Field>
                <Field label="Descrição"><Input value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} required /></Field>
                <Field label="Valor"><Input value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} required /></Field>
                <Button type="submit" disabled={!isAdmin}>Registrar despesa</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Caixa do grupo</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <StatusRow label="Mensalidades confirmadas" value={money(data.finance.confirmedPayments)} tone="text-emerald-700" />
              <StatusRow label="Convidados pagos" value={money(data.finance.paidGuests)} tone="text-emerald-700" />
              <StatusRow label="Despesas" value={money(data.finance.totalExpenses)} tone="text-rose-700" />
              <Separator />
              <StatusRow label="Saldo" value={money(data.finance.balance)} tone="text-primary" />
            </CardContent>
          </Card>
          <Card className="xl:col-span-3">
            <CardHeader><CardTitle>Mensalidades e comprovantes</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {data.payments.map(payment => {
                const player = data.players.find(item => item.id === payment.playerId);
                return <div key={payment.id} className="grid gap-2 rounded-xl border p-3 md:grid-cols-[1fr_auto] md:items-center"><div><p className="font-medium">{player?.name ?? "Jogador"} · {payment.referenceMonth}</p><p className="text-xs text-muted-foreground">{money(payment.amountCents)} · status {payment.status} · comprovante: {payment.proofUrl ?? "-"}</p></div>{isAdmin && <div className="flex gap-2"><Button size="sm" onClick={() => reviewPayment.mutate({ paymentId: payment.id, status: "confirmed" })}>Confirmar</Button><Button size="sm" variant="outline" onClick={() => reviewPayment.mutate({ paymentId: payment.id, status: "rejected", rejectionReason: "Rejeitado pelo administrador" })}>Rejeitar</Button></div>}</div>;
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="times" className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
          <Card>
            <CardHeader><CardTitle>Organização automática</CardTitle><CardDescription>Primeiros confirmados jogam primeiro. O algoritmo prioriza goleiros e completa times com 5 linha + 1 goleiro ou 6 sem goleiro.</CardDescription></CardHeader>
            <CardContent className="grid gap-3">
              <Button disabled={!isAdmin} onClick={() => generateTeams.mutate()}>Gerar times</Button>
              <Button disabled={!isAdmin || data.teams.length === 0} variant="secondary" onClick={() => assignReferees.mutate()}>Definir arbitragem</Button>
              <div className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">Times A, B, C e D são criados conforme a quantidade de atletas confirmados. Jogadores fora dos times aparecem na fila de espera e podem ser usados na arbitragem.</div>
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            {data.teams.length === 0 && <Card><CardHeader><CardTitle>Nenhum time gerado</CardTitle><CardDescription>Confirme jogadores e clique em gerar times.</CardDescription></CardHeader></Card>}
            {data.teams.map(team => (
              <Card key={team.id}>
                <CardHeader><CardTitle>Time {team.name}</CardTitle><CardDescription>Ordem de jogo {team.playOrder}</CardDescription></CardHeader>
                <CardContent className="grid gap-2">
                  {team.players.map(item => {
                    const player = item.playerId ? data.players.find(row => row.id === item.playerId) : undefined;
                    const guest = item.guestId ? data.guests.find(row => row.id === item.guestId) : undefined;
                    return <div key={item.id} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm"><span>{player?.name ?? guest?.name ?? "Atleta"}</span><Badge variant="outline">{item.role === "goalkeeper" ? "Goleiro" : item.role === "improvised_goalkeeper" ? "Goleiro improvisado" : "Linha"}</Badge></div>;
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Fila de espera</CardTitle><CardDescription>Atletas confirmados ou convidados que ficaram fora dos times pela ordem de chegada.</CardDescription></CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-3">
              {data.waitingList.length === 0 && <p className="text-sm text-muted-foreground">Nenhum atleta na fila de espera.</p>}
              {data.waitingList.map(item => <div key={`${item.kind}-${item.id}`} className="rounded-xl border p-3"><p className="font-medium">{item.name}</p><p className="text-sm text-muted-foreground">{item.kind === "guest" ? "Convidado" : typeLabel[item.type as PlayerType]} · ordem {item.arrivalOrder}</p></div>)}
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Arbitragem</CardTitle><CardDescription>Rodízio com árbitro 1, árbitro 2 e mesário entre jogadores autorizados que estão fora do jogo.</CardDescription></CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-3">
              {data.referees.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma escala de arbitragem definida.</p>}
              {data.referees.map(ref => <div key={ref.id} className="rounded-xl border p-3"><p className="font-medium">{ref.role === "referee1" ? "Árbitro 1" : ref.role === "referee2" ? "Árbitro 2" : "Mesário"}</p><p className="text-sm text-muted-foreground">{data.players.find(player => player.id === ref.playerId)?.name ?? "Jogador"}</p></div>)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jogo" className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
          <Card>
            <CardHeader><CardTitle>Controle do mesário</CardTitle><CardDescription>Cronômetro simples com persistência do tempo salvo no banco.</CardDescription></CardHeader>
            <CardContent className="grid gap-3">
              <div className="rounded-2xl bg-slate-950 p-6 text-center font-mono text-5xl font-black text-emerald-300">{String(Math.floor(clockSeconds / 60)).padStart(2, "0")}:{String(clockSeconds % 60).padStart(2, "0")}</div>
              <Badge className={data.match.clockRunning ? "w-fit bg-emerald-100 text-emerald-800" : "w-fit bg-slate-100 text-slate-700"}>{data.match.clockRunning ? "Cronômetro rodando" : "Cronômetro pausado"}</Badge>
              <div className="grid grid-cols-3 gap-2"><Button onClick={() => setClockSeconds(clockSeconds + 60)}>+1 min</Button><Button variant="secondary" onClick={() => setClockSeconds(Math.max(0, clockSeconds - 60))}>-1 min</Button><Button variant="outline" onClick={() => { setClockSeconds(0); setClock.mutate({ clockSeconds: 0, clockRunning: false }); }}>Zerar</Button></div>
              <div className="grid grid-cols-2 gap-2"><Button onClick={() => setClock.mutate({ clockSeconds, clockRunning: true })}>Iniciar / retomar</Button><Button variant="secondary" onClick={() => setClock.mutate({ clockSeconds, clockRunning: false })}>Pausar e salvar</Button></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Registrar gol ou cartão</CardTitle></CardHeader>
            <CardContent>
              <form className="grid gap-3" onSubmit={event => {
                event.preventDefault();
                recordEvent.mutate({ type: eventForm.type as "goal" | "yellow_card" | "red_card", minute: Number(eventForm.minute), teamId: eventForm.teamId === "0" ? null : Number(eventForm.teamId), playerId: eventForm.playerId === "0" ? null : Number(eventForm.playerId) });
              }}>
                <Field label="Tipo"><Select value={eventForm.type} onValueChange={value => setEventForm({ ...eventForm, type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="goal">Gol</SelectItem><SelectItem value="yellow_card">Cartão amarelo</SelectItem><SelectItem value="red_card">Cartão vermelho</SelectItem></SelectContent></Select></Field>
                <Field label="Minuto"><Input type="number" value={eventForm.minute} onChange={e => setEventForm({ ...eventForm, minute: e.target.value })} /></Field>
                <Field label="Time"><Select value={eventForm.teamId} onValueChange={value => setEventForm({ ...eventForm, teamId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">Sem time</SelectItem>{data.teams.map(team => <SelectItem key={team.id} value={String(team.id)}>Time {team.name}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="Jogador"><Select value={eventForm.playerId} onValueChange={value => setEventForm({ ...eventForm, playerId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">Sem jogador</SelectItem>{availableEventPlayers.map(player => <SelectItem key={player.id} value={String(player.id)}>{player.name}</SelectItem>)}</SelectContent></Select></Field>
                <Button type="submit">Registrar evento</Button>
              </form>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Histórico da partida</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {data.events.map(event => <div key={event.id} className="flex items-center justify-between rounded-xl border p-3"><span>{event.type === "goal" ? "Gol" : event.type === "yellow_card" ? "Cartão amarelo" : "Cartão vermelho"} · {event.minute}'</span><span className="text-sm text-muted-foreground">{data.players.find(player => player.id === event.playerId)?.name ?? "Sem jogador"}</span></div>)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="grid gap-4 md:grid-cols-3">
          <Ranking title="Artilheiros" rows={stats.data?.scorers.map(item => ({ name: item.name, value: item.goals })) ?? []} suffix="gols" />
          <Ranking title="Cartões" rows={stats.data?.cards.map(item => ({ name: item.name, value: item.yellowCards + item.redCards })) ?? []} suffix="cartões" />
          <Ranking title="Presença" rows={stats.data?.presence.map(item => ({ name: item.name, value: item.confirmedPresence })) ?? []} suffix="presenças" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HeroMetric({ icon: Icon, label, value }: { icon: typeof CalendarClock; label: string; value: string }) {
  return <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur"><Icon className="mb-2 h-5 w-5 text-emerald-200" /><p className="text-xs text-emerald-100">{label}</p><p className="font-semibold">{value}</p></div>;
}

function SummaryCard({ icon: Icon, label, value, detail }: { icon: typeof Users; label: string; value: string; detail: string }) {
  return <Card className="shadow-sm"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-2xl bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{detail}</p></div></CardContent></Card>;
}

function StatusRow({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{label}</span><span className={`font-semibold ${tone}`}>{value}</span></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>;
}

function Ranking({ title, rows, suffix }: { title: string; rows: Array<{ name: string; value: number }>; suffix: string }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>Ranking consolidado do histórico.</CardDescription></CardHeader><CardContent className="grid gap-2">{rows.slice(0, 8).map((row, index) => <div key={`${row.name}-${index}`} className="flex items-center justify-between rounded-xl bg-muted p-3"><span className="font-medium">{index + 1}. {row.name}</span><Badge variant="outline">{row.value} {suffix}</Badge></div>)}{rows.length === 0 && <p className="text-sm text-muted-foreground">Ainda não há dados.</p>}</CardContent></Card>;
}
