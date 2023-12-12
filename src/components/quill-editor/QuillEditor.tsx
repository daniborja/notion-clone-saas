'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// quill styles - theme
import 'quill/dist/quill.snow.css';

import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { useCypress } from '@/lib/hooks/useCypress';
import { WPListType } from '@/lib/interfaces';
import {
  deleteFile,
  deleteFolder,
  findUser,
  updateFile,
  updateFolder,
} from '@/lib/supabase/queries';
import { File, Folder, workspace } from '@/lib/supabase/supabase.types';
import { Avatar, AvatarFallback, AvatarImage, Button } from '../ui';
import { Badge } from '../ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

export type QuillEditorProps = {
  dirDetails: File | Folder | workspace;
  fileId: string; // id of fetched data
  dirType: 'workspace' | 'folder' | 'file';
};

/////* Toolbar Opts - custom module in QuillEditor
var TOOLBAR_OPTIONS = [
  ['bold', 'italic', 'underline', 'strike'], // toggled buttons
  ['blockquote', 'code-block'],

  [{ header: 1 }, { header: 2 }], // custom button values
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ script: 'sub' }, { script: 'super' }], // superscript/subscript
  [{ indent: '-1' }, { indent: '+1' }], // outdent/indent
  [{ direction: 'rtl' }], // text direction

  [{ size: ['small', false, 'large', 'huge'] }], // custom dropdown
  [{ header: [1, 2, 3, 4, 5, 6, false] }],

  [{ color: [] }, { background: [] }], // dropdown with defaults from theme
  [{ font: [] }],
  [{ align: [] }],

  ['clean'], // remove formatting button
];

const QuillEditor: React.FC<QuillEditorProps> = ({
  fileId,
  dirType,
  dirDetails,
}) => {
  const supabase = createClientComponentClient();
  const {
    state,
    workspaceId,
    folderId,
    updateFile: updateFileContext,
    updateFolder: updateFolderContext,
    deleteFile: deleteFileContext,
    deleteFolder: deleteFolderContext,
  } = useCypress();
  const { user } = useAuthUser();
  const router = useRouter();
  const pathname = usePathname();

  const [quill, setQuill] = useState<any>(null);
  const [collaborators, setCollaborators] = useState<
    { id: string; email: string; avatarUrl: string }[]
  >([]);
  const [deletingBanner, setDeletingBanner] = useState(false);

  // saving state like Google Docs
  const [saving, setSaving] = useState(false);

  // real tiem cursors like Google Docs
  const [localCursors, setLocalCursors] = useState<any>([]);

  ///* realtime with sockets
  // const { socket, isConnected } = useSocket();

  ///* debouncer
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  //////* Display Quill Editor
  const wrapperRef = useCallback(async (wrapper: any) => {
    // quill need window object
    if (typeof window !== 'undefined') {
      if (wrapper === null) return;
      wrapper.innerHTML = ''; // clear wrapper to avoid creating new editors each time

      const editor = document.createElement('div');
      wrapper.append(editor);

      const Quill = (await import('quill')).default;
      // const QuillCursors = (await import('quill-cursors')).default;
      // Quill.register('modules/cursors', QuillCursors);

      const q = new Quill(editor, {
        theme: 'snow',
        // we can create custom component in Quill
        modules: {
          toolbar: TOOLBAR_OPTIONS,
          // cursors: {
          //   transformOnTextChange: true,
          // },
        },
      });
      setQuill(q);
    }
  }, []);

  //////* Fix caching probles (server & client)
  const details = useMemo(() => {
    // keep tracking to dir in contextprovider, if it does not exist, use server dir
    let selectedDir;
    if (dirType === WPListType.file) {
      selectedDir = state.workspaces
        .find(workspace => workspace.id === workspaceId)
        ?.folders.find(folder => folder.id === folderId)
        ?.files.find(file => file.id === fileId);
    }
    if (dirType === WPListType.folder) {
      selectedDir = state.workspaces
        .find(workspace => workspace.id === workspaceId)
        ?.folders.find(folder => folder.id === fileId);
    }
    if (dirType === WPListType.workspace) {
      selectedDir = state.workspaces.find(workspace => workspace.id === fileId);
    }

    if (selectedDir) return selectedDir;

    return {
      title: dirDetails.title,
      iconId: dirDetails.iconId,
      createdAt: dirDetails.createdAt,
      data: dirDetails.data,
      inTrash: dirDetails.inTrash,
      bannerUrl: dirDetails.bannerUrl,
    } as workspace | Folder | File;
  }, [dirType, dirDetails, state.workspaces, workspaceId, folderId, fileId]);

  //////* BreadCrumbs
  const breadCrumbs = useMemo(() => {
    if (!pathname || !state.workspaces || !workspaceId) return;

    ///* Workspace BreadCrumb
    const segments = pathname
      .split('/')
      .filter(val => val !== 'dashboard' && val);

    const workspaceDetails = state.workspaces.find(
      workspace => workspace.id === workspaceId
    );

    const workspaceBreadCrumb = workspaceDetails
      ? `${workspaceDetails.iconId} ${workspaceDetails.title}`
      : '';

    if (segments.length === 1) {
      return workspaceBreadCrumb;
    }

    ///* Folder BreadCrumb
    const folderSegment = segments[1];
    const folderDetails = workspaceDetails?.folders.find(
      folder => folder.id === folderSegment
    );
    const folderBreadCrumb = folderDetails
      ? `/ ${folderDetails.iconId} ${folderDetails.title}`
      : '';

    if (segments.length === 2) {
      return `${workspaceBreadCrumb} ${folderBreadCrumb}`;
    }

    ///* File BreadCrumb
    const fileSegment = segments[2];
    const fileDetails = folderDetails?.files.find(
      file => file.id === fileSegment
    );
    const fileBreadCrumb = fileDetails
      ? `/ ${fileDetails.iconId} ${fileDetails.title}`
      : '';

    return `${workspaceBreadCrumb} ${folderBreadCrumb} ${fileBreadCrumb}`;
  }, [state, pathname, workspaceId]);

  //////* Effects
  //// collaborators real time
  useEffect(() => {
    if (!fileId || quill === null) return;

    const room = supabase.channel(fileId);
    room
      .on('presence', { event: 'sync' }, () => {
        const newState = room.presenceState();
        const newCollaborators = Object.values(newState).flat() as any;
        setCollaborators(newCollaborators);

        if (user) {
          const allCursors: any = [];
          newCollaborators.forEach(
            (collaborator: { id: string; email: string; avatar: string }) => {
              if (collaborator.id !== user.id) {
                const userCursor = quill.getModule('cursors');
                userCursor.createCursor(
                  collaborator.id,
                  collaborator.email.split('@')[0],
                  `#${Math.random().toString(16).slice(2, 8)}`
                );
                allCursors.push(userCursor);
              }
            }
          );

          setLocalCursors(allCursors);
        }
      })
      .subscribe(async status => {
        if (status !== 'SUBSCRIBED' || !user) return;
        const response = await findUser(user.id);
        if (!response) return;

        room.track({
          id: user.id,
          email: user.email?.split('@')[0],
          avatarUrl: response.avatarUrl
            ? supabase.storage.from('avatars').getPublicUrl(response.avatarUrl)
                .data.publicUrl
            : '',
        });
      });

    return () => {
      supabase.removeChannel(room);
    };
  }, [fileId, quill, supabase, user]);

  //////* Handlers
  const restoreFileHandler = async () => {
    if (!workspaceId) return;

    if (dirType === WPListType.file) {
      if (!folderId) return;
      updateFileContext({
        file: { inTrash: '' },
        fileId,
        folderId,
        workspaceId,
      });
      await updateFile({ inTrash: '' }, fileId);
    }

    if (dirType === WPListType.folder) {
      updateFolderContext({
        folder: { inTrash: '' },
        folderId: fileId,
        workspaceId,
      });
      await updateFolder({ inTrash: '' }, fileId);
    }
  };

  const deleteFileHandler = async () => {
    if (!workspaceId) return;

    if (dirType === WPListType.file) {
      if (!folderId) return;

      deleteFileContext({ fileId, folderId, workspaceId });
      await deleteFile(fileId);
      router.replace(`/dashboard/${workspaceId}`);
    }

    if (dirType === WPListType.folder) {
      deleteFolderContext({ folderId: fileId, workspaceId });
      await deleteFolder(fileId);
      router.replace(`/dashboard/${workspaceId}`);
    }
  };

  return (
    <>
      <div className="relative">
        {/* ========== Restore / Trash ========== */}
        {details.inTrash && (
          <article className="py-2 z-40 bg-[#EB5757] flex md:flex-row flex-col justify-center items-center gap-4 flex-wrap">
            <div className="flex flex-col md:flex-row gap-2 justify-center items-center">
              <span className="text-white">
                This {dirType} is in the trash.
              </span>
              <Button
                size="sm"
                variant="outline"
                className="bg-transparent border-white text-white hover:bg-white hover:text-[#EB5757]"
                onClick={restoreFileHandler}
              >
                Restore
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="bg-transparent border-white text-white hover:bg-white hover:text-[#EB5757]"
                onClick={deleteFileHandler}
              >
                Delete
              </Button>
            </div>

            <span className="text-sm text-white">{details.inTrash}</span>
          </article>
        )}

        {/* ========== BreadCrumbs & Status (saved/saving) ========== */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-between justify-center sm:items-center sm:p-2 p-8">
          {/* ------ BreadCrum ------ */}
          <div>{breadCrumbs}</div>

          {/* ------ Collaborators online ------ */}
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center h-10">
              {collaborators?.map(collaborator => (
                <TooltipProvider key={collaborator.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Avatar className="-ml-3 bg-background border-2 flex items-center justify-center border-white h-8 w-8 rounded-full">
                        <AvatarImage
                          src={
                            collaborator.avatarUrl ? collaborator.avatarUrl : ''
                          }
                          className="rounded-full"
                        />
                        <AvatarFallback>
                          {collaborator.email.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>{collaborator.email}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>

            {/* ------ doc status ------ */}
            {saving ? (
              <Badge
                variant="secondary"
                className="bg-orange-600 top-4 text-white right-4 z-50"
              >
                Saving...
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="bg-emerald-600 top-4 text-white right-4 z-50"
              >
                Saved
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-center items-center flex-col mt-2 relative">
        <div id="container" className="max-w-[800px]" ref={wrapperRef}></div>
      </div>
    </>
  );
};

export default QuillEditor;
