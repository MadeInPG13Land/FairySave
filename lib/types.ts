// FairySaveTool Types

export enum FileStatus {
  Empty = 'empty',
  Loaded = 'loaded',
  Decrypted = 'decrypted',
  Modified = 'modified',
  Ready = 'ready',
  Error = 'error',
}

export enum FileAccessStatus {
  None = 'none',
  Prompt = 'prompt',
  Granted = 'granted',
  Denied = 'denied',
  Unsupported = 'unsupported',
}

export enum EditorSection {
  Player = 'player',
  World = 'world',
  Json = 'json',
}

export enum TabKind {
  Empty = 'empty',
  Player = 'player',
  World = 'world',
  Json = 'json',
}

export enum GameMode {
  Endless = 0,
  Exploration = 1,
  Nightmare = 2,
  Escape = 3,
}

export enum Gender {
  NotSet = 0,
  Male = 1,
  Female = 2,
  Other = 3,
}

export enum PrivacyMode {
  Public = 0,
  FriendsOnly = 1,
  Private = 2,
}

export enum DatadeckSkin {
  Default = 0,
  Retro = 1,
  Lost = 2,
  Ecd = 3,
  Bling = 4,
  Medical = 5,
  Spore = 6,
  Flesh = 7,
  Casino = 8,
  Fairyland = 9,
  Corpdeck = 10,
  Entitydeck = 11,
}

export enum Poi {
  Metro = 'Metro',
  LostMetro = 'Lost Metro',
  Hotel = 'Hotel',
  Hospital = 'Hospital',
  Tunnels = 'Tunnels',
  Bunker = 'Bunker',
  Plantation = 'Plantation',
  Warehouse = 'Warehouse',
  Mineshaft = 'Mineshaft',
  Pentagon = 'Pentagon',
  Casino = 'Casino',
  Highrise = 'Highrise',
}

export enum WorldEditorTab {
  Overview = 'overview',
  Destinations = 'destinations',
  Items = 'items',
}

export enum WorldModifier {
  None = 0,
  Blackout = 1,
  Emp = 2,
  Dread = 3,
  Paranoia = 4,
  Minefield = 5,
  Spores = 6,
  Whiteout = 7,
  Sunken = 8,
  Error = 9,
  Displaced = 10,
  Surplus = 11,
  Vigor = 12,
  Shadowstep = 13,
  Unlocked = 14,
}

export interface PlayerData {
  [key: string]: unknown;
  characterName: string;
  age: string;
  gender: Gender;
  registered: boolean;
  characterInitialized: boolean;
  rankLevel: number;
  rankExp: number;
  xpNeeded: number;
  prestige: number;
  unlockedCosmetics: string[];
  pin1: string;
  pin2: string;
  patch1: string;
  patch2: string;
  tapes: string[];
  logs: string[];
  hasDoorStunnedBefore: boolean;
  hasBeenWoundedBefore: boolean;
  hasBeenInfectedBefore: boolean;
  seenTravelFeeTip: boolean;
  dataDeckSkin_retro_unlocked: boolean;
  seenDeckSkinTip: boolean;
  dataDeckSkin: DatadeckSkin;
  snakeHighScore: number;
}

export interface SaleItem {
  [key: string]: unknown;
  itemName: string;
  salePercent: number;
}

export interface VectorData {
  [key: string]: unknown;
  x: number;
  y: number;
  z: number;
  normalized?: VectorData;
  magnitude?: number;
  sqrMagnitude?: number;
}

export interface SavedItemData {
  [key: string]: unknown;
  itemDataName: string;
  itemName: string;
  rarityId: number;
  itemLevel: number;
  requiredLevel: number;
  value: number;
  position: VectorData;
  rotation: VectorData;
}

export interface TrainItem {
  [key: string]: unknown;
  savedItemData: SavedItemData;
}

export interface WorldData {
  [key: string]: unknown;
  gamemode: GameMode;
  hasBeenToFinalDestination: boolean;
  timeToPayDebt: boolean;
  cyclesCompletedForDifficultyIncrease: number;
  cycleDifficulty: number;
  debt: number;
  debtPayed: number;
  credits: number;
  baseDebtForScaling: number;
  scrapBin: number;
  sellingForPercentage: number;
  saleItems: SaleItem[];
  days: number;
  maxPlayers: number;
  privacy: PrivacyMode;
  daysRemaining: number;
  debtBeforeChanged: number;
  lastPOI: Poi;
  MetroLootSaturation: number;
  'Lost MetroLootSaturation': number;
  HotelLootSaturation: number;
  HospitalLootSaturation: number;
  TunnelsLootSaturation: number;
  BunkerLootSaturation: number;
  PlantationLootSaturation: number;
  WarehouseLootSaturation: number;
  MineshaftLootSaturation: number;
  PentagonLootSaturation: number;
  CasinoLootSaturation: number;
  HighriseLootSaturation: number;
  WorldModifier_Metro: WorldModifier;
  EffectiveWorldModifier_Metro: WorldModifier;
  'WorldModifier_Lost Metro': WorldModifier;
  'EffectiveWorldModifier_Lost Metro': WorldModifier;
  WorldModifier_Hotel: WorldModifier;
  EffectiveWorldModifier_Hotel: WorldModifier;
  WorldModifier_Hospital: WorldModifier;
  EffectiveWorldModifier_Hospital: WorldModifier;
  WorldModifier_Tunnels: WorldModifier;
  EffectiveWorldModifier_Tunnels: WorldModifier;
  WorldModifier_Bunker: WorldModifier;
  EffectiveWorldModifier_Bunker: WorldModifier;
  WorldModifier_Plantation: WorldModifier;
  EffectiveWorldModifier_Plantation: WorldModifier;
  WorldModifier_Warehouse: WorldModifier;
  EffectiveWorldModifier_Warehouse: WorldModifier;
  WorldModifier_Mineshaft: WorldModifier;
  EffectiveWorldModifier_Mineshaft: WorldModifier;
  WorldModifier_Pentagon: WorldModifier;
  EffectiveWorldModifier_Pentagon: WorldModifier;
  WorldModifier_Casino: WorldModifier;
  EffectiveWorldModifier_Casino: WorldModifier;
  WorldModifier_Highrise: WorldModifier;
  EffectiveWorldModifier_Highrise: WorldModifier;
  totalDeaths: number;
  totalDowns: number;
  totalCreditsEarned: number;
  totalCreditsSpent: number;
  cyclesCompleted: number;
  trainItems: TrainItem[];
  playerFID: number;
  worldData: {
    [key: string]: unknown;
    worldName: string;
    uiName: string;
    uiDescription: string;
    interior: boolean;
    resetContainers: boolean;
    name: string;
    hideFlags: number;
  };
}

export interface SaveData {
  player: PlayerData;
  world: WorldData;
}

export interface EditorTab {
  id: string;
  title: string;
  kind: TabKind;
  fileName: string | null;
  fileHandle?: FileSystemFileHandle | null;
  fileAccessStatus: FileAccessStatus;
  fileStatus: FileStatus;
  lastAction: string | null;
  playerData: PlayerData | null;
  worldData: WorldData | null;
  rawJson: string;
  jsonMode: boolean;
  isModified: boolean;
}
