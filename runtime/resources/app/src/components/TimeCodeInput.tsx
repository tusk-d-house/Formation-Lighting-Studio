import React, { useRef, useState, useEffect } from 'react';
import { formatTimestamp, parseTimestampInput } from '../utils/interpolation';

interface TimeCodeInputProps {
  value: number; // in seconds
  onChange: (newSeconds: number) => void;
  min?: number;
  max?: number;
  className?: string;
  disabled?: boolean;
  title?: string;
}

/**
 * "xx:xx.x" (MM:SS.T) standardized timecode input.
 * Supports clicking any digit and adjusting via Up/Down arrow keys.
 */
export const TimeCodeInput: React.FC<TimeCodeInputProps> = ({
  value,
  onChange,
  min = 0,
  max = 9999,
  className = '',
  disabled = false,
  title,
}) => {
  const [text, setText] = useState(() => formatTimestamp(value));
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sync internal text when external value changes and input is not active
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setText(formatTimestamp(value));
    }
  }, [value]);

  const commitValue = (sec: number) => {
    const clamped = Math.max(min, Math.min(max, Math.round(sec * 100) / 100));
    onChange(clamped);
    setText(formatTimestamp(clamped));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const input = inputRef.current;
    if (!input) return;

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const pos = input.selectionStart ?? 0;
      const isUp = e.key === 'ArrowUp';
      const factor = isUp ? 1 : -1;

      // Determine delta by cursor position in "MM:SS.HH" (e.g. 0,1 : 3,4 . 6 7)
      let step = 0.01;
      if (pos <= 1) {
        step = pos === 0 ? 600 : 60; // 10 minutes or 1 minute
      } else if (pos === 2) {
        step = 60; // ':'
      } else if (pos === 3) {
        step = 10; // 10 seconds
      } else if (pos === 4 || pos === 5) {
        step = 1.0; // 1 second or '.'
      } else if (pos === 6) {
        step = 0.1; // tenths (0.1s)
      } else {
        step = 0.01; // hundredths (0.01s)
      }

      const currentSec = parseTimestampInput(input.value) ?? value;
      const nextSec = Math.max(
        min,
        Math.min(max, Math.round((currentSec + factor * step) * 100) / 100)
      );
      commitValue(nextSec);

      // Restore cursor position on next frame
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(pos, pos);
        }
      });
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const parsed = parseTimestampInput(input.value);
      if (parsed !== null) {
        commitValue(parsed);
      } else {
        setText(formatTimestamp(value));
      }
      input.blur();
    }
  };

  const handleBlur = () => {
    const parsed = parseTimestampInput(text);
    if (parsed !== null) {
      commitValue(parsed);
    } else {
      setText(formatTimestamp(value));
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={text}
      disabled={disabled}
      title={title ?? '各桁をクリックして十字キー↑↓で調整できます (0.01秒単位)'}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className={`font-mono text-center tracking-wider select-text ${className}`}
    />
  );
};
