import pc from 'picocolors';

export const palette = {
  accent:      (text: string) => pc.magenta(text),   // headings, labels, primary highlights
  accentBright:(text: string) => pc.cyan(text),      // command names, emphasis  
  accentDim:   (text: string) => pc.blue(text),      // secondary highlights
  cyan:        (text: string) => pc.cyan(text),      // live/active states, the "AI is working" color
  success:     (text: string) => pc.green(text),     // success states, completions
  warn:        (text: string) => pc.yellow(text),    // warnings, attention items
  error:       (text: string) => pc.red(text),       // errors, failures, destructive confirmations
  muted:       (text: string) => pc.gray(text),      // metadata, timestamps, de-emphasis
  dim:         (text: string) => pc.dim(text),       // borders, separators
  white:       (text: string) => pc.white(text),     // primary text
  bg:          (text: string) => pc.bgBlack(text),   // terminal background
};
