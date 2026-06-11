import re
import sys

def main():
    file_path = 'app/components/agents/imprenta-panel.tsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract Dummy Card
    dummy_start_str = '                        <div \n                          key={node.id}\n                          ref={(el) => registerNodeRef(node.id, el)}'
    dummy_start_idx = content.find(dummy_start_str)
    if dummy_start_idx != -1:
        current_idx = content.find('<div', dummy_start_idx)
        depth = 0
        dummy_end_idx = -1
        for match in re.finditer(r'</?div[^>]*>', content[current_idx:]):
            tag = match.group()
            if tag.startswith('</div'): depth -= 1
            elif tag.startswith('<div') and not tag.endswith('/>'): depth += 1
            if depth == 0:
                dummy_end_idx = current_idx + match.end()
                break
        
        extracted_dummy_jsx = content[dummy_start_idx:dummy_end_idx]
        dummy_component = """const ImprentaDummyCardInner = memo(({ 
  node, 
  pos, 
  draggingNodeId, 
  liteDummy, 
  registerNodeRef 
}: {
  node: InstanceNode
  pos: { x: number; y: number }
  draggingNodeId: string | null
  liteDummy: boolean
  registerNodeRef: (id: string, el: HTMLDivElement | null) => void
}) => {
  const mediaTypeForDummy = (node.settings as any)?.media_type || node.type.replace('generate-', '')
  const isMediaDummy = mediaTypeForDummy === 'image' || mediaTypeForDummy === 'video' || mediaTypeForDummy === 'audio'
  const isVideoDummy = mediaTypeForDummy === 'video'
  
  const aspectRatioParam = (node.settings as any)?.parameters?.aspectRatio
  let aspectStyle = "1/1"
  if (isVideoDummy) aspectStyle = "16/9"
  
  if (aspectRatioParam) {
    if (aspectRatioParam === "16:9") aspectStyle = "16/9"
    else if (aspectRatioParam === "9:16") aspectStyle = "9/16"
    else if (aspectRatioParam === "4:3") aspectStyle = "4/3"
    else if (aspectRatioParam === "3:4") aspectStyle = "3/4"
    else if (aspectRatioParam === "1:1") aspectStyle = "1/1"
    else aspectStyle = String(aspectRatioParam).replace(':', '/')
  }

  return (
""" + extracted_dummy_jsx[extracted_dummy_jsx.find('<div'):] + """
  )
})
"""
        content = content.replace(extracted_dummy_jsx, """                        <ImprentaDummyCardInner
                          key={node.id}
                          node={node}
                          pos={pos}
                          draggingNodeId={draggingNodeId}
                          liteDummy={liteDummy}
                          registerNodeRef={registerNodeRef}
                        />""")
        content = content.replace('export function ImprentaPanel', dummy_component + '\nexport function ImprentaPanel')


    # Extract Main Card
    main_start_str = '                      <div \n                        key={node.id}\n                        ref={(el) => registerNodeRef(node.id, el)}'
    main_start_idx = content.find(main_start_str)
    if main_start_idx != -1:
        current_idx = content.find('<div', main_start_idx)
        depth = 0
        main_end_idx = -1
        for match in re.finditer(r'</?div[^>]*>', content[current_idx:]):
            tag = match.group()
            if tag.startswith('</div'): depth -= 1
            elif tag.startswith('<div') and not tag.endswith('/>'): depth += 1
            if depth == 0:
                main_end_idx = current_idx + match.end()
                break
                
        extracted_main_jsx = content[main_start_idx:main_end_idx]
        
        main_component = """const ImprentaNodeCardInner = memo(({
  node,
  pos,
  draggingNodeId,
  hasResult,
  actionRunning,
  hasCnt,
  hasAud,
  needAudience,
  registerNodeRef,
  nodes,
  dummyNodes,
  contexts,
  supabase,
  generatingNodeIds,
  currentSite,
  textParams,
  imageParams,
  videoParams,
  audioParams,
  renderMediaWithZoom,
  actions
}: {
  node: InstanceNode
  pos: { x: number; y: number }
  draggingNodeId: string | null
  hasResult: boolean
  actionRunning: boolean
  hasCnt: boolean
  hasAud: boolean
  needAudience: boolean
  registerNodeRef: (id: string, el: HTMLDivElement | null) => void
  nodes: InstanceNode[]
  dummyNodes: InstanceNode[]
  contexts: any[]
  supabase: any
  generatingNodeIds: Set<string>
  currentSite: any
  textParams: any
  imageParams: any
  videoParams: any
  audioParams: any
  renderMediaWithZoom: any
  actions: {
    handleNodeMouseDown: (e: any, id: string) => void
    handleDeleteNode: (id: string) => void
    handleDuplicateNode: (id: string) => void
    handleConnectionDrop: (e: any, id: string, type?: string) => void
    handleConnectionStart: (e: any, id: string) => void
    handleExecuteNode: (node: InstanceNode) => void
    setNodes: any
    setZoomedMedia: any
    handleImprentaNodeHover: (id: string | null) => void
    isImprentaWorkflowActionNode: (node: InstanceNode) => boolean
    getParentNode: (node: InstanceNode) => InstanceNode | undefined
    handleCreateActionFromContext: (ctx: any) => void
  }
}) => {
  return (
""" + extracted_main_jsx[extracted_main_jsx.find('<div'):] + """
  )
})
"""
        
        # Replacements inside main_component
        replacements = {
            'handleNodeMouseDown(': 'actions.handleNodeMouseDown(',
            'handleDeleteNode(': 'actions.handleDeleteNode(',
            'handleDuplicateNode(': 'actions.handleDuplicateNode(',
            'handleConnectionDrop(': 'actions.handleConnectionDrop(',
            'handleConnectionStart(': 'actions.handleConnectionStart(',
            'handleExecuteNode(': 'actions.handleExecuteNode(',
            'setNodes(': 'actions.setNodes(',
            'setZoomedMedia(': 'actions.setZoomedMedia(',
            'handleImprentaNodeHover(': 'actions.handleImprentaNodeHover(',
            'isImprentaWorkflowActionNode(': 'actions.isImprentaWorkflowActionNode(',
            'actionNodeIds.has(node.id)': 'actionRunning',
            'const parentNode = node.parent_node_id ? nodes.find(n => n.id === node.parent_node_id) : null;': 'const parentNode = actions.getParentNode(node);',
            'handleCreateActionFromContext(': 'actions.handleCreateActionFromContext(',
            'setNodes(prev =>': 'actions.setNodes((prev: InstanceNode[]) =>',
            'setNodes((prev) =>': 'actions.setNodes((prev: InstanceNode[]) =>',
            'prev.map(n =>': 'prev.map((n: InstanceNode) =>',
            'prev.map((n) =>': 'prev.map((n: InstanceNode) =>',
            'e.stopPropagation()\n                                    actions.handleDeleteNode(node.id)': 'e.stopPropagation()\n                                    void actions.handleDeleteNode(node.id)',
        }
        
        for old, new_s in replacements.items():
            main_component = main_component.replace(old, new_s)
            
        # Fix publish destinations block
        pub_logic = main_component.find('const dest = Array.isArray((node.settings as any)?.publish_destinations)')
        if pub_logic != -1:
            ret_start = main_component.find('return (', pub_logic)
            old_pub_block = main_component[pub_logic:ret_start]
            main_component = main_component.replace(old_pub_block, """const contentWarn = !hasCnt;
                                  const audienceWarn = needAudience && !hasAud;
                                  const anchorClass = (warn: boolean) =>
                                    `w-4 h-4 bg-background border-2 rounded-full flex items-center justify-center shrink-0 hover:scale-125 transition-transform ${
                                      warn ? "border-amber-500" : "border-muted-foreground"
                                    }`;
                                  """)
        
        replacement_jsx = """                      <ImprentaNodeCardInner
                        key={node.id}
                        node={node}
                        pos={pos}
                        draggingNodeId={draggingNodeId}
                        hasResult={hasResult}
                        actionRunning={actionNodeIds.has(node.id)}
                        hasCnt={
                           node.type === "publish" 
                             ? hasPublishContentInput(contexts, node.id, [...nodes, ...dummyNodes]) 
                             : false
                        }
                        hasAud={
                           node.type === "publish" 
                             ? hasPublishAudienceInput(contexts, node.id, [...nodes, ...dummyNodes]) 
                             : false
                        }
                        needAudience={
                           node.type === "publish" 
                             ? destinationsRequireAudience(Array.isArray((node.settings as any)?.publish_destinations) ? (node.settings as any).publish_destinations as string[] : []) 
                             : false
                        }
                        registerNodeRef={registerNodeRef}
                        nodes={nodes}
                        dummyNodes={dummyNodes}
                        contexts={contexts}
                        supabase={supabase}
                        generatingNodeIds={generatingNodeIds}
                        currentSite={currentSite}
                        textParams={textParams}
                        imageParams={imageParams}
                        videoParams={videoParams}
                        audioParams={audioParams}
                        renderMediaWithZoom={renderMediaWithZoom}
                        actions={actionsRef.current}
                      />"""
                      
        content = content.replace(extracted_main_jsx, replacement_jsx)
        content = content.replace('export function ImprentaPanel', main_component + '\nexport function ImprentaPanel')

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
if __name__ == '__main__':
    main()
