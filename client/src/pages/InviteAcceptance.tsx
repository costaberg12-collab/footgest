import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

function InviteAcceptance() {
  const [, paramsToken] = useRoute("/convite/:token");
  const [, paramsCode] = useRoute("/join/:code");
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const authLoading = false;
  const token = paramsToken?.token || paramsCode?.code || "";
  
  const [isLoading, setIsLoading] = useState(false);
  const [inviteData, setInviteData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const validateInvite = trpc.futgestao.acceptInviteByCode.useQuery(
    { code: token },
    { enabled: !!token && !authLoading }
  );

  const confirmInvite = trpc.futgestao.confirmInviteAndCreatePlayer.useMutation({
    onSuccess: () => {
      setIsLoading(false);
      toast.success("Convite aceito! Redirecionando...");
      setTimeout(() => {
        setLocation("/regulamento");
      }, 1500);
    },
    onError: (error: any) => {
      setIsLoading(false);
      setError(error?.message || "Erro ao aceitar convite");
      toast.error(error?.message || "Erro ao aceitar convite");
    },
  });

  useEffect(() => {
    if (validateInvite.data) {
      if (validateInvite.data.valid) {
        setInviteData(validateInvite.data.invite);
        setError(null);
      } else {
        setError(validateInvite.data.error);
      }
    }
  }, [validateInvite.data]);

  if (authLoading || validateInvite.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-2xl shadow-lg">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-2xl shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Faça Login para Aceitar o Convite</CardTitle>
            <CardDescription>Você precisa estar logado para aceitar o convite</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-sm text-muted-foreground mb-4">
              Redirecionando para login...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-2xl shadow-lg">
          <CardHeader className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <CardTitle className="text-2xl">Convite Inválido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-red-600">{error}</p>
            <Button
              onClick={() => setLocation("/")}
              className="w-full"
            >
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!inviteData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-2xl shadow-lg">
          <CardHeader className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
            <CardTitle className="text-2xl">Convite não encontrado</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="text-center">
          <Mail className="mx-auto h-12 w-12 text-blue-600 mb-4" />
          <CardTitle className="text-2xl">Você foi convidado!</CardTitle>
          <CardDescription>
            Aceite o convite para se juntar ao grupo e começar a participar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-600">Nome</p>
              <p className="text-lg font-semibold text-gray-900">{inviteData.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Email</p>
              <p className="text-lg font-semibold text-gray-900">{inviteData.email}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Tipo</p>
                <p className="text-lg font-semibold text-gray-900">
                  {inviteData.type === "line" ? "Linha" : inviteData.type === "goalkeeper" ? "Goleiro" : "Linha e Goleiro"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Mensalidade</p>
                <p className="text-lg font-semibold text-gray-900">
                  R$ {(inviteData.monthlyFeeCents / 100).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-800">
              ✓ Ao aceitar, sua conta será criada e você poderá acessar o painel completo do grupo.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => {
              setIsLoading(true);
              confirmInvite.mutate({ token });
            }}
            disabled={isLoading || confirmInvite.isPending}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Aceitar Convite
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default InviteAcceptance;
