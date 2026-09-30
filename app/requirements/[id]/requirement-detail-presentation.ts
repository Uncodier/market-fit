import { COMPLETION_STATUS,REQUIREMENT_STATUS,type CompletionStatusType,type RequirementStatusType } from "./requirement-detail-types"
  // Helper functions for styling
export const getPriorityColor = (priority: "high" | "medium" | "low") => {
    const priorityColors = {
      high: "bg-red-100/20 text-red-600 dark:text-red-400 hover:bg-red-100/30 border-red-300/30",
      medium: "bg-yellow-100/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100/30 border-yellow-300/30",
      low: "bg-blue-100/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100/30 border-blue-300/30"
    }
    return priorityColors[priority]
  }

export const getStatusColor = (status: RequirementStatusType) => {
    const statusColors = {
      [REQUIREMENT_STATUS.VALIDATED]: "bg-green-100/20 text-green-600 dark:text-green-400 hover:bg-green-100/30 border-green-300/30",
      [REQUIREMENT_STATUS.IN_PROGRESS]: "bg-purple-100/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100/30 border-purple-300/30",
      [REQUIREMENT_STATUS.ON_REVIEW]: "bg-blue-100/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100/30 border-blue-300/30",
      [REQUIREMENT_STATUS.DONE]: "bg-green-100/20 text-green-600 dark:text-green-400 hover:bg-green-100/30 border-green-300/30",
      [REQUIREMENT_STATUS.BACKLOG]: "bg-gray-100/20 text-gray-600 dark:text-gray-400 hover:bg-gray-100/30 border-gray-300/30",
      [REQUIREMENT_STATUS.CANCELED]: "bg-red-100/20 text-red-600 dark:text-red-400 hover:bg-red-100/30 border-red-300/30"
    }
    return statusColors[status]
  }

export const getCompletionStatusColor = (status: CompletionStatusType) => {
    const completionStatusColors = {
      [COMPLETION_STATUS.COMPLETED]: "bg-green-100/20 text-green-600 dark:text-green-400 border-green-300/30",
      [COMPLETION_STATUS.REJECTED]: "bg-red-100/20 text-red-600 dark:text-red-400 border-red-300/30",
      [COMPLETION_STATUS.PENDING]: "bg-yellow-100/20 text-yellow-600 dark:text-yellow-400 border-yellow-300/30"
    }
    return completionStatusColors[status]
  }

export const getStatusLabel = (status: RequirementStatusType) => {
    return status === REQUIREMENT_STATUS.IN_PROGRESS 
      ? "In Progress" 
      : status === REQUIREMENT_STATUS.ON_REVIEW
        ? "On Review"
        : status === REQUIREMENT_STATUS.DONE
          ? "Done"
          : status === REQUIREMENT_STATUS.CANCELED
            ? "Canceled"
            : status === REQUIREMENT_STATUS.VALIDATED
              ? "Validated"
              : "Backlog"
  }

export const getCompletionStatusLabel = (status: CompletionStatusType) => {
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

