import { describe, expect, it } from 'vitest';
import { compileDesignBrief, exactTextRequirements, hasEnoughBriefing, type DesignBrief } from './briefing';

const base: DesignBrief = {
  objective: 'Anunciar a Semana da Tecnologia com visual moderno.',
  audience: 'Pessoas interessadas em tecnologia.',
  headline: 'SEMANA DA TECNOLOGIA',
  supportingText: '30% de desconto',
  cta: 'COMPRE AGORA',
  palette: '#000000, #F74D00 e #F9F9F9',
  requiredElements: '- Dar destaque ao desconto\n• CTA legível',
  forbiddenElements: 'Não inventar preços\nSem gradientes',
  revision: 'Aumentar o destaque do CTA.',
};

describe('compileDesignBrief', () => {
  it('preserva textos literais e explicita prioridades', () => {
    const prompt = compileDesignBrief(base, 'instagram_post');

    expect(prompt).toContain('1080 × 1350 px');
    expect(prompt).toContain('HEADLINE: “SEMANA DA TECNOLOGIA”');
    expect(prompt).toContain('CTA: “COMPRE AGORA”');
    expect(prompt).toContain('ELEMENTOS OBRIGATÓRIOS\n- Dar destaque ao desconto\n- CTA legível');
    expect(prompt).toContain('AJUSTE SOLICITADO NESTA VERSÃO — PRESERVAR TODO O RESTANTE');
    expect(prompt).toContain('Confirme que todos os textos exatos foram copiados literalmente.');
  });

  it('descreve a divisão obrigatória entre imagem e vídeo', () => {
    const prompt = compileDesignBrief(base, 'instagram_post', {
      enabled: true,
      source: 'urls',
      imageUrl: 'https://cdn.test/image.jpg',
      videoUrl: 'https://cdn.test/video.mp4',
      imagePercent: 30,
      orientation: 'vertical',
    });
    expect(prompt).toContain('Asset #1 como imagem');
    expect(prompt).toContain('30% do card');
    expect(prompt).toContain('70% do card');
    expect(prompt).toContain('imagem na parte superior e vídeo na parte inferior');
  });

  it('omite seções opcionais vazias sem perder o objetivo', () => {
    const prompt = compileDesignBrief({
      ...base,
      audience: '',
      headline: '',
      supportingText: '',
      cta: '',
      palette: '',
      requiredElements: '',
      forbiddenElements: '',
      revision: '',
    }, 'poster');

    expect(prompt).toContain('Anunciar a Semana da Tecnologia');
    expect(prompt).not.toContain('TEXTO EXATO —');
    expect(prompt).not.toContain('PÚBLICO');
  });
});

describe('hasEnoughBriefing', () => {
  it('exige um objetivo minimamente descritivo', () => {
    expect(hasEnoughBriefing(base)).toBe(true);
    expect(hasEnoughBriefing({ ...base, objective: 'curto' })).toBe(false);
  });
});

it('extrai somente os textos que precisam ser validados literalmente', () => {
  expect(exactTextRequirements({ ...base, supportingText: '  ' })).toEqual([
    'SEMANA DA TECNOLOGIA',
    'COMPRE AGORA',
  ]);
});
