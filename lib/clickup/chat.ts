import { clickUpFetch } from './client';
import { ClickUpChatChannel, ClickUpChatMessage, ClickUpComment } from './types';
import { getSpaces } from './spaces';
import { getFolders } from './folders';
import { getWorkspaceMembers } from './users';

export interface ClickUpView {
  id: string;
  name: string;
  type: string;
  parent: {
    id: string;
    type: number;
  };
}

export async function getTeamViews(teamId: string, token?: string): Promise<{ views: ClickUpView[] }> {
  return await clickUpFetch<{ views: ClickUpView[] }>(`/team/${teamId}/view`, { token });
}

export async function getSpaceViews(spaceId: string, token?: string): Promise<{ views: ClickUpView[] }> {
  return await clickUpFetch<{ views: ClickUpView[] }>(`/space/${spaceId}/view`, { token });
}

export async function getListViews(listId: string, token?: string): Promise<{ views: ClickUpView[] }> {
  return await clickUpFetch<{ views: ClickUpView[] }>(`/list/${listId}/view`, { token });
}

export async function getViewComments(viewId: string, token?: string): Promise<{ comments: ClickUpComment[] }> {
  return await clickUpFetch<{ comments: ClickUpComment[] }>(`/view/${viewId}/comment`, { token });
}

export async function postViewComment(
  viewId: string,
  commentText: string,
  parentId?: string,
  notifyAll: boolean = true,
  token?: string
): Promise<ClickUpComment> {
  const body: any = {
    comment_text: commentText,
    notify_all: notifyAll,
  };
  if (parentId) {
    body.parent = parentId;
  }
  return await clickUpFetch<ClickUpComment>(`/view/${viewId}/comment`, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });
}

export async function getChatChannels(workspaceId: string, token?: string): Promise<ClickUpChatChannel[]> {
  try {
    const chatChannels: ClickUpChatChannel[] = [];
    const seenViewIds = new Set<string>();

    // 1. Scan Team / Workspace Views (Contains General Workspace Chat View)
    try {
      const teamViewsData = await getTeamViews(workspaceId, token);
      const teamConvViews = (teamViewsData.views || []).filter((v) => v.type === 'conversation' || v.type === 'chat');

      for (const tView of teamConvViews) {
        if (!seenViewIds.has(tView.id)) {
          seenViewIds.add(tView.id);
          chatChannels.push({
            id: tView.id,
            name: `📢 General - ${tView.name}`,
            type: 'general',
            unread_count: 0,
            last_message: 'Diskusi Utama Workspace',
          });
        }
      }
    } catch {
      // ignore team view errors
    }

    // Always ensure General Workspace Channel is present as first priority
    if (!seenViewIds.has('7-90182855619-8')) {
      seenViewIds.add('7-90182855619-8');
      chatChannels.unshift({
        id: '7-90182855619-8',
        name: '📢 General - Bilik Strategi Workspace',
        type: 'general',
        unread_count: 0,
        last_message: 'Diskusi Utama Workspace',
      });
    }

    // 2. Scan Space Views
    const spacesData = await getSpaces(workspaceId, token);
    const spaces = spacesData.spaces || [];

    for (const space of spaces) {
      try {
        const viewData = await getSpaceViews(space.id, token);
        const convViews = (viewData.views || []).filter((v) => v.type === 'conversation' || v.type === 'chat');

        for (const view of convViews) {
          if (!seenViewIds.has(view.id)) {
            seenViewIds.add(view.id);
            chatChannels.push({
              id: view.id,
              name: `💬 ${view.name}`,
              type: 'project',
              unread_count: 0,
              last_message: 'Channel ClickUp Terhubung',
            });
          }
        }

        // 3. Scan Folder & List Views
        const folderData = await getFolders(space.id, token);
        for (const folder of folderData.folders || []) {
          for (const list of folder.lists || []) {
            try {
              const listViewsData = await getListViews(list.id, token);
              const listConvViews = (listViewsData.views || []).filter((v) => v.type === 'conversation' || v.type === 'chat');

              for (const lView of listConvViews) {
                if (!seenViewIds.has(lView.id)) {
                  seenViewIds.add(lView.id);
                  chatChannels.push({
                    id: lView.id,
                    name: `💬 ${lView.name}`,
                    type: 'project',
                    unread_count: 0,
                    last_message: 'Channel List ClickUp Terhubung',
                  });
                }
              }
            } catch {
              // ignore list view errors
            }
          }
        }
      } catch {
        // ignore space view errors
      }
    }

    // 4. Scan Direct Messages (Team Members)
    try {
      const members = await getWorkspaceMembers(workspaceId, token);
      for (const m of members) {
        if (m.username && !m.username.includes('Dinur')) {
          const cleanName = m.username.toLowerCase().split(' ')[0];
          chatChannels.push({
            id: `dm_${cleanName}`,
            name: `👤 DM: ${m.username}`,
            type: 'direct',
            unread_count: 0,
            last_message: 'Pesan Langsung (Direct Message)',
          });
        }
      }
    } catch {
      // ignore members error
    }

    return chatChannels;
  } catch (error) {
    console.warn('[ClickUp Chat Adapter] Gagal mengambil chat channels.', error);
    return [
      { id: '7-90182855619-8', name: '📢 General - Bilik Strategi Workspace', type: 'general', unread_count: 0 },
      { id: '4-901811772332-8', name: '💬 Media Brand', type: 'project', unread_count: 0 },
      { id: '6-901819386455-8', name: '💬 Brainstorming', type: 'project', unread_count: 0 },
      { id: '6-901819384971-8', name: '💬 Approval Script', type: 'project', unread_count: 0 },
      { id: '6-901819385000-8', name: '💬 Approval Content', type: 'project', unread_count: 0 },
    ];
  }
}
