'use client';

import { Lock, Plus, Share } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { WorkspacesPermissions } from '@/lib/interfaces';
import { addCollaborators, createWorkspace } from '@/lib/supabase/queries';
import { User, workspace } from '@/lib/supabase/supabase.types';
import { Avatar, AvatarFallback, AvatarImage } from '@radix-ui/react-avatar';
import { CollaboratorSearch } from '.';
import { Button, Input, Label } from '../ui';
import { ScrollArea } from '../ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useToast } from '../ui/use-toast';

export type WorkspaceCreatorProps = {};

const WorkspaceCreator: React.FC<WorkspaceCreatorProps> = () => {
  const { user } = useAuthUser();
  const router = useRouter();
  const { toast } = useToast();

  const [permissions, setPermissions] = useState(WorkspacesPermissions.private);
  const [title, setTitle] = useState('');
  const [collaborators, setCollaborators] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  ///* handlers
  const addCollaborator = (user: User) => {
    setCollaborators([...collaborators, user]);
  };

  const removeCollaborator = (user: User) => {
    setCollaborators(collaborators.filter(c => c.id !== user.id));
  };

  const createItem = async () => {
    setIsLoading(true);
    const uuid = uuidv4();

    if (user?.id) {
      const newWorkspace: workspace = {
        data: null,
        createdAt: new Date().toISOString(),
        iconId: '💼',
        id: uuid,
        inTrash: '',
        title,
        workspaceOwner: user.id,
        logo: null,
        bannerUrl: '',
      };

      if (permissions === WorkspacesPermissions.private) {
        toast({ title: 'Success', description: 'Created the workspace' });
        await createWorkspace(newWorkspace);
        router.refresh();
      }
      if (permissions === WorkspacesPermissions.shared) {
        toast({ title: 'Success', description: 'Created the workspace' });
        await createWorkspace(newWorkspace);
        await addCollaborators(collaborators, uuid);
        router.refresh();
      }
    }
    setIsLoading(false);
  };

  return (
    <div className="flex gap-4 flex-col">
      <div>
        <Label htmlFor="name" className="text-sm text-muted-foreground">
          Name
        </Label>

        <div className="flex justify-center items-center gap-2 pt-[3px]">
          <Input
            name="name"
            value={title}
            placeholder="Workspace Name"
            onChange={e => {
              setTitle(e.target.value);
            }}
          />
        </div>
      </div>

      {/* ====== Permissions ====== */}
      <>
        <Label htmlFor="permissions" className="text-sm text-muted-foreground">
          Permission
        </Label>

        {/* --- Select workspace premission --- */}
        <Select
          onValueChange={val => {
            setPermissions(val as any);
          }}
          defaultValue={permissions}
        >
          <SelectTrigger className="w-full h-26 -mt-3">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            <SelectGroup>
              {/* Private */}
              <SelectItem value="private">
                <div className="p-2 flex gap-4 justify-center items-center">
                  <Lock />
                  <article className="text-left flex flex-col">
                    <span>Private</span>
                    <p>
                      Your workspace is private to you. You can choose to share
                      it later.
                    </p>
                  </article>
                </div>
              </SelectItem>

              {/* Shared */}
              <SelectItem value="shared">
                <div className="p-2 flex gap-4 justify-center items-center">
                  <Share></Share>
                  <article className="text-left flex flex-col">
                    <span>Shared</span>
                    <span>You can invite collaborators.</span>
                  </article>
                </div>
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </>

      {/* ====== Collaborator Searcher ====== */}
      {permissions === WorkspacesPermissions.shared && (
        <div className="pb-2">
          <CollaboratorSearch
            existingCollaborators={collaborators}
            getCollaborator={user => {
              addCollaborator(user);
            }}
          >
            <Button type="button" className="text-sm mt-4">
              <Plus />
              Add Collaborators
            </Button>
          </CollaboratorSearch>

          {/* --- Collaborators added --- */}
          <div className="mt-4">
            <span className="text-sm text-muted-foreground">
              Collaborators: {collaborators.length || ''}
            </span>

            <ScrollArea className="h-[120px] overflow-y-scroll w-full rounded-md border border-muted-foreground/20">
              {collaborators.length ? (
                collaborators.map(collaborator => (
                  <div
                    className="p-4 flex justify-between items-center"
                    key={collaborator.id}
                  >
                    <div className="flex gap-4 items-center">
                      <Avatar>
                        <AvatarImage src="/avatars/7.png" />
                        <AvatarFallback>PJ</AvatarFallback>
                      </Avatar>
                      <div className="text-sm gap-2 text-muted-foreground overflow-hidden overflow-ellipsis sm:w-[300px] w-[140px]">
                        {collaborator.email}
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      onClick={() => removeCollaborator(collaborator)}
                    >
                      Remove
                    </Button>
                  </div>
                ))
              ) : (
                <div className="absolute right-0 left-0 top-0 bottom-0 flex justify-center items-center">
                  <span className="text-muted-foreground text-sm">
                    You have no collaborators
                  </span>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      )}

      {/* ====== Create Button ====== */}
      <Button
        type="button"
        disabled={
          !title ||
          (permissions === 'shared' && !collaborators.length) ||
          isLoading
        }
        variant={'secondary'}
        onClick={createItem}
      >
        Create
      </Button>
    </div>
  );
};

export default WorkspaceCreator;
