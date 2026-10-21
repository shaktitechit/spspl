/**
 * @fileoverview React Hook for Real-time Project Socket.IO communication.
 * @module hooks/useProjectSocket
 */
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { WORK_PLANNER_SERVICE_URL } from '@/lib/env';
import type { ProjectMessage, ProjectActionStep, ProjectFileItem, Project } from '@/types/project';

interface UseProjectSocketOptions {
  projectId: string;
  token: string | null;
  onNewMessage?: (msg: ProjectMessage) => void;
  onStepUpdated?: (step: ProjectActionStep | { _id: string; isDeleted?: boolean }) => void;
  onFileUploaded?: (file: ProjectFileItem) => void;
  onProjectUpdated?: (project: Project) => void;
  onProjectClosed?: (project: Project) => void;
}

export function useProjectSocket({
  projectId,
  token,
  onNewMessage,
  onStepUpdated,
  onFileUploaded,
  onProjectUpdated,
  onProjectClosed,
}: UseProjectSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Array<{ id: string; name: string }>>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Store callbacks in ref to avoid triggering useEffect re-runs
  const callbacksRef = useRef({
    onNewMessage,
    onStepUpdated,
    onFileUploaded,
    onProjectUpdated,
    onProjectClosed,
  });

  useEffect(() => {
    callbacksRef.current = {
      onNewMessage,
      onStepUpdated,
      onFileUploaded,
      onProjectUpdated,
      onProjectClosed,
    };
  });

  useEffect(() => {
    if (!projectId || !token) return;

    const socketUrl = WORK_PLANNER_SERVICE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    if (!socketUrl) return;

    const socket = io(socketUrl, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('project:join', { projectId });
    });

    socket.on('connect_error', (err) => {
      console.warn('[ProjectSocket] Connect error:', err.message);
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
    });

    socket.on('project:new_message', (payload: { projectId: string; message: ProjectMessage }) => {
      if (payload.projectId === projectId && callbacksRef.current.onNewMessage) {
        callbacksRef.current.onNewMessage(payload.message);
      }
    });

    socket.on(
      'project:user_typing',
      (payload: { projectId: string; user: { id: string; name: string }; isTyping: boolean }) => {
        if (payload.projectId !== projectId) return;
        setTypingUsers((prev) => {
          if (payload.isTyping) {
            if (!prev.some((u) => u.id === payload.user.id)) {
              return [...prev, payload.user];
            }
            return prev;
          } else {
            return prev.filter((u) => u.id !== payload.user.id);
          }
        });
      }
    );

    socket.on(
      'project:step_updated',
      (payload: { projectId: string; step: ProjectActionStep | { _id: string; isDeleted?: boolean } }) => {
        if (payload.projectId === projectId && callbacksRef.current.onStepUpdated) {
          callbacksRef.current.onStepUpdated(payload.step);
        }
      }
    );

    socket.on('project:file_uploaded', (payload: { projectId: string; file: ProjectFileItem }) => {
      if (payload.projectId === projectId && callbacksRef.current.onFileUploaded) {
        callbacksRef.current.onFileUploaded(payload.file);
      }
    });

    socket.on('project:updated', (payload: { projectId: string; project: Project }) => {
      if (payload.projectId === projectId && callbacksRef.current.onProjectUpdated) {
        callbacksRef.current.onProjectUpdated(payload.project);
      }
    });

    socket.on('project:closed', (payload: { projectId: string; project: Project }) => {
      if (payload.projectId === projectId && callbacksRef.current.onProjectClosed) {
        callbacksRef.current.onProjectClosed(payload.project);
      }
    });

    return () => {
      socket.emit('project:leave', { projectId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [projectId, token]);

  const sendMessage = useCallback(
    (content: string, attachments: any[] = [], mentions: string[] = [], action_step_id: string | null = null) => {
      if (!socketRef.current || !isConnected) return;
      socketRef.current.emit('project:send_message', {
        projectId,
        content,
        attachments,
        mentions,
        action_step_id,
      });
    },
    [projectId, isConnected]
  );

  const startTyping = useCallback(() => {
    if (!socketRef.current || !isConnected) return;
    socketRef.current.emit('project:typing_start', { projectId });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('project:typing_stop', { projectId });
    }, 3000);
  }, [projectId, isConnected]);

  const stopTyping = useCallback(() => {
    if (!socketRef.current || !isConnected) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socketRef.current.emit('project:typing_stop', { projectId });
  }, [projectId, isConnected]);

  return {
    isConnected,
    typingUsers,
    sendMessage,
    startTyping,
    stopTyping,
  };
}
