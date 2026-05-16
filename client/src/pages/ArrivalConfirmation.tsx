import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

function ArrivalConfirmation() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; arrivalOrder?: number } | null>(null);

  // Extract token from URL query parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      setToken(urlToken);
      // Auto-submit if token is in URL
      handleConfirmArrival(urlToken);
    }
  }, []);

  const confirmArrival = trpc.futgestao.confirmArrivalByQr.useMutation({
    onSuccess: (data) => {
      setIsLoading(false);
      setResult({
        success: true,
        message: `Chegada confirmada! Você é o ${data.arrivalOrder}º a chegar.`,
        arrivalOrder: data.arrivalOrder,
      });
      setToken("");
      toast.success("Chegada confirmada com sucesso!");
      setTimeout(() => {
        setLocation("/");
      }, 3000);
    },
    onError: (error) => {
      setIsLoading(false);
      setResult({
        success: false,
        message: error.message || "Erro ao confirmar chegada. Tente novamente.",
      });
      toast.error("Erro ao confirmar chegada");
    },
  });

  function handleConfirmArrival(tokenValue?: string) {
    const tokenToUse = tokenValue || token;
    if (!tokenToUse.trim()) {
      toast.error("Digite o código QR");
      return;
    }
    setIsLoading(true);
    setResult(null);
    confirmArrival.mutate({ token: tokenToUse });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Confirmação de Chegada</CardTitle>
          <CardDescription>Escaneie o código QR ou digite o token para confirmar sua chegada</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!result ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Código QR</label>
                <Input
                  type="text"
                  placeholder="Cole o código QR aqui"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleConfirmArrival();
                    }
                  }}
                  disabled={isLoading}
                  autoFocus
                  className="text-center font-mono"
                />
              </div>
              <Button
                onClick={() => handleConfirmArrival()}
                disabled={isLoading || !token.trim()}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  "Confirmar Chegada"
                )}
              </Button>
            </>
          ) : result.success ? (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
              <div>
                <h3 className="text-lg font-semibold text-green-700">Sucesso!</h3>
                <p className="mt-2 text-sm text-gray-600">{result.message}</p>
                {result.arrivalOrder && (
                  <div className="mt-4 rounded-lg bg-green-50 p-3">
                    <p className="text-2xl font-bold text-green-700">#{result.arrivalOrder}</p>
                    <p className="text-xs text-green-600">Ordem de chegada</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">Redirecionando em 3 segundos...</p>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <AlertCircle className="mx-auto h-16 w-16 text-red-500" />
              <div>
                <h3 className="text-lg font-semibold text-red-700">Erro</h3>
                <p className="mt-2 text-sm text-gray-600">{result.message}</p>
              </div>
              <Button
                onClick={() => {
                  setResult(null);
                  setToken("");
                }}
                variant="outline"
                className="w-full"
              >
                Tentar Novamente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ArrivalConfirmation;
