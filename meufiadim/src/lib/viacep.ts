export interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

export interface NeighborhoodRule {
  id: string;
  name: string;
  fee: number;
  min_order?: number;
  estimate?: string;
  active: boolean;
}

export interface CepRangeRule {
  id: string;
  start_cep: string;
  end_cep: string;
  fee: number;
  estimate?: string;
  active: boolean;
}

export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function cleanCep(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8);
}

export async function fetchViaCep(cep: string): Promise<ViaCepResponse | null> {
  const digits = cleanCep(cep);
  if (digits.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data: ViaCepResponse = await res.json();
    if (data.erro) return null;
    return data;
  } catch (err) {
    console.error("Erro ao consultar ViaCEP:", err);
    return null;
  }
}

export interface FreightCalculationResult {
  found: boolean;
  fee: number;
  estimate?: string;
  matchedName?: string;
  ruleType?: "neighborhood" | "cep_range";
  message?: string;
}

export function calculateDeliveryFee(params: {
  neighborhoodName?: string;
  cep?: string;
  neighborhoods: NeighborhoodRule[];
  cepRanges: CepRangeRule[];
}): FreightCalculationResult {
  const { neighborhoodName, cep, neighborhoods, cepRanges } = params;

  // 1. Tentar encontrar primeiro por Bairro correspondente
  if (neighborhoodName && neighborhoodName.trim()) {
    const normInput = neighborhoodName.toLowerCase().trim();
    const match = neighborhoods.find(
      (n) => n.active && n.name.toLowerCase().trim() === normInput
    );
    if (match) {
      return {
        found: true,
        fee: Number(match.fee),
        estimate: match.estimate || "30-50 min",
        matchedName: match.name,
        ruleType: "neighborhood",
      };
    }
  }

  // 2. Tentar encontrar por Faixa de CEP
  if (cep) {
    const digits = cleanCep(cep);
    if (digits.length === 8) {
      const numCep = parseInt(digits, 10);
      const matchRange = cepRanges.find((r) => {
        if (!r.active) return false;
        const start = parseInt(cleanCep(r.start_cep), 10);
        const end = parseInt(cleanCep(r.end_cep), 10);
        if (isNaN(start) || isNaN(end)) return false;
        return numCep >= start && numCep <= end;
      });

      if (matchRange) {
        return {
          found: true,
          fee: Number(matchRange.fee),
          estimate: matchRange.estimate || "30-50 min",
          matchedName: `Faixa de CEP ${matchRange.start_cep} a ${matchRange.end_cep}`,
          ruleType: "cep_range",
        };
      }
    }
  }

  return {
    found: false,
    fee: 0,
    message: "Não entregamos nesse endereço ou região.",
  };
}
