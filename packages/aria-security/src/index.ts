import type {
  AriaToolAction,
  AuthorizationRequest,
  AuthorizationResult,
  ConfirmationPrompt,
  RiskAssessment,
  SafetyGate,
  RiskLevel
} from '@aria/types';

export function classifyAction(action: AriaToolAction, currentUrl?: string | null): RiskAssessment {
  const reasons: string[] = [];
  let level: RiskLevel = 'safe';

  switch (action.tool) {
    case 'complete':
      reasons.push('Completing the job is non-destructive.');
      break;
    case 'computer':
      level = classifyComputerAction(action.input, reasons);
      break;
    case 'bash':
      level = 'destructive';
      reasons.push('Shell command execution can change the system state.');
      break;
    case 'editor':
      level = action.input.action === 'view' ? 'safe' : 'sensitive';
      reasons.push(
        action.input.action === 'view'
          ? 'Viewing a file is read-only.'
          : 'Editing files changes user data and should be reviewed.'
      );
      break;
  }

  if (currentUrl && isSensitiveUrl(currentUrl)) {
    level = maxRisk(level, 'sensitive');
    reasons.push(`Current URL looks sensitive: ${currentUrl}`);
  }

  return {
    level,
    requiresConfirmation: level !== 'safe',
    reasons
  };
}

export function createSafetyGate(confirm: ConfirmationPrompt): SafetyGate {
  return {
    async authorize(request: AuthorizationRequest): Promise<AuthorizationResult> {
      const assessment = classifyAction(request.action, request.currentUrl);
      const currentUrl = request.currentUrl ?? null;

      const isBlockedUrl =
        currentUrl !== null &&
        request.config.blockedDomains.some((fragment) =>
          currentUrl.toLowerCase().includes(fragment.toLowerCase())
        );

      if (isBlockedUrl) {
        return {
          allowed: false,
          deniedReason: `Blocked by safety policy for URL: ${currentUrl}`,
          assessment: {
            ...assessment,
            level: 'destructive',
            requiresConfirmation: true,
            reasons: [...assessment.reasons, 'The current URL matches the configured blocklist.']
          }
        };
      }

      if (!request.config.requireConfirmationFor.includes(assessment.level)) {
        return { allowed: true, assessment };
      }

      const approved = await confirm(assessment, request.action);
      return {
        allowed: approved,
        deniedReason: approved ? undefined : 'User declined the action confirmation.',
        assessment
      };
    }
  };
}

function classifyComputerAction(
  action: Extract<AriaToolAction, { tool: 'computer' }>['input'],
  reasons: string[]
): RiskLevel {
  switch (action.action) {
    case 'screenshot':
    case 'mouse_move':
    case 'wait':
      reasons.push('Observation or passive action only.');
      return 'safe';
    case 'type':
      reasons.push('Typing can change application state or submit hidden forms.');
      return 'sensitive';
    case 'key':
      reasons.push('Keyboard shortcuts can trigger destructive behavior.');
      return action.text.toLowerCase().includes('delete') || action.text.toLowerCase().includes('alt+f4')
        ? 'destructive'
        : 'sensitive';
    case 'left_click':
    case 'double_click':
    case 'middle_click':
    case 'right_click':
    case 'left_click_drag':
    case 'scroll':
      reasons.push('Pointer action can change application state.');
      return 'sensitive';
    default:
      reasons.push('Unknown computer action treated conservatively.');
      return 'destructive';
  }
}

function isSensitiveUrl(value: string): boolean {
  const lower = value.toLowerCase();
  return ['bank', 'payment', 'billing', 'admin', 'checkout'].some((fragment) => lower.includes(fragment));
}

function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  const order: Record<RiskLevel, number> = {
    safe: 0,
    sensitive: 1,
    destructive: 2
  };

  return order[a] >= order[b] ? a : b;
}
