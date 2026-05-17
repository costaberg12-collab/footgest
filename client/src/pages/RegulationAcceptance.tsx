import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

function RegulationAcceptance() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [hasAccepted, setHasAccepted] = useState(false);
  const [regulationText, setRegulationText] = useState("");

  const { data: overview } = trpc.futgestao.overview.useQuery();
  const acceptRegulation = trpc.futgestao.acceptRegulation.useMutation({
    onSuccess: () => {
      setIsLoading(false);
      toast.success("Regulamento aceito com sucesso!");
      setTimeout(() => {
        setLocation("/");
      }, 1500);
    },
    onError: (error: any) => {
      setIsLoading(false);
      toast.error(error?.message || "Erro ao aceitar regulamento");
    },
  });

  useEffect(() => {
    if (overview?.settings?.regulationText) {
      setRegulationText(overview.settings.regulationText);
    }
  }, [overview?.settings?.regulationText]);

  function handleAccept() {
    if (!hasAccepted) {
      toast.error("Você deve aceitar o regulamento para continuar");
      return;
    }
    setIsLoading(true);
    acceptRegulation.mutate();
  }

  function handleBackToDashboard() {
    setLocation("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Regulamento do Grupo</CardTitle>
          <CardDescription>Leia e aceite o regulamento para participar das partidas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {regulationText ? (
            <>
              <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="whitespace-pre-wrap text-sm text-gray-700">
                  {regulationText}
                </div>
              </div>

              <div className="flex items-start space-x-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <Checkbox
                  id="accept"
                  checked={hasAccepted}
                  onCheckedChange={(checked) => setHasAccepted(checked as boolean)}
                  className="mt-1"
                />
                <label
                  htmlFor="accept"
                  className="text-sm font-medium text-gray-700 cursor-pointer flex-1"
                >
                  Eu li e aceito o regulamento do grupo
                </label>
              </div>

              <Button
                onClick={handleAccept}
                disabled={isLoading || !hasAccepted}
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
                    Aceitar e Continuar
                  </>
                )}
              </Button>
            </>
          ) : (
            <div className="space-y-4 text-center py-8">
              <AlertCircle className="mx-auto h-16 w-16 text-yellow-500" />
              <div>
                <h3 className="text-lg font-semibold text-gray-700">Nenhum regulamento configurado</h3>
                <p className="mt-2 text-sm text-gray-600">O administrador ainda não configurou um regulamento para o grupo.</p>
              </div>
              <Button
                onClick={handleBackToDashboard}
                variant="outline"
                className="w-full"
              >
                Voltar ao Dashboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default RegulationAcceptance;
