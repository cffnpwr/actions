export interface MiseTool {
  version: string;
  requested_version?: string;
  install_path: string;
  source?: {
    type: string;
    path: string;
  };
  installed: boolean;
  active: boolean;
}

export type MiseTools = Record<string, MiseTool[]>;
