import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useTheme } from '../useTheme';

describe('useTheme Hook', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = '';
  });

  it('should initialize with dark mode by default', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.lightMode).toBe(false);
    expect(document.body.classList.contains('light-mode')).toBe(false);
  });

  it('should initialize with light mode if stored in localStorage', () => {
    localStorage.setItem('eyesight-theme', 'light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.lightMode).toBe(true);
    expect(document.body.classList.contains('light-mode')).toBe(true);
  });

  it('should toggle theme when toggleTheme is called', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.lightMode).toBe(true);
    expect(localStorage.getItem('eyesight-theme')).toBe('light');
    expect(document.body.classList.contains('light-mode')).toBe(true);
  });
});

it('synchronizes independent theme controls in the same tab', () => {
  localStorage.clear();
  const first = renderHook(() => useTheme());
  const second = renderHook(() => useTheme());
  act(() => first.result.current.setLightMode(true));
  expect(second.result.current.lightMode).toBe(true);
  act(() => second.result.current.toggleTheme());
  expect(first.result.current.lightMode).toBe(false);
  first.unmount(); second.unmount();
});
