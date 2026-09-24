import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DesignResult } from './DesignResult';

describe('DesignResult', () => {
  it('mostra somente formatos suportados e envia o formato escolhido', () => {
    const onExport = vi.fn();
    render(
      <DesignResult
        design={{ id: 'D1234567890', title: 'Campanha', editUrl: 'https://www.canva.com/design/edit' }}
        exportFormats={['png', 'pdf']}
        downloads={[]}
        instructionCheck={{
          status: 'missing',
          items: [
            { text: 'SEMANA DA TECNOLOGIA', found: true },
            { text: 'COMPRE AGORA', found: false },
          ],
        }}
        disabled={false}
        onExport={onExport}
        onReset={() => undefined}
      />,
    );

    expect(screen.queryByRole('button', { name: 'MP4' })).not.toBeInTheDocument();
    expect(screen.getByText('Revise os textos antes de exportar')).toBeVisible();
    expect(screen.getByText('COMPRE AGORA').closest('li')).toHaveClass('missing');
    fireEvent.click(screen.getByRole('button', { name: 'PNG' }));
    expect(onExport).toHaveBeenCalledWith('png');
  });

  it('identifica links de download como temporários', () => {
    render(
      <DesignResult
        design={{ id: 'D1234567890' }}
        exportFormats={[]}
        downloads={[{ format: 'png', url: 'https://download.test/banner.png' }]}
        disabled={false}
        onExport={() => undefined}
        onReset={() => undefined}
      />,
    );
    expect(screen.getByRole('link', { name: /Baixar PNG.*link temporário/ })).toBeVisible();
  });
});
