import re
import sys

def main():
    file_path = 'app/components/agents/imprenta-panel.tsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # We need to find the main return (
    # <div key={node.id} ref={(el) => registerNodeRef(node.id, el)} ...
    # ending at the corresponding </div>
    
    start_str = '                    return (\n                      <div \n                        key={node.id}\n                        ref={(el) => registerNodeRef(node.id, el)}'
    
    start_idx = content.find(start_str)
    if start_idx == -1:
        print("Could not find start string")
        sys.exit(1)
        
    print(f"Found start at {start_idx}")
    
    # Let's find the matching closing div for that level
    # We will count div pairs starting from that point
    current_idx = content.find('<div', start_idx)
    depth = 0
    end_idx = -1
    
    tag_pattern = re.compile(r'</?div[^>]*>')
    
    for match in tag_pattern.finditer(content, current_idx):
        tag = match.group()
        if tag.startswith('</div'):
            depth -= 1
        elif tag.startswith('<div'):
            # Only count if it's not self-closing (divs usually aren't, but just in case)
            if not tag.endswith('/>'):
                depth += 1
                
        if depth == 0:
            end_idx = match.end()
            break
            
    if end_idx == -1:
        print("Could not find matching end div")
        sys.exit(1)
        
    extracted_jsx = content[start_idx:end_idx]
    
    # We need to compute derived props like hasCnt, hasAud, actionRunning OUTSIDE the memo component?
    # No, we can pass them as primitives.
    
    print(f"Extracted {len(extracted_jsx)} chars")
    
    # Create the component string
    component_str = """const ImprentaNodeCardInner = memo(({
  node,
  pos,
  draggingNodeId,
  hasResult,
  actionRunning,
  hasCnt,
  hasAud,
  needAudience,
  registerNodeRef,
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
  }
}) => {
  return (
    <div 
      ref={(el) => registerNodeRef(node.id, el)}
      data-node-id={node.id}
      className={cn(
        "absolute cursor-grab active:cursor-grabbing",
        draggingNodeId ? "select-none" : ""
      )}
      style={{ 
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        left: 0,
        top: 0,
        zIndex: 10
      }}
      onMouseDown={(e) => actions.handleNodeMouseDown(e, node.id)}
    >
""" + extracted_jsx[extracted_jsx.find('<Card'):] + "\n  )\n})\n"
    
    # Replace action calls inside component_str
    replacements = {
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
    }
    
    # also remove this inline logic from the component
    # const dest = Array.isArray((node.settings as any)?.publish_destinations) ? ... 
    # and replace with the primitives passed
    
    # In the original, the publish logic:
    publish_logic_start = component_str.find('const dest = Array.isArray((node.settings as any)?.publish_destinations)')
    if publish_logic_start != -1:
        # find the end of this IIFE up to return (
        return_start = component_str.find('return (', publish_logic_start)
        
        if return_start != -1:
            # We will just replace all those lines with setting the local vars if needed, but wait!
            # Since hasCnt, hasAud, needAudience are passed as props, we can just replace their usage.
            # Actually, I can just replace the whole block.
            
            old_publish_block = component_str[publish_logic_start:return_start]
            component_str = component_str.replace(old_publish_block, """const contentWarn = !hasCnt;
                                  const audienceWarn = needAudience && !hasAud;
                                  const anchorClass = (warn: boolean) =>
                                    `w-4 h-4 bg-background border-2 rounded-full flex items-center justify-center shrink-0 hover:scale-125 transition-transform ${
                                      warn ? "border-amber-500" : "border-muted-foreground"
                                    }`;
                                  """)
    
    for old, new_s in replacements.items():
        component_str = component_str.replace(old, new_s)
        
    # Also parentNode is computed dynamically inside onClick.
    # It accesses `nodes.find` which we don't pass.
    # Let's pass `nodes` as well? No, we don't want to pass `nodes`.
    # Let's just pass parentNode: InstanceNode | undefined
    
    component_str = component_str.replace('const parentNode = node.parent_node_id ? nodes.find(n => n.id === node.parent_node_id) : null;', 
                                        'const parentNode = actions.getParentNode(node);')
    component_str = component_str.replace('parentNode &&', 'parentNode &&')
    
    # Add getParentNode to actions:
    component_str = component_str.replace('handleImprentaNodeHover: (id: string | null) => void',
                                        'handleImprentaNodeHover: (id: string | null) => void\n    getParentNode: (node: InstanceNode) => InstanceNode | undefined')
    
    # In the original file, we replace extracted_jsx with:
    # return (
    #   <ImprentaNodeCardInner
    #     key={node.id}
    #     node={node}
    #     pos={pos}
    #     draggingNodeId={draggingNodeId}
    #     hasResult={hasResult}
    #     actionRunning={actionNodeIds.has(node.id)}
    #     hasCnt={(() => {
    #        if (node.type !== "publish") return false;
    #        const allNodes = [...nodes, ...dummyNodes];
    #        return hasPublishContentInput(contexts, node.id, allNodes);
    #     })()}
    #     hasAud={(() => {
    #        if (node.type !== "publish") return false;
    #        const allNodes = [...nodes, ...dummyNodes];
    #        return hasPublishAudienceInput(contexts, node.id, allNodes);
    #     })()}
    #     needAudience={(() => {
    #        if (node.type !== "publish") return false;
    #        const dest = Array.isArray((node.settings as any)?.publish_destinations)
    #               ? ((node.settings as any).publish_destinations as string[])
    #               : [];
    #        return destinationsRequireAudience(dest);
    #     })()}
    #     registerNodeRef={registerNodeRef}
    #     actions={actionsRef.current}
    #   />
    # )
    
    replacement_jsx = """                    return (
                      <ImprentaNodeCardInner
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
                        actions={actionsRef.current}
                      />
                    )"""

    new_content = content.replace(extracted_jsx, replacement_jsx)
    
    # insert component_str before export function ImprentaPanel
    export_idx = new_content.find('export function ImprentaPanel')
    if export_idx == -1:
        print("Could not find export function ImprentaPanel")
        sys.exit(1)
        
    final_content = new_content[:export_idx] + component_str + '\n' + new_content[export_idx:]
    
    with open('app/components/agents/imprenta-panel.tsx', 'w', encoding='utf-8') as f:
        f.write(final_content)
        
    print("Successfully refactored")

if __name__ == '__main__':
    main()
