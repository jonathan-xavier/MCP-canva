import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormatSelector } from './FormatSelector';

describe('FormatSelector', () => {
  it('renderiza somente formatos informados e envia a nova seleção', () => {
    const onChange = vi.fn();
    render(<FormatSelector formats={['instagram_post', 'poster']} value="instagram_post" onChange={onChange} />);

    expect(screen.getByRole('radio', { name: /Post Instagram/ })).toBeChecked();
    expect(screen.queryByRole('radio', { name: /Story/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Pôster/ }));
    expect(onChange).toHaveBeenCalledWith('poster');
  });
});
