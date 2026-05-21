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
import { Activity, Banknote, CalendarClock, ClipboardList, Goal, QrCode, Settings, ShieldCheck, Trophy, Upload, Users } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { formatInTimeZone } from "date-fns-tz";

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
  const date = new Date(value);
  return formatInTimeZone(date, "America/Sao_Paulo", "dd/MM/yyyy, HH:mm");
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
  const appSettings = trpc.futgestao.getAppSettings.useQuery();
  const isOwner = appSettings.data && user && appSettings.data.ownerId === user.id;
  const canAccessControlPanel = isOwner || (user && user.role === 'admin');

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
  const generateArrivalQr = trpc.futgestao.generateArrivalQr.useMutation({ onSuccess: () => refresh("QR Code de chegada gerado.") });
  const confirmArrivalByQr = trpc.futgestao.confirmArrivalByQr.useMutation({ onSuccess: data => refresh(`Chegada registrada. Ordem ${data.arrivalOrder}.`) });
  const updateSettings = trpc.futgestao.updateSettings.useMutation({ onSuccess: () => refresh("Configurações salvas.") });
  const uploadLogo = trpc.futgestao.uploadLogo.useMutation({ onSuccess: result => { setSettingsForm(form => ({ ...form, logoUrl: result.url })); refresh("Logo enviada."); } });
  const listPlayersForPromotion = trpc.futgestao.listPlayersForAdminPromotion.useQuery();
  const promoteToAdmin = trpc.futgestao.promoteToAdmin.useMutation({ onSuccess: () => { refresh("Jogador promovido a administrador."); listPlayersForPromotion.refetch(); } });
  const demoteFromAdmin = trpc.futgestao.demoteFromAdmin.useMutation({ onSuccess: () => { refresh("Permissões de administrador removidas."); listPlayersForPromotion.refetch(); } });
  const invitePlayer = trpc.futgestao.invitePlayer.useMutation({ onSuccess: () => { refresh("Convite enviado com sucesso!"); setInviteForm({ email: "", name: "", phone: "", type: "line", monthlyFeeCents: 0, isMonthlyMember: true, isRefereeAuthorized: false }); getPendingInvites.refetch(); } });
  const getPendingInvites = trpc.futgestao.getPendingInvites.useQuery();
  const deleteInvite = trpc.futgestao.deleteInvite.useMutation({ onSuccess: () => { refresh("Convite removido!"); getPendingInvites.refetch(); } });

  const [playerForm, setPlayerForm] = useState<FormState>(initialPlayerForm);
  const [guestForm, setGuestForm] = useState({ hostPlayerId: "0", name: "", amount: "10" });
  const [paymentForm, setPaymentForm] = useState({ playerId: "0", referenceMonth: new Date().toISOString().slice(0, 7), amount: "80", proofUrl: "" });
  const [expenseForm, setExpenseForm] = useState({ category: "field", description: "", amount: "" });
  const [eventForm, setEventForm] = useState({ type: "goal", minute: "0", playerId: "0", teamId: "0" });
  const [clockSeconds, setClockSeconds] = useState(0);
  const [qrToken, setQrToken] = useState("");
  const [suggestedColors, setSuggestedColors] = useState<{ primary: string; secondary: string } | null>(null);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", phone: "", type: "line" as PlayerType, monthlyFeeCents: 0, isMonthlyMember: true, isRefereeAuthorized: false });
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
    regulationText: "",
    recurringDays: "[5]",
  });

  const qrRef = useRef<SVGSVGElement>(null);

  function extractColorsFromImage(imageUrl: string) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      
      // Extrair cores dominantes usando análise de pixels
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const colorMap = new Map<string, number>();
      
      // Função para calcular saturação e luminância
      const getSaturation = (r: number, g: number, b: number) => {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const l = (max + min) / 2;
        if (max === min) return 0;
        return l > 128 ? (max - min) / (510 - max - min) : (max - min) / (max + min);
      };
      
      const getLuminance = (r: number, g: number, b: number) => {
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      };
      
      // Amostragem de pixels (a cada 4 pixels para performance)
      for (let i = 0; i < data.length; i += 16) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        
        // Ignorar pixels transparentes
        if (a < 128) continue;
        
        const saturation = getSaturation(r, g, b);
        const luminance = getLuminance(r, g, b);
        
        // Filtrar cores muito claras, muito escuras ou dessaturadas
        // Manter apenas cores vibrantes (saturação > 0.2 e luminância entre 0.2 e 0.8)
        if (saturation < 0.2 || luminance < 0.2 || luminance > 0.8) continue;
        
        // Quantizar cores (reduzir para 32 cores para melhor precisão)
        const qr = Math.floor(r / 32) * 32;
        const qg = Math.floor(g / 32) * 32;
        const qb = Math.floor(b / 32) * 32;
        const key = `${qr},${qg},${qb}`;
        colorMap.set(key, (colorMap.get(key) || 0) + 1);
      }
      
      // Ordenar por frequência e pegar as 2 cores mais vibrantes
      const sortedColors = Array.from(colorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([key]) => {
          const [r, g, b] = key.split(',').map(Number);
          return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
        });
      
      if (sortedColors.length >= 2) {
        setSuggestedColors({
          primary: sortedColors[0],
          secondary: sortedColors[1]
        });
      } else if (sortedColors.length === 1) {
        setSuggestedColors({
          primary: sortedColors[0],
          secondary: "#0f172a"
        });
      }
    };
    img.src = imageUrl;
  }

  function downloadQrCode() {
    if (!qrRef.current) return;
    const svg = qrRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `qrcode-chegada-${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  }

  function refresh(message: string) {
    toast.success(message);
    utils.futgestao.overview.invalidate();
    utils.futgestao.stats.invalidate();
  }

  const data = overview.data;
  const appDescription = data?.settings.appDescription || "{appDescription}";

  useEffect(() => {
    if (!data?.settings) return;
    setSettingsForm({
      appName: data.settings.appName,
      appDescription: data.settings.appDescription ?? "",
      primaryColor: data.settings.primaryColor,
      secondaryColor: data.settings.secondaryColor,
      logoUrl: data.settings.logoUrl ?? "",
      openingBalance: String((data.settings.openingBalanceCents ?? 0) / 100).replace(".", ","),
      matchHour: String(data.settings.matchHour ?? 20),
      matchMinute: String(data.settings.matchMinute ?? 0),
      confirmationHour: String(data.settings.confirmationHour ?? 18),
      confirmationMinute: String(data.settings.confirmationMinute ?? 0),
      arrivalMinutesBefore: String(data.settings.arrivalMinutesBefore ?? 15),
      regulationText: data.settings.regulationText ?? "",
      recurringDays: data.settings.recurringDays ?? "[5]",
    });
  }, [data?.settings]);

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

  const isAdminUser = user?.role === "admin";
  const arrivalQrUrl = data?.match.arrivalQrToken ? `${window.location.origin}/chegada?token=${data.match.arrivalQrToken}` : "";
  const brandStyle = data?.settings ? ({ "--brand-primary": data.settings.primaryColor, "--brand-secondary": data.settings.secondaryColor } as React.CSSProperties) : undefined;
  const confirmedCount = data?.players.filter(player => player.attendance?.status === "confirmed").length ?? 0;
  const pendingCount = data?.players.filter(player => (player.attendance?.status ?? "pending") === "pending").length ?? 0;
  const declinedCount = data?.players.filter(player => player.attendance?.status === "declined").length ?? 0;
  const myPlayer = data?.players.find(player => player.userId === user?.id);
  const presencePlayers = data ? (isAdminUser ? data.players : myPlayer ? [myPlayer] : []) : [];

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
    <div className="space-y-6 pb-20" style={brandStyle}>
      <section className="overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_top_left,var(--brand-primary)_0,var(--brand-primary)_35%,var(--brand-secondary)_70%,#081b13_100%)] p-5 text-white shadow-2xl md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr] lg:items-end">
          <div className="space-y-4">
            <Badge className="border-white/20 bg-white/15 text-white hover:bg-white/20">{data.settings.appName}</Badge>
            <div>
              <div className="flex flex-wrap items-center gap-3">{data.settings.logoUrl && <img src={data.settings.logoUrl} alt="Logo do grupo" className="h-16 w-16 rounded-2xl border border-white/30 object-contain" style={{ backgroundColor: 'transparent' }} />}<h1 className="text-3xl font-black tracking-tight md:text-5xl">{data.settings.appName}</h1></div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50 md:text-base">
                {appDescription}
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
               {isAdminUser && <StatusRow label="Pendentes" value={pendingCount} tone="text-amber-700" />}
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
        <TabsList className="grid h-auto grid-cols-2 gap-2 rounded-2xl bg-muted p-2 md:grid-cols-8">
          <TabsTrigger value="presenca">Presença</TabsTrigger>
          <TabsTrigger value="jogadores">Jogadores</TabsTrigger>
          <TabsTrigger value="convidados">Convidados</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="times">Times</TabsTrigger>
          <TabsTrigger value="jogo">Jogo</TabsTrigger>
          <TabsTrigger value="stats">Estatísticas</TabsTrigger>
           {isAdminUser && <TabsTrigger value="config">Configurações</TabsTrigger>}
        </TabsList>

        <TabsContent value="presenca">
          <Card>
            <CardHeader>
              <CardTitle>Confirmação de presença</CardTitle>
               <CardDescription>{isAdminUser ? "Acompanhe a resposta de todos os jogadores e registre chegadas presenciais." : "Escolha apenas uma das duas opções: Presença ou Ausência. Se você não responder, o sistema mantém a situação sem confirmação."}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
               {!isAdminUser && !myPlayer && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Para confirmar presença, primeiro crie seu cadastro na aba Jogadores. Depois disso, esta tela mostrará somente o seu controle de Presença ou Ausência.
                </div>
              )}
               {!isAdminUser && myPlayer && (
                <div className="grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                  <div className="flex items-start gap-3"><QrCode className="mt-0.5 h-5 w-5" /><div><p className="font-semibold">Chegada real pelo QR Code do campo</p><p>Confirme presença antes. Quando chegar, escaneie o QR Code exibido pelo administrador ou cole o código abaixo. Só a chegada validada entra na ordem dos times.</p></div></div>
                  <div className="flex flex-col gap-2 sm:flex-row"><Input value={qrToken} onChange={e => setQrToken(e.target.value)} placeholder="Código de chegada" /><Button onClick={() => confirmArrivalByQr.mutate({ token: qrToken })} disabled={!qrToken.trim()}>Validar chegada</Button></div>
                </div>
              )}
               {isAdminUser && (
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div><p className="font-semibold">QR Code de chegada no campo</p><p className="text-sm text-muted-foreground">Gere e exiba este código no campo. O jogador só entra na ordem real de chegada após validar o código ou ser marcado pelo administrador.</p></div>
                  <div className="grid justify-items-center gap-2">
                    {arrivalQrUrl ? <QRCodeSVG ref={qrRef} value={arrivalQrUrl} size={128} /> : <div className="grid h-32 w-32 place-items-center rounded-xl bg-white text-xs text-muted-foreground">Sem QR</div>}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => generateArrivalQr.mutate()}>Gerar QR Code</Button>
                      {arrivalQrUrl && <Button size="sm" variant="outline" onClick={downloadQrCode}>Baixar PNG</Button>}
                    </div>
                  </div>
                </div>
              )}
              {presencePlayers.map(player => {
                const status = (player.attendance?.status ?? "pending") as PresenceStatus;
                const playerStatusLabel = status === "confirmed" ? "Presença marcada" : status === "declined" ? "Ausência marcada" : null;
                return (
                  <div key={player.id} className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{player.name}</h3>
                        <Badge variant="outline">{typeLabel[player.type]}</Badge>
                         {isAdminUser ? <Badge className={presenceTone[status]}>{presenceLabel[status]}</Badge> : playerStatusLabel ? <Badge className={presenceTone[status]}>{playerStatusLabel}</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                         {isAdminUser ? `Confirmado em ${dateTime(player.attendance?.confirmedAt)} · Ordem ${player.attendance?.arrivalOrder ?? "-"} · Chegada presencial ${dateTime(player.attendance?.arrivedAt)}` : `Sua chegada real: ${player.attendance?.arrivedAt ? `${dateTime(player.attendance.arrivedAt)} · ordem ${player.attendance.arrivalOrder ?? "-"}` : "ainda não validada por QR Code ou administrador"}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setAttendance.mutate({ playerId: player.id, status: "confirmed" })}>Presença</Button>
                      <Button size="sm" className="border border-rose-200 bg-rose-600 text-white hover:bg-rose-700" onClick={() => setAttendance.mutate({ playerId: player.id, status: "declined" })}>Ausência</Button>
                       {isAdminUser && <Button size="sm" variant="ghost" onClick={() => markArrived.mutate({ playerId: player.id })}>Chegou</Button>}
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
               <CardTitle>{isAdminUser ? "Cadastrar jogador" : "Meu cadastro de jogador"}</CardTitle>
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
                 if (isAdminUser) createPlayer.mutate(payload);
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
                   <Button variant={guest.paid ? "secondary" : "outline"} size="sm" disabled={!isAdminUser} onClick={() => setGuestPaid.mutate({ guestId: guest.id, paid: !guest.paid })}>{guest.paid ? "Pago" : "Marcar pago"}</Button>
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
                 <Button type="submit" disabled={!isAdminUser}>Registrar despesa</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Caixa do grupo</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <StatusRow label="Saldo inicial em caixa" value={money(data.finance.openingBalanceCents)} tone="text-slate-700" />
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
                 return <div key={payment.id} className="grid gap-2 rounded-xl border p-3 md:grid-cols-[1fr_auto] md:items-center"><div><p className="font-medium">{player?.name ?? "Jogador"} · {payment.referenceMonth}</p><p className="text-xs text-muted-foreground">{money(payment.amountCents)} · status {payment.status} · comprovante: {payment.proofUrl ?? "-"}</p></div>{isAdminUser && <div className="flex gap-2"><Button size="sm" onClick={() => reviewPayment.mutate({ paymentId: payment.id, status: "confirmed" })}>Confirmar</Button><Button size="sm" variant="outline" onClick={() => reviewPayment.mutate({ paymentId: payment.id, status: "rejected", rejectionReason: "Rejeitado pelo administrador" })}>Rejeitar</Button></div>}</div>;
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="times" className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
          <Card>
            <CardHeader><CardTitle>Organização automática</CardTitle><CardDescription>Primeiros com chegada validada por QR Code ou administrador jogam primeiro. O algoritmo prioriza goleiros e completa times com 5 linha + 1 goleiro ou 6 sem goleiro.</CardDescription></CardHeader>
            <CardContent className="grid gap-3">
               <Button disabled={!isAdminUser} onClick={() => generateTeams.mutate()}>Gerar times</Button>
               <Button disabled={!isAdminUser || data.teams.length === 0} variant="secondary" onClick={() => assignReferees.mutate()}>Definir arbitragem</Button>
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
              <div className="grid grid-cols-3 gap-2"><Button onClick={() => setClock.mutate({ clockSeconds: 0, clockRunning: true })}>Iniciar do zero</Button><Button variant="secondary" onClick={() => setClock.mutate({ clockSeconds, clockRunning: true })}>Retomar</Button><Button variant="outline" onClick={() => { setClockSeconds(0); setClock.mutate({ clockSeconds: 0, clockRunning: false }); }}>Zerar</Button></div>
              <Button variant="secondary" onClick={() => setClock.mutate({ clockSeconds, clockRunning: false })}>Pausar e salvar</Button>
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

         {isAdminUser && <TabsContent value="config" className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Personalização do app</CardTitle>
              <CardDescription>Edite o nome, descrição, cores e logo do seu grupo.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <form className="grid gap-3" onFocus={() => setIsEditingSettings(true)} onBlur={() => setIsEditingSettings(false)} onSubmit={event => {
                event.preventDefault();
                updateSettings.mutate({
                  appName: settingsForm.appName,
                  appDescription: settingsForm.appDescription,
                  primaryColor: settingsForm.primaryColor,
                  secondaryColor: settingsForm.secondaryColor,
                  logoUrl: settingsForm.logoUrl,
                  openingBalanceCents: centsFromBRL(settingsForm.openingBalance),
                  matchHour: Number(settingsForm.matchHour),
                  matchMinute: Number(settingsForm.matchMinute),
                  confirmationHour: Number(settingsForm.confirmationHour),
                  confirmationMinute: Number(settingsForm.confirmationMinute),
                  arrivalMinutesBefore: Number(settingsForm.arrivalMinutesBefore),
                  recurringDays: settingsForm.recurringDays,
                  regulationText: settingsForm.regulationText,
                });
              }}>
                <Field label="Nome do app">
                  <Input value={settingsForm.appName} onChange={e => setSettingsForm({ ...settingsForm, appName: e.target.value })} />
                </Field>
                <Field label="Descrição">
                  <Input value={settingsForm.appDescription} onChange={e => setSettingsForm({ ...settingsForm, appDescription: e.target.value })} placeholder="Descreva seu grupo" />
                </Field>
                <Field label="Cor primária (clique para escolher)">
                  <div className="flex items-center gap-3">
                    <Input type="color" value={settingsForm.primaryColor} onChange={e => setSettingsForm({ ...settingsForm, primaryColor: e.target.value })} className="h-12 w-20 cursor-pointer rounded-lg border-2" />
                    <code className="text-sm font-mono bg-muted px-3 py-2 rounded">{settingsForm.primaryColor.toUpperCase()}</code>
                  </div>
                </Field>
                <Field label="Cor secundária (clique para escolher)">
                  <div className="flex items-center gap-3">
                    <Input type="color" value={settingsForm.secondaryColor} onChange={e => setSettingsForm({ ...settingsForm, secondaryColor: e.target.value })} className="h-12 w-20 cursor-pointer rounded-lg border-2" />
                    <code className="text-sm font-mono bg-muted px-3 py-2 rounded">{settingsForm.secondaryColor.toUpperCase()}</code>
                  </div>
                </Field>
                <Field label="Saldo inicial em caixa (R$)">
                  <Input value={settingsForm.openingBalance} onChange={e => setSettingsForm({ ...settingsForm, openingBalance: e.target.value })} />
                </Field>
                <Button type="submit">Salvar configurações</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Horários e regras</CardTitle>
              <CardDescription>Configure os horários do jogo, prazo de confirmação e chegada antecipada.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <form className="grid gap-3" onFocus={() => setIsEditingSettings(true)} onBlur={() => setIsEditingSettings(false)} onSubmit={event => {
                event.preventDefault();
                updateSettings.mutate({
                  appName: settingsForm.appName,
                  appDescription: settingsForm.appDescription,
                  primaryColor: settingsForm.primaryColor,
                  secondaryColor: settingsForm.secondaryColor,
                  logoUrl: settingsForm.logoUrl,
                  openingBalanceCents: centsFromBRL(settingsForm.openingBalance),
                  matchHour: Number(settingsForm.matchHour),
                  matchMinute: Number(settingsForm.matchMinute),
                  confirmationHour: Number(settingsForm.confirmationHour),
                  confirmationMinute: Number(settingsForm.confirmationMinute),
                  arrivalMinutesBefore: Number(settingsForm.arrivalMinutesBefore),
                  recurringDays: settingsForm.recurringDays,
                  regulationText: settingsForm.regulationText,
                });
              }}>
                <Field label="Horário do jogo">
                  <div className="flex gap-2">
                    <Input type="number" min="0" max="23" value={settingsForm.matchHour} onChange={e => setSettingsForm({ ...settingsForm, matchHour: e.target.value })} placeholder="Hora" />
                    <Input type="number" min="0" max="59" value={settingsForm.matchMinute} onChange={e => setSettingsForm({ ...settingsForm, matchMinute: e.target.value })} placeholder="Minuto" />
                  </div>
                </Field>
                <Field label="Prazo para confirmar presença">
                  <div className="flex gap-2">
                    <Input type="number" min="0" max="23" value={settingsForm.confirmationHour} onChange={e => setSettingsForm({ ...settingsForm, confirmationHour: e.target.value })} placeholder="Hora" />
                    <Input type="number" min="0" max="59" value={settingsForm.confirmationMinute} onChange={e => setSettingsForm({ ...settingsForm, confirmationMinute: e.target.value })} placeholder="Minuto" />
                  </div>
                </Field>
                <Field label="Minutos antes para chegar no campo">
                  <Input type="number" min="0" value={settingsForm.arrivalMinutesBefore} onChange={e => setSettingsForm({ ...settingsForm, arrivalMinutesBefore: e.target.value })} />
                </Field>
                <Field label="Dias da semana para partidas">
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { day: 0, label: 'Dom' },
                      { day: 1, label: 'Seg' },
                      { day: 2, label: 'Ter' },
                      { day: 3, label: 'Qua' },
                      { day: 4, label: 'Qui' },
                      { day: 5, label: 'Sex' },
                      { day: 6, label: 'Sab' },
                    ].map(({ day, label }) => {
                      let recurringDaysArray: number[] = [5];
                      try {
                        const parsed = JSON.parse(settingsForm.recurringDays);
                        if (Array.isArray(parsed)) {
                          recurringDaysArray = parsed;
                        }
                      } catch (e) {
                        // Fallback to default
                      }
                      const isSelected = recurringDaysArray.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            const updated = isSelected
                              ? recurringDaysArray.filter((d: number) => d !== day)
                              : [...recurringDaysArray, day].sort((a: number, b: number) => a - b);
                            setSettingsForm({ ...settingsForm, recurringDays: JSON.stringify(updated) });
                          }}
                          className={`rounded-lg border-2 py-2 px-3 font-semibold transition-colors ${
                            isSelected
                              ? 'border-green-500 bg-green-100 text-green-900'
                              : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Button type="submit">Salvar horários</Button>
              </form>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Logo do grupo</CardTitle>
              <CardDescription>Faça upload da logo do seu time ou grupo.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {settingsForm.logoUrl && <img src={settingsForm.logoUrl} alt="Logo" className="h-32 w-32 rounded-xl border object-contain" style={{ backgroundColor: 'transparent' }} />}
              <input type="file" accept="image/*" onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = () => {
                    const base64 = reader.result as string;
                    const dataBase64 = base64.split(',')[1];
                    uploadLogo.mutate({ fileName: file.name, mimeType: (file.type || 'image/png') as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml', dataBase64 });
                    setTimeout(() => extractColorsFromImage(base64), 500);
                  };
                  reader.readAsDataURL(file);
                }
              }} />
              {suggestedColors && (
                <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
                  <p className="mb-3 font-semibold text-emerald-900">Cores sugeridas pela logo:</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-lg border-2" style={{ backgroundColor: suggestedColors.primary }} />
                      <div>
                        <p className="text-xs text-muted-foreground">Primária</p>
                        <code className="text-sm font-mono">{suggestedColors.primary.toUpperCase()}</code>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-lg border-2" style={{ backgroundColor: suggestedColors.secondary }} />
                      <div>
                        <p className="text-xs text-muted-foreground">Secundária</p>
                        <code className="text-sm font-mono">{suggestedColors.secondary.toUpperCase()}</code>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => {
                      setSettingsForm({ ...settingsForm, primaryColor: suggestedColors.primary, secondaryColor: suggestedColors.secondary });
                      setSuggestedColors(null);
                      toast.success("Cores aplicadas!");
                    }}>Aplicar cores</Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setSuggestedColors(null)}>Escolher manualmente</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Regulamento</CardTitle>
              <CardDescription>Adicione o regulamento que os jogadores devem aceitar ao acessar pela primeira vez.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <form className="grid gap-3" onFocus={() => setIsEditingSettings(true)} onBlur={() => setIsEditingSettings(false)} onSubmit={event => {
                event.preventDefault();
                updateSettings.mutate({
                  appName: settingsForm.appName,
                  appDescription: settingsForm.appDescription,
                  primaryColor: settingsForm.primaryColor,
                  secondaryColor: settingsForm.secondaryColor,
                  logoUrl: settingsForm.logoUrl,
                  openingBalanceCents: centsFromBRL(settingsForm.openingBalance),
                  matchHour: Number(settingsForm.matchHour),
                  matchMinute: Number(settingsForm.matchMinute),
                  confirmationHour: Number(settingsForm.confirmationHour),
                  confirmationMinute: Number(settingsForm.confirmationMinute),
                  arrivalMinutesBefore: Number(settingsForm.arrivalMinutesBefore),
                  regulationText: settingsForm.regulationText,
                  recurringDays: settingsForm.recurringDays,
                });
              }}>
                <textarea value={settingsForm.regulationText} onChange={e => setSettingsForm({ ...settingsForm, regulationText: e.target.value })} placeholder="Digite o regulamento aqui..." className="min-h-48 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
                <Button type="submit">Salvar regulamento</Button>
              </form>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Link de Convite Público</CardTitle>
              <CardDescription>Compartilhe este link para que novos jogadores se cadastrem no app.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Copie o link abaixo e compartilhe no WhatsApp, QR Code ou qualquer outra forma:</p>
                <div className="flex gap-2">
                  <Input 
                    readOnly 
                    value={`${window.location.origin}/join/${appSettings.data?.inviteCode || 'carregando'}`} 
                    className="font-mono text-sm"
                  />
                  <Button 
                    onClick={() => {
                      const link = `${window.location.origin}/join/${appSettings.data?.inviteCode}`;
                      navigator.clipboard.writeText(link);
                      toast.success('Link copiado!');
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Copiar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Gerenciamento de Admins</CardTitle>
              <CardDescription>Promova ou remova permissões de administrador para os jogadores.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div>
                <h4 className="font-semibold mb-3">Administradores atuais</h4>
                <div className="grid gap-2">
                  {listPlayersForPromotion.data?.filter(p => p.role === 'admin').map(player => (
                    <div key={player.id} className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                      <span className="font-medium text-emerald-900">{player.name}</span>
                      <Button size="sm" variant="destructive" onClick={() => demoteFromAdmin.mutate({ playerId: player.id })}>Remover</Button>
                    </div>
                  ))}
                  {!listPlayersForPromotion.data?.some(p => p.role === 'admin') && <p className="text-sm text-muted-foreground">Nenhum administrador além de você.</p>}
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-3">Promover jogador a admin</h4>
                <div className="grid gap-2">
                  {listPlayersForPromotion.data?.filter(p => p.role === 'user').map(player => (
                    <div key={player.id} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="font-medium">{player.name}</span>
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => promoteToAdmin.mutate({ playerId: player.id })}>Promover</Button>
                    </div>
                  ))}
                  {!listPlayersForPromotion.data?.some(p => p.role === 'user') && <p className="text-sm text-muted-foreground">Todos os jogadores já são administradores.</p>}
                </div>
              </div>
            </CardContent>
          </Card>
          {isOwner && <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Painel de Controle</CardTitle>
              <CardDescription>Acesse o painel de controle completo para gerenciar dominios, configuracoes avancadas e muito mais.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <p className="text-sm text-muted-foreground">Clique no botao abaixo para acessar o painel de controle, onde voce pode configurar seu dominio customizado e outras opcoes avancadas.</p>
              <Button onClick={() => window.open("https://app.manus.im", "_blank")} className="bg-blue-600 hover:bg-blue-700">Acessar Painel de Controle</Button>
            </CardContent>
          </Card>}
        </TabsContent>}

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
