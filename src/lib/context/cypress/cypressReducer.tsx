'use client';

import {
  AppFoldersType,
  AppWorkspacesType,
  CypressState,
} from './CypressProvider';
import { AddFileProps, UpdateFileProps } from './types';

export type CypressAction =
  | {
      type: CypressActionType.setWorkspaces;
      payload: { workspaces: AppWorkspacesType[] };
    }
  | {
      type: CypressActionType.setFolders;
      payload: { workspaceId: string; folders: [] | AppFoldersType[] };
    }
  | {
      type: CypressActionType.addFolder;
      payload: { workspaceId: string; folder: AppFoldersType };
    }
  | {
      type: CypressActionType.updateFolder;
      payload: {
        folder: Partial<AppFoldersType>;
        workspaceId: string;
        folderId: string;
      };
    }
  | {
      type: CypressActionType.updateFile;
      payload: UpdateFileProps;
    }
  | {
      type: CypressActionType.addFile;
      payload: AddFileProps;
    };

export enum CypressActionType {
  setWorkspaces = 'SET_WORKSPACES',
  setFolders = 'SET_FOLDERS',
  addFolder = 'ADD_FOLDER',
  updateFolder = 'UPDATE_FOLDER',
  updateFile = 'UPDATE_FILE',
  addFile = 'ADD_FILE',
}

export const cypressReducer = (
  state: CypressState,
  action: CypressAction
): CypressState => {
  switch (action.type) {
    case CypressActionType.setWorkspaces:
      return { ...state, workspaces: action.payload.workspaces };

    /////* Folders
    case CypressActionType.setFolders:
      return {
        ...state,

        workspaces: state.workspaces.map(workspace => {
          if (workspace.id === action.payload.workspaceId) {
            return {
              ...workspace,

              folders: action.payload.folders.sort(
                (a, b) =>
                  new Date(a.createdAt).getTime() -
                  new Date(b.createdAt).getTime()
              ),
            };
          }

          return workspace;
        }),
      };

    case CypressActionType.addFolder:
      return {
        ...state,

        workspaces: state.workspaces.map(workspace => ({
          ...workspace,

          folders: [...workspace.folders, action.payload.folder].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          ),
        })),
      };

    case CypressActionType.updateFolder:
      return {
        ...state,
        workspaces: state.workspaces.map(workspace => {
          if (workspace.id === action.payload.workspaceId) {
            return {
              ...workspace,
              folders: workspace.folders.map(folder => {
                if (folder.id === action.payload.folderId) {
                  return { ...folder, ...action.payload.folder };
                }
                return folder;
              }),
            };
          }
          return workspace;
        }),
      };

    /////* Files
    case CypressActionType.addFile:
      return {
        ...state,

        workspaces: state.workspaces.map(workspace => {
          if (workspace.id === action.payload.workspaceId) {
            return {
              ...workspace,
              folders: workspace.folders.map(folder => {
                if (folder.id === action.payload.folderId) {
                  return {
                    ...folder,
                    files: [...folder.files, action.payload.file].sort(
                      (a, b) =>
                        new Date(a.createdAt).getTime() -
                        new Date(b.createdAt).getTime()
                    ),
                  };
                }
                return folder;
              }),
            };
          }
          return workspace;
        }),
      };

    case CypressActionType.updateFile:
      return {
        ...state,

        workspaces: state.workspaces.map(workspace => {
          if (workspace.id === action.payload.workspaceId) {
            return {
              ...workspace,
              folders: workspace.folders.map(folder => {
                if (folder.id === action.payload.folderId) {
                  return {
                    ...folder,
                    files: folder.files.map(file => {
                      if (file.id === action.payload.fileId) {
                        return {
                          ...file,
                          ...action.payload.file,
                        };
                      }
                      return file;
                    }),
                  };
                }
                return folder;
              }),
            };
          }
          return workspace;
        }),
      };

    default:
      return state;
  }
};
