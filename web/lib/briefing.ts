export interface DesignBrief {
  objective: string;
  audience: string;
  headline: string;
  supportingText: string;
  cta: string;
  palette: string;
  requiredElements: string;
  forbiddenElements: string;
  revision: string;
}

export interface MediaComposition {
  enabled: boolean;
  source: 'files' | 'urls';
  imageUrl: string;
  videoUrl: string;
  imagePercent: number;
  orientation: 'vertical' | 'horizontal';
}

const formatInstructions: Record<string, string> = {
  instagram_post: 'Post para Instagram em 1080 × 1350 px, orientação vertical e proporção 4:5.',
  your_story: 'Story vertical para Instagram/Facebook, proporção 9:16.',
  flyer: 'Flyer de página única, com leitura rápida e hierarquia promocional clara.',
  poster: 'Pôster de página única, com impacto visual à distância.',
  youtube_thumbnail: 'Thumbnail para YouTube, horizontal, legível em tamanho reduzido.',
};

function clean(value: string): string {
  return value.trim().replace(/\r\n/g, '\n');
}

function list(value: string): string[] {
  return clean(value)
    .split('\n')
    .map((item) => item.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);
}

function section(title: string, content: string | string[]): string | undefined {
  const lines = Array.isArray(content) ? content : [clean(content)];
  const meaningful = lines.filter(Boolean);
  if (meaningful.length === 0) return undefined;
  return `${title}\n${meaningful.map((line) => `- ${line}`).join('\n')}`;
}

export function compileDesignBrief(brief: DesignBrief, designType: string, media?: MediaComposition): string {
  const exactCopy = [
    clean(brief.headline) ? `HEADLINE: “${clean(brief.headline)}”` : '',
    clean(brief.supportingText) ? `TEXTO DE APOIO: “${clean(brief.supportingText)}”` : '',
    clean(brief.cta) ? `CTA: “${clean(brief.cta)}”` : '',
  ].filter(Boolean);

  const blocks = [
    'Crie somente um design e siga integralmente o briefing abaixo. Trate TEXTO EXATO, OBRIGATÓRIO e NÃO USAR como requisitos, não como sugestões.',
    section('FORMATO', formatInstructions[designType] ?? `Formato Canva: ${designType}.`),
    section('OBJETIVO E DIREÇÃO CRIATIVA', brief.objective),
    section('PÚBLICO', brief.audience),
    exactCopy.length > 0
      ? `TEXTO EXATO — COPIAR SEM REESCREVER, RESUMIR OU ACRESCENTAR PALAVRAS\n${exactCopy.map((line) => `- ${line}`).join('\n')}`
      : undefined,
    section('PALETA — USAR EXATAMENTE ESTAS CORES', brief.palette),
    section('ELEMENTOS OBRIGATÓRIOS', list(brief.requiredElements)),
    section('NÃO USAR', list(brief.forbiddenElements)),
    media?.enabled
      ? [
          'COMPOSIÇÃO DE MÍDIA — REQUISITO OBRIGATÓRIO',
          `- Usar o Asset #1 como imagem e fazê-lo ocupar exatamente ${media.imagePercent}% do card.`,
          `- Usar o Asset #2 como vídeo e fazê-lo ocupar exatamente ${100 - media.imagePercent}% do card.`,
          media.orientation === 'vertical'
            ? '- Dividir verticalmente: imagem na parte superior e vídeo na parte inferior.'
            : '- Dividir horizontalmente: imagem à esquerda e vídeo à direita.',
          '- Usar os arquivos fornecidos; não substituir, omitir ou duplicar nenhuma mídia.',
          '- Preservar as áreas principais das duas mídias e evitar cortes agressivos.',
        ].join('\n')
      : undefined,
    section('AJUSTE SOLICITADO NESTA VERSÃO — PRESERVAR TODO O RESTANTE', brief.revision),
    [
      'CHECKLIST ANTES DE FINALIZAR',
      '- Confirme que todos os textos exatos foram copiados literalmente.',
      '- Confirme que nenhum elemento obrigatório foi omitido.',
      '- Confirme que nenhum item da seção NÃO USAR aparece no design.',
      '- Priorize legibilidade, hierarquia visual e contraste.',
    ].join('\n'),
  ].filter((block): block is string => Boolean(block));

  return blocks.join('\n\n');
}

export function validMediaComposition(media: MediaComposition): boolean {
  if (!media.enabled) return true;
  if (media.source === 'files') return true;
  return media.imagePercent >= 10
    && media.imagePercent <= 90
    && /^https:\/\//i.test(clean(media.imageUrl))
    && /^https:\/\//i.test(clean(media.videoUrl));
}

export function hasEnoughBriefing(brief: DesignBrief): boolean {
  return clean(brief.objective).length >= 10;
}

export function exactTextRequirements(brief: DesignBrief): string[] {
  return [brief.headline, brief.supportingText, brief.cta].map(clean).filter(Boolean);
}
