export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue | undefined };

export type AppSection = "player" | "world" | "json";
export type EditorMode = "guided" | "json";

export type FileStatus =
  | "idle"
  | "loaded"
  | "decrypted"
  | "modified"
  | "ready"
  | "error";

export interface ValidationIssue {
  id: string;
  level: "error" | "warning";
  message: string;
}

export interface SaleItemDraft extends JsonObject {
  itemName: string;
  salePercent: number;
}

export interface PlayerDataDraft extends JsonObject {
  characterName?: string;
  age?: string;
  gender?: number;
  registered?: boolean;
  characterInitialized?: boolean;
  rankLevel?: number;
  rankExp?: number;
  xpNeeded?: number;
  prestige?: number;
  unlockedCosmetics?: string[];
  pin1?: string;
  pin2?: string;
  patch1?: string;
  patch2?: string;
  tapes?: string[];
  logs?: string[];
  hasDoorStunnedBefore?: boolean;
  hasBeenWoundedBefore?: boolean;
  hasBeenInfectedBefore?: boolean;
  seenTravelFeeTip?: boolean;
  seenDeckSkinTip?: boolean;
  dataDeckSkin?: number;
  snakeHighScore?: number;
}

export interface WorldDataDraft extends JsonObject {
  worldName?: string;
  uiName?: string;
  uiDescription?: string;
  interior?: boolean;
  resetContainers?: boolean;
  name?: string;
  hideFlags?: number;
}

export interface WorldSaveDraft extends JsonObject {
  gamemode?: number;
  hasBeenToFinalDestination?: boolean;
  timeToPayDebt?: boolean;
  cyclesCompletedForDifficultyIncrease?: number;
  cycleDifficulty?: number;
  debt?: number;
  debtPayed?: number;
  credits?: number;
  baseDebtForScaling?: number;
  scrapBin?: number;
  sellingForPercentage?: number;
  saleItems?: SaleItemDraft[];
  days?: number;
  maxPlayers?: number;
  privacy?: number;
  daysRemaining?: number;
  debtBeforeChanged?: number;
  lastPOI?: string;
  totalDeaths?: number;
  totalDowns?: number;
  totalCreditsEarned?: number;
  totalCreditsSpent?: number;
  cyclesCompleted?: number;
  trainItems?: string[];
  playerFID?: number;
  worldData?: WorldDataDraft;
}

export interface DraftState {
  rawInput: string;
  fileName: string | null;
  decryptedText: string;
  data: JsonObject | null;
  section: AppSection;
  mode: EditorMode;
  fileStatus: FileStatus;
  lastAction: string;
  encryptedOutput: string;
  issues: ValidationIssue[];
}
