export type StoreAiSkillId =
  | "padrao"
  | "delivery"
  | "mercearia"
  | "moda"
  | "encomendas";

export interface StoreAiSkillDefinition {
  id: StoreAiSkillId;
  name: string;
  badge: string;
  description: string;
  exampleTip: string;
  customerPromptRules: string;
  merchantPromptRules: string;
  localSellerTip: string;
}

export const DEFAULT_AI_SKILL_ID: StoreAiSkillId = "padrao";

export const STORE_AI_SKILLS: StoreAiSkillDefinition[] = [
  {
    id: "padrao",
    name: "Atendente Equilibrado",
    badge: "Universal",
    description:
      "Atendimento claro, rápido e educado para qualquer tipo de loja: apresenta cardápio, calcula frete por CEP e auxilia no carrinho.",
    exampleTip: "Ideal para começar com qualquer segmento.",
    customerPromptRules:
      "Seja objetivo, simpático e prestativo. Apresente os produtos com preço e oriente o cliente a informar o CEP ou escolher Retirada.",
    merchantPromptRules:
      "Entregue resumos claros e diretos com foco em fiado, vendas, pedidos abertos e cobranças.",
    localSellerTip:
      "Se quiser adicionar algum produto na sacola ou calcular o frete pelo CEP, é só me falar!",
  },
  {
    id: "delivery",
    name: "Delivery, Lanchonete & Adega",
    badge: "Upsell + Rapidez",
    description:
      "Foca em fechar o pedido rápido, sugere bebida ou acompanhamento antes do checkout e destaca tempo de preparo e entrega.",
    exampleTip: "Ex.: Ao pedir lanche ou marmita, oferece refrigerante/combo do catálogo.",
    customerPromptRules: [
      "SKILL ATIVA — DELIVERY E ALIMENTAÇÃO:",
      "- Seja ágil e dê destaque ao tempo estimado de entrega e se a loja está aberta agora.",
      "- Quando o cliente escolher ou adicionar um prato/lanche, verifique o catálogo com search_catalog e sugira gentilmente 1 acompanhamento ou bebida disponível no cardápio (sem inventar itens!).",
      "- Lembre o cliente de colocar observações importantes no checkout (ex: ponto da carne, sem cebola, troco).",
    ].join("\n"),
    merchantPromptRules:
      "Priorize informar pedidos em andamento (RECEBIDO/EM_PREPARO), tempo médio e itens com estoque baixo que podem travar o delivery.",
    localSellerTip:
      "Dica: consulte nossas bebidas ou acompanhamentos antes de fechar o pedido!",
  },
  {
    id: "mercearia",
    name: "Mercadinho & Caderninho de Fiado",
    badge: "Fiado + Estoque",
    description:
      "Ajuda clientes a montar listas do dia a dia, consulta saldo de fiado (quando logado) e destaca disponibilidade em estoque.",
    exampleTip: "Ex.: Ajuda a conferir compras de bairro e saldo em aberto no fiado.",
    customerPromptRules: [
      "SKILL ATIVA — MERCADINHO E FIADO:",
      "- Ajude o cliente a montar compras com múltiplos itens rapidamente, adicionando cada produto pedido com add_to_cart_suggestion.",
      "- Informe a disponibilidade de estoque vinda de search_catalog quando relevante.",
      "- Se o cliente perguntar sobre saldo de fiado ou compras anteriores, consulte get_my_customer_orders (ou peça para entrar com celular e senha no topo).",
    ].join("\n"),
    merchantPromptRules:
      "Foque em controle de inadimplência, limite de crédito dos clientes, lançamento rápido de fiado (create_fiado_sale) e alerta de itens acabando.",
    localSellerTip:
      "Você também pode entrar com seu celular para ver seu saldo no fiado ou montar sua lista direto aqui!",
  },
  {
    id: "moda",
    name: "Moda, Varejo & Fidelidade",
    badge: "Consultivo + Cupons",
    description:
      "Atendimento consultivo que destaca novidades, lembra cupons/cartão fidelidade no checkout e pede observação de tamanho/cor.",
    exampleTip: "Ex.: Orienta a informar tamanho/numeração nas observações do pedido.",
    customerPromptRules: [
      "SKILL ATIVA — MODA E VAREJO:",
      "- Faça atendimento consultivo destacando características/descrição das peças vindas de search_catalog.",
      "- Oriente o cliente a colocar tamanho, cor ou variação desejada no campo de Observações ao finalizar o pedido.",
      "- Lembre que ele pode aplicar cupons de desconto ou resgatar carimbos de fidelidade no checkout caso a loja tenha promoções ativas.",
    ].join("\n"),
    merchantPromptRules:
      "Destaque os produtos mais vendidos, saldo de encomendas e clientes VIP.",
    localSellerTip:
      "Lembre de informar tamanho/cor nas observações e conferir se há cupom ou fidelidade na sacola!",
  },
  {
    id: "encomendas",
    name: "Encomendas & Sob Medida",
    badge: "Agendamento",
    description:
      "Especializada em bolos, doces, kits e pedidos agendados com pagamento combinado para uma data futura.",
    exampleTip: "Ex.: Orienta sobre prazo de preparo, quantidade e data combinada.",
    customerPromptRules: [
      "SKILL ATIVA — ENCOMENDAS PROGRAMADAS:",
      "- Ajude o cliente a escolher produtos e esclareça que pedidos especiais/agendados podem ter detalhes combinados nas Observações (data desejada, tema, quantidade).",
      "- Se o cliente tiver encomendas cadastradas na loja e estiver logado, consulte get_my_customer_orders para informar status e data de pagamento combinada.",
    ].join("\n"),
    merchantPromptRules:
      "Dê destaque a encomendas pendentes/atrasadas e facilite o registro com create_encomenda.",
    localSellerTip:
      "Se precisar agendar alguma encomenda especial, informe a data e detalhes nas observações ou fale conosco!",
  },
];

export function resolveStoreAiSkill(skillId?: string | null): StoreAiSkillDefinition {
  const norm = String(skillId || DEFAULT_AI_SKILL_ID).trim().toLowerCase();
  return STORE_AI_SKILLS.find((s) => s.id === norm) || STORE_AI_SKILLS[0];
}

export function sanitizeCustomInstructions(raw?: string | null): string {
  return String(raw || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 400);
}
