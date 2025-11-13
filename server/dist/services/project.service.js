import Project from "../models/project.model.js";
import Conversation from "../models/conversation.model.js";
import { invalidateCachePattern } from "./cache.service.js";
import { conversationListPattern, projectListPattern } from "../utils/cache-key.util.js";
export const getProjectsByUserId = async (userId) => {
    const projects = await Project.findByUserId(userId);
    const projectsWithCount = await Promise.all(projects.map(async (project) => {
        const conversationCount = await Conversation.count({
            where: {
                project_id: project.id,
                deleted_at: null,
            },
        });
        return {
            id: project.id,
            name: project.name,
            description: project.description,
            color: project.color,
            icon: project.icon,
            order: project.order,
            conversationCount,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
        };
    }));
    return projectsWithCount;
};
export const createProject = async (data) => {
    const maxOrder = await Project.max("order", {
        where: { user_id: data.user_id, deleted_at: null },
    });
    const project = await Project.create({
        ...data,
        order: (maxOrder || 0) + 1,
    });
    return {
        id: project.id,
        name: project.name,
        description: project.description,
        color: project.color,
        icon: project.icon,
        order: project.order,
        conversationCount: 0,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
    };
};
export const updateProject = async (projectId, userId, data) => {
    const project = await Project.findByIdActive(projectId);
    if (!project) {
        throw new Error("Project not found");
    }
    if (project.user_id !== userId) {
        throw new Error("Unauthorized: You can only update your own projects");
    }
    if (data.name !== undefined)
        project.name = data.name;
    if (data.description !== undefined)
        project.description = data.description;
    if (data.color !== undefined)
        project.color = data.color;
    if (data.icon !== undefined)
        project.icon = data.icon;
    if (data.order !== undefined)
        project.order = data.order;
    await project.save();
    const conversationCount = await Conversation.count({
        where: {
            project_id: project.id,
            deleted_at: null,
        },
    });
    return {
        id: project.id,
        name: project.name,
        description: project.description,
        color: project.color,
        icon: project.icon,
        order: project.order,
        conversationCount,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
    };
};
export const deleteProject = async (projectId, userId) => {
    const project = await Project.findByIdActive(projectId);
    if (!project) {
        throw new Error("Project not found");
    }
    if (project.user_id !== userId) {
        throw new Error("Unauthorized: You can only delete your own projects");
    }
    await Conversation.update({ project_id: null, order_in_project: 0 }, { where: { project_id: projectId } });
    await Project.softDelete(projectId);
    return { message: "Project deleted successfully" };
};
export const getProjectConversations = async (projectId, userId) => {
    const project = await Project.findByIdActive(projectId);
    if (!project) {
        throw new Error("Project not found");
    }
    if (project.user_id !== userId) {
        throw new Error("Unauthorized: You can only view your own projects");
    }
    const conversations = await Conversation.findAll({
        where: {
            project_id: projectId,
            deleted_at: null,
        },
        order: [
            ["order_in_project", "ASC"],
            ["updatedAt", "DESC"],
        ],
    });
    return conversations;
};
export const moveConversationToProject = async (conversationId, projectId, userId) => {
    const conversation = await Conversation.findByIdActive(conversationId);
    if (!conversation) {
        throw new Error("Conversation not found");
    }
    if (conversation.user_id !== userId) {
        throw new Error("Unauthorized: You can only move your own conversations");
    }
    if (projectId) {
        const project = await Project.findByIdActive(projectId);
        if (!project) {
            throw new Error("Project not found");
        }
        if (project.user_id !== userId) {
            throw new Error("Unauthorized: Project does not belong to you");
        }
        const maxOrder = await Conversation.max("order_in_project", {
            where: { project_id: projectId, deleted_at: null },
        });
        conversation.project_id = projectId;
        conversation.order_in_project = (maxOrder || 0) + 1;
    }
    else {
        conversation.project_id = null;
        conversation.order_in_project = 0;
    }
    await conversation.save();
    await invalidateCachePattern(conversationListPattern(userId));
    await invalidateCachePattern(projectListPattern(userId));
    return {
        message: projectId
            ? "Conversation moved to project successfully"
            : "Conversation removed from project successfully",
    };
};
export const updateConversationOrders = async (projectId, userId, orders) => {
    const project = await Project.findByIdActive(projectId);
    if (!project) {
        throw new Error("Project not found");
    }
    if (project.user_id !== userId) {
        throw new Error("Unauthorized: You can only update your own projects");
    }
    const updates = orders.map(({ conversationId, order }) => Conversation.update({ order_in_project: order }, { where: { id: conversationId, project_id: projectId } }));
    await Promise.all(updates);
    return { message: "Conversation orders updated successfully" };
};
