import { prisma } from "@/lib/prisma";

export type ModeratorActionType =
  | "SUBMISSION_APPROVED"
  | "SUBMISSION_REJECTED"
  | "DOCUMENT_UPDATED"
  | "DOCUMENT_DELETED"
  | "REPORT_RESOLVED"
  | "REPORT_DISMISSED"
  | "PROMOTION_APPROVED"
  | "PROMOTION_REJECTED"
  | "FEEDBACK_RESOLVED"
  | "FEEDBACK_DISMISSED"
  | "DELETION_REQUEST_CREATED"
  | "DELETION_REQUEST_REJECTED"
  | "ROLE_UPDATED";

export type ModeratorTargetType =
  | "SUBMISSION"
  | "DOCUMENT"
  | "REPORT"
  | "PROMOTION"
  | "FEEDBACK"
  | "USER";

export interface LogModeratorActionParams {
  userId: string;
  action: ModeratorActionType;
  targetType: ModeratorTargetType;
  targetId?: string;
  targetTitle?: string;
  details?: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * Registra una acción de moderación / auditoría en la base de datos
 */
export async function logModeratorAction(params: LogModeratorActionParams) {
  try {
    return await prisma.moderatorLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        targetTitle: params.targetTitle,
        details: params.details,
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
      },
    });
  } catch (error) {
    console.warn("Could not log moderator action to database:", error);
    return null;
  }
}
