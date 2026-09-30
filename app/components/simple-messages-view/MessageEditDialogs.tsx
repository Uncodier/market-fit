"use client"

import { EditStepModal } from './components/EditStepModal'
import { EditPlanModal } from './components/EditPlanModal'
import { EditBacklogModal } from './components/EditBacklogModal'
import { EditPendingWorkModal } from './components/EditPendingWorkModal'

import type { useSimpleMessagesView } from "./use-simple-messages-view"
export function MessageEditDialogs({ message, isEditPendingModalOpen, setIsEditPendingModalOpen, editPendingId, editPendingMessage, setEditPendingMessage, isEditBacklogModalOpen, editBacklogTitle, setEditBacklogTitle, closeEditBacklogModal, saveBacklogItem, isEditModalOpen, editTitle, editDescription, setEditTitle, setEditDescription, closeEditModal, saveStep, isEditPlanModalOpen, editPlanTitle, editPlanDescription, setEditPlanTitle, setEditPlanDescription, closeEditPlanModal, savePlan, editPending }: ReturnType<typeof useSimpleMessagesView>) {
return (<>      {/* Edit Step Modal */}
      <EditStepModal
        open={isEditModalOpen}
        title={editTitle}
        description={editDescription}
        onTitleChange={setEditTitle}
        onDescriptionChange={setEditDescription}
        onSave={saveStep}
        onClose={closeEditModal}
      />

      {/* Edit Plan Modal */}
      <EditPlanModal
        open={isEditPlanModalOpen}
        title={editPlanTitle}
        description={editPlanDescription}
        onTitleChange={setEditPlanTitle}
        onDescriptionChange={setEditPlanDescription}
        onSave={savePlan}
        onClose={closeEditPlanModal}
      />

      {/* Edit Backlog Item Modal */}
      <EditBacklogModal
        open={isEditBacklogModalOpen}
        title={editBacklogTitle}
        onTitleChange={setEditBacklogTitle}
        onSave={saveBacklogItem}
        onClose={closeEditBacklogModal}
      />

      {/* Edit Pending Work Modal */}
      <EditPendingWorkModal
        open={isEditPendingModalOpen}
        message={editPendingMessage}
        onMessageChange={setEditPendingMessage}
        onSave={() => {
          editPending(editPendingId, editPendingMessage)
          setIsEditPendingModalOpen(false)
        }}
        onClose={() => setIsEditPendingModalOpen(false)}
      />
</>)
}
