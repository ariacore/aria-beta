export type ProviderName =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'openrouter'
  | 'groq'
  | 'ollama'
  | 'lmstudio'
  | 'mock';

export type ExecutionMode = 'native' | 'sandboxed' | 'vm';
export type RiskLevel = 'safe' | 'sensitive' | 'destructive';
export type JobStatus = 'running' | 'completed' | 'failed' | 'blocked' | 'cancelled';
export type ScreenshotFormat = 'png';
export type Coordinate = [number, number];

export interface DisplayBounds {
  id: string;
  width: number;
  height: number;
  originX: number;
  originY: number;
  scaleFactor: number;
}

export interface ScreenshotArtifact {
  id: string;
  mimeType: 'image/png';
  base64: string;
  width: number;
  height: number;
  capturedAt: string;
}

export type ScreenAction =
  | { action: 'screenshot' }
  | { action: 'left_click'; coordinate: Coordinate }
  | { action: 'right_click'; coordinate: Coordinate }
  | { action: 'double_click'; coordinate: Coordinate }
  | { action: 'middle_click'; coordinate: Coordinate }
  | { action: 'mouse_move'; coordinate: Coordinate }
  | { action: 'left_click_drag'; startCoordinate: Coordinate; coordinate: Coordinate }
  | { action: 'type'; text: string }
  | { action: 'key'; text: string }
  | { action: 'scroll'; coordinate: Coordinate; direction: 'up' | 'down'; amount: number }
  | { action: 'wait'; duration: number };

export interface BashToolInput {
  command: string;
}

export interface FileEditorToolInput {
  action: 'view' | 'create' | 'write' | 'replace';
  path: string;
  content?: string;
  oldText?: string;
  newText?: string;
}

export interface CompleteToolInput {
  summary: string;
}

export type AriaToolAction =
  | { tool: 'computer'; input: ScreenAction }
  | { tool: 'bash'; input: BashToolInput }
  | { tool: 'editor'; input: FileEditorToolInput }
  | { tool: 'complete'; input: CompleteToolInput };

export interface ProviderDecision {
  provider: ProviderName;
  thought: string;
  confidence: number;
  action: AriaToolAction;
  rawResponse?: string | undefined;
}

export interface ProviderSettings {
  enabled: boolean;
  model: string;
  apiKeyEnv?: string | undefined;
  baseUrl?: string | undefined;
  helperOnly?: boolean | undefined;
  headers?: Record<string, string> | undefined;
}

export interface MetaCognitionConfig {
  enabled: boolean;
  helperProvider: ProviderName | null;
  escalationConfidenceThreshold: number;
  maxEscalationsPerJob: number;
}

export interface SafetyConfig {
  requireConfirmationFor: RiskLevel[];
  blockedDomains: string[];
  maxCostUsdPerJob: number;
  maxRuntimeMinutes: number;
}

export interface ExecutionConfig {
  mode: ExecutionMode;
  captureDisplay: 'primary';
  screenshotFormat: ScreenshotFormat;
  maxSteps: number;
  defaultWaitMs: number;
}

export interface DeliveryTelegramConfig {
  enabled: boolean;
  botTokenEnv: string;
  chatIdEnv: string;
}

export interface DeliveryConfig {
  markdown: boolean;
  html: boolean;
  telegram: DeliveryTelegramConfig;
}

export interface PathConfig {
  workspaceRoot: string;
  dataDir: string;
  artifactsDir: string;
}

export interface AriaConfig {
  defaultProvider: ProviderName;
  providers: Partial<Record<ProviderName, ProviderSettings>>;
  execution: ExecutionConfig;
  metaCognition: MetaCognitionConfig;
  safety: SafetyConfig;
  paths: PathConfig;
  delivery: DeliveryConfig;
}

export interface ProviderPlanRequest {
  goal: string;
  screenshot: ScreenshotArtifact;
  history: AgentStepRecord[];
  availableActions: readonly string[];
  currentUrl?: string | null | undefined;
}

export interface RiskAssessment {
  level: RiskLevel;
  requiresConfirmation: boolean;
  reasons: string[];
}

export interface AuthorizationRequest {
  action: AriaToolAction;
  currentUrl?: string | null | undefined;
  config: SafetyConfig;
}

export interface AuthorizationResult {
  allowed: boolean;
  assessment: RiskAssessment;
  deniedReason?: string | undefined;
}

export interface ActionExecutionResult {
  success: boolean;
  message: string;
  output?: string | undefined;
  currentUrl?: string | null | undefined;
}

export interface AgentStepRecord {
  id: string;
  index: number;
  timestamp: string;
  provider: ProviderName;
  thought: string;
  confidence: number;
  action: AriaToolAction;
  assessment: RiskAssessment;
  result: ActionExecutionResult;
  beforeScreenshotId: string;
  afterScreenshotId?: string | undefined;
}

export interface JobRecord {
  id: string;
  goal: string;
  status: JobStatus;
  startedAt: string;
  finishedAt?: string | undefined;
  provider: ProviderName;
  helperProvider?: ProviderName | null | undefined;
  summary?: string | undefined;
  totalSteps: number;
}

export interface ProcedureRecord {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
  sourceJobId: string;
}

export interface AgentRunOptions {
  maxSteps?: number;
  onEvent?: (event: AgentEvent) => void | Promise<void>;
}

export interface AgentRunResult {
  job: JobRecord;
  steps: AgentStepRecord[];
}

export type AgentEvent =
  | { type: 'job_started'; job: JobRecord }
  | { type: 'decision'; jobId: string; decision: ProviderDecision; stepIndex: number }
  | { type: 'action_executed'; jobId: string; step: AgentStepRecord }
  | { type: 'job_completed'; job: JobRecord }
  | { type: 'job_failed'; job: JobRecord; error: string };

export interface ComputerController {
  captureScreenshot(): Promise<ScreenshotArtifact>;
  execute(action: ScreenAction): Promise<ActionExecutionResult>;
  getDisplayBounds(): Promise<DisplayBounds>;
}

export interface MemoryStore {
  startJob(job: JobRecord): Promise<void>;
  appendStep(jobId: string, step: AgentStepRecord): Promise<void>;
  finishJob(jobId: string, status: JobStatus, summary?: string): Promise<JobRecord>;
  getJob(jobId: string): Promise<JobRecord | null>;
  getSteps(jobId: string): Promise<AgentStepRecord[]>;
  findProcedure(goal: string): Promise<ProcedureRecord | null>;
  rememberProcedure(procedure: ProcedureRecord): Promise<void>;
}

export interface ProviderAdapter {
  readonly name: ProviderName;
  plan(request: ProviderPlanRequest): Promise<ProviderDecision>;
}

export interface AriaLogger {
  child(bindings: Record<string, unknown>): AriaLogger;
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface ConfirmationPrompt {
  (assessment: RiskAssessment, action: AriaToolAction): Promise<boolean>;
}

export interface SafetyGate {
  authorize(request: AuthorizationRequest): Promise<AuthorizationResult>;
}
