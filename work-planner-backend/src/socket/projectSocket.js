/**
 * @fileoverview Socket.IO Real-Time Server for Project Management & Chat Rooms.
 * @module socket/projectSocket
 */
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const { logger } = require('../utils/logger');
const chatService = require('../modules/project/projectChat.service');
const { getModels } = require('../data/mongoRegistry');

let ioInstance = null;

/**
 * Initialize Socket.IO with HTTP server.
 */
function initProjectSocket(httpServer, corsOptions) {
  ioInstance = new Server(httpServer, {
    cors: corsOptions || {
      origin: true,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication Middleware for Sockets
  ioInstance.use(async (socket, next) => {
    try {
      let rawToken =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization ||
        socket.handshake.query?.token;

      if (rawToken && rawToken.startsWith('Bearer ')) {
        rawToken = rawToken.slice(7);
      }

      if (!rawToken) {
        return next(new Error('Authentication required for socket connection'));
      }

      const payload = jwt.verify(rawToken, JWT_SECRET);
      socket.user = {
        _id: String(payload.sub || payload._id || ''),
        id: String(payload.sub || payload._id || ''),
        name: payload.name || 'User',
        email: payload.email || '',
        roles: payload.roles || [],
        portals: payload.portals || [],
      };
      next();
    } catch (err) {
      logger.warn(`Socket authentication failed: ${err.message}`);
      next(new Error('Invalid or expired socket authentication token'));
    }
  });

  // Socket Connection Handlers
  ioInstance.on('connection', (socket) => {
    const user = socket.user;
    logger.info(`[Socket.IO] Client connected: ${socket.id} (User: ${user?.name} [${user?.id}])`);

    // User personal room for direct notifications
    if (user?.id) {
      socket.join(`user:${user.id}`);
    }

    // Join Project Room
    socket.on('project:join', ({ projectId }) => {
      if (!projectId) return;
      const room = `project:${projectId}`;
      socket.join(room);
      logger.info(`[Socket.IO] User ${user?.name} joined room ${room}`);
      socket.to(room).emit('project:member_joined', {
        projectId,
        user: { id: user.id, name: user.name },
      });
    });

    // Leave Project Room
    socket.on('project:leave', ({ projectId }) => {
      if (!projectId) return;
      const room = `project:${projectId}`;
      socket.leave(room);
      logger.info(`[Socket.IO] User ${user?.name} left room ${room}`);
      socket.to(room).emit('project:member_left', {
        projectId,
        user: { id: user.id, name: user.name },
      });
    });

    // Send Project Message
    socket.on('project:send_message', async (data, callback) => {
      try {
        const { projectId, content, attachments, mentions, action_step_id, message_type } = data;
        if (!projectId) {
          if (typeof callback === 'function') callback({ success: false, error: 'projectId is required' });
          return;
        }

        const savedMessage = await chatService.postMessage(
          projectId,
          { content, attachments, mentions, action_step_id, message_type },
          user
        );

        // Broadcast to all participants in the project room
        ioInstance.to(`project:${projectId}`).emit('project:new_message', {
          projectId,
          message: savedMessage,
        });

        // Notify mentioned users who might not be in the room
        if (Array.isArray(mentions) && mentions.length > 0) {
          notifyMentionedUsers(projectId, mentions, user, savedMessage);
        }

        if (typeof callback === 'function') callback({ success: true, data: savedMessage });
      } catch (err) {
        logger.error(`[Socket.IO] Failed to send project message: ${err.message}`);
        if (typeof callback === 'function') callback({ success: false, error: err.message });
      }
    });

    // Typing Indicators
    socket.on('project:typing_start', ({ projectId }) => {
      if (!projectId) return;
      socket.to(`project:${projectId}`).emit('project:user_typing', {
        projectId,
        user: { id: user.id, name: user.name },
        isTyping: true,
      });
    });

    socket.on('project:typing_stop', ({ projectId }) => {
      if (!projectId) return;
      socket.to(`project:${projectId}`).emit('project:user_typing', {
        projectId,
        user: { id: user.id, name: user.name },
        isTyping: false,
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      logger.info(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return ioInstance;
}

/**
 * Send notification to mentioned users.
 */
async function notifyMentionedUsers(projectId, mentionIds, sender, message) {
  try {
    const { Notification, Project } = getModels();
    const project = await Project.findById(projectId).lean();
    const projectTitle = project?.title || 'Project';

    const notifDocs = mentionIds
      .filter((uid) => String(uid) !== String(sender.id))
      .map((uid) => ({
        user: uid,
        title: `Mentioned in ${projectTitle}`,
        message: `${sender.name} mentioned you in ${projectTitle}: "${(message.content || 'Sent an attachment').slice(0, 80)}"`,
        type: 'info',
        module: 'project_management',
        entity_type: 'project',
        entity_id: projectId,
        is_read: false,
      }));

    if (notifDocs.length > 0) {
      await Notification.insertMany(notifDocs);

      // Emit real-time notification to user personal rooms
      if (ioInstance) {
        mentionIds.forEach((uid) => {
          ioInstance.to(`user:${uid}`).emit('notification:new', {
            title: `Mentioned in ${projectTitle}`,
            message: `${sender.name} mentioned you in project chat`,
            projectId,
          });
        });
      }
    }
  } catch (err) {
    logger.warn(`Failed to dispatch mention notifications: ${err.message}`);
  }
}

// -------------------------------------------------------------
// Helper Emitters called by Controller / Service layers
// -------------------------------------------------------------

function getIO() {
  return ioInstance;
}

function emitProjectMessage(projectId, message) {
  if (ioInstance) {
    ioInstance.to(`project:${projectId}`).emit('project:new_message', {
      projectId,
      message,
    });
  }
}

function emitProjectUpdated(projectId, project) {
  if (ioInstance) {
    ioInstance.to(`project:${projectId}`).emit('project:updated', {
      projectId,
      project,
    });
  }
}

function emitStepUpdated(projectId, step) {
  if (ioInstance) {
    ioInstance.to(`project:${projectId}`).emit('project:step_updated', {
      projectId,
      step,
    });
  }
}

function emitFileUploaded(projectId, fileRecord) {
  if (ioInstance) {
    ioInstance.to(`project:${projectId}`).emit('project:file_uploaded', {
      projectId,
      file: fileRecord,
    });
  }
}

function emitProjectClosed(projectId, project) {
  if (ioInstance) {
    ioInstance.to(`project:${projectId}`).emit('project:closed', {
      projectId,
      project,
    });
  }
}

module.exports = {
  initProjectSocket,
  getIO,
  emitProjectMessage,
  emitProjectUpdated,
  emitStepUpdated,
  emitFileUploaded,
  emitProjectClosed,
};
