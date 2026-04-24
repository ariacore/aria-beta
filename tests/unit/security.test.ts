import { describe, expect, it } from 'vitest';

import { classifyAction } from '@aria/security';

describe('safety classification', () => {
  it('marks bash execution as destructive', () => {
    const assessment = classifyAction(
      {
        tool: 'bash',
        input: { command: 'Remove-Item C:\\important.txt' }
      },
      null
    );

    expect(assessment.level).toBe('destructive');
    expect(assessment.requiresConfirmation).toBe(true);
  });

  it('raises pointer actions on sensitive URLs', () => {
    const assessment = classifyAction(
      {
        tool: 'computer',
        input: {
          action: 'left_click',
          coordinate: [100, 100]
        }
      },
      'https://bank.example.com/checkout'
    );

    expect(assessment.level).toBe('sensitive');
  });
});

