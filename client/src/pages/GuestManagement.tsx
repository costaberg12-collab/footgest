import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState } from "react";
import { toast } from "sonner";

interface Field {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: Field) {
  return (
    <div className="grid gap-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function GuestManagement() {
  const { user } = useAuth();
  const overview = trpc.futgestao.overview.useQuery();
  const createGuest = trpc.futgestao.createGuest.useMutation({
    onSuccess: () => {
      toast.success("Convidado cadastrado com sucesso!");
      setGuestForm({ hostPlayerId: "0", name: "", amount: "10" });
      overview.refetch();
    },
    onError: (error: any) => {
      toast.error(error?.message || "Erro ao cadastrar convidado");
    },
  });
  const setGuestPaid = trpc.futgestao.setGuestPaid.useMutation({
    onSuccess: () => {
      toast.success("Status do convidado atualizado!");
      overview.refetch();
    },
  });

  const [guestForm, setGuestForm] = useState({ hostPlayerId: "0", name: "", amount: "10" });

  if (!overview.data) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  const data = overview.data;
  const isAdminUser = user?.role === "admin";
  const money = (cents: number) => `R$ ${(cents / 100).toFixed(2)}`;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Cadastrar Convidado</CardTitle>
          <CardDescription>Adicione um novo convidado para a rodada atual.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              createGuest.mutate({
                hostPlayerId: Number(guestForm.hostPlayerId),
                name: guestForm.name,
                amountCents: Math.round(parseFloat(guestForm.amount) * 100),
              });
            }}
          >
            <Field label="Jogador anfitrião">
              <Select value={guestForm.hostPlayerId} onValueChange={(value) => setGuestForm({ ...guestForm, hostPlayerId: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.players.map((player) => (
                    <SelectItem key={player.id} value={String(player.id)}>
                      {player.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Nome do convidado">
              <Input value={guestForm.name} onChange={(e) => setGuestForm({ ...guestForm, name: e.target.value })} required />
            </Field>
            <Field label="Valor por dia">
              <Input value={guestForm.amount} onChange={(e) => setGuestForm({ ...guestForm, amount: e.target.value })} />
            </Field>
            <Button type="submit" disabled={!data.guestsReleased}>
              Cadastrar convidado
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Convidados da Rodada</CardTitle>
          <CardDescription>{data.guests.length === 0 ? "Nenhum convidado cadastrado." : `Total: ${data.guests.length} convidado(s)`}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {data.guests.length === 0 && <p className="text-sm text-muted-foreground">Nenhum convidado cadastrado.</p>}
          {data.guests.map((guest) => (
            <div key={guest.id} className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <p className="font-medium">{guest.name}</p>
                <p className="text-xs text-muted-foreground">Valor {money(guest.amountCents)}</p>
              </div>
              <Button
                variant={guest.paid ? "secondary" : "outline"}
                size="sm"
                disabled={!isAdminUser}
                onClick={() => setGuestPaid.mutate({ guestId: guest.id, paid: !guest.paid })}
              >
                {guest.paid ? "Pago" : "Marcar pago"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default GuestManagement;
